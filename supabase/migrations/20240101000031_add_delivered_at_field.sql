-- Add delivered_at field to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.delivered_at IS 'Timestamp when order was delivered to client';

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at);


