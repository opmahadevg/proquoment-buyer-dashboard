/**
 * Text-layer RFQ Extraction Service -- server-side only
 * Primary Model: google/gemini-3.8-flash (with gemini-3.7-flash and gpt-5.6-luna fallbacks)
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

const FALLBACK_MODELS = [
  'openai/gpt-5.6-luna',
  'google/gemini-3.8-flash',
  'google/gemini-3.7-flash',
];

export const TEXT_EXTRACTION_SYSTEM_PROMPT = `You are a Senior B2B Procurement Data & Technical Specification Specialist for Proquoment.

You will receive raw text extracted from uploaded specification documents (PDF tech packs, spreadsheets, CAD title blocks, laboratory testing reports) that a buyer provided as their RFQ or sourcing requirement.

Extract ALL available product and procurement information and return ONLY a valid JSON object. No explanations, no markdown fences -- just raw JSON.

The JSON must have this exact structure:
{
  "product": {
    "name": { "value": "extracted product name", "source_type": "uploaded_document", "confidence": "high", "buyer_confirmed": true },
    "classification": { "broad_category": "Apparel & Textiles | Ceramics & Glass | Electronics | etc.", "confidence": "high" },
    "intended_use": { "value": "usage context", "source_type": "uploaded_document", "confidence": "high" },
    "description": {
      "value": "string — Complete, professional, supplier-facing technical product brief synthesized from ALL information in the document. Detail product name, grade, dimensions/volume, finish, hardware, quality/testing standards, and packaging. 2-4 authoritative sentences.",
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
}

Rules:
- The description field MUST be a complete, professional, supplier-facing technical brief synthesized from ALL information in the document. Include product name, grade, quality standards, certifications, quantity, packaging requirements, and any confirmed specs. Format as 2-3 sentences an OEM/ODM factory can act on.
- ONLY include fields where you found CLEAR information. Do not include empty or Pending fields.
- Always include units: mm, cm, g, kg, g/m2, days, USD, %, etc.
- Set source_type to uploaded_document for all fields.
- Set confidence to high if clearly stated, medium if inferred.
- Set buyer_confirmed to true for all extracted fields.
- Return ONLY the JSON object. Nothing else.`;

export async function extractRfqFromText(text: string): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  let lastError = '';

  for (const model of FALLBACK_MODELS) {
    try {
      const res = await fetch(OPENROUTER_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://proquoment.com',
          'X-Title': 'Proquoment RFQ Extraction',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: TEXT_EXTRACTION_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Extract the RFQ data from the following document text:\n\n${text.slice(0, 12000)}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(45_000),
      });

      if (!res.ok) {
        lastError = `${model} error ${res.status}: ${await res.text()}`;
        console.warn('[textExtractor] Model', lastError, '-- trying fallback...');
        continue;
      }

      const data = await res.json();
      let jsonStr = (data.choices?.[0]?.message?.content || '').trim();
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(jsonStr);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[textExtractor] Model ${model} failed:`, lastError);
    }
  }

  throw new Error(`Text extraction failed after all fallbacks: ${lastError}`);
}
