-- ============================================================
-- Proquoment Full Backend Migration
-- ============================================================

-- ── 1. ENUM TYPES ──────────────────────────────────────────
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('buyer', 'admin', 'viewer');

DROP TYPE IF EXISTS public.product_stage CASCADE;
CREATE TYPE public.product_stage AS ENUM ('Draft', 'Quoting', 'Sampling', 'Production', 'Completed');

DROP TYPE IF EXISTS public.product_status CASCADE;
CREATE TYPE public.product_status AS ENUM ('New Update', 'Action Required', 'No Updates');

DROP TYPE IF EXISTS public.quote_step_status CASCADE;
CREATE TYPE public.quote_step_status AS ENUM ('completed', 'active', 'pending');

DROP TYPE IF EXISTS public.sample_stage CASCADE;
CREATE TYPE public.sample_stage AS ENUM ('Pending', 'In Review', 'Approved', 'Rejected');

DROP TYPE IF EXISTS public.update_type CASCADE;
CREATE TYPE public.update_type AS ENUM ('Action', 'Info');

-- ── 2. CORE TABLES ─────────────────────────────────────────

-- Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  org_type TEXT,
  industry TEXT,
  founded TEXT,
  registration_number TEXT,
  tax_id TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  street TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  team_size TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- User Profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  role public.user_role DEFAULT 'buyer'::public.user_role,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  moq TEXT DEFAULT '',
  image TEXT DEFAULT '',
  image_alt TEXT DEFAULT '',
  stage public.product_stage DEFAULT 'Quoting'::public.product_stage,
  product_status public.product_status DEFAULT 'No Updates'::public.product_status,
  updated_at TEXT DEFAULT '',
  owner_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  is_static BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- RFQ Specs (per product)
CREATE TABLE IF NOT EXISTS public.rfq_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
  specifications JSONB DEFAULT '[]'::jsonb,
  manufacturing_notes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Quote Steps (per product)
CREATE TABLE IF NOT EXISTS public.quote_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 1,
  label TEXT NOT NULL,
  highlight TEXT,
  highlight_suffix TEXT,
  description TEXT,
  step_status public.quote_step_status DEFAULT 'pending'::public.quote_step_status,
  in_progress BOOLEAN DEFAULT false,
  supplier_count INTEGER DEFAULT 0,
  total_suppliers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  description TEXT DEFAULT '',
  order_status TEXT DEFAULT 'Pending',
  status_color TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  placed_date TEXT DEFAULT '',
  estimated_delivery TEXT DEFAULT '',
  amount TEXT DEFAULT '',
  steps JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Samples
CREATE TABLE IF NOT EXISTS public.samples (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
  image TEXT DEFAULT '',
  image_alt TEXT DEFAULT '',
  name TEXT NOT NULL,
  sample_type TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  stage TEXT DEFAULT 'Pending',
  requested TEXT DEFAULT '',
  completion TEXT DEFAULT '',
  is_reference BOOLEAN DEFAULT false,
  creator TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Product Files
CREATE TABLE IF NOT EXISTS public.product_files (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_date TEXT DEFAULT '',
  file_url TEXT DEFAULT '',
  uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Product Updates / Tasks
CREATE TABLE IF NOT EXISTS public.product_updates (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
  update_type public.update_type DEFAULT 'Info'::public.update_type,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  update_date TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  replies INTEGER DEFAULT 0,
  is_task BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Activity Feed
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── 3. INDEXES ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON public.user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_owner ON public.products(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_org ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_rfq_specs_product ON public.rfq_specs(product_id);
CREATE INDEX IF NOT EXISTS idx_quote_steps_product ON public.quote_steps(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_product ON public.orders(product_id);
CREATE INDEX IF NOT EXISTS idx_samples_product ON public.samples(product_id);
CREATE INDEX IF NOT EXISTS idx_product_files_product ON public.product_files(product_id);
CREATE INDEX IF NOT EXISTS idx_product_updates_product ON public.product_updates(product_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_org ON public.activity_feed(organization_id);

-- ── 4. FUNCTIONS ───────────────────────────────────────────

-- Auto-create user_profiles on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')::public.user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Role check helper (uses auth metadata to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role::TEXT FROM public.user_profiles WHERE id = auth.uid() LIMIT 1),
    'buyer'
  );
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- ── 5. ENABLE RLS ──────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS POLICIES ────────────────────────────────────────

-- user_profiles: own row only (no function to avoid recursion)
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles FOR ALL TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- organizations: members of org can read; admins can write
DROP POLICY IF EXISTS "org_members_read_organizations" ON public.organizations;
CREATE POLICY "org_members_read_organizations"
ON public.organizations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.organization_id = organizations.id
  )
);

DROP POLICY IF EXISTS "admins_manage_organizations" ON public.organizations;
CREATE POLICY "admins_manage_organizations"
ON public.organizations FOR ALL TO authenticated
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

-- products: org members read; buyers/admins write
DROP POLICY IF EXISTS "org_members_read_products" ON public.products;
CREATE POLICY "org_members_read_products"
ON public.products FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.organization_id = products.organization_id
  )
);

DROP POLICY IF EXISTS "buyers_admins_manage_products" ON public.products;
CREATE POLICY "buyers_admins_manage_products"
ON public.products FOR ALL TO authenticated
USING (owner_id = auth.uid() OR public.get_user_role() = 'admin')
WITH CHECK (owner_id = auth.uid() OR public.get_user_role() = 'admin');

-- rfq_specs: follow product access
DROP POLICY IF EXISTS "product_owners_manage_rfq_specs" ON public.rfq_specs;
CREATE POLICY "product_owners_manage_rfq_specs"
ON public.rfq_specs FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = rfq_specs.product_id
    AND (p.owner_id = auth.uid() OR public.get_user_role() = 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = rfq_specs.product_id
    AND (p.owner_id = auth.uid() OR public.get_user_role() = 'admin')
  )
);

