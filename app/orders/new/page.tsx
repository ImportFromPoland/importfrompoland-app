"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderLineForm, type OrderLineData } from "@/components/OrderLineForm";
import { TotalsPanel } from "@/components/TotalsPanel";
import { Plus, Save, Send } from "lucide-react";
import { PLN_TO_EUR_RATE, DEFAULT_VAT_RATE } from "@/lib/constants";
import { Logo } from "@/components/Logo";

export default function NewOrderPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const [currency, setCurrency] = useState<"EUR" | "PLN">("EUR");
  const [vatRate, setVatRate] = useState(DEFAULT_VAT_RATE);
  const [shippingCost, setShippingCost] = useState(0);
  const [headerDiscountPercent, setHeaderDiscountPercent] = useState(0);
  const [headerMarkupPercent, setHeaderMarkupPercent] = useState(0);
  const [clientNotes, setClientNotes] = useState("");

  const [lines, setLines] = useState<OrderLineData[]>([
    {
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
    },
  ]);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setUser(user);
      setProfile(profile);
    }

    loadUser();
  }, [supabase, router]);

  const addLine = () => {
    setLines([
      ...lines,
      {
        line_number: lines.length + 1,
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
    // Renumber lines
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

    // Apply header modifiers
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

  const saveDraft = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          company_id: profile.company_id,
          created_by: user.id,
          status: "draft",
          currency,
          vat_rate: vatRate,
          shipping_cost: shippingCost,
          discount_percent: headerDiscountPercent,
          markup_percent: headerMarkupPercent,
          client_notes: clientNotes,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
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
      alert("Error saving order: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitOrder = async () => {
    if (!profile) return;

    // First save as draft
    setLoading(true);
    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          company_id: profile.company_id,
          created_by: user.id,
          status: "draft",
          currency,
          vat_rate: vatRate,
          shipping_cost: shippingCost,
          discount_percent: headerDiscountPercent,
          markup_percent: headerMarkupPercent,
          client_notes: clientNotes,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const items = lines
        .filter((line) => line.product_name && line.unit_price > 0)
        .map((line) => ({
          order_id: order.id,
          line_number: line.line_number,
          product_name: line.product_name,
          website_url: line.website_url,
          supplier_name: line.supplier_name,
          original_supplier_name: line.original_supplier_name || line.supplier_name,
          unit_price: line.unit_price,
          quantity: line.quantity,
          currency: line.currency,
          discount_percent: line.discount_percent,
          notes: line.notes,
          attachment_url: line.attachment_url,
        }));

      if (items.length === 0) {
        throw new Error("Please add at least one item");
      }

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(items);

      if (itemsError) throw itemsError;

      // Submit order via Edge Function
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
    } finally {
      setLoading(false);
    }
  };

  if (!user || !profile) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo width={180} height={70} linkToDashboard={true} />
              <h1 className="text-2xl font-bold">My Basket</h1>
            </div>
            <Button variant="outline" onClick={() => router.push("/")}>
              ← Back to Dashboard
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
                <Label htmlFor="client_notes">Client Notes</Label>
                <Input
                  id="client_notes"
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="Any additional notes..."
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Order Settings hidden from clients - managed by admin */}
            
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
                onClick={saveDraft}
                variant="outline"
                className="w-full"
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

