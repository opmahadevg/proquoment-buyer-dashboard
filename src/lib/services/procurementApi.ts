// Buyer Dashboard — Shared Procurement API Layer
// Connects to the shared Supabase instance (Admin's DB: apmwmncqmhjacwrmnfms)
// All reads/writes are scoped to the authenticated buyer's user ID.
import { createClient } from '@/lib/supabase/client';

function getSupabase() {
  return createClient();
}

/** Returns the current authenticated user ID (throws if not authed) */
async function requireUserId(): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not available');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Not authenticated');
  return user.id;
}

/** Returns the current user ID or null (for read-only fetchers that should silently return []) */
async function getUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── Fetchers ──────────────────────────────────────────────────────────────

export async function fetchBuyerRFQs() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('rfqs')
    .select('*')
    .eq('buyer_id', userId) // Scoped to current buyer
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchBuyerRFQs:', error);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    product: r.product,
    buyer: r.buyer,
    qty: r.qty,
    value: r.value,
    status: r.status,
    date: r.date,
    assignedSupplier: r.assigned_supplier,
    deadline: r.deadline,
    targetPrice: r.target_price,
    specs: r.specs,
    createdAt: r.created_at,
  }));
}

export async function fetchBuyerQuotes() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const userId = await getUserId();
  if (!userId) return [];

  // Quotes are linked to rfqs; RLS policy on quotes filters by rfq.buyer_id
  const { data, error } = await supabase
    .from('quotes')
    .select('*, rfqs!inner(buyer_id)')
    .eq('rfqs.buyer_id', userId) // Join filter — only this buyer's quotes
    .in('status', ['sent', 'accepted', 'rejected'])
    .order('created_at', { ascending: false });

  if (error) {
    // Fallback: fetch without join (RLS will still enforce buyer scope)
    const { data: fallback, error: fallbackErr } = await supabase
      .from('quotes')
      .select('*')
      .in('status', ['sent', 'accepted', 'rejected'])
      .order('created_at', { ascending: false });
    if (fallbackErr) {
      console.error('fetchBuyerQuotes:', fallbackErr);
      return [];
    }
    return (fallback || []).map(mapQuote);
  }
  return (data || []).map(mapQuote);
}

function mapQuote(r: any) {
  return {
    id: r.id,
    rfqId: r.rfq_id,
    orderId: r.order_id,
    supplierId: r.supplier_id,
    supplierUnitPrice: r.supplier_unit_price,
    qty: r.qty,
    qcFee: r.qc_fee,
    docFee: r.doc_fee,
    freightCost: r.freight_cost,
    insurance: r.insurance,
    marginPct: r.margin_pct,
    landedCostPerUnit: r.landed_cost_per_unit,
    totalValue: r.total_value,
    validityDays: r.validity_days,
    status: r.status,
    sentAt: r.sent_at,
    createdAt: r.created_at,
  };
}

export async function fetchBuyerOrders() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('buyer_id', userId) // Scoped to current buyer
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchBuyerOrders:', error);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    product: r.product,
    buyer: r.buyer,
    supplier: r.supplier_id ? `Supplier #${r.supplier_id}` : 'Verified Supplier',
    supplierCity: r.supplier_city,
    value: r.value,
    stage: r.stage,
    progress: r.progress,
    days: r.days,
    eta: r.eta,
    priority: r.priority,
    createdAt: r.created_at,
  }));
}

export async function fetchBuyerQCReports() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const userId = await getUserId();
  if (!userId) return [];

  // QC reports are linked to orders; only fetch for this buyer's orders
  const { data: orderIds } = await supabase.from('orders').select('id').eq('buyer_id', userId);

  const ids = (orderIds || []).map((o: any) => o.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('qc_reports')
    .select('*')
    .in('order_id', ids)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('fetchBuyerQCReports:', error);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    orderId: r.order_id,
    qcInspectionId: r.qc_inspection_id,
    reportUrl: r.report_url,
    result: r.result,
    notes: r.notes,
    photos: r.photos,
    uploadedAt: r.uploaded_at,
  }));
}

