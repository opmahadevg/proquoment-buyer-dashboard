/**
 * PDF Extractor — server-side utility
 * Strategy: try text layer first (fast, free). If insufficient, caller should
 * fall back to image-based OCR via Google Lens.
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
    const parse = await getPdfParse();
    const data = await parse(buffer, {
      // Limit pages rendered — avoids OOM on huge files
      max: 20,
    });

    const text = (data.text || '').trim();
    const pageCount = data.numpages || 1;
    const avgCharsPerPage = text.length / Math.max(pageCount, 1);
    const hasTextLayer = text.length > 0;
    const needsOcr = avgCharsPerPage < MIN_CHARS_PER_PAGE;

    return { text, pageCount, hasTextLayer, needsOcr };
  } catch (err) {
    console.error('[pdfExtractor] pdf-parse failed:', err);
    // Treat as scanned — caller should try OCR
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
