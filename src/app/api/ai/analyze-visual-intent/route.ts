import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an expert procurement visual intelligence engine.
You will be provided with one or more reference images for a product a buyer wants to source.
Your job is to analyze these images collectively and produce a structured JSON summary of the product's visual intent, which will be used to prepopulate RFQ specifications.

CRITICAL INSTRUCTIONS:
1. ONLY return valid JSON. Do not include markdown fences like \`\`\`json.
2. Ensure all keys match the schema exactly.
3. Be specific about materials, construction, finishes, and hardware visible in the images.
4. Do not guess non-visual attributes (like weight or internal components) unless obvious.

OUTPUT SCHEMA:
{
  "compact_summary": "A concise 2-3 sentence summary of the overall visual intent of the product across all images.",
  "observations": [
    {
      "attribute": "e.g., Material, Closure, Finish, Silhouette",
      "value": "What you observe in the image",
      "confidence": "high" | "medium" | "low"
    }
  ]
}
`;

export async function POST(req: Request) {
  try {
    const { images, productName } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty images array' },
        { status: 400 }
      );
    }

    // Format images for OpenRouter (OpenAI vision API format)
    const imageContents = images.map((imgUrl: string) => ({
      type: "image_url",
      image_url: {
        url: imgUrl,
        detail: "auto"
      }
    }));

    const userMessage = {
      role: 'user',
      content: [
        {
          type: "text",
          text: `Please analyze these reference images for a product named "${productName || 'Unknown Product'}". Output the visual intent summary as JSON.`
        },
        ...imageContents
      ]
    };

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      userMessage
    ];

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY not set' }, { status: 500 });
    }

    const FALLBACK_MODELS = [
      'openai/gpt-5.6-luna',
      'google/gemini-3.7-flash'
    ];

    let result: Response | null = null;
    let errText = '';

    for (const modelToTry of FALLBACK_MODELS) {
      try {
        const tempRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://proquoment.com',
            'X-Title': 'Proquoment Buyer Dashboard',
          },
          body: JSON.stringify({
            model: modelToTry,
            messages: messages,
            temperature: 0.2,
            max_tokens: 1024,
            response_format: { type: 'json_object' }
          })
        });

        if (tempRes.ok) {
          result = tempRes;
          break;
        } else {
          errText = await tempRes.text();
        }
      } catch (e) {
        errText = e instanceof Error ? e.message : String(e);
      }
    }

    if (!result) {
      console.error('Visual intent OpenRouter error:', errText);
      return NextResponse.json({ error: 'Failed to call OpenRouter', details: errText }, { status: 502 });
    }

    const data = await result.json();
    const rawContent = data?.choices?.[0]?.message?.content || '{}';
    
    // Clean potential markdown blocks
    let jsonStr = rawContent.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '').trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse visual intent JSON:", rawContent);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    return NextResponse.json({ data: parsed });

  } catch (error: any) {
    console.error('Visual intent analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
