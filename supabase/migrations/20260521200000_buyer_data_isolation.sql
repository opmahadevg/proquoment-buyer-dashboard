-- ============================================================
-- BUYER DATA ISOLATION — Production-Ready Migration (v2)
-- Fixed: explicit ::uuid casts + safe column type enforcement
-- ============================================================

-- ── 1. SAFELY ADD / FIX buyer_id COLUMNS ────────────────────
-- If buyer_id already exists with wrong type (e.g. bigint from a
-- previous attempt), drop and re-add it as UUID.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['notifications','rfqs','orders','products','sample_orders']
  LOOP
    -- Drop buyer_id if it exists but is NOT uuid
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = tbl
        AND column_name = 'buyer_id'
        AND data_type   <> 'uuid'
    ) THEN
      EXECUTE format('ALTER TABLE %I DROP COLUMN buyer_id', tbl);
      RAISE NOTICE 'Dropped non-uuid buyer_id from %', tbl;
    END IF;

    -- Add buyer_id as UUID if it does not exist yet
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = tbl
        AND column_name = 'buyer_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL',
        tbl
      );
      RAISE NOTICE 'Added buyer_id UUID to %', tbl;
    END IF;
  END LOOP;
END $$;

-- ── 2. INDEXES ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notifications_buyer_id ON notifications(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_buyer_id           ON rfqs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id          ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_products_buyer_id        ON products(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sample_orders_buyer_id   ON sample_orders(buyer_id);

-- ── 3. ENABLE RLS ────────────────────────────────────────────

ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments       ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS POLICIES ──────────────────────────────────────────
-- All auth.uid() calls cast explicitly to ::uuid to avoid
-- "operator does not exist: bigint = uuid" errors.

-- NOTIFICATIONS
DROP POLICY IF EXISTS "buyer_own_notifications"        ON notifications;
DROP POLICY IF EXISTS "buyer_insert_notifications"     ON notifications;
DROP POLICY IF EXISTS "buyer_update_own_notifications" ON notifications;

CREATE POLICY "buyer_own_notifications"
  ON notifications FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()::uuid
    OR (target_dashboard = 'buyer' AND type = 'admin_announcement')
  );

CREATE POLICY "buyer_insert_notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "buyer_update_own_notifications"
  ON notifications FOR UPDATE TO authenticated
  USING     (buyer_id = auth.uid()::uuid)
  WITH CHECK (buyer_id = auth.uid()::uuid);

-- RFQS
DROP POLICY IF EXISTS "buyer_own_rfqs" ON rfqs;
CREATE POLICY "buyer_own_rfqs"
  ON rfqs FOR ALL TO authenticated
  USING (
    buyer_id = auth.uid()::uuid
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()::uuid
        AND (u.raw_user_meta_data->>'role') = 'admin'
    )
  )
  WITH CHECK (
    buyer_id = auth.uid()::uuid
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()::uuid
        AND (u.raw_user_meta_data->>'role') = 'admin'
    )
  );

-- ORDERS
DROP POLICY IF EXISTS "buyer_own_orders" ON orders;
CREATE POLICY "buyer_own_orders"
  ON orders FOR ALL TO authenticated
  USING (
    buyer_id = auth.uid()::uuid
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()::uuid
        AND (u.raw_user_meta_data->>'role') = 'admin'
    )
  )
  WITH CHECK (
    buyer_id = auth.uid()::uuid
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()::uuid
        AND (u.raw_user_meta_data->>'role') = 'admin'
    )
  );

-- PRODUCTS
DROP POLICY IF EXISTS "buyer_own_products" ON products;
CREATE POLICY "buyer_own_products"
  ON products FOR ALL TO authenticated
  USING (
    buyer_id = auth.uid()::uuid
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()::uuid
        AND (u.raw_user_meta_data->>'role') = 'admin'
    )
  )
  WITH CHECK (
    buyer_id = auth.uid()::uuid
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()::uuid
        AND (u.raw_user_meta_data->>'role') = 'admin'
    )
  );

-- SAMPLE_ORDERS
DROP POLICY IF EXISTS "buyer_own_sample_orders" ON sample_orders;
CREATE POLICY "buyer_own_sample_orders"
  ON sample_orders FOR ALL TO authenticated
  USING (
    buyer_id = auth.uid()::uuid
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()::uuid
        AND (u.raw_user_meta_data->>'role') = 'admin'
    )
  )
  WITH CHECK (
    buyer_id = auth.uid()::uuid
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()::uuid
        AND (u.raw_user_meta_data->>'role') = 'admin'
    )
  );

-- BUYER_PROFILES
DROP POLICY IF EXISTS "buyer_own_profile" ON buyer_profiles;
CREATE POLICY "buyer_own_profile"
  ON buyer_profiles FOR ALL TO authenticated
  USING     (id = auth.uid()::uuid)
  WITH CHECK (id = auth.uid()::uuid);

