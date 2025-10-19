// Edge Function: advance_warehouse
// Updates warehouse task status for order items

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
      throw new Error("Only warehouse staff can update tasks");
    }

    const { order_item_id, new_status, quantity_picked, location_note } = await req.json();

    if (!order_item_id || !new_status) {
      throw new Error("order_item_id and new_status are required");
    }

    // Validate status transition
    const validStatuses = ["pending", "picking", "picked", "packed"];
    if (!validStatuses.includes(new_status)) {
      throw new Error("Invalid status");
    }

    // Get or create warehouse task
    const { data: existingTask } = await supabaseClient
      .from("warehouse_tasks")
      .select("*")
      .eq("order_item_id", order_item_id)
      .single();

    let task;
    if (existingTask) {
      // Update existing task
      const { data: updated, error: updateError } = await supabaseClient
        .from("warehouse_tasks")
        .update({
          status: new_status,
          quantity_picked: quantity_picked || existingTask.quantity_picked,
          location_note: location_note || existingTask.location_note,
          picked_at: new_status === "picked" ? new Date().toISOString() : existingTask.picked_at,
          picked_by: new_status === "picked" ? user.id : existingTask.picked_by,
        })
        .eq("order_item_id", order_item_id)
        .select()
        .single();

      if (updateError) throw updateError;
      task = updated;
    } else {
      // Create new task
      const { data: created, error: createError } = await supabaseClient
        .from("warehouse_tasks")
        .insert({
          order_item_id,
          status: new_status,
          quantity_picked,
          location_note,
          picked_at: new_status === "picked" ? new Date().toISOString() : null,
          picked_by: new_status === "picked" ? user.id : null,
        })
        .select()
        .single();

      if (createError) throw createError;
      task = created;
    }

    // Get order_id from item
    const { data: item } = await supabaseClient
      .from("order_items")
      .select("order_id")
      .eq("id", order_item_id)
      .single();

    if (!item) throw new Error("Order item not found");

    // Check if all items in order are at same or advanced status
    const { data: allTasks } = await supabaseClient
      .from("warehouse_tasks")
      .select("status, order_item:order_items!inner(order_id)")
      .eq("order_items.order_id", item.order_id);

    // Determine order-level status based on all tasks
    let orderStatus = null;
    if (allTasks && allTasks.length > 0) {
      const allPicked = allTasks.every((t) => t.status === "picked" || t.status === "packed");
      const allPacked = allTasks.every((t) => t.status === "packed");
      
      if (allPacked) {
        orderStatus = "packed";
      } else if (allPicked) {
        orderStatus = "picked";
      } else if (allTasks.some((t) => t.status === "picking")) {
        orderStatus = "picking";
      }
    }

    // Update order status if needed
    if (orderStatus) {
      const { data: order } = await supabaseClient
        .from("orders")
        .select("status")
        .eq("id", item.order_id)
        .single();

      if (order && order.status !== orderStatus) {
        await supabaseClient
          .from("orders")
          .update({ status: orderStatus })
          .eq("id", item.order_id);

        await supabaseClient.from("audit_logs").insert({
          order_id: item.order_id,
          actor_id: user.id,
          action: "status_change",
          from_status: order.status,
          to_status: orderStatus,
          payload: { warehouse_task_id: task.id },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        task_id: task.id,
        order_status: orderStatus,
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

