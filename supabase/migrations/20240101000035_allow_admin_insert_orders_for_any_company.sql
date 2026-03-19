-- Allow admin/staff_admin to create orders for any client company
-- Fix: insert_orders policy was too restrictive - admins couldn't create baskets for clients

DROP POLICY IF EXISTS "insert_orders" ON orders;

CREATE POLICY "insert_orders"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (
  -- Admin/staff_admin can insert orders for ANY company
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  -- Clients can insert only for their own company
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);
