// Edge Function: finalize_invoice
// Creates final invoice from order

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "staff_admin"].includes(profile.role)) {
      throw new Error("Only admins can finalize invoices");
    }

    const { order_id } = await req.json();

    // Get order totals
    const { data: orderTotals, error: totalsError } = await supabaseClient
      .from("order_totals")
      .select("*")
      .eq("order_id", order_id)
      .single();

    if (totalsError || !orderTotals) {
      throw new Error("Order not found");
    }

    // Generate invoice number
    const year = new Date().getFullYear();
    const { count } = await supabaseClient
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .like("invoice_number", `INV-${year}-%`);

    const nextNum = (count || 0) + 1;
    const invoiceNumber = `INV-${year}-${String(nextNum).padStart(5, "0")}`;

    // Create final invoice
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .insert({
        order_id,
        invoice_number: invoiceNumber,
        type: "final",
        items_net: orderTotals.items_net,
        vat_amount: orderTotals.vat_amount,
        items_gross: orderTotals.items_gross,
        shipping_cost: orderTotals.shipping_cost,
        grand_total: orderTotals.grand_total,
        created_by: user.id,
      })
      .select()
      .single();

    if (invoiceError) {
      throw invoiceError;
    }

    // Update order status to invoiced
    await supabaseClient
      .from("orders")
      .update({ status: "invoiced" })
      .eq("id", order_id);

    // Create audit log
    await supabaseClient.from("audit_logs").insert({
      order_id,
      actor_id: user.id,
      action: "invoice_finalized",
      payload: { invoice_number: invoiceNumber, invoice_id: invoice.id },
    });

    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
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

