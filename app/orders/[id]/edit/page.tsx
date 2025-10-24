"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderLineForm, type OrderLineData } from "@/components/OrderLineForm";
import { TotalsPanel } from "@/components/TotalsPanel";
import { Logo } from "@/components/Logo";
import { Plus, Save, Send } from "lucide-react";
import { PLN_TO_EUR_RATE, DEFAULT_VAT_RATE } from "@/lib/constants";

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState<any>(null);

  const [currency] = useState<"EUR" | "PLN">("EUR");
  const [vatRate, setVatRate] = useState(DEFAULT_VAT_RATE);
  const [shippingCost, setShippingCost] = useState(0);
  const [headerDiscountPercent, setHeaderDiscountPercent] = useState(0);
  const [headerMarkupPercent, setHeaderMarkupPercent] = useState(0);
  const [clientNotes, setClientNotes] = useState("");

  const [lines, setLines] = useState<OrderLineData[]>([]);

  useEffect(() => {
    loadOrder();
  }, [params.id]);

  const loadOrder = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Get order with items
      const { data: orderData, error } = await supabase
        .from("orders")
        .select(`
          *,
          items:order_items(*)
        `)
        .eq("id", params.id)
        .single();

      if (error) throw error;

      // Check if user can edit (must be draft)
      if (orderData.status !== "draft") {
        alert("Can only edit draft orders");
        router.push(`/orders/${params.id}`);
        return;
      }

      setOrder(orderData);
      setVatRate(orderData.vat_rate);
      setShippingCost(orderData.shipping_cost);
      setHeaderDiscountPercent(orderData.discount_percent || 0);
      setHeaderMarkupPercent(orderData.markup_percent || 0);
      setClientNotes(orderData.client_notes || "");

      // Load items
      if (orderData.items && orderData.items.length > 0) {
        const loadedLines = orderData.items.map((item: any) => ({
          id: item.id,
          line_number: item.line_number,
          product_name: item.product_name,
          website_url: item.website_url || "",
          supplier_name: item.supplier_name || "",
          unit_price: item.unit_price,
          quantity: item.quantity,
          currency: item.currency,
          unit_of_measure: item.unit_of_measure || "unit",
          discount_percent: item.discount_percent || 0,
          notes: item.notes || "",
          attachment_url: item.attachment_url || "",
          original_net_price: item.original_net_price,
        }));
        setLines(loadedLines);
      } else {
        // No items, add empty line
        setLines([{
          line_number: 1,
          product_name: "",
          website_url: "",
          supplier_name: "",
          unit_price: 0,
          quantity: 1,
          currency: "PLN",
          unit_of_measure: "unit",
          discount_percent: 0,
          notes: "",
        }]);
      }
    } catch (error: any) {
      console.error("Error loading order:", error);
      alert("Error loading order: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => {
    // Find the highest line number and add 1
    const maxLineNumber = lines.length > 0 ? Math.max(...lines.map(line => line.line_number)) : 0;
    
    setLines([
      ...lines,
      {
        line_number: maxLineNumber + 1,
        product_name: "",
        website_url: "",
        supplier_name: "",
        unit_price: 0,
        quantity: 1,
        currency: "PLN",
        unit_of_measure: "unit",
        discount_percent: 0,
        notes: "",
      },
    ]);
  };

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index);
    // Renumber lines sequentially starting from 1
    newLines.forEach((line, i) => {
      line.line_number = i + 1;
    });
    setLines(newLines);
  };

  const updateLine = (index: number, updatedLine: OrderLineData) => {
    const newLines = [...lines];
    newLines[index] = updatedLine;
    setLines(newLines);
  };

  const calculateTotals = () => {
    let itemsNet = 0;

    lines.forEach((line) => {
      let lineNet = 0;
      
      // Check if we have original_net_price (from database)
      if (line.original_net_price) {
        // Use stored original net price (maintains consistency when VAT changes)
        lineNet = line.original_net_price * line.quantity;
      } else {
        // Calculate NET from current gross price (for new items)
        let lineGrossPLN = line.unit_price * line.quantity;
        let lineGrossEUR = lineGrossPLN;
        if (line.currency === "PLN" && currency === "EUR") {
          lineGrossEUR = lineGrossPLN * PLN_TO_EUR_RATE;
        }
        lineNet = lineGrossEUR / (1 + vatRate / 100);
      }

      // Apply line discount to NET
      if (line.discount_percent > 0) {
        lineNet = lineNet * (1 - line.discount_percent / 100);
      }

      itemsNet += lineNet;
    });

    const itemsNetAfterHeader =
      itemsNet * (1 - headerDiscountPercent / 100) * (1 + headerMarkupPercent / 100);

    const vatAmount = (itemsNetAfterHeader * vatRate) / 100;
    const itemsGross = itemsNetAfterHeader + vatAmount;
    const grandTotal = itemsGross + shippingCost;

    return {
      itemsNet,
      itemsNetAfterHeader,
      vatAmount,
      itemsGross,
      grandTotal,
    };
  };

  const totals = calculateTotals();

  const saveChanges = async () => {
    if (!order) return;

    setSaving(true);
    try {
      // Update order header
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          vat_rate: vatRate,
          shipping_cost: shippingCost,
          discount_percent: headerDiscountPercent,
          markup_percent: headerMarkupPercent,
          client_notes: clientNotes,
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      // Delete existing items
      const { error: deleteError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", order.id);

      if (deleteError) throw deleteError;

      // Insert updated items
      const items = lines
        .filter((line) => line.product_name && line.unit_price > 0)
        .map((line) => {
          // Calculate original net price from gross price with default 23% VAT
          let originalNetPrice = 0;
          if (line.currency === "PLN" && currency === "EUR") {
            const grossEUR = line.unit_price * PLN_TO_EUR_RATE;
            originalNetPrice = grossEUR / 1.23; // Remove 23% VAT
          } else if (line.currency === currency) {
            originalNetPrice = line.unit_price / 1.23; // Remove 23% VAT
          } else {
            originalNetPrice = line.unit_price / 1.23; // Remove 23% VAT
          }

          return {
            order_id: order.id,
            line_number: line.line_number,
            product_name: line.product_name,
            website_url: line.website_url,
            supplier_name: line.supplier_name,
            original_supplier_name: line.original_supplier_name || line.supplier_name,
            unit_price: line.unit_price,
            quantity: line.quantity,
            currency: line.currency,
            unit_of_measure: line.unit_of_measure || "unit",
            discount_percent: line.discount_percent,
            notes: line.notes,
            attachment_url: line.attachment_url,
            original_net_price: originalNetPrice,
          };
        });

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(items);

        if (itemsError) throw itemsError;
      }

      router.push(`/orders/${order.id}`);
    } catch (error: any) {
      alert("Error saving changes: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const submitOrder = async () => {
    // First save
    await saveChanges();

    // Then submit via Edge Function
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({ order_id: order.id }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit order");
      }

      router.push(`/orders/${order.id}`);
    } catch (error: any) {
      alert("Error submitting order: " + error.message);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!order) {
    return <div className="min-h-screen flex items-center justify-center">Order not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo width={200} height={80} linkToDashboard={true} />
              <h1 className="text-2xl font-bold">Edit My Basket</h1>
            </div>
            <Button variant="outline" onClick={() => router.push(`/orders/${order.id}`)}>
              Cancel
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lines.map((line, index) => (
                  <OrderLineForm
                    key={index}
                    line={line}
                    onUpdate={(updated) => updateLine(index, updated)}
                    onRemove={() => removeLine(index)}
                    orderCurrency={currency}
                    vatRate={vatRate}
                  />
                ))}

                <Button variant="outline" onClick={addLine} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line Item
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="client_notes">Additional Notes</Label>
                <Input
                  id="client_notes"
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="Any additional information..."
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <TotalsPanel
              itemsNet={totals.itemsNet}
              vatRate={vatRate}
              vatAmount={totals.vatAmount}
              itemsGross={totals.itemsGross}
              shippingCost={shippingCost}
              headerDiscountPercent={headerDiscountPercent}
              headerMarkupPercent={headerMarkupPercent}
              grandTotal={totals.grandTotal}
              currency={currency}
              clientView={true}
            />

            <div className="space-y-2">
              <Button
                onClick={saveChanges}
                variant="outline"
                className="w-full"
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

