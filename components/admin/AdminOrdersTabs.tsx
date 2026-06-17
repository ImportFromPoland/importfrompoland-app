"use client";

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
import { Eye, Package, Truck, CheckCircle2 } from "lucide-react";
import MarkAsPaidButton from "@/components/MarkAsPaidButton";
import MarkAsDeliveredButton from "@/components/MarkAsDeliveredButton";
import SuperadminDeleteButton from "@/components/SuperadminDeleteButton";
import DeliveredOrdersWithSearch from "@/components/DeliveredOrdersWithSearch";
import { contactNamesFromProfiles } from "@/lib/company-contacts";

type OrderRow = {
  id: string;
  number?: string | null;
  status: string;
  client_notes?: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
  delivered_at?: string | null;
  company?: {
    name?: string | null;
    vat_number?: string | null;
    profiles?: { full_name: string | null }[] | null;
  } | null;
  items?: { id: string }[] | null;
  totals?: { grand_total: number } | null;
  invoices?: { invoice_number: string; invoice_type: string }[] | null;
  shipments?: { tracking_number?: string | null; status: string }[] | null;
};

function CompanyContactSubtitle({
  profiles,
}: {
  profiles?: { full_name: string | null }[] | null;
}) {
  const contacts = contactNamesFromProfiles(profiles);
  if (!contacts) return null;
  return <div className="text-xs text-muted-foreground">{contacts}</div>;
}

interface AdminOrdersTabsProps {
  baskets: OrderRow[];
  activeOrders: OrderRow[];
  deliveredOrders: OrderRow[];
  isSuperadmin: boolean;
}

export default function AdminOrdersTabs({
  baskets,
  activeOrders,
  deliveredOrders,
  isSuperadmin,
}: AdminOrdersTabsProps) {
  return (
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
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Brak koszyków klientów
                      </TableCell>
                    </TableRow>
                  ) : (
                    baskets.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          {order.client_notes || "Bez nazwy"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{order.company?.name}</div>
                          <CompanyContactSubtitle
                            profiles={order.company?.profiles}
                          />
                        </TableCell>
                        <TableCell>{order.items?.length || 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(order.created_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(order.updated_at)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {order.totals
                            ? formatCurrency(
                                order.totals.grand_total,
                                order.currency
                              )
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
                      <TableCell
                        colSpan={10}
                        className="text-center py-8 text-muted-foreground"
                      >
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
                          <CompanyContactSubtitle
                            profiles={order.company?.profiles}
                          />
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
                            ? formatCurrency(
                                order.totals.grand_total,
                                order.currency
                              )
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
                            <span className="text-xs text-muted-foreground">
                              -
                            </span>
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
                            <span className="text-xs text-muted-foreground">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <MarkAsPaidButton
                              orderId={order.id}
                              currentStatus={order.status}
                            />
                            <MarkAsDeliveredButton
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

      <TabsContent value="delivered">
        <Card>
          <CardHeader>
            <CardTitle>Dostarczone Zamówienia</CardTitle>
            <p className="text-sm text-muted-foreground">
              Wyszukaj po numerze zamówienia lub nazwisku klienta
            </p>
          </CardHeader>
          <CardContent>
            <DeliveredOrdersWithSearch
              orders={deliveredOrders}
              isSuperadmin={isSuperadmin}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