export async function fetchBuyerShipments() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const userId = await getUserId();
  if (!userId) return [];

  // Shipments scoped to this buyer's orders
  const { data: orderIds } = await supabase.from('orders').select('id').eq('buyer_id', userId);

  const ids = (orderIds || []).map((o: any) => o.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .in('order_id', ids)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchBuyerShipments:', error);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    orderId: r.order_id,
    forwarder: r.forwarder,
    pol: r.pol,
    pod: r.pod,
    incoterms: r.incoterms,
    bookingRef: r.booking_ref,
    containerNo: r.container_no,
    vesselName: r.vessel_name,
    departureDate: r.departure_date,
    eta: r.eta,
    customsStatus: r.customs_status,
    deliveryConfirmed: r.delivery_confirmed,
    createdAt: r.created_at,
  }));
}

export async function fetchBuyerInvoices() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const userId = await getUserId();
  if (!userId) return [];

  const { data: orderIds } = await supabase.from('orders').select('id').eq('buyer_id', userId);

  const ids = (orderIds || []).map((o: any) => o.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .in('order_id', ids)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchBuyerInvoices:', error);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    orderId: r.order_id,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    dueDate: r.due_date,
    paidAt: r.paid_at,
    paymentRef: r.payment_ref,
    createdAt: r.created_at,
  }));
}

export async function fetchBuyerNotifications() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('target_dashboard', 'buyer')
    .or(`buyer_id.eq.${userId},type.eq.admin_announcement`) // own + broadcasts
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('fetchBuyerNotifications:', error);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    targetDashboard: r.target_dashboard,
    orderId: r.order_id,
    type: r.type,
    title: r.title,
    message: r.message,
    read: r.read ?? false,
    actionUrl: r.action_url,
    createdAt: r.created_at,
  }));
}

export async function fetchBuyerDocuments() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const userId = await getUserId();
  if (!userId) return [];

  const { data: orderIds } = await supabase.from('orders').select('id').eq('buyer_id', userId);

  const ids = (orderIds || []).map((o: any) => o.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .in('order_id', ids)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchBuyerDocuments:', error);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    orderId: r.order_id,
    name: r.name,
    type: r.type,
    preparedBy: r.prepared_by,
    status: r.status,
    uploadedAt: r.uploaded_at,
    url: r.url,
  }));
}

// ── Write Operations ──────────────────────────────────────────────────────

export async function submitRFQ(rfq: {
  product: string;
  qty: string;
  value: string;
  targetPrice?: string;
  specs?: string;
  deadline?: string;
  buyer: string;
  description?: string;
  aiChat?: any;
}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) throw new Error('Not authenticated');

  let resolvedBuyer = rfq.buyer;
  const isDemo = user.email ? ['demo@proquoment.com', 'buyer@proquoment.com'].includes(user.email) : false;
  if (isDemo) {
    resolvedBuyer = 'Demo User';
  } else {
    try {
      const { data: profile } = await supabase
        .from('buyer_profiles')
        .select('organization_name, legal_name')
        .eq('id', userId)
        .maybeSingle();

      resolvedBuyer = profile?.organization_name ||
                      profile?.legal_name ||
                      user.user_metadata?.full_name ||
                      user.email?.split('@')[0] ||
                      'Enterprise Buyer';
    } catch {
      resolvedBuyer = user.email?.split('@')[0] || 'Enterprise Buyer';
    }
  }

  const id = `RFQ-${Date.now().toString(36).toUpperCase()}`;
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const { error } = await supabase.from('rfqs').insert({
    id,
    product: rfq.product,
    buyer: resolvedBuyer,
    qty: rfq.qty,
    value: rfq.value || 'TBD',
    status: 'new',
    date: dateStr,
    deadline: rfq.deadline || null,
    specs: rfq.specs || null,
    description: rfq.description || null,
    ai_chat: rfq.aiChat || null,
    buyer_id: userId, // Always stamp with the authenticated buyer's ID
  });
  if (error) throw error;

  const extras = [
    rfq.specs && `Specs: ${rfq.specs}`,
    rfq.targetPrice && `Target: ${rfq.targetPrice}`,
    rfq.deadline && `Deadline: ${rfq.deadline}`,
  ]
    .filter(Boolean)
    .join(' | ');

  // Notify admin (no buyer_id — admin notifications are unscoped)
  await supabase
    .from('notifications')
    .insert({
      target_dashboard: 'admin',
      type: 'new_rfq',
      title: `New RFQ: ${rfq.product}`,
      message: `${rfq.buyer || 'Buyer'} submitted RFQ for ${rfq.qty} of ${rfq.product} (${rfq.value || 'TBD'})${extras ? '. ' + extras : ''}`,
      action_url: `/rfq/${id}`,
    })
    .catch(() => {}); // Notification failure should not block RFQ creation

  return id;
}

