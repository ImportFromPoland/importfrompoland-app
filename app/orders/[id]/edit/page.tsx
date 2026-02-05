"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OrderLineData } from "@/components/OrderLineForm";
import { Logo } from "@/components/Logo";
import { SupplierCombobox } from "@/components/SupplierCombobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Trash2 } from "lucide-react";
import { PLN_TO_EUR_RATE, DEFAULT_VAT_RATE, EUR_TO_PLN_DIVISOR } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

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
  const [viewMode, setViewMode] = useState<"classic" | "table">("classic");

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
        const loadedLines = orderData.items
          .map((item: any) => ({
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
          }))
          .sort((a: any, b: any) => (a.line_number || 0) - (b.line_number || 0));
        
        // Ensure we have at least 10 lines for table view
        const maxLineNumber = Math.max(...loadedLines.map((l: any) => l.line_number), 0);
        const emptyLines: OrderLineData[] = [];
        for (let i = loadedLines.length; i < 10; i++) {
          emptyLines.push({
            line_number: maxLineNumber + i + 1,
            product_name: "",
            website_url: "",
            supplier_name: "",
            unit_price: 0,
            quantity: 1,
            currency: "PLN",
            unit_of_measure: "unit",
            discount_percent: 0,
            notes: "",
          });
        }
        setLines([...loadedLines, ...emptyLines]);
      } else {
        // No items, add 10 empty lines for table view
        const emptyLines: OrderLineData[] = [];
        for (let i = 0; i < 10; i++) {
          emptyLines.push({
            line_number: i + 1,
            product_name: "",
            website_url: "",
            supplier_name: "",
            unit_price: 0,
            quantity: 1,
            currency: "PLN",
            unit_of_measure: "unit",
            discount_percent: 0,
            notes: "",
          });
        }
        setLines(emptyLines);
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
    const maxLineNumber = lines.length > 0 ? Math.max(...lines.map(line => line.line_number || 0)) : 0;
    
    const newLine: OrderLineData = {
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
    };
    
    setLines([...lines, newLine]);
    
    // Auto-focus on Product name input in the new row after render
    setTimeout(() => {
      const newRowIndex = lines.length;
      const productInput = document.querySelector(`input[data-line-index="${newRowIndex}"][data-field="product_name"]`) as HTMLInputElement;
      if (productInput) {
        productInput.focus();
      }
    }, 0);
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
        <div className="space-y-6">
          {/* Invoice-style Order Table */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-semibold text-sm">No</th>
                      <th className="text-left p-3 font-semibold text-sm">Product name</th>
                      <th className="text-left p-3 font-semibold text-sm">Website URL</th>
                      <th className="text-left p-3 font-semibold text-sm">Supplier</th>
                      <th className="text-right p-3 font-semibold text-sm">Unit price (PLN)</th>
                      <th className="text-right p-3 font-semibold text-sm">Quantity</th>
                      <th className="text-left p-3 font-semibold text-sm">Unit of measure</th>
                      <th className="text-left p-3 font-semibold text-sm">Notes</th>
                      <th className="text-right p-3 font-semibold text-sm">Line total (€)</th>
                      <th className="text-center p-3 font-semibold text-sm w-12"></th>
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
                          <td className="p-3 font-medium text-sm">{line.line_number}</td>
                          <td className="p-3">
                            <Input
                              data-line-index={index}
                              data-field="product_name"
                              value={line.product_name}
                              onChange={(e) => updateLine(index, { ...line, product_name: e.target.value })}
                              placeholder="Enter product name"
                              className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              data-line-index={index}
                              data-field="website_url"
                              type="url"
                              value={line.website_url}
                              onChange={(e) => updateLine(index, { ...line, website_url: e.target.value })}
                              placeholder="https://..."
                              className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="p-3">
                            <SupplierCombobox
                              value={line.supplier_name}
                              onChange={(value) => updateLine(index, { ...line, supplier_name: value, original_supplier_name: value })}
                              placeholder="Select supplier"
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              data-line-index={index}
                              data-field="unit_price"
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
                          <td className="p-3">
                            <Input
                              data-line-index={index}
                              data-field="quantity"
                              type="number"
                              step={line.unit_of_measure === "m2" ? "0.01" : "1"}
                              min={line.unit_of_measure === "m2" ? "0.01" : "1"}
                              value={line.quantity}
                              onChange={(e) => updateLine(index, { ...line, quantity: parseFloat(e.target.value) || 1 })}
                              className="w-full text-right border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                            />
                          </td>
                          <td className="p-3">
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
                          <td className="p-3">
                            <Input
                              data-line-index={index}
                              data-field="notes"
                              value={line.notes}
                              onChange={(e) => updateLine(index, { ...line, notes: e.target.value })}
                              placeholder="Optional notes"
                              className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="p-3 text-right font-semibold text-sm">
                            {lineTotalEUR > 0 ? formatCurrency(lineTotalEUR, "EUR") : "-"}
                          </td>
                          <td className="p-3 text-center">
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
                  {/* Invoice-style Totals Footer */}
                  <tfoot>
                    <tr>
                      <td colSpan={7} className="p-4"></td>
                      <td colSpan={2} className="p-4 border-t-2 border-gray-300">
                        <div className="flex flex-col items-end space-y-2">
                          <div className="flex justify-between w-full text-sm">
                            <span className="text-muted-foreground">Subtotal (excl. VAT):</span>
                            <span className="font-medium">{formatCurrency(totals.itemsNet, currency)}</span>
                          </div>
                          <div className="flex justify-between w-full text-sm">
                            <span className="text-muted-foreground">VAT ({vatRate}%):</span>
                            <span className="font-medium">{formatCurrency(totals.vatAmount, currency)}</span>
                          </div>
                          {shippingCost > 0 && (
                            <div className="flex justify-between w-full text-sm">
                              <span className="text-muted-foreground">Shipping:</span>
                              <span className="font-medium">{formatCurrency(shippingCost, currency)}</span>
                            </div>
                          )}
                          <div className="flex justify-between w-full pt-2 border-t border-gray-300">
                            <span className="font-semibold text-base">Grand Total:</span>
                            <span className="font-bold text-lg text-primary">{formatCurrency(totals.grandTotal, currency)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {/* Add Item Button */}
              <div className="p-4 border-t">
                <Button
                  variant="outline"
                  onClick={addLine}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add another item
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Order-level Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Client Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="client_notes" className="sr-only">Additional Notes</Label>
              <Textarea
                id="client_notes"
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Any additional information about this order..."
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              Cancel
            </Button>
            <Button
              onClick={saveChanges}
              disabled={saving}
              className="min-w-[140px]"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

