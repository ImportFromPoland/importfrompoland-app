import { PLN_TO_EUR_RATE } from "@/lib/constants";

export interface BasketLineForTotals {
  unit_price: number;
  quantity: number;
  currency: string;
  discount_percent?: number;
  original_net_price?: number | null;
  fx_rate?: number | null;
}

/** Fixed volume tiers (gross EUR, strictly above threshold). Change here when rates change. */
export const VOLUME_DISCOUNT_TIERS = [
  { min_gross_eur: 7500, discount_percent: 6 },
  { min_gross_eur: 5000, discount_percent: 4 },
  { min_gross_eur: 2500, discount_percent: 2 },
] as const;

export const BANK_TRANSFER_BONUS_PERCENT = 1;

export function formatVolumeTierLabel(minGrossEur: number): string {
  return `> €${minGrossEur.toLocaleString("en-IE")}`;
}

/** Gross EUR total before order-level (volume) discount — used for tier thresholds. */
export function computeGrossEurBeforeVolumeDiscount(
  lines: BasketLineForTotals[],
  vatRate: number,
  shippingCost: number,
  orderCurrency: "EUR" | "PLN" = "EUR"
): number {
  const itemsNet = computeItemsNetEur(lines, vatRate, orderCurrency);
  const vatAmount = (itemsNet * vatRate) / 100;
  return itemsNet + vatAmount + shippingCost;
}

export function computeItemsNetEur(
  lines: BasketLineForTotals[],
  vatRate: number,
  orderCurrency: "EUR" | "PLN" = "EUR"
): number {
  return lines.reduce((sum, line) => sum + lineNetEur(line, vatRate, orderCurrency), 0);
}

function lineNetEur(
  line: BasketLineForTotals,
  vatRate: number,
  orderCurrency: "EUR" | "PLN"
): number {
  let lineNet = 0;

  if (line.original_net_price) {
    lineNet = line.original_net_price * line.quantity;
  } else {
    let lineGrossEUR = line.unit_price * line.quantity;
    if (line.currency === "PLN" && orderCurrency === "EUR") {
      const rate = line.fx_rate ?? PLN_TO_EUR_RATE;
      lineGrossEUR = line.unit_price * line.quantity * rate;
    }
    lineNet = lineGrossEUR / (1 + vatRate / 100);
  }

  if ((line.discount_percent ?? 0) > 0) {
    lineNet = lineNet * (1 - (line.discount_percent ?? 0) / 100);
  }

  return lineNet;
}

export function getVolumeDiscountPercent(
  grossEur: number,
  prefersBankTransfer: boolean
): number {
  let percent = 0;
  for (const tier of VOLUME_DISCOUNT_TIERS) {
    if (grossEur > tier.min_gross_eur) {
      percent = tier.discount_percent;
      break;
    }
  }
  if (prefersBankTransfer) {
    percent += BANK_TRANSFER_BONUS_PERCENT;
  }
  return percent;
}

export function getVolumeDiscountBreakdown(
  grossEur: number,
  prefersBankTransfer: boolean
) {
  let volumePercent = 0;
  let tierLabel: string | null = null;
  for (const tier of VOLUME_DISCOUNT_TIERS) {
    if (grossEur > tier.min_gross_eur) {
      volumePercent = tier.discount_percent;
      tierLabel = formatVolumeTierLabel(tier.min_gross_eur);
      break;
    }
  }
  const bankBonus = prefersBankTransfer ? BANK_TRANSFER_BONUS_PERCENT : 0;
  return {
    volumePercent,
    bankBonus,
    totalPercent: volumePercent + bankBonus,
    tierLabel,
    grossEur,
  };
}
