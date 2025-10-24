-- Fix RLS policy to allow clients to delete their own draft orders

-- Drop the existing delete policy
DROP POLICY IF EXISTS "delete_orders" ON orders;

-- Create new delete policy that allows clients to delete their own draft orders
CREATE POLICY "delete_orders"
ON orders
FOR DELETE
TO authenticated
USING (
  -- Admins can delete anything
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  -- Clients can delete their own draft orders
  (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND status = 'draft'
  )
);

-- Also ensure order_items can be deleted by clients for their own draft orders
DROP POLICY IF EXISTS "delete_order_items" ON order_items;

CREATE POLICY "delete_order_items"
ON order_items
FOR DELETE
TO authenticated
USING (
  -- Admins can delete anything
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  -- Clients can delete order items from their own draft orders
  order_id IN (
    SELECT id FROM orders 
    WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND status = 'draft'
  )
);


