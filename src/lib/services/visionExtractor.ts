/**
 * Vision Extraction Service -- server-side only
 *
 * Replaces SerpApi Google Lens for document/image OCR and data extraction.
 * Single GPT-6-Luna vision call: OCR + layout understanding + structured JSON
 * No Supabase upload needed -- images sent as base64 data URLs
 * Fallback: gpt-6-luna -> google/gemini-3.7-flash
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

const FALLBACK_MODELS = [
  'openai/gpt-6-luna',
  'google/gemini-3.8-flash',
  'google/gemini-3.7-flash',
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

const VISION_EXTRACTION_SYSTEM_PROMPT = `You are a Senior B2B Procurement Engineering & Visual Intelligence Specialist for Proquoment.

You will receive one or more images of documents (technical spec sheets, CAD engineering drawings, product photos, tech packs, packaging dies, lab test reports) that a buyer uploaded as their RFQ or sourcing requirement.

Your job:
1. Conduct deep visual inspection and comprehensive OCR:
   - Extract ALL visible text, dimension callouts, material callouts, title blocks, tolerances, finish specs, compliance standards, and notes.
   - Preserve exact numbers, units (mm, cm, in, oz, ml, g, kg, g/m², %, °C), and table relationships.
2. Formulate a rich, professional, supplier-ready Product Brief (Description):
   - Synthesize a complete, authoritative, supplier-facing technical brief from all visual and text evidence.
   - Include: exact product canonical name, base material & grade, form factor / silhouette, dimensions / capacity, surface finish & treatment, closures / handles / hardware, colorways, mandatory safety/regulatory certifications, and packaging structure.
   - Format as 2-4 comprehensive, professional sentences that an OEM/ODM factory engineer can immediately quote and act on. Never return a lazy 1-sentence or generic description.
3. List crisp, granular, product-focused Visual Observations:
   - Extract factual physical and design features visible in the image (e.g., "12oz / 350ml cylindrical body with smooth curvature", "Matte black exterior double-dip reactive glaze with satin luster", "Ergonomic looped C-handle with seamless body joinery", "Individual white corrugated gift box with custom foam insert").
   - DO NOT list trivial document layout artifacts like "blue header" or "3-column table". Focus 100% on the physical product and its engineering attributes!
4. Extract structured procurement specifications across all domains (product, quantity, specifications, manufacturing, compliance, commercial, logistics, packaging).
5. Produce a precise productDesignQuery and designAttributes for product catalog and image matching.

Return ONLY a valid JSON object. No explanations, no markdown fences.

OUTPUT SCHEMA:
{
  "rfqData": {
    "product": {
      "name": { "value": "string", "source_type": "uploaded_document", "confidence": "high", "buyer_confirmed": true },
      "classification": { "broad_category": "string", "confidence": "high" },
      "intended_use": { "value": "string", "source_type": "uploaded_document", "confidence": "high" },
      "description": {
        "value": "string — Complete, professional, supplier-facing technical product brief synthesized from all visible features and text. Must detail product name, grade, dimensions/volume, finish, hardware, quality/testing standards, and packaging. 2-4 authoritative sentences.",
        "source_type": "uploaded_document",
        "confidence": "high"
      }
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
  "observations": [
    "Factual visual feature (e.g. 12oz cylindrical body with smooth curvature)",
    "Factual visual feature (e.g. Matte black double-dip glaze with satin finish)",
    "Factual visual feature (e.g. Ergonomic C-handle with reinforced joinery)"
  ],
  "confidence": "high",
  "productDesignQuery": "12oz matte black stoneware ceramic coffee mug ergonomic C-handle",
  "designAttributes": ["12oz stoneware ceramic", "matte black", "double-dip glaze", "ergonomic C-handle", "food-contact safe"]
}

RULES:
- Description MUST be an institutional-grade technical brief like an elite sourcing director writes for an RFQ, NOT a short generic title or raw buyer snippet.
- Observations MUST be product/design/material focused, never generic UI or document layout notes.
- Only include specification fields where clear information exists. Always include units.
- Return ONLY the JSON object.`;

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
  const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');
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
          Authorization: `Bearer ${apiKey}`,
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