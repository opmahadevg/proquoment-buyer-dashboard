-- Drop policies
DROP POLICY IF EXISTS "buyer_own_products" ON products;
DROP POLICY IF EXISTS "buyer_own_rfqs" ON rfqs;
DROP POLICY IF EXISTS "buyer_own_orders" ON orders;
DROP POLICY IF EXISTS "buyer_own_sample_orders" ON sample_orders;
DROP POLICY IF EXISTS "buyer_own_quotes" ON quotes;
DROP POLICY IF EXISTS "buyer_own_milestones" ON milestones;
DROP POLICY IF EXISTS "buyer_own_documents" ON documents;
DROP POLICY IF EXISTS "buyer_own_shipments" ON shipments;

-- Recreate policies using auth.jwt() claims to avoid auth.users table permissions issues
CREATE POLICY "buyer_own_products"
  ON products FOR ALL TO authenticated
  USING (
    buyer_id = auth.uid()::uuid
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  )
  WITH CHECK (
    buyer_id = auth.uid()::uuid
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  );

CREATE POLICY "buyer_own_rfqs"
  ON rfqs FOR ALL TO authenticated
  USING (
    buyer_id = auth.uid()::uuid
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  )
  WITH CHECK (
    buyer_id = auth.uid()::uuid
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  );

CREATE POLICY "buyer_own_orders"
  ON orders FOR ALL TO authenticated
  USING (
    buyer_id = auth.uid()::uuid
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  )
  WITH CHECK (
    buyer_id = auth.uid()::uuid
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  );

CREATE POLICY "buyer_own_sample_orders"
  ON sample_orders FOR ALL TO authenticated
  USING (
    buyer_id = auth.uid()::uuid
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  )
  WITH CHECK (
    buyer_id = auth.uid()::uuid
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  );

CREATE POLICY "buyer_own_quotes"
  ON quotes FOR SELECT TO authenticated
  USING (
    rfq_id IN (
      SELECT id FROM rfqs
      WHERE buyer_id = auth.uid()::uuid
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  );

CREATE POLICY "buyer_own_milestones"
  ON milestones FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE buyer_id = auth.uid()::uuid
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  );

CREATE POLICY "buyer_own_documents"
  ON documents FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE buyer_id = auth.uid()::uuid
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  );

CREATE POLICY "buyer_own_shipments"
  ON shipments FOR ALL TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE buyer_id = auth.uid()::uuid
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders
      WHERE buyer_id = auth.uid()::uuid
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR is_admin_user()
  );
