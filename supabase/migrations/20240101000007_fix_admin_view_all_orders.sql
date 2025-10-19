-- Fix admin RLS policies to ensure staff_admin can see ALL orders from ALL companies
-- The issue is that existing policies might be too restrictive

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Clients can view own company orders" ON orders;
DROP POLICY IF EXISTS "Clients can update own drafts" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
DROP POLICY IF EXISTS "Clients can update own orders" ON orders;

-- Recreate with correct priority and logic

-- 1. Admins can see and manage ALL orders (highest priority)
CREATE POLICY "Admins can view and manage all orders"
ON orders
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
);

-- 2. Clients can view their own company's orders
CREATE POLICY "Clients can view own orders"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Allow if admin/staff_admin (already covered above, but being explicit)
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
  OR
  -- Allow if client viewing own company's orders
  (
    company_id IN (
      SELECT company_id FROM profiles WHERE profiles.id = auth.uid()
    )
  )
);

-- 3. Clients can insert orders for their own company
CREATE POLICY "Clients can create orders"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE profiles.id = auth.uid()
  )
);

-- 4. Clients can update their own draft orders
-- Admins can update any order (already covered by policy 1)
CREATE POLICY "Clients can update own draft orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  -- Admins can update anything
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
  OR
  -- Clients can update their own drafts or submit them
  (
    company_id IN (
      SELECT company_id FROM profiles WHERE profiles.id = auth.uid()
    )
    AND status = 'draft'
  )
)
WITH CHECK (
  -- Admins can set any status
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
  OR
  -- Clients can only set to draft or submitted
  (
    company_id IN (
      SELECT company_id FROM profiles WHERE profiles.id = auth.uid()
    )
    AND status IN ('draft', 'submitted')
  )
);

-- Fix order_items policies to match
DROP POLICY IF EXISTS "Clients can view own order items" ON order_items;
DROP POLICY IF EXISTS "Admins can manage all order items" ON order_items;

CREATE POLICY "Admin can manage all order items"
ON order_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
);

CREATE POLICY "Clients can view own order items"
ON order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.company_id IN (
      SELECT company_id FROM profiles WHERE profiles.id = auth.uid()
    )
  )
);

CREATE POLICY "Clients can manage own order items"
ON order_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.company_id IN (
      SELECT company_id FROM profiles WHERE profiles.id = auth.uid()
    )
    AND orders.status = 'draft'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.company_id IN (
      SELECT company_id FROM profiles WHERE profiles.id = auth.uid()
    )
  )
);

-- Add delivered status if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'delivered' 
    AND enumtypid = 'order_status'::regtype
  ) THEN
    ALTER TYPE order_status ADD VALUE 'delivered';
  END IF;
END $$;

COMMENT ON POLICY "Admins can view and manage all orders" ON orders IS 
'Allows admins and staff_admins to view and manage ALL orders from ALL companies';

