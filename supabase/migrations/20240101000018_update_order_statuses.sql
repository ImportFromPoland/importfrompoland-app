-- Update order status enum to match new status flow
-- Drop existing enum and recreate with new values

-- First, drop the existing enum constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Update the enum type
DROP TYPE IF EXISTS order_status CASCADE;

CREATE TYPE order_status AS ENUM (
  'draft', 
  'submitted', 
  'in_review', 
  'confirmed', 
  'paid',
  'partially_packed',
  'packed',
  'partially_dispatched',
  'dispatched',
  'partially_delivered',
  'delivered',
  'cancelled'
);

-- Add the enum back to the orders table
ALTER TABLE orders ALTER COLUMN status TYPE order_status USING status::text::order_status;

-- Add expected delivery date field
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_expected_delivery ON orders(expected_delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

