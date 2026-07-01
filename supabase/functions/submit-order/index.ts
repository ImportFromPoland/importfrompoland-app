// Edge Function: submit_order
// Validates ownership, locks draft, assigns order number, sets status to submitted

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const PLN_TO_EUR_RATE = 1 / 2.95;

function lineNetEur(
  item: {
    unit_price: number;
    quantity: number;
    currency: string;
    discount_percent?: number;
    original_net_price?: number | null;
    fx_rate?: number | null;
  },
  vatRate: number,
  orderCurrency: string
): number {
  let lineNet = 0;

  if (item.original_net_price) {
    lineNet = item.original_net_price * item.quantity;
  } else {
    let lineGrossEUR = item.unit_price * item.quantity;
    if (item.currency === "PLN" && orderCurrency === "EUR") {
      const rate = item.fx_rate ?? PLN_TO_EUR_RATE;
      lineGrossEUR = item.unit_price * item.quantity * rate;
    }
    lineNet = lineGrossEUR / (1 + vatRate / 100);
  }

  if ((item.discount_percent ?? 0) > 0) {
    lineNet = lineNet * (1 - (item.discount_percent ?? 0) / 100);
  }

  return lineNet;
}

function computeGrossEurBeforeVolumeDiscount(
  items: Array<{
    unit_price: number;
    quantity: number;
    currency: string;
    discount_percent?: number;
    original_net_price?: number | null;
    fx_rate?: number | null;
  }>,
  vatRate: number,
  shippingCost: number,
  orderCurrency: string
): number {
  const itemsNet = items.reduce(
    (sum, item) => sum + lineNetEur(item, vatRate, orderCurrency),
    0
  );
  const vatAmount = (itemsNet * vatRate) / 100;
  return itemsNet + vatAmount + shippingCost;
}

function getVolumeDiscountPercent(
  grossEur: number,
  prefersBankTransfer: boolean
): number {
  let percent = 0;
  if (grossEur > 7500) percent = 6;
  else if (grossEur > 5000) percent = 4;
  else if (grossEur > 2500) percent = 2;
  if (prefersBankTransfer) percent += 1;
  return percent;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { order_id, prefers_bank_transfer } = await req.json();

    if (!order_id) {
      throw new Error("order_id is required");
    }

    // Get order and validate ownership
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select(`
        *,
        company:companies!inner(id),
        created_by_profile:profiles!orders_created_by_fkey(id, company_id)
      `)
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Validate user owns this order OR is admin/staff_admin
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Allow admins and staff_admins to submit any order, otherwise check ownership
    const isAdmin = profile.role === "admin" || profile.role === "staff_admin";
    if (!isAdmin && profile.company_id !== order.company_id) {
      throw new Error("Unauthorized to submit this order");
    }

    // Validate order is in draft status
    if (order.status !== "draft") {
      throw new Error(`Cannot submit order with status: ${order.status}`);
    }

    // Validate order has at least one item
    const { data: items, error: itemsError } = await supabaseClient
      .from("order_items")
      .select("*")
      .eq("order_id", order_id);

    if (itemsError) {
      throw itemsError;
    }

    if (!items || items.length === 0) {
      throw new Error("Cannot submit order with no items");
    }

    const prefersBankTransfer =
      prefers_bank_transfer ?? order.prefers_bank_transfer ?? false;

    const grossEur = computeGrossEurBeforeVolumeDiscount(
      items,
      order.vat_rate,
      order.shipping_cost || 0,
      order.currency
    );
    const discountPercent = getVolumeDiscountPercent(grossEur, prefersBankTransfer);

    // Generate order number
    const { data: orderNumberData } = await supabaseClient
      .rpc("generate_order_number");

    const orderNumber = orderNumberData;

    const orderUpdate: Record<string, unknown> = {
      number: orderNumber,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      discount_percent: discountPercent,
      prefers_bank_transfer: prefersBankTransfer,
    };

    if (prefersBankTransfer) {
      orderUpdate.payment_link_url = null;
    }

    // Update order
    const { error: updateError } = await supabaseClient
      .from("orders")
      .update(orderUpdate)
      .eq("id", order_id);

    if (updateError) {
      throw updateError;
    }

    // Create audit log
    await supabaseClient.from("audit_logs").insert({
      order_id,
      actor_id: user.id,
      action: "status_change",
      from_status: "draft",
      to_status: "submitted",
      payload: {
        order_number: orderNumber,
        discount_percent: discountPercent,
        prefers_bank_transfer: prefersBankTransfer,
      },
    });

    // Create notification for admins
    const { data: admins } = await supabaseClient
      .from("profiles")
      .select("id")
      .in("role", ["admin", "staff_admin"]);

    if (admins && admins.length > 0) {
      await supabaseClient.from("notifications").insert(
        admins.map((admin) => ({
          user_id: admin.id,
          order_id,
          title: "New Order Submitted",
          message: `Order ${orderNumber} has been submitted and is awaiting review.`,
        }))
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_number: orderNumber,
        order_id,
        discount_percent: discountPercent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
