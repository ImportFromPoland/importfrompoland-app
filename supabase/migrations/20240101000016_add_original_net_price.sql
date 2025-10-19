-- Add original_net_price field to store the net price calculated from the original gross price
-- This allows us to maintain the same net price when VAT rate changes

ALTER TABLE order_items 
ADD COLUMN original_net_price DECIMAL(10,2);

-- Update existing records to calculate original_net_price
-- For existing records, we'll calculate it from the current unit_price assuming 23% VAT
UPDATE order_items 
SET original_net_price = 
  CASE 
    WHEN currency = 'PLN' THEN 
      (unit_price * 0.3225806451612903) / 1.23  -- Convert PLN to EUR and remove 23% VAT
    ELSE 
      unit_price / 1.23  -- Remove 23% VAT from EUR price
  END
WHERE original_net_price IS NULL;

