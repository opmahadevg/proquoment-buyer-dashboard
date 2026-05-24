'use client';

import { createClient } from '@/lib/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DbProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  moq: string;
  image: string;
  imageAlt: string;
  stage: 'Draft' | 'Quoting' | 'Sampling' | 'Production' | 'Completed';
  status: 'New Update' | 'Action Required' | 'No Updates';
  updated: string;
  ownerId: string;
  organizationId: string | null;
  isStatic: boolean;
}

export interface DbRfqSpec {
  id: string;
  productId: string;
  specifications: { label: string; value: string; pending?: boolean }[];
  manufacturingNotes: { label: string; value: string; pending?: boolean }[];
}

export interface DbQuoteStep {
  id: string;
  productId: string;
  stepOrder: number;
  label: string;
  highlight: string | null;
  highlightSuffix: string | null;
  description: string;
  stepStatus: 'completed' | 'active' | 'pending';
  inProgress: boolean;
  supplierCount: number;
  totalSuppliers: number;
}

export interface DbOrder {
  id: string;
  productId: string;
  orderNumber: string;
  description: string;
  orderStatus: string;
  statusColor: string;
  supplier: string;
  placedDate: string;
  estimatedDelivery: string;
  amount: string;
  steps: { id: string; label: string; done: boolean }[];
}

export interface DbSample {
  id: string;
  productId: string;
  image: string;
  imageAlt: string;
  name: string;
  sampleType: string;
  supplier: string;
  stage: string;
  requested: string;
  completion: string;
  isReference: boolean;
  creator: string;
}

export interface DbProductFile {
  id: string;
  productId: string;
  name: string;
  fileDate: string;
  fileUrl: string;
}

export interface DbProductUpdate {
  id: string;
  productId: string;
  updateType: 'Action' | 'Info';
  title: string;
  description: string;
  updateDate: string;
  supplier: string;
  replies: number;
  isTask: boolean;
}

export interface DbActivityItem {
  id: string;
  activityType: string;
  title: string;
  description: string;
  productId: string | null;
  createdAt: string;
}