-- quote_steps
DROP POLICY IF EXISTS "product_owners_manage_quote_steps" ON public.quote_steps;
CREATE POLICY "product_owners_manage_quote_steps"
ON public.quote_steps FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = quote_steps.product_id
    AND (p.owner_id = auth.uid() OR public.get_user_role() IN ('admin', 'viewer'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = quote_steps.product_id
    AND (p.owner_id = auth.uid() OR public.get_user_role() = 'admin')
  )
);

-- orders
DROP POLICY IF EXISTS "product_owners_manage_orders" ON public.orders;
CREATE POLICY "product_owners_manage_orders"
ON public.orders FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = orders.product_id
    AND (p.owner_id = auth.uid() OR public.get_user_role() IN ('admin', 'viewer'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = orders.product_id
    AND (p.owner_id = auth.uid() OR public.get_user_role() = 'admin')
  )
);

-- samples
DROP POLICY IF EXISTS "product_owners_manage_samples" ON public.samples;
CREATE POLICY "product_owners_manage_samples"
ON public.samples FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = samples.product_id
    AND (p.owner_id = auth.uid() OR public.get_user_role() IN ('admin', 'viewer'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = samples.product_id
    AND (p.owner_id = auth.uid() OR public.get_user_role() = 'admin')
  )
);

-- product_files
DROP POLICY IF EXISTS "product_owners_manage_files" ON public.product_files;
CREATE POLICY "product_owners_manage_files"
ON public.product_files FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_files.product_id
    AND (p.owner_id = auth.uid() OR public.get_user_role() IN ('admin', 'viewer'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_files.product_id
    AND (p.owner_id = auth.uid() OR public.get_user_role() = 'admin')
  )
);

-- product_updates
DROP POLICY IF EXISTS "product_owners_manage_updates" ON public.product_updates;
CREATE POLICY "product_owners_manage_updates"
ON public.product_updates FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_updates.product_id
    AND (p.owner_id = auth.uid() OR public.get_user_role() IN ('admin', 'viewer'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_updates.product_id
    AND (p.owner_id = auth.uid() OR public.get_user_role() = 'admin')
  )
);

-- activity_feed
DROP POLICY IF EXISTS "org_members_read_activity" ON public.activity_feed;
CREATE POLICY "org_members_read_activity"
ON public.activity_feed FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.organization_id = activity_feed.organization_id
  )
);

DROP POLICY IF EXISTS "admins_manage_activity" ON public.activity_feed;
CREATE POLICY "admins_manage_activity"
ON public.activity_feed FOR ALL TO authenticated
USING (public.get_user_role() IN ('admin', 'buyer'))
WITH CHECK (public.get_user_role() IN ('admin', 'buyer'));

-- ── 7. TRIGGERS ────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS set_organizations_updated_at ON public.organizations;
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_rfq_specs_updated_at ON public.rfq_specs;
CREATE TRIGGER set_rfq_specs_updated_at
  BEFORE UPDATE ON public.rfq_specs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 8. MOCK DATA ───────────────────────────────────────────
DO $$
DECLARE
  buyer_uuid UUID := gen_random_uuid();
  admin_uuid UUID := gen_random_uuid();
  viewer_uuid UUID := gen_random_uuid();
  org_uuid UUID := gen_random_uuid();
