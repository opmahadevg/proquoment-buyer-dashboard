// Buyer Dashboard — Shared Procurement API Layer
// Connects to the shared Supabase instance (Admin's DB: apmwmncqmhjacwrmnfms)
import { createClient } from '@/lib/supabase/client';

function getSupabase() {
  return createClient();
}

// ── Fetchers ──────────────────────────────────────────

export async function fetchBuyerRFQs() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('rfqs').select('*').order('created_at', { ascending: false });
  if (error) { console.error('fetchBuyerRFQs:', error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id, product: r.product, buyer: r.buyer, qty: r.qty,
    value: r.value, status: r.status, date: r.date,
    assignedSupplier: r.assigned_supplier, deadline: r.deadline,
    targetPrice: r.target_price, specs: r.specs, createdAt: r.created_at,
  }));
}

export async function fetchBuyerQuotes() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('quotes').select('*')
    .in('status', ['sent', 'accepted', 'rejected']).order('created_at', { ascending: false });
  if (error) { console.error('fetchBuyerQuotes:', error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id, rfqId: r.rfq_id, orderId: r.order_id, supplierId: r.supplier_id,
    supplierUnitPrice: r.supplier_unit_price, qty: r.qty,
    qcFee: r.qc_fee, docFee: r.doc_fee, freightCost: r.freight_cost,
    insurance: r.insurance, marginPct: r.margin_pct,
    landedCostPerUnit: r.landed_cost_per_unit, totalValue: r.total_value,
    validityDays: r.validity_days, status: r.status,
    sentAt: r.sent_at, createdAt: r.created_at,
  }));
}

export async function fetchBuyerOrders() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) { console.error('fetchBuyerOrders:', error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id, product: r.product, buyer: r.buyer, supplier: r.supplier,
    supplierCity: r.supplier_city, value: r.value, stage: r.stage,
    progress: r.progress, days: r.days, eta: r.eta,
    priority: r.priority, createdAt: r.created_at,
  }));
}

export async function fetchBuyerQCReports() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('qc_reports').select('*').order('uploaded_at', { ascending: false });
  if (error) { console.error('fetchBuyerQCReports:', error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id, orderId: r.order_id, qcInspectionId: r.qc_inspection_id,
    reportUrl: r.report_url, result: r.result, notes: r.notes,
    photos: r.photos, uploadedAt: r.uploaded_at,
  }));
}

export async function fetchBuyerShipments() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('shipments').select('*').order('created_at', { ascending: false });
  if (error) { console.error('fetchBuyerShipments:', error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id, orderId: r.order_id, forwarder: r.forwarder,
    pol: r.pol, pod: r.pod, incoterms: r.incoterms,
    bookingRef: r.booking_ref, containerNo: r.container_no,
    vesselName: r.vessel_name, departureDate: r.departure_date,
    eta: r.eta, customsStatus: r.customs_status,
    deliveryConfirmed: r.delivery_confirmed, createdAt: r.created_at,
  }));
}

export async function fetchBuyerInvoices() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
  if (error) { console.error('fetchBuyerInvoices:', error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id, orderId: r.order_id, amount: r.amount, currency: r.currency,
    status: r.status, dueDate: r.due_date, paidAt: r.paid_at,
    paymentRef: r.payment_ref, createdAt: r.created_at,
  }));
}

export async function fetchBuyerNotifications() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('notifications').select('*')
    .eq('target_dashboard', 'buyer').order('created_at', { ascending: false }).limit(30);
  if (error) { console.error('fetchBuyerNotifications:', error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id, targetDashboard: r.target_dashboard, orderId: r.order_id,
    type: r.type, title: r.title, message: r.message,
    read: r.read ?? false, actionUrl: r.action_url, createdAt: r.created_at,
  }));
}

export async function fetchBuyerDocuments() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
  if (error) { console.error('fetchBuyerDocuments:', error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id, orderId: r.order_id, name: r.name, type: r.type,
    preparedBy: r.prepared_by, status: r.status,
    uploadedAt: r.uploaded_at, url: r.url,
  }));
}

// ── Write Operations ──────────────────────────────────

