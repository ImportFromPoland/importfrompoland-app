-- New order number format: XXX/MM/YYYY
-- XXX is auto-incremented, resets every year
-- MM is current month (01-12)
-- YYYY is current year (2024, 2025, etc)

-- Create a sequence that resets yearly
-- We'll store the last reset year and counter
CREATE TABLE IF NOT EXISTS order_number_sequence (
  year INTEGER PRIMARY KEY,
  last_number INTEGER DEFAULT 0
);

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  current_year INTEGER;
  current_month TEXT;
  next_number INTEGER;
  formatted_number TEXT;
BEGIN
  -- Get current year and month
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  current_month := TO_CHAR(CURRENT_DATE, 'MM');
  
  -- Get or create sequence for this year
  INSERT INTO order_number_sequence (year, last_number)
  VALUES (current_year, 0)
  ON CONFLICT (year) DO NOTHING;
  
  -- Increment and get next number
  UPDATE order_number_sequence
  SET last_number = last_number + 1
  WHERE year = current_year
  RETURNING last_number INTO next_number;
  
  -- Format: XXX/MM/YYYY (e.g., 001/10/2024)
  formatted_number := LPAD(next_number::TEXT, 3, '0') || '/' || current_month || '/' || current_year::TEXT;
  
  RETURN formatted_number;
END;
$$ LANGUAGE plpgsql;

-- Update the trigger to use new function
DROP TRIGGER IF EXISTS set_order_number ON orders;

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate number when order is submitted (not for drafts)
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status = 'draft') AND NEW.number IS NULL THEN
    NEW.number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

COMMENT ON FUNCTION generate_order_number() IS 
'Generates order numbers in format XXX/MM/YYYY where XXX resets each year';

