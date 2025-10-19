-- Add planned delivery date field to orders table

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS planned_delivery_date DATE;

CREATE INDEX IF NOT EXISTS idx_orders_planned_delivery_date ON orders(planned_delivery_date);

COMMENT ON COLUMN orders.planned_delivery_date IS 'Planned delivery date set by warehouse or admin';