export interface DbOrganization {
  id: string;
  name: string;
  legalName: string;
  orgType: string;
  industry: string;
  founded: string;
  registrationNumber: string;
  taxId: string;
  website: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  teamSize: string;
  description: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isProductMatch(
  prodName1: string | null | undefined,
  prodName2: string | null | undefined
): boolean {
  if (!prodName1 || !prodName2) return false;

  const n1 = prodName1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const n2 = prodName2.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Word-based matching for fuzzy correlation
  const getWords = (s: string) =>
    s
      .toLowerCase()
      .split(/[\s\-—–,().]+/)
      .filter(
        (w) => w.length > 2 && !['and', 'for', 'set', 'bulk', 'pcs', 'pieces', 'grade'].includes(w)
      );

  const w1 = getWords(prodName1);
  const w2 = getWords(prodName2);

  const intersection = w1.filter((w) => w2.includes(w));
  if (intersection.length >= 2) return true;
  if (intersection.length >= 1 && (w1.length === 1 || w2.length === 1)) return true;

  // Fallback special hardcoded matches for the database demo data
  const normalizedMatches: Record<string, string[]> = {
    steelpipes: ['steelpipesgradea', 'steelpipesgradea'],
    gatevalves: ['gatevalvesdn50dn200', 'gatevalvesdn50', 'industrialvalvesdn50'],
    hydraulicfittings: ['hydraulicfittingsset', 'hydraulicfittingsassortment', 'hydraulicfittings'],
    stainlesssteelflanges: ['stainlesssteelflanges316l', 'stainlesssteelflanges', 'ssflanges316l'],
    butterflyvalves: ['butterflyvalvespn10'],
    hdpepipes: ['hdpepipessdr11', 'hdpepipesforwatersupply'],
    blackpuffedjackets: ['blackpuffedjackets'],
    cottonacblankets: ['cottonacblanketsbulkpack2000pieces'],
    kingsizeplainwhitecottonbedsheets: ['kingsizeplainwhitecottonbedsheets'],
    organiccottontotebags: ['organiccottontotebags500pcs'],
    greencardamoms: ['greencardamoms6mmbulk2tonnes'],
  };

  const key1 = Object.keys(normalizedMatches).find((k) => n1.includes(k));
  const key2 = Object.keys(normalizedMatches).find((k) => n2.includes(k));
  if (key1 && key2 && key1 === key2) return true;

  return false;
}

function getOrderSteps(
  stage: string | null | undefined
): { id: string; label: string; done: boolean }[] {
  const stepsDef = [
    {
      label: 'PO Issued',
      stages: [
        'po_issued',
        'bulk_order',
        'production',
        'qc_inspection',
        'freight_booking',
        'freight',
        'customs_clearance',
        'delivered',
        'closed',
      ],
    },
    {
      label: 'Production',
      stages: [
        'production',
        'qc_inspection',
        'freight_booking',
        'freight',
        'customs_clearance',
        'delivered',
        'closed',
      ],
    },
    {
      label: 'Quality Check',
      stages: [
        'qc_inspection',
        'freight_booking',
        'freight',
        'customs_clearance',
        'delivered',
        'closed',
      ],
    },
    {
      label: 'Shipped',
      stages: ['freight_booking', 'freight', 'customs_clearance', 'delivered', 'closed'],
    },
    { label: 'Delivered', stages: ['delivered', 'closed'] },
  ];

  const stageLower = stage ? stage.toLowerCase() : '';
  return stepsDef.map((step, idx) => ({
    id: `step-${idx + 1}`,
    label: step.label,
    done: step.stages.includes(stageLower),
  }));
}

function getOrderStatusDetails(stage: string | null | undefined): {
  status: string;
  color: string;
} {
  const s = stage ? stage.toLowerCase() : '';
  switch (s) {
    case 'po_issued':
    case 'bulk_order':
      return { status: 'PO Issued', color: 'text-amber-600 bg-amber-50' };
    case 'production':
      return { status: 'In Production', color: 'text-amber-600 bg-amber-50' };
    case 'qc_inspection':
      return { status: 'Quality Check', color: 'text-blue-600 bg-blue-50' };
    case 'freight_booking':
    case 'freight':
    case 'customs_clearance':
      return { status: 'Shipped', color: 'text-green-600 bg-green-50' };
    case 'delivered':
    case 'closed':
      return { status: 'Delivered', color: 'text-gray-600 bg-gray-100' };
    default:
      return { status: stage || 'Pending', color: 'text-gray-600 bg-gray-100' };
  }
}

function getProductImage(name: string, imageUrl: string | null): string {
  if (imageUrl) return imageUrl;
  const n = name.toLowerCase();
  if (n.includes('pipe')) {
    return 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122';
  }
  if (n.includes('valve')) {
    return 'https://images.unsplash.com/photo-1581092160607-ee22621dd758';
  }
  if (n.includes('fitting')) {
    return 'https://images.unsplash.com/photo-1618090584176-7132b9911657';
  }
  if (n.includes('flange')) {
    return 'https://images.unsplash.com/photo-1535813547-99c456a41d4a';
  }
  return 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d';
}

function parseSpecs(
  specsStr: string | null | undefined
): { label: string; value: string; pending?: boolean }[] {
  if (!specsStr) return [];
  try {
    const parsed = JSON.parse(specsStr);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        label: item.label || item.name || 'Specification',
        value: item.value || String(item),
        pending: item.pending ?? false,
      }));
    }
    if (typeof parsed === 'object') {
      return Object.entries(parsed).map(([key, val]) => ({
        label: key,
        value: String(val),
        pending: false,
      }));
    }
  } catch (e) {
    // Not JSON
  }

  return specsStr.split(',').map((part, index) => {
    const trimmed = part.trim();
    if (trimmed.includes(':')) {
      const colIdx = trimmed.indexOf(':');
      return {
        label: trimmed.substring(0, colIdx).trim(),
        value: trimmed.substring(colIdx + 1).trim(),
        pending: false,
      };
    }
    return {
      label: `Spec ${index + 1}`,
      value: trimmed,
      pending: false,
    };
  });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function isSchemaError(error: any): boolean {
  if (!error) return false;
  if (error.code && typeof error.code === 'string') {
    const cls = error.code.substring(0, 2);
    if (cls === '42' || cls === '08') return true;
    if (cls === '23') return false;
  }
  if (error.message) {
    return /relation.*does not exist|column.*does not exist|function.*does not exist|syntax error|type.*does not exist/i.test(
      error.message
    );
  }
  return false;
}

