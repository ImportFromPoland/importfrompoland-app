-- Fix VAT calculation for 0% VAT rate
-- When VAT = 0%, price from Polish website should be treated as NET price, not GROSS

-- Drop existing views first to avoid column name conflicts
DROP VIEW IF EXISTS order_totals CASCADE;
DROP VIEW IF EXISTS order_item_totals CASCADE;

-- View: order_item_totals
-- Calculates per-line totals correctly from GROSS input prices (when VAT > 0%) or NET input prices (when VAT = 0%)
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
  o.currency AS order_currency,
  o.vat_rate AS order_vat_rate,
  
  -- Effective VAT rate to use (line override or order default)
  COALESCE(oi.vat_rate_override, o.vat_rate) AS effective_vat_rate,
  
  -- Step 1: Convert to EUR
  CASE 
    WHEN oi.currency = o.currency THEN 
      oi.unit_price * oi.quantity
    WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
      -- PLN / 3.1 gives us EUR
      oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)
    ELSE 
      oi.unit_price * oi.quantity
  END AS line_gross_before_discount,
  
  -- Step 2: Calculate NET price
  -- Always treat price from Polish website as GROSS price
  -- Calculate NET from GROSS: NET = GROSS / (1 + VAT%)
  -- This works for both VAT > 0% and VAT = 0%
  CASE 
    WHEN oi.currency = o.currency THEN 
      (oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
    WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
      (oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
    ELSE 
      (oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
  END AS line_net_before_discount,
  
  -- Step 3: Apply line discount to NET
  -- Apply discount to calculated NET (works for both VAT > 0% and VAT = 0%)
  CASE 
    WHEN oi.currency = o.currency THEN 
      ((oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100)
    WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
      ((oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100)
    ELSE 
      ((oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100)
  END AS line_net,
  
  -- Line VAT amount (calculated from NET)
  -- Calculate VAT from NET (works for both VAT > 0% and VAT = 0%)
  CASE 
    WHEN oi.currency = o.currency THEN 
      ((oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * COALESCE(oi.vat_rate_override, o.vat_rate) / 100
    WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
      ((oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * COALESCE(oi.vat_rate_override, o.vat_rate) / 100
    ELSE 
      ((oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * COALESCE(oi.vat_rate_override, o.vat_rate) / 100
  END AS line_vat,
  
  -- Line GROSS (NET + VAT)
  -- GROSS = NET + VAT (works for both VAT > 0% and VAT = 0%)
  CASE 
    WHEN oi.currency = o.currency THEN 
      ((oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
    WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
      ((oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
    ELSE 
      ((oi.unit_price * oi.quantity) / (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
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
