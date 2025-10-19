// Constants for the application

// Critical: PLN to EUR conversion rate (includes service + delivery to Ireland)
export const PLN_TO_EUR_RATE = 0.3225806451612903; // 1 / 3.1
export const EUR_TO_PLN_DIVISOR = 3.1;

export const ORDER_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "confirmed",
  "paid",
  "partially_packed",
  "packed",
  "partially_dispatched",
  "dispatched",
  "partially_delivered",
  "delivered",
  "cancelled",
] as const;

export const CURRENCIES = ["EUR", "PLN"] as const;

export const USER_ROLES = ["client", "admin", "staff_admin", "warehouse"] as const;

export const PAYMENT_METHODS = [
  "bank_transfer",
  "card",
  "cash",
  "other",
] as const;

export const INVOICE_TYPES = ["proforma", "final"] as const;

export const DEFAULT_VAT_RATE = 23.0;

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-blue-50 text-blue-700 border-blue-200",
  submitted: "bg-blue-100 text-blue-800",
  in_review: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  paid: "bg-emerald-100 text-emerald-800",
  partially_packed: "bg-amber-100 text-amber-800",
  packed: "bg-indigo-100 text-indigo-800",
  partially_dispatched: "bg-cyan-100 text-cyan-800",
  dispatched: "bg-teal-100 text-teal-800",
  partially_delivered: "bg-lime-100 text-lime-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "BASKET",
  submitted: "SUBMITTED",
  in_review: "IN REVIEW",
  confirmed: "CONFIRMED",
  paid: "PAID",
  partially_packed: "PARTIALLY PACKED",
  packed: "PACKED",
  partially_dispatched: "PARTIALLY DISPATCHED",
  dispatched: "DISPATCHED",
  partially_delivered: "PARTIALLY DELIVERED",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
};

