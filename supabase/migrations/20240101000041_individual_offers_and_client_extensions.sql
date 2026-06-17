-- Individual offers module (additive — existing supply orders unchanged).
-- source defaults to 'supply' on all existing orders.

-- Profile extensions
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email_is_placeholder BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_prefix TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gdpr_erased_at TIMESTAMPTZ;

-- Order extensions (nullable / defaulted — safe for existing rows)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'supply',
  ADD COLUMN IF NOT EXISTS offer_version_id UUID,
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_source_check CHECK (source IN ('supply', 'individual_offer'));

CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_offer_version ON orders(offer_version_id);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at);

-- Individual offer (one row per offer number line, e.g. OFR MN/001/06/2026)
CREATE TABLE individual_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_number TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  current_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT individual_offers_offer_number_unique UNIQUE (offer_number)
);

CREATE INDEX idx_individual_offers_owner ON individual_offers(owner_id);
CREATE INDEX idx_individual_offers_company ON individual_offers(company_id);

-- Versions (v1, v2, … — client sees only current)
CREATE TABLE individual_offer_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES individual_offers(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until DATE NOT NULL,
  title TEXT NOT NULL,
  client_notes TEXT,
  admin_notes TEXT,
  payment_link_url TEXT,
  pdf_storage_path TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT individual_offer_versions_status_check CHECK (
    status IN ('draft', 'sent', 'viewed', 'accepted', 'expired', 'superseded', 'rejected', 'cancelled')
  ),
  CONSTRAINT individual_offer_versions_unique_version UNIQUE (offer_id, version_number)
);

CREATE INDEX idx_individual_offer_versions_offer ON individual_offer_versions(offer_id);
CREATE INDEX idx_individual_offer_versions_status ON individual_offer_versions(status);

ALTER TABLE individual_offers
  ADD CONSTRAINT fk_individual_offers_current_version
  FOREIGN KEY (current_version_id) REFERENCES individual_offer_versions(id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_offer_version
  FOREIGN KEY (offer_version_id) REFERENCES individual_offer_versions(id) ON DELETE SET NULL;

-- Summary lines (option 1 — not per-window itemised)
CREATE TABLE individual_offer_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_version_id UUID NOT NULL REFERENCES individual_offer_versions(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 23.00,
  notes TEXT,
  CONSTRAINT individual_offer_lines_positive_amount CHECK (amount >= 0),
  UNIQUE (offer_version_id, line_number)
);

-- External specification links (Google Drive etc.)
CREATE TABLE individual_offer_spec_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_version_id UUID NOT NULL REFERENCES individual_offer_versions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TRIGGER update_individual_offers_updated_at
  BEFORE UPDATE ON individual_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate offer number: OFR {PREFIX}/{SEQ}/{MM}/{YYYY}
CREATE OR REPLACE FUNCTION public.generate_individual_offer_number(p_owner_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _prefix TEXT;
  _seq INTEGER;
  _month TEXT;
  _year TEXT;
BEGIN
  SELECT UPPER(COALESCE(NULLIF(BTRIM(offer_prefix), ''), 'MN'))
  INTO _prefix
  FROM profiles
  WHERE id = p_owner_id;

  IF _prefix IS NULL THEN
    _prefix := 'MN';
  END IF;

  _month := TO_CHAR(NOW(), 'MM');
  _year := TO_CHAR(NOW(), 'YYYY');

  SELECT COUNT(*) + 1
  INTO _seq
  FROM individual_offers io
  WHERE io.owner_id = p_owner_id
    AND TO_CHAR(io.created_at, 'MM') = _month
    AND TO_CHAR(io.created_at, 'YYYY') = _year;

  RETURN 'OFR ' || _prefix || '/' || LPAD(_seq::TEXT, 3, '0') || '/' || _month || '/' || _year;
END;
$fn$;

-- Client accepts current offer version → creates order (same pipeline as supply).
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
    _items_net := _items_net + (_line.amount / (1 + _line.vat_rate / 100));
    _vat_amount := _vat_amount + (_line.amount - (_line.amount / (1 + _line.vat_rate / 100)));

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
      _line.amount,
      1,
      'EUR',
      'unit',
      _line.notes,
      _line.amount / (1 + _line.vat_rate / 100),
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

-- RLS
ALTER TABLE individual_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_offer_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_offer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_offer_spec_links ENABLE ROW LEVEL SECURITY;

-- Offers: superadmin all; admin own; client read own company current offer only
CREATE POLICY "staff_admin_all_individual_offers"
  ON individual_offers FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin');

CREATE POLICY "admin_own_individual_offers"
  ON individual_offers FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND owner_id = auth.uid()
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND owner_id = auth.uid()
  );

CREATE POLICY "clients_read_own_individual_offers"
  ON individual_offers FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Versions
CREATE POLICY "staff_admin_all_offer_versions"
  ON individual_offer_versions FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin');

CREATE POLICY "admin_own_offer_versions"
  ON individual_offer_versions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM individual_offers o
      WHERE o.id = individual_offer_versions.offer_id
        AND o.owner_id = auth.uid()
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM individual_offers o
      WHERE o.id = individual_offer_versions.offer_id
        AND o.owner_id = auth.uid()
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

CREATE POLICY "clients_read_current_offer_versions"
  ON individual_offer_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM individual_offers o
      WHERE o.id = individual_offer_versions.offer_id
        AND o.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        AND o.current_version_id = individual_offer_versions.id
        AND individual_offer_versions.status IN ('sent', 'viewed', 'accepted')
    )
  );

