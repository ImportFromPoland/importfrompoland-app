/** Client calculator divisor (pricing) — not for profitability. */
export { EUR_TO_PLN_DIVISOR } from "@/lib/constants";

/** Default EUR→PLN rate for profitability (overridden by exchange_rates). */
export const DEFAULT_PROFITABILITY_EUR_PLN = 4.2;

/** Polish purchase VAT — costs entered gross, P&L uses net. */
export const PURCHASE_VAT_FACTOR = 1.23;

export function grossPlnToNet(grossPln: number): number {
  return (Number(grossPln) || 0) / PURCHASE_VAT_FACTOR;
}

export type ProfitabilityInputs = {
  /** Client revenue excl. VAT (EUR) */
  revenueNetEur: number;
  /** Line purchase costs GROSS PLN (sum of unit_gross * qty) */
  purchaseGrossPln: number;
  /** Side costs GROSS PLN (deliveries from shops, etc.) */
  sideCostsGrossPln?: number;
  /** Ireland delivery cost EUR */
  ieDeliveryCostEur?: number;
  /** PLN per 1 EUR */
  eurPlnRate?: number;
};

export type ProfitabilityResult = {
  revenueNetEur: number;
  purchaseNetPln: number;
  sideCostsNetPln: number;
  purchaseAndSideNetEur: number;
  ieDeliveryCostEur: number;
  totalCostsEur: number;
  profitEur: number;
  marginPercent: number | null;
  eurPlnRate: number;
};

export function calculateOrderProfitability(
  input: ProfitabilityInputs
): ProfitabilityResult {
  const rate = input.eurPlnRate && input.eurPlnRate > 0
    ? input.eurPlnRate
    : DEFAULT_PROFITABILITY_EUR_PLN;

  const purchaseNetPln = grossPlnToNet(input.purchaseGrossPln);
  const sideCostsNetPln = grossPlnToNet(input.sideCostsGrossPln || 0);
  const purchaseAndSideNetEur = (purchaseNetPln + sideCostsNetPln) / rate;
  const ieDeliveryCostEur = Number(input.ieDeliveryCostEur) || 0;
  const totalCostsEur = purchaseAndSideNetEur + ieDeliveryCostEur;
  const revenueNetEur = Number(input.revenueNetEur) || 0;
  const profitEur = revenueNetEur - totalCostsEur;
  const marginPercent =
    revenueNetEur > 0 ? (profitEur / revenueNetEur) * 100 : null;

  return {
    revenueNetEur,
    purchaseNetPln,
    sideCostsNetPln,
    purchaseAndSideNetEur,
    ieDeliveryCostEur,
    totalCostsEur,
    profitEur,
    marginPercent,
    eurPlnRate: rate,
  };
}

/** Default gross purchase from basket line (client PLN price). */
export function defaultGrossCostFromBasket(item: {
  unit_price?: number | null;
  currency?: string | null;
  net_cost_pln?: number | null;
}): number {
  const existing = Number(item.net_cost_pln);
  if (existing > 0) return existing;
  if ((item.currency || "PLN") === "PLN") {
    return Number(item.unit_price) || 0;
  }
  return 0;
}
