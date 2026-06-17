"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatCurrency } from "@/lib/utils";
import { offerLinesNetTotal } from "@/lib/individual-offer-totals";
import { ArrowUpDown, Plus, Trash2 } from "lucide-react";

type OfferRow = {
  id: string;
  offer_number: string;
  created_at: string;
  company?: { name: string | null } | null;
  client?: { full_name: string | null; email: string | null } | null;
  version: {
    id: string;
    version_number: number;
    status: string;
    valid_until: string;
    title: string;
    order_id?: string | null;
  } | null;
  netTotal: number;
};

type SortKey =
  | "offer_number"
  | "created_at"
  | "client_name"
  | "net_value"
  | "valid_until"
  | "status";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Shared",
  viewed: "Viewed",
  accepted: "Accepted",
  expired: "Expired",
  superseded: "Superseded",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-indigo-100 text-indigo-800",
  accepted: "bg-green-100 text-green-800",
  expired: "bg-amber-100 text-amber-800",
  superseded: "bg-slate-100 text-slate-700",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-red-50 text-red-700",
};

function clientDisplayName(offer: OfferRow): string {
  return (
    offer.client?.full_name?.trim() ||
    offer.company?.name?.trim() ||
    offer.client?.email?.trim() ||
    "—"
  );
}

function SortableHead({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: "asc" | "desc";
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 font-medium hover:text-foreground text-muted-foreground ${
          className?.includes("text-right") ? "ml-auto" : ""
        }`}
      >
        {label}
        <ArrowUpDown
          className={`h-3.5 w-3.5 ${active ? "text-foreground" : "opacity-50"}`}
          aria-hidden
        />
        {active ? (
          <span className="sr-only">
            sorted {direction === "asc" ? "ascending" : "descending"}
          </span>
        ) : null}
      </button>
    </TableHead>
  );
}

export default function AdminOffersPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("individual_offers")
        .select(
          "*, company:companies(name), client:profiles!client_profile_id(full_name, email)"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched: OfferRow[] = await Promise.all(
        (data || []).map(async (offer) => {
          if (!offer.current_version_id) {
            return { ...offer, version: null, netTotal: 0 };
          }

          const { data: version } = await supabase
            .from("individual_offer_versions")
            .select(
              "id, version_number, status, valid_until, title, order_id"
            )
            .eq("id", offer.current_version_id)
            .single();

          const { data: lines } = await supabase
            .from("individual_offer_lines")
            .select("amount, vat_rate")
            .eq("offer_version_id", offer.current_version_id);

          return {
            ...offer,
            version: version || null,
            netTotal: offerLinesNetTotal(lines || []),
          };
        })
      );

      setOffers(enriched);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "offer_number" || key === "client_name" ? "asc" : "desc");
    }
  };

  const sortedOffers = useMemo(() => {
    const list = [...offers];
    const dir = sortDir === "asc" ? 1 : -1;

    list.sort((a, b) => {
      switch (sortKey) {
        case "offer_number":
          return a.offer_number.localeCompare(b.offer_number) * dir;
        case "created_at":
          return (
            (new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()) *
            dir
          );
        case "client_name":
          return clientDisplayName(a).localeCompare(clientDisplayName(b)) * dir;
        case "net_value":
          return (a.netTotal - b.netTotal) * dir;
        case "valid_until": {
          const aDate = a.version?.valid_until
            ? new Date(a.version.valid_until).getTime()
            : 0;
          const bDate = b.version?.valid_until
            ? new Date(b.version.valid_until).getTime()
            : 0;
          return (aDate - bDate) * dir;
        }
        case "status": {
          const aStatus = a.version?.status || "";
          const bStatus = b.version?.status || "";
          return aStatus.localeCompare(bStatus) * dir;
        }
        default:
          return 0;
      }
    });

    return list;
  }, [offers, sortKey, sortDir]);

  const deleteOffer = async (offer: OfferRow) => {
    const status = offer.version?.status;
    let message =
      "Delete this offer permanently? All versions and lines will be removed.";

    if (status === "accepted" || offer.version?.order_id) {
      message =
        "This offer was accepted and may be linked to an order. Delete anyway? The order will remain but lose the offer link.";
    }

    if (!confirm(message)) return;

    setDeletingId(offer.id);
    try {
      const { error } = await supabase
        .from("individual_offers")
        .delete()
        .eq("id", offer.id);
      if (error) throw error;
      setOffers((prev) => prev.filter((o) => o.id !== offer.id));
    } catch (e: any) {
      alert(e.message || "Could not delete offer");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Individual Offers</h1>
          <p className="text-muted-foreground">
            Windows, roofs, balustrades and custom projects
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/offers/new">
            <Plus className="h-4 w-4 mr-2" />
            New offer
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Offers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Offer no."
                    sortKey="offer_number"
                    currentKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Created"
                    sortKey="created_at"
                    currentKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Client"
                    sortKey="client_name"
                    currentKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Net value"
                    sortKey="net_value"
                    currentKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortableHead
                    label="Valid until"
                    sortKey="valid_until"
                    currentKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Status"
                    sortKey="status"
                    currentKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <TableHead className="text-right w-[80px]">Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOffers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No offers yet
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedOffers.map((offer) => {
                    const status = offer.version?.status;
                    return (
                      <TableRow key={offer.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          <Link
                            href={`/admin/offers/${offer.id}`}
                            className="text-primary hover:underline"
                          >
                            {offer.offer_number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(offer.created_at)}
                        </TableCell>
                        <TableCell>{clientDisplayName(offer)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {offer.netTotal > 0
                            ? formatCurrency(offer.netTotal, "EUR")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {offer.version?.valid_until
                            ? formatDate(offer.version.valid_until)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {status ? (
                            <Badge
                              variant="outline"
                              className={STATUS_COLORS[status] || ""}
                            >
                              {STATUS_LABELS[status] || status}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={deletingId === offer.id}
                            onClick={() => deleteOffer(offer)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete offer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