// ── Products ───────────────────────────────────────────────────────────────

export const productService = {
  async getAll(): Promise<DbProduct[]> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Unauthenticated: return nothing (middleware redirects to login anyway)
    if (!user) return [];

    try {
      // Fetch only THIS buyer's products (buyer_id scoping + RLS as backup)
      const { data: productsData, error } = await supabase
        .from('products')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }

      // Fetch related data scoped to this buyer via RLS
      const [ordersRes, samplesRes, rfqsRes, notificationsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('buyer_id', user.id),
        supabase.from('sample_orders').select('*').eq('buyer_id', user.id),
        supabase.from('rfqs').select('*').eq('buyer_id', user.id),
        supabase
          .from('notifications')
          .select('*')
          .eq('buyer_id', user.id)
          .eq('target_dashboard', 'buyer'),
      ]);

      return (productsData || []).map((row) => {
        const matchedOrders =
          ordersRes.data?.filter((o) => isProductMatch(o.product, row.name)) || [];
        const matchedSamples =
          samplesRes.data?.filter((s) => isProductMatch(s.product, row.name)) || [];
        const matchedRfqs = rfqsRes.data?.filter((r) => isProductMatch(r.product, row.name)) || [];

        // Determine Stage
        let stage: DbProduct['stage'] = 'Draft';
        if (matchedOrders.some((o) => ['delivered', 'closed'].includes(o.stage?.toLowerCase()))) {
          stage = 'Completed';
        } else if (
          matchedOrders.some((o) =>
            [
              'production',
              'qc_inspection',
              'freight_booking',
              'freight',
              'customs_clearance',
              'bulk_order',
              'po_issued',
            ].includes(o.stage?.toLowerCase())
          )
        ) {
          stage = 'Production';
        } else if (
          matchedOrders.some((o) => o.stage?.toLowerCase() === 'sample_approval') ||
          matchedSamples.length > 0
        ) {
          stage = 'Sampling';
        } else if (matchedRfqs.some((r) => r.status?.toLowerCase() === 'converted')) {
          stage = 'Sampling';
        } else if (matchedRfqs.length > 0) {
          stage = 'Quoting';
        }

        // Determine Status
        let status: DbProduct['status'] = 'No Updates';
        const matchedNotification =
          notificationsRes.data?.filter((n) => {
            const isLinkedToOrder = matchedOrders.some((o) => o.id === n.order_id);
            const isLinkedToRfq = matchedRfqs.some((r) => r.id === n.order_id);
            const mentionsProduct =
              n.message?.toLowerCase().includes(row.name.toLowerCase()) ||
              n.title?.toLowerCase().includes(row.name.toLowerCase());
            return isLinkedToOrder || isLinkedToRfq || mentionsProduct;
          }) || [];

        const unread = matchedNotification.filter((n) => !n.read);
        if (unread.length > 0) {
          const hasAction = unread.some(
            (n) =>
              n.title?.toLowerCase().includes('action') ||
              n.title?.toLowerCase().includes('hold') ||
              n.title?.toLowerCase().includes('alert') ||
              n.title?.toLowerCase().includes('urgently') ||
              n.message?.toLowerCase().includes('required') ||
              n.message?.toLowerCase().includes('urgent')
          );
          status = hasAction ? 'Action Required' : 'New Update';
        }

        return {
          id: row.id,
          name: row.name,
          category: row.category || '',
          description: row.description || '',
          moq: row.moq || '',
          image: getProductImage(row.name, row.image_url),
          imageAlt: `${row.name} product image`,
          stage,
          status,
          updated: formatDate(row.created_at),
          ownerId: user.id,
          organizationId: null,
          isStatic: false,
        };
      });
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return [];
    }
  },

  async getById(id: string): Promise<DbProduct | null> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      // Fetch product scoped to this buyer
      const { data: productRow, error: productErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('buyer_id', user.id)
        .maybeSingle();

      if (productErr && isSchemaError(productErr)) throw productErr;
      if (!productRow) return null;

      const [ordersRes, samplesRes, rfqsRes, notificationsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('buyer_id', user.id),
        supabase.from('sample_orders').select('*').eq('buyer_id', user.id),
        supabase.from('rfqs').select('*').eq('buyer_id', user.id),
        supabase
          .from('notifications')
          .select('*')
          .eq('buyer_id', user.id)
          .eq('target_dashboard', 'buyer'),
      ]);

      const matchedOrders =
        ordersRes.data?.filter((o) => isProductMatch(o.product, productRow.name)) || [];
      const matchedSamples =
        samplesRes.data?.filter((s) => isProductMatch(s.product, productRow.name)) || [];
      const matchedRfqs =
        rfqsRes.data?.filter((r) => isProductMatch(r.product, productRow.name)) || [];

      // Determine Stage
      let stage: DbProduct['stage'] = 'Draft';
      if (matchedOrders.some((o) => ['delivered', 'closed'].includes(o.stage?.toLowerCase()))) {
        stage = 'Completed';
      } else if (
        matchedOrders.some((o) =>
          [
            'production',
            'qc_inspection',
            'freight_booking',
            'freight',
            'customs_clearance',
            'bulk_order',
            'po_issued',
          ].includes(o.stage?.toLowerCase())
        )
      ) {
        stage = 'Production';
      } else if (
        matchedOrders.some((o) => o.stage?.toLowerCase() === 'sample_approval') ||
        matchedSamples.length > 0
      ) {
        stage = 'Sampling';
      } else if (matchedRfqs.some((r) => r.status?.toLowerCase() === 'converted')) {
        stage = 'Sampling';
      } else if (matchedRfqs.length > 0) {
        stage = 'Quoting';
      }

      // Determine Status
      let status: DbProduct['status'] = 'No Updates';
      const matchedNotification =
        notificationsRes.data?.filter((n) => {
          const isLinkedToOrder = matchedOrders.some((o) => o.id === n.order_id);
          const isLinkedToRfq = matchedRfqs.some((r) => r.id === n.order_id);
          const mentionsProduct =
            n.message?.toLowerCase().includes(productRow.name.toLowerCase()) ||
            n.title?.toLowerCase().includes(productRow.name.toLowerCase());
          return isLinkedToOrder || isLinkedToRfq || mentionsProduct;
        }) || [];

      const unread = matchedNotification.filter((n) => !n.read);
      if (unread.length > 0) {
        const hasAction = unread.some(
          (n) =>
            n.title?.toLowerCase().includes('action') ||
            n.title?.toLowerCase().includes('hold') ||
            n.title?.toLowerCase().includes('alert') ||
            n.title?.toLowerCase().includes('urgently') ||
            n.message?.toLowerCase().includes('required') ||
            n.message?.toLowerCase().includes('urgent')
        );
        status = hasAction ? 'Action Required' : 'New Update';
      }

      return {
        id: productRow.id,
        name: productRow.name,
        category: productRow.category || '',
        description: productRow.description || '',
        moq: productRow.moq || '',
        image: getProductImage(productRow.name, productRow.image_url),
        imageAlt: `${productRow.name} product image`,
        stage,
        status,
        updated: formatDate(productRow.created_at),
        ownerId: user.id,
        organizationId: null,
        isStatic: false,
      };
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return null;
    }
  },

  async save(product: Omit<DbProduct, 'ownerId' | 'organizationId' | 'isStatic'>): Promise<void> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    try {
      const { error } = await supabase.from('products').upsert(
        {
          id: product.id,
          name: product.name,
          category: product.category,
          description: product.description,
          moq: product.moq,
          image_url: product.image,
          buyer_id: user.id, // Always stamp buyer_id on write
          is_demo: false,
        },
        { onConflict: 'id' }
      );

      if (error) {
        if (isSchemaError(error)) throw error;
      }
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
    }
  },
};

