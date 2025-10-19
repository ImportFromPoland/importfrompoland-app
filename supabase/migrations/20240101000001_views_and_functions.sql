-- Views for order totals calculation
-- Critical: PLN to EUR conversion = PLN / 3.1

-- View: order_item_totals
-- Calculates per-line totals considering currency conversion
CREATE OR REPLACE VIEW order_item_totals AS
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
  
  -- Line subtotal in order currency (before discount, before VAT)
  CASE 
    WHEN oi.currency = o.currency THEN 
      oi.unit_price * oi.quantity
    WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
      -- Critical: PLN / 3.1 conversion (includes service + delivery)
      oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)
    ELSE 
      oi.unit_price * oi.quantity -- Fallback, should not happen in MVP
  END AS line_subtotal_ordcur,
  
  -- Line discount amount
  CASE 
    WHEN oi.currency = o.currency THEN 
      (oi.unit_price * oi.quantity) * COALESCE(oi.discount_percent, 0) / 100
    WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
      (oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)) * COALESCE(oi.discount_percent, 0) / 100
    ELSE 
      (oi.unit_price * oi.quantity) * COALESCE(oi.discount_percent, 0) / 100
  END AS line_discount_amt,
  
  -- Line net (after line discount, before VAT)
  CASE 
    WHEN oi.currency = o.currency THEN 
      (oi.unit_price * oi.quantity) * (1 - COALESCE(oi.discount_percent, 0) / 100)
    WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
      (oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)) * (1 - COALESCE(oi.discount_percent, 0) / 100)
    ELSE 
      (oi.unit_price * oi.quantity) * (1 - COALESCE(oi.discount_percent, 0) / 100)
  END AS line_net,
  
  -- VAT rate to use (line override or order default)
  COALESCE(oi.vat_rate_override, o.vat_rate) AS effective_vat_rate,
  
  -- Line VAT amount
  CASE 
    WHEN oi.currency = o.currency THEN 
      (oi.unit_price * oi.quantity) * (1 - COALESCE(oi.discount_percent, 0) / 100) * COALESCE(oi.vat_rate_override, o.vat_rate) / 100
    WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
      (oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * COALESCE(oi.vat_rate_override, o.vat_rate) / 100
    ELSE 
      (oi.unit_price * oi.quantity) * (1 - COALESCE(oi.discount_percent, 0) / 100) * COALESCE(oi.vat_rate_override, o.vat_rate) / 100
  END AS line_vat,
  
  -- Line gross (net + VAT)
  CASE 
    WHEN oi.currency = o.currency THEN 
      (oi.unit_price * oi.quantity) * (1 - COALESCE(oi.discount_percent, 0) / 100) * (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
    WHEN oi.currency = 'PLN' AND o.currency = 'EUR' THEN 
      (oi.unit_price * oi.quantity * COALESCE(oi.fx_rate, 0.3225806451612903)) * (1 - COALESCE(oi.discount_percent, 0) / 100) * (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
    ELSE 
      (oi.unit_price * oi.quantity) * (1 - COALESCE(oi.discount_percent, 0) / 100) * (1 + COALESCE(oi.vat_rate_override, o.vat_rate) / 100)
  END AS line_gross
  
FROM order_items oi
JOIN orders o ON oi.order_id = o.id;

-- View: order_totals
-- Aggregates all line totals and applies header-level modifiers
CREATE OR REPLACE VIEW order_totals AS
SELECT 
  o.id AS order_id,
  o.number,
  o.status,
  o.currency,
  o.vat_rate,
  o.shipping_cost,
  o.discount_percent AS header_discount_percent,
  o.markup_percent AS header_markup_percent,
  
  -- Sum of all line nets
  COALESCE(SUM(oit.line_net), 0) AS items_net_before_header,
  
  -- Header discount amount
  COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100 AS header_discount_amt,
  
  -- Header markup amount
  COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100 AS header_markup_amt,
  
  -- Items net after header discount/markup
  COALESCE(SUM(oit.line_net), 0) 
    - (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100)
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100) AS items_net,
  
  -- VAT amount (recalculated on adjusted net)
  (COALESCE(SUM(oit.line_net), 0) 
    - (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100)
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100)) * o.vat_rate / 100 AS vat_amount,
  
  -- Items gross
  (COALESCE(SUM(oit.line_net), 0) 
    - (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100)
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100)) * (1 + o.vat_rate / 100) AS items_gross,
  
  -- Shipping cost (no extra shipping for PLN items, only admin-set header shipping)
  o.shipping_cost,
  
  -- Grand total
  (COALESCE(SUM(oit.line_net), 0) 
    - (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.discount_percent, 0) / 100)
    + (COALESCE(SUM(oit.line_net), 0) * COALESCE(o.markup_percent, 0) / 100)) * (1 + o.vat_rate / 100) + o.shipping_cost AS grand_total
  
FROM orders o
LEFT JOIN order_item_totals oit ON o.id = oit.order_id
GROUP BY o.id, o.number, o.status, o.currency, o.vat_rate, o.shipping_cost, o.discount_percent, o.markup_percent;

-- Function: Generate next order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  year_part TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 'ORD-' || year_part || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_num
  FROM orders
  WHERE number LIKE 'ORD-' || year_part || '-%';
  
  RETURN 'ORD-' || year_part || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-set FX rate for PLN items
CREATE OR REPLACE FUNCTION set_fx_rate_on_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.currency = 'PLN' THEN
    -- PLN to EUR rate: 1 / 3.1 (includes service + delivery to Ireland)
    NEW.fx_rate := 0.3225806451612903;
  ELSE
    NEW.fx_rate := NULL; -- EUR items don't need conversion
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_fx_rate_before_insert_or_update
BEFORE INSERT OR UPDATE ON order_items
FOR EACH ROW
EXECUTE FUNCTION set_fx_rate_on_item();

