"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { TotalsPanel } from "@/components/TotalsPanel";
import { PLN_TO_EUR_RATE } from "@/lib/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Save, Trash2, Plus, Edit2, Check, X, FileText, Download, CheckCircle, RotateCcw, Send } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get order with items
      const { data: orderData } = await supabase
        .from("orders")
        .select(`
          *,
          company:companies(*),
          created_by_profile:profiles!created_by(full_name, email),
          items:order_items(*),
          invoices(*),
          shipments(*)
        `)
        .eq("id", params.id)
        .single();

      if (!orderData) {
        router.push("/admin/orders");
        return;
      }

      setOrder(orderData);
      // Sort items by line_number ascending (chronological order)
      const sortedItems = (orderData.items || []).sort((a: any, b: any) => 
        (a.line_number || 0) - (b.line_number || 0)
      );
      setItems(sortedItems);

      // Get order totals
      const { data: totalsData } = await supabase
        .from("order_totals")
        .select("*")
        .eq("order_id", params.id)
        .single();

      setTotals(totalsData);
    } catch (error) {
      console.error("Error loading order:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderHeader = async (field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ [field]: value })
        .eq("id", order.id);

      if (error) throw error;

      setOrder({ ...order, [field]: value });
      
      // Reload totals if financial fields changed
      if (["vat_rate", "shipping_cost", "discount_percent", "discount_amount", "discount_type", "markup_percent"].includes(field)) {
        await loadData();
      }
    } catch (error: any) {
      alert("Error updating order: " + error.message);
    }
  };

  const updateItem = async (itemId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from("order_items")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;

      // Update local state immediately for instant UI update
      const updatedItems = items.map((item) => (item.id === itemId ? { ...item, ...updates } : item));
      setItems(updatedItems);
      setEditingItemId(null);
      
      // Reload to get fresh totals from database (async, won't block UI)
      loadData();
    } catch (error: any) {
      alert("Error updating item: " + error.message);
    }
  };

  const saveBasket = async () => {
    if (!order || !items || items.length === 0) {
      alert("No items to save");
      return;
    }

    try {
      // Recalculate original_net_price for all items based on current unit_price
      const updates = items.map((item) => {
        let originalNetPrice = 0;
        
        // Calculate original net price from gross price with default 23% VAT
        if (item.currency === "PLN" && order.currency === "EUR") {
          const grossEUR = item.unit_price * PLN_TO_EUR_RATE;
          originalNetPrice = grossEUR / 1.23; // Remove 23% VAT
        } else if (item.currency === order.currency) {
          originalNetPrice = item.unit_price / 1.23; // Remove 23% VAT
        } else {
          originalNetPrice = item.unit_price / 1.23; // Remove 23% VAT
        }

        return {
          id: item.id,
          original_net_price: originalNetPrice,
        };
      });

      // Update all items in parallel
      const updatePromises = updates.map((update) =>
        supabase
          .from("order_items")
          .update({ original_net_price: update.original_net_price })
          .eq("id", update.id)
      );

      const results = await Promise.all(updatePromises);
      
      // Check for errors
      const errors = results.filter((result) => result.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} item(s)`);
      }

      // Reload data to refresh totals from database
      await loadData();
      
      alert("Basket saved successfully! Totals have been recalculated.");
    } catch (error: any) {
      alert("Error saving basket: " + error.message);
    }
  };

  // Calculate totals function (not a hook, can be called conditionally)
  const calculateTotals = () => {
    if (!order || !items || items.length === 0) {
      return totals || null; // Fallback to database totals
    }

    let itemsNet = 0;

    items.forEach((item) => {
      let lineNet = 0;
      
      // Check if we have original_net_price (from database)
      if (item.original_net_price) {
        // Use stored original net price (maintains consistency when VAT changes)
        lineNet = item.original_net_price * item.quantity;
      } else {
        // Calculate NET from current gross price (for new items)
        let lineGrossPLN = item.unit_price * item.quantity;
        let lineGrossEUR = lineGrossPLN;
        
        // Convert PLN to EUR if needed
        if (item.currency === "PLN" && order.currency === "EUR") {
          lineGrossEUR = lineGrossPLN * PLN_TO_EUR_RATE;
        }
        
        // Calculate NET from GROSS (remove VAT)
        const effectiveVatRate = item.vat_rate_override || order.vat_rate || 23;
        lineNet = lineGrossEUR / (1 + effectiveVatRate / 100);
      }

      // Apply line discount to NET
      if (item.discount_percent > 0) {
        lineNet = lineNet * (1 - item.discount_percent / 100);
      }

      itemsNet += lineNet;
    });

    // Apply header modifiers
    const headerDiscountPercent = order.discount_percent || 0;
    const headerDiscountAmount = order.discount_amount || 0;
    const headerDiscountType = order.discount_type || "percent";
    const headerMarkupPercent = order.markup_percent || 0;
    
    // Calculate discount amount based on type
    let discountAmount = 0;
    if (headerDiscountType === "amount") {
      discountAmount = headerDiscountAmount;
    } else {
      discountAmount = itemsNet * (headerDiscountPercent / 100);
    }
    
    const itemsNetAfterHeader =
      (itemsNet - discountAmount) * (1 + headerMarkupPercent / 100);

    const vatRate = order.vat_rate || 23;
    const vatAmount = (itemsNetAfterHeader * vatRate) / 100;
    const itemsGross = itemsNetAfterHeader + vatAmount;
    const shippingCost = order.shipping_cost || 0;
    const grandTotal = itemsGross + shippingCost;

    return {
      items_net: itemsNetAfterHeader,
      subtotal_without_vat: itemsNetAfterHeader,
      vat_amount: vatAmount,
      items_gross: itemsGross,
      grand_total: grandTotal,
    };
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const { error } = await supabase
        .from("order_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      await loadData();
    } catch (error: any) {
      alert("Error deleting item: " + error.message);
    }
  };

  const addNewItem = async () => {
    try {
      const newLineNumber = Math.max(...items.map((i) => i.line_number), 0) + 1;
      
      const { error } = await supabase
        .from("order_items")
        .insert({
          order_id: order.id,
          line_number: newLineNumber,
          product_name: "New Item",
          unit_price: 0.01, // Must be > 0 due to positive_price constraint
          quantity: 1,
          currency: "PLN",
          unit_of_measure: "unit",
          discount_percent: 0,
        });

      if (error) throw error;

      await loadData();
    } catch (error: any) {
      alert("Error adding item: " + error.message);
    }
  };

  const confirmOrder = async () => {
    if (!confirm("Confirm this order? This will generate a confirmation document.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "confirmed" })
        .eq("id", order.id);

      if (error) throw error;

      alert("Order confirmed successfully!");
      await loadData();
    } catch (error: any) {
      alert("Error confirming order: " + error.message);
    }
  };

  const revertToBasket = async () => {
    if (!confirm("Are you sure you want to revert this order back to basket? The client will be able to edit it again.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "draft",
          submitted_at: null,
        })
        .eq("id", order.id);

      if (error) throw error;

      alert("Order has been reverted to basket successfully!");
      await loadData();
    } catch (error: any) {
      alert("Error reverting order: " + error.message);
    }
  };

  const submitOrderForClient = async () => {
    if (!order) return;

    if (!confirm(`Are you sure you want to submit this order on behalf of ${order.company?.name}? This will generate an order number.`)) {
      return;
    }

    try {
      // Check if order has items
      if (!items || items.length === 0) {
        alert("Cannot submit an order with no items. Please add items first.");
        return;
      }

      // Update order status directly - trigger will generate order number
      const { error } = await supabase
        .from("orders")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (error) throw error;

      alert("Order submitted successfully! Order number will be generated automatically.");
      await loadData();
    } catch (error: any) {
      alert("Error submitting order: " + error.message);
    }
  };

  const toggleItemOrdered = async (itemId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("order_items")
        .update({
          ordered_from_supplier: !currentValue,
          ordered_from_supplier_at: !currentValue ? new Date().toISOString() : null,
        })
        .eq("id", itemId);

      if (error) throw error;

      await loadData();
    } catch (error: any) {
      alert("Error updating item: " + error.message);
    }
  };

  const toggleItemReceived = async (itemId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("order_items")
        .update({
          received_in_warehouse: !currentValue,
          received_in_warehouse_at: !currentValue ? new Date().toISOString() : null,
        })
        .eq("id", itemId);

      if (error) throw error;

      // Check if all items are received and update order status
      await updateOrderStatusBasedOnItems();
      
      await loadData();
    } catch (error: any) {
      alert("Error updating item: " + error.message);
    }
  };

  const updateOrderStatusBasedOnItems = async () => {
    try {
      // Get fresh item data
      const { data: currentItems } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order.id);

      if (!currentItems || currentItems.length === 0) return;

      const receivedCount = currentItems.filter((i) => i.received_in_warehouse).length;
      const totalCount = currentItems.length;

      let newStatus = order.status;

      if (receivedCount === 0) {
        // No items received yet - keep as confirmed
        newStatus = "confirmed";
      } else if (receivedCount < totalCount) {
        // Some items received - partially complete
        newStatus = "partially_received";
      } else if (receivedCount === totalCount) {
        // All items received - ready to ship
        newStatus = "ready_to_ship";
      }

      if (newStatus !== order.status) {
        await supabase
          .from("orders")
          .update({ status: newStatus })
          .eq("id", order.id);
      }
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  const markAsShipped = async () => {
    if (!confirm("Mark this order as shipped?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "shipped" })
        .eq("id", order.id);

      if (error) throw error;

      alert("Order marked as shipped!");
      await loadData();
    } catch (error: any) {
      alert("Error updating order: " + error.message);
    }
  };

  const generatePDF = async () => {
    try {
      // Dynamic import to avoid SSR issues with react-pdf
      const { pdf } = await import('@react-pdf/renderer');
      const { OrderPDF } = await import('@/components/OrderPDF');
      const React = await import('react');

      // Generate PDF
      const blob = await pdf(
        React.createElement(OrderPDF, {
          order,
          company: order.company,
          items,
          totals,
          createdByProfile: order.created_by_profile,
        }) as any
      ).toBlob();

      // Download PDF
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Order_${order.number || order.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`PDF downloaded: Order_${order.number || order.id}.pdf`);
    } catch (error: any) {
      console.error('PDF generation error:', error);
      alert("Error generating PDF: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        Loading...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center py-12">
        Order not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              {order.number || "Draft Basket"}
            </h1>
            <p className="text-muted-foreground">
              {order.company?.name} • {formatDate(order.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          
          {/* Save Basket button - available for draft, submitted, and confirmed orders (for late minute changes) */}
          {["draft", "submitted", "confirmed"].includes(order.status) && (
            <Button onClick={saveBasket} variant="outline" className="bg-blue-50 hover:bg-blue-100 border-blue-300">
              <Save className="h-4 w-4 mr-2" />
              Save Basket
            </Button>
          )}
          
          {/* Action Buttons based on status */}
          {order.status === "draft" && (
            <Button onClick={submitOrderForClient} className="bg-blue-600 hover:bg-blue-700">
              <Send className="h-4 w-4 mr-2" />
              Submit Order for Client
            </Button>
          )}
          {order.status === "submitted" && (
            <>
              <Button onClick={revertToBasket} variant="outline" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                <RotateCcw className="h-4 w-4 mr-2" />
                Revert to Basket
              </Button>
              <Button onClick={confirmOrder} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm Order
              </Button>
            </>
          )}
          
          {["confirmed", "partially_received", "ready_to_ship"].includes(order.status) && (
            <>
              <Button onClick={generatePDF} variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Generate PDF
              </Button>
              
              {order.status === "ready_to_ship" && (
                <Button onClick={markAsShipped} className="bg-teal-600 hover:bg-teal-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Shipped
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Order Items</CardTitle>
                <Button onClick={addNewItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Client Supplier</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Price (PLN)</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Total (EUR)</TableHead>
                      {["confirmed", "partially_received", "ready_to_ship", "shipped"].includes(order.status) && (
                        <>
                          <TableHead>Actual Supplier</TableHead>
                          <TableHead className="text-right">Net Cost (PLN)</TableHead>
                          <TableHead className="text-right">Logistics (PLN)</TableHead>
                          <TableHead className="text-center">Received</TableHead>
                        </>
                      )}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={["confirmed", "partially_received", "ready_to_ship", "shipped"].includes(order.status) ? 14 : 10} className="text-center py-8 text-muted-foreground">
                          No items in this order
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.line_number}</TableCell>
                          <TableCell>
                            {editingItemId === item.id ? (
                              <Input
                                defaultValue={item.product_name}
                                onBlur={(e) =>
                                  updateItem(item.id, { product_name: e.target.value })
                                }
                                className="min-w-[200px]"
                              />
                            ) : (
                              <div className="min-w-[200px]">{item.product_name}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingItemId === item.id ? (
                              <Input
                                defaultValue={item.supplier_name || ""}
                                onBlur={(e) =>
                                  updateItem(item.id, { supplier_name: e.target.value })
                                }
                              />
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                {item.supplier_name || "-"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingItemId === item.id ? (
                              <Input
                                defaultValue={item.website_url || ""}
                                onBlur={(e) =>
                                  updateItem(item.id, { website_url: e.target.value })
                                }
                                placeholder="https://"
                              />
                            ) : (
                              <div className="text-xs">
                                {item.website_url ? (
                                  <a
                                    href={item.website_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    Link
                                  </a>
                                ) : (
                                  "-"
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingItemId === item.id ? (
                              <Input
                                type="number"
                                step="0.01"
                                defaultValue={item.unit_price}
                                onBlur={(e) =>
                                  updateItem(item.id, {
                                    unit_price: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-24"
                              />
                            ) : (
                              formatCurrency(item.unit_price, "PLN")
                            )}
                          </TableCell>
                          <TableCell>
                            {editingItemId === item.id ? (
                              <Input
                                type="number"
                                step={item.unit_of_measure === "m2" ? "0.01" : "1"}
                                defaultValue={item.quantity}
                                onBlur={(e) =>
                                  updateItem(item.id, {
                                    quantity: parseFloat(e.target.value) || 1,
                                  })
                                }
                                className="w-20"
                              />
                            ) : (
                              item.quantity
                            )}
                          </TableCell>
                          <TableCell>
                            {editingItemId === item.id ? (
                              <Select
                                defaultValue={item.unit_of_measure}
                                onValueChange={(value) =>
                                  updateItem(item.id, { unit_of_measure: value })
                                }
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unit">Unit</SelectItem>
                                  <SelectItem value="m2">m²</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-sm">
                                {item.unit_of_measure === "m2" ? "m²" : "pcs"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingItemId === item.id ? (
                              <Textarea
                                defaultValue={item.notes || ""}
                                onBlur={(e) =>
                                  updateItem(item.id, { notes: e.target.value })
                                }
                                placeholder="Item notes..."
                                rows={2}
                                className="min-w-[150px]"
                              />
                            ) : (
                              <div className="min-w-[150px] text-sm">
                                {item.notes || "-"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(
                              item.unit_price * item.quantity / 3.1,
                              "EUR"
                            )}
                          </TableCell>
                          
                          {/* Cost Tracking Fields */}
                          {["confirmed", "partially_received", "ready_to_ship", "shipped"].includes(order.status) && (
                            <>
                              <TableCell>
                                <Input
                                  placeholder="Supplier name"
                                  defaultValue={item.actual_supplier || ""}
                                  onBlur={(e) =>
                                    updateItem(item.id, { actual_supplier: e.target.value })
                                  }
                                  className="w-32"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  defaultValue={item.net_cost_pln || ""}
                                  onBlur={async (e) => {
                                    const netCost = parseFloat(e.target.value) || 0;
                                    await updateItem(item.id, { 
                                      net_cost_pln: netCost,
                                      ordered_from_supplier: netCost > 0,
                                      ordered_from_supplier_at: netCost > 0 ? new Date().toISOString() : null
                                    });
                                  }}
                                  className="w-24 text-right"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  defaultValue={item.logistics_cost_pln || ""}
                                  onBlur={(e) =>
                                    updateItem(item.id, { logistics_cost_pln: parseFloat(e.target.value) || 0 })
                                  }
                                  className="w-24 text-right"
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={item.received_in_warehouse || false}
                                  onCheckedChange={() =>
                                    toggleItemReceived(item.id, item.received_in_warehouse)
                                  }
                                />
                              </TableCell>
                            </>
                          )}
                          
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {editingItemId === item.id ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingItemId(null)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingItemId(item.id)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Customer Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={order.client_notes || ""}
                onChange={(e) => setOrder({ ...order, client_notes: e.target.value })}
                onBlur={(e) => updateOrderHeader("client_notes", e.target.value)}
                placeholder="Customer notes or basket name..."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Totals */}
          {(() => {
            const calculatedTotals = calculateTotals();
            const displayTotals = calculatedTotals || totals;
            return displayTotals && (
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal (excl. VAT):</span>
                    <span className="font-medium">{formatCurrency((displayTotals.items_net_before_header || displayTotals.items_net || 0), order.currency)}</span>
                  </div>
                  {(() => {
                    const discountType = order.discount_type || "percent";
                    const discountValue = discountType === "amount" 
                      ? (order.discount_amount || 0)
                      : ((displayTotals.items_net_before_header || displayTotals.items_net || 0) * (order.discount_percent || 0) / 100);
                    return discountValue > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount {discountType === "amount" ? "" : `(${order.discount_percent || 0}%)`}:</span>
                        <span className="font-medium">-{formatCurrency(discountValue, order.currency)}</span>
                      </div>
                    );
                  })()}
                  <div className="flex justify-between text-sm">
                    <span>VAT ({order.vat_rate}%):</span>
                    <span className="font-medium">{formatCurrency((displayTotals.vat_amount || 0), order.currency)}</span>
                  </div>
                  {order.shipping_cost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Shipping:</span>
                      <span className="font-medium">{formatCurrency(order.shipping_cost, order.currency)}</span>
                    </div>
                  )}
                  <div className="border-t pt-3 flex justify-between text-lg font-bold">
                    <span>Grand Total:</span>
                    <span className="text-primary">{formatCurrency((displayTotals.grand_total || 0), order.currency)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Order Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Order Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>VAT Rate</Label>
                <Select
                  value={order.vat_rate.toString()}
                  onValueChange={(value) => {
                    const vatRate = parseFloat(value);
                    setOrder({ ...order, vat_rate: vatRate });
                    updateOrderHeader("vat_rate", vatRate);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="23">23% (Standard Polish VAT)</SelectItem>
                    <SelectItem value="0">0% (EU VAT Registered - Reverse Charge)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Set to 0% for EU VAT registered businesses with valid VAT number
                </p>
              </div>

              <div className="space-y-2">
                <Label>Shipping Cost to Client (EUR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={order.shipping_cost}
                  onChange={(e) =>
                    setOrder({ ...order, shipping_cost: parseFloat(e.target.value) || 0 })
                  }
                  onBlur={(e) =>
                    updateOrderHeader("shipping_cost", parseFloat(e.target.value) || 0)
                  }
                />
              </div>

              {/* Discount Section */}
              <div className="space-y-2 border-t pt-4">
                <Label>Discount</Label>
                <div className="flex gap-2">
                  <Select
                    value={order.discount_type || "percent"}
                    onValueChange={(value) => {
                      setOrder({ ...order, discount_type: value });
                      updateOrderHeader("discount_type", value);
                      // Reset discount when switching types
                      if (value === "percent") {
                        setOrder({ ...order, discount_type: value, discount_amount: 0 });
                        updateOrderHeader("discount_amount", 0);
                      } else {
                        setOrder({ ...order, discount_type: value, discount_percent: 0 });
                        updateOrderHeader("discount_percent", 0);
                      }
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="amount">Amount</SelectItem>
                    </SelectContent>
                  </Select>
                  {order.discount_type === "percent" ? (
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={order.discount_percent || 0}
                      onChange={(e) =>
                        setOrder({ ...order, discount_percent: parseFloat(e.target.value) || 0 })
                      }
                      onBlur={(e) =>
                        updateOrderHeader("discount_percent", parseFloat(e.target.value) || 0)
                      }
                      className="flex-1"
                    />
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={order.discount_amount || 0}
                      onChange={(e) =>
                        setOrder({ ...order, discount_amount: parseFloat(e.target.value) || 0 })
                      }
                      onBlur={(e) =>
                        updateOrderHeader("discount_amount", parseFloat(e.target.value) || 0)
                      }
                      className="flex-1"
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {order.discount_type === "percent" 
                    ? "Percentage discount applied to subtotal"
                    : `Fixed amount discount in ${order.currency || "EUR"}`}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Transport Cost (PLN Net)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={order.transport_cost_pln || 0}
                  onChange={(e) =>
                    setOrder({ ...order, transport_cost_pln: parseFloat(e.target.value) || 0 })
                  }
                  onBlur={(e) =>
                    updateOrderHeader("transport_cost_pln", parseFloat(e.target.value) || 0)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Internal cost for profitability calculations (not visible to client)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Internal Costs & Profitability (Admin Only) */}
          {["confirmed", "partially_received", "ready_to_ship", "shipped"].includes(order.status) && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-orange-900">Internal Costs & Profitability</CardTitle>
                <p className="text-xs text-orange-700">Not visible to client</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Overall Logistics Cost (EUR)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={order.logistics_cost || 0}
                    onChange={(e) =>
                      setOrder({ ...order, logistics_cost: parseFloat(e.target.value) || 0 })
                    }
                    onBlur={(e) =>
                      updateOrderHeader("logistics_cost", parseFloat(e.target.value) || 0)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Internal packing, delivery costs, etc.
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t">
                  <div className="flex justify-between text-sm">
                    <span>Total Item Cost (PLN):</span>
                    <span className="font-medium">
                      {formatCurrency(
                        items.reduce((sum, item) => sum + ((item.net_cost_pln || 0) * item.quantity), 0),
                        "PLN"
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Item Logistics (PLN):</span>
                    <span className="font-medium">
                      {formatCurrency(
                        items.reduce((sum, item) => sum + ((item.logistics_cost_pln || 0) * item.quantity), 0),
                        "PLN"
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Cost in EUR (@ 3.1):</span>
                    <span className="font-medium">
                      {formatCurrency(
                        items.reduce((sum, item) => sum + ((item.net_cost_pln || 0) * item.quantity) + ((item.logistics_cost_pln || 0) * item.quantity), 0) / 3.1,
                        "EUR"
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Global Logistics (EUR):</span>
                    <span className="font-medium">
                      {formatCurrency(order.logistics_cost || 0, "EUR")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Transport Cost (EUR):</span>
                    <span className="font-medium">
                      {formatCurrency((order.transport_cost_pln || 0) / 4.2, "EUR")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t pt-2">
                    <span>Total Costs:</span>
                    <span>
                      {formatCurrency(
                        (items.reduce((sum, item) => sum + ((item.net_cost_pln || 0) * item.quantity) + ((item.logistics_cost_pln || 0) * item.quantity), 0) / 4.2) + (order.logistics_cost || 0) + ((order.transport_cost_pln || 0) / 4.2),
                        "EUR"
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-orange-900">
                    <span>Client Pays:</span>
                    <span>{formatCurrency(((() => {
                      const calculatedTotals = calculateTotals();
                      return (calculatedTotals?.grand_total || totals?.grand_total || 0);
                    })()), order.currency)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Net Profit:</span>
                    <span className={(() => {
                      const calculatedTotals = calculateTotals();
                      const grandTotal = calculatedTotals?.grand_total || totals?.grand_total || 0;
                      const totalCosts = (items.reduce((sum, item) => sum + ((item.net_cost_pln || 0) * item.quantity) + ((item.logistics_cost_pln || 0) * item.quantity), 0) / 4.2) + (order.logistics_cost || 0) + ((order.transport_cost_pln || 0) / 4.2);
                      return (grandTotal - totalCosts) >= 0 ? "text-green-600" : "text-red-600";
                    })()}>
                      {formatCurrency(
                        (() => {
                          const calculatedTotals = calculateTotals();
                          const grandTotal = calculatedTotals?.grand_total || totals?.grand_total || 0;
                          const totalCosts = (items.reduce((sum, item) => sum + ((item.net_cost_pln || 0) * item.quantity) + ((item.logistics_cost_pln || 0) * item.quantity), 0) / 4.2) + (order.logistics_cost || 0) + ((order.transport_cost_pln || 0) / 4.2);
                          return grandTotal - totalCosts;
                        })(),
                        "EUR"
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <div className="font-semibold">{order.company?.name}</div>
                {order.company?.vat_number && (
                  <div className="text-muted-foreground">
                    VAT: {order.company.vat_number}
                  </div>
                )}
              </div>
              {order.company?.address_line1 && (
                <div className="text-muted-foreground">
                  <div>{order.company.address_line1}</div>
                  {order.company.address_line2 && (
                    <div>{order.company.address_line2}</div>
                  )}
                  <div>
                    {order.company.city}, {order.company.postal_code}
                  </div>
                  <div>{order.company.country}</div>
                </div>
              )}
              {order.company?.phone && (
                <div className="text-muted-foreground">
                  Phone: {order.company.phone}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
