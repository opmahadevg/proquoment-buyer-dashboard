/**
 * POST /api/extract-rfq
 *
 * Upgraded extraction pipeline:
 *  1. Receive multipart form data (PDF/image files)
 *  2. For PDFs with text layer  -> pdf-parse text -> GPT-5.6-Luna -> structured JSON
 *  3. For scanned/image PDFs    -> pdf2pic -> page images -> GPT-5.6-Luna vision -> JSON
 *  4. For image files           -> base64 encode -> GPT-5.6-Luna vision -> JSON
 *  5. After extraction          -> productIsolator -> focused designQuery for image search
 *  6. Return { rfqData, extractedText, extractionMethod, designQuery, designAttributes }
 *
 * Key changes from previous version:
 *  - SerpApi Google Lens REMOVED -- replaced by GPT-5.6-Luna vision (visionExtractor.ts)
 *  - No Supabase temp upload needed -- images sent as base64
 *  - Scanned PDFs now work via pdf2pic page conversion
 *  - All LLM calls use GPT-5.6-Luna (was gpt-4o-mini) with Gemini 3.7 Flash fallback
 *  - productDesignQuery added -- isolated product+design for accurate image search
 *
 * File size limit: 50 MB total batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPdf, validateFile, fileToBuffer, convertPdfPagesToImages } from '@/lib/services/pdfExtractor';
import { extractWithVision, getMimeType, type ImageInput } from '@/lib/services/visionExtractor';
import { extractRfqFromText } from '@/lib/services/textExtractor';
import { isolateProductDesign } from '@/lib/services/productIsolator';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB

const FALLBACK_MODELS = [
  'openai/gpt-5.6-luna',
  'google/gemini-3.8-flash',
  'google/gemini-3.7-flash',
];

type ExtractionMethod = 'text' | 'vision' | 'mixed' | 'image-only';

interface ExtractionResult {
  rfqData: any;
  extractedText: string;
  extractionMethod: ExtractionMethod;
  designQuery: string;
  designAttributes: string[];
  filesProcessed: number;
  pagesScanned: number;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 503 });
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const files = formData.getAll('files') as File[];
  if (!files.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  // Validate total size
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: `Total upload size ${(totalSize / 1024 / 1024).toFixed(1)} MB exceeds the 50 MB limit` },
      { status: 413 }
    );
  }

  let cumulativeSize = 0;
  for (const file of files) {
    cumulativeSize += file.size;
    const err = validateFile({ name: file.name, size: file.size, type: file.type }, cumulativeSize);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }
  }

  // Process each file
  const textChunks: string[] = [];
  const visionImages: ImageInput[] = [];
  let usedTextExtraction = false;
  let usedVision = false;
  let totalPages = 0;

  for (const file of files) {
    try {
      const buffer = await fileToBuffer(file);
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/');

      if (isPdf) {
        // Try text layer first
        const pdfResult = await extractTextFromPdf(buffer);
        totalPages += pdfResult.pageCount;

        if (!pdfResult.needsOcr && pdfResult.text.length > 0) {
          // Good text layer -- use text extraction path
          textChunks.push(`[From: ${file.name}]\n${pdfResult.text}`);
          usedTextExtraction = true;
        } else {
          // Sparse/scanned PDF -- convert pages to images for vision
          if (pdfResult.text.length > 0) {
            // Include partial text as context for the vision model
            textChunks.push(`[Partial text from: ${file.name}]\n${pdfResult.text}`);
          }

          console.log(`[extract-rfq] ${file.name} is scanned/sparse -- converting pages to images for vision...`);
          const pageImages = await convertPdfPagesToImages(buffer, 5);

          if (pageImages.length > 0) {
            for (const pi of pageImages) {
              visionImages.push({ buffer: pi.buffer, filename: `${file.name}_page${pi.page}`, mimeType: pi.mimeType });
            }
            usedVision = true;
            totalPages += pageImages.length;
          } else {
            // pdf2pic unavailable -- note it in text
            textChunks.push(
              `[Note: ${file.name} appears to be a scanned document. Install GraphicsMagick on the server for full scanned PDF support.]`
            );
          }
        }
      } else if (isImage) {
        // Image file -- add to vision batch (no SerpApi, no Supabase upload)
        const mimeType = getMimeType(file.name) || (file.type as any) || 'image/png';
        visionImages.push({ buffer, filename: file.name, mimeType });
        usedVision = true;
        totalPages += 1;
      } else if (
        file.name.toLowerCase().endsWith('.doc') ||
        file.name.toLowerCase().endsWith('.docx')
      ) {
        textChunks.push(
          `[File: ${file.name} -- Word documents require text copy-paste. Filename suggests: ${file.name.replace(/\.(docx?)$/i, '').replace(/[-_]/g, ' ')}]`
        );
      }
    } catch (fileErr) {
      console.error(`[extract-rfq] Failed to process ${file.name}:`, fileErr);
      textChunks.push(`[Error processing file: ${file.name}]`);
    }
  }

  // Determine extraction method
  let extractionMethod: ExtractionMethod;
  if (usedTextExtraction && usedVision) extractionMethod = 'mixed';
  else if (usedVision) extractionMethod = files.every((f) => f.type.startsWith('image/')) ? 'image-only' : 'vision';
  else extractionMethod = 'text';

  const partialText = textChunks.join('\n\n').trim();

  // Check we have something to work with
  if (!partialText && visionImages.length === 0) {
    return NextResponse.json(
      { error: 'Could not extract meaningful content from the uploaded files. Ensure PDFs have a text layer or upload clearer images.' },
      { status: 422 }
    );
  }

  // Run extraction
  let rfqData: any = null;
  let extractedText = partialText;
  let productDesignQuery = '';
  let designAttributes: string[] = [];

  try {
    if (visionImages.length > 0) {
      // Vision path: GPT-5.6-Luna vision for images (+ optional text context)
      const visionResult = await extractWithVision(visionImages, partialText || undefined);
      rfqData = visionResult.rfqData;
      extractedText = visionResult.extractedText || partialText;
      productDesignQuery = visionResult.productDesignQuery;
      designAttributes = visionResult.designAttributes;
    }

    if (partialText && (extractionMethod === 'text' || extractionMethod === 'mixed')) {
      // Text path: GPT-5.6-Luna text extraction for text-layer PDFs
      const textRfqData = await extractRfqFromText(partialText);

      if (extractionMethod === 'mixed' && rfqData) {
        // Merge: vision data takes precedence, text fills gaps
        rfqData = mergeRfqData(textRfqData, rfqData);
      } else {
        rfqData = textRfqData;
      }
    }

    if (!rfqData) {
      throw new Error('No RFQ data could be extracted from the provided files');
    }

    // Post-extraction: isolate product+design for accurate image search
    // Use the full extracted text for best isolation context
    if (!productDesignQuery) {
      const isolationInput = partialText || extractedText ||
        rfqData?.product?.name?.value ||
        rfqData?.product?.description?.value || '';

      if (isolationInput) {
        const isolated = await isolateProductDesign(isolationInput, rfqData);
        productDesignQuery = isolated.designQuery;
        designAttributes = isolated.designAttributes;
      }
    }

  } catch (extractErr) {
    const msg = extractErr instanceof Error ? extractErr.message : String(extractErr);
    console.error('[extract-rfq] Extraction failed:', msg);
    return NextResponse.json(
      { error: 'AI extraction failed. Please try again.', details: msg, extractedText },
      { status: 500 }
    );
  }

  const result: ExtractionResult = {
    rfqData,
    extractedText,
    extractionMethod,
    designQuery: productDesignQuery,
    designAttributes,
    filesProcessed: files.length,
    pagesScanned: totalPages,
  };

  return NextResponse.json(result);
}

// ── Merge RFQ data (vision overrides text for same fields) ─────────────────────

function mergeRfqData(textData: any, visionData: any): any {
  const merged: any = { ...textData };

  for (const key of Object.keys(visionData)) {
    if (!textData[key]) {
      merged[key] = visionData[key];
    } else if (typeof visionData[key] === 'object' && !Array.isArray(visionData[key])) {
      merged[key] = { ...textData[key], ...visionData[key] };
    } else {
      // Vision takes precedence
      merged[key] = visionData[key];
    }
  }

  return merged;
}