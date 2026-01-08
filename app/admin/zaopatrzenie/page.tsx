"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Package, Plus, ShoppingCart, Eye, ExternalLink, Archive } from "lucide-react";

interface PaidOrder {
  id: string;
  number: string;
  company: { name: string };
  created_by_profile?: { full_name: string; email: string };
  created_at: string;
  totals: {
    grand_total: number;
    subtotal_without_vat: number;
    vat_amount: number;
  };
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_of_measure: string;
    unit_price: number;
  }>;
}

interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
}

export default function ZaopatrzeniePage() {
  const [paidOrders, setPaidOrders] = useState<PaidOrder[]>([]);
  const [archivedOrders, setArchivedOrders] = useState<PaidOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PaidOrder | null>(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    notes: ""
  });
  const [orderItems, setOrderItems] = useState<Array<{
    id: string;
    product_name: string;
    polish_product_name?: string;
    website_url?: string;
    quantity: number;
    unit_of_measure: string;
    unit_price: number;
    supplier_name: string;
    original_supplier_name?: string;
    net_cost_pln: number;
    ordered_from_supplier: boolean;
  }>>([]);
  const [userRole, setUserRole] = useState<string>("");

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get current user and role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setUserRole(profile?.role || "");
      }

      // Load paid orders
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          number,
          created_at,
          status,
          company:companies(name),
          created_by_profile:profiles!created_by(full_name, email),
          items:order_items(id, product_name, quantity, unit_of_measure, unit_price)
        `)
        .eq("status", "paid")
        .order("created_at", { ascending: false });

      // Load totals for each order
      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const { data: totalsData } = await supabase
          .from("order_totals")
          .select("order_id, grand_total, subtotal_without_vat, vat_amount")
          .in("order_id", orderIds);

        // Merge totals with orders
        const ordersWithTotals = orders.map(order => ({
          ...order,
          totals: totalsData?.find(t => t.order_id === order.id) || {
            grand_total: 0,
            subtotal_without_vat: 0,
            vat_amount: 0
          }
        }));

        setPaidOrders(ordersWithTotals);
      } else {
        setPaidOrders(orders || []);
      }

      // Load archived orders (dispatched status)
      const { data: archivedOrdersData, error: archivedError } = await supabase
        .from("orders")
        .select(`
          id,
          number,
          created_at,
          status,
          company:companies(name),
          created_by_profile:profiles!created_by(full_name, email),
          items:order_items(id, product_name, quantity, unit_of_measure, unit_price)
        `)
        .eq("status", "dispatched")
        .order("created_at", { ascending: false });

      if (archivedOrdersData && archivedOrdersData.length > 0) {
        const archivedOrderIds = archivedOrdersData.map(o => o.id);
        const { data: archivedTotalsData } = await supabase
          .from("order_totals")
          .select("order_id, grand_total, subtotal_without_vat, vat_amount")
          .in("order_id", archivedOrderIds);

        const archivedOrdersWithTotals = archivedOrdersData.map(order => ({
          ...order,
          totals: archivedTotalsData?.find(t => t.order_id === order.id) || {
            grand_total: 0,
            subtotal_without_vat: 0,
            vat_amount: 0
          }
        }));
        setArchivedOrders(archivedOrdersWithTotals);
      } else {
        setArchivedOrders(archivedOrdersData || []);
      }

      // Load suppliers
      const { data: suppliersData, error: suppliersError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("is_active", true)
        .order("name");

      setSuppliers(suppliersData || []);

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from("suppliers")
        .insert([newSupplier]);

      if (error) throw error;

      setNewSupplier({
        name: "",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        notes: ""
      });
      setShowSupplierForm(false);
      loadData(); // Reload suppliers
    } catch (error) {
      console.error("Error adding supplier:", error);
    }
  };

  const handleViewOrderDetails = async (order: PaidOrder) => {
    setSelectedOrder(order);
    
    try {
      // Load order items with supplier info
      const { data: items, error } = await supabase
        .from("order_items")
        .select(`
          id,
          product_name,
          polish_product_name,
          website_url,
          quantity,
          unit_of_measure,
          unit_price,
          supplier_name,
          original_supplier_name,
          net_cost_pln,
          ordered_from_supplier
        `)
        .eq("order_id", order.id)
        .order("line_number");

      if (error) {
        console.error("Error loading order items:", error);
        alert("Error loading order items: " + error.message);
        return;
      }

      console.log("Loaded order items:", items);
      setOrderItems(items || []);
    } catch (error) {
      console.error("Error in handleViewOrderDetails:", error);
      alert("Error loading order details: " + error);
    }
  };

  const handleUpdateItem = async (itemId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("order_items")
        .update({ [field]: value })
        .eq("id", itemId);

      if (error) throw error;

      // Update local state
      setOrderItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, [field]: value } : item
      ));
    } catch (error) {
      console.error("Error updating item:", error);
    }
  };

  const handleSavePartial = async () => {
    try {
      if (!selectedOrder) {
        alert("Brak wybranego zamówienia");
        return;
      }

      // Check if there are any items to order
      const itemsToOrder = orderItems.filter(item => item.ordered_from_supplier && item.supplier_name);
      
      if (itemsToOrder.length === 0) {
        alert("Brak produktów do zamówienia. Zaznacz produkty i wpisz dostawców.");
        return;
      }

      // Save partial order without changing status
      await saveOrderItems(itemsToOrder);
      alert("Częściowe zamówienie zapisane!");
      loadData();
    } catch (error) {
      console.error("Error saving partial order:", error);
      alert("Błąd podczas zapisywania: " + (error as Error).message);
    }
  };

  const saveOrderItems = async (itemsToOrder: any[]) => {
    // Group items by supplier and date
    const today = new Date().toISOString().split('T')[0];
    const supplierGroups: { [key: string]: any[] } = {};

    itemsToOrder.forEach(item => {
      const key = `${item.supplier_name}_${today}`;
      if (!supplierGroups[key]) {
        supplierGroups[key] = [];
      }
      supplierGroups[key].push(item);
    });

    // Create supplier orders for each group
    for (const [key, items] of Object.entries(supplierGroups)) {
      const [supplierName] = key.split('_');
      const totalCostPLN = items.reduce((sum, item) => sum + (item.net_cost_pln * item.quantity), 0);

      const { data: supplierOrder, error } = await supabase
        .from("supplier_orders")
        .insert([{
          order_id: selectedOrder!.id,
          supplier_name: supplierName,
          order_date: today,
          total_cost_pln: totalCostPLN,
          status: "ordered"
        }])
        .select()
        .single();

      if (error) throw error;

      // Create supplier order items
      const supplierOrderItems = items.map(item => ({
        supplier_order_id: supplierOrder.id,
        order_item_id: item.id,
        quantity_ordered: item.quantity,
        unit_cost_pln: item.net_cost_pln
      }));

      const { error: itemsError } = await supabase
        .from("supplier_order_items")
        .insert(supplierOrderItems);

      if (itemsError) throw itemsError;
    }
  };

  const handleConfirmOrder = async () => {
    try {
      if (!selectedOrder) {
        alert("Brak wybranego zamówienia");
        return;
      }

      // Check if there are any items to order
      const itemsToOrder = orderItems.filter(item => item.ordered_from_supplier && item.supplier_name);
      
      if (itemsToOrder.length === 0) {
        alert("Brak produktów do zamówienia. Zaznacz produkty i wpisz dostawców.");
        return;
      }

      // Save the order items first
      await saveOrderItems(itemsToOrder);

      // Check if all items are ordered
      const allItemsOrdered = orderItems.every(item => item.ordered_from_supplier && item.supplier_name);
      const someItemsOrdered = orderItems.some(item => item.ordered_from_supplier && item.supplier_name);


      if (allItemsOrdered) {
        // All items ordered - move to archive (dispatched status)
        const { error: updateError } = await supabase
          .from("orders")
          .update({ status: "dispatched" })
          .eq("id", selectedOrder.id);

        if (updateError) throw updateError;
        alert("Zamówienie potwierdzone i przeniesione do archiwum!");
      } else if (someItemsOrdered) {
        // Some items ordered - partially packed
        const { error: updateError } = await supabase
          .from("orders")
          .update({ status: "partially_packed" })
          .eq("id", selectedOrder.id);

        if (updateError) throw updateError;
        alert("Zamówienie częściowo potwierdzone!");
      }

      // Close details and reload data
      setSelectedOrder(null);
      loadData();
    } catch (error) {
      console.error("Error confirming order:", error);
      alert("Błąd podczas potwierdzania zamówienia: " + (error as Error).message);
    }
  };

  const handleRestoreOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "paid" })
        .eq("id", orderId);

      if (error) throw error;

      alert("Zamówienie przywrócone do aktywnej listy!");
      loadData();
    } catch (error) {
      console.error("Error restoring order:", error);
      alert("Błąd podczas przywracania zamówienia: " + (error as Error).message);
    }
  };

  if (loading) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Zaopatrzenie</h1>
        <p className="text-muted-foreground">Zarządzanie zaopatrzeniem</p>
      </div>
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Zaopatrzenie</h1>
          <p className="text-muted-foreground">Zamówienia gotowe do realizacji u dostawców</p>
        </div>
        <Button onClick={() => setShowSupplierForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj Dostawcę
        </Button>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Aktywne Zamówienia
          </TabsTrigger>
          <TabsTrigger value="archive" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archiwum
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">

      {/* Add Supplier Form */}
      {showSupplierForm && (
      <Card>
        <CardHeader>
            <CardTitle>Dodaj Nowego Dostawcę</CardTitle>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nazwa Dostawcy *</Label>
                  <Input
                    id="name"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person">Osoba Kontaktowa</Label>
                  <Input
                    id="contact_person"
                    value={newSupplier.contact_person}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="address">Adres</Label>
                  <Textarea
                    id="address"
                    value={newSupplier.address}
                    onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="notes">Notatki</Label>
                  <Textarea
                    id="notes"
                    value={newSupplier.notes}
                    onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Dodaj Dostawcę</Button>
                <Button type="button" variant="outline" onClick={() => setShowSupplierForm(false)}>
                  Anuluj
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}


      {/* Paid Orders Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Zamówienia Opłacone ({paidOrders.length})</h2>
        
        {paidOrders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Brak zamówień gotowych do realizacji</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Numer</TableHead>
                    <TableHead>Klient</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Wartość</TableHead>
                    <TableHead className="text-center">Pozycje</TableHead>
                    <TableHead className="text-center">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{order.company.name}</div>
                        {order.created_by_profile?.full_name && (
                          <div className="text-xs text-muted-foreground">
                            {order.created_by_profile.full_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(order.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.totals.grand_total, "EUR")}
                      </TableCell>
                      <TableCell className="text-center">
                        {order.items.length}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewOrderDetails(order)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Szczegóły
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
        </TabsContent>

        <TabsContent value="archive" className="space-y-4">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Archiwalne Zamówienia ({archivedOrders.length})</h2>
            
            {archivedOrders.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Brak archiwalnych zamówień</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Numer</TableHead>
                        <TableHead>Klient</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Wartość</TableHead>
                        <TableHead className="text-center">Pozycje</TableHead>
                        <TableHead className="text-center">Akcje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.number}</TableCell>
                          <TableCell>
                        <div className="font-medium">{order.company.name}</div>
                        {order.created_by_profile?.full_name && (
                          <div className="text-xs text-muted-foreground">
                            {order.created_by_profile.full_name}
                          </div>
                        )}
                      </TableCell>
                          <TableCell>{formatDate(order.created_at)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(order.totals.grand_total, "EUR")}
                          </TableCell>
                          <TableCell className="text-center">
                            {order.items.length}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewOrderDetails(order)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Szczegóły
                            </Button>
                            {(userRole === "admin" || userRole === "staff_admin") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-2"
                                onClick={() => handleRestoreOrder(order.id)}
                              >
                                Przywróć
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Order Details Modal */}
      {selectedOrder && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Szczegóły zamówienia {selectedOrder.number}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedOrder.company.name}
                  {selectedOrder.created_by_profile?.full_name && ` • ${selectedOrder.created_by_profile.full_name}`}
                  {` • ${formatDate(selectedOrder.created_at)}`}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {selectedOrder.status === "paid" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleSavePartial}
                        disabled={!orderItems.some(item => item.ordered_from_supplier && item.supplier_name)}
                      >
                        <Package className="h-4 w-4 mr-1" />
                        Zapisz częściowo
                      </Button>
                      <Button
                        onClick={handleConfirmOrder}
                        disabled={!orderItems.some(item => item.ordered_from_supplier && item.supplier_name)}
                      >
                        <Package className="h-4 w-4 mr-1" />
                        Potwierdź zamówienie
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setSelectedOrder(null)}
                  >
                    Zamknij
                  </Button>
                </div>
                {orderItems.length > 0 && selectedOrder.status === "paid" && (
                  <div className="text-xs text-muted-foreground">
                    Zaznacz produkty jako &quot;Zamówione&quot; i wpisz dostawców, aby móc potwierdzić zamówienie
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Cena PLN (za szt.)</TableHead>
                  <TableHead className="text-center">Ilość</TableHead>
                  <TableHead>Dostawca</TableHead>
                  <TableHead className="text-right">Koszt netto PLN (za szt.)</TableHead>
                  <TableHead className="text-center">Zamówione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {(userRole === "admin" || userRole === "staff_admin") ? (
                        <div className="space-y-1">
                          <Input
                            value={item.polish_product_name || ''}
                            onChange={(e) => handleUpdateItem(item.id, 'polish_product_name', e.target.value)}
                            placeholder="Polska nazwa produktu"
                            className="w-48"
                          />
                          {item.product_name && (!item.polish_product_name || item.polish_product_name !== item.product_name) && (
                            <div className="text-xs text-muted-foreground">
                              Klient: {item.product_name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-sm font-medium">
                            {item.polish_product_name || item.product_name}
                          </span>
                          {item.polish_product_name && item.polish_product_name !== item.product_name && (
                            <div className="text-xs text-muted-foreground">
                              (Klient: {item.product_name})
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.website_url && (
                        <a
                          href={item.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unit_price, "PLN")}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.quantity} {item.unit_of_measure === 'm2' ? 'm²' : 'szt'}
                    </TableCell>
                    <TableCell>
                      {(userRole === "admin" || userRole === "staff_admin") ? (
                        <div className="space-y-1">
                          <Input
                            value={item.supplier_name || ''}
                            onChange={(e) => handleUpdateItem(item.id, 'supplier_name', e.target.value)}
                            placeholder="Nazwa dostawcy"
                            className="w-32"
                          />
                          {item.original_supplier_name && item.original_supplier_name !== item.supplier_name && (
                            <div className="text-xs text-muted-foreground">
                              Klient: {item.original_supplier_name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-sm">{item.supplier_name || '-'}</span>
                          {item.original_supplier_name && item.original_supplier_name !== item.supplier_name && (
                            <div className="text-xs text-muted-foreground">
                              (Klient: {item.original_supplier_name})
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        {(userRole === "admin" || userRole === "staff_admin") ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={item.net_cost_pln || ''}
                            onChange={(e) => handleUpdateItem(item.id, 'net_cost_pln', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ) : (
                          <span className="text-sm">{item.net_cost_pln ? formatCurrency(item.net_cost_pln, "PLN") : '-'}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={item.ordered_from_supplier || false}
                        onCheckedChange={(checked) => handleUpdateItem(item.id, 'ordered_from_supplier', checked)}
                        disabled={userRole !== "admin" && userRole !== "staff_admin"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
