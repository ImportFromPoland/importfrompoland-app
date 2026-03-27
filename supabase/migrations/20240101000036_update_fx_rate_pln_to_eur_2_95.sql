-- New PLN→EUR retail rate: 1 EUR = 2.95 PLN (was 3.1).
-- New order_items get fx_rate = 1/2.95 on INSERT; existing rows keep stored fx_rate on UPDATE.

CREATE OR REPLACE FUNCTION set_fx_rate_on_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.currency = 'PLN' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.fx_rate := 1.0 / 2.95;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.currency = 'PLN' AND OLD.fx_rate IS NOT NULL THEN
        NEW.fx_rate := OLD.fx_rate;
      ELSE
        NEW.fx_rate := 1.0 / 2.95;
      END IF;
    END IF;
  ELSE
    NEW.fx_rate := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_fx_rate_on_item() IS 'Sets fx_rate for PLN lines: 1/2.95 for new rows; preserves OLD.fx_rate on update when set';