// ── RFQ Specs ──────────────────────────────────────────────────────────────

export const rfqService = {
  async getByProductId(productId: string): Promise<DbRfqSpec | null> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      const product = await productService.getById(productId);
      if (!product) return null;

      const { data, error } = await supabase.from('rfqs').select('*').eq('buyer_id', user.id).order('created_at', { ascending: false }); // Scoped to buyer

      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }

      const matched = data?.find(
        (row) => isProductMatch(row.product, product.name) && row.route_decision !== 'pending'
      ) || data?.find((row) => isProductMatch(row.product, product.name));
      if (!matched) return null;

      return {
        id: matched.id,
        productId,
        specifications: parseSpecs(matched.specs),
        manufacturingNotes: matched.description
          ? [{ label: 'Additional Requirements', value: matched.description, pending: false }]
          : [],
      };
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return null;
    }
  },

  async save(
    productId: string,
    specs: DbRfqSpec['specifications'],
    notes: DbRfqSpec['manufacturingNotes']
  ): Promise<void> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const product = await productService.getById(productId);
      if (!product) return;

      const { data } = await supabase.from('rfqs').select('*').eq('buyer_id', user.id).order('created_at', { ascending: false }); // Scoped to buyer

      const matched = data?.find(
        (row) => isProductMatch(row.product, product.name) && row.route_decision !== 'pending'
      ) || data?.find((row) => isProductMatch(row.product, product.name));
      if (matched) {
        const specsStr = JSON.stringify(specs);
        const descriptionStr = notes.map((n) => `${n.label}: ${n.value}`).join('\n');
        const { error } = await supabase
          .from('rfqs')
          .update({ specs: specsStr, description: descriptionStr })
          .eq('id', matched.id)
          .eq('buyer_id', user.id); // Scoped update
        if (error && isSchemaError(error)) throw error;
      }
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
    }
  },
};

