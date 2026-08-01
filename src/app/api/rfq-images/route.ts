import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = 'rfq-images';

interface ImageInput {
  url: string;
  thumbnail: string;
  title: string;
  position: number;
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { rfqId?: string; images?: ImageInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { rfqId, images } = body;
  if (!rfqId || !images?.length) {
    return NextResponse.json({ error: 'rfqId and images required' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });

  const results: any[] = [];
  const errors: string[] = [];

  for (const img of images) {
    try {
      // Fetch the image binary server-side
      const imgRes = await fetch(img.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Proquoment/1.0)' },
        signal: AbortSignal.timeout(8000),
      });

      if (!imgRes.ok) {
        // Fallback to thumbnail if original fails
        const thumbRes = await fetch(img.thumbnail, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Proquoment/1.0)' },
          signal: AbortSignal.timeout(5000),
        });
        if (!thumbRes.ok) {
          errors.push(`Failed to fetch image at position ${img.position}`);
          continue;
        }
        const thumbBlob = await thumbRes.arrayBuffer();
        const thumbContentType = thumbRes.headers.get('content-type') || 'image/jpeg';
        const ext = thumbContentType.split('/')[1]?.split(';')[0] || 'jpg';
        const storagePath = `${rfqId}/${img.position}-thumb.${ext}`;

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, thumbBlob, { contentType: thumbContentType, upsert: true });

        if (upErr) { errors.push(upErr.message); continue; }

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        const { data: row, error: dbErr } = await supabase
          .from('rfq_reference_images')
          .insert({
            rfq_id: rfqId,
            storage_path: storagePath,
            public_url: urlData.publicUrl,
            thumbnail_url: img.thumbnail,
            title: img.title,
            sort_order: img.position,
          })
          .select()
          .single();

        if (dbErr) { errors.push(dbErr.message); continue; }
        results.push(row);
        continue;
      }

      const blob = await imgRes.arrayBuffer();
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';
      const storagePath = `${rfqId}/${img.position}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, blob, { contentType, upsert: true });

      if (upErr) { errors.push(upErr.message); continue; }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      const { data: row, error: dbErr } = await supabase
        .from('rfq_reference_images')
        .insert({
          rfq_id: rfqId,
          storage_path: storagePath,
          public_url: urlData.publicUrl,
          thumbnail_url: img.thumbnail,
          title: img.title,
          sort_order: img.position,
        })
        .select()
        .single();

      if (dbErr) { errors.push(dbErr.message); continue; }
      results.push(row);
    } catch (err) {
      errors.push(`Image ${img.position}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  return NextResponse.json({ saved: results, errors });
}
