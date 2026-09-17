"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Truck } from "lucide-react";

type LogisticsRow = {
  id: string;
  number: string | null;
  status: string;
  created_at: string;
  dispatched_at: string | null;
  delivered_at: string | null;
  ie_delivery_cost_eur: number | null;
  company?: { name: string } | null;
};

const RELEVANT_STATUSES = new Set([
  "paid",
  "confirmed",
  "partially_packed",
  "packed",
  "partially_dispatched",
  "dispatched",
  "partially_delivered",
  "delivered",
  "partially_received",
  "ready_to_ship",
  "shipped",
]);

export default function LogistykaPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<LogisticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"missing" | "all">("missing");

  const load = async () => {
    setLoading(true);
    try {
      // Avoid .in(enum values) — production may lack newer enum labels (e.g. partially_packed)
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          number,
          status,
          created_at,
          dispatched_at,
          delivered_at,
          ie_delivery_cost_eur,
          company:companies(name)
        `
        )
        .not("status", "in", "(draft,cancelled,submitted,in_review)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const list = ((data || []) as LogisticsRow[]).filter((r) =>
        RELEVANT_STATUSES.has(r.status)
      );
      setRows(list);
      const next: Record<string, string> = {};
      list.forEach((r) => {
        next[r.id] = String(r.ie_delivery_cost_eur ?? 0);
      });
      setDrafts(next);
    } catch (e: any) {
      console.error(e);
      alert("Błąd ładowania: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveCost = async (orderId: string) => {
    const value = parseFloat(drafts[orderId] || "0") || 0;
    setSavingId(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ ie_delivery_cost_eur: value })
        .eq("id", orderId);
      if (error) throw error;
      setRows((prev) =>
        prev.map((r) =>
          r.id === orderId ? { ...r, ie_delivery_cost_eur: value } : r
        )
      );
    } catch (e: any) {
      alert("Nie zapisano: " + (e.message || e));
    } finally {
      setSavingId(null);
    }
  };

  const visible = rows.filter((r) => {
    if (filter === "all") return true;
    return !(Number(r.ie_delivery_cost_eur) > 0);
  });

  const missingCount = rows.filter(
    (r) => !(Number(r.ie_delivery_cost_eur) > 0)
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="h-6 w-6" />
          Logistyka
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Koszt dostawy do Irlandii (EUR) — zwykle znany 1–2 tygodnie po wysyłce.
          Jedna kwota na zamówienie klienta.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">
            Zamówienia · brak kosztu IE: {missingCount} / {rows.length}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={filter === "missing" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("missing")}
            >
              Bez kosztu
            </Button>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Wszystkie
            </Button>
            <Button variant="outline" size="sm" onClick={load}>
              Odśwież
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Ładowanie…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numer</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Wysłano</TableHead>
                  <TableHead className="text-right">Koszt IE (EUR)</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.number || row.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{row.company?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.dispatched_at
                        ? formatDate(row.dispatched_at)
                        : row.delivered_at
                          ? formatDate(row.delivered_at)
                          : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        className="w-28 ml-auto text-right"
                        value={drafts[row.id] ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [row.id]: e.target.value,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingId === row.id}
                        onClick={() => saveCost(row.id)}
                      >
                        {savingId === row.id ? "…" : "Zapisz"}
                      </Button>
                      {Number(row.ie_delivery_cost_eur) > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatCurrency(row.ie_delivery_cost_eur || 0, "EUR")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      Brak zamówień do pokazania.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
