-- DEPRECATED: volume discount tiers are hardcoded in lib/volume-discount.ts.
-- Tables left in place if this migration was already applied; safe to ignore.

-- Configurable volume discount tiers and bank-transfer bonus (superadmin)

CREATE TABLE IF NOT EXISTS volume_discount_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  bank_transfer_bonus_percent NUMERIC(5,2) NOT NULL DEFAULT 1.00
    CHECK (bank_transfer_bonus_percent >= 0 AND bank_transfer_bonus_percent <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO volume_discount_settings (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS volume_discount_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  min_gross_eur NUMERIC(12,2) NOT NULL CHECK (min_gross_eur >= 0),
  discount_percent NUMERIC(5,2) NOT NULL
    CHECK (discount_percent >= 0 AND discount_percent <= 100),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT volume_discount_tiers_min_gross_unique UNIQUE (min_gross_eur)
);

INSERT INTO volume_discount_tiers (min_gross_eur, discount_percent, sort_order)
VALUES
  (2500, 2, 1),
  (5000, 4, 2),
  (7500, 6, 3)
ON CONFLICT (min_gross_eur) DO NOTHING;

ALTER TABLE volume_discount_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE volume_discount_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "everyone_read_volume_discount_settings" ON volume_discount_settings;
DROP POLICY IF EXISTS "staff_admin_manage_volume_discount_settings" ON volume_discount_settings;
DROP POLICY IF EXISTS "everyone_read_volume_discount_tiers" ON volume_discount_tiers;
DROP POLICY IF EXISTS "staff_admin_manage_volume_discount_tiers" ON volume_discount_tiers;

CREATE POLICY "everyone_read_volume_discount_settings" ON volume_discount_settings
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "staff_admin_manage_volume_discount_settings" ON volume_discount_settings
FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin')
WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin');

CREATE POLICY "everyone_read_volume_discount_tiers" ON volume_discount_tiers
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "staff_admin_manage_volume_discount_tiers" ON volume_discount_tiers
FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin')
WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin');
