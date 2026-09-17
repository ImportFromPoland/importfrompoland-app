-- Structured tour places catalog + stops (replaces free-text dayN_activities for new planning)

CREATE TABLE IF NOT EXISTS tour_places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('showroom', 'shop', 'hotel', 'restaurant', 'other')),
  city TEXT,
  short_description TEXT,
  highlights TEXT,
  typical_duration_minutes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_places_kind ON tour_places(kind);
CREATE INDEX IF NOT EXISTS idx_tour_places_active ON tour_places(is_active);
CREATE INDEX IF NOT EXISTS idx_tour_places_name ON tour_places(name);

CREATE TABLE IF NOT EXISTS tour_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES tour_places(id) ON DELETE RESTRICT,
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 7),
  sort_order INTEGER NOT NULL DEFAULT 0,
  planned_duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_stops_tour ON tour_stops(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_stops_day ON tour_stops(tour_id, day_number, sort_order);

COMMENT ON TABLE tour_places IS
  'Reusable catalog of showrooms, shops, hotels, restaurants for tour planning';
COMMENT ON TABLE tour_stops IS
  'Ordered visit stops on a tour day; place_id ready for Tour Mode check-in later';

ALTER TABLE tour_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_active_tour_places" ON tour_places;
CREATE POLICY "authenticated_read_active_tour_places"
  ON tour_places FOR SELECT TO authenticated
  USING (
    is_active = true
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  );

DROP POLICY IF EXISTS "admin_all_tour_places" ON tour_places;
CREATE POLICY "admin_all_tour_places"
  ON tour_places FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'))
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'));

DROP POLICY IF EXISTS "authenticated_read_tour_stops" ON tour_stops;
CREATE POLICY "authenticated_read_tour_stops"
  ON tour_stops FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_all_tour_stops" ON tour_stops;
CREATE POLICY "admin_all_tour_stops"
  ON tour_stops FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'))
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'));
