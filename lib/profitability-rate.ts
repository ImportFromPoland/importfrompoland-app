import { createClient } from "@/lib/supabase/client";
import { DEFAULT_PROFITABILITY_EUR_PLN } from "@/lib/profitability";

/** Current EUR→PLN rate for profitability (falls back to 4.2). */
export async function fetchProfitabilityEurPlnRate(
  supabase = createClient(),
  at: Date = new Date()
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("get_exchange_rate_for_date", {
      target_date: at.toISOString(),
    });
    if (error) throw error;
    const rate = Number(data);
    return rate > 0 ? rate : DEFAULT_PROFITABILITY_EUR_PLN;
  } catch {
    return DEFAULT_PROFITABILITY_EUR_PLN;
  }
}