-- QUOTES: read quotes linked to this buyer's RFQs
DROP POLICY IF EXISTS "buyer_own_quotes"   ON quotes;
DROP POLICY IF EXISTS "buyer_update_quotes" ON quotes;

CREATE POLICY "buyer_own_quotes"
  ON quotes FOR SELECT TO authenticated
  USING (
    rfq_id IN (
      SELECT id FROM rfqs
      WHERE buyer_id = auth.uid()::uuid
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()::uuid
        AND (u.raw_user_meta_data->>'role') = 'admin'
    )
  );

CREATE POLICY "buyer_update_quotes"
  ON quotes FOR UPDATE TO authenticated
  USING (
    rfq_id IN (
      SELECT id FROM rfqs
      WHERE buyer_id = auth.uid()::uuid
    )
  )
  WITH CHECK (
    rfq_id IN (
      SELECT id FROM rfqs
      WHERE buyer_id = auth.uid()::uuid
    )
  );

-- MILESTONES
DROP POLICY IF EXISTS "buyer_own_milestones" ON milestones;
CREATE POLICY "buyer_own_milestones"
  ON milestones FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE buyer_id = auth.uid()::uuid
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()::uuid
        AND (u.raw_user_meta_data->>'role') = 'admin'
    )
  );

-- DOCUMENTS
DROP POLICY IF EXISTS "buyer_own_documents" ON documents;
CREATE POLICY "buyer_own_documents"
  ON documents FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE buyer_id = auth.uid()::uuid
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()::uuid
        AND (u.raw_user_meta_data->>'role') = 'admin'
    )
  );

-- SHIPMENTS
DROP POLICY IF EXISTS "buyer_own_shipments" ON shipments;
CREATE POLICY "buyer_own_shipments"
  ON shipments FOR ALL TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE buyer_id = auth.uid()::uuid
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()::uuid
        AND (u.raw_user_meta_data->>'role') = 'admin'
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders
      WHERE buyer_id = auth.uid()::uuid
    )
  );

-- ── 5. UPDATED NOTIFICATION TRIGGERS ────────────────────────
-- Re-create all triggers with SECURITY DEFINER + explicit UUID casts.

