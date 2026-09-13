/**
 * PDF Extractor — server-side utility
 * Strategy:
 *  1. Try text layer first via pdf-parse (fast, free)
 *  2. If sparse/scanned → convertPdfPagesToImages() then vision LLM
 */

// Dynamically require pdf-parse to avoid Edge Runtime issues
// pdf-parse is a CJS module — use createRequire to get the actual function
let pdfParse: ((buffer: Buffer, options?: any) => Promise<{ text: string; numpages: number }>) | null = null;

async function getPdfParse() {
  if (!pdfParse) {
    // Use require() via module interop — works in Next.js Node.js runtime
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('pdf-parse');
    pdfParse = (typeof mod === 'function' ? mod : mod.default || mod) as any;
  }
  return pdfParse!;
}

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  hasTextLayer: boolean;
  /** True when text layer is too sparse — caller should run OCR */
  needsOcr: boolean;
}

/** Minimum chars per page to consider the PDF as having a real text layer */
const MIN_CHARS_PER_PAGE = 40;

/**
 * Extract text from a PDF buffer.
 * Returns `needsOcr: true` if the text layer is too sparse/empty.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<PdfExtractionResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('pdf-parse');

    let text = '';
    let pageCount = 1;

    if (mod && mod.PDFParse) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { pathToFileURL } = require('url');
        const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.mjs');
        mod.PDFParse.setWorker(pathToFileURL(workerPath).href);
        const parser = new mod.PDFParse({ data: buffer });
        const result = await parser.getText();
        text = (result?.text || '').trim();
        pageCount = result?.total || result?.pages?.length || 1;
        if (typeof parser.destroy === 'function') {
          try { parser.destroy(); } catch { /* ignore */ }
        }
      } catch {
        // Continue to secondary stream extraction
      }
    } else if (typeof mod === 'function' || (mod && typeof mod.default === 'function')) {
      const fn = typeof mod === 'function' ? mod : mod.default;
      const data = await fn(buffer, { max: 20 });
      text = (data.text || '').trim();
      pageCount = data.numpages || 1;
    }

    // Secondary fallback: extract literal text streams from raw buffer
    if (!text) {
      const raw = buffer.toString('latin1');
      const tjMatches: string[] = [];
      const tjRegex = /\(([^)]+)\)\s*Tj/g;
      let match;
      while ((match = tjRegex.exec(raw)) !== null) {
        tjMatches.push(match[1]);
      }
      if (tjMatches.length > 0) {
        text = tjMatches.join(' ').replace(/\\(\d{3})/g, '').trim();
      }
    }

    const avgCharsPerPage = text.length / Math.max(pageCount, 1);
    const hasTextLayer = text.length > 0;
    const needsOcr = avgCharsPerPage < MIN_CHARS_PER_PAGE;

    return { text, pageCount, hasTextLayer, needsOcr };
  } catch (err) {
    console.error('[pdfExtractor] pdf-parse failed:', err);
    return { text: '', pageCount: 0, hasTextLayer: false, needsOcr: true };
  }
}

/**
 * Validate file before processing.
 * Returns error string if invalid, null if OK.
 */
export function validateFile(
  file: { name: string; size: number; type: string },
  totalBatchSizeBytes: number,
  maxTotalBytes = 50 * 1024 * 1024 // 50 MB
): string | null {
  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  ];
  const allowedExtensions = /\.(pdf|doc|docx|png|jpg|jpeg|webp|gif)$/i;

  if (!allowedExtensions.test(file.name) && !allowedTypes.includes(file.type)) {
    return `File type not supported: ${file.name}`;
  }
  if (totalBatchSizeBytes > maxTotalBytes) {
    return `Total upload size exceeds 50 MB limit`;
  }
  return null;
}

/**
 * Convert a File's ArrayBuffer to a Node.js Buffer.
 */
export async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── PDF-to-image conversion (for scanned PDFs) ──────────────────────────────

export interface PdfPageImage {
  buffer: Buffer;
  page: number;
  mimeType: 'image/png';
}

/**
 * Convert the first N pages of a scanned PDF to PNG images using pdf2pic.
 * These images can then be passed to extractWithVision() for vision-based OCR.
 *
 * Falls back to empty array if:
 *  - pdf2pic is unavailable (serverless environments without GraphicsMagick)
 *  - Conversion fails for any reason
 *
 * @param buffer    PDF file buffer
 * @param maxPages  Maximum pages to convert (default: 5)
 */
export async function convertPdfPagesToImages(
  buffer: Buffer,
  maxPages: number = 5
): Promise<PdfPageImage[]> {
  try {
    // Dynamic import to avoid Edge Runtime issues and handle missing deps gracefully
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf2pic = require('pdf2pic');
    const { fromBuffer } = pdf2pic;

    // Write buffer to a temp path pdf2pic can work with
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const tmpPath = path.join(os.tmpdir(), `proquoment-pdf-${Date.now()}.pdf`);

    try {
      fs.writeFileSync(tmpPath, buffer);

      const converter = fromBuffer(buffer, {
        density: 200,         // DPI — 200 is good balance of quality vs size
        format: 'png',
        width: 1200,
        height: 1600,
        preserveAspectRatio: true,
        saveFilename: 'page',
        savePath: os.tmpdir(),
      });

      const results: PdfPageImage[] = [];

      for (let page = 1; page <= maxPages; page++) {
        try {
          const result = await converter(page, { responseType: 'buffer' });
          if (result?.buffer) {
            results.push({ buffer: result.buffer, page, mimeType: 'image/png' });
          } else {
            // No more pages
            break;
          }
        } catch {
          // Page doesn't exist or conversion failed — stop
          break;
        }
      }

      return results;
    } finally {
      // Clean up temp file
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  } catch (err) {
    console.warn(
      '[pdfExtractor] pdf2pic unavailable or failed — scanned PDF pages cannot be converted to images.',
      err instanceof Error ? err.message : String(err)
    );
    return [];
  }
}
