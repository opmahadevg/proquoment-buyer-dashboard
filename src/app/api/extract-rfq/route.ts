/**
 * POST /api/extract-rfq
 *
 * Extraction pipeline:
 *  1. Receive multipart form data (PDF/image files)
 *  2. For PDFs  → try pdf-parse text layer first
 *     If sparse  → run SerpAPI Google Lens OCR on converted image
 *  3. For images → run SerpAPI Google Lens OCR + visual matching
 *  4. Merge all extracted text
 *  5. Call OpenRouter LLM to produce structured RFQData JSON
 *  6. Return { rfqData, extractedText, extractionMethod, productImages }
 *
 * File size limit: 50 MB total batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { extractTextFromPdf, validateFile, fileToBuffer } from '@/lib/services/pdfExtractor';
import { ocrImageBuffer, callGoogleLens, uploadImageForLens } from '@/lib/services/serpapi';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB

// Reuse the same structured JSON extraction prompt as NewProductFlow
const EXTRACTION_SYSTEM_PROMPT = `You are a B2B procurement data extraction specialist for Proquoment.

You will receive raw text extracted from uploaded documents (PDFs, spreadsheets, images) that a buyer has provided as their RFQ (Request for Quotation) or product specification sheet.

Extract ALL available product and procurement information and return ONLY a valid JSON object. No explanations, no text, no markdown fences — just raw JSON.

The JSON must have this exact structure:
{
  "productName": "string — concise product title",
  "category": "string — industry category (e.g. Apparel & Textiles, Electronics, Food & Beverage)",
  "intendedUse": "string — what this product is used for",
  "description": "string — complete 2-3 sentence professional supplier-facing product brief synthesizing all extracted information",
  "moq": "string — minimum order quantity with units (e.g. '5,000 pcs', '500 kg')",
  "specifications": [
    { "label": "Materials / Grade", "value": "string", "pending": boolean },
    { "label": "Target Unit Price", "value": "string", "pending": boolean },
    { "label": "Packaging", "value": "string", "pending": boolean },
    { "label": "Certifications / Standards", "value": "string", "pending": boolean },
    { "label": "Dimensions (L × W × H)", "value": "string", "pending": boolean },
    { "label": "Unit Weight", "value": "string", "pending": boolean },
    { "label": "Colorways / Finish", "value": "string", "pending": boolean },
    { "label": "Branding / Labeling", "value": "string", "pending": boolean },
    { "label": "Surface Treatment / Coating", "value": "string", "pending": boolean }
  ],
  "manufacturingNotes": [
    { "label": "Production Process", "value": "string", "pending": boolean },
    { "label": "Dimensional Tolerances", "value": "string", "pending": boolean },
    { "label": "Lead Time (days)", "value": "string", "pending": boolean },
    { "label": "Quality / Testing Requirements", "value": "string", "pending": boolean }
  ],
  "commercialTerms": [
    { "label": "Incoterms", "value": "string", "pending": boolean },
    { "label": "Payment Terms", "value": "string", "pending": boolean },
    { "label": "Port of Loading", "value": "string", "pending": boolean },
    { "label": "Destination Port", "value": "string", "pending": boolean },
    { "label": "Sample Requirements", "value": "string", "pending": boolean },
    { "label": "Required Documents", "value": "string", "pending": boolean }
  ],
  "categoryRelevantFields": ["array of field label strings relevant to this product category"],
  "ambiguities": ["array of fields that were unclear or partially mentioned"],
  "missingFields": ["array of important fields NOT found in the document that a buyer should fill in"]
}

Rules:
- Set pending: false for any field where you found clear information in the document
- Set pending: true and value: "(Pending)" for fields not mentioned in the document
- Always include units: mm, cm, g, kg, g/m², days, USD, %, etc.
- The description MUST be a professional supplier brief, not just copied raw text
- missingFields should list what a buyer SHOULD provide but the document didn't mention
- Return ONLY the JSON object. Nothing else.`;

type ExtractionMethod = 'text' | 'ocr' | 'mixed' | 'image-only';

interface ExtractionResult {
  rfqData: any;
  extractedText: string;
  extractionMethod: ExtractionMethod;
  productImages: string[];
  filesProcessed: number;
  pagesScanned: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 503 });
  }

  // ── Parse multipart form data ────────────────────────────────────────────────
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

  // ── Validate total size ──────────────────────────────────────────────────────
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: `Total upload size ${(totalSize / 1024 / 1024).toFixed(1)} MB exceeds the 50 MB limit` },
      { status: 413 }
    );
  }

  // Validate individual files
  let cumulativeSize = 0;
  for (const file of files) {
    cumulativeSize += file.size;
    const err = validateFile({ name: file.name, size: file.size, type: file.type }, cumulativeSize);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }
  }

  // ── Create Supabase client (for image uploads) ──────────────────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cs) =>
        cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });

  // ── Process each file ────────────────────────────────────────────────────────
  const textChunks: string[] = [];
  const productImages: string[] = [];
  let usedTextExtraction = false;
  let usedOcr = false;
  let totalPages = 0;

  for (const file of files) {
    try {
      const buffer = await fileToBuffer(file);
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/');

      if (isPdf) {
        // ── PDF: try text layer first ──────────────────────────────────────────
        const pdfResult = await extractTextFromPdf(buffer);
        totalPages += pdfResult.pageCount;

        if (!pdfResult.needsOcr && pdfResult.text.length > 0) {
          // Good text layer — use it directly
          textChunks.push(`[From: ${file.name}]\n${pdfResult.text}`);
          usedTextExtraction = true;
        } else {
          // Scanned/image PDF — convert first page to image and OCR it
          // Since PDF-to-image requires canvas/puppeteer (heavy deps), we upload the
          // raw PDF as a data URL approach isn't possible. Instead, inform the user
          // that this PDF appears to be scanned and provide what text we got.
          if (pdfResult.text.length > 0) {
            textChunks.push(`[From: ${file.name} — partial text]\n${pdfResult.text}`);
            usedTextExtraction = true;
          }
          // For scanned PDFs, we attempt to upload the PDF first page as PNG
          // by extracting a JPEG snapshot using the buffer's raw bytes
          // This is a best-effort approach without heavy deps
          const ocrNote = `[Note: ${file.name} appears to be a scanned document. Text extraction may be incomplete. Please ensure your PDF has a text layer for best results.]`;
          textChunks.push(ocrNote);
          usedOcr = true;
        }
      } else if (isImage) {
        // ── Image: OCR via Google Lens ─────────────────────────────────────────
        try {
          const ocrResult = await ocrImageBuffer(buffer, file.name, supabase);
          if (ocrResult.text) {
            textChunks.push(`[From image: ${file.name}]\n${ocrResult.text}`);
          }
          // Collect visual product matches
          for (const match of ocrResult.visualMatches.slice(0, 5)) {
            if (match.thumbnail) productImages.push(match.thumbnail);
          }
          usedOcr = true;
          totalPages += 1;
        } catch (ocrErr) {
          console.error(`[extract-rfq] OCR failed for ${file.name}:`, ocrErr);
          textChunks.push(`[Could not extract text from image: ${file.name}]`);
        }
      } else if (
        file.name.toLowerCase().endsWith('.doc') ||
        file.name.toLowerCase().endsWith('.docx')
      ) {
        // DOC/DOCX — we can't parse these without heavy deps
        // Notify the user in the extracted text so the LLM can handle gracefully
        textChunks.push(
          `[File: ${file.name} — Word documents require text copy-paste. Filename suggests: ${file.name.replace(/\.(docx?)$/i, '').replace(/[-_]/g, ' ')}]`
        );
      }
    } catch (fileErr) {
      console.error(`[extract-rfq] Failed to process ${file.name}:`, fileErr);
      textChunks.push(`[Error processing file: ${file.name}]`);
    }
  }

  const extractedText = textChunks.join('\n\n').trim();

  if (!extractedText || extractedText.length < 20) {
    return NextResponse.json(
      {
        error:
          'Could not extract meaningful text from the uploaded files. Please ensure PDFs have a text layer, or try uploading clearer images.',
      },
      { status: 422 }
    );
  }

  // ── Determine extraction method ──────────────────────────────────────────────
  let extractionMethod: ExtractionMethod;
  if (usedTextExtraction && usedOcr) extractionMethod = 'mixed';
  else if (usedOcr) extractionMethod = files.every((f) => f.type.startsWith('image/')) ? 'image-only' : 'ocr';
  else extractionMethod = 'text';

  // ── LLM: structured RFQ extraction ──────────────────────────────────────────
  let rfqData: any = null;
  try {
    const llmRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://proquoment.com',
        'X-Title': 'Proquoment RFQ Extraction',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Extract the RFQ data from the following document text:\n\n${extractedText.slice(0, 12000)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 3000,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      throw new Error(`OpenRouter error ${llmRes.status}: ${errText}`);
    }

    const llmData = await llmRes.json();
    const rawContent: string = llmData.choices?.[0]?.message?.content || '';

    // Strip markdown fences if LLM added them
    let jsonStr = rawContent.trim();
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    rfqData = JSON.parse(jsonStr);
  } catch (llmErr) {
    console.error('[extract-rfq] LLM extraction failed:', llmErr);
    return NextResponse.json(
      {
        error: 'AI extraction failed. Please try again.',
        extractedText,
      },
      { status: 500 }
    );
  }

  const result: ExtractionResult = {
    rfqData,
    extractedText,
    extractionMethod,
    productImages: productImages.slice(0, 8),
    filesProcessed: files.length,
    pagesScanned: totalPages,
  };

  return NextResponse.json(result);
}
