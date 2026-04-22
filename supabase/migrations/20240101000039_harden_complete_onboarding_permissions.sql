-- Harden permissions for the onboarding RPC.
-- Ensure only authenticated users can execute it.

REVOKE ALL ON FUNCTION public.complete_onboarding(
  text, text, text, text, text, text, text, text, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.complete_onboarding(
  text, text, text, text, text, text, text, text, text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.complete_onboarding(
  text, text, text, text, text, text, text, text, text
) TO authenticated;

