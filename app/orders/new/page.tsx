"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderLineForm, type OrderLineData } from "@/components/OrderLineForm";
import { TotalsPanel } from "@/components/TotalsPanel";
import { SupplierCombobox } from "@/components/SupplierCombobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Save, Send, Table2, LayoutGrid, Trash2 } from "lucide-react";
import { PLN_TO_EUR_RATE, DEFAULT_VAT_RATE } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
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
  const [viewMode, setViewMode] = useState<"classic" | "table">("table");

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

  const totals = useMemo(() => {
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
  }, [lines, vatRate, shippingCost, headerDiscountPercent, headerMarkupPercent, currency]);

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

      <main className={`mx-auto px-4 sm:px-6 lg:px-8 py-8 ${viewMode === "table" ? "max-w-[95%] xl:max-w-[90%]" : "max-w-7xl"}`}>
        <div className={`space-y-6 ${viewMode === "table" ? "" : "grid grid-cols-1 lg:grid-cols-3 gap-6"}`}>
          <div className={viewMode === "table" ? "space-y-6" : "lg:col-span-2 space-y-6"}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Order Items</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode(viewMode === "table" ? "classic" : "table")}
                  >
                    {viewMode === "classic" ? (
                      <>
                        <Table2 className="h-4 w-4 mr-2" />
                        Switch to Table View
                      </>
                    ) : (
                      <>
                        <LayoutGrid className="h-4 w-4 mr-2" />
                        Switch to Classic View
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {viewMode === "classic" ? (
                  <div className="space-y-4">
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
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-2 font-semibold text-sm">No</th>
                            <th className="text-left p-2 font-semibold text-sm">Product name</th>
                            <th className="text-left p-2 font-semibold text-sm">Website URL</th>
                            <th className="text-left p-2 font-semibold text-sm">Supplier</th>
                            <th className="text-right p-2 font-semibold text-sm">Unit price (PLN)</th>
                            <th className="text-right p-2 font-semibold text-sm">Quantity</th>
                            <th className="text-left p-2 font-semibold text-sm">Unit of measure</th>
                            <th className="text-left p-2 font-semibold text-sm">Notes</th>
                            <th className="text-right p-2 font-semibold text-sm">Line total (€)</th>
                            <th className="text-center p-2 font-semibold text-sm w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((line, index) => {
                            // Calculate line total: PLN price * quantity / 3.1 (includes VAT + delivery)
                            const unitPriceEUR = line.unit_price > 0 
                              ? line.unit_price * PLN_TO_EUR_RATE 
                              : 0;
                            const lineTotalEUR = unitPriceEUR * line.quantity;
                            
                            return (
                              <tr key={line.line_number || index} className="border-b hover:bg-gray-50/50 transition-colors">
                                <td className="p-2 font-medium text-sm">{line.line_number}</td>
                                <td className="p-2">
                                  <Input
                                    value={line.product_name}
                                    onChange={(e) => updateLine(index, { ...line, product_name: e.target.value })}
                                    placeholder="Enter product name"
                                    className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="url"
                                    value={line.website_url}
                                    onChange={(e) => updateLine(index, { ...line, website_url: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-sm"
                                  />
                                </td>
                                <td className="p-2">
                                  <SupplierCombobox
                                    value={line.supplier_name}
                                    onChange={(value) => updateLine(index, { ...line, supplier_name: value, original_supplier_name: value })}
                                    placeholder="Select supplier"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={line.unit_price || ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      const cleanValue = value.replace(/^0+/, '') || '0';
                                      updateLine(index, { ...line, unit_price: parseFloat(cleanValue) || 0 });
                                    }}
                                    placeholder="0.00"
                                    className="w-full text-right border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    step={line.unit_of_measure === "m2" ? "0.01" : "1"}
                                    min={line.unit_of_measure === "m2" ? "0.01" : "1"}
                                    value={line.quantity}
                                    onChange={(e) => updateLine(index, { ...line, quantity: parseFloat(e.target.value) || 1 })}
                                    className="w-full text-right border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                                  />
                                </td>
                                <td className="p-2">
                                  <Select
                                    value={line.unit_of_measure || "unit"}
                                    onValueChange={(value: "unit" | "m2") =>
                                      updateLine(index, { ...line, unit_of_measure: value })
                                    }
                                  >
                                    <SelectTrigger className="w-full h-8 border-0 bg-transparent focus:ring-1 focus:ring-blue-500">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unit">pcs</SelectItem>
                                      <SelectItem value="m2">m²</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-2">
                                  <Input
                                    value={line.notes}
                                    onChange={(e) => updateLine(index, { ...line, notes: e.target.value })}
                                    placeholder="Optional notes"
                                    className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-sm"
                                  />
                                </td>
                                <td className="p-2 text-right font-semibold text-sm">
                                  {lineTotalEUR > 0 ? formatCurrency(lineTotalEUR, "EUR") : "-"}
                                </td>
                                <td className="p-2 text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm("Remove this line?")) {
                                        removeLine(index);
                                      }
                                    }}
                                    className="h-8 w-8 p-0 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <Button variant="outline" onClick={addLine} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add another item
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {viewMode === "table" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Client Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Label htmlFor="client_notes" className="sr-only">Client Notes</Label>
                    <Textarea
                      id="client_notes"
                      value={clientNotes}
                      onChange={(e) => setClientNotes(e.target.value)}
                      placeholder="Any additional notes..."
                      className="min-h-[100px]"
                    />
                  </CardContent>
                </Card>

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
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Client Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Label htmlFor="client_notes" className="sr-only">Client Notes</Label>
                    <Textarea
                      id="client_notes"
                      value={clientNotes}
                      onChange={(e) => setClientNotes(e.target.value)}
                      placeholder="Any additional notes..."
                      className="min-h-[100px]"
                    />
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {viewMode === "classic" && (
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
          )}
        </div>
      </main>
    </div>
  );
}

