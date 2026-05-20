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

// ── Helper ─────────────────────────────────────────────────────────────────

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category || '',
        description: row.description || '',
        moq: row.moq || '',
        image: row.image || '',
        imageAlt: row.image_alt || '',
        stage: row.stage,
        status: row.product_status,
        updated: row.updated_at || '',
        ownerId: row.owner_id,
        organizationId: row.organization_id,
        isStatic: row.is_static,
      }));
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return [];
    }
  },

  async getById(id: string): Promise<DbProduct | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        category: data.category || '',
        description: data.description || '',
        moq: data.moq || '',
        image: data.image || '',
        imageAlt: data.image_alt || '',
        stage: data.stage,
        status: data.product_status,
        updated: data.updated_at || '',
        ownerId: data.owner_id,
        organizationId: data.organization_id,
        isStatic: data.is_static,
      };
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return null;
    }
  },

  async save(product: Omit<DbProduct, 'ownerId' | 'organizationId' | 'isStatic'>): Promise<void> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get user's org
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle();

    try {
      const { error } = await supabase.from('products').upsert(
        {
          id: product.id,
          name: product.name,
          category: product.category,
          description: product.description,
          moq: product.moq,
          image: product.image,
          image_alt: product.imageAlt,
          stage: product.stage,
          product_status: product.status,
          updated_at: product.updated,
          owner_id: user.id,
          organization_id: profile?.organization_id || null,
          is_static: false,
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
    try {
      const { data, error } = await supabase
        .from('rfq_specs')
        .select('*')
        .eq('product_id', productId)
        .maybeSingle();

      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        productId: data.product_id,
        specifications: data.specifications || [],
        manufacturingNotes: data.manufacturing_notes || [],
      };
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return null;
    }
  },

  async save(productId: string, specs: DbRfqSpec['specifications'], notes: DbRfqSpec['manufacturingNotes']): Promise<void> {
    const supabase = createClient();
    try {
      const { data: existing } = await supabase
        .from('rfq_specs')
        .select('id')
        .eq('product_id', productId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('rfq_specs')
          .update({ specifications: specs, manufacturing_notes: notes })
          .eq('product_id', productId);
        if (error && isSchemaError(error)) throw error;
      } else {
        const { error } = await supabase
          .from('rfq_specs')
          .insert({ product_id: productId, specifications: specs, manufacturing_notes: notes });
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
    try {
      const { data, error } = await supabase
        .from('quote_steps')
        .select('*')
        .eq('product_id', productId)
        .order('step_order', { ascending: true });

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        productId: row.product_id,
        stepOrder: row.step_order,
        label: row.label,
        highlight: row.highlight,
        highlightSuffix: row.highlight_suffix,
        description: row.description,
        stepStatus: row.step_status,
        inProgress: row.in_progress,
        supplierCount: row.supplier_count,
        totalSuppliers: row.total_suppliers,
      }));
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
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        productId: row.product_id,
        orderNumber: row.order_number,
        description: row.description,
        orderStatus: row.order_status,
        statusColor: row.status_color,
        supplier: row.supplier,
        placedDate: row.placed_date,
        estimatedDelivery: row.estimated_delivery,
        amount: row.amount,
        steps: row.steps || [],
      }));
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return [];
    }
  },
};

// ── Samples ────────────────────────────────────────────────────────────────

export const sampleService = {
  async getByProductId(productId: string): Promise<{ samples: DbSample[]; references: DbSample[] }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('samples')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

      if (error) {
        if (isSchemaError(error)) throw error;
        return { samples: [], references: [] };
      }

      const mapped = (data || []).map((row) => ({
        id: row.id,
        productId: row.product_id,
        image: row.image,
        imageAlt: row.image_alt,
        name: row.name,
        sampleType: row.sample_type,
        supplier: row.supplier,
        stage: row.stage,
        requested: row.requested,
        completion: row.completion,
        isReference: row.is_reference,
        creator: row.creator,
      }));

      return {
        samples: mapped.filter((s) => !s.isReference),
        references: mapped.filter((s) => s.isReference),
      };
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return { samples: [], references: [] };
    }
  },
};

// ── Product Files ──────────────────────────────────────────────────────────

export const fileService = {
  async getByProductId(productId: string): Promise<DbProductFile[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('product_files')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        productId: row.product_id,
        name: row.name,
        fileDate: row.file_date,
        fileUrl: row.file_url || '',
      }));
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return [];
    }
  },
};

// ── Product Updates ────────────────────────────────────────────────────────

export const updateService = {
  async getByProductId(productId: string): Promise<{ tasks: DbProductUpdate[]; updates: DbProductUpdate[] }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('product_updates')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) throw error;
        return { tasks: [], updates: [] };
      }

      const mapped = (data || []).map((row) => ({
        id: row.id,
        productId: row.product_id,
        updateType: row.update_type as 'Action' | 'Info',
        title: row.title,
        description: row.description,
        updateDate: row.update_date,
        supplier: row.supplier,
        replies: row.replies,
        isTask: row.is_task,
      }));

      return {
        tasks: mapped.filter((u) => u.isTask),
        updates: mapped.filter((u) => !u.isTask),
      };
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      // Get user's org
      const { data: profile } = await supabase
        .from('user_profiles').select('organization_id').eq('id', user.id)
        .maybeSingle();

      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('activity_feed').select('*').eq('organization_id', profile.organization_id).order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        activityType: row.activity_type,
        title: row.title,
        description: row.description,
        productId: row.product_id,
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.organization_id) return null;

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .maybeSingle();

      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        legalName: data.legal_name || '',
        orgType: data.org_type || '',
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
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: org.name,
          legal_name: org.legalName,
          org_type: org.orgType,
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
        .eq('id', org.id);

      if (error && isSchemaError(error)) throw error;
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
    }
  },
};

// ── User Profile ───────────────────────────────────────────────────────────

export const userProfileService = {
  async get(): Promise<{ id: string; email: string; fullName: string; role: string; organizationId: string | null } | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
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
        email: data.email,
        fullName: data.full_name,
        role: data.role,
        organizationId: data.organization_id,
      };
    } catch (err: any) {
      if (isSchemaError(err)) throw err;
      return null;
    }
  },
};
