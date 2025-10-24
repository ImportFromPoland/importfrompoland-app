import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Package, Truck, CheckCircle2, CreditCard, Plus } from "lucide-react";
import MarkAsPaidButton from "@/components/MarkAsPaidButton";
import SuperadminDeleteButton from "@/components/SuperadminDeleteButton";

export default async function AdminOrdersPage() {
  const supabase = await createClient();

  // Get current user role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id)
    .single();

  const isSuperadmin = profile?.role === "staff_admin";

  // Get all orders with related data
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      *,
      company:companies(name, vat_number),
      items:order_items(id)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  // Get totals for all orders
  const ordersWithTotals = await Promise.all(
    (orders || []).map(async (order) => {
      const { data: totals } = await supabase
        .from("order_totals")
        .select("*")
        .eq("order_id", order.id)
        .single();

      return { ...order, totals };
    })
  );

  // Categorize orders
  const baskets = ordersWithTotals.filter((o) => o.status === "draft");
  const activeOrders = ordersWithTotals.filter(
    (o) => o.status !== "draft" && o.status !== "delivered" && o.status !== "cancelled"
  );
  const deliveredOrders = ordersWithTotals.filter((o) => o.status === "delivered");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Management</h1>
          <p className="text-muted-foreground">
            View and manage all customer orders
          </p>
        </div>
        <Link href="/admin/orders/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create New Basket
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="baskets" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Koszyki ({baskets.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Aktywne ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="delivered" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Dostarczone ({deliveredOrders.length})
          </TabsTrigger>
        </TabsList>

        {/* Baskets Tab */}
        <TabsContent value="baskets">
          <Card>
            <CardHeader>
              <CardTitle>Koszyki Klientów</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[25%]">Nazwa Koszyka</TableHead>
                      <TableHead className="w-[20%]">Klient</TableHead>
                      <TableHead className="w-[10%]">Pozycje</TableHead>
                      <TableHead className="w-[15%]">Utworzono</TableHead>
                      <TableHead className="w-[15%]">Ostatnia Aktualizacja</TableHead>
                      <TableHead className="w-[10%] text-right">Suma</TableHead>
                      <TableHead className="w-[5%] text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baskets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Brak koszyków klientów
                        </TableCell>
                      </TableRow>
                    ) : (
                      baskets.map((order) => (
                        <TableRow key={order.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            {order.client_notes || "Bez nazwy"}
                          </TableCell>
                          <TableCell>{order.company?.name}</TableCell>
                          <TableCell>{order.items?.length || 0}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(order.created_at)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(order.updated_at)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {order.totals
                              ? formatCurrency(order.totals.grand_total, order.currency)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/admin/orders/${order.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4 mr-1" />
                                  Zobacz
                                </Button>
                              </Link>
                              {isSuperadmin && (
                                <SuperadminDeleteButton
                                  itemId={order.id}
                                  itemType="basket"
                                />
                              )}
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
        </TabsContent>

        {/* Active Orders Tab */}
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Aktywne Zamówienia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[12%]">Nr Zamówienia</TableHead>
                      <TableHead className="w-[18%]">Klient</TableHead>
                      <TableHead className="w-[15%]">Nazwa Koszyka</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className="w-[8%]">Pozycje</TableHead>
                      <TableHead className="w-[12%]">Złożono</TableHead>
                      <TableHead className="w-[10%] text-right">Suma</TableHead>
                      <TableHead className="w-[8%]">Faktura</TableHead>
                      <TableHead className="w-[7%]">Wysyłka</TableHead>
                      <TableHead className="w-[10%] text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          Brak aktywnych zamówień
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            {order.number || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{order.company?.name}</div>
                            {order.company?.vat_number && (
                              <div className="text-xs text-muted-foreground">
                                VAT: {order.company.vat_number}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {order.client_notes || "-"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={order.status} />
                          </TableCell>
                          <TableCell>{order.items?.length || 0}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(order.submitted_at || order.created_at)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {order.totals
                              ? formatCurrency(order.totals.grand_total, order.currency)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {order.invoices && order.invoices.length > 0 ? (
                              <div className="text-sm">
                                {order.invoices[0].invoice_number}
                                <div className="text-xs text-muted-foreground">
                                  {order.invoices[0].invoice_type}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {order.shipments && order.shipments.length > 0 ? (
                              <div className="text-sm">
                                {order.shipments[0].tracking_number || "Created"}
                                <div className="text-xs text-muted-foreground">
                                  {order.shipments[0].status}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <MarkAsPaidButton 
                                orderId={order.id}
                                currentStatus={order.status}
                              />
                              <Link href={`/admin/orders/${order.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4 mr-1" />
                                  Zobacz
                                </Button>
                              </Link>
                              {isSuperadmin && (
                                <SuperadminDeleteButton
                                  itemId={order.id}
                                  itemType="order"
                                />
                              )}
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
        </TabsContent>

        {/* Delivered Orders Tab */}
        <TabsContent value="delivered">
          <Card>
            <CardHeader>
              <CardTitle>Dostarczone Zamówienia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[15%]">Nr Zamówienia</TableHead>
                      <TableHead className="w-[25%]">Klient</TableHead>
                      <TableHead className="w-[20%]">Nazwa Koszyka</TableHead>
                      <TableHead className="w-[10%]">Pozycje</TableHead>
                      <TableHead className="w-[15%]">Złożono</TableHead>
                      <TableHead className="w-[15%]">Dostarczono</TableHead>
                      <TableHead className="w-[10%] text-right">Suma</TableHead>
                      <TableHead className="w-[10%] text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Brak dostarczonych zamówień
                        </TableCell>
                      </TableRow>
                    ) : (
                      deliveredOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            {order.number || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{order.company?.name}</div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {order.client_notes || "-"}
                          </TableCell>
                          <TableCell>{order.items?.length || 0}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(order.submitted_at || order.created_at)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(order.updated_at)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {order.totals
                              ? formatCurrency(order.totals.grand_total, order.currency)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/admin/orders/${order.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4 mr-1" />
                                  Zobacz
                                </Button>
                              </Link>
                              {isSuperadmin && (
                                <SuperadminDeleteButton
                                  itemId={order.id}
                                  itemType="order"
                                />
                              )}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
