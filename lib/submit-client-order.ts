import type { SupabaseClient } from "@supabase/supabase-js";

export async function submitClientOrder(
  supabase: SupabaseClient,
  orderId: string,
  options: {
    discountPercent: number;
    prefersBankTransfer: boolean;
  }
) {
  const update: Record<string, unknown> = {
    status: "submitted",
    submitted_at: new Date().toISOString(),
    discount_percent: options.discountPercent,
    prefers_bank_transfer: options.prefersBankTransfer,
  };

  if (options.prefersBankTransfer) {
    update.payment_link_url = null;
  }

  const { error } = await supabase.from("orders").update(update).eq("id", orderId);

  if (error) throw error;
}
