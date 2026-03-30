import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { LEGACY_PLN_TO_EUR_RATE, PLN_TO_EUR_RATE } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency with 2 decimal places
export function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Convert PLN to EUR using the fixed rate (see EUR_TO_PLN_DIVISOR in constants)
export function convertPLNtoEUR(amountPLN: number): number {
  return amountPLN * PLN_TO_EUR_RATE;
}

// Format date
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Format datetime
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-IE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Calculate line total for an order item
export interface OrderItem {
  unit_price: number;
  quantity: number;
  currency: string;
  discount_percent?: number;
  fx_rate?: number;
}

export function calculateLineTotal(
  item: OrderItem,
  orderCurrency: string = "EUR"
): number {
  let subtotal = item.unit_price * item.quantity;

  // Apply currency conversion if needed
  if (item.currency === "PLN" && orderCurrency === "EUR") {
    subtotal = subtotal * (item.fx_rate ?? PLN_TO_EUR_RATE);
  }

  // Apply line discount
  if (item.discount_percent) {
    subtotal = subtotal * (1 - item.discount_percent / 100);
  }

  return subtotal;
}

/**
 * Line gross in order currency — matches order_item_totals.line_gross (uses original_net_price when set).
 * Fixes mismatches when fx_rate on the row still reflects an old trigger while totals use original_net_price.
 */
export function orderLineGrossEURDisplay(
  item: {
    unit_price: number;
    quantity: number;
    currency: string;
    fx_rate?: number | null;
    original_net_price?: number | null;
    discount_percent?: number | null;
    vat_rate_override?: number | null;
  },
  order: { currency: string; vat_rate?: number | null }
): number {
  const vat = Number(item.vat_rate_override ?? order.vat_rate ?? 23);
  const discPct = Number(item.discount_percent ?? 0) / 100;

  if (
    item.original_net_price != null &&
    !Number.isNaN(Number(item.original_net_price))
  ) {
    return (
      Number(item.original_net_price) *
      Number(item.quantity) *
      (1 - discPct) *
      (1 + vat / 100)
    );
  }

  if (item.currency === "PLN" && order.currency === "EUR") {
    const fx =
      item.fx_rate != null && !Number.isNaN(Number(item.fx_rate))
        ? Number(item.fx_rate)
        : LEGACY_PLN_TO_EUR_RATE;
    return Number(item.unit_price) * Number(item.quantity) * fx;
  }

  return Number(item.unit_price) * Number(item.quantity);
}

export function orderLineUnitGrossEURDisplay(
  item: Parameters<typeof orderLineGrossEURDisplay>[0],
  order: Parameters<typeof orderLineGrossEURDisplay>[1]
): number {
  const q = Number(item.quantity);
  const safeQ = q > 0 ? q : 1;
  return orderLineGrossEURDisplay(item, order) / safeQ;
}

