import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    const queryBuyerId = req.nextUrl.searchParams.get('buyerId');
    const effectiveBuyerId = user?.id || queryBuyerId;

    if (!effectiveBuyerId) {
      return NextResponse.json({ sessions: [] });
    }

    const { data, error } = await supabase
      .from('intelligence_sessions')
      .select('*')
      .eq('buyer_id', effectiveBuyerId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching user sessions:', error);
      return NextResponse.json({ sessions: [] });
    }

    return NextResponse.json({ sessions: data || [] });
  } catch (err: any) {
    console.error('Error in GET /api/intelligence/sessions:', err);
    return NextResponse.json({ sessions: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, buyerId, workspaceId, metadata } = body;

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    const effectiveBuyerId = user?.id || buyerId;

    if (!effectiveBuyerId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const newSession = {
      id: id || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      buyer_id: effectiveBuyerId,
      title: title || 'New Sourcing Research',
      workspace_id: workspaceId || null,
      status: 'active',
      metadata: metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('intelligence_sessions')
      .upsert(newSession);

    if (error) {
      console.error('Error saving session:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: newSession }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create session' }, { status: 500 });
  }
}