// ── Quote Steps ────────────────────────────────────────────────────────────

export const quoteService = {
  async getByProductId(productId: string): Promise<DbQuoteStep[]> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const product = await productService.getById(productId);
      if (!product) return [];

      const { data: rfqs, error: rfqErr } = await supabase
        .from('rfqs')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false }); // Scoped to buyer
      if (rfqErr && isSchemaError(rfqErr)) throw rfqErr;

      const matchedRfq = rfqs?.find(
        (r) => isProductMatch(r.product, product.name) && r.route_decision !== 'pending'
      ) || rfqs?.find((r) => isProductMatch(r.product, product.name));
      if (!matchedRfq) return [];

      const { data: quotes, error: quoteErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('rfq_id', matchedRfq.id);
      if (quoteErr && isSchemaError(quoteErr)) throw quoteErr;

      const bidsCount = quotes?.length || matchedRfq.bids_received || 0;
      const status = matchedRfq.status?.toLowerCase() || 'new';

      const step1Status = 'completed';
      const step2Status = ['new'].includes(status) ? 'active' : 'completed';
      const step3Status = ['new', 'assigned'].includes(status)
        ? 'pending'
        : status === 'quoted'
          ? 'active'
          : 'completed';
      const step4Status = ['new', 'assigned', 'quoted'].includes(status)
        ? bidsCount > 0
          ? 'active'
          : 'pending'
        : 'completed';

      return [
        {
          id: 'quote-step-1',
          productId,
          stepOrder: 1,
          label: 'Identified matches',
          highlight: 'Verified matches',
          highlightSuffix: ' in our network',
          description:
            'We search for suppliers that match your exact product requirement and location.',
          stepStatus: step1Status as any,
          inProgress: false,
          supplierCount: bidsCount,
          totalSuppliers: 150,
        },
        {
          id: 'quote-step-2',
          productId,
          stepOrder: 2,
          label: 'Reaching out to suppliers',
          highlight: bidsCount > 0 ? `${bidsCount} suppliers interested` : null,
          highlightSuffix: '',
          description:
            'We share your product info with matched suppliers to understand their interest.',
          stepStatus: step2Status as any,
          inProgress: step2Status === 'active',
          supplierCount: bidsCount,
          totalSuppliers: 150,
        },
        {
          id: 'quote-step-3',
          productId,
          stepOrder: 3,
          label: 'Engage suppliers',
          highlight: null,
          highlightSuffix: null,
          description:
            'We communicate with interested suppliers to verify their terms to prep for quotes.',
          stepStatus: step3Status as any,
          inProgress: step3Status === 'active',
          supplierCount: bidsCount,
          totalSuppliers: 150,
        },
        {
          id: 'quote-step-4',
          productId,
          stepOrder: 4,
          label: 'Receive quotes',
          highlight: bidsCount > 0 ? `${bidsCount} quote(s)` : null,
          highlightSuffix: bidsCount > 0 ? ' received' : '',
          description:
            bidsCount > 0
              ? `Review the received quote details.`
              : 'Supplier quotes will appear here once received.',
          stepStatus: step4Status as any,
          inProgress: step4Status === 'active',
          supplierCount: bidsCount,
          totalSuppliers: 150,
        },
      ];
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return [];
    }
  },
};