export async function insertOrder(orderData: {
  id?: string;
  product: string;
  buyer: string;
  supplier?: string;
  value?: string;
  contractValue?: number;
  stage?: string;
  rfqId?: string;
  quoteId?: string;
  freightCost?: number;
  dutiesCost?: number;
  supplierCity?: string;
  buyerCountry?: string;
  buyerId?: string; // Explicit buyer_id override (used internally)
}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');

  // Use explicitly passed buyerId (from acceptQuote) or resolve from session
  const userId = orderData.buyerId || (await requireUserId());

  const id = orderData.id || `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
  const { error } = await supabase.from('orders').insert({
    id,
    product: orderData.product,
    buyer: orderData.buyer,
    supplier: orderData.supplier || 'Premium Supplier',
    value: orderData.value || `$${(orderData.contractValue || 0).toLocaleString()}`,
    stage: orderData.stage || 'bulk_order',
    days: 1,
    alert: false,
    buyer_country: orderData.buyerCountry || 'USA',
    supplier_city: orderData.supplierCity || 'Shaoxing, CN',
    contract_value: orderData.contractValue || 0,
    freight_cost: orderData.freightCost || 0,
    duties_cost: orderData.dutiesCost || 0,
    paid_percent: 0,
    rfq_id: orderData.rfqId,
    quote_id: orderData.quoteId,
    buyer_accepted: true,
    archived: false,
    buyer_id: userId, // Stamp with buyer's ID
  });

  if (error) throw error;
  return id;
}

export async function acceptQuote(quoteId: string, rfqId: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');

  const userId = await requireUserId();

  // Update Quote status
  const { error } = await supabase.from('quotes').update({ status: 'accepted' }).eq('id', quoteId);
  if (error) throw error;

  // Update RFQ status (scoped to buyer)
  await supabase.from('rfqs').update({ status: 'accepted' }).eq('id', rfqId).eq('buyer_id', userId);

  // Fetch Quote data
  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
  // Fetch RFQ data
  const { data: rfq } = await supabase.from('rfqs').select('*').eq('id', rfqId).single();

  const product = rfq?.product || 'Custom Product Order';
  const buyer = rfq?.buyer || 'Enterprise Buyer';
  const supplier = rfq?.assigned_supplier || quote?.supplier_id || 'Premium Supplier';
  const contractValue =
    quote?.total_value || parseFloat(String(rfq?.value || '0').replace(/[$,]/g, '')) || 0;
  const totalValue = quote?.total_value
    ? `$${quote.total_value.toLocaleString()}`
    : rfq?.value || '$0';

  // Create order stamped with this buyer's ID
  const orderId = await insertOrder({
    product,
    buyer,
    supplier,
    value: totalValue,
    contractValue,
    stage: 'bulk_order',
    rfqId,
    quoteId,
    freightCost: quote?.freight_cost || 0,
    dutiesCost: quote?.doc_fee || 0,
    buyerId: userId, // Pass explicitly to avoid second auth.getUser() call
  });

  // Link Order ID back to quote
  if (quoteId) {
    await supabase.from('quotes').update({ order_id: orderId }).eq('id', quoteId);
  }

  // Notify admin
  await supabase.from('notifications').insert({
    target_dashboard: 'admin',
    order_id: orderId,
    type: 'quote_accepted',
    title: `Quote ${quoteId} Accepted`,
    message: `Buyer accepted quote for ${product}. Order ${orderId} has been successfully created.`,
    action_url: `/orders`,
  });
}

export async function rejectQuote(quoteId: string, rfqId: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');
  const { error } = await supabase.from('quotes').update({ status: 'rejected' }).eq('id', quoteId);
  if (error) throw error;
  await supabase.from('notifications').insert({
    target_dashboard: 'admin',
    type: 'quote_rejected',
    title: `Quote ${quoteId} Rejected`,
    message: `Buyer rejected quote linked to ${rfqId}`,
  });
}

export async function acceptSampleQuote(quoteId: string, rfqId: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');

  const userId = await requireUserId();

  // 1. Update Quote status to accepted
  const { error: quoteErr } = await supabase.from('quotes').update({ status: 'accepted' }).eq('id', quoteId);
  if (quoteErr) throw quoteErr;

  // 2. Fetch the quote and the RFQ details
  const { data: quote, error: getQuoteErr } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
  if (getQuoteErr) throw getQuoteErr;

  const { data: rfq, error: getRfqErr } = await supabase.from('rfqs').select('*').eq('id', rfqId).single();
  if (getRfqErr) throw getRfqErr;

  // Update RFQ status to 'converted' to advance the stage to Sampling
  await supabase.from('rfqs').update({ status: 'converted' }).eq('id', rfqId).eq('buyer_id', userId);

  // 3. Resolve buyer name and logo
  let buyerName = rfq?.buyer || 'Enterprise Buyer';
  let buyerLogo = 'EB';
  try {
    const { data: profile } = await supabase
      .from('buyer_profiles')
      .select('organization_name, legal_name')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.organization_name) {
      buyerName = profile.organization_name;
      buyerLogo = profile.organization_name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
    } else if (profile?.legal_name) {
      buyerName = profile.legal_name;
      buyerLogo = profile.legal_name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
    }
  } catch (e) {
    console.error('Error fetching buyer profile for sample order:', e);
  }

  // 4. Insert sample order in sample_orders table
  const sampleOrderId = `SO-${Date.now().toString(36).toUpperCase()}`;
  const todayStr = new Date().toISOString().split('T')[0];

  const { error: sampleErr } = await supabase.from('sample_orders').insert({
    id: sampleOrderId,
    product: rfq?.product || 'Custom Product',
    buyer_name: buyerName,
    buyer_logo: buyerLogo,
    quantity: `${quote?.moq || 1} samples`,
    status: 'Pending',
    requested_at: todayStr,
    delivered_at: '—',
    is_demo: false,
    buyer_id: userId
  });
  if (sampleErr) throw sampleErr;

  // 5. Notify admin
  await supabase.from('notifications').insert({
    target_dashboard: 'admin',
    order_id: sampleOrderId,
    type: 'sample_requested',
    title: `Sample Ordered: ${rfq?.product}`,
    message: `${buyerName} ordered sample from ${quote?.supplier_name || 'supplier'}. Sample order ${sampleOrderId} created.`,
    action_url: `/samples`,
    read: false
  });

  // 6. Notify supplier
  try {
    if (quote?.supplier_id) {
      await supabase.from('notifications').insert({
        target_dashboard: 'supplier',
        type: 'sample_requested',
        title: `New Sample Order: ${rfq?.product}`,
        message: `Buyer accepted your sample quote! Please prepare and ship the sample.`,
        read: false
      });

      await supabase.from('messages').insert({
        id: `MSG-SAMPLE-${Date.now()}`,
        from_name: 'Admin',
        to_name: quote?.supplier_name || 'Supplier',
        subject: `Sample Order: ${rfq?.product}`,
        text: `Congratulations! Buyer has accepted your sample bid and ordered a sample. Sample Order ID: ${sampleOrderId}. Please ship as soon as possible.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'supplier',
        read: false
      });
    }
  } catch (e) {
    console.error('Error notifying supplier:', e);
  }

  return sampleOrderId;
}

