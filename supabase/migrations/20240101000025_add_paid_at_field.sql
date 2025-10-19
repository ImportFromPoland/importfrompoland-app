-- Add paid_at field to orders table for payment tracking

-- Add paid_at field to track when payment was received
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at);

-- Add comment
COMMENT ON COLUMN orders.paid_at IS 'Timestamp when payment was received for the order';
