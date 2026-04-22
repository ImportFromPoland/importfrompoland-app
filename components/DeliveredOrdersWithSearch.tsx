"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Search } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { contactNamesFromProfiles } from "@/lib/company-contacts";
import SuperadminDeleteButton from "@/components/SuperadminDeleteButton";

interface DeliveredOrdersWithSearchProps {
  orders: any[];
  isSuperadmin: boolean;
}

export default function DeliveredOrdersWithSearch({
  orders,
  isSuperadmin,
}: DeliveredOrdersWithSearchProps) {
  const [search, setSearch] = useState("");

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      const number = (order.number || "").toLowerCase();
      const companyName = (order.company?.name || "").toLowerCase();
      const contactLine = contactNamesFromProfiles(
        order.company?.profiles
      ).toLowerCase();
      const clientNotes = (order.client_notes || "").toLowerCase();
      return (
        number.includes(q) ||
        companyName.includes(q) ||
        contactLine.includes(q) ||
        clientNotes.includes(q)
      );
    });
  }, [orders, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Szukaj po numerze zamówienia lub nazwisku klienta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

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
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {search.trim()
                    ? "Brak zamówień pasujących do wyszukiwania"
                    : "Brak dostarczonych zamówień"}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const contactSubtitle = contactNamesFromProfiles(
                  order.company?.profiles
                );
                return (
                <TableRow key={order.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{order.number || "-"}</TableCell>
                  <TableCell>
                    <div className="font-medium">{order.company?.name}</div>
                    {contactSubtitle ? (
                      <div className="text-xs text-muted-foreground">
                        {contactSubtitle}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {order.client_notes || "-"}
                  </TableCell>
                  <TableCell>{order.items?.length || 0}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(order.submitted_at || order.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(order.delivered_at || order.updated_at)}
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
