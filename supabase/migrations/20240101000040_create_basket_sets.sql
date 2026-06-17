-- Pre-defined basket sets (templates) managed by superadmin (staff_admin).
-- Clients clone a set into a normal draft order via create_basket_from_set(code).

CREATE TABLE basket_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  default_currency currency_type NOT NULL DEFAULT 'EUR',
  default_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 23.00,
  default_client_notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT basket_sets_positive_vat CHECK (default_vat_rate >= 0)
);

-- Case-insensitive unique codes (trimmed); arbitrary text allowed.
CREATE UNIQUE INDEX idx_basket_sets_code_normalized
  ON basket_sets (lower(btrim(code)));

CREATE TABLE basket_set_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  basket_set_id UUID NOT NULL REFERENCES basket_sets(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  website_url TEXT,
  supplier_name TEXT,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1.000,
  currency currency_type NOT NULL DEFAULT 'PLN',
  unit_of_measure TEXT NOT NULL DEFAULT 'unit' CHECK (unit_of_measure IN ('unit', 'm2')),
  discount_percent NUMERIC(5,2) DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT basket_set_items_positive_price CHECK (unit_price > 0),
  CONSTRAINT basket_set_items_positive_quantity CHECK (quantity >= 0.001),
  UNIQUE (basket_set_id, line_number)
);

CREATE INDEX idx_basket_set_items_set ON basket_set_items(basket_set_id);

CREATE TRIGGER update_basket_sets_updated_at
  BEFORE UPDATE ON basket_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_basket_set_items_updated_at
  BEFORE UPDATE ON basket_set_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE basket_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE basket_set_items ENABLE ROW LEVEL SECURITY;

-- Only superadmin can manage sets (clients use RPC to clone).
CREATE POLICY "staff_admin_manage_basket_sets"
  ON basket_sets
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin'
  );

CREATE POLICY "staff_admin_manage_basket_set_items"
  ON basket_set_items
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin'
  );

-- Clone an active set into a draft order for the current user.
CREATE OR REPLACE FUNCTION public.create_basket_from_set(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid uuid;
  _company_id uuid;
  _set basket_sets%ROWTYPE;
  _order_id uuid;
  _item basket_set_items%ROWTYPE;
  _gross_eur numeric;
  _original_net numeric;
  _pln_to_eur constant numeric := 1.0 / 2.95;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF nullif(btrim(p_code), '') IS NULL THEN
    RAISE EXCEPTION 'Set code is required';
  END IF;

  SELECT company_id INTO _company_id
  FROM profiles
  WHERE id = _uid;

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Complete your profile before creating a basket';
  END IF;

  SELECT * INTO _set
  FROM basket_sets
  WHERE lower(btrim(code)) = lower(btrim(p_code))
    AND is_active = true
  LIMIT 1;

  IF _set.id IS NULL THEN
    RAISE EXCEPTION 'Basket set not found or inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM basket_set_items WHERE basket_set_id = _set.id
  ) THEN
    RAISE EXCEPTION 'Basket set has no items';
  END IF;

  INSERT INTO orders (
    company_id,
    created_by,
    status,
    currency,
    vat_rate,
    client_notes
  )
  VALUES (
    _company_id,
    _uid,
    'draft',
    _set.default_currency,
    _set.default_vat_rate,
    COALESCE(nullif(btrim(_set.default_client_notes), ''), _set.name)
  )
  RETURNING id INTO _order_id;

  FOR _item IN
    SELECT *
    FROM basket_set_items
    WHERE basket_set_id = _set.id
    ORDER BY line_number
  LOOP
    _original_net := NULL;
    IF _item.currency = 'PLN' AND _set.default_currency = 'EUR' THEN
      _gross_eur := _item.unit_price * _pln_to_eur;
      _original_net := _gross_eur / 1.23;
    ELSIF _item.currency = _set.default_currency THEN
      _original_net := _item.unit_price / 1.23;
    ELSE
      _original_net := _item.unit_price / 1.23;
    END IF;

    INSERT INTO order_items (
      order_id,
      line_number,
      product_name,
      website_url,
      supplier_name,
      original_supplier_name,
      unit_price,
      quantity,
      currency,
      fx_rate,
      unit_of_measure,
      discount_percent,
      notes,
      original_net_price
    )
    VALUES (
      _order_id,
      _item.line_number,
      _item.product_name,
      _item.website_url,
      _item.supplier_name,
      _item.supplier_name,
      _item.unit_price,
      _item.quantity,
      _item.currency,
      CASE
        WHEN _item.currency = 'PLN' AND _set.default_currency = 'EUR' THEN _pln_to_eur
        ELSE NULL
      END,
      _item.unit_of_measure,
      COALESCE(_item.discount_percent, 0),
      _item.notes,
      _original_net
    );
  END LOOP;

  RETURN _order_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_basket_from_set(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_basket_from_set(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_basket_from_set(text) TO authenticated;
