-- Create tours system for booking functionality

-- Tours table
CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  departure_airport TEXT NOT NULL,
  arrival_airport TEXT NOT NULL,
  max_spaces INTEGER NOT NULL DEFAULT 6,
  price_single NUMERIC(10,2) NOT NULL DEFAULT 350.00,
  price_double NUMERIC(10,2) NOT NULL DEFAULT 550.00,
  itinerary TEXT,
  included_items TEXT[],
  booking_process TEXT,
  is_active BOOLEAN DEFAULT true,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tour bookings table
CREATE TABLE IF NOT EXISTS tour_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  booking_type TEXT NOT NULL CHECK (booking_type IN ('single', 'double')),
  attendee1_name TEXT NOT NULL,
  attendee2_name TEXT,
  contact_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  reservation_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tours_dates ON tours(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_tours_active ON tours(is_active);
CREATE INDEX IF NOT EXISTS idx_tour_bookings_tour ON tour_bookings(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_bookings_company ON tour_bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_tour_bookings_status ON tour_bookings(status);

-- Function to calculate available spaces
CREATE OR REPLACE FUNCTION get_tour_available_spaces(tour_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  total_spaces INTEGER;
  booked_spaces INTEGER;
BEGIN
  SELECT max_spaces INTO total_spaces FROM tours WHERE id = tour_uuid;
  
  SELECT COALESCE(SUM(
    CASE 
      WHEN booking_type = 'single' THEN 1
      WHEN booking_type = 'double' THEN 2
    END
  ), 0) INTO booked_spaces
  FROM tour_bookings 
  WHERE tour_id = tour_uuid AND status = 'confirmed';
  
  RETURN total_spaces - booked_spaces;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_bookings ENABLE ROW LEVEL SECURITY;

-- Tours are readable by everyone (only non-archived)
CREATE POLICY "Tours are viewable by everyone" ON tours
  FOR SELECT USING (is_active = true AND is_archived = false);

-- Tour bookings are readable by the company that made them
CREATE POLICY "Tour bookings are viewable by company" ON tour_bookings
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- Tour bookings can be created by authenticated users
CREATE POLICY "Tour bookings can be created by authenticated users" ON tour_bookings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Tour bookings can be updated by the company that made them
CREATE POLICY "Tour bookings can be updated by company" ON tour_bookings
  FOR UPDATE USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- Insert test tour data
INSERT INTO tours (
  title, 
  start_date, 
  end_date, 
  departure_airport, 
  arrival_airport, 
  max_spaces, 
  price_single, 
  price_double, 
  itinerary, 
  included_items, 
  booking_process, 
  is_active,
  is_archived
) VALUES (
  'Shannon to Krakow Tour',
  '2024-10-22',
  '2024-10-24',
  'Shannon (SNN)',
  'Krakow (KRK)',
  6,
  350.00,
  550.00,
  'Day 1 (22nd October):
• Morning flight from Shannon to Krakow
• Airport transfer to hotel in Katowice
• Check-in at 3★ hotel
• Welcome dinner with group

Day 2 (23rd October):
• Breakfast at hotel
• Guided visits to showrooms and stores:
  - Windows and doors specialists
  - Tiles and flooring showrooms
  - Furniture and home decor stores
• Lunch with local suppliers
• Afternoon: Personalized assistance with product selection
• Group dinner

Day 3 (24th October):
• Breakfast at hotel
• Final showroom visits
• Airport transfer to Krakow
• Evening flight back to Shannon',
  ARRAY[
    '✈️ Airport Transfers: from Katowice (KTW) or Kraków (KRK)',
    '🏨 2 nights at a 3★ hotel in Katowice with breakfast',
    '🍽️ Group dinner — with vegetarian and gluten-free options',
    '🛒 Guided store & showroom visits —windows, doors, tiles, flooring, furniture and more!',
    '📋 Personalised assistance — we help you understand details, specification and compatibility when you need'
  ],
  '1. Reserve your places using the form below (48-hour pending reservation)
2. Book your flights in line with the tour dates
3. Send us confirmation via email (info@importfrompoland.com), WhatsApp, Facebook or Instagram message
4. We''ll confirm your places once flight booking is verified
5. You''re all set for your Polish adventure!',
  true,
  false
);
