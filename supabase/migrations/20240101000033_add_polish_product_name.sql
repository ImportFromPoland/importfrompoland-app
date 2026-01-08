-- Add polish_product_name field to order_items table
-- This stores the Polish product name for warehouse use, while product_name remains the client's original entry

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS polish_product_name TEXT;

COMMENT ON COLUMN order_items.polish_product_name IS 'Polish product name for warehouse use, can be set by procurement staff';
