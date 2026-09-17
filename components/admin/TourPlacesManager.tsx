"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, Upload, X } from "lucide-react";
import {
  PLACE_KIND_LABELS,
  type TourPlace,
  type TourPlaceKind,
  formatDurationMinutes,
} from "@/lib/tour-places";

const EMPTY_FORM = {
  name: "",
  kind: "showroom" as TourPlaceKind,
  city: "",
  short_description: "",
  highlights: "",
  typical_duration_minutes: "" as string,
  is_active: true,
  logo_url: "" as string,
  thumbnail_url: "" as string,
};

export function TourPlacesManager() {
  const supabase = createClient();
  const [places, setPlaces] = useState<TourPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TourPlace | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterKind, setFilterKind] = useState<string>("all");
  const [uploadingField, setUploadingField] = useState<
    "logo_url" | "thumbnail_url" | null
  >(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tour_places")
        .select("*")
        .order("name");
      if (error) throw error;
      setPlaces((data || []) as TourPlace[]);
    } catch (e: any) {
      alert("Błąd ładowania miejsc: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (p: TourPlace) => {
    setEditing(p);
    setForm({
      name: p.name,
      kind: p.kind,
      city: p.city || "",
      short_description: p.short_description || "",
      highlights: p.highlights || "",
      typical_duration_minutes:
        p.typical_duration_minutes != null
          ? String(p.typical_duration_minutes)
          : "",
      is_active: p.is_active,
      logo_url: p.logo_url || "",
      thumbnail_url: p.thumbnail_url || "",
    });
    setShowForm(true);
  };

  const uploadPlaceImage = async (
    file: File,
    field: "logo_url" | "thumbnail_url"
  ) => {
    if (file.size > 5 * 1024 * 1024) {
      alert("Max 5 MB");
      return;
    }
    setUploadingField(field);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const folder = field === "logo_url" ? "logos" : "thumbnails";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("tour-places")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("tour-places").getPublicUrl(path);
      setForm((prev) => ({ ...prev, [field]: data.publicUrl }));
    } catch (err: any) {
      alert("Upload nieudany: " + (err.message || err));
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("Nazwa jest wymagana");
      return;
    }
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      city: form.city.trim() || null,
      short_description: form.short_description.trim() || null,
      highlights: form.highlights.trim() || null,
      typical_duration_minutes: form.typical_duration_minutes
        ? parseInt(form.typical_duration_minutes, 10)
        : null,
      is_active: form.is_active,
      logo_url: form.logo_url.trim() || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
      updated_at: new Date().toISOString(),
    };
    try {
      if (editing) {
        const { error } = await supabase
          .from("tour_places")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tour_places").insert(payload);
        if (error) throw error;
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err: any) {
      alert("Nie zapisano: " + (err.message || err));
    }
  };

  const handleDelete = async (p: TourPlace) => {
    if (
      !confirm(
        `Usunąć „${p.name}"? Jeśli jest używane w wycieczkach, usunięcie może się nie powieść.`
      )
    ) {
      return;
    }
    try {
      const { error } = await supabase
        .from("tour_places")
        .delete()
        .eq("id", p.id);
      if (error) throw error;
      await load();
    } catch (err: any) {
      alert("Nie usunięto: " + (err.message || err));
    }
  };

  const visible = places.filter(
    (p) => filterKind === "all" || p.kind === filterKind
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Katalog miejsc</h2>
          <p className="text-sm text-muted-foreground">
            Sklepy, showroomy, hotele i restauracje — dodaj raz, wybieraj przy
            planowaniu wycieczek.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={filterKind} onValueChange={setFilterKind}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtr" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              {(Object.keys(PLACE_KIND_LABELS) as TourPlaceKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {PLACE_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Dodaj miejsce
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? "Edytuj miejsce" : "Nowe miejsce"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Nazwa *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    required
                    placeholder="np. MaxFliz Katowice"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Typ *</Label>
                  <Select
                    value={form.kind}
                    onValueChange={(v) =>
                      setForm({ ...form, kind: v as TourPlaceKind })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PLACE_KIND_LABELS) as TourPlaceKind[]).map(
                        (k) => (
                          <SelectItem key={k} value={k}>
                            {PLACE_KIND_LABELS[k]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Miasto</Label>
                  <Input
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                    placeholder="Katowice"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Typowy czas wizyty (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.typical_duration_minutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        typical_duration_minutes: e.target.value,
                      })
                    }
                    placeholder="90"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Krótki opis</Label>
                <Textarea
                  value={form.short_description}
                  onChange={(e) =>
                    setForm({ ...form, short_description: e.target.value })
                  }
                  rows={2}
                  placeholder="Czym jest to miejsce?"
                />
              </div>
              <div className="space-y-1">
                <Label>Co warto zobaczyć</Label>
                <Textarea
                  value={form.highlights}
                  onChange={(e) =>
                    setForm({ ...form, highlights: e.target.value })
                  }
                  rows={3}
                  placeholder="Płytki, armatura, ekspozycja…"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 border rounded-md p-3">
                  <Label>Logo (opcjonalnie, lewa strona w PDF)</Label>
                  <p className="text-xs text-muted-foreground">
                    Kwadratowe, np. 200×200 px
                  </p>
                  {form.logo_url ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={form.logo_url}
                        alt="Logo"
                        className="h-12 w-12 object-contain border rounded bg-white"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setForm({ ...form, logo_url: "" })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploadingField !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadPlaceImage(f, "logo_url");
                      e.target.value = "";
                    }}
                  />
                  {uploadingField === "logo_url" && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Upload className="h-3 w-3" /> Upload…
                    </p>
                  )}
                </div>
                <div className="space-y-2 border rounded-md p-3">
                  <Label>Thumbnail zdjęcia (prawa strona w PDF)</Label>
                  <p className="text-xs text-muted-foreground">
                    Landscape, np. fasada / wnętrze showroomu
                  </p>
                  {form.thumbnail_url ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={form.thumbnail_url}
                        alt="Thumbnail"
                        className="h-16 w-24 object-cover border rounded"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setForm({ ...form, thumbnail_url: "" })
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploadingField !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadPlaceImage(f, "thumbnail_url");
                      e.target.value = "";
                    }}
                  />
                  {uploadingField === "thumbnail_url" && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Upload className="h-3 w-3" /> Upload…
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="place_active"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                />
                <Label htmlFor="place_active">Aktywne (widoczne przy wyborze)</Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Zapisz</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                >
                  Anuluj
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Ładowanie…</p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground">Brak miejsc w katalogu.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-start justify-between gap-3 border rounded-lg p-3 bg-white"
            >
              <div className="min-w-0 flex-1 flex gap-3">
                {p.thumbnail_url && (
                  <img
                    src={p.thumbnail_url}
                    alt=""
                    className="h-14 w-20 object-cover rounded border shrink-0"
                  />
                )}
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {p.logo_url && (
                    <img
                      src={p.logo_url}
                      alt=""
                      className="h-6 w-6 object-contain"
                    />
                  )}
                  <span className="font-medium">{p.name}</span>
                  <Badge variant="outline">{PLACE_KIND_LABELS[p.kind]}</Badge>
                  {p.city && (
                    <span className="text-sm text-muted-foreground">
                      {p.city}
                    </span>
                  )}
                  {!p.is_active && (
                    <Badge variant="secondary">Nieaktywne</Badge>
                  )}
                  {p.typical_duration_minutes != null && (
                    <span className="text-xs text-muted-foreground">
                      {formatDurationMinutes(p.typical_duration_minutes)}
                    </span>
                  )}
                </div>
                {p.short_description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {p.short_description}
                  </p>
                )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(p)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(p)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