CREATE OR REPLACE FUNCTION notify_buyer_rfq_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO notifications
      (target_dashboard, type, title, message, order_id, buyer_id, read)
    VALUES (
      'buyer',
      'rfq_status_change',
      'RFQ Update: ' || COALESCE(NEW.product, 'Custom Product'),
      'Your RFQ is now "' || NEW.status || '"',
      NEW.id,
      NEW.buyer_id::uuid,   -- explicit cast
      false
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_buyer_rfq_status ON rfqs;
CREATE TRIGGER trg_notify_buyer_rfq_status
  AFTER UPDATE ON rfqs FOR EACH ROW
  EXECUTE FUNCTION notify_buyer_rfq_status();

-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_buyer_order_stage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO notifications
      (target_dashboard, type, title, message, order_id, buyer_id, read)
    VALUES (
      'buyer',
      'order_stage_change',
      'Order Update: ' || COALESCE(NEW.product, 'Custom Order'),
      'Order moved to "' || NEW.stage || '"',
      NEW.id,
      NEW.buyer_id::uuid,   -- explicit cast
      false
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_buyer_order_stage ON orders;
CREATE TRIGGER trg_notify_buyer_order_stage
  AFTER UPDATE ON orders FOR EACH ROW
  EXECUTE FUNCTION notify_buyer_order_stage();

-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_buyer_milestone()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_buyer_id UUID;
BEGIN
  SELECT buyer_id INTO v_buyer_id
  FROM orders
  WHERE id = NEW.order_id;

  INSERT INTO notifications
    (target_dashboard, type, title, message, order_id, buyer_id, read)
  VALUES (
    'buyer',
    'milestone_added',
    'Milestone: ' || NEW.title,
    COALESCE(NEW.description, 'New milestone reached'),
    NEW.order_id,
    v_buyer_id::uuid,       -- explicit cast (already uuid, belt-and-suspenders)
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_buyer_milestone ON milestones;
CREATE TRIGGER trg_notify_buyer_milestone
  AFTER INSERT ON milestones FOR EACH ROW
  EXECUTE FUNCTION notify_buyer_milestone();

-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_buyer_new_quote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_buyer_id UUID;
BEGIN
  SELECT buyer_id INTO v_buyer_id
  FROM rfqs
  WHERE id = NEW.rfq_id;

  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE target_dashboard = 'buyer'
      AND type             = 'quote_received'
      AND order_id         = COALESCE(NEW.rfq_id, NEW.id::text)
      AND buyer_id         = v_buyer_id::uuid
  ) THEN
    INSERT INTO notifications
      (target_dashboard, type, title, message, order_id, buyer_id, read)
    VALUES (
      'buyer',
      'quote_received',
      'New Quote Received',
      'Landed cost quote for RFQ ' || COALESCE(NEW.rfq_id, 'N/A'),
      COALESCE(NEW.rfq_id, NEW.id::text),
      v_buyer_id::uuid,     -- explicit cast
      false
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_buyer_new_quote ON quotes;
CREATE TRIGGER trg_notify_buyer_new_quote
  AFTER INSERT ON quotes FOR EACH ROW
  EXECUTE FUNCTION notify_buyer_new_quote();

-- ── 6. AUTO-BOOTSTRAP buyer_profile ON NEW SIGNUP ───────────

CREATE OR REPLACE FUNCTION public.handle_new_buyer_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Create blank buyer_profiles row (Account page loads empty, not Honey's Org)
  INSERT INTO buyer_profiles (id, email, verification_status)
  VALUES (NEW.id::uuid, NEW.email, 'pending')
  ON CONFLICT (id) DO NOTHING;

  -- Scoped welcome notification for this buyer only
  INSERT INTO notifications
    (target_dashboard, type, title, message, buyer_id, read)
  VALUES (
    'buyer',
    'admin_announcement',
    'Welcome to Proquoment! 🎉',
    'Your account is active. Submit your first RFQ to start sourcing from verified global suppliers.',
    NEW.id::uuid,           -- explicit cast
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_buyer_signup ON auth.users;
CREATE TRIGGER on_buyer_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_buyer_signup();

-- ── 7. BACKFILL DEMO ACCOUNTS ────────────────────────────────

DO $$
DECLARE
  demo_uid  UUID;
  buyer_uid UUID;
BEGIN
  SELECT id INTO demo_uid  FROM auth.users WHERE email = 'demo@proquoment.com'  LIMIT 1;
  SELECT id INTO buyer_uid FROM auth.users WHERE email = 'buyer@proquoment.com' LIMIT 1;

  -- Stamp rfqs
  IF demo_uid IS NOT NULL THEN
    UPDATE rfqs
    SET buyer_id = demo_uid
    WHERE buyer_id IS NULL
      AND (buyer ILIKE '%demo%' OR buyer ILIKE '%honey%' OR buyer ILIKE '%enterprise%');
  END IF;
  IF buyer_uid IS NOT NULL THEN
    UPDATE rfqs SET buyer_id = buyer_uid
    WHERE buyer_id IS NULL AND buyer ILIKE '%buyer%';
  END IF;
  IF demo_uid IS NOT NULL THEN
    -- Catch-all: any remaining unowned rfqs → demo
    UPDATE rfqs SET buyer_id = demo_uid WHERE buyer_id IS NULL;
  END IF;

  -- Stamp orders
  IF demo_uid IS NOT NULL THEN
    UPDATE orders
    SET buyer_id = demo_uid
    WHERE buyer_id IS NULL
      AND (buyer ILIKE '%demo%' OR buyer ILIKE '%honey%' OR buyer ILIKE '%enterprise%');
  END IF;
  IF buyer_uid IS NOT NULL THEN
    UPDATE orders SET buyer_id = buyer_uid
    WHERE buyer_id IS NULL AND buyer ILIKE '%buyer%';
  END IF;
  IF demo_uid IS NOT NULL THEN
    UPDATE orders SET buyer_id = demo_uid WHERE buyer_id IS NULL;
  END IF;

  -- Stamp products
  IF demo_uid IS NOT NULL THEN
    UPDATE products SET buyer_id = demo_uid WHERE buyer_id IS NULL;
  END IF;

  -- Stamp sample_orders
  IF demo_uid IS NOT NULL THEN
    UPDATE sample_orders SET buyer_id = demo_uid WHERE buyer_id IS NULL;
  END IF;

  -- Stamp legacy buyer notifications
  IF demo_uid IS NOT NULL THEN
    UPDATE notifications SET buyer_id = demo_uid
    WHERE buyer_id IS NULL AND target_dashboard = 'buyer';
  END IF;

  -- Ensure demo buyer_profiles rows exist
  IF demo_uid IS NOT NULL THEN
    INSERT INTO buyer_profiles (id, email, verification_status)
    VALUES (demo_uid, 'demo@proquoment.com', 'verified')
    ON CONFLICT (id) DO UPDATE SET verification_status = 'verified';
  END IF;
  IF buyer_uid IS NOT NULL THEN
    INSERT INTO buyer_profiles (id, email, verification_status)
    VALUES (buyer_uid, 'buyer@proquoment.com', 'verified')
    ON CONFLICT (id) DO UPDATE SET verification_status = 'verified';
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Backfill failed (non-fatal): %', SQLERRM;
END $$;

-- ── 8. REALTIME PUBLICATION ──────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE rfqs;           EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE orders;         EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE products;       EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE buyer_profiles; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE notifications;  EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE milestones;     EXCEPTION WHEN others THEN NULL; END;
  END IF;
END; $$;
