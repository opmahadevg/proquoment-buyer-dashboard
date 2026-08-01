import { NextRequest, NextResponse } from 'next/server';

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ─── LLM query refinement ─────────────────────────────────────────────────────
async function refineQuery(rawQuery: string): Promise<string> {
  if (!OPENROUTER_API_KEY) return rawQuery;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        max_tokens: 60,
        messages: [
          {
            role: 'system',
            content:
              'You are a Google Images search query optimizer for B2B product sourcing. Rewrite the input into a precise, image-search-optimized query that returns high-quality product reference photos. Return ONLY the query string. No quotes, no explanation. Max 10 words.',
          },
          { role: 'user', content: rawQuery },
        ],
      }),
    });
    if (!res.ok) return rawQuery;
    const json = await res.json();
    const refined = json.choices?.[0]?.message?.content?.trim();
    return refined || rawQuery;
  } catch {
    return rawQuery;
  }
}

// ─── Simple in-memory rate limiter (10 req/min per IP) ───────────────────────
const requestLog = new Map<string, number[]>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const max = 10;
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < window);
  if (timestamps.length >= max) return true;
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return false;
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  if (!SERPAPI_KEY) {
    return NextResponse.json({ error: 'SERPAPI_KEY not configured' }, { status: 500 });
  }

  let body: { query?: string; skipRefine?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const raw = (body.query || '').trim();
  if (!raw) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  // Optionally refine query with LLM
  const refinedQuery = body.skipRefine ? raw : await refineQuery(raw);

  // Fetch from SerpAPI
  const serpUrl = new URL('https://serpapi.com/search.json');
  serpUrl.searchParams.set('engine', 'google_images');
  serpUrl.searchParams.set('q', refinedQuery);
  serpUrl.searchParams.set('num', '15');
  serpUrl.searchParams.set('safe', 'active');
  serpUrl.searchParams.set('api_key', SERPAPI_KEY);

  try {
    const serpRes = await fetch(serpUrl.toString(), { next: { revalidate: 300 } });
    if (!serpRes.ok) {
      const text = await serpRes.text();
      console.error('SerpAPI error:', serpRes.status, text);
      return NextResponse.json({ error: 'SerpAPI request failed' }, { status: 502 });
    }
    const serpData = await serpRes.json();

    const images = (serpData.images_results || []).slice(0, 15).map(
      (img: any, i: number) => ({
        position: i,
        title: img.title || '',
        thumbnail: img.thumbnail || img.original || '',
        original: img.original || img.thumbnail || '',
        source: img.source || img.link || '',
      })
    );

    return NextResponse.json({ images, refinedQuery });
  } catch (err) {
    console.error('image-search route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
