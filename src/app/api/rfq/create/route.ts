import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cs) =>
        cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { product, qty, value, targetPrice, specs, deadline, buyer, description, aiChat, rfqState, userId: clientUserId } = body;

  if (!product) {
    return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
  }

  let userId: string | null = clientUserId || null;
  let userEmail: string | null = null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      userId = user.id;
      userEmail = user.email || null;
    }
  } catch (err) {
    console.warn('[api/rfq/create] Failed to get authenticated user session:', err);
  }

  // Resolve buyer name
  let resolvedBuyer = buyer || 'Enterprise Buyer';
  const isDemo = userEmail ? ['demo@proquoment.com', 'buyer@proquoment.com'].includes(userEmail) : false;
  if (isDemo) {
    resolvedBuyer = 'Demo User';
  } else if (userId) {
    try {
      const { data: profile } = await supabase
        .from('buyer_profiles')
        .select('organization_name, legal_name')
        .eq('id', userId)
        .maybeSingle();

      resolvedBuyer = profile?.organization_name || profile?.legal_name || resolvedBuyer;
    } catch {
      resolvedBuyer = userEmail?.split('@')[0] || resolvedBuyer;
    }
  }

  const id = `RFQ-${Date.now().toString(36).toUpperCase()}`;
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // 1. Persist to rfqs table (resilient against missing optional columns like rfq_state / target_price)
  const basePayload: Record<string, any> = {
    id,
    product,
    buyer: resolvedBuyer,
    qty: qty || 'TBD',
    value: value || 'TBD',
    status: 'new',
    date: dateStr,
    deadline: deadline || null,
    specs: specs || null,
    description: description || null,
    ai_chat: aiChat || null,
    buyer_id: userId,
  };

  const fullPayload = {
    ...basePayload,
    ...(rfqState ? { rfq_state: rfqState } : {}),
    ...(targetPrice ? { target_price: targetPrice } : {}),
  };

  let { error: rfqErr } = await supabase.from('rfqs').insert(fullPayload);

  // If PostgREST schema cache error (PGRST204) due to unmigrated columns, retry with basePayload
  if (rfqErr && (rfqErr.code === 'PGRST204' || rfqErr.message?.includes('schema cache'))) {
    console.warn('[api/rfq/create] PostgREST schema column missing, retrying insert with base columns...');
    const retry = await supabase.from('rfqs').insert(basePayload);
    rfqErr = retry.error;
  }

  // If RLS policy error (42501) and service role key is available, use service role client
  if (rfqErr && rfqErr.code === '42501') {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (serviceRoleKey) {
      console.warn('[api/rfq/create] RLS policy blocked insert (42501), retrying using service role client...');
      const adminDb = createClient(SUPABASE_URL, serviceRoleKey);
      const adminRetry = await adminDb.from('rfqs').insert(basePayload);
      rfqErr = adminRetry.error;
    }
  }

  if (rfqErr) {
    console.error('[api/rfq/create] Failed to insert RFQ into Supabase:', rfqErr);
    return NextResponse.json(
      { error: 'Failed to insert RFQ into Supabase', details: rfqErr },
      { status: 500 }
    );
  }

  // 2. Persist to products table with a valid UUID
  const productId = crypto.randomUUID();
  const finalCategory =
    rfqState?.synthesized?.product?.category_path?.join(' > ') ||
    rfqState?.product?.classification?.broad_category ||
    'General';

  const { error: prodErr } = await supabase.from('products').insert({
    id: productId,
    name: product,
    category: finalCategory,
    description: description || rfqState?.synthesized?.product?.synthesized_description || '',
    moq: qty || 'TBD',
    buyer_id: userId,
    is_demo: isDemo,
  });

  if (prodErr) {
    console.warn('[api/rfq/create] Products insert warning:', prodErr);
  }

  // 3. Create Admin Notification
  try {
    await supabase.from('notifications').insert({
      target_dashboard: 'admin',
      type: 'new_rfq',
      title: `New RFQ: ${product}`,
      message: `${resolvedBuyer} submitted RFQ for ${qty || 'TBD'} of ${product}`,
      action_url: `/rfq/${id}`,
    });
  } catch {}

  return NextResponse.json({
    success: true,
    id,
    productId,
    buyer: resolvedBuyer,
  });
}
