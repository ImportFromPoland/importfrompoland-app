-- Add tracking columns to order_items for warehouse workflow
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS ordered_from_supplier BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ordered_from_supplier_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS received_in_warehouse BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS received_in_warehouse_at TIMESTAMPTZ;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_order_items_ordered ON order_items(ordered_from_supplier);
CREATE INDEX IF NOT EXISTS idx_order_items_received ON order_items(received_in_warehouse);

-- Add new order statuses for the workflow
-- confirmed: Admin has confirmed the order
-- partially_received: Some items received in warehouse
-- ready_to_ship: All items received, ready for dispatch
-- shipped: Order has been dispatched
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'partially_received';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_to_ship';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'shipped';

COMMENT ON COLUMN order_items.ordered_from_supplier IS 'Admin has ordered this item from the supplier';
COMMENT ON COLUMN order_items.received_in_warehouse IS 'Item has been received in the warehouse';

