import { NextRequest, NextResponse } from 'next/server';

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ─── Content safety ───────────────────────────────────────────────────────────
// Hard-block domains known to host adult / illegal / copyright-watermark content.
// Images from these sources are rejected before they ever reach the client.
const BLOCKED_DOMAINS = [
  // Stock watermark farms (legal grey area + bad UX)
  'shutterstock.com',
  'alamy.com',
  'dreamstime.com',
  'depositphotos.com',
  'istockphoto.com',
  '123rf.com',
  'bigstockphoto.com',
  'gettyimages.com',
  'pond5.com',
  'canstockphoto.com',
  // Adult / explicit content
  'pornhub.com', 'xvideos.com', 'xhamster.com', 'redtube.com',
  'youporn.com', 'tube8.com', 'xnxx.com', 'spankbang.com',
  'brazzers.com', 'onlyfans.com', 'fapello.com',
  // Piracy / illegal
  'piratebay', 'thepiratebay', 'kickasstorrents', 'rarbg',
  // Random social noise
  'pinterest.com', 'pinterest.',
  'pinimg.com',
  'flickr.com',
  'tumblr.com',
  'reddit.com',
  'imgur.com',
];

// Title-level keyword blocklist — reject any image whose title contains these
// (case-insensitive). Catches edge cases that slip through domain blocking.
const BLOCKED_TITLE_KEYWORDS = [
  'nude', 'naked', 'porn', 'xxx', 'sex', 'nsfw',
  'adult content', 'erotic', 'lingerie model',
  'illegal', 'piracy', 'torrent', 'crack', 'keygen',
];

// ─── Domain quality scoring (affects sort order, not hard-block) ─────────────
const BOOST_DOMAINS = [
  'alibaba.com', 'aliexpress.com', 'made-in-china.com', 'indiamart.com',
  'thomasnet.com', 'directindustry.com', 'globalsources.com', 'tradeindia.com',
  'ec21.com', 'tradekey.com', 'diytrade.com', 'dhgate.com',
  'amazon.com', 'grainger.com', 'mcmaster.com', 'manufacturer.com',
];

const PENALIZE_DOMAINS = [
  'freepik.com', 'vecteezy.com', 'clipart',
];

function isDomainBlocked(source: string): boolean {
  const s = source.toLowerCase();
  return BLOCKED_DOMAINS.some((d) => s.includes(d));
}

function isTitleBlocked(title: string): boolean {
  const t = title.toLowerCase();
  return BLOCKED_TITLE_KEYWORDS.some((kw) => t.includes(kw));
}

function domainScore(source: string): number {
  const s = source.toLowerCase();
  if (PENALIZE_DOMAINS.some((d) => s.includes(d))) return -2;
  if (BOOST_DOMAINS.some((d) => s.includes(d))) return 2;
  return 0;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface RawSerpImage {
  title?: string;
  thumbnail?: string;
  original?: string;
  source?: string;
  link?: string;
  original_width?: number;
  original_height?: number;
}

// ─── Quality scoring ──────────────────────────────────────────────────────────
function scoreImage(img: RawSerpImage): number {
  let score = 0;
  if (!img.thumbnail) return -99;

  const w = img.original_width ?? 0;
  const h = img.original_height ?? 0;
  if (w > 0 && h > 0) {
    if (w >= 800 || h >= 800) score += 3;
    else if (w >= 400 || h >= 400) score += 1;
    else score -= 2;
  }

  score += domainScore(img.source || img.link || '');
  if (!img.title || img.title.trim().length < 3) score -= 1;

  return score;
}

// ─── Deduplication by title similarity ───────────────────────────────────────
function deduplicate(images: RawSerpImage[]): RawSerpImage[] {
  const seen = new Set<string>();
  return images.filter((img) => {
    const key = (img.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
        max_tokens: 80,
        messages: [
          {
            role: 'system',
            content: `You are an expert Google Images search query optimizer for B2B product sourcing and procurement.

Your goal: rewrite the user's product description into a precise Google Images search query that returns CLEAN, PROFESSIONAL product catalogue photos.

CRITICAL RULES — follow exactly:
- PRESERVE brand names exactly as written (Tupperware, Nike, Bosch, etc.) — never remove them
- PRESERVE model names, part numbers, and product-specific identifiers exactly
- PRESERVE material specs (stainless steel, polypropylene, etc.)
- Add "product photo" or "white background" to surface catalogue-style imagery
- Remove only truly vague filler words ("the", "a", "some", "kind of")
- Output ONLY the query string — no quotes, no explanation, max 12 words`,
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

  const refinedQuery = body.skipRefine ? raw : await refineQuery(raw);

  // Guard: if LLM returned the same string (minus brand terms it may have dropped),
  // just use the raw query so a changed search always hits a different URL
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const effectiveQuery =
    !body.skipRefine && normalize(refinedQuery) === normalize(raw) ? raw : refinedQuery;

  // Fetch from SerpAPI — safe=active enforced, photos only, large images only
  const serpUrl = new URL('https://serpapi.com/search.json');
  serpUrl.searchParams.set('engine', 'google_images');
  serpUrl.searchParams.set('q', effectiveQuery);
  serpUrl.searchParams.set('num', '30');
  serpUrl.searchParams.set('safe', 'active');   // Google SafeSearch ON
  serpUrl.searchParams.set('imgtype', 'photo'); // photos only — no clipart
  serpUrl.searchParams.set('imgsz', 'l');       // large images only
  serpUrl.searchParams.set('ijn', '0');
  serpUrl.searchParams.set('api_key', SERPAPI_KEY);

  try {
    const serpRes = await fetch(serpUrl.toString(), { cache: 'no-store' });
    if (!serpRes.ok) {
      const text = await serpRes.text();
      console.error('SerpAPI error:', serpRes.status, text);
      return NextResponse.json({ error: 'SerpAPI request failed' }, { status: 502 });
    }
    const serpData = await serpRes.json();

    const rawResults: RawSerpImage[] = serpData.images_results || [];

    // ── Safety + quality pipeline ─────────────────────────────────────────────
    const safeResults = rawResults.filter((img) => {
      // 1. Must have thumbnail
      if (!img.thumbnail) return false;
      // 2. Hard-block by domain
      if (isDomainBlocked(img.source || img.link || '')) return false;
      // 3. Hard-block by title keywords
      if (isTitleBlocked(img.title || '')) return false;
      return true;
    });

    // 4. Deduplicate near-identical titles
    const deduped = deduplicate(safeResults);

    // 5. Score and sort by quality
    const scored = deduped
      .map((img) => ({ img, score: scoreImage(img) }))
      .filter(({ score }) => score > -3)
      .sort((a, b) => b.score - a.score);

    // 6. Take top 15 — strip all source/domain info before sending to client
    const images = scored.slice(0, 15).map(({ img }, i) => ({
      position: i,
      title: img.title || '',
      thumbnail: img.thumbnail || '',
      original: img.original || img.thumbnail || '',
      // ⚠️ source/domain intentionally omitted — not sent to client
    }));

    return NextResponse.json({ images, refinedQuery: effectiveQuery });
  } catch (err) {
    console.error('image-search route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
