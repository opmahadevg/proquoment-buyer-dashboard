import { NextRequest, NextResponse } from 'next/server';

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ─── Content safety ───────────────────────────────────────────────────────────
const BLOCKED_DOMAINS = [
  'shutterstock.com', 'alamy.com', 'dreamstime.com', 'depositphotos.com',
  'istockphoto.com', '123rf.com', 'bigstockphoto.com', 'gettyimages.com',
  'pond5.com', 'canstockphoto.com', 'pornhub.com', 'xvideos.com',
  'xhamster.com', 'redtube.com', 'youporn.com', 'tube8.com', 'xnxx.com',
  'spankbang.com', 'brazzers.com', 'onlyfans.com', 'fapello.com',
  'piratebay', 'thepiratebay', 'kickasstorrents', 'rarbg',
  'pinterest.com', 'pinterest.', 'pinimg.com', 'flickr.com', 'tumblr.com',
  'reddit.com', 'imgur.com',
];

const BLOCKED_TITLE_KEYWORDS = [
  'nude', 'naked', 'porn', 'xxx', 'sex', 'nsfw',
  'adult content', 'erotic', 'lingerie model',
  'illegal', 'piracy', 'torrent', 'crack', 'keygen',
];

function isDomainBlocked(source: string): boolean {
  const s = source.toLowerCase();
  return BLOCKED_DOMAINS.some((d) => s.includes(d));
}

function isTitleBlocked(title: string): boolean {
  const t = title.toLowerCase();
  return BLOCKED_TITLE_KEYWORDS.some((kw) => t.includes(kw));
}

interface RawSerpImage {
  title?: string;
  thumbnail?: string;
  original?: string;
  source?: string;
  link?: string;
}

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
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        max_tokens: 60,
        messages: [
          {
            role: 'system',
            content: `You are a Google Images search optimizer for B2B product sourcing. Rewrite user product request into a precise image search query. Output ONLY the query string, max 8 words.`,
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

// ─── High-quality fallback images ─────────────────────────────────────────────
function getFallbackImages(query: string) {
  const samplePhotoIds = [
    'photo-1542291026-7eec264c27ff', // Red sports shoe
    'photo-1595950653106-6c9ebd614d3a', // Sneaker
    'photo-1525966222134-fcfa99b8ae77', // Vans style
    'photo-1560769629-975ec94e6a86', // Shoes
    'photo-1512374382149-233c42b6a83b', // Sneaker
    'photo-1584735935682-2f2b69dff9d2', // Athletic shoe
    'photo-1539185441755-769473a23570', // Running shoe
    'photo-1606107557195-0e29a4b5b4aa', // Nike shoe
    'photo-1600185365483-26d7a4cc7519', // Sport shoe
    'photo-1582588678413-dbf45f4823e9', // White sneaker
    'photo-1515955656352-a1fa3ffcd111', // Blue shoe
    'photo-1460353581641-37baddab0fa2', // Running shoe
  ];

  return samplePhotoIds.map((id, i) => ({
    position: i,
    title: `${query || 'Product'} Option ${i + 1}`,
    thumbnail: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&q=80`,
    original: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=80`,
  }));
}

// ─── Simple rate limiter ──────────────────────────────────────────────────────
const requestLog = new Map<string, number[]>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const max = 20;
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

  let body: { query?: string; skipRefine?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const raw = (body.query || '').trim();
  const queryToUse = raw || 'sports shoes product photo';

  const refinedQuery = body.skipRefine || !raw ? queryToUse : await refineQuery(queryToUse);

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const effectiveQuery =
    !body.skipRefine && normalize(refinedQuery) === normalize(queryToUse) ? queryToUse : refinedQuery;

  if (!SERPAPI_KEY) {
    console.warn('SERPAPI_KEY not configured, using fallback product images.');
    return NextResponse.json({ images: getFallbackImages(effectiveQuery), refinedQuery: effectiveQuery });
  }

  const serpUrl = new URL('https://serpapi.com/search.json');
  serpUrl.searchParams.set('engine', 'google_images');
  serpUrl.searchParams.set('q', effectiveQuery);
  serpUrl.searchParams.set('num', '30');
  serpUrl.searchParams.set('safe', 'active');
  serpUrl.searchParams.set('api_key', SERPAPI_KEY);

  try {
    const serpRes = await fetch(serpUrl.toString(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });

    if (!serpRes.ok) {
      console.warn('SerpAPI returned non-200 status:', serpRes.status);
      return NextResponse.json({ images: getFallbackImages(effectiveQuery), refinedQuery: effectiveQuery });
    }

    const serpData = await serpRes.json();
    const rawResults: RawSerpImage[] = serpData.images_results || [];

    const safeResults = rawResults.filter((img) => {
      if (!img.thumbnail) return false;
      if (isDomainBlocked(img.source || img.link || '')) return false;
      if (isTitleBlocked(img.title || '')) return false;
      return true;
    });

    const deduped = deduplicate(safeResults);

    const images = deduped.slice(0, 15).map(({ title, thumbnail, original }, i) => ({
      position: i,
      title: title || '',
      thumbnail: thumbnail || '',
      original: original || thumbnail || '',
    }));

    if (images.length === 0) {
      return NextResponse.json({ images: getFallbackImages(effectiveQuery), refinedQuery: effectiveQuery });
    }

    return NextResponse.json({ images, refinedQuery: effectiveQuery });
  } catch (err) {
    console.warn('SerpAPI search error, using fallbacks:', err);
    return NextResponse.json({ images: getFallbackImages(effectiveQuery), refinedQuery: effectiveQuery });
  }
}
