-- Add discount_amount and discount_type fields to orders table
-- Allows admin to apply discount as percentage or fixed amount

-- Add discount_type field (defaults to 'percent' for backward compatibility)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percent' CHECK (discount_type IN ('percent', 'amount'));

-- Add discount_amount field (for fixed amount discounts)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0.00;

-- Update existing records to have discount_type = 'percent'
UPDATE orders 
SET discount_type = 'percent' 
WHERE discount_type IS NULL;

-- Update order_totals view to handle both discount types
DROP VIEW IF EXISTS order_totals;

CREATE VIEW order_totals AS
SELECT 
  o.id AS order_id,
  o.number,
  o.status,
  o.currency,
  o.vat_rate,
  o.shipping_cost,
  o.discount_percent AS header_discount_percent,
  o.discount_amount AS header_discount_amount,
  o.discount_type AS header_discount_type,
  o.markup_percent AS header_markup_percent,
  
  -- Timestamp columns for filtering
  o.created_at,
  o.submitted_at,
  o.confirmed_at,
  o.paid_at,
  o.dispatched_at,
  o.delivered_at,
  
  -- Sum of all line NETs (already VAT-excluded)
  COALESCE(SUM(oit.line_net), 0) AS items_net_before_header,
  
  -- Header discount amount calculation (percent or fixed amount)
  CASE 
    WHEN o.discount_type = 'amount' THEN COALESCE(o.discount_amount, 0)
    WHEN o.discount_type = 'percent' THEN COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100
    ELSE COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100
  END AS header_discount_amt,
  
  -- Header markup amount (applied to NET)
  COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100 AS header_markup_amt,
  
  -- Items NET after header discount/markup
  COALESCE(SUM(oit.line_net), 0) 
    - CASE 
        WHEN o.discount_type = 'amount' THEN COALESCE(o.discount_amount, 0)
        WHEN o.discount_type = 'percent' THEN COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100
        ELSE COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100
      END
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100) AS items_net,
  
  -- Subtotal without VAT (for display)
  COALESCE(SUM(oit.line_net), 0) 
    - CASE 
        WHEN o.discount_type = 'amount' THEN COALESCE(o.discount_amount, 0)
        WHEN o.discount_type = 'percent' THEN COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100
        ELSE COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100
      END
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100) AS subtotal_without_vat,
  
  -- VAT amount (recalculated on adjusted net)
  (COALESCE(SUM(oit.line_net), 0) 
    - CASE 
        WHEN o.discount_type = 'amount' THEN COALESCE(o.discount_amount, 0)
        WHEN o.discount_type = 'percent' THEN COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100
        ELSE COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100
      END
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100)) * o.vat_rate / 100 AS vat_amount,
  
  -- Grand total (subtotal + VAT + shipping)
  (COALESCE(SUM(oit.line_net), 0) 
    - CASE 
        WHEN o.discount_type = 'amount' THEN COALESCE(o.discount_amount, 0)
        WHEN o.discount_type = 'percent' THEN COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100
        ELSE COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100
      END
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100)) * (1 + o.vat_rate / 100) + COALESCE(o.shipping_cost, 0) AS grand_total

FROM orders o
LEFT JOIN order_item_totals oit ON oit.order_id = o.id
GROUP BY o.id, o.number, o.status, o.currency, o.vat_rate, o.shipping_cost, 
         o.discount_percent, o.discount_amount, o.discount_type, o.markup_percent, 
         o.created_at, o.submitted_at, o.confirmed_at, o.paid_at, o.dispatched_at, o.delivered_at;

COMMENT ON COLUMN orders.discount_type IS 'Type of discount: percent (percentage) or amount (fixed amount)';
COMMENT ON COLUMN orders.discount_amount IS 'Fixed discount amount in order currency (used when discount_type = amount)';
