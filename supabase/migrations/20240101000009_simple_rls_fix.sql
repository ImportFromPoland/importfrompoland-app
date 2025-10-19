-- SIMPLIFIED RLS FIX - Guaranteed to work
-- This removes all complex logic and creates super simple policies

-- Drop ALL existing policies on orders
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'orders') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON orders', r.policyname);
    END LOOP;
END $$;

-- Create simple, bulletproof policies

-- 1. SELECT: Admin sees everything, clients see own company
CREATE POLICY "select_orders"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Inline role check - no function calls
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  -- Client sees own company
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- 2. INSERT: Anyone can insert for their own company
CREATE POLICY "insert_orders"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- 3. UPDATE: Admin can update anything, clients can update own drafts
CREATE POLICY "update_orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND status = 'draft'
  )
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND status IN ('draft', 'submitted')
  )
);

-- 4. DELETE: Only admins
CREATE POLICY "delete_orders"
ON orders
FOR DELETE
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
);

-- Same for order_items
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'order_items') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON order_items', r.policyname);
    END LOOP;
END $$;

-- Order items policies
CREATE POLICY "select_order_items"
ON order_items
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "insert_order_items"
ON order_items
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND orders.status = 'draft'
  )
);

CREATE POLICY "update_order_items"
ON order_items
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND orders.status = 'draft'
  )
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "delete_order_items"
ON order_items
FOR DELETE
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND orders.status = 'draft'
  )
);

-- Verify policies were created
SELECT 'Orders policies created: ' || COUNT(*)::TEXT as result
FROM pg_policies
WHERE tablename = 'orders';

SELECT 'Order items policies created: ' || COUNT(*)::TEXT as result
FROM pg_policies
WHERE tablename = 'order_items';

