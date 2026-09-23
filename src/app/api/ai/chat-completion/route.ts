import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MODEL = 'openai/gpt-6-luna';

// ─── SSE stream converter ──────────────────────────────────────────────────────
function buildSSEStream(providerResponse: Response): NextResponse {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'start', provider: 'OPENROUTER' })}\n\n`)
        );

        const reader = providerResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'chunk', chunk: { choices: [{ delta: { content: delta } }] } })}\n\n`
                  )
                );
              }
            } catch {
              // skip malformed chunk
            }
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: 'Stream error', details: msg })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY is not configured' },
      { status: 503 }
    );
  }

  let body: any = {};

  try {
    body = await request.json();
    const { messages, stream = false, parameters = {} } = body;

    if (!messages?.length) {
      return NextResponse.json(
        { error: 'Missing required field: messages' },
        { status: 400 }
      );
    }

    const FALLBACK_MODELS = [
      'openai/gpt-6-luna',
      'google/gemini-3.8-flash',
      'google/gemini-3.7-flash'
    ];

    let res: Response | null = null;
    let lastErrorText = '';

    for (const modelToTry of FALLBACK_MODELS) {
      try {
        const tempRes = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://proquoment.com',
            'X-Title': 'Proquoment Buyer Dashboard',
          },
          body: JSON.stringify({ model: modelToTry, messages, stream, ...parameters }),
          signal: AbortSignal.timeout(25000),
        });

        if (tempRes.ok) {
          res = tempRes;
          break;
        } else {
          lastErrorText = await tempRes.text();
        }
      } catch (e) {
        lastErrorText = e instanceof Error ? e.message : String(e);
      }
    }

    if (!res) {
      return NextResponse.json(
        { error: `OpenRouter API error`, details: lastErrorText },
        { status: 502 }
      );
    }

    if (stream) return buildSSEStream(res);

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Request failed', details: msg }, { status: 500 });
  }
}
