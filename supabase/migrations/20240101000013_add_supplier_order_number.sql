-- Add supplier order number field for warehouse tracking

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS supplier_order_number TEXT;

COMMENT ON COLUMN order_items.supplier_order_number IS 'Order number from the supplier (entered by warehouse staff)';