export async function confirmDelivery(shipmentId: string, orderId: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');
  const userId = await requireUserId();

  await supabase.from('shipments').update({ delivery_confirmed: true }).eq('id', shipmentId);
  // Scoped update — buyer can only mark their own orders delivered
  await supabase
    .from('orders')
    .update({ stage: 'delivered' })
    .eq('id', orderId)
    .eq('buyer_id', userId);

  await supabase.from('notifications').insert({
    target_dashboard: 'admin',
    order_id: orderId,
    type: 'stage_update',
    title: `Delivery Confirmed: ${orderId}`,
    message: 'Buyer confirmed receipt of goods',
  });
}

export async function markNotificationRead(id: number) {
  const supabase = getSupabase();
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;

  // Only mark notifications that belong to this buyer
  await supabase.from('notifications').update({ read: true }).eq('id', id).eq('buyer_id', userId);
}

export async function createNotification(params: {
  targetDashboard: 'admin' | 'buyer' | 'supplier';
  type: string;
  title: string;
  message: string;
  orderId?: string;
  actionUrl?: string;
  buyerId?: string; // Required when targetDashboard = 'buyer'
}) {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from('notifications').insert({
    target_dashboard: params.targetDashboard,
    type: params.type,
    title: params.title,
    message: params.message,
    order_id: params.orderId,
    action_url: params.actionUrl,
    buyer_id: params.buyerId || null,
    read: false,
  });
  if (error) throw error;
}

