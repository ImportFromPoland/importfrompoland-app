import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase admin credentials");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function buildPlaceholderEmail(phone?: string) {
  if (phone && normalizePhone(phone).length > 0) {
    return `phone-${normalizePhone(phone)}@placeholder.ifp.local`;
  }
  return `pending-${crypto.randomUUID()}@placeholder.ifp.local`;
}

export function isPlaceholderEmail(email: string) {
  return email.endsWith("@placeholder.ifp.local");
}
