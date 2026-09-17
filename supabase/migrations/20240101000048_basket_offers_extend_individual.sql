-- Extend individual offers for basket-style line items + archive + guest snapshot

-- Guest / snapshot customer fields (platform account optional)
ALTER TABLE individual_offers
  ADD COLUMN IF NOT EXISTS source_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_kind TEXT NOT NULL DEFAULT 'package'
    CHECK (offer_kind IN ('package', 'basket')),
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT,
  ADD COLUMN IF NOT EXISTS guest_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS guest_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS guest_city TEXT,
  ADD COLUMN IF NOT EXISTS guest_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS guest_country TEXT;

CREATE INDEX IF NOT EXISTS idx_individual_offers_source_order
  ON individual_offers(source_order_id);

-- Basket-style fields on offer lines (package offers keep amount NET; qty null)
ALTER TABLE individual_offer_lines
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS unit_of_measure TEXT,
  ADD COLUMN IF NOT EXISTS unit_price_net NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS specification TEXT;

COMMENT ON COLUMN individual_offer_lines.amount IS
  'Line amount in EUR, NET (ex VAT). For basket lines = qty * unit_price_net.';
COMMENT ON COLUMN individual_offer_lines.unit_price_net IS
  'Unit NET EUR for basket-style lines; package lines may leave null and use amount only.';

-- Allow archived status on versions
ALTER TABLE individual_offer_versions
  DROP CONSTRAINT IF EXISTS individual_offer_versions_status_check;

ALTER TABLE individual_offer_versions
  ADD CONSTRAINT individual_offer_versions_status_check CHECK (
    status IN (
      'draft',
      'sent',
      'viewed',
      'accepted',
      'expired',
      'superseded',
      'rejected',
      'cancelled',
      'archived'
    )
  );

-- Admin converts offer → submitted order (idempotent)
CREATE OR REPLACE FUNCTION public.admin_confirm_offer_as_order(p_version_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _version individual_offer_versions%ROWTYPE;
  _offer individual_offers%ROWTYPE;
  _order_id UUID;
  _line individual_offer_lines%ROWTYPE;
  _company_id UUID;
  _created_by UUID;
  _actor_role TEXT;
  _qty NUMERIC;
  _unit TEXT;
  _net NUMERIC;
  _gross NUMERIC;
  _vat NUMERIC;
  _line_no INT := 0;
  _product TEXT;
BEGIN
  SELECT role INTO _actor_role FROM profiles WHERE id = auth.uid();
  IF _actor_role IS NULL OR _actor_role NOT IN ('admin', 'staff_admin') THEN
    RAISE EXCEPTION 'Only admins can confirm offers as orders';
  END IF;

  SELECT * INTO _version FROM individual_offer_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer version not found';
  END IF;

  -- Idempotent: already converted
  IF _version.order_id IS NOT NULL THEN
    RETURN _version.order_id;
  END IF;

  IF _version.status = 'archived' THEN
    RAISE EXCEPTION 'Cannot convert an archived offer';
  END IF;

  SELECT * INTO _offer FROM individual_offers WHERE id = _version.offer_id;

  IF _actor_role = 'admin' AND _offer.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to convert another admin''s offer';
  END IF;

  _company_id := _offer.company_id;
  _created_by := COALESCE(_offer.client_profile_id, _offer.owner_id);

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Offer has no company — link a customer or create a placeholder company first';
  END IF;

  INSERT INTO orders (
    number,
    company_id,
    created_by,
    status,
    currency,
    vat_rate,
    shipping_cost,
    discount_percent,
    client_notes,
    submitted_at,
    source,
    offer_version_id,
    payment_link_url
  ) VALUES (
    generate_order_number(),
    _company_id,
    _created_by,
    'submitted',
    'EUR',
    23,
    0,
    0,
    COALESCE(_version.client_notes, _version.title),
    NOW(),
    'individual_offer',
    _version.id,
    _version.payment_link_url
  )
  RETURNING id INTO _order_id;

  FOR _line IN
    SELECT * FROM individual_offer_lines
    WHERE offer_version_id = _version.id
    ORDER BY line_number
  LOOP
    _line_no := _line_no + 1;
    _qty := COALESCE(NULLIF(_line.quantity, 0), 1);
    _unit := COALESCE(NULLIF(_line.unit_of_measure, ''), 'unit');
    _vat := COALESCE(_line.vat_rate, 23);
    _product := COALESCE(NULLIF(_line.product_name, ''), NULLIF(_line.label, ''), 'Item');

    IF _line.unit_price_net IS NOT NULL THEN
      _net := _line.unit_price_net;
    ELSIF _line.amount IS NOT NULL AND _qty > 0 THEN
      _net := _line.amount / _qty;
    ELSE
      _net := COALESCE(_line.amount, 0);
      _qty := 1;
    END IF;

    _gross := _net * (1 + _vat / 100);

    INSERT INTO order_items (
      order_id,
      line_number,
      product_name,
      supplier_name,
      website_url,
      unit_price,
      quantity,
      currency,
      unit_of_measure,
      discount_percent,
      notes,
      original_net_price,
      vat_rate_override
    ) VALUES (
      _order_id,
      _line_no,
      _product,
      _line.supplier_name,
      _line.website_url,
      _gross,
      _qty,
      'EUR',
      CASE WHEN _unit IN ('m2', 'm²') THEN 'm2' ELSE 'unit' END,
      0,
      COALESCE(_line.notes, _line.specification),
      _net,
      _vat
    );
  END LOOP;

  UPDATE individual_offer_versions
  SET status = 'accepted',
      accepted_at = NOW(),
      order_id = _order_id
  WHERE id = _version.id;

  RETURN _order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_confirm_offer_as_order(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_confirm_offer_as_order(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_confirm_offer_as_order(UUID) FROM anon;

-- Admin archive offer version
CREATE OR REPLACE FUNCTION public.admin_archive_offer(p_version_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _version individual_offer_versions%ROWTYPE;
  _offer individual_offers%ROWTYPE;
  _actor_role TEXT;
BEGIN
  SELECT role INTO _actor_role FROM profiles WHERE id = auth.uid();
  IF _actor_role IS NULL OR _actor_role NOT IN ('admin', 'staff_admin') THEN
    RAISE EXCEPTION 'Only admins can archive offers';
  END IF;

  SELECT * INTO _version FROM individual_offer_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer version not found';
  END IF;

  IF _version.order_id IS NOT NULL OR _version.status = 'accepted' THEN
    RAISE EXCEPTION 'Converted offers cannot be archived';
  END IF;

  SELECT * INTO _offer FROM individual_offers WHERE id = _version.offer_id;
  IF _actor_role = 'admin' AND _offer.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to archive another admin''s offer';
  END IF;

  UPDATE individual_offer_versions
  SET status = 'archived'
  WHERE id = p_version_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_archive_offer(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_archive_offer(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_archive_offer(UUID) FROM anon;
