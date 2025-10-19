import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { PLN_TO_EUR_RATE } from "./constants";

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

// Convert PLN to EUR using the fixed rate (1 / 3.1)
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
    subtotal = subtotal * (item.fx_rate || PLN_TO_EUR_RATE);
  }

  // Apply line discount
  if (item.discount_percent) {
    subtotal = subtotal * (1 - item.discount_percent / 100);
  }

  return subtotal;
}

