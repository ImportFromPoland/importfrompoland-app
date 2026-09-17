"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  offerLinesGrossTotal,
  offerLinesNetTotal,
  offerLinesVatTotal,
} from "@/lib/individual-offer-totals";
import {
  createOfferVersion,
  formatOfferTitleWithVersion,
  versionToEditableLines,
  type OfferVersionFields,
} from "@/lib/individual-offer-versions";
import {
  OfferLinesEditor,
  emptyOfferLine,
  type EditableOfferLine,
} from "@/components/admin/OfferLinesEditor";
import { Copy, Download, Pencil, Share2, X, CheckCircle, Archive } from "lucide-react";
import { downloadIndividualOfferPdf } from "@/lib/individual-offer-pdf";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Shared",
  viewed: "Viewed",
  accepted: "Accepted / Converted",
  expired: "Expired",
  superseded: "Superseded",
  rejected: "Rejected",
  cancelled: "Cancelled",
  archived: "Archived",
};

type SpecLink = { id?: string; title: string; url: string; sort_order?: number };

type VersionSummary = {
  id: string;
  version_number: number;
  status: string;
  created_at: string;
  valid_until: string;
  title: string;
};

function emptyDraftFromVersion(
  version: any,
  lines: any[],
  specLinks: SpecLink[]
): {
  fields: OfferVersionFields;
  lines: EditableOfferLine[];
  specLinks: SpecLink[];
} {
  return {
    fields: {
      valid_until: version?.valid_until || "",
      title: version?.title || "",
      client_notes: version?.client_notes || null,
      admin_notes: version?.admin_notes || null,
      payment_link_url: version?.payment_link_url || null,
    },
    lines:
      lines.length > 0
        ? versionToEditableLines(lines)
        : [emptyOfferLine(1)],
    specLinks:
      specLinks.length > 0
        ? specLinks.map((l) => ({
            title: l.title,
            url: l.url,
            sort_order: l.sort_order,
          }))
        : [{ title: "", url: "" }],
  };
}

