"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { Package, Truck, Printer, CheckCircle2, Clock, FileText } from "lucide-react";

export default function WarehousePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [packingOrders, setPackingOrders] = useState<any[]>([]);
  const [sentOrders, setSentOrders] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get supplier orders (deliveries from suppliers)
      const { data: supplierOrders } = await supabase
        .from("supplier_orders")
        .select(`
          *,
          supplier_order_items(
            *,
            order_item:order_items(
              *,
              order:orders(
                number,
                status,
                company:companies(name),
                created_by_profile:profiles!created_by(full_name, email)
              )
            )
          )
        `)
        .eq("status", "ordered")
        .order("order_date", { ascending: false });

      if (supplierOrders) {
        // Group supplier orders by supplier and date
        const deliveryMap = new Map();
        supplierOrders.forEach((supplierOrder) => {
          const key = `${supplierOrder.supplier_name}_${supplierOrder.order_date}`;
          if (!deliveryMap.has(key)) {
            deliveryMap.set(key, {
              supplier: supplierOrder.supplier_name,
              order_date: supplierOrder.order_date,
              supplier_order_id: supplierOrder.id,
              items: [],
              itemIds: new Set() // Track added items to prevent duplicates
            });
          }
          
          supplierOrder.supplier_order_items?.forEach((item: any) => {
            // Skip if order_item is missing or invalid
            if (!item || !item.order_item || !item.id) {
              return;
            }
            
            // Skip items from orders that are already dispatched, delivered, or cancelled
            const orderStatus = item.order_item.order?.status;
            if (orderStatus && ['dispatched', 'delivered', 'cancelled'].includes(orderStatus)) {
              return;
            }
            
            // Skip items that have already been received in warehouse
            // This ensures each item only appears once in deliveries, even if re-ordered
            if (item.order_item.received_in_warehouse === true) {
              return;
            }
            
            // Use supplier_order_item_id as unique identifier to prevent duplicates
            const itemId = item.id;
            const delivery = deliveryMap.get(key);
            
            // Only add if not already added
            if (!delivery.itemIds.has(itemId)) {
              delivery.itemIds.add(itemId);
              delivery.items.push({
                ...item.order_item,
                supplier_order_item_id: item.id,
                quantity_ordered: item.quantity_ordered,
                quantity_received: item.quantity_received,
                unit_cost_pln: item.unit_cost_pln,
                order_number: item.order_item.order?.number,
                customer_name: item.order_item.order?.company?.name,
                customer_profile: item.order_item.order?.created_by_profile,
              });
            }
          });
        });

        // Remove itemIds from final result (it was only for tracking)
        // Also filter out deliveries that have no items (all items were from dispatched/delivered orders)
        const deliveries = Array.from(deliveryMap.values())
          .map(delivery => {
            const { itemIds, ...rest } = delivery;
            return rest;
          })
          .filter(delivery => delivery.items.length > 0); // Only keep deliveries with items
        
        setDeliveries(deliveries);

        // Get all orders first to see what statuses exist
        const { data: allOrders, error: allOrdersError } = await supabase
          .from("orders")
          .select(`
            *,
            company:companies(*),
            created_by_profile:profiles!created_by(full_name, email),
            items:order_items(
              *,
              supplier_order_items(
                supplier_order:supplier_orders(supplier_name)
              )
            )
          `)
          .order("created_at", { ascending: false });

        if (allOrdersError) {
          console.error("All orders query error:", allOrdersError);
        }

        // Filter orders for packing
        const orders = allOrders?.filter(o => 
          ["confirmed", "paid", "partially_packed", "packed", "partially_dispatched", "dispatched"].includes(o.status)
        ) || [];

        if (orders) {
          const filteredOrders = orders.filter((o) => 
            o.items && 
            o.items.length > 0 && 
            (o.status === "paid" || o.items.some((item: any) => item.received_in_warehouse))
          );
          
          // Sort orders: those with all items received but not all packed go to the end
          const sortedOrders = filteredOrders.sort((a, b) => {
            const aAllReceived = a.items.every((item: any) => item.received_in_warehouse);
            const aAllPacked = a.items.every((item: any) => item.packed);
            const bAllReceived = b.items.every((item: any) => item.received_in_warehouse);
            const bAllPacked = b.items.every((item: any) => item.packed);
            
            // Orders with all received but not all packed go to the end
            const aShouldBeLast = aAllReceived && !aAllPacked;
            const bShouldBeLast = bAllReceived && !bAllPacked;
            
            if (aShouldBeLast && !bShouldBeLast) return 1;
            if (!aShouldBeLast && bShouldBeLast) return -1;
            
            // Otherwise sort by creation date (newest first)
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          
          setPackingOrders(sortedOrders);
        }

        // Load sent orders (dispatched status)
        const { data: sentOrdersData } = await supabase
          .from("orders")
          .select(`
            id,
            number,
            company:companies(name),
            created_by_profile:profiles!created_by(full_name, email),
            dispatched_at,
            planned_delivery_date,
            updated_at
          `)
          .eq("status", "dispatched")
          .order("dispatched_at", { ascending: false });

        if (sentOrdersData) {
          setSentOrders(sentOrdersData);
        }
      }
    } catch (error) {
      console.error("Error loading warehouse data:", error);
    } finally {
      setLoading(false);
    }
  };

  const markItemReceived = async (supplierOrderItemId: string, received: boolean) => {
    try {
      // Update supplier order item
      await supabase
        .from("supplier_order_items")
        .update({
          quantity_received: received ? 1 : 0, // For now, just mark as received/not received
        })
        .eq("id", supplierOrderItemId);

      // Update local state instead of reloading
      setDeliveries(prevDeliveries => 
        prevDeliveries.map(delivery => ({
          ...delivery,
          items: delivery.items.map(item => 
            item.supplier_order_item_id === supplierOrderItemId 
              ? { ...item, quantity_received: received ? 1 : 0 }
              : item
          )
        }))
      );
    } catch (error: any) {
      alert("Błąd: " + error.message);
    }
  };

  const handleConfirmDelivery = async (supplierOrderId: string) => {
    try {
      // Update supplier order status to received
      await supabase
        .from("supplier_orders")
        .update({ status: "received" })
        .eq("id", supplierOrderId);

      // Update order items to mark them as received in warehouse
      const delivery = deliveries.find(d => d.supplier_order_id === supplierOrderId);
      if (delivery) {
        for (const item of delivery.items) {
          await supabase
            .from("order_items")
            .update({
              received_in_warehouse: true,
              received_in_warehouse_at: new Date().toISOString()
            })
            .eq("id", item.id);
        }
      }

      // Remove delivery from local state
      setDeliveries(prevDeliveries => 
        prevDeliveries.filter(d => d.supplier_order_id !== supplierOrderId)
      );

      // Reload packing orders to show newly received items
      loadData();

      alert("Dostawa potwierdzona! Produkty są teraz dostępne do pakowania.");
    } catch (error: any) {
      alert("Błąd podczas potwierdzania dostawy: " + error.message);
    }
  };

  const markItemPacked = async (itemId: string, packed: boolean) => {
    try {
      await supabase
        .from("order_items")
        .update({
          packed: packed,
          packed_at: packed ? new Date().toISOString() : null,
        })
        .eq("id", itemId);

      // Update local state instead of reloading
      setPackingOrders(prevOrders => 
        prevOrders.map(order => ({
          ...order,
          items: order.items.map(item => 
            item.id === itemId 
              ? { ...item, packed: packed, packed_at: packed ? new Date().toISOString() : null }
              : item
          )
        }))
      );

      // Check if all items in the order are packed, then update order status
      const order = packingOrders.find(o => o.items.some((item: any) => item.id === itemId));
      if (order) {
        const allItemsPacked = order.items.every((item: any) => 
          item.id === itemId ? packed : item.packed
        );
        
        if (allItemsPacked) {
          // Update order status to packed
          await supabase
            .from("orders")
            .update({ status: "packed" })
            .eq("id", order.id);
        }
      }
    } catch (error: any) {
      alert("Błąd: " + error.message);
    }
  };

  const generateDeliveryPDF = async (delivery: any) => {
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { WarehouseDeliveryPDF } = await import('@/components/WarehousePDF');
      const React = await import('react');

      const blob = await pdf(
        React.createElement(WarehouseDeliveryPDF, {
          supplier: delivery.supplier,
          orderDate: delivery.order_date,
          items: delivery.items,
          type: 'incoming'
        }) as any
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Dostawa_${delivery.supplier}_${delivery.order_date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('PDF generation error:', error);
      alert("Błąd podczas generowania PDF: " + error.message);
    }
  };

  const generateOrderPDF = async (order: any) => {
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { WarehouseDeliveryPDF } = await import('@/components/WarehousePDF');
      const React = await import('react');

      const blob = await pdf(
        React.createElement(WarehouseDeliveryPDF, {
          supplier: '',
          orderDate: order.created_at,
          items: [],
          type: 'outgoing',
          order: order
        }) as any
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Zamowienie_${order.number || order.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('PDF generation error:', error);
      alert("Błąd podczas generowania PDF: " + error.message);
    }
  };

  const generateShippingLabels = async (orderId: string, numberOfLabels: number = 8) => {
    try {
      // Find the order
      const order = packingOrders.find((o) => o.id === orderId);
      if (!order) {
        alert("Nie znaleziono zamówienia");
        return;
      }

      // Always generate 8 labels in 2x4 grid
      const labelsToGenerate = 8;

      // Create a simple label HTML
      const labelHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { 
              size: A4; 
              margin: 0; 
            }
            body { 
              margin: 0; 
              padding: 8mm; 
              font-family: Arial, sans-serif; 
              background: white;
            }
            .page { 
              width: 210mm; 
              height: 297mm; 
              display: grid; 
              grid-template-columns: 1fr 1fr;
              grid-template-rows: repeat(4, 1fr);
              gap: 2mm;
            }
            .label { 
              width: 100%; 
              height: 100%; 
              border: 1px solid #ddd; 
              padding: 8mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              position: relative;
            }
            .label-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 4mm;
            }
            .logo { 
              width: 96px;
              height: 48px;
              object-fit: contain;
            }
            .address { 
              line-height: 1.4; 
              font-size: 14px;
              color: #000;
            }
            .address strong {
              font-size: 16px;
              font-weight: bold;
            }
            .order-number { 
              font-size: 10px; 
              color: #999; 
              position: absolute;
              bottom: 4mm;
              right: 4mm;
            }
            .postal-code { 
              font-size: 16px; 
              font-weight: bold; 
              margin-top: 2mm;
            }
          </style>
        </head>
        <body>
          <div class="page">
            ${Array(labelsToGenerate).fill(null).map(() => `
              <div class="label">
                <div class="label-header">
                  <img src="/logo.png" alt="Logo" className="logo" style={{ width: "auto", height: "48px" }} />
                </div>
                <div class="address">
                  <div><strong>${order.company.name}</strong></div>
                  <div>${order.company.address_line_1 || ""}</div>
                  ${order.company.address_line_2 ? `<div>${order.company.address_line_2}</div>` : ""}
                  <div>${order.company.city || ""}</div>
                  <div class="postal-code">${order.company.postal_code || ""}</div>
                  <div>${order.company.country || ""}</div>
                </div>
                <div class="order-number">${order.number}</div>
              </div>
            `).join("")}
          </div>
        </body>
        </html>
      `;

      // Open in new window for printing
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(labelHTML);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    } catch (error: any) {
      alert("Błąd generowania etykiet: " + error.message);
    }
  };

  const markOrderShipped = async (orderId: string) => {
    try {
      await supabase
        .from("orders")
        .update({ 
          status: "dispatched",
          dispatched_at: new Date().toISOString()
        })
        .eq("id", orderId);

      // Update local state
      setPackingOrders(prevOrders => 
        prevOrders.filter(order => order.id !== orderId)
      );

      // Reload data to update sent orders
      await loadData();

      alert("Zamówienie oznaczone jako wysłane!");
    } catch (error: any) {
      alert("Błąd: " + error.message);
    }
  };

  const updatePlannedDeliveryDate = async (orderId: string, date: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ planned_delivery_date: date })
        .eq("id", orderId);

      if (error) throw error;

      // Update local state
      setSentOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, planned_delivery_date: date } : order
        )
      );

      alert("Planowana data dostawy zaktualizowana!");
    } catch (error: any) {
      console.error("Error updating planned delivery date:", error);
      alert("Błąd aktualizacji daty dostawy: " + error.message);
    }
  };

  const markOrderDelivered = async (orderId: string) => {
    if (!confirm("Czy na pewno chcesz oznaczyć to zamówienie jako dostarczone?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("orders")
        .update({ 
          status: "delivered",
          delivered_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (error) throw error;

      // Remove from sent orders (it will now appear in admin orders archive)
      setSentOrders(prevOrders =>
        prevOrders.filter(order => order.id !== orderId)
      );

      alert("Zamówienie oznaczone jako dostarczone!");
    } catch (error: any) {
      console.error("Error marking order as delivered:", error);
      alert("Błąd: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Ładowanie...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="px-2 md:px-0">
        <h1 className="text-2xl md:text-3xl font-bold">Magazyn</h1>
        <p className="text-sm md:text-base text-muted-foreground">Zarządzanie dostawami i wysyłkami</p>
      </div>

      <Tabs defaultValue="deliveries" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deliveries" className="flex items-center gap-2 text-sm md:text-base">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Dostawy</span>
            <span className="sm:hidden">Dostawy</span>
          </TabsTrigger>
          <TabsTrigger value="packing" className="flex items-center gap-2 text-sm md:text-base">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Zamówienia klientów</span>
            <span className="sm:hidden">Zamówienia</span>
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2 text-sm md:text-base">
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden sm:inline">Zamówienia wysłane</span>
            <span className="sm:hidden">Wysłane</span>
          </TabsTrigger>
        </TabsList>

        {/* Deliveries Tab */}
        <TabsContent value="deliveries" className="space-y-4">
          {deliveries.length === 0 ? (
            <Card>
              <CardContent className="py-8 md:py-12 text-center text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-sm md:text-base">Brak oczekujących dostaw</p>
              </CardContent>
            </Card>
          ) : (
            deliveries.map((delivery, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg md:text-xl">Dostawca: {delivery.supplier}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {delivery.items.length} pozycji • Data zamówienia: {formatDate(delivery.order_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {delivery.items.filter((item: any) => item.quantity_received > 0).length} / {delivery.items.length} dostarczone
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateDeliveryPDF(delivery)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConfirmDelivery(delivery.supplier_order_id)}
                        disabled={delivery.items.some((item: any) => item.quantity_received === 0)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Potwierdź dostawę
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Produkt</TableHead>
                          <TableHead className="min-w-[120px]">Zamówienie</TableHead>
                          <TableHead className="min-w-[150px] hidden md:table-cell">Klient</TableHead>
                          <TableHead className="min-w-[80px]">Ilość</TableHead>
                          <TableHead className="min-w-[100px] text-center">Dostarczone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {delivery.items.map((item: any) => (
                          <TableRow key={item.supplier_order_item_id} className={item.quantity_received > 0 ? "bg-green-50" : ""}>
                            <TableCell className="font-medium">
                              <div className="max-w-[200px] truncate" title={item.polish_product_name || item.product_name}>
                                {item.polish_product_name || item.product_name}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="max-w-[120px] truncate" title={item.order_number}>
                                {item.order_number}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="max-w-[150px] truncate" title={item.customer_name}>
                                <div className="font-medium">{item.customer_name}</div>
                                {item.customer_profile?.full_name && (
                                  <div className="text-xs text-muted-foreground">
                                    {item.customer_profile.full_name}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {item.quantity_ordered} {item.unit_of_measure === "m2" ? "m²" : "szt"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={item.quantity_received > 0}
                                onCheckedChange={(checked) =>
                                  markItemReceived(item.supplier_order_item_id, checked as boolean)
                                }
                                className="h-5 w-5"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Packing/Shipping Tab */}
        <TabsContent value="packing" className="space-y-4">
          {packingOrders.length === 0 ? (
            <Card>
              <CardContent className="py-8 md:py-12 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-sm md:text-base">Brak zamówień do spakowania</p>
              </CardContent>
            </Card>
          ) : (
            packingOrders.map((order) => {
              const allReceived = order.items.every((item: any) => item.received_in_warehouse);
              const allPacked = order.items.every((item: any) => item.packed);
              const someReceived = order.items.some((item: any) => item.received_in_warehouse);
              const packedCount = order.items.filter((item: any) => item.packed).length;
              
              return (
                <Card key={order.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg md:text-xl">Zamówienie: {order.number || order.order_number || "Brak numeru"}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Klient: {order.company.name}
                          {order.created_by_profile?.full_name && ` • ${order.created_by_profile.full_name}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Data: {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Badge variant="outline" className="text-xs w-fit">
                          {packedCount} / {order.items.length} spakowane
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateOrderPDF(order)}
                        >
                          <FileText className="h-4 w-4 sm:mr-1" />
                          <span className="hidden xs:inline">PDF</span>
                        </Button>
                        {allPacked && (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Etykiety:</Label>
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                defaultValue="8"
                                id={`labels-${order.id}`}
                                className="w-16 h-8 text-xs"
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const input = document.getElementById(
                                  `labels-${order.id}`
                                ) as HTMLInputElement;
                                generateShippingLabels(order.id, parseInt(input.value) || 8);
                              }}
                            >
                              <Printer className="h-4 w-4 sm:mr-1" />
                              <span className="hidden xs:inline">Etykiety</span>
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => markOrderShipped(order.id)}
                            >
                              <CheckCircle2 className="h-4 w-4 sm:mr-1" />
                              <span className="hidden xs:inline">Wysyłka</span>
                            </Button>
                          </div>
                        )}
                        {someReceived && !allReceived && (
                          <Button variant="outline" size="sm">
                            <Clock className="h-4 w-4 mr-1" />
                            Częściowa
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 md:p-4 bg-gray-50 rounded text-sm">
                      <h3 className="font-semibold mb-2">Adres wysyłki:</h3>
                      <div className="space-y-1">
                        <p className="font-medium">{order.company.name}</p>
                        <p>{order.company.address_line1}</p>
                        {order.company.address_line2 && <p>{order.company.address_line2}</p>}
                        <p>
                          {order.company.city}, {order.company.postal_code}
                        </p>
                        <p>{order.company.country}</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto table-responsive">
                      <Table className="min-w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead className="min-w-[150px] max-w-[200px]">Produkt</TableHead>
                            <TableHead className="min-w-[100px] max-w-[120px] hidden md:table-cell">Dostawca</TableHead>
                            <TableHead className="w-20">Ilość</TableHead>
                            <TableHead className="w-24 text-center">Dostarczone</TableHead>
                            <TableHead className="w-24 text-center">Spakowane</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.items.map((item: any) => (
                            <TableRow
                              key={item.id}
                              className={`${item.received_in_warehouse ? "bg-green-50" : ""} ${item.packed ? "bg-blue-50" : ""}`}
                            >
                              <TableCell className="text-sm w-12">{item.line_number}</TableCell>
                              <TableCell className="font-medium min-w-[150px] max-w-[200px]">
                                <div className="truncate" title={item.polish_product_name || item.product_name}>
                                  {item.polish_product_name || item.product_name}
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm min-w-[100px] max-w-[120px]">
                                <div className="truncate" title={item.supplier_order_items?.[0]?.supplier_order?.supplier_name || item.actual_supplier || "-"}>
                                  {item.supplier_order_items?.[0]?.supplier_order?.supplier_name || item.actual_supplier || "-"}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.quantity} {item.unit_of_measure === "m2" ? "m²" : "szt"}
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={item.received_in_warehouse || false}
                                  disabled
                                  className="h-5 w-5"
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={item.packed || false}
                                  disabled={!item.received_in_warehouse}
                                  onCheckedChange={(checked) => {
                                    markItemPacked(item.id, checked as boolean);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-5 w-5"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Sent Orders Tab */}
        <TabsContent value="sent" className="space-y-4">
          {sentOrders.length === 0 ? (
            <Card>
              <CardContent className="py-8 md:py-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-sm md:text-base">Brak wysłanych zamówień</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sentOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">Zamówienie: {order.number}</h3>
                        <p className="text-sm text-muted-foreground">
                          Klient: {order.company.name}
                          {order.created_by_profile?.full_name && ` • ${order.created_by_profile.full_name}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Data wysyłki: {formatDate(order.dispatched_at || order.updated_at)}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Planowana data dostawy:</Label>
                          <Input
                            type="date"
                            value={order.planned_delivery_date || ""}
                            onChange={(e) => updatePlannedDeliveryDate(order.id, e.target.value)}
                            className="w-40"
                          />
                        </div>
                        <Button
                          onClick={() => markOrderDelivered(order.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Dostarczone
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
