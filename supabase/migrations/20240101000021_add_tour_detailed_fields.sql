-- Add detailed tour fields for flight information and daily itinerary

-- Add flight information fields
ALTER TABLE tours 
ADD COLUMN IF NOT EXISTS outbound_carrier TEXT,
ADD COLUMN IF NOT EXISTS outbound_departure_time TEXT,
ADD COLUMN IF NOT EXISTS outbound_arrival_time TEXT,
ADD COLUMN IF NOT EXISTS outbound_departure_date DATE,
ADD COLUMN IF NOT EXISTS outbound_arrival_date DATE,
ADD COLUMN IF NOT EXISTS return_carrier TEXT,
ADD COLUMN IF NOT EXISTS return_departure_time TEXT,
ADD COLUMN IF NOT EXISTS return_arrival_time TEXT,
ADD COLUMN IF NOT EXISTS return_departure_date DATE,
ADD COLUMN IF NOT EXISTS return_arrival_date DATE;

-- Add daily itinerary fields
ALTER TABLE tours 
ADD COLUMN IF NOT EXISTS day1_hotel TEXT,
ADD COLUMN IF NOT EXISTS day1_dinner TEXT,
ADD COLUMN IF NOT EXISTS day1_activities TEXT,
ADD COLUMN IF NOT EXISTS day2_hotel TEXT,
ADD COLUMN IF NOT EXISTS day2_dinner TEXT,
ADD COLUMN IF NOT EXISTS day2_activities TEXT,
ADD COLUMN IF NOT EXISTS day3_hotel TEXT,
ADD COLUMN IF NOT EXISTS day3_dinner TEXT,
ADD COLUMN IF NOT EXISTS day3_activities TEXT;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_tours_outbound_departure ON tours(outbound_departure_date);
CREATE INDEX IF NOT EXISTS idx_tours_return_departure ON tours(return_departure_date);

-- Update the existing test tour with detailed information
UPDATE tours SET
  outbound_carrier = 'Ryanair',
  outbound_departure_time = '06:30',
  outbound_arrival_time = '09:45',
  outbound_departure_date = '2024-10-22',
  outbound_arrival_date = '2024-10-22',
  return_carrier = 'Ryanair',
  return_departure_time = '20:15',
  return_arrival_time = '21:30',
  return_departure_date = '2024-10-24',
  return_arrival_date = '2024-10-24',
  day1_hotel = 'Hotel Katowice - 3★ Superior',
  day1_dinner = 'Welcome dinner at Restaurant Polska (vegetarian & gluten-free options available)',
  day1_activities = 'Morning flight from Shannon to Krakow
Airport transfer to hotel in Katowice
Check-in at 3★ hotel
Free time to explore local area
Welcome dinner with group',
  day2_hotel = 'Hotel Katowice - 3★ Superior',
  day2_dinner = 'Group dinner at Restaurant Tradycja (traditional Polish cuisine)',
  day2_activities = 'Breakfast at hotel
Guided visits to showrooms and stores:
  - Windows and doors specialists
  - Tiles and flooring showrooms
  - Furniture and home decor stores
Lunch with local suppliers
Afternoon: Personalized assistance with product selection
Group dinner',
  day3_hotel = 'Hotel Katowice - 3★ Superior',
  day3_dinner = 'Farewell lunch at Hotel restaurant',
  day3_activities = 'Breakfast at hotel
Final showroom visits
Farewell lunch
Airport transfer to Krakow
Evening flight back to Shannon'
WHERE title = 'Shannon to Krakow Tour';