export async function submitRFQ(rfq: {
  product: string; qty: string; value: string; targetPrice?: string;
  specs?: string; deadline?: string; buyer: string;
}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');
  const id = `RFQ-${Date.now().toString(36).toUpperCase()}`;
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Only insert columns that exist in the rfqs table schema:
  // id, product, buyer, date, qty, status, value, created_at (auto)
  const { error } = await supabase.from('rfqs').insert({
    id,
    product: rfq.product,
    buyer: rfq.buyer || 'Enterprise Buyer',
    qty: rfq.qty,
    value: rfq.value || 'TBD',
    status: 'new',
    date: dateStr,
  });
  if (error) throw error;

  // Build a descriptive notification message that captures all the extra fields
  const extras = [
    rfq.specs && `Specs: ${rfq.specs}`,
    rfq.targetPrice && `Target: ${rfq.targetPrice}`,
    rfq.deadline && `Deadline: ${rfq.deadline}`,
  ].filter(Boolean).join(' | ');

  // Notify admin
  await supabase.from('notifications').insert({
    target_dashboard: 'admin', type: 'new_rfq', title: `New RFQ: ${rfq.product}`,
    message: `${rfq.buyer || 'Buyer'} submitted RFQ for ${rfq.qty} of ${rfq.product} (${rfq.value || 'TBD'})${extras ? '. ' + extras : ''}`,
    action_url: `/rfq/${id}`,
  }).catch(() => {}); // Notification failure should not block RFQ creation

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
}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');

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
  });

  if (error) throw error;
  return id;
}

export async function acceptQuote(quoteId: string, rfqId: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');

  // Update Quote status
  const { error } = await supabase.from('quotes').update({ status: 'accepted' }).eq('id', quoteId);
  if (error) throw error;

  // Update RFQ status
  await supabase.from('rfqs').update({ status: 'accepted' }).eq('id', rfqId);

  // Fetch Quote data
  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
  // Fetch RFQ data
  const { data: rfq } = await supabase.from('rfqs').select('*').eq('id', rfqId).single();

  const product = rfq?.product || 'Custom Product Order';
  const buyer = rfq?.buyer || 'Enterprise Buyer';
  const supplier = rfq?.assigned_supplier || quote?.supplier_id || 'Premium Supplier';
  const contractValue = quote?.total_value || parseFloat(String(rfq?.value || '0').replace(/[$,]/g, '')) || 0;
  const totalValue = quote?.total_value ? `$${quote.total_value.toLocaleString()}` : rfq?.value || '$0';

  // Automatically insert Order into database
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
    target_dashboard: 'admin', type: 'quote_rejected', title: `Quote ${quoteId} Rejected`,
    message: `Buyer rejected quote linked to ${rfqId}`,
  });
}

export async function confirmDelivery(shipmentId: string, orderId: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');
  await supabase.from('shipments').update({ delivery_confirmed: true }).eq('id', shipmentId);
  await supabase.from('orders').update({ stage: 'delivered' }).eq('id', orderId);
  await supabase.from('notifications').insert({
    target_dashboard: 'admin', order_id: orderId, type: 'stage_update',
    title: `Delivery Confirmed: ${orderId}`,
    message: 'Buyer confirmed receipt of goods',
  });
}

export async function markNotificationRead(id: number) {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function createNotification(params: {
  targetDashboard: 'admin' | 'buyer' | 'supplier';
  type: string;
  title: string;
  message: string;
  orderId?: string;
  actionUrl?: string;
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
    read: false,
  });
  if (error) throw error;
}

export async function fetchBuyerMilestones() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from('milestones').select('*').order('created_at', { ascending: true });
  if (error) { console.error('fetchBuyerMilestones:', error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id, orderId: r.order_id, title: r.title,
    description: r.description, status: r.status, targetDate: r.target_date,
    completedAt: r.completed_at, updatedBy: r.updated_by, createdAt: r.created_at,
  }));
}

export async function fetchCurrentBuyerProfile() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('buyer_profiles')
    .select('*')
    .eq('id', user.id)
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('buyer_profiles')
    .upsert({
      id: user.id,
      ...profile,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}

export async function fetchBuyerMessages() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or('to_name.eq.Buyer,from_name.eq.Admin,type.eq.buyer')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { console.error('fetchBuyerMessages:', error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id, orderId: r.order_id,
    from: r.from_name, to: r.to_name,
    subject: r.subject, text: r.text,
    time: r.time, type: r.type,
    read: r.read ?? false, createdAt: r.created_at,
  }));
}

export async function sendBuyerMessage(msg: {
  orderId?: string; subject: string; text: string;
}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('No Supabase client');
  const { data: { user } } = await supabase.auth.getUser();
  const fromName = user?.email?.split('@')[0] || 'Enterprise Buyer';

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

  await supabase.from('notifications').insert({
    target_dashboard: 'admin',
    order_id: msg.orderId,
    type: 'message_received',
    title: `New Message from ${fromName}`,
    message: msg.text.slice(0, 100),
    action_url: '/communications',
    read: false,
  }).catch(() => {});
}

export async function markBuyerMessageRead(messageId: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('messages').update({ read: true }).eq('id', messageId);
}
