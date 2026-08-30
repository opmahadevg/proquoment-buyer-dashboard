/**
 * Vision Extraction Service -- server-side only
 *
 * Replaces SerpApi Google Lens for document/image OCR and data extraction.
 * Single GPT-5.6-Luna vision call: OCR + layout understanding + structured JSON
 * No Supabase upload needed -- images sent as base64 data URLs
 * Fallback: gpt-5.6-luna -> google/gemini-3.7-flash
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

const FALLBACK_MODELS = [
  'google/gemini-3.7-flash',
  'openai/gpt-5.6-luna',
];

// --- Types ---

export interface VisionExtractionResult {
  rfqData: any;
  extractedText: string;
  observations: string[];
  confidence: 'high' | 'medium' | 'low';
  productDesignQuery: string;
  designAttributes: string[];
}

export interface ImageInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

// --- System Prompt ---

const VISION_EXTRACTION_SYSTEM_PROMPT = `You are a B2B procurement data extraction specialist for Proquoment.

You will receive one or more images of documents (PDFs converted to images, product photos, spec sheets) that a buyer uploaded as their RFQ or product specification.

Your job:
1. OCR all visible text -- tables, headers, footers, handwriting, stamps
2. Understand document layout -- preserve table structure and column relationships
3. Extract ALL product and procurement information into structured JSON
4. Produce a productDesignQuery: ONLY product name + visual/material/design specs for image search

Return ONLY a valid JSON object. No explanations, no markdown fences.

OUTPUT SCHEMA:
{
  "rfqData": {
    "product": {
      "name": { "value": "string", "source_type": "uploaded_document", "confidence": "high", "buyer_confirmed": true },
      "classification": { "broad_category": "string", "confidence": "high" },
      "intended_use": { "value": "string", "source_type": "uploaded_document", "confidence": "high" },
      "description": { "value": "string", "source_type": "uploaded_document", "confidence": "high" }
    },
    "quantity": {
      "value": { "value": "5000 pcs", "source_type": "uploaded_document", "confidence": "high" }
    },
    "specifications": {
      "FieldName": { "value": "value with units", "source_type": "uploaded_document", "confidence": "high" }
    },
    "manufacturing": {},
    "commercial": {},
    "logistics": {},
    "packaging": {}
  },
  "extractedText": "Full verbatim OCR text, tables as tab-separated",
  "observations": ["Blue header with company logo", "3-column table: Item, Spec, Unit"],
  "confidence": "high",
  "productDesignQuery": "180gsm cotton crew-neck T-shirt navy blue ribbed collar",
  "designAttributes": ["180gsm cotton", "navy blue", "ribbed collar", "crew-neck"]
}

RULES:
- productDesignQuery: INCLUDE product name, material, color, finish, texture, pattern, shape, construction, dimensions, hardware
- productDesignQuery: EXCLUDE location, FOB/CIF/DDP, T/T/LC payment, quantity/MOQ, price, delivery date, certifications, buyer/supplier name
- Only include specification fields where you found CLEAR information
- Always include units: mm, cm, g, kg, g/m2, USD, %
- confidence: "high" = clearly printed, "medium" = handwritten or partial
- Return ONLY the JSON object`;

// --- Helpers ---

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

export function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return map[ext] || 'image/png';
}

function buildImageContent(images: ImageInput[], textContext?: string): object[] {
  const parts: object[] = [
    {
      type: 'text',
      text: textContext
        ? `Analyze these document images. Partial text layer available:\n\n${textContext}\n\nExtract all RFQ data from the images:`
        : 'Analyze these document images and extract all RFQ procurement data:',
    },
  ];

  for (const img of images.slice(0, 5)) {
    parts.push({
      type: 'image_url',
      image_url: { url: bufferToDataUrl(img.buffer, img.mimeType), detail: 'high' },
    });
  }

  return parts;
}

// --- Main Export ---

export async function extractWithVision(
  images: ImageInput[],
  textContext?: string
): Promise<VisionExtractionResult> {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not configured');
  if (images.length === 0) throw new Error('No images provided for vision extraction');

  const messages = [
    { role: 'system', content: VISION_EXTRACTION_SYSTEM_PROMPT },
    { role: 'user', content: buildImageContent(images, textContext) },
  ];

  let lastError = '';

  for (const model of FALLBACK_MODELS) {
    try {
      const res = await fetch(OPENROUTER_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://proquoment.com',
          'X-Title': 'Proquoment Vision Extractor',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        lastError = `${model} error ${res.status}: ${await res.text()}`;
        console.warn('[visionExtractor]', lastError, '-- trying fallback...');
        continue;
      }

      const data = await res.json();
      let jsonStr = (data.choices?.[0]?.message?.content || '').trim();
      // Strip markdown fences if present
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      const parsed = JSON.parse(jsonStr);

      if (!parsed.rfqData || typeof parsed.productDesignQuery !== 'string') {
        throw new Error('Incomplete response structure from vision model');
      }

      return {
        rfqData: parsed.rfqData,
        extractedText: parsed.extractedText || '',
        observations: Array.isArray(parsed.observations) ? parsed.observations : [],
        confidence: (['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium') as 'high' | 'medium' | 'low',
        productDesignQuery: parsed.productDesignQuery,
        designAttributes: Array.isArray(parsed.designAttributes) ? parsed.designAttributes : [],
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[visionExtractor] Model ${model} failed:`, lastError);
    }
  }

  throw new Error(`Vision extraction failed after all fallbacks. Last error: ${lastError}`);
}