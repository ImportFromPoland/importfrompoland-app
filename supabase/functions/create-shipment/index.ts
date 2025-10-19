// Edge Function: create_shipment
// Creates shipment record and updates order to dispatched

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

    if (!profile || !["admin", "staff_admin", "warehouse"].includes(profile.role)) {
      throw new Error("Only admins and warehouse staff can create shipments");
    }

    const { order_id, carrier, tracking_number, parcels_count, total_weight } = await req.json();

    if (!order_id || !carrier) {
      throw new Error("order_id and carrier are required");
    }

    // Verify order exists and is in appropriate status
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("status")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    const validStatuses = ["packed", "ready_to_ship", "confirmed", "invoiced"];
    if (!validStatuses.includes(order.status)) {
      throw new Error(`Cannot create shipment for order with status: ${order.status}`);
    }

    // Create shipment
    const { data: shipment, error: shipmentError } = await supabaseClient
      .from("shipments")
      .insert({
        order_id,
        carrier,
        tracking_number,
        parcels_count: parcels_count || 1,
        total_weight,
        shipped_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (shipmentError) {
      throw shipmentError;
    }

    // Update order status to dispatched
    await supabaseClient
      .from("orders")
      .update({ status: "dispatched" })
      .eq("id", order_id);

    // Create audit log
    await supabaseClient.from("audit_logs").insert({
      order_id,
      actor_id: user.id,
      action: "status_change",
      from_status: order.status,
      to_status: "dispatched",
      payload: { 
        shipment_id: shipment.id, 
        carrier, 
        tracking_number,
      },
    });

    // Notify client
    const { data: orderDetails } = await supabaseClient
      .from("orders")
      .select("created_by")
      .eq("id", order_id)
      .single();

    if (orderDetails?.created_by) {
      await supabaseClient.from("notifications").insert({
        user_id: orderDetails.created_by,
        order_id,
        title: "Order Dispatched",
        message: `Your order has been dispatched via ${carrier}${tracking_number ? `. Tracking: ${tracking_number}` : ""}`,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        shipment_id: shipment.id,
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

