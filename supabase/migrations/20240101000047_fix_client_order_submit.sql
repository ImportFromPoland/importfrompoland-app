-- Ensure client submit fields exist (safe to re-run if 45 was skipped)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS prefers_bank_transfer BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN orders.prefers_bank_transfer IS
  'Client opted for bank transfer payment (+1% volume discount); payment link omitted on confirmation';

-- Re-assert client draft → submitted update policy (idempotent)
DROP POLICY IF EXISTS "update_orders" ON orders;

CREATE POLICY "update_orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND status = 'draft'
  )
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND status IN ('draft', 'submitted')
  )
);