// ── Orders ─────────────────────────────────────────────────────────────────

export const orderService = {
  async getByProductId(productId: string): Promise<DbOrder[]> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const product = await productService.getById(productId);
      if (!product) return [];

      const { data, error } = await supabase.from('orders').select('*').eq('buyer_id', user.id); // Scoped to buyer

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }

      const matched = data?.filter((row) => isProductMatch(row.product, product.name)) || [];

      return matched.map((row) => {
        const details = getOrderStatusDetails(row.stage);
        return {
          id: row.id,
          productId,
          orderNumber: row.id,
          description: `Contract Value: ${row.value || 'TBD'}`,
          orderStatus: details.status,
          statusColor: details.color,
          supplier: row.supplier_id ? `Supplier #${row.supplier_id}` : 'Verified Supplier',
          placedDate: formatDate(row.created_at),
          estimatedDelivery: row.days ? `In ${row.days} days` : 'TBD',
          amount: row.value || 'TBD',
          steps: getOrderSteps(row.stage),
        };
      });
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return [];
    }
  },
};

export const sampleService = {
  async getByProductId(
    productId: string
  ): Promise<{ samples: DbSample[]; references: DbSample[]; receivedQuotes: any[] }> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { samples: [], references: [], receivedQuotes: [] };

    try {
      const product = await productService.getById(productId);
      if (!product) return { samples: [], references: [], receivedQuotes: [] };

      // Fetch sample orders scoped to this buyer and product name
      const { data: sampleOrdersData, error: ordersErr } = await supabase
        .from('sample_orders')
        .select('*')
        .eq('buyer_id', user.id);

      if (ordersErr && isSchemaError(ordersErr)) throw ordersErr;

      const matchedOrders = sampleOrdersData?.filter((row) => isProductMatch(row.product, product.name)) || [];

      const mappedSamples: DbSample[] = matchedOrders.map((row) => ({
        id: row.id,
        productId,
        image: getProductImage(product.name, null),
        imageAlt: `${row.product} Sample`,
        name: `${row.product} Sample`,
        sampleType: 'Pre-Production',
        supplier: row.supplier_id ? `Supplier #${row.supplier_id}` : 'Verified Supplier',
        stage: row.status || 'Pending',
        requested: formatDate(row.created_at),
        completion: row.status === 'completed' || row.status === 'delivered' ? formatDate(row.updated_at) : 'Pending',
        isReference: false,
        creator: 'Buyer',
      }));

      // Fetch parent RFQ for this product
      const { data: rfqs, error: rfqErr } = await supabase
        .from('rfqs')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });
      if (rfqErr && isSchemaError(rfqErr)) throw rfqErr;

      const matchedRfq = rfqs?.find(
        (r) => isProductMatch(r.product, product.name) && (r.route_decision === 'sample' || r.sample_rfq_id)
      ) || rfqs?.find((r) => isProductMatch(r.product, product.name));
      let receivedQuotes: any[] = [];

      if (matchedRfq) {
        // Fetch matching sample RFQs created by admin
        const { data: sampleRfqs, error: sRfqErr } = await supabase
          .from('sample_rfqs')
          .select('*')
          .eq('parent_rfq_id', matchedRfq.id);
        
        if (sRfqErr && isSchemaError(sRfqErr)) throw sRfqErr;

        const sampleRfqIds = sampleRfqs?.map((s) => s.id) || [];
        if (sampleRfqIds.length > 0) {
          const { data: quotes, error: quoteErr } = await supabase
            .from('sample_quotes')
            .select('*')
            .in('sample_rfq_id', sampleRfqIds)
            .eq('is_forwarded', true);

          if (quoteErr && isSchemaError(quoteErr)) throw quoteErr;

          receivedQuotes = (quotes || []).map((q) => ({
            id: q.id,
            rfqId: q.sample_rfq_id,
            supplierName: q.supplier_name,
            supplierId: q.supplier_id,
            unitPrice: q.unit_price,
            moq: q.sample_qty || 1,
            leadTimeDays: q.lead_time_days || 7,
            paymentTerms: q.payment_terms || 'Net 30',
            notes: q.notes,
            validUntil: q.valid_until,
            status: q.status,
          }));
        }
      }

      return {
        samples: mappedSamples,
        references: [],
        receivedQuotes,
      };
    } catch (err: any) {
      console.error('Error in sampleService.getByProductId:', err);
      if (isSchemaError(err)) throw err;
      return { samples: [], references: [], receivedQuotes: [] };
    }
  },
};

