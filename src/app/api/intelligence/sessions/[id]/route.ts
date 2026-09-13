import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    const queryBuyerId = req.nextUrl.searchParams.get('buyerId');
    const effectiveBuyerId = user?.id || queryBuyerId;

    let query = supabase.from('intelligence_sessions').select('*').eq('id', id);
    if (effectiveBuyerId) {
      query = query.eq('buyer_id', effectiveBuyerId);
    }
    const { data: session } = await query.maybeSingle();

    const { data: messages } = await supabase
      .from('intelligence_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    if (session) {
      return NextResponse.json({ session, messages: messages || [] });
    }
  } catch (err: any) {
    console.error('Error fetching session:', err);
  }

  return NextResponse.json(
    { session: null, messages: [] },
    { status: 404 }
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const queryBuyerId = req.nextUrl.searchParams.get('buyerId');
    const effectiveBuyerId = user?.id || queryBuyerId;

    if (effectiveBuyerId) {
      await supabase
        .from('intelligence_sessions')
        .update({ status: 'archived' })
        .eq('id', id)
        .eq('buyer_id', effectiveBuyerId);
    }
  } catch (err: any) {
    console.error('Error deleting session:', err);
  }

  return NextResponse.json({ success: true, id });
}
