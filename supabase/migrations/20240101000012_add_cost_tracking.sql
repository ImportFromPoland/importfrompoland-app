-- Add cost tracking fields for internal profitability analysis

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS net_cost_pln NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_supplier TEXT,
ADD COLUMN IF NOT EXISTS logistics_cost_pln NUMERIC(12,2) DEFAULT 0;

-- Add logistics cost to orders table (for overall order logistics)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS logistics_cost NUMERIC(12,2) DEFAULT 0;

COMMENT ON COLUMN order_items.net_cost_pln IS 'Actual net cost in PLN paid to supplier (internal only)';
COMMENT ON COLUMN order_items.actual_supplier IS 'Actual supplier the item was ordered from';
COMMENT ON COLUMN order_items.logistics_cost_pln IS 'Internal logistics cost for this item in PLN (packing, delivery, etc)';
COMMENT ON COLUMN orders.logistics_cost IS 'Overall logistics cost for the order in EUR (internal only)';

