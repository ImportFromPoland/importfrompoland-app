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
import { Copy, Download, Pencil, Share2, X } from "lucide-react";
import { downloadIndividualOfferPdf } from "@/lib/individual-offer-pdf";

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
          "*, company:companies(name), client:profiles!client_profile_id(full_name, email, phone)"
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
      await downloadIndividualOfferPdf(
        {
          offerNumber: offer.offer_number,
          versionNumber: displayVersion.version_number,
          title: displayVersion.title,
          validUntil: displayVersion.valid_until,
          clientName: offer.client?.full_name,
          clientEmail: offer.client?.email,
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
    } catch (e: any) {
      alert(e.message || "Could not generate PDF");
    } finally {
      setDownloadingPdf(false);
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
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Payment link:</span>
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs break-all">
                      {displayVersion.payment_link_url}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        navigator.clipboard.writeText(
                          displayVersion.payment_link_url
                        )
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {displayVersion?.order_id && (
                  <p className="text-sm text-green-700">
                    Accepted — linked order created.
                  </p>
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
