import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const PRIMARY_MODEL = 'google/gemini-3.1-flash-lite-image';
const FALLBACK_MODELS = [
  'black-forest-labs/flux-1-schnell',
  'google/gemini-2.5-flash-image',
  'stabilityai/stable-diffusion-xl-base-1.0',
];

async function persistImageToStorage(urlOrBase64: string): Promise<string> {
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://apmwmncqmhjacwrmnfms.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) return urlOrBase64;

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    let buffer: Buffer;
    let contentType = 'image/png';

    if (urlOrBase64.startsWith('data:')) {
      const match = urlOrBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return urlOrBase64;
      contentType = match[1] || 'image/png';
      buffer = Buffer.from(match[2], 'base64');
    } else if (urlOrBase64.startsWith('http://') || urlOrBase64.startsWith('https://')) {
      if (urlOrBase64.includes('supabase.co/storage/v1/object/public/rfq-images/')) {
        return urlOrBase64;
      }
      const res = await fetch(urlOrBase64, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) return urlOrBase64;
      contentType = res.headers.get('content-type') || 'image/png';
      const arrayBuf = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    } else {
      return urlOrBase64;
    }

    const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
    const filePath = `ai-visuals/concept-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('rfq-images')
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (upErr) {
      console.warn('[visualize] Supabase storage upload warning:', upErr.message);
      return urlOrBase64;
    }

    const { data: publicUrlData } = supabase.storage
      .from('rfq-images')
      .getPublicUrl(filePath);

    return publicUrlData?.publicUrl || urlOrBase64;
  } catch (err) {
    console.warn('[visualize] persistImageToStorage warning:', err);
    return urlOrBase64;
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt, negativePrompt, productName, version = 1, generationCount } = body;

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Missing required field: prompt' }, { status: 400 });
  }

  if (generationCount && Number(generationCount) > 4) {
    return NextResponse.json(
      { error: 'Maximum 4 visual previews allowed per RFQ session' },
      { status: 429 }
    );
  }

  if (!apiKey) {
    console.warn('[visualize] OPENROUTER_API_KEY is not configured. Falling back to demo image placeholder.');
    return NextResponse.json({
      success: true,
      imageUrl: '/assets/images/no_image.png',
      modelUsed: 'mock-placeholder',
      promptUsed: prompt,
      version,
      isPlaceholder: true,
    });
  }

  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError = '';

  for (const model of modelsToTry) {
    try {
      console.log(`[visualize] Attempting image generation with model: ${model}`);
      
      const payload: any = {
        model,
        messages: [
          {
            role: 'user',
            content: prompt + (negativePrompt ? `\n\nNegative prompt: ${negativePrompt}` : ''),
          },
        ],
      };

      // If model supports modalities parameter
      if (model.includes('gemini') || model.includes('flux')) {
        payload.modalities = ['image', 'text'];
      }

      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://proquoment.com',
          'X-Title': 'Proquoment Visual Validation',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(35000),
      });

      if (!response.ok) {
        lastError = await response.text();
        console.warn(`[visualize] Model ${model} returned error ${response.status}:`, lastError);
        continue;
      }

      const data = await response.json();

      // 1. Check message.images array (OpenRouter multimodal standard)
      const imagesArr = data.choices?.[0]?.message?.images;
      if (Array.isArray(imagesArr) && imagesArr.length > 0) {
        const firstImg = imagesArr[0];
        const extractedUrl = typeof firstImg === 'string' ? firstImg : firstImg?.image_url?.url || firstImg?.url;
        if (extractedUrl) {
          const finalUrl = await persistImageToStorage(extractedUrl);
          return NextResponse.json({
            success: true,
            imageUrl: finalUrl,
            modelUsed: model,
            promptUsed: prompt,
            version,
          });
        }
      }

      // 2. Check message.content for markdown image syntax: ![...](url)
      const content = data.choices?.[0]?.message?.content || '';
      const markdownMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+|data:image\/[^;]+;base64,[^\s)]+)\)/);
      if (markdownMatch && markdownMatch[1]) {
        const finalUrl = await persistImageToStorage(markdownMatch[1]);
        return NextResponse.json({
          success: true,
          imageUrl: finalUrl,
          modelUsed: model,
          promptUsed: prompt,
          version,
        });
      }

      // 3. Check if content itself is a URL or data URI
      if (content.startsWith('http://') || content.startsWith('https://') || content.startsWith('data:image/')) {
        const finalUrl = await persistImageToStorage(content.trim());
        return NextResponse.json({
          success: true,
          imageUrl: finalUrl,
          modelUsed: model,
          promptUsed: prompt,
          version,
        });
      }

      console.warn(`[visualize] Model ${model} responded without recognized image URL. Content preview:`, content.slice(0, 150));
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.warn(`[visualize] Model ${model} failed with exception:`, lastError);
    }
  }

  // If all OpenRouter models fail or return no URL
  console.error('[visualize] All generation models failed. Last error:', lastError);
  return NextResponse.json(
    {
      error: 'Image generation failed across all providers',
      details: lastError,
      fallbackAvailable: true,
    },
    { status: 502 }
  );
}
