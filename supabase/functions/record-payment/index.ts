// Edge Function: record_payment
// Records a payment against an invoice

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
      throw new Error("Only admins can record payments");
    }

    const { invoice_id, amount, method, reference, notes } = await req.json();

    if (!invoice_id || !amount || !method) {
      throw new Error("invoice_id, amount, and method are required");
    }

    // Get invoice
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select("*, order:orders(*)")
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }

    // Get total payments so far
    const { data: existingPayments } = await supabaseClient
      .from("payments")
      .select("amount")
      .eq("invoice_id", invoice_id);

    const totalPaid = (existingPayments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const newTotal = totalPaid + parseFloat(amount);

    if (newTotal > parseFloat(invoice.grand_total)) {
      throw new Error("Payment amount exceeds invoice total");
    }

    // Record payment
    const { data: payment, error: paymentError } = await supabaseClient
      .from("payments")
      .insert({
        invoice_id,
        amount,
        method,
        reference,
        notes,
        recorded_by: user.id,
      })
      .select()
      .single();

    if (paymentError) {
      throw paymentError;
    }

    // If fully paid, update order status to confirmed
    const fullyPaid = Math.abs(newTotal - parseFloat(invoice.grand_total)) < 0.01;
    
    if (fullyPaid && invoice.order.status === "invoiced") {
      await supabaseClient
        .from("orders")
        .update({ 
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", invoice.order_id);

      await supabaseClient.from("audit_logs").insert({
        order_id: invoice.order_id,
        actor_id: user.id,
        action: "status_change",
        from_status: "invoiced",
        to_status: "confirmed",
        payload: { reason: "Payment received in full", payment_id: payment.id },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        fully_paid: fullyPaid,
        total_paid: newTotal,
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

