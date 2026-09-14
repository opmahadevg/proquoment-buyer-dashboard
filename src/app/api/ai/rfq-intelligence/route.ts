import { NextRequest, NextResponse } from 'next/server';
import { classifyComplexity } from '@/lib/rfq/complexity-classifier';
import { buildSystemPrompt } from '@/lib/rfq/system-prompt-builder';
import { createEmptyRFQState } from '@/lib/rfq/state-manager';
import { formatMessagesForProvider } from '@/lib/ai/provider-adapter';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MODEL = 'openai/gpt-5.6-luna';

// JSON Schema corresponding to AIStructuredResponse
// IMPORTANT: strict:true requires ALL properties listed in required[]
const AIStructuredResponseSchema = {
  type: "json_schema",
  json_schema: {
    name: "rfq_intelligence_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        buyer_message: {
          type: "string",
          description: "The conversational reply to the user"
        },
        internal_reasoning: {
          type: "string",
          description: "Explain why questions were asked or values inferred"
        },
        observations: {
          type: "array",
          items: { type: "string" },
          description: "Factual visual features (e.g. 'zipper closure', 'metallic blue finish')"
        },
        inferences: {
          "type": "array",
          items: { type: "string" },
          description: "Deductions derived from images (e.g. 'appears to be high-modulus graphite')"
        },
        unknowns: {
          type: "array",
          items: { type: "string" },
          description: "Non-visual specs that cannot be determined visually"
        },
        new_questions: {
          type: "array",
          items: { type: "string" },
          description: "Field keys it wants to ask about next"
        },
        rfq_updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: {
                type: "string",
                description: "Dot notation path e.g. product.name, specifications.color, commercial.target_price"
              },
              proposed_value: {
                type: "string",
                description: "The new value proposed or extracted for the field"
              },
              source_type: {
                type: "string",
                enum: ["ai_proposal", "visual_inferred", "uploaded_document", "buyer_message", "visual_confirmed", "ai_recommendation_approved"],
                description: "The provenance of this information"
              },
              source_id: {
                type: ["string", "null"],
                description: "ID of the image, document, or message. Null if ai_proposal."
              },
              reason: {
                type: ["string", "null"],
                description: "Why this value was proposed or inferred"
              },
              source_reference: {
                type: ["string", "null"],
                description: "Specific reference like page number or timestamp"
              }
            },
            required: ["field", "proposed_value", "source_type", "source_id", "reason", "source_reference"],
            additionalProperties: false
          }
        },
        ai_options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              value: { type: "string", description: "Machine-readable value" },
              label: { type: "string", description: "Human-readable display text" }
            },
            required: ["value", "label"],
            additionalProperties: false
          },
          description: "Quick-reply option chips for the buyer. Empty array if no options needed."
        },
        multi_select: {
          type: "boolean",
          description: "True if buyer can select multiple options (e.g. certifications, colors). False for single-answer."
        }
      },
      required: [
        "buyer_message",
        "internal_reasoning",
        "observations",
        "inferences",
        "unknowns",
        "new_questions",
        "rfq_updates",
        "ai_options",
        "multi_select"
      ],
      additionalProperties: false
    }
  }
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY is not configured' },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { messages, rfqState, parameters = {} } = body;
  const conversationMode = parameters.conversationMode || 'standard';

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: 'Missing required field: messages (must be non-empty array)' },
      { status: 400 }
    );
  }

  try {
    const state = rfqState || createEmptyRFQState();
    const { complexity } = classifyComplexity(state);
    
    const systemPromptContent = buildSystemPrompt(state, complexity, conversationMode);
    const openRouterMessages = formatMessagesForProvider(systemPromptContent, messages);

    const FALLBACK_MODELS = [
      'openai/gpt-5.6-luna',
      'google/gemini-3.8-flash',
      'google/gemini-3.7-flash'
    ];

    let res: Response | null = null;
    let lastErrorText = '';

    for (const modelToTry of FALLBACK_MODELS) {
      const openRouterParams = {
        model: modelToTry,
        messages: openRouterMessages,
        stream: false,
        response_format: AIStructuredResponseSchema,
        temperature: 0.5,
        ...parameters
      };

      try {
        const tempRes = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://proquoment.com',
            'X-Title': 'Proquoment Buyer Dashboard',
          },
          body: JSON.stringify(openRouterParams),
          signal: AbortSignal.timeout(45000),
        });

        if (tempRes.ok) {
          res = tempRes;
          break;
        } else {
          lastErrorText = await tempRes.text();
          console.warn(`[rfq-intelligence] Model ${modelToTry} failed (${tempRes.status}), trying fallback...`);
        }
      } catch (e) {
        lastErrorText = e instanceof Error ? e.message : String(e);
        console.warn(`[rfq-intelligence] Model ${modelToTry} fetch error, trying fallback...`);
      }
    }

    if (!res) {
      console.error(`[rfq-intelligence] All fallback models failed. Last error:`, lastErrorText);
      return NextResponse.json(
        { error: `OpenRouter API error`, details: lastErrorText },
        { status: 502 }
      );
    }

    const data = await res.json();

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from AI model');
    }

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(content);
    } catch {
      console.error('[rfq-intelligence] Failed to parse JSON:', content?.slice(0, 500));
      throw new Error('AI returned malformed JSON');
    }

    // Ensure arrays always exist (defensive)
    if (!Array.isArray(parsedResponse.ai_options)) parsedResponse.ai_options = [];
    if (typeof parsedResponse.multi_select !== 'boolean') parsedResponse.multi_select = false;
    if (!Array.isArray(parsedResponse.rfq_updates)) parsedResponse.rfq_updates = [];

    // Ensure 'Suggest me' default option is present when asking specification questions
    const hasSuggest = parsedResponse.ai_options.some((opt: any) => {
      const val = (opt?.label || opt?.value || '').toLowerCase();
      return val.includes('suggest');
    });
    const isCompleted = parsedResponse.buyer_message?.toLowerCase().includes('rfq is now complete');
    if (!hasSuggest && !isCompleted && parsedResponse.ai_options.length > 0) {
      parsedResponse.ai_options.unshift({
        label: "✨ Suggest me standard specifications",
        value: "Suggest standard specifications and packaging based on market norms"
      });
    }

    return NextResponse.json({
      data: parsedResponse,
      usage: data.usage
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[rfq-intelligence] Request failed:', msg);
    return NextResponse.json({ error: 'Request failed', details: msg }, { status: 500 });
  }
}
