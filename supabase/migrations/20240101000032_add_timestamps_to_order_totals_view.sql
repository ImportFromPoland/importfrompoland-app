-- Add timestamp columns to order_totals view
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
  
  -- VAT amount (recalculated on adjusted net)
  (COALESCE(SUM(oit.line_net), 0) 
    - (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100)
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100)) * o.vat_rate / 100 AS vat_amount,
  
  -- Grand total (subtotal + VAT + shipping)
  (COALESCE(SUM(oit.line_net), 0) 
    - (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100)
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100)) * (1 + o.vat_rate / 100) + COALESCE(o.shipping_cost, 0) AS grand_total

FROM orders o
LEFT JOIN order_item_totals oit ON oit.order_id = o.id
GROUP BY o.id, o.number, o.status, o.currency, o.vat_rate, o.shipping_cost, 
         o.discount_percent, o.markup_percent, o.created_at, o.submitted_at, 
         o.confirmed_at, o.paid_at, o.dispatched_at, o.delivered_at;


