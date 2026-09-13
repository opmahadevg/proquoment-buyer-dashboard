import { NextRequest, NextResponse } from 'next/server';

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

function isDomainBlocked(source?: string): boolean {
  if (!source) return false;
  const s = source.toLowerCase();
  return BLOCKED_DOMAINS.some((d) => s.includes(d));
}

function isTitleBlocked(title?: string): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return BLOCKED_TITLE_KEYWORDS.some((kw) => t.includes(kw));
}

interface RawImage {
  title?: string;
  thumbnail?: string;
  original?: string;
  source?: string;
  link?: string;
}

function deduplicate(images: RawImage[]): RawImage[] {
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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return rawQuery;

  const candidateModels = [
    'openai/gpt-5.6-luna',
    'google/gemini-3.8-flash',
    'google/gemini-2.5-flash',
    'openai/gpt-4o-mini',
    'meta-llama/llama-3.3-70b-instruct',
  ];

  for (const model of candidateModels) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://proquoment.com',
          'X-Title': 'Proquoment Image Search',
        },
        signal: AbortSignal.timeout(3500),
        body: JSON.stringify({
          model,
          max_tokens: 30,
          messages: [
            {
              role: 'system',
              content:
                'You are a Google Images search optimizer for B2B product sourcing. Rewrite the user product request into a precise image search query for clean product photography. Output ONLY the search query string, maximum 6 words, no quotation marks.',
            },
            { role: 'user', content: rawQuery },
          ],
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const refined = json.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, '');
        if (refined && refined.length > 2) {
          return refined;
        }
      }
    } catch {
      // Continue to next model fallback
    }
  }

  return rawQuery;
}

// ─── Fallback Providers (DuckDuckGo & Wikimedia) ───────────────────────────────
async function searchDuckDuckGo(query: string): Promise<RawImage[]> {
  try {
    const tokenRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query + ' product photography')}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    const html = await tokenRes.text();
    const vqdMatch = html.match(/vqd=([0-9-]+)/);
    if (!vqdMatch) return [];

    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query + ' product photography')}&o=json&vqd=${vqdMatch[1]}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!imgRes.ok) return [];

    const data = await imgRes.json();
    const results = data.results || [];
    return results
      .filter((r: any) => r.thumbnail && r.image)
      .map((r: any) => ({
        title: r.title || query,
        thumbnail: r.thumbnail || r.image,
        original: r.image || r.thumbnail,
        source: r.url || r.image,
      }));
  } catch {
    return [];
  }
}

async function searchWikimedia(query: string): Promise<RawImage[]> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query + ' product'
    )}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|thumbmime|mime&iiurlwidth=600&format=json&origin=*`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];

    const data = await res.json();
    const pages = Object.values(data.query?.pages || {});
    return pages
      .map((p: any) => {
        const info = p.imageinfo?.[0];
        if (!info || !info.thumburl) return null;
        const title = (p.title || '')
          .replace(/^File:/i, '')
          .replace(/\.[^/.]+$/, '')
          .replace(/_/g, ' ');
        return {
          title: title || query,
          thumbnail: info.thumburl,
          original: info.url || info.thumburl,
          source: 'wikimedia.org',
        };
      })
      .filter(Boolean) as RawImage[];
  } catch {
    return [];
  }
}

// ─── Simple rate limiter ──────────────────────────────────────────────────────
const requestLog = new Map<string, number[]>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const max = 30;
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
  const queryToUse = raw || 'commercial product photography';

  const refinedQuery = body.skipRefine || !raw ? queryToUse : await refineQuery(queryToUse);

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const effectiveQuery =
    !body.skipRefine && normalize(refinedQuery) === normalize(queryToUse) ? queryToUse : refinedQuery;

  const serpApiKey = process.env.SERPAPI_KEY;
  let rawResults: RawImage[] = [];

  // Primary: SerpAPI Google Images
  if (serpApiKey) {
    try {
      const serpUrl = new URL('https://serpapi.com/search.json');
      serpUrl.searchParams.set('engine', 'google_images');
      serpUrl.searchParams.set('q', effectiveQuery);
      serpUrl.searchParams.set('num', '30');
      serpUrl.searchParams.set('safe', 'active');
      serpUrl.searchParams.set('api_key', serpApiKey);

      const serpRes = await fetch(serpUrl.toString(), {
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });

      if (serpRes.ok) {
        const serpData = await serpRes.json();
        const imagesResults = serpData.images_results || [];
        rawResults = imagesResults.map((img: any) => ({
          title: img.title,
          thumbnail: img.thumbnail,
          original: img.original || img.thumbnail,
          source: img.source || img.link,
        }));
      } else {
        console.warn('SerpAPI non-200 status:', serpRes.status);
      }
    } catch (err) {
      console.warn('SerpAPI search error or timeout:', err);
    }
  }

  // Fallback 1: DuckDuckGo dynamic image search
  if (rawResults.length === 0) {
    rawResults = await searchDuckDuckGo(effectiveQuery);
  }

  // Fallback 2: Wikimedia Commons dynamic image search
  if (rawResults.length === 0) {
    rawResults = await searchWikimedia(effectiveQuery);
  }

  const safeResults = rawResults.filter((img) => {
    if (!img.thumbnail) return false;
    if (isDomainBlocked(img.source || img.original || img.link)) return false;
    if (isTitleBlocked(img.title)) return false;
    return true;
  });

  const deduped = deduplicate(safeResults);

  const images = deduped.slice(0, 18).map(({ title, thumbnail, original }, i) => ({
    position: i,
    title: title || `${effectiveQuery} Option ${i + 1}`,
    thumbnail: thumbnail || '',
    original: original || thumbnail || '',
  }));

  return NextResponse.json({
    images,
    refinedQuery: effectiveQuery,
    total: images.length,
  });
}
