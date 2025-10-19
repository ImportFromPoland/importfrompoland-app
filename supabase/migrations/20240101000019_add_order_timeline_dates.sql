-- Add timeline date fields to orders table for better tracking

-- Add timeline date fields
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS complete_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_received_at ON orders(received_at);
CREATE INDEX IF NOT EXISTS idx_orders_complete_at ON orders(complete_at);
CREATE INDEX IF NOT EXISTS idx_orders_dispatched_at ON orders(dispatched_at);
