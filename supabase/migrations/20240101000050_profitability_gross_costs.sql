-- Profitability model v2:
-- order_items.net_cost_pln stores GROSS purchase PLN (UI: koszt brutto)
-- order_side_costs: multiple PL incidental costs (gross PLN) per client order
-- orders.ie_delivery_cost_eur: one Ireland delivery cost (EUR)

COMMENT ON COLUMN order_items.net_cost_pln IS
  'Purchase cost GROSS PLN per unit (as paid to supplier). Net for P&L = value / 1.23.';

-- Backfill: purchase cost = client basket PLN price
UPDATE order_items
SET net_cost_pln = unit_price
WHERE currency = 'PLN'
  AND unit_price IS NOT NULL
  AND unit_price > 0;

-- Ireland delivery cost (one per order, EUR)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ie_delivery_cost_eur NUMERIC(12,2) DEFAULT 0;

COMMENT ON COLUMN orders.ie_delivery_cost_eur IS
  'Internal cost of delivery to Ireland (EUR). Entered in Logistyka, often after dispatch.';

-- Multiple incidental / side costs (PL procurement: shop deliveries, etc.)
CREATE TABLE IF NOT EXISTS order_side_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_gross_pln NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (amount_gross_pln >= 0),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_side_costs_order
  ON order_side_costs(order_id);

COMMENT ON TABLE order_side_costs IS
  'Extra PL costs for a client order (e.g. multiple shop deliveries). Amounts are GROSS PLN.';

ALTER TABLE order_side_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_order_side_costs" ON order_side_costs;
CREATE POLICY "admin_all_order_side_costs"
  ON order_side_costs FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  );