// ── Product Files ──────────────────────────────────────────────────────────

export const fileService = {
  async getByProductId(productId: string): Promise<DbProductFile[]> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const product = await productService.getById(productId);
      if (!product) return [];

      // Fetch only this buyer's orders (RLS enforces buyer_id already)
      const { data: orders, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('buyer_id', user.id);
      if (orderErr && isSchemaError(orderErr)) throw orderErr;

      const matchedOrders =
        orders?.filter((row) => isProductMatch(row.product, product.name)) || [];
      const orderIds = matchedOrders.map((o) => o.id);

      const files: DbProductFile[] = [];

      if (orderIds.length > 0) {
        const { data: docs, error: docErr } = await supabase
          .from('documents')
          .select('*')
          .in('order_id', orderIds);
        if (docErr && isSchemaError(docErr)) throw docErr;

        if (docs) {
          docs.forEach((doc) => {
            files.push({
              id: doc.id,
              productId,
              name: doc.name || `${doc.type || 'Document'} - ${doc.order_id}`,
              fileDate: formatDate(doc.uploaded_at),
              fileUrl: doc.file_url || '',
            });
          });
        }
      }

      const { data: sampleOrders, error: sampleErr } = await supabase
        .from('sample_orders')
        .select('*')
        .eq('buyer_id', user.id); // Scoped
      if (sampleErr && isSchemaError(sampleErr)) throw sampleErr;

      const matchedSamples =
        sampleOrders?.filter((row) => isProductMatch(row.product, product.name)) || [];
      matchedSamples.forEach((sample) => {
        if (sample.doc_url) {
          files.push({
            id: `sample-doc-${sample.id}`,
            productId,
            name: sample.doc_name || `Sample Spec Document - ${sample.id}`,
            fileDate: formatDate(sample.requested_at),
            fileUrl: sample.doc_url,
          });
        }
      });

      return files;
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return [];
    }
  },
};

// ── Product Updates ────────────────────────────────────────────────────────