export default function AdminOfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<any>(null);
  const [version, setVersion] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [specLinks, setSpecLinks] = useState<SpecLink[]>([]);
  const [allVersions, setAllVersions] = useState<VersionSummary[]>([]);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const [viewingVersion, setViewingVersion] = useState<any>(null);
  const [viewingLines, setViewingLines] = useState<any[]>([]);
  const [viewingLinks, setViewingLinks] = useState<SpecLink[]>([]);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<OfferVersionFields | null>(null);
  const [editLines, setEditLines] = useState<EditableOfferLine[]>([]);
  const [editSpecLinks, setEditSpecLinks] = useState<SpecLink[]>([]);
  const [working, setWorking] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const isViewingCurrent =
    !viewingVersionId || viewingVersionId === offer?.current_version_id;
  const displayVersion = isViewingCurrent ? version : viewingVersion;
  const displayLines = isViewingCurrent ? lines : viewingLines;
  const displayLinks = isViewingCurrent ? specLinks : viewingLinks;
  const canEditCurrent =
    isViewingCurrent && version && version.status !== "accepted";

  useEffect(() => {
    loadOffer();
  }, [params.id]);

  const loadVersionDetails = async (versionId: string) => {
    const { data: versionData } = await supabase
      .from("individual_offer_versions")
      .select("*")
      .eq("id", versionId)
      .single();

    const { data: linesData } = await supabase
      .from("individual_offer_lines")
      .select("*")
      .eq("offer_version_id", versionId)
      .order("line_number");

    const { data: linksData } = await supabase
      .from("individual_offer_spec_links")
      .select("*")
      .eq("offer_version_id", versionId)
      .order("sort_order");

    return {
      version: versionData,
      lines: linesData || [],
      links: linksData || [],
    };
  };

  const loadOffer = async () => {
    setLoading(true);
    try {
      const { data: offerData, error } = await supabase
        .from("individual_offers")
        .select(
          "*, company:companies(*), client:profiles!client_profile_id(full_name, email, phone, email_is_placeholder, role)"
        )
        .eq("id", params.id)
        .single();
      if (error) throw error;
      setOffer(offerData);

      const { data: versionsList } = await supabase
        .from("individual_offer_versions")
        .select("id, version_number, status, created_at, valid_until, title")
        .eq("offer_id", params.id)
        .order("version_number", { ascending: false });
      setAllVersions(versionsList || []);

      if (!offerData.current_version_id) return;

      const current = await loadVersionDetails(offerData.current_version_id);
      setVersion(current.version);
      setLines(current.lines);
      setSpecLinks(current.links);
      setViewingVersionId(null);
      setViewingVersion(null);
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadHistoricalVersion = async (versionId: string) => {
    setWorking(true);
    try {
      const data = await loadVersionDetails(versionId);
      setViewingVersionId(versionId);
      setViewingVersion(data.version);
      setViewingLines(data.lines);
      setViewingLinks(data.links);
      setEditing(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setWorking(false);
    }
  };

  const startEditing = () => {
    if (!version) return;
    const draft = emptyDraftFromVersion(version, lines, specLinks);
    setEditFields(draft.fields);
    setEditLines(draft.lines);
    setEditSpecLinks(draft.specLinks);
    setEditing(true);
  };

  const discardEditing = () => {
    setEditing(false);
    setEditFields(null);
  };

  const shareWithClient = async () => {
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

  const saveAsNewVersion = async (
    sourceFields: OfferVersionFields,
    sourceLines: EditableOfferLine[],
    sourceLinks: SpecLink[]
  ) => {
    if (!offer) return;
    const validLines = sourceLines.filter((l) => l.label.trim() && l.amount > 0);
    if (validLines.length === 0) {
      alert("Add at least one line with label and net amount");
      return;
    }
    if (!sourceFields.title.trim() || !sourceFields.valid_until) {
      alert("Title and valid until are required");
      return;
    }

    setWorking(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await createOfferVersion(supabase, {
        offerId: offer.id,
        currentVersionId: offer.current_version_id,
        fields: {
          ...sourceFields,
          title: sourceFields.title.trim(),
          client_notes: sourceFields.client_notes?.trim() || sourceFields.title.trim(),
        },
        lines: validLines,
        specLinks: sourceLinks,
        createdBy: user.id,
        status: "draft",
      });

      setEditing(false);
      router.refresh();
      await loadOffer();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setWorking(false);
    }
  };

  const copyVersionAsNew = async (
    sourceVersion: any,
    sourceLines: any[],
    sourceLinks: SpecLink[]
  ) => {
    if (
      !confirm(
        `Create new version from v${sourceVersion.version_number}? Current version will be superseded.`
      )
    ) {
      return;
    }

    const draft = emptyDraftFromVersion(sourceVersion, sourceLines, sourceLinks);
    await saveAsNewVersion(draft.fields, draft.lines, draft.specLinks);
  };

  const downloadPdf = async () => {
    if (!offer || !displayVersion) return;
    setDownloadingPdf(true);
    try {
      if (offer.offer_kind === "basket") {
        const { pdf } = await import("@react-pdf/renderer");
        const { OrderPDF } = await import("@/components/OrderPDF");
        const React = await import("react");

        let customerProfile =
          offer.client?.role === "client"
            ? {
                full_name: offer.client.full_name || offer.guest_name,
                email: offer.guest_email || offer.client.email,
                phone: offer.client.phone || offer.guest_phone,
                email_is_placeholder: offer.client.email_is_placeholder,
                role: "client" as const,
              }
            : null;

        if (!customerProfile && offer.company_id) {
          const { data: companyClient } = await supabase
            .from("profiles")
            .select("full_name, email, phone, email_is_placeholder, role")
            .eq("company_id", offer.company_id)
            .eq("role", "client")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (companyClient) {
            customerProfile = {
              full_name: companyClient.full_name || offer.guest_name,
              email: offer.guest_email || companyClient.email,
              phone: companyClient.phone || offer.guest_phone,
              email_is_placeholder: companyClient.email_is_placeholder,
              role: "client",
            };
          }
        }

        if (!customerProfile) {
          customerProfile = {
            full_name: offer.guest_name,
            email: offer.guest_email,
            phone: offer.guest_phone,
            role: "client",
          };
        }

        const vatRate = 23;
        let discountPercent = Number(
          (displayVersion as any).discount_percent || 0
        );
        let discountAmount = Number(
          (displayVersion as any).discount_amount || 0
        );
        let discountType =
          (displayVersion as any).discount_type === "amount"
            ? "amount"
            : "percent";

        // Fallback for older offers: read discount from source basket/order
        if (
          discountPercent === 0 &&
          discountAmount === 0 &&
          offer.source_order_id
        ) {
          const { data: sourceOrder } = await supabase
            .from("orders")
            .select("discount_percent, discount_amount, discount_type")
            .eq("id", offer.source_order_id)
            .maybeSingle();
          if (sourceOrder) {
            discountPercent = Number(sourceOrder.discount_percent || 0);
            discountAmount = Number(sourceOrder.discount_amount || 0);
            discountType =
              sourceOrder.discount_type === "amount" ? "amount" : "percent";
          }
        }

        const orderLike = {
          number: offer.offer_number,
          offer_number: offer.offer_number,
          offer_date: displayVersion.created_at || offer.created_at,
          status: "offer",
          currency: "EUR",
          vat_rate: vatRate,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          discount_type: discountType,
          shipping_cost: 0,
          payment_link_url: displayVersion.payment_link_url,
          prefers_bank_transfer: false,
          client_notes: displayVersion.client_notes,
          created_at: offer.created_at,
        };

        const items = displayLines.map((line: any, index: number) => {
          const qty = Number(line.quantity) || 1;
          const net =
            line.unit_price_net != null
              ? Number(line.unit_price_net)
              : Number(line.amount) / qty;
          const lineVat = Number(line.vat_rate ?? vatRate);
          return {
            id: line.id || String(index),
            line_number: line.line_number || index + 1,
            product_name: line.product_name || line.label,
            supplier_name: line.supplier_name,
            website_url: line.website_url,
            quantity: qty,
            unit_of_measure: line.unit_of_measure || "unit",
            currency: "EUR",
            unit_price: net * (1 + lineVat / 100),
            original_net_price: net,
            notes: line.notes,
            specification: line.specification,
            vat_rate_override: lineVat,
          };
        });

        const itemsNetBefore = displayLines.reduce(
          (sum: number, line: any) => sum + Number(line.amount || 0),
          0
        );
        const discountNet =
          discountType === "amount"
            ? discountAmount
            : (itemsNetBefore * discountPercent) / 100;
        const itemsNetAfter = Math.max(0, itemsNetBefore - discountNet);
        const vatAmount = (itemsNetAfter * vatRate) / 100;
        const grandTotal = itemsNetAfter + vatAmount;

        const blob = await pdf(
          React.createElement(OrderPDF, {
            order: orderLike,
            company: {
              name: offer.company?.name || offer.guest_name,
              vat_number: offer.company?.vat_number,
              address_line1:
                offer.company?.address_line1 || offer.guest_address_line1,
              address_line2:
                offer.company?.address_line2 || offer.guest_address_line2,
              city: offer.company?.city || offer.guest_city,
              postal_code:
                offer.company?.postal_code || offer.guest_postal_code,
              country: offer.company?.country || offer.guest_country,
              phone: offer.company?.phone || offer.guest_phone,
            },
            items,
            totals: {
              items_net_before_header: itemsNetBefore,
              header_discount_amt: discountNet,
              header_discount_percent: discountPercent,
              header_discount_amount: discountAmount,
              header_discount_type: discountType,
              items_net: itemsNetAfter,
              vat_amount: vatAmount,
              grand_total: grandTotal,
              shipping_cost: 0,
            },
            customerProfile,
            documentKind: "offer",
          }) as any
        ).toBlob();

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Offer_${offer.offer_number}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        await downloadIndividualOfferPdf(
          {
            offerNumber: offer.offer_number,
            versionNumber: displayVersion.version_number,
            title: displayVersion.title,
            validUntil: displayVersion.valid_until,
            clientName: offer.client?.full_name || offer.guest_name,
            clientEmail: offer.guest_email || offer.client?.email,
            companyName: offer.company?.name,
            clientNotes: displayVersion.client_notes,
            lines: displayLines.map((line) => ({
              label: line.label,
              amount: Number(line.amount),
              vat_rate: Number(line.vat_rate),
              notes: line.notes,
            })),
            specLinks: displayLinks.map((link) => ({
              title: link.title,
              url: link.url,
            })),
            isDraft: displayVersion.status === "draft",
          },
          `Offer_${offer.offer_number}_v${displayVersion.version_number}`
        );
      }
    } catch (e: any) {
      alert(e.message || "Could not generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const confirmAsOrder = async () => {
    if (!displayVersion?.id) return;
    if (
      !confirm(
        "Confirm this offer as a submitted order? It will get a normal order number and leave Active offers."
      )
    ) {
      return;
    }
    setWorking(true);
    try {
      const { data: orderId, error } = await supabase.rpc(
        "admin_confirm_offer_as_order",
        { p_version_id: displayVersion.id }
      );
      if (error) throw error;
      alert("Order created. Opening order…");
      router.push(`/admin/orders/${orderId}`);
    } catch (e: any) {
      alert(e.message || "Could not convert offer");
    } finally {
      setWorking(false);
    }
  };

  const archiveOffer = async () => {
    if (!displayVersion?.id) return;
    if (!confirm("Archive this offer? It will move to the Archive tab.")) {
      return;
    }
    setWorking(true);
    try {
      const { error } = await supabase.rpc("admin_archive_offer", {
        p_version_id: displayVersion.id,
      });
      if (error) throw error;
      await loadOffer();
      alert("Offer archived.");
    } catch (e: any) {
      alert(e.message || "Could not archive offer");
    } finally {
      setWorking(false);
    }
  };

  const saveCompanyAddress = async () => {
    if (!offer?.company?.id) return;
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          address_line1: offer.company.address_line1 || null,
          address_line2: offer.company.address_line2 || null,
          city: offer.company.city || null,
          postal_code: offer.company.postal_code || null,
          country: offer.company.country || null,
          phone: offer.company.phone || null,
        })
        .eq("id", offer.company.id);
      if (error) throw error;
      alert("Customer address saved.");
    } catch (e: any) {
      alert(e.message || "Could not save address");
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!offer) return <div className="p-8">Offer not found</div>;

  const netTotal = offerLinesNetTotal(displayLines);
  const vatTotal = offerLinesVatTotal(displayLines);
  const grossTotal = offerLinesGrossTotal(displayLines);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">
            {offer.offer_number}
            {displayVersion?.version_number
              ? ` · v${displayVersion.version_number}`
              : ""}
          </h1>
          <p className="text-muted-foreground">
            {offer.client?.full_name} · {offer.client?.email}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/offers">Back</Link>
        </Button>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Version history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {allVersions.map((v) => {
              const isCurrent = v.id === offer.current_version_id;
              const isSelected =
                viewingVersionId === v.id ||
                (isCurrent && !viewingVersionId);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() =>
                    isCurrent ? loadOffer() : loadHistoricalVersion(v.id)
                  }
                  className={`w-full text-left rounded-md border p-3 text-sm transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium flex items-center justify-between gap-2">
                    <span>v{v.version_number}</span>
                    {isCurrent ? (
                      <Badge variant="outline" className="text-xs">
                        current
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {STATUS_LABELS[v.status] || v.status}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(v.created_at)}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>
                {displayVersion
                  ? formatOfferTitleWithVersion(
                      displayVersion.title,
                      displayVersion.version_number
                    )
                  : "Offer"}
              </CardTitle>
              {!isViewingCurrent && (
                <p className="text-sm text-amber-700 mt-1">
                  Viewing archived version — read only
                </p>
              )}
            </div>
            {displayVersion?.status && (
              <Badge variant="outline">
                {STATUS_LABELS[displayVersion.status] ||
                  displayVersion.status}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {editing && editFields ? (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valid until</Label>
                    <Input
                      type="date"
                      value={editFields.valid_until}
                      onChange={(e) =>
                        setEditFields({
                          ...editFields,
                          valid_until: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={editFields.title}
                      onChange={(e) =>
                        setEditFields({ ...editFields, title: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Payment link</Label>
                    <Input
                      value={editFields.payment_link_url || ""}
                      onChange={(e) =>
                        setEditFields({
                          ...editFields,
                          payment_link_url: e.target.value || null,
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Client notes</Label>
                    <Textarea
                      value={editFields.client_notes || ""}
                      onChange={(e) =>
                        setEditFields({
                          ...editFields,
                          client_notes: e.target.value || null,
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Internal notes</Label>
                    <Textarea
                      value={editFields.admin_notes || ""}
                      onChange={(e) =>
                        setEditFields({
                          ...editFields,
                          admin_notes: e.target.value || null,
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Summary lines (net EUR)</h3>
                  <OfferLinesEditor lines={editLines} onChange={setEditLines} />
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Specification links</h3>
                  {editSpecLinks.map((link, index) => (
                    <div key={index} className="grid md:grid-cols-2 gap-2">
                      <Input
                        placeholder="Title"
                        value={link.title}
                        onChange={(e) => {
                          const next = [...editSpecLinks];
                          next[index] = { ...link, title: e.target.value };
                          setEditSpecLinks(next);
                        }}
                      />
                      <Input
                        placeholder="https://..."
                        value={link.url}
                        onChange={(e) => {
                          const next = [...editSpecLinks];
                          next[index] = { ...link, url: e.target.value };
                          setEditSpecLinks(next);
                        }}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditSpecLinks([...editSpecLinks, { title: "", url: "" }])
                    }
                  >
                    Add link
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    onClick={discardEditing}
                    disabled={working}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Discard
                  </Button>
                  <Button
                    onClick={() =>
                      saveAsNewVersion(editFields, editLines, editSpecLinks)
                    }
                    disabled={working}
                  >
                    Save new version
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Valid until:</span>{" "}
                    {displayVersion?.valid_until
                      ? formatDate(displayVersion.valid_until)
                      : "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total net:</span>{" "}
                    <strong>{formatCurrency(netTotal, "EUR")}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total gross:</span>{" "}
                    {formatCurrency(grossTotal, "EUR")}
                  </div>
                </div>

                {displayVersion?.client_notes && (
                  <p className="text-sm border rounded p-3 bg-gray-50">
                    {displayVersion.client_notes}
                  </p>
                )}

                <OfferLinesEditor
                  lines={versionToEditableLines(displayLines)}
                  onChange={() => {}}
                  readOnly
                />

                <div className="text-sm text-muted-foreground text-right">
                  VAT total: {formatCurrency(vatTotal, "EUR")}
                </div>

                {displayLinks.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Specification links</h3>
                    <ul className="space-y-1 text-sm">
                      {displayLinks.map((link) => (
                        <li key={link.id || link.url}>
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

                {displayVersion?.payment_link_url && (
                  <div className="text-sm rounded border bg-muted/30 px-3 py-2">
                    <span className="font-medium">Card payment link set</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — PDF shows a PAY button only (URL not printed).
                    </span>
                  </div>
                )}

                {displayVersion?.order_id && (
                  <p className="text-sm text-green-700">
                    Converted —{" "}
                    <Link
                      href={`/admin/orders/${displayVersion.order_id}`}
                      className="underline"
                    >
                      open order
                    </Link>
                  </p>
                )}

                {offer.company?.id && (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                    <h3 className="font-medium text-sm">
                      Delivery / contact address
                      {offer.client?.email_is_placeholder
                        ? " (placeholder account — edit here)"
                        : ""}
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      <Input
                        placeholder="Address line 1"
                        value={offer.company.address_line1 || ""}
                        onChange={(e) =>
                          setOffer({
                            ...offer,
                            company: {
                              ...offer.company,
                              address_line1: e.target.value,
                            },
                          })
                        }
                      />
                      <Input
                        placeholder="Address line 2"
                        value={offer.company.address_line2 || ""}
                        onChange={(e) =>
                          setOffer({
                            ...offer,
                            company: {
                              ...offer.company,
                              address_line2: e.target.value,
                            },
                          })
                        }
                      />
                      <Input
                        placeholder="City"
                        value={offer.company.city || ""}
                        onChange={(e) =>
                          setOffer({
                            ...offer,
                            company: { ...offer.company, city: e.target.value },
                          })
                        }
                      />
                      <Input
                        placeholder="Postal code"
                        value={offer.company.postal_code || ""}
                        onChange={(e) =>
                          setOffer({
                            ...offer,
                            company: {
                              ...offer.company,
                              postal_code: e.target.value,
                            },
                          })
                        }
                      />
                      <Input
                        placeholder="Country"
                        value={offer.company.country || ""}
                        onChange={(e) =>
                          setOffer({
                            ...offer,
                            company: {
                              ...offer.company,
                              country: e.target.value,
                            },
                          })
                        }
                      />
                      <Input
                        placeholder="Phone"
                        value={offer.company.phone || ""}
                        onChange={(e) =>
                          setOffer({
                            ...offer,
                            company: { ...offer.company, phone: e.target.value },
                          })
                        }
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={saveCompanyAddress}>
                      Save address
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={downloadPdf}
                    disabled={downloadingPdf}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {downloadingPdf ? "Generating…" : "Download PDF"}
                  </Button>
                  {isViewingCurrent &&
                    !displayVersion?.order_id &&
                    displayVersion?.status !== "accepted" &&
                    displayVersion?.status !== "archived" && (
                      <>
                        <Button
                          onClick={confirmAsOrder}
                          disabled={working}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirm as Order
                        </Button>
                        <Button
                          variant="outline"
                          onClick={archiveOffer}
                          disabled={working}
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </Button>
                      </>
                    )}
                  {canEditCurrent && (
                    <Button variant="outline" onClick={startEditing}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit pricing
                    </Button>
                  )}
                  {isViewingCurrent && version?.status === "draft" && (
                    <Button onClick={shareWithClient} disabled={working}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share with client
                    </Button>
                  )}
                  {!isViewingCurrent && viewingVersion && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        copyVersionAsNew(
                          viewingVersion,
                          viewingLines,
                          viewingLinks
                        )
                      }
                      disabled={working}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy as new version
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
