import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    const queryBuyerId = req.nextUrl.searchParams.get('buyerId');
    const effectiveBuyerId = user?.id || queryBuyerId;

    if (!effectiveBuyerId) {
      return NextResponse.json({ workspaces: [] });
    }

    const { data, error } = await supabase
      .from('intelligence_workspaces')
      .select('*')
      .eq('buyer_id', effectiveBuyerId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching user workspaces:', error);
      return NextResponse.json({ workspaces: [] });
    }

    return NextResponse.json({ workspaces: data || [] });
  } catch (err: any) {
    console.error('Error in GET /api/intelligence/workspaces:', err);
    return NextResponse.json({ workspaces: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      productName,
      destinationCountry,
      destinationCountryName,
      hsCode,
      originCountries,
      buyerId,
      sourcingScore,
      status,
    } = body;

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    const effectiveBuyerId = user?.id || buyerId;

    if (!effectiveBuyerId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const newWs = {
      id: id || `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      buyer_id: effectiveBuyerId,
      product_name: productName || 'New Commodity',
      destination_country: destinationCountry || 'Global',
      destination_country_name: destinationCountryName || destinationCountry || 'Global',
      hs_code: hsCode || null,
      origin_countries: originCountries || [],
      status: status || 'active',
      sourcing_score: sourcingScore || 85,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('intelligence_workspaces')
      .upsert(newWs);

    if (error) {
      console.error('Error saving workspace:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workspace: newWs }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create workspace' }, { status: 500 });
  }
}
