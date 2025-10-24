-- Add transport cost field for profitability calculations
-- This is internal cost not visible to clients

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS transport_cost_pln DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN orders.transport_cost_pln IS 'Transport cost in PLN for profitability calculations (internal use only)';


