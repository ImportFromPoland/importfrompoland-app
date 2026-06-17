-- Treat individual_offer_lines.amount as NET EUR (was incorrectly interpreted as gross in accept RPC).

CREATE OR REPLACE FUNCTION public.accept_individual_offer(p_version_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid UUID;
  _company_id UUID;
  _version individual_offer_versions%ROWTYPE;
  _offer individual_offers%ROWTYPE;
  _order_id UUID;
  _line individual_offer_lines%ROWTYPE;
  _line_no INTEGER := 0;
  _items_net NUMERIC(12,2) := 0;
  _vat_amount NUMERIC(12,2) := 0;
  _line_net NUMERIC(12,2);
  _line_vat NUMERIC(12,2);
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _version FROM individual_offer_versions WHERE id = p_version_id;
  IF _version.id IS NULL THEN
    RAISE EXCEPTION 'Offer version not found';
  END IF;

  SELECT * INTO _offer FROM individual_offers WHERE id = _version.offer_id;

  SELECT company_id INTO _company_id FROM profiles WHERE id = _uid;
  IF _company_id IS NULL OR _company_id <> _offer.company_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _version.id IS DISTINCT FROM _offer.current_version_id THEN
    RAISE EXCEPTION 'Only the current offer version can be accepted';
  END IF;

  IF _version.status NOT IN ('sent', 'viewed') THEN
    RAISE EXCEPTION 'Offer cannot be accepted in status: %', _version.status;
  END IF;

  IF _version.valid_until < CURRENT_DATE THEN
    RAISE EXCEPTION 'Offer has expired';
  END IF;

  IF _version.order_id IS NOT NULL THEN
    RAISE EXCEPTION 'Offer already accepted';
  END IF;

  INSERT INTO orders (
    number,
    company_id,
    created_by,
    status,
    currency,
    vat_rate,
    client_notes,
    admin_notes,
    source,
    offer_version_id,
    payment_link_url
  )
  VALUES (
    generate_order_number(),
    _offer.company_id,
    _uid,
    'submitted',
    'EUR',
    23.00,
    COALESCE(_version.client_notes, _version.title),
    _version.admin_notes,
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
    _line_net := _line.amount;
    _line_vat := _line.amount * (_line.vat_rate / 100);
    _items_net := _items_net + _line_net;
    _vat_amount := _vat_amount + _line_vat;

    INSERT INTO order_items (
      order_id,
      line_number,
      product_name,
      unit_price,
      quantity,
      currency,
      unit_of_measure,
      notes,
      original_net_price,
      vat_rate_override
    )
    VALUES (
      _order_id,
      _line_no,
      _line.label,
      _line_net * (1 + _line.vat_rate / 100),
      1,
      'EUR',
      'unit',
      _line.notes,
      _line_net,
      _line.vat_rate
    );
  END LOOP;

  UPDATE individual_offer_versions
  SET status = 'accepted',
      accepted_at = NOW(),
      order_id = _order_id
  WHERE id = _version.id;

  RETURN _order_id;
END;
$fn$;

COMMENT ON COLUMN individual_offer_lines.amount IS 'Line amount in EUR, NET (ex VAT)';