export const updateService = {
  async getByProductId(
    productId: string
  ): Promise<{ tasks: DbProductUpdate[]; updates: DbProductUpdate[] }> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { tasks: [], updates: [] };

    try {
      const product = await productService.getById(productId);
      if (!product) return { tasks: [], updates: [] };

      const [ordersRes, rfqsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('buyer_id', user.id),
        supabase.from('rfqs').select('*').eq('buyer_id', user.id),
      ]);

      const matchedOrders =
        ordersRes.data?.filter((o) => isProductMatch(o.product, product.name)) || [];
      const matchedRfqs =
        rfqsRes.data?.filter((r) => isProductMatch(r.product, product.name)) || [];

      const orderIds = matchedOrders.map((o) => o.id);
      const rfqIds = matchedRfqs.map((r) => r.id);
      const allTargetIds = [...orderIds, ...rfqIds];

      const tasks: DbProductUpdate[] = [];
      const updates: DbProductUpdate[] = [];

      if (orderIds.length > 0) {
        const { data: milestones, error: mileErr } = await supabase
          .from('milestones')
          .select('*')
          .in('order_id', orderIds);
        if (mileErr && isSchemaError(mileErr)) throw mileErr;

        if (milestones) {
          milestones.forEach((m) => {
            const isCompleted = m.status?.toLowerCase() === 'completed';
            const mappedUpdate: DbProductUpdate = {
              id: m.id,
              productId,
              updateType: isCompleted ? 'Info' : 'Action',
              title: m.title,
              description: m.description || '',
              updateDate: formatDate(m.completed_at || m.created_at || m.target_date),
              supplier: m.updated_by || 'System',
              replies: 0,
              isTask: !isCompleted,
            };

            if (mappedUpdate.isTask) {
              tasks.push(mappedUpdate);
            } else {
              updates.push(mappedUpdate);
            }
          });
        }
      }

      // Notifications scoped to this buyer
      const { data: notifications, error: notifErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('buyer_id', user.id)
        .eq('target_dashboard', 'buyer');
      if (notifErr && isSchemaError(notifErr)) throw notifErr;

      if (notifications) {
        const matchedNotifications = notifications.filter((n) => {
          const linksToTarget = allTargetIds.includes(n.order_id);
          const mentionsProduct =
            n.message?.toLowerCase().includes(product.name.toLowerCase()) ||
            n.title?.toLowerCase().includes(product.name.toLowerCase());
          return linksToTarget || mentionsProduct;
        });

        matchedNotifications.forEach((n) => {
          const isAction = n.read === false;
          const mappedUpdate: DbProductUpdate = {
            id: String(n.id),
            productId,
            updateType: isAction ? 'Action' : 'Info',
            title: n.title,
            description: n.message || '',
            updateDate: formatDate(n.created_at),
            supplier: 'System',
            replies: 0,
            isTask: isAction,
          };

          if (mappedUpdate.isTask) {
            tasks.push(mappedUpdate);
          } else {
            updates.push(mappedUpdate);
          }
        });
      }

      return { tasks, updates };
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return { tasks: [], updates: [] };
    }
  },
};

// ── Activity Feed ──────────────────────────────────────────────────────────

export const activityService = {
  async getRecent(limit = 10): Promise<DbActivityItem[]> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      // activity_log scoped to current user's orders/rfqs via a join-style filter
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        activityType: row.type || 'info',
        title: row.status || row.type || 'Update',
        description: row.description || '',
        productId: null,
        createdAt: row.created_at,
      }));
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return [];
    }
  },
};

// ── Organization ───────────────────────────────────────────────────────────

export const organizationService = {
  async get(): Promise<DbOrganization | null> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('buyer_profiles')
        .select('*')
        .eq('id', user.id) // Always scoped to current user
        .maybeSingle();

      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        name: data.organization_name || '',
        legalName: data.legal_name || '',
        orgType: data.company_type || '',
        industry: data.industry || '',
        founded: data.founded || '',
        registrationNumber: data.registration_number || '',
        taxId: data.tax_id || '',
        website: data.website || '',
        email: data.email || '',
        phone: data.phone || '',
        street: data.street || '',
        city: data.city || '',
        state: data.state || '',
        zip: data.zip || '',
        country: data.country || '',
        teamSize: data.team_size || '',
        description: data.description || '',
      };
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return null;
    }
  },

  async update(org: DbOrganization): Promise<void> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    try {
      const { error } = await supabase
        .from('buyer_profiles')
        .update({
          organization_name: org.name,
          legal_name: org.legalName,
          company_type: org.orgType,
          industry: org.industry,
          founded: org.founded,
          registration_number: org.registrationNumber,
          tax_id: org.taxId,
          website: org.website,
          email: org.email,
          phone: org.phone,
          street: org.street,
          city: org.city,
          state: org.state,
          zip: org.zip,
          country: org.country,
          team_size: org.teamSize,
          description: org.description,
        })
        .eq('id', user.id); // Always scoped to current user

      if (error && isSchemaError(error)) throw error;
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
    }
  },
};

// ── User Profile ───────────────────────────────────────────────────────────

export const userProfileService = {
  async get(): Promise<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    organizationId: string | null;
  } | null> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        email: data.email || '',
        fullName: data.name || '',
        role: data.role || data.type || 'buyer',
        organizationId: data.id,
      };
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return null;
    }
  },
};
