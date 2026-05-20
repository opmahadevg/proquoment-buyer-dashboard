-- ============================================================
-- Add Us Polo Shirts and Laptop Charging Cable products
-- ============================================================

DO $$
DECLARE
  buyer_uuid UUID;
  org_uuid UUID;
BEGIN
  -- Resolve existing buyer and org UUIDs
  SELECT id INTO buyer_uuid FROM public.user_profiles WHERE email = 'maya.chen@honeysorg.com' LIMIT 1;
  SELECT id INTO org_uuid FROM public.organizations WHERE name = 'Honey''s Org' LIMIT 1;

  IF buyer_uuid IS NULL OR org_uuid IS NULL THEN
    RAISE NOTICE 'Buyer or org not found — skipping product seed';
    RETURN;
  END IF;

  -- ── Products ──────────────────────────────────────────────
  INSERT INTO public.products (id, name, category, description, moq, image, image_alt, stage, product_status, updated_at, owner_id, organization_id, is_static)
  VALUES
    ('prod-006', 'Us Polo Shirts Bulk Order 50000 Units', 'Apparel', 'US Polo shirts bulk order 50000 units', '50000 units',
     'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d',
     'US Polo shirts bulk order stacked in warehouse',
     'Quoting'::public.product_stage, 'New Update'::public.product_status, 'Apr 25, 2026',
     buyer_uuid, org_uuid, true),
    ('prod-007', 'Laptop Charging Cable', 'Electronics', 'Laptop charging cable USB-C bulk order', '1000 units',
     'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed',
     'Laptop charging cable USB-C coiled on white background',
     'Quoting'::public.product_stage, 'Action Required'::public.product_status, 'Apr 28, 2026',
     buyer_uuid, org_uuid, true)
  ON CONFLICT (id) DO NOTHING;

  -- ── Quote steps for prod-006 ───────────────────────────────
  INSERT INTO public.quote_steps (product_id, step_order, label, highlight, highlight_suffix, description, step_status, in_progress, supplier_count, total_suppliers)
  VALUES
    ('prod-006', 1, 'Identified matches', '210', ' best matches out of 312,000 suppliers',
     'We search for suppliers that match your exact product requirement and location.',
     'completed'::public.quote_step_status, false, 210, 312000),
    ('prod-006', 2, 'Reaching out to suppliers', '210', ' suppliers',
     'We share your product info with matched suppliers to understand their interest.',
     'active'::public.quote_step_status, true, 210, 312000),
    ('prod-006', 3, 'Engage suppliers', null, null,
     'We communicate with interested suppliers to verify their terms to prep for quotes.',
     'pending'::public.quote_step_status, false, 0, 0),
    ('prod-006', 4, 'Receive quotes', null, null,
     'We receive detailed quote that is ready for you to select.',
     'pending'::public.quote_step_status, false, 0, 0)
  ON CONFLICT (id) DO NOTHING;

  -- ── Quote steps for prod-007 ───────────────────────────────
  INSERT INTO public.quote_steps (product_id, step_order, label, highlight, highlight_suffix, description, step_status, in_progress, supplier_count, total_suppliers)
  VALUES
    ('prod-007', 1, 'Identified matches', '95', ' best matches out of 145,000 suppliers',
     'We search for suppliers that match your exact product requirement and location.',
     'completed'::public.quote_step_status, false, 95, 145000),
    ('prod-007', 2, 'Reaching out to suppliers', '95', ' suppliers',
     'We share your product info with matched suppliers to understand their interest.',
     'completed'::public.quote_step_status, false, 95, 145000),
    ('prod-007', 3, 'Engage suppliers', null, null,
     'We communicate with interested suppliers to verify their terms to prep for quotes.',
     'active'::public.quote_step_status, true, 0, 0),
    ('prod-007', 4, 'Receive quotes', null, null,
     'We receive detailed quote that is ready for you to select.',
     'pending'::public.quote_step_status, false, 0, 0)
  ON CONFLICT (id) DO NOTHING;

  -- ── Orders for prod-006 ───────────────────────────────────
  INSERT INTO public.orders (id, product_id, order_number, description, order_status, status_color, supplier, placed_date, estimated_delivery, amount, steps)
  VALUES (
    'order-007', 'prod-006', 'PQ-2026-0044', 'Pre-production sample - 10 units, mixed sizes',
    'In Production', 'text-amber-600 bg-amber-50', 'Shanghai Garment Co.',
    'Apr 26, 2026', 'Jun 10-25, 2026', '$320.00',
    '[{"id":"step-1","label":"Order Placed","done":true},{"id":"step-2","label":"Sample in Production","done":true},{"id":"step-3","label":"Quality Check","done":false},{"id":"step-4","label":"Shipped","done":false},{"id":"step-5","label":"Delivered","done":false}]'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- ── Orders for prod-007 ───────────────────────────────────
  INSERT INTO public.orders (id, product_id, order_number, description, order_status, status_color, supplier, placed_date, estimated_delivery, amount, steps)
  VALUES (
    'order-008', 'prod-007', 'PQ-2026-0039', 'Sample order - 20 units, USB-C 65W',
    'Quality Check', 'text-blue-600 bg-blue-50', 'Shenzhen ElecTech',
    'Apr 20, 2026', 'May 20-Jun 5, 2026', '$95.00',
    '[{"id":"step-1","label":"Order Placed","done":true},{"id":"step-2","label":"Sample in Production","done":true},{"id":"step-3","label":"Quality Check","done":true},{"id":"step-4","label":"Shipped","done":false},{"id":"step-5","label":"Delivered","done":false}]'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- ── Samples for prod-006 ──────────────────────────────────
  INSERT INTO public.samples (id, product_id, image, image_alt, name, sample_type, supplier, stage, requested, completion, is_reference, creator)
  VALUES
    ('smp-011', 'prod-006',
     'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d',
     'US polo shirt pre-production sample in white from Shanghai Garment Co',
     'Polo Shirt Sample - White, Size M', 'Pre-Production', 'Shanghai Garment Co.',
     'Pending', 'Apr 26, 2026', 'Jun 10, 2026', false, ''),
    ('ref-008', 'prod-006',
     'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d',
     'Brand reference polo shirt showing collar and embroidery placement',
     'Brand Reference - Polo Collar & Embroidery', 'Brand Reference', '',
     'Approved', 'Apr 18, 2026', '', true, 'Design Team')
  ON CONFLICT (id) DO NOTHING;

  -- ── Samples for prod-007 ──────────────────────────────────
  INSERT INTO public.samples (id, product_id, image, image_alt, name, sample_type, supplier, stage, requested, completion, is_reference, creator)
  VALUES
    ('smp-012', 'prod-007',
     'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed',
     'USB-C 65W laptop charging cable sample from Shenzhen ElecTech',
     'Charging Cable Sample - USB-C 65W, 1.8m', 'Product Sample', 'Shenzhen ElecTech',
     'In Review', 'Apr 20, 2026', 'May 20, 2026', false, ''),
    ('smp-013', 'prod-007',
     'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed',
     'USB-C 100W laptop charging cable sample from Guangzhou Cable Co',
     'Charging Cable Sample - USB-C 100W, 2m', 'Product Sample', 'Guangzhou Cable Co.',
     'Pending', 'Apr 24, 2026', 'Jun 1, 2026', false, ''),
    ('ref-009', 'prod-007',
     'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed',
     'CE and RoHS certified laptop cable reference showing certification marks',
     'Certification Reference - CE & RoHS Standard', 'Certification Reference', '',
     'Approved', 'Apr 18, 2026', '', true, 'Sourcing Team')
  ON CONFLICT (id) DO NOTHING;

  -- ── Files for prod-006 ────────────────────────────────────
  INSERT INTO public.product_files (id, product_id, name, file_date)
  VALUES
    ('file-020', 'prod-006', 'PoloShirts-RFQ-Specification.pdf', 'Apr 25, 2026'),
    ('file-021', 'prod-006', 'PoloShirts-Size-Breakdown-Chart.xlsx', 'Apr 23, 2026'),
    ('file-022', 'prod-006', 'PoloShirts-Color-Swatch-Reference.pdf', 'Apr 22, 2026'),
    ('file-023', 'prod-006', 'PoloShirts-Brand-Guidelines.pdf', 'Apr 20, 2026')
  ON CONFLICT (id) DO NOTHING;

  -- ── Files for prod-007 ────────────────────────────────────
  INSERT INTO public.product_files (id, product_id, name, file_date)
  VALUES
    ('file-024', 'prod-007', 'LaptopCable-RFQ-Specification.pdf', 'Apr 28, 2026'),
    ('file-025', 'prod-007', 'LaptopCable-Certification-Requirements.pdf', 'Apr 26, 2026'),
    ('file-026', 'prod-007', 'LaptopCable-Supplier-Shortlist.xlsx', 'Apr 25, 2026'),
    ('file-027', 'prod-007', 'LaptopCable-Technical-Spec-Sheet.pdf', 'Apr 22, 2026')
  ON CONFLICT (id) DO NOTHING;

  -- ── Updates/Tasks for prod-006 ────────────────────────────
  INSERT INTO public.product_updates (id, product_id, update_type, title, description, update_date, supplier, replies, is_task)
  VALUES
    ('task-007', 'prod-006', 'Action'::public.update_type,
     'Book A Call - Start Sourcing with Cavela',
     'We''d be glad to discuss your Us Polo Shirts Bulk Order 50000 Units project. Please book a call and we''ll walk through the next steps together.',
     'Apr 25, 2026', 'All suppliers', 0, true),
    ('task-008', 'prod-006', 'Action'::public.update_type,
     'Confirm Size Breakdown & Color Variants',
     'Suppliers need the size ratio (S/M/L/XL/XXL) and color variants for the 50,000-unit polo shirt order to provide accurate pricing and production timelines.',
     'Apr 23, 2026', 'All suppliers', 1, true),
    ('upd-006', 'prod-006', 'Info'::public.update_type,
     'RFQ Submitted — Under Review',
     'Your RFQ for 50,000 units of US Polo Shirts is under review by the sourcing team. We are identifying the best-matched suppliers for your requirements.',
     'Apr 22, 2026', 'Cavela Team', 0, false)
  ON CONFLICT (id) DO NOTHING;

  -- ── Updates/Tasks for prod-007 ────────────────────────────
  INSERT INTO public.product_updates (id, product_id, update_type, title, description, update_date, supplier, replies, is_task)
  VALUES
    ('task-009', 'prod-007', 'Action'::public.update_type,
     'Confirm Connector Type & Wattage Specification',
     'Suppliers need confirmation of the connector type (USB-C, MagSafe, proprietary) and wattage (45W, 65W, 100W) to match your laptop charging cable requirements.',
     'Apr 28, 2026', 'All suppliers', 2, true),
    ('upd-007', 'prod-007', 'Info'::public.update_type,
     'Supplier Outreach Initiated — 95 Contacted',
     '95 electronics and cable manufacturers have been contacted for your Laptop Charging Cable order. Initial responses expected within 3–5 business days.',
     'Apr 26, 2026', 'Cavela Team', 0, false),
    ('upd-008', 'prod-007', 'Info'::public.update_type,
     'Certification Requirements Noted',
     'Suppliers have been informed of CE, RoHS, and UL certification requirements. 62 out of 95 suppliers confirmed they hold the required certifications.',
     'Apr 24, 2026', 'Cavela Team', 1, false)
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Product seed failed: %', SQLERRM;
END $$;
