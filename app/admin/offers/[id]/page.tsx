"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Copy, RefreshCw } from "lucide-react";

export default function AdminOfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<any>(null);
  const [version, setVersion] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [specLinks, setSpecLinks] = useState<any[]>([]);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    loadOffer();
  }, [params.id]);

  const loadOffer = async () => {
    setLoading(true);
    try {
      const { data: offerData, error } = await supabase
        .from("individual_offers")
        .select("*, company:companies(name), client:profiles!client_profile_id(full_name, email, phone)")
        .eq("id", params.id)
        .single();
      if (error) throw error;
      setOffer(offerData);

      if (!offerData.current_version_id) return;

      const { data: versionData } = await supabase
        .from("individual_offer_versions")
        .select("*")
        .eq("id", offerData.current_version_id)
        .single();
      setVersion(versionData);

      const { data: linesData } = await supabase
        .from("individual_offer_lines")
        .select("*")
        .eq("offer_version_id", offerData.current_version_id)
        .order("line_number");
      setLines(linesData || []);

      const { data: linksData } = await supabase
        .from("individual_offer_spec_links")
        .select("*")
        .eq("offer_version_id", offerData.current_version_id)
        .order("sort_order");
      setSpecLinks(linksData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sendToClient = async () => {
    if (!version) return;
    setWorking(true);
    try {
      const { error } = await supabase
        .from("individual_offer_versions")
        .update({ status: "sent" })
        .eq("id", version.id);
      if (error) throw error;
      await loadOffer();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setWorking(false);
    }
  };

  const createNewVersion = async () => {
    if (!offer || !version) return;
    if (
      !confirm(
        "Create new version? Current version will be archived and client will only see the new one."
      )
    ) {
      return;
    }

    setWorking(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase
        .from("individual_offer_versions")
        .update({ status: "superseded", superseded_at: new Date().toISOString() })
        .eq("id", version.id);

      const nextVersion = version.version_number + 1;
      const { data: newVersion, error: vErr } = await supabase
        .from("individual_offer_versions")
        .insert({
          offer_id: offer.id,
          version_number: nextVersion,
          status: "draft",
          valid_until: version.valid_until,
          title: version.title,
          client_notes: version.client_notes,
          admin_notes: version.admin_notes,
          payment_link_url: version.payment_link_url,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (vErr) throw vErr;

      if (lines.length > 0) {
        await supabase.from("individual_offer_lines").insert(
          lines.map((line) => ({
            offer_version_id: newVersion.id,
            line_number: line.line_number,
            label: line.label,
            amount: line.amount,
            vat_rate: line.vat_rate,
            notes: line.notes,
          }))
        );
      }

      if (specLinks.length > 0) {
        await supabase.from("individual_offer_spec_links").insert(
          specLinks.map((link) => ({
            offer_version_id: newVersion.id,
            title: link.title,
            url: link.url,
            sort_order: link.sort_order,
          }))
        );
      }

      await supabase
        .from("individual_offers")
        .update({ current_version_id: newVersion.id })
        .eq("id", offer.id);

      router.refresh();
      await loadOffer();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setWorking(false);
    }
  };

  const totalGross = lines.reduce((sum, line) => sum + Number(line.amount), 0);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!offer) return <div className="p-8">Offer not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{offer.offer_number}</h1>
          <p className="text-muted-foreground">
            {offer.client?.full_name} · {offer.client?.email}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/offers">Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {version?.title || "Offer"}{" "}
            {version?.version_number ? `(v${version.version_number})` : ""}
          </CardTitle>
          {version?.status && <Badge variant="outline">{version.status}</Badge>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Valid until:</span>{" "}
              {version?.valid_until ? formatDate(version.valid_until) : "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Total gross:</span>{" "}
              <strong>{formatCurrency(totalGross, "EUR")}</strong>
            </div>
          </div>

          {version?.client_notes && (
            <p className="text-sm border rounded p-3 bg-gray-50">{version.client_notes}</p>
          )}

          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Line</th>
                  <th className="text-right p-2">Amount (EUR gross)</th>
                  <th className="text-right p-2">VAT %</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-t">
                    <td className="p-2">{line.label}</td>
                    <td className="p-2 text-right">{formatCurrency(line.amount, "EUR")}</td>
                    <td className="p-2 text-right">{line.vat_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {specLinks.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Specification links</h3>
              <ul className="space-y-1 text-sm">
                {specLinks.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {version?.payment_link_url && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Payment link:</span>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs break-all">
                {version.payment_link_url}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigator.clipboard.writeText(version.payment_link_url)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          {version?.order_id && (
            <p className="text-sm text-green-700">
              Accepted — linked order created. Check Zamówienia / Zaopatrzenie.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {version?.status === "draft" && (
              <Button onClick={sendToClient} disabled={working}>
                Send to client
              </Button>
            )}
            {version?.status !== "accepted" && (
              <Button variant="outline" onClick={createNewVersion} disabled={working}>
                <RefreshCw className="h-4 w-4 mr-2" />
                New version
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