export async function fetchBuyerMilestones() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const userId = await getUserId();
  if (!userId) return [];

  // Milestones linked to this buyer's orders
  const { data: orderIds } = await supabase.from('orders').select('id').eq('buyer_id', userId);

  const ids = (orderIds || []).map((o: any) => o.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .in('order_id', ids)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('fetchBuyerMilestones:', error);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    orderId: r.order_id,
    title: r.title,
    description: r.description,
    status: r.status,
    targetDate: r.target_date,
    completedAt: r.completed_at,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
  }));
}

export async function fetchCurrentBuyerProfile() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('buyer_profiles')
    .select('*')
    .eq('id', user.id) // Scoped to current user's own profile
    .maybeSingle();

  if (error) {
    console.error('fetchCurrentBuyerProfile:', error);
    return null;
  }
  return data;
}

export async function saveCurrentBuyerProfile(profile: any) {
  const supabase = getSupabase();
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('buyer_profiles').upsert(
    {
      id: user.id, // Always use auth user ID as PK
      ...profile,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) throw error;
}

export async function fetchBuyerMessages() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const userId = await getUserId();
  if (!userId) return [];

  // Messages where the buyer is participant, scoped by user context
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userEmail = user?.email || '';
  const userHandle = userEmail.split('@')[0];

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`to_name.eq.${userHandle},from_name.eq.${userHandle},type.eq.buyer`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('fetchBuyerMessages:', error);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    orderId: r.order_id,
    from: r.from_name,
    to: r.to_name,
    subject: r.subject,
    text: r.text,
    time: r.time,
    type: r.type,
    read: r.read ?? false,
    createdAt: r.created_at,
  }));
}

export async function sendBuyerMessage(msg: { orderId?: string; subject: string; text: string }) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fromName = user.email?.split('@')[0] || 'Enterprise Buyer';

  const { error } = await supabase.from('messages').insert({
    id: `MSG-${Date.now()}`,
    order_id: msg.orderId,
    from_name: fromName,
    to_name: 'Admin',
    subject: msg.subject,
    text: msg.text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type: 'buyer',
    read: false,
  });
  if (error) throw error;

  await supabase
    .from('notifications')
    .insert({
      target_dashboard: 'admin',
      order_id: msg.orderId,
      type: 'message_received',
      title: `New Message from ${fromName}`,
      message: msg.text.slice(0, 100),
      action_url: '/communications',
      read: false,
    })
    .catch(() => {});
}

export async function markBuyerMessageRead(messageId: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('messages').update({ read: true }).eq('id', messageId);
}

export async function placeSampleOrders(quoteIds: string[], rfqId: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');
  const userId = await requireUserId();

  // Fetch RFQ data
  const { data: rfq } = await supabase.from('rfqs').select('*').eq('id', rfqId).single();
  if (!rfq) throw new Error('RFQ not found');

  // Resolve buyer profile
  let buyerName = rfq.buyer || 'Enterprise Buyer';
  let buyerLogo = 'EB';
  try {
    const { data: profile } = await supabase
      .from('buyer_profiles')
      .select('organization_name, legal_name')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.organization_name) {
      buyerName = profile.organization_name;
      buyerLogo = profile.organization_name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
    } else if (profile?.legal_name) {
      buyerName = profile.legal_name;
      buyerLogo = profile.legal_name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
    }
  } catch (e) {
    console.error('Error fetching buyer profile:', e);
  }

  const results = [];
  for (const quoteId of quoteIds) {
    // Update Quote status to order_placed
    await supabase.from('sample_quotes').update({ status: 'order_placed' }).eq('id', quoteId);

    // Fetch Quote data
    const { data: quote } = await supabase.from('sample_quotes').select('*').eq('id', quoteId).single();
    if (!quote) continue;

    const sampleOrderId = `SO-${Date.now().toString(36).toUpperCase()}-${quoteId.slice(-4)}`;
    const { error: sampleErr } = await supabase.from('sample_orders').insert({
      id: sampleOrderId,
      sample_rfq_id: quote.sample_rfq_id,
      sample_quote_id: quote.id,
      parent_rfq_id: rfqId,
      product: rfq.product,
      buyer: buyerName,
      supplier: quote.supplier_name || 'Verified Supplier',
      supplier_id: quote.supplier_id,
      quantity: `${quote.sample_qty || 1} samples`,
      status: 'confirmed'
    });
    if (sampleErr) throw sampleErr;

    // Notify admin
    await supabase.from('notifications').insert({
      target_dashboard: 'admin',
      type: 'sample_order_placed',
      title: `Sample Order Placed: ${rfq.product}`,
      message: `${buyerName} placed sample order ${sampleOrderId} with ${quote.supplier_name}.`,
      action_url: `/sample-management`,
      read: false
    });

    // Notify supplier
    await supabase.from('notifications').insert({
      target_dashboard: 'supplier',
      type: 'sample_order_placed',
      title: `Your Sample Quote Accepted`,
      message: `Buyer accepted your quote for ${rfq.product}! Order ${sampleOrderId} is confirmed.`,
      read: false
    });

    results.push(sampleOrderId);
  }

  // Update RFQ status to converted or sample_quoted
  await supabase.from('rfqs').update({ status: 'converted' }).eq('id', rfqId).eq('buyer_id', userId);

  return results;
}