-- Lines & spec links: mirror version access
CREATE POLICY "staff_admin_all_offer_lines"
  ON individual_offer_lines FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin');

CREATE POLICY "admin_own_offer_lines"
  ON individual_offer_lines FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM individual_offer_versions v
      JOIN individual_offers o ON o.id = v.offer_id
      WHERE v.id = individual_offer_lines.offer_version_id
        AND o.owner_id = auth.uid()
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM individual_offer_versions v
      JOIN individual_offers o ON o.id = v.offer_id
      WHERE v.id = individual_offer_lines.offer_version_id
        AND o.owner_id = auth.uid()
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

CREATE POLICY "clients_read_current_offer_lines"
  ON individual_offer_lines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM individual_offer_versions v
      JOIN individual_offers o ON o.id = v.offer_id
      WHERE v.id = individual_offer_lines.offer_version_id
        AND o.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        AND o.current_version_id = v.id
    )
  );

CREATE POLICY "staff_admin_all_spec_links"
  ON individual_offer_spec_links FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin');

CREATE POLICY "admin_own_spec_links"
  ON individual_offer_spec_links FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM individual_offer_versions v
      JOIN individual_offers o ON o.id = v.offer_id
      WHERE v.id = individual_offer_spec_links.offer_version_id
        AND o.owner_id = auth.uid()
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM individual_offer_versions v
      JOIN individual_offers o ON o.id = v.offer_id
      WHERE v.id = individual_offer_spec_links.offer_version_id
        AND o.owner_id = auth.uid()
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

CREATE POLICY "clients_read_current_spec_links"
  ON individual_offer_spec_links FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM individual_offer_versions v
      JOIN individual_offers o ON o.id = v.offer_id
      WHERE v.id = individual_offer_spec_links.offer_version_id
        AND o.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        AND o.current_version_id = v.id
    )
  );

GRANT EXECUTE ON FUNCTION public.generate_individual_offer_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_individual_offer(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_individual_offer(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_individual_offer(UUID) FROM anon;

-- Default offer prefix for existing admins
UPDATE profiles
SET offer_prefix = 'MN'
WHERE role IN ('admin', 'staff_admin')
  AND (offer_prefix IS NULL OR BTRIM(offer_prefix) = '');
