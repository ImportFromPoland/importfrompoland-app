-- Add exchange rate configuration for profitability calculations
-- This allows superadmin to set different EUR/PLN rates for different periods

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate DECIMAL(10,4) NOT NULL, -- EUR to PLN rate (e.g., 4.2000)
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
  effective_to TIMESTAMP WITH TIME ZONE, -- NULL means current rate
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_exchange_rates_effective_from ON exchange_rates(effective_from);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_effective_to ON exchange_rates(effective_to);

-- Insert default rate (4.2 EUR = 1 PLN) if no rates exist
INSERT INTO exchange_rates (rate, effective_from, created_by, notes)
SELECT 4.2000, NOW(), id, 'Default rate for profitability calculations'
FROM profiles 
WHERE role = 'staff_admin' 
  AND NOT EXISTS (SELECT 1 FROM exchange_rates)
LIMIT 1;

-- Function to get exchange rate for a given date
DROP FUNCTION IF EXISTS get_exchange_rate_for_date(TIMESTAMP WITH TIME ZONE);
CREATE OR REPLACE FUNCTION get_exchange_rate_for_date(target_date TIMESTAMP WITH TIME ZONE)
RETURNS DECIMAL(10,4) AS $$
DECLARE
  rate_value DECIMAL(10,4);
BEGIN
  SELECT rate INTO rate_value
  FROM exchange_rates
  WHERE effective_from <= target_date
    AND (effective_to IS NULL OR effective_to >= target_date)
  ORDER BY effective_from DESC
  LIMIT 1;
  
  -- Return default rate if no rate found
  IF rate_value IS NULL THEN
    RETURN 4.2000;
  END IF;
  
  RETURN rate_value;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "superadmin_manage_exchange_rates" ON exchange_rates;
DROP POLICY IF EXISTS "everyone_read_exchange_rates" ON exchange_rates;

-- Only superadmins can manage exchange rates
CREATE POLICY "superadmin_manage_exchange_rates" ON exchange_rates
FOR ALL TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin'
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'staff_admin'
);

-- Everyone can read exchange rates
CREATE POLICY "everyone_read_exchange_rates" ON exchange_rates
FOR SELECT TO authenticated
USING (true);
