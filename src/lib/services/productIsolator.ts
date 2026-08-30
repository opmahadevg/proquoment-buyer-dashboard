/**
 * Product+Design Isolator -- server-side only
 *
 * Given ANY text input (full RFQ, front-page text, extracted document text),
 * uses GPT-5.6-Luna to extract ONLY the product identity and design-relevant
 * specifications. Strips commercial noise (location, incoterms, payment, quantity).
 *
 * Used in two places:
 *  1. After extract-rfq pipeline -- to generate focused image search query
 *  2. When buyer enters mixed text on front page -- before image search step
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

const FALLBACK_MODELS = [
  'openai/gpt-5.6-luna',
  'google/gemini-3.7-flash',
];

// --- Types ---

export interface ProductDesignQuery {
  designQuery: string;
  productName: string;
  designAttributes: string[];
}

// --- System Prompt ---

const ISOLATOR_SYSTEM_PROMPT = `You are a product identification specialist for a B2B procurement platform.

Given text that may contain mixed procurement information (locations, incoterms, payment terms, logistics, quantities, buyer details), extract ONLY the product identity and DESIGN-RELEVANT specifications.

INCLUDE in your output:
- Product name and type
- Material, fabric, composition (e.g. "180gsm cotton", "grade 304 stainless steel")
- Color, finish, texture, pattern (e.g. "navy blue", "brushed nickel", "matte black")
- Shape, silhouette, construction (e.g. "crew-neck", "hexagonal", "double-walled")
- Size and dimensions (e.g. "10.5 inch", "A4 size", "500ml")
- Hardware, closures, components (e.g. "YKK zipper", "snap button", "rubber gasket")
- Weight if material-related (e.g. "180gsm", "0.8mm thickness")

EXCLUDE from your output:
- Location, city, country, shipping address, warehouse
- Incoterms: FOB, CIF, DDP, EXW, FCA, etc.
- Payment terms: T/T, LC, DP, DA, advance payment
- Quantity, MOQ, units ordered
- Price, target price, unit cost
- Delivery timeline, lead time, ETA
- Certifications and compliance codes (ISO, CE, FDA) -- unless they imply a material spec
- Buyer name, supplier name, company name
- Currency, banking details

EXAMPLES:
Input: "5000 pcs 180gsm cotton crew-neck T-shirts in navy blue with ribbed collar, FOB Shanghai, 30% TT advance, DDP Mumbai, delivery 60 days"
Output: { "designQuery": "180gsm cotton crew-neck T-shirt navy blue ribbed collar", "productName": "Crew-neck T-shirt", "designAttributes": ["180gsm cotton", "navy blue", "ribbed collar", "crew-neck"] }

Input: "Need 10.5 inch white glazed ceramic dinner plates, 200 pcs, CIF Mumbai, payment LC at sight"
Output: { "designQuery": "10.5 inch white glazed ceramic dinner plate", "productName": "Ceramic dinner plate", "designAttributes": ["10.5 inch", "white glazed", "ceramic"] }

Input: "Blue denim jacket"
Output: { "designQuery": "blue denim jacket", "productName": "Denim jacket", "designAttributes": ["blue", "denim"] }

Return ONLY valid JSON: { "designQuery": "...", "productName": "...", "designAttributes": [...] }
No explanations, no markdown fences.`;

// --- Main Export ---

/**
 * Isolate product identity + design specs from any mixed input text.
 * Strips commercial noise (location, incoterms, payment, quantity) before image search.
 *
 * @param input  Any text: front-page buyer input, extracted document text, product name
 * @param rfqData  Optional structured RFQ data for richer context
 */
export async function isolateProductDesign(
  input: string,
  rfqData?: any
): Promise<ProductDesignQuery> {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not configured');

  // Short input with no commercial noise -- return directly
  const trimmed = input.trim();
  if (trimmed.length < 30 && !hasCommercialNoise(trimmed)) {
    return {
      designQuery: trimmed,
      productName: trimmed,
      designAttributes: [],
    };
  }

  // Build context-enriched prompt if rfqData available
  let userMessage = `Extract the product design query from this text:\n\n"${trimmed}"`;
  if (rfqData?.product?.name?.value) {
    userMessage += `\n\nAdditional context (structured RFQ data):\nProduct name: ${rfqData.product.name.value}`;
    if (rfqData.product.description?.value) {
      userMessage += `\nDescription: ${rfqData.product.description.value}`;
    }
  }

  const messages = [
    { role: 'system', content: ISOLATOR_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
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
          'X-Title': 'Proquoment Product Isolator',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        lastError = `${model} error ${res.status}`;
        console.warn('[productIsolator]', lastError, '-- trying fallback...');
        continue;
      }

      const data = await res.json();
      let jsonStr = (data.choices?.[0]?.message?.content || '').trim();
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      const parsed = JSON.parse(jsonStr);

      if (!parsed.designQuery) {
        throw new Error('Missing designQuery in isolator response');
      }

      return {
        designQuery: parsed.designQuery,
        productName: parsed.productName || parsed.designQuery,
        designAttributes: Array.isArray(parsed.designAttributes) ? parsed.designAttributes : [],
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[productIsolator] Model ${model} failed:`, lastError);
    }
  }

  // Graceful fallback -- return input as-is if all models fail
  console.error('[productIsolator] All models failed, using raw input. Last error:', lastError);
  return {
    designQuery: trimmed,
    productName: trimmed,
    designAttributes: [],
  };
}

/**
 * Quick heuristic: does this text contain commercial noise?
 * Used to skip the LLM call for clean short inputs.
 */
function hasCommercialNoise(text: string): boolean {
  const noisePatterns = [
    /\bfob\b/i, /\bcif\b/i, /\bddp\b/i, /\bexw\b/i, /\bfca\b/i,
    /\b(t\/t|l\/c|lc|dp|da)\b/i,
    /\b(advance|payment|terms)\b/i,
    /\b(mumbai|shanghai|delhi|beijing|guangzhou|dhaka|istanbul)\b/i,
    /\b(pcs|pieces|units|qty|quantity|moq)\b/i,
    /\b(delivery|lead.?time|eta)\b/i,
    /\b(usd|inr|eur|cny)\s*\d/i,
  ];
  return noisePatterns.some((p) => p.test(text));
}