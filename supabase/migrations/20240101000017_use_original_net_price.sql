-- Update views to use original_net_price when available
-- This ensures that when VAT rate changes, the net price remains the same

-- Drop existing views first to avoid column name conflicts
DROP VIEW IF EXISTS order_totals CASCADE;
DROP VIEW IF EXISTS order_item_totals CASCADE;

-- View: order_item_totals
-- Uses original_net_price when available, otherwise calculates from current gross price
CREATE VIEW order_item_totals AS
SELECT 
  oi.id,
  oi.order_id,
  oi.line_number,
  oi.product_name,
  oi.unit_price,
  oi.quantity,
  oi.currency,
  oi.fx_rate,
  oi.discount_percent,
  oi.vat_rate_override,
  oi.original_net_price,
  o.currency AS order_currency,
  o.vat_rate AS order_vat_rate,
  
  -- Effective VAT rate to use (line override or order default)
  COALESCE(oi.vat_rate_override, o.vat_rate) AS effective_vat_rate,
  
  -- Step 1: Convert to EUR (GROSS)
  CASE 
    WHEN oi.currency = o.currency THEN 
      oi.unit_price * oi.quantity
    WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
      -- PLN / 3.1 gives us GROSS EUR (incl. VAT)
      oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)
    ELSE 
      oi.unit_price * oi.quantity
  END AS line_gross_before_discount,
  
  -- Step 2: Calculate NET price
  -- Use original_net_price if available, otherwise calculate from current gross price
  CASE 
    WHEN oi.original_net_price IS NOT NULL THEN
      -- Use stored original net price (maintains consistency when VAT changes)
      oi.original_net_price * oi.quantity
    ELSE
      -- Calculate NET from current GROSS price
      CASE 
        WHEN oi.currency = o.currency THEN 
          (oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
        WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
          (oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
        ELSE 
          (oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
      END
  END AS line_net_before_discount,
  
  -- Step 3: Apply line discount to NET
  CASE 
    WHEN oi.original_net_price IS NOT NULL THEN
      -- Apply discount to original net price
      (oi.original_net_price * oi.quantity) * (1 - COALESCE(oi.discount_percent, 0) / 100)
    ELSE
      -- Apply discount to calculated net price
      CASE 
        WHEN oi.currency = o.currency THEN 
          ((oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100)
        WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
          ((oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100)
        ELSE 
          ((oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100)
      END
  END AS line_net,
  
  -- Line VAT amount (calculated from NET)
  CASE 
    WHEN oi.original_net_price IS NOT NULL THEN
      -- Calculate VAT from original net price
      (oi.original_net_price * oi.quantity) * (1 - COALESCE(oi.discount_percent, 0) / 100) * COALESCE(oi.vat_rate_override, o.vat_rate) / 100
    ELSE
      -- Calculate VAT from calculated net price
      CASE 
        WHEN oi.currency = o.currency THEN 
          ((oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * COALESCE(oi.vat_rate_override, o.vat_rate) / 100
        WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
          ((oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * COALESCE(oi.vat_rate_override, o.vat_rate) / 100
        ELSE 
          ((oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * COALESCE(oi.vat_rate_override, o.vat_rate) / 100
      END
  END AS line_vat,
  
  -- Line GROSS (NET + VAT)
  CASE 
    WHEN oi.original_net_price IS NOT NULL THEN
      -- Calculate GROSS from original net price
      (oi.original_net_price * oi.quantity) * (1 - COALESCE(oi.discount_percent, 0) / 100) * (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
    ELSE
      -- Calculate GROSS from calculated net price
      CASE 
        WHEN oi.currency = o.currency THEN 
          ((oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
        WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
          ((oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
        ELSE 
          ((oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
      END
  END AS line_gross,
  
  -- Backwards compatible field names (map to correct values)
  CASE 
    WHEN oi.currency = o.currency THEN 
      oi.unit_price * oi.quantity
    WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
      oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)
    ELSE 
      oi.unit_price * oi.quantity
  END AS line_subtotal_ordcur
  
FROM order_items oi
JOIN orders o ON oi.order_id = o.id;

-- View: order_totals
-- Aggregates all line totals and applies header-level modifiers
CREATE VIEW order_totals AS
SELECT 
  o.id AS order_id,
  o.number,
  o.status,
  o.currency,
  o.vat_rate,
  o.shipping_cost,
  o.discount_percent AS header_discount_percent,
  o.markup_percent AS header_markup_percent,
  
  -- Sum of all line NETs (already VAT-excluded)
  COALESCE(SUM(oit.line_net), 0) AS items_net_before_header,
  
  -- Header discount amount (applied to NET)
  COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100 AS header_discount_amt,
  
  -- Header markup amount (applied to NET)
  COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100 AS header_markup_amt,
  
  -- Items NET after header discount/markup
  COALESCE(SUM(oit.line_net), 0) 
    - (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100)
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100) AS items_net,
  
  -- Subtotal without VAT (for display)
  COALESCE(SUM(oit.line_net), 0) 
    - (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100)
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100) AS subtotal_without_vat,
  
  -- VAT amount (calculated on adjusted NET)
  (COALESCE(SUM(oit.line_net), 0) 
    - (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100)
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100)) * o.vat_rate / 100 AS vat_amount,
  
  -- Items GROSS (NET + VAT)
  (COALESCE(SUM(oit.line_net), 0) 
    - (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100)
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100)) * (1 + o.vat_rate / 100) AS items_gross,
  
  -- Grand total (NET + VAT + Shipping)
  (COALESCE(SUM(oit.line_net), 0) 
    - (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100)
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100)) * (1 + o.vat_rate / 100) + o.shipping_cost AS grand_total
  
FROM orders o
LEFT JOIN order_item_totals oit ON o.id = oit.order_id
GROUP BY o.id, o.number, o.status, o.currency, o.vat_rate, o.shipping_cost, o.discount_percent, o.markup_percent;

