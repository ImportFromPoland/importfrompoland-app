-- RPC: complete_onboarding
-- Called from app/onboarding/page.tsx
-- Accepts optional fields (blank strings become NULL) and creates/updates
-- the user's profile + company. Returns the company_id UUID.

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_full_name text,
  p_company_name text DEFAULT NULL,
  p_vat_number text DEFAULT NULL,
  p_address_line1 text DEFAULT NULL,
  p_address_line2 text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_email text;
  v_full_name text;
  v_company_name text;
  v_existing_company_id uuid;
  v_company_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_full_name := NULLIF(BTRIM(p_full_name), '');
  IF v_full_name IS NULL THEN
    RAISE EXCEPTION 'full_name is required';
  END IF;

  v_email := COALESCE(auth.jwt() ->> 'email', '');
  IF v_email = '' THEN
    -- Keep non-null constraint happy; actual email should always be in JWT.
    v_email := v_uid::text || '@unknown.local';
  END IF;

  -- Ensure profile exists (this project does not create it via auth trigger).
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (v_uid, v_email, v_full_name)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

  SELECT company_id
  INTO v_existing_company_id
  FROM public.profiles
  WHERE id = v_uid;

  v_company_name := COALESCE(NULLIF(BTRIM(p_company_name), ''), v_full_name);

  IF v_existing_company_id IS NULL THEN
    INSERT INTO public.companies (
      name,
      vat_number,
      address_line1,
      address_line2,
      city,
      postal_code,
      country,
      phone
    )
    VALUES (
      v_company_name,
      NULLIF(BTRIM(p_vat_number), ''),
      NULLIF(BTRIM(p_address_line1), ''),
      NULLIF(BTRIM(p_address_line2), ''),
      NULLIF(BTRIM(p_city), ''),
      NULLIF(BTRIM(p_postal_code), ''),
      COALESCE(NULLIF(BTRIM(p_country), ''), 'Ireland'),
      NULLIF(BTRIM(p_phone), '')
    )
    RETURNING id INTO v_company_id;

    UPDATE public.profiles
    SET company_id = v_company_id
    WHERE id = v_uid;
  ELSE
    v_company_id := v_existing_company_id;

    UPDATE public.companies c
    SET
      name = COALESCE(NULLIF(BTRIM(p_company_name), ''), c.name, v_company_name),
      vat_number = COALESCE(NULLIF(BTRIM(p_vat_number), ''), c.vat_number),
      address_line1 = COALESCE(NULLIF(BTRIM(p_address_line1), ''), c.address_line1),
      address_line2 = COALESCE(NULLIF(BTRIM(p_address_line2), ''), c.address_line2),
      city = COALESCE(NULLIF(BTRIM(p_city), ''), c.city),
      postal_code = COALESCE(NULLIF(BTRIM(p_postal_code), ''), c.postal_code),
      country = COALESCE(NULLIF(BTRIM(p_country), ''), c.country),
      phone = COALESCE(NULLIF(BTRIM(p_phone), ''), c.phone),
      updated_at = NOW()
    WHERE c.id = v_existing_company_id;
  END IF;

  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding(
  text, text, text, text, text, text, text, text, text
) TO authenticated;

