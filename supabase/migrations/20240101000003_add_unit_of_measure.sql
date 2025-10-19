-- Add unit_of_measure column to order_items table

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS unit_of_measure TEXT DEFAULT 'unit' CHECK (unit_of_measure IN ('unit', 'm2'));

-- Update existing rows to have default value
UPDATE order_items SET unit_of_measure = 'unit' WHERE unit_of_measure IS NULL;

