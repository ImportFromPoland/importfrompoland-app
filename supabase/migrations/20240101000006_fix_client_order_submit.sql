-- Fix RLS policy to allow clients to submit their own draft orders
-- Drop the old client update policy
DROP POLICY IF EXISTS "Clients can update own draft orders" ON orders;

-- Create new policy that allows clients to update their own orders
-- Specifically allowing status transition from draft to submitted
CREATE POLICY "Clients can update own orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    status = 'draft'  -- Can update draft orders
    OR (
      -- Can update from draft to submitted
      status = 'draft' 
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
  AND (
    status = 'draft' OR status = 'submitted'  -- Can only set to draft or submitted
  )
);

-- Also ensure clients can update the number and submitted_at fields
-- The existing policy should handle this, but let's be explicit
COMMENT ON POLICY "Clients can update own orders" ON orders IS 
'Allows clients to update their own draft orders and submit them (change status to submitted)';