export async function fetchSampleStages(sampleOrderId: string) {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('sample_stages')
    .select('*')
    .eq('sample_order_id', sampleOrderId)
    .order('updated_at', { ascending: true });
  if (error) {
    console.error('fetchSampleStages error:', error);
    return [];
  }
  return data || [];
}

export async function fetchSampleDocuments(sampleOrderId: string) {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('sample_documents')
    .select('*')
    .eq('sample_order_id', sampleOrderId)
    .order('uploaded_at', { ascending: true });
  if (error) {
    console.error('fetchSampleDocuments error:', error);
    return [];
  }
  return data || [];
}

// ─────────────────────────────────────────────────────────────
// BUYER LIVE CHAT FUNCTIONS
// ─────────────────────────────────────────────────────────────

export async function fetchOrCreateBuyerConversation() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');
  const userId = await requireUserId();

  // Try to fetch existing
  const { data: existing, error: fetchErr } = await supabase
    .from('buyer_conversations')
    .select('*')
    .eq('buyer_id', userId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (existing) return existing;

  // Otherwise, create one. Let's find organization_name from profiles
  const { data: profile } = await supabase
    .from('buyer_profiles')
    .select('organization_name, legal_name')
    .eq('id', userId)
    .maybeSingle();

  const { data: { user } } = await supabase.auth.getUser();
  const emailName = user?.email?.split('@')[0] || 'Enterprise Buyer';
  const orgName = profile?.organization_name || profile?.legal_name || emailName;

  const avatar = orgName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const { data: newConv, error: createErr } = await supabase
    .from('buyer_conversations')
    .insert({
      buyer_id: userId,
      buyer_name: orgName,
      buyer_avatar: avatar,
      last_message: 'Conversation started',
      last_message_at: new Date().toISOString(),
      unread_admin: 0,
      unread_buyer: 0,
      online: true
    })
    .select('*')
    .single();

  if (createErr) throw createErr;
  return newConv;
}

export async function fetchBuyerChatMessages(conversationId: string) {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('buyer_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true });
  if (error) {
    console.error('fetchBuyerChatMessages:', error);
    return [];
  }
  return data || [];
}

export async function sendBuyerChatMessage(conversationId: string, text: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');

  const { error: msgErr } = await supabase.from('buyer_messages').insert({
    conversation_id: conversationId,
    from_admin: false,
    text: text,
    sent_at: new Date().toISOString()
  });
  if (msgErr) throw msgErr;

  // Query existing unread_admin first to increment it
  const { data: conv } = await supabase
    .from('buyer_conversations')
    .select('unread_admin, buyer_name')
    .eq('id', conversationId)
    .single();

  const nextUnreadAdmin = (conv?.unread_admin || 0) + 1;

  const { error: convErr } = await supabase
    .from('buyer_conversations')
    .update({
      last_message: text,
      last_message_at: new Date().toISOString(),
      unread_admin: nextUnreadAdmin
    })
    .eq('id', conversationId);
  if (convErr) throw convErr;

  // Notify admin
  try {
    const fromName = conv?.buyer_name || 'Buyer';
    await supabase.from('notifications').insert({
      target_dashboard: 'admin',
      type: 'message_received',
      title: `New Message from ${fromName}`,
      message: text.slice(0, 100),
      action_url: '/communications',
      read: false
    });
  } catch (notifErr) {
    console.error('Failed to create admin notification:', notifErr);
  }
}

export async function markBuyerChatRead(conversationId: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from('buyer_conversations')
    .update({ unread_buyer: 0 })
    .eq('id', conversationId);
  if (error) console.error('markBuyerChatRead:', error);
}

