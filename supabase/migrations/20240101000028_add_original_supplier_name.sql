-- Add original supplier name field to order_items table
-- This stores what the client originally selected, while supplier_name can be changed by procurement

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS original_supplier_name TEXT;

COMMENT ON COLUMN order_items.original_supplier_name IS 'Original supplier name entered by client, preserved for client view';

-- Update existing records to set original_supplier_name = supplier_name
UPDATE order_items 
SET original_supplier_name = supplier_name 
WHERE original_supplier_name IS NULL AND supplier_name IS NOT NULL;
