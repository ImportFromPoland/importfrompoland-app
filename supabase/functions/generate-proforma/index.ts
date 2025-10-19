// Edge Function: generate_proforma
// Creates a proforma invoice and generates PDF

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

    // Verify user is admin
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "staff_admin"].includes(profile.role)) {
      throw new Error("Only admins can generate proforma invoices");
    }

    const { order_id } = await req.json();

    if (!order_id) {
      throw new Error("order_id is required");
    }

    // Get order totals from view
    const { data: orderTotals, error: totalsError } = await supabaseClient
      .from("order_totals")
      .select("*")
      .eq("order_id", order_id)
      .single();

    if (totalsError || !orderTotals) {
      throw new Error("Order not found or has no items");
    }

    // Generate invoice number
    const year = new Date().getFullYear();
    const { count } = await supabaseClient
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .like("invoice_number", `PRO-${year}-%`);

    const nextNum = (count || 0) + 1;
    const invoiceNumber = `PRO-${year}-${String(nextNum).padStart(5, "0")}`;

    // Create invoice record
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .insert({
        order_id,
        invoice_number: invoiceNumber,
        type: "proforma",
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

    // Generate PDF (simplified for MVP - in production use proper PDF library)
    // For now, we'll create a simple HTML representation and store it
    const { data: order } = await supabaseClient
      .from("orders")
      .select(`
        *,
        company:companies(*),
        items:order_items(*)
      `)
      .eq("id", order_id)
      .single();

    const pdfContent = generateSimplePDF(order, invoice, orderTotals);
    
    // Store PDF in storage
    const pdfFileName = `proforma_${invoiceNumber}.html`;
    const { error: uploadError } = await supabaseClient.storage
      .from("documents")
      .upload(pdfFileName, new Blob([pdfContent], { type: "text/html" }), {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
    }

    // Update invoice with PDF URL
    const pdfUrl = `documents/${pdfFileName}`;
    await supabaseClient
      .from("invoices")
      .update({ pdf_url: pdfUrl })
      .eq("id", invoice.id);

    // Create audit log
    await supabaseClient.from("audit_logs").insert({
      order_id,
      actor_id: user.id,
      action: "proforma_generated",
      payload: { invoice_number: invoiceNumber, invoice_id: invoice.id },
    });

    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        pdf_url: pdfUrl,
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

function generateSimplePDF(order: any, invoice: any, totals: any): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Proforma Invoice ${invoice.invoice_number}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .totals { margin-top: 20px; text-align: right; }
    .totals table { width: 400px; margin-left: auto; }
  </style>
</head>
<body>
  <h1>Proforma Invoice</h1>
  <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
  <p><strong>Order Number:</strong> ${order.number}</p>
  <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
  
  <h2>Bill To:</h2>
  <p>
    ${order.company.name}<br>
    ${order.company.address_line1 || ""}<br>
    ${order.company.city || ""}, ${order.company.postal_code || ""}<br>
    ${order.company.country || ""}<br>
    VAT: ${order.company.vat_number || "N/A"}
  </p>
  
  <h2>Items</h2>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Currency</th>
        <th>Total (${order.currency})</th>
      </tr>
    </thead>
    <tbody>
      ${order.items.map((item: any) => `
        <tr>
          <td>${item.product_name}</td>
          <td>${item.quantity}</td>
          <td>${item.unit_price.toFixed(2)}</td>
          <td>${item.currency}</td>
          <td>${calculateLineTotal(item, order).toFixed(2)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  
  <div class="totals">
    <table>
      <tr>
        <td>Items Net:</td>
        <td>${totals.items_net.toFixed(2)} ${order.currency}</td>
      </tr>
      <tr>
        <td>VAT (${order.vat_rate}%):</td>
        <td>${totals.vat_amount.toFixed(2)} ${order.currency}</td>
      </tr>
      <tr>
        <td>Items Gross:</td>
        <td>${totals.items_gross.toFixed(2)} ${order.currency}</td>
      </tr>
      <tr>
        <td>Shipping:</td>
        <td>${totals.shipping_cost.toFixed(2)} ${order.currency}</td>
      </tr>
      <tr style="font-weight: bold; font-size: 1.2em;">
        <td>Grand Total:</td>
        <td>${totals.grand_total.toFixed(2)} ${order.currency}</td>
      </tr>
    </table>
  </div>
  
  <p style="margin-top: 40px; font-size: 0.9em; color: #666;">
    Note: Prices in PLN are converted at rate €1 = 3.1 PLN (includes service and delivery to Ireland)
  </p>
</body>
</html>`;
}

function calculateLineTotal(item: any, order: any): number {
  let subtotal = item.unit_price * item.quantity;
  
  if (item.currency === "PLN" && order.currency === "EUR") {
    subtotal = subtotal * (item.fx_rate || 0.3225806451612903);
  }
  
  if (item.discount_percent) {
    subtotal = subtotal * (1 - item.discount_percent / 100);
  }
  
  return subtotal;
}

