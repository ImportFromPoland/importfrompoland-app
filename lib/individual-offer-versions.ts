import type { SupabaseClient } from "@supabase/supabase-js";
import type { EditableOfferLine } from "@/components/admin/OfferLinesEditor";

export type OfferVersionFields = {
  valid_until: string;
  title: string;
  client_notes: string | null;
  admin_notes: string | null;
  payment_link_url: string | null;
};

export type SpecLinkInput = { title: string; url: string; sort_order?: number };

export async function getNextVersionNumber(
  supabase: SupabaseClient,
  offerId: string
): Promise<number> {
  const { data } = await supabase
    .from("individual_offer_versions")
    .select("version_number")
    .eq("offer_id", offerId)
    .order("version_number", { ascending: false })
    .limit(1);

  return (data?.[0]?.version_number ?? 0) + 1;
}

export async function createOfferVersion(
  supabase: SupabaseClient,
  params: {
    offerId: string;
    currentVersionId: string | null;
    fields: OfferVersionFields;
    lines: EditableOfferLine[];
    specLinks: SpecLinkInput[];
    createdBy: string;
    status?: "draft" | "sent";
  }
): Promise<string> {
  const nextVersion = await getNextVersionNumber(supabase, params.offerId);

  if (params.currentVersionId) {
    await supabase
      .from("individual_offer_versions")
      .update({
        status: "superseded",
        superseded_at: new Date().toISOString(),
      })
      .eq("id", params.currentVersionId)
      .neq("status", "accepted");
  }

  const { data: newVersion, error: vErr } = await supabase
    .from("individual_offer_versions")
    .insert({
      offer_id: params.offerId,
      version_number: nextVersion,
      status: params.status ?? "draft",
      valid_until: params.fields.valid_until,
      title: params.fields.title,
      client_notes: params.fields.client_notes,
      admin_notes: params.fields.admin_notes,
      payment_link_url: params.fields.payment_link_url,
      created_by: params.createdBy,
    })
    .select("id")
    .single();
  if (vErr) throw vErr;

  const validLines = params.lines.filter((l) => l.label.trim() && l.amount > 0);
  if (validLines.length > 0) {
    const { error: linesError } = await supabase
      .from("individual_offer_lines")
      .insert(
        validLines.map((line, index) => ({
          offer_version_id: newVersion.id,
          line_number: index + 1,
          label: line.label.trim(),
          amount: line.amount,
          vat_rate: line.vat_rate,
          notes: line.notes.trim() || null,
        }))
      );
    if (linesError) throw linesError;
  }

  const links = params.specLinks.filter((l) => l.title.trim() && l.url.trim());
  if (links.length > 0) {
    const { error: linksError } = await supabase
      .from("individual_offer_spec_links")
      .insert(
        links.map((link, index) => ({
          offer_version_id: newVersion.id,
          title: link.title.trim(),
          url: link.url.trim(),
          sort_order: link.sort_order ?? index,
        }))
      );
    if (linksError) throw linksError;
  }

  const { error: updateError } = await supabase
    .from("individual_offers")
    .update({ current_version_id: newVersion.id })
    .eq("id", params.offerId);
  if (updateError) throw updateError;

  return newVersion.id;
}

export function versionToEditableLines(lines: any[]): EditableOfferLine[] {
  return (lines || []).map((line) => ({
    line_number: line.line_number,
    label: line.label,
    amount: Number(line.amount),
    vat_rate: Number(line.vat_rate),
    notes: line.notes || "",
  }));
}

export function formatOfferTitleWithVersion(
  title: string,
  versionNumber?: number | null
): string {
  if (!versionNumber) return title;
  return `${title} (v${versionNumber})`;
}
