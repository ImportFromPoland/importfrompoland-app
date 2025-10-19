// Edge Function: submit_order
// Validates ownership, locks draft, assigns order number, sets status to submitted

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

    const { order_id } = await req.json();

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

    // Validate user owns this order
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.company_id !== order.company_id) {
      throw new Error("Unauthorized to submit this order");
    }

    // Validate order is in draft status
    if (order.status !== "draft") {
      throw new Error(`Cannot submit order with status: ${order.status}`);
    }

    // Validate order has at least one item
    const { count: itemCount } = await supabaseClient
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .eq("order_id", order_id);

    if (!itemCount || itemCount === 0) {
      throw new Error("Cannot submit order with no items");
    }

    // Generate order number
    const { data: orderNumberData } = await supabaseClient
      .rpc("generate_order_number");

    const orderNumber = orderNumberData;

    // Update order
    const { error: updateError } = await supabaseClient
      .from("orders")
      .update({
        number: orderNumber,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
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
      payload: { order_number: orderNumber },
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

