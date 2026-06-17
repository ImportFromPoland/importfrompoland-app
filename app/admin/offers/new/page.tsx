"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Save } from "lucide-react";

type Line = {
  line_number: number;
  label: string;
  amount: number;
  vat_rate: number;
  notes: string;
};

type SpecLink = { title: string; url: string };

const emptyLine = (n: number): Line => ({
  line_number: n,
  label: "",
  amount: 0,
  vat_rate: 23,
  notes: "",
});

export default function NewOfferPage() {
  const router = useRouter();
  const supabase = createClient();
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(1)]);
  const [specLinks, setSpecLinks] = useState<SpecLink[]>([{ title: "", url: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadClients();
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setValidUntil(d.toISOString().slice(0, 10));
  }, []);

  const loadClients = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, company_id, company:companies(name)")
      .eq("role", "client")
      .is("gdpr_erased_at", null)
      .order("full_name");
    setClients(data || []);
  };

  const saveOffer = async (sendToClient: boolean) => {
    if (!clientId || !title.trim() || !validUntil) {
      setError("Client, title and valid until are required");
      return;
    }

    const validLines = lines.filter((l) => l.label.trim() && l.amount > 0);
    if (validLines.length === 0) {
      setError("Add at least one line with label and amount");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const client = clients.find((c) => c.id === clientId);
      if (!client?.company_id) throw new Error("Client has no company");

      const { data: offerNumber, error: numError } = await supabase.rpc(
        "generate_individual_offer_number",
        { p_owner_id: user.id }
      );
      if (numError) throw numError;

      const { data: offer, error: offerError } = await supabase
        .from("individual_offers")
        .insert({
          offer_number: offerNumber,
          owner_id: user.id,
          company_id: client.company_id,
          client_profile_id: client.id,
        })
        .select("id")
        .single();
      if (offerError) throw offerError;

      const { data: version, error: versionError } = await supabase
        .from("individual_offer_versions")
        .insert({
          offer_id: offer.id,
          version_number: 1,
          status: sendToClient ? "sent" : "draft",
          valid_until: validUntil,
          title: title.trim(),
          client_notes: clientNotes.trim() || title.trim(),
          admin_notes: adminNotes.trim() || null,
          payment_link_url: paymentLink.trim() || null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (versionError) throw versionError;

      const { error: linesError } = await supabase.from("individual_offer_lines").insert(
        validLines.map((line, index) => ({
          offer_version_id: version.id,
          line_number: index + 1,
          label: line.label.trim(),
          amount: line.amount,
          vat_rate: line.vat_rate,
          notes: line.notes.trim() || null,
        }))
      );
      if (linesError) throw linesError;

      const links = specLinks.filter((l) => l.title.trim() && l.url.trim());
      if (links.length > 0) {
        const { error: linksError } = await supabase
          .from("individual_offer_spec_links")
          .insert(
            links.map((link, index) => ({
              offer_version_id: version.id,
              title: link.title.trim(),
              url: link.url.trim(),
              sort_order: index,
            }))
          );
        if (linksError) throw linksError;
      }

      const { error: updateError } = await supabase
        .from("individual_offers")
        .update({ current_version_id: version.id })
        .eq("id", offer.id);
      if (updateError) throw updateError;

      router.push(`/admin/offers/${offer.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New individual offer</h1>
        <Button variant="outline" asChild>
          <Link href="/admin/offers">Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Offer details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <select
                className="w-full border rounded-md h-10 px-3"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Valid until *</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Payment link (optional)</Label>
              <Input
                value={paymentLink}
                onChange={(e) => setPaymentLink(e.target.value)}
                placeholder="Revolut link — show Pay button when set"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Client notes (shown on offer)</Label>
              <Textarea value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Internal notes (admin only)</Label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row justify-between">
          <CardTitle>Summary lines</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setLines([...lines, emptyLine(lines.length + 1)])
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line, index) => (
            <div key={line.line_number} className="grid md:grid-cols-4 gap-2">
              <Input
                placeholder="Label (e.g. Windows)"
                value={line.label}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...line, label: e.target.value };
                  setLines(next);
                }}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Amount EUR (gross)"
                value={line.amount || ""}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = {
                    ...line,
                    amount: parseFloat(e.target.value) || 0,
                  };
                  setLines(next);
                }}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="VAT %"
                value={line.vat_rate}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = {
                    ...line,
                    vat_rate: parseFloat(e.target.value) || 23,
                  };
                  setLines(next);
                }}
              />
              <Input
                placeholder="Notes"
                value={line.notes}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...line, notes: e.target.value };
                  setLines(next);
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Specification links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {specLinks.map((link, index) => (
            <div key={index} className="grid md:grid-cols-2 gap-2">
              <Input
                placeholder="Title"
                value={link.title}
                onChange={(e) => {
                  const next = [...specLinks];
                  next[index] = { ...link, title: e.target.value };
                  setSpecLinks(next);
                }}
              />
              <Input
                placeholder="https://..."
                value={link.url}
                onChange={(e) => {
                  const next = [...specLinks];
                  next[index] = { ...link, url: e.target.value };
                  setSpecLinks(next);
                }}
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSpecLinks([...specLinks, { title: "", url: "" }])}
          >
            Add link
          </Button>
        </CardContent>
      </Card>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={() => saveOffer(false)} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          Save draft
        </Button>
        <Button onClick={() => saveOffer(true)} disabled={saving} variant="default">
          Save &amp; send to client
        </Button>
      </div>
    </div>
  );
}
