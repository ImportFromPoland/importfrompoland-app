"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

export default function AdminOffersPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<any[]>([]);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("individual_offers")
        .select(
          "*, company:companies(name), client:profiles!client_profile_id(full_name, email, phone)"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const withVersions = await Promise.all(
        (data || []).map(async (offer) => {
          if (!offer.current_version_id) return { ...offer, version: null };
          const { data: version } = await supabase
            .from("individual_offer_versions")
            .select("id, version_number, status, valid_until, title")
            .eq("id", offer.current_version_id)
            .single();
          return { ...offer, version };
        })
      );

      setOffers(withVersions);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
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
        <CardContent className="space-y-3">
          {offers.length === 0 ? (
            <p className="text-muted-foreground">No offers yet</p>
          ) : (
            offers.map((offer) => {
              const version = offer.version;
              return (
                <Link
                  key={offer.id}
                  href={`/admin/offers/${offer.id}`}
                  className="block border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{offer.offer_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {offer.client?.full_name || offer.company?.name} ·{" "}
                        {offer.client?.email}
                      </div>
                      <div className="text-sm mt-1">
                        {version?.title || "Untitled"}
                        {version?.version_number
                          ? ` · v${version.version_number}`
                          : ""}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      {version?.status && (
                        <Badge variant="outline">{version.status}</Badge>
                      )}
                      {version?.valid_until && (
                        <div className="text-xs text-muted-foreground">
                          Valid until {formatDate(version.valid_until)}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
