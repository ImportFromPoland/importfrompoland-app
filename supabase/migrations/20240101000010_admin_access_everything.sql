-- FINAL FIX: Ensure admins can access EVERYTHING
-- This gives admins full access to all tables needed for order management

-- Companies table - admins can see all companies
DROP POLICY IF EXISTS "Clients can view own company" ON companies;
DROP POLICY IF EXISTS "Admins can manage companies" ON companies;
DROP POLICY IF EXISTS "Clients can update own company" ON companies;

CREATE POLICY "admin_view_all_companies" ON companies FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "admin_manage_companies" ON companies FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'))
WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'));

CREATE POLICY "client_update_own_company" ON companies FOR UPDATE TO authenticated
USING (id = (SELECT company_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Order totals view - admins can see all
DROP POLICY IF EXISTS "Users can view order totals" ON order_totals;

CREATE POLICY "view_order_totals" ON order_totals FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_totals.order_id
    AND orders.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

-- Audit logs - admins can see all
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;

CREATE POLICY "admin_view_all_audit_logs" ON audit_logs FOR SELECT TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'));

CREATE POLICY "admin_insert_audit_logs" ON audit_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- Ensure order_item_totals view is accessible
DROP POLICY IF EXISTS "Users can view order item totals" ON order_item_totals;

CREATE POLICY "view_order_item_totals" ON order_item_totals FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_item_totals.order_id
    AND orders.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

-- Verify all critical policies exist
SELECT 
  'Orders policies: ' || COUNT(*)::TEXT as check_result
FROM pg_policies 
WHERE tablename = 'orders';

SELECT 
  'Order items policies: ' || COUNT(*)::TEXT as check_result
FROM pg_policies 
WHERE tablename = 'order_items';

SELECT 
  'Companies policies: ' || COUNT(*)::TEXT as check_result
FROM pg_policies 
WHERE tablename = 'companies';