BEGIN
  -- Create organization
  INSERT INTO public.organizations (
    id, name, legal_name, org_type, industry, founded,
    registration_number, tax_id, website, email, phone,
    street, city, state, zip, country, team_size, description
  ) VALUES (
    org_uuid,
    'Honey''s Org',
    'Honey Enterprises Pvt. Ltd.',
    'Private Limited Company',
    'Textile & Apparel',
    '2018',
    'REG-2018-HE-04421',
    'GSTIN: 27AABCH1234F1Z5',
    'https://honeysorg.com',
    'contact@honeysorg.com',
    '+91 98765 43210',
    '42, Industrial Estate, Phase II',
    'Mumbai',
    'Maharashtra',
    '400072',
    'India',
    '12-50 employees',
    'Honey''s Org is a sourcing and procurement company specialising in home textiles, apparel, and agricultural commodities.'
  ) ON CONFLICT (id) DO NOTHING;

  -- Create auth users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (buyer_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'maya.chen@honeysorg.com', crypt('buyer@Proquo26', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Maya Chen', 'role', 'buyer'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rajiv.admin@honeysorg.com', crypt('admin@Proquo26', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Rajiv Admin', 'role', 'admin'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (viewer_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'priya.view@honeysorg.com', crypt('viewer@Proquo26', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Priya View', 'role', 'viewer'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  -- Link users to org (trigger already created user_profiles)
  UPDATE public.user_profiles SET organization_id = org_uuid
  WHERE id IN (buyer_uuid, admin_uuid, viewer_uuid);

  -- Static products
  INSERT INTO public.products (id, name, category, description, moq, image, image_alt, stage, product_status, updated_at, owner_id, organization_id, is_static)
  VALUES
    ('prod-001', 'Black Puffed Jackets', 'Apparel', 'Black puffed winter jackets bulk order', '200 units',
     'https://images.unsplash.com/photo-1724961222782-c86c1e8e9300',
     'Black puffed winter jacket close-up product thumbnail',
     'Quoting'::public.product_stage, 'New Update'::public.product_status, 'Apr 30, 2026',
     buyer_uuid, org_uuid, true),
    ('prod-002', 'Cotton Ac Blankets Bulk Pack 2000 Pieces', 'Home Textiles', 'Cotton AC blankets bulk pack', '2000 units',
     'https://img.rocket.new/generatedImages/rocket_gen_img_19eea20c1-1777708222482.png',
     'Stack of cotton blankets in bulk packaging',
     'Quoting'::public.product_stage, 'Action Required'::public.product_status, 'Apr 20, 2026',
     buyer_uuid, org_uuid, true),
    ('prod-003', 'King Size Plain White Cotton Bed Sheets', 'Home Textiles', 'King size plain white cotton bed sheets', '500 units',
     'https://img.rocket.new/generatedImages/rocket_gen_img_171e9f2d7-1772974929871.png',
     'White cotton bed sheets neatly folded on white background',
     'Quoting'::public.product_stage, 'New Update'::public.product_status, 'Mar 19, 2026',
     buyer_uuid, org_uuid, true),
    ('prod-004', 'Organic Cotton Tote Bags 500 pcs', 'Accessories', 'Organic cotton tote bags', '500 units',
     'https://img.rocket.new/generatedImages/rocket_gen_img_190e62348-1766926552430.png',
     'Natural cotton tote bag with rope handles',
     'Quoting'::public.product_stage, 'No Updates'::public.product_status, 'Mar 12, 2026',
     buyer_uuid, org_uuid, true),
    ('prod-005', 'Green Cardamoms 6mm+ Bulk 2 Tonnes', 'Agricultural', 'Green cardamoms 6mm+ bulk order', '2 tonnes',
     'https://img.rocket.new/generatedImages/rocket_gen_img_1623031a4-1772114043806.png',
     'Green cardamom pods in bulk sack',
     'Quoting'::public.product_stage, 'New Update'::public.product_status, 'Mar 19, 2026',
     buyer_uuid, org_uuid, true)
  ON CONFLICT (id) DO NOTHING;

  -- Quote steps for prod-001
  INSERT INTO public.quote_steps (product_id, step_order, label, highlight, highlight_suffix, description, step_status, in_progress, supplier_count, total_suppliers)
  VALUES
    ('prod-001', 1, 'Identified matches', '185', ' best matches out of 208,201 suppliers',
     'We search for suppliers that match your exact product requirement and location.',
     'completed'::public.quote_step_status, false, 185, 208201),
    ('prod-001', 2, 'Reaching out to suppliers', '185', ' suppliers',
     'We share your product info with matched suppliers to understand their interest.',
     'active'::public.quote_step_status, true, 185, 208201),
    ('prod-001', 3, 'Engage suppliers', null, null,
     'We communicate with interested suppliers to verify their terms to prep for quotes.',
     'pending'::public.quote_step_status, false, 0, 0),
    ('prod-001', 4, 'Receive quotes', null, null,
     'We receive detailed quote that is ready for you to select.',
     'pending'::public.quote_step_status, false, 0, 0)
  ON CONFLICT (id) DO NOTHING;

  -- Orders for prod-001
  INSERT INTO public.orders (id, product_id, order_number, description, order_status, status_color, supplier, placed_date, estimated_delivery, amount, steps)
  VALUES (
    'order-001', 'prod-001', 'PQ-2026-0041', 'Pre-production sample - 1 unit',
    'In Production', 'text-amber-600 bg-amber-50', 'Aftab A.',
    'Apr 30, 2026', 'Jun 5-19, 2026', '$250.00',
    '[{"id":"step-1","label":"Order Placed","done":true},{"id":"step-2","label":"Sample in Production","done":true},{"id":"step-3","label":"Quality Check","done":false},{"id":"step-4","label":"Shipped","done":false},{"id":"step-5","label":"Delivered","done":false}]'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- Samples for prod-001
  INSERT INTO public.samples (id, product_id, image, image_alt, name, sample_type, supplier, stage, requested, completion, is_reference, creator)
  VALUES
    ('smp-001', 'prod-001',
     'https://img.rocket.new/generatedImages/rocket_gen_img_1ba13e73e-1772184110682.png',
     'Black puffed jacket pre-production sample front view',
     'Black Puffed Jacket - Pre-Production Sample', 'Pre-Production', 'Aftab A.',
     'In Review', 'Apr 30, 2026', 'Jun 5, 2026', false, ''),
    ('smp-002', 'prod-001',
     'https://img.rocket.new/generatedImages/rocket_gen_img_1ba13e73e-1772184110682.png',
     'Black puffed jacket prototype with zipper detail',
     'Jacket Prototype - Zipper & Lining Test', 'Prototype', 'SinoGarment Co.',
     'Pending', 'May 2, 2026', 'Jun 15, 2026', false, ''),
    ('ref-001', 'prod-001',
     'https://img.rocket.new/generatedImages/rocket_gen_img_1ba13e73e-1772184110682.png',
     'Reference image of black puffer jacket from brand catalog',
     'Brand Reference - Winter Puffer Style', 'Brand Reference', '',
     'Approved', 'Apr 18, 2026', '', true, 'Design Team')
  ON CONFLICT (id) DO NOTHING;

  -- Files for prod-001
  INSERT INTO public.product_files (id, product_id, name, file_date)
  VALUES
    ('file-001', 'prod-001', 'Black-Puffed-Jacket-RFQ-Spec-Sheet.pdf', 'Apr 30, 2026'),
    ('file-002', 'prod-001', 'Black-Puffed-Jacket-Sample-Photos.zip', 'Apr 28, 2026'),
    ('file-003', 'prod-001', 'Black-Puffed-Jacket-Tech-Pack-v2.pdf', 'Apr 25, 2026'),
    ('file-004', 'prod-001', 'Black-Puffed-Jacket-Supplier-Comparison.xlsx', 'Apr 20, 2026')
  ON CONFLICT (id) DO NOTHING;

  -- Updates/Tasks for prod-001
  INSERT INTO public.product_updates (id, product_id, update_type, title, description, update_date, supplier, replies, is_task)
  VALUES
    ('task-001', 'prod-001', 'Action'::public.update_type,
     'Book A Call - Start Sourcing with Cavela',
     'We''d be glad to discuss your Black Puffed Jackets project. Please book a call and we''ll walk through the next steps together.',
     'Apr 20, 2026', 'All suppliers', 0, true)
  ON CONFLICT (id) DO NOTHING;

  -- Activity feed
  INSERT INTO public.activity_feed (organization_id, activity_type, title, description, product_id)
  VALUES
    (org_uuid, 'quote', 'New quote received',
     'Black Puffed Jackets - Supplier Aftab A. submitted a quote for 200 units.', 'prod-001'),
    (org_uuid, 'action', 'Action required',
     'Cotton Ac Blankets Bulk Pack 2000 Pieces - Review and respond to latest update.', 'prod-002'),
    (org_uuid, 'order', 'Order confirmed',
     'Organic Cotton Tote Bags 500 pcs - Production started by Guangzhou Textiles Co.', 'prod-004'),
    (org_uuid, 'message', 'Supplier message',
     'King Size Plain White Cotton Bed Sheets - Supplier requested clarification on thread count.', 'prod-003'),
    (org_uuid, 'product', 'RFQ submitted',
     'Us Polo Shirts Bulk Order 50000 Units - Your RFQ is under review by sourcing team.', null)
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
