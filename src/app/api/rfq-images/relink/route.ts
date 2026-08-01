import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Updates rfq_reference_images.rfq_id from tempId → realId
// Called after RFQ submission to link uploaded images to the real RFQ record
export async function POST(req: NextRequest) {
  let body: { tempId?: string; realId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { tempId, realId } = body;
  if (!tempId || !realId) {
    return NextResponse.json({ error: 'tempId and realId required' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });

  const { data, error } = await supabase
    .from('rfq_reference_images')
    .update({ rfq_id: realId })
    .eq('rfq_id', tempId)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length ?? 0 });
}
