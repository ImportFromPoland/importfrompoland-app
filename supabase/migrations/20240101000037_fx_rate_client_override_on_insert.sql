-- Respect fx_rate from client INSERT when set; otherwise default 1/2.95.
-- Keeps DB column aligned with original_net_price / app constants when apps send fx_rate.

CREATE OR REPLACE FUNCTION set_fx_rate_on_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.currency = 'PLN' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.fx_rate IS NULL THEN
        NEW.fx_rate := 1.0 / 2.95;
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.currency = 'PLN' AND OLD.fx_rate IS NOT NULL THEN
        NEW.fx_rate := OLD.fx_rate;
      ELSE
        IF NEW.fx_rate IS NULL THEN
          NEW.fx_rate := 1.0 / 2.95;
        END IF;
      END IF;
    END IF;
  ELSE
    NEW.fx_rate := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
