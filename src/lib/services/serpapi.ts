/**
 * SerpAPI Google Lens wrapper — server-side only
 *
 * Used for two purposes:
 *  1. OCR extraction from scanned PDF pages (converted to images) or image files
 *  2. Visual product matching from uploaded product images
 */

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const SERPAPI_BASE = 'https://serpapi.com/search.json';

export interface LensOcrResult {
  /** All text extracted from the image via OCR */
  text: string;
  /** Visual product matches (for product images) */
  visualMatches: { url: string; title: string; thumbnail: string; source: string }[];
  /** Raw SerpAPI response for debugging */
  raw?: any;
}

/**
 * Run Google Lens on a publicly accessible image URL.
 * Returns extracted text (OCR) and visual product matches.
 */
export async function callGoogleLens(imageUrl: string): Promise<LensOcrResult> {
  if (!SERPAPI_KEY) {
    throw new Error('SERPAPI_KEY is not configured');
  }

  const url = new URL(SERPAPI_BASE);
  url.searchParams.set('engine', 'google_lens');
  url.searchParams.set('url', imageUrl);
  url.searchParams.set('api_key', SERPAPI_KEY);
  url.searchParams.set('no_cache', 'false'); // allow caching to reduce quota usage

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`SerpAPI Google Lens error ${res.status}: ${errorText}`);
  }

  const data = await res.json();

  // Extract text from all available text result fields
  const textParts: string[] = [];

  // text_results array (primary OCR output)
  if (Array.isArray(data.text_results)) {
    for (const item of data.text_results) {
      if (item.text) textParts.push(item.text);
    }
  }

  // knowledge_graph title + description (often has product details)
  if (data.knowledge_graph?.title) textParts.push(data.knowledge_graph.title);
  if (data.knowledge_graph?.description) textParts.push(data.knowledge_graph.description);

  // visual_matches titles (supplementary product info)
  const visualMatches = (data.visual_matches || []).slice(0, 10).map((m: any) => ({
    url: m.link || m.url || '',
    title: m.title || '',
    thumbnail: m.thumbnail || '',
    source: m.source || '',
  }));

  // Add visual match titles to text if they look like product specs
  for (const match of visualMatches.slice(0, 3)) {
    if (match.title && match.title.length > 5) {
      textParts.push(`Related: ${match.title}`);
    }
  }

  return {
    text: textParts.join('\n').trim(),
    visualMatches,
    raw: data,
  };
}

/**
 * Upload an image buffer to Supabase Storage (temp-ocr bucket) and return its public URL.
 * Images are stored with a TTL-style path so they can be cleaned up later.
 */
export async function uploadImageForLens(
  imageBuffer: Buffer,
  filename: string,
  supabaseClient: any
): Promise<string> {
  const bucket = 'rfq-images';
  const path = `temp-ocr/${Date.now()}-${filename}`;

  const { error } = await supabaseClient.storage.from(bucket).upload(path, imageBuffer, {
    contentType: 'image/png',
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: urlData } = supabaseClient.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}

/**
 * Run OCR on an image file (as Buffer) by:
 *  1. Uploading it to Supabase Storage to get a public URL
 *  2. Calling Google Lens with that URL
 */
export async function ocrImageBuffer(
  buffer: Buffer,
  filename: string,
  supabaseClient: any
): Promise<LensOcrResult> {
  const publicUrl = await uploadImageForLens(buffer, filename, supabaseClient);
  return callGoogleLens(publicUrl);
}
