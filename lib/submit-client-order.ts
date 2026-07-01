import type { SupabaseClient } from "@supabase/supabase-js";

async function saveDraftDiscountFields(
  supabase: SupabaseClient,
  orderId: string,
  options: {
    discountPercent: number;
    prefersBankTransfer: boolean;
  }
) {
  const fullUpdate: Record<string, unknown> = {
    discount_percent: options.discountPercent,
    prefers_bank_transfer: options.prefersBankTransfer,
  };

  if (options.prefersBankTransfer) {
    fullUpdate.payment_link_url = null;
  }

  const { error: fullError } = await supabase
    .from("orders")
    .update(fullUpdate)
    .eq("id", orderId)
    .eq("status", "draft");

  if (!fullError) return;

  // Fallback when prefers_bank_transfer column is not migrated yet.
  const { error: discountOnlyError } = await supabase
    .from("orders")
    .update({ discount_percent: options.discountPercent })
    .eq("id", orderId)
    .eq("status", "draft");

  if (discountOnlyError) throw fullError;
}

/** Submit draft order — same core fields as admin submit; trigger assigns order number. */
export async function submitClientOrder(
  supabase: SupabaseClient,
  orderId: string,
  options: {
    discountPercent: number;
    prefersBankTransfer: boolean;
  }
) {
  await saveDraftDiscountFields(supabase, orderId, options);

  const { error } = await supabase
    .from("orders")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) throw error;
}

export function formatSubmitOrderError(error: { message?: string; hint?: string; code?: string }) {
  const parts = [error.message || "Failed to submit order"];
  if (error.hint) parts.push(error.hint);
  if (error.code) parts.push(`(${error.code})`);
  return parts.join(" — ");
}
