"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierCombobox } from "@/components/SupplierCombobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Save, Trash2 } from "lucide-react";

type BasketSet = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  default_currency: "EUR" | "PLN";
  default_vat_rate: number;
  default_client_notes: string | null;
};

type BasketSetItem = {
  id?: string;
  line_number: number;
  product_name: string;
  website_url: string;
  supplier_name: string;
  unit_price: number;
  quantity: number;
  currency: "EUR" | "PLN";
  unit_of_measure: "unit" | "m2";
  notes: string;
};

const emptyItem = (lineNumber: number): BasketSetItem => ({
  line_number: lineNumber,
  product_name: "",
  website_url: "",
  supplier_name: "",
  unit_price: 0,
  quantity: 1,
  currency: "PLN",
  unit_of_measure: "unit",
  notes: "",
});

export default function AdminBasketSetsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sets, setSets] = useState<BasketSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [setForm, setSetForm] = useState({
    code: "",
    name: "",
    description: "",
    is_active: true,
    default_currency: "EUR" as "EUR" | "PLN",
    default_vat_rate: "23",
    default_client_notes: "",
  });
  const [items, setItems] = useState<BasketSetItem[]>([emptyItem(1)]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  const loadPage = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "staff_admin") {
        router.push("/admin/orders");
        return;
      }

      const { data, error } = await supabase
        .from("basket_sets")
        .select("*")
        .order("code", { ascending: true });

      if (error) throw error;
      setSets(data || []);
    } catch (error) {
      console.error(error);
      setMessage("Error loading basket sets");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedSetId(null);
    setSetForm({
      code: "",
      name: "",
      description: "",
      is_active: true,
      default_currency: "EUR",
      default_vat_rate: "23",
      default_client_notes: "",
    });
    setItems([emptyItem(1)]);
  };

  const loadSet = async (setId: string) => {
    const set = sets.find((s) => s.id === setId);
    if (!set) return;

    setSelectedSetId(setId);
    setSetForm({
      code: set.code,
      name: set.name,
      description: set.description || "",
      is_active: set.is_active,
      default_currency: set.default_currency,
      default_vat_rate: String(set.default_vat_rate),
      default_client_notes: set.default_client_notes || "",
    });

    const { data, error } = await supabase
      .from("basket_set_items")
      .select("*")
      .eq("basket_set_id", setId)
      .order("line_number", { ascending: true });

    if (error) {
      setMessage("Error loading items: " + error.message);
      return;
    }

    setItems(
      data?.length
        ? data.map((row) => ({
            id: row.id,
            line_number: row.line_number,
            product_name: row.product_name || "",
            website_url: row.website_url || "",
            supplier_name: row.supplier_name || "",
            unit_price: Number(row.unit_price),
            quantity: Number(row.quantity),
            currency: row.currency,
            unit_of_measure: row.unit_of_measure || "unit",
            notes: row.notes || "",
          }))
        : [emptyItem(1)]
    );
  };

  const addItem = () => {
    const nextLine =
      items.length > 0 ? Math.max(...items.map((i) => i.line_number)) + 1 : 1;
    setItems([...items, emptyItem(nextLine)]);
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    next.forEach((item, i) => {
      item.line_number = i + 1;
    });
    setItems(next.length ? next : [emptyItem(1)]);
  };

  const updateItem = (index: number, patch: Partial<BasketSetItem>) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    setItems(next);
  };

  const saveSet = async () => {
    if (!setForm.code.trim() || !setForm.name.trim()) {
      setMessage("Code and name are required");
      return;
    }

    const validItems = items.filter(
      (item) => item.product_name.trim() && item.unit_price > 0
    );
    if (validItems.length === 0) {
      setMessage("Add at least one item with product name and price");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const setPayload = {
        code: setForm.code.trim(),
        name: setForm.name.trim(),
        description: setForm.description.trim() || null,
        is_active: setForm.is_active,
        default_currency: setForm.default_currency,
        default_vat_rate: parseFloat(setForm.default_vat_rate) || 23,
        default_client_notes: setForm.default_client_notes.trim() || null,
        created_by: user.id,
      };

      let setId = selectedSetId;

      if (setId) {
        const { error } = await supabase
          .from("basket_sets")
          .update({
            code: setPayload.code,
            name: setPayload.name,
            description: setPayload.description,
            is_active: setPayload.is_active,
            default_currency: setPayload.default_currency,
            default_vat_rate: setPayload.default_vat_rate,
            default_client_notes: setPayload.default_client_notes,
          })
          .eq("id", setId);
        if (error) throw error;

        const { error: deleteError } = await supabase
          .from("basket_set_items")
          .delete()
          .eq("basket_set_id", setId);
        if (deleteError) throw deleteError;
      } else {
        const { data, error } = await supabase
          .from("basket_sets")
          .insert(setPayload)
          .select("id")
          .single();
        if (error) throw error;
        setId = data.id;
        setSelectedSetId(setId);
      }

      const itemsPayload = validItems.map((item, index) => ({
        basket_set_id: setId,
        line_number: index + 1,
        product_name: item.product_name.trim(),
        website_url: item.website_url.trim() || null,
        supplier_name: item.supplier_name.trim() || null,
        unit_price: item.unit_price,
        quantity: item.quantity,
        currency: item.currency,
        unit_of_measure: item.unit_of_measure,
        notes: item.notes.trim() || null,
      }));

      const { error: itemsError } = await supabase
        .from("basket_set_items")
        .insert(itemsPayload);
      if (itemsError) throw itemsError;

      setMessage("Basket set saved");
      await loadPage();
      if (setId) await loadSet(setId);
    } catch (error: any) {
      setMessage("Error: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSet = async () => {
    if (!selectedSetId) return;
    if (!confirm("Delete this basket set? This cannot be undone.")) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("basket_sets")
        .delete()
        .eq("id", selectedSetId);
      if (error) throw error;
      resetForm();
      setMessage("Basket set deleted");
      await loadPage();
    } catch (error: any) {
      setMessage("Error: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Basket Sets</h1>
        <p className="text-muted-foreground">
          Pre-defined basket templates. Clients load them by code on the dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Sets</CardTitle>
            <Button variant="outline" size="sm" onClick={resetForm}>
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {sets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sets yet</p>
            ) : (
              sets.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  onClick={() => loadSet(set.id)}
                  className={`w-full text-left rounded border p-3 hover:bg-gray-50 ${
                    selectedSetId === set.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="font-medium">{set.code}</div>
                  <div className="text-sm text-muted-foreground">{set.name}</div>
                  {!set.is_active && (
                    <div className="text-xs text-amber-600 mt-1">Inactive</div>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{selectedSetId ? "Edit set" : "New set"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={setForm.code}
                  onChange={(e) =>
                    setSetForm({ ...setForm, code: e.target.value })
                  }
                  placeholder="IFP-BATH-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={setForm.name}
                  onChange={(e) =>
                    setSetForm({ ...setForm, name: e.target.value })
                  }
                  placeholder="Bathroom starter pack"
                />
              </div>
              <div className="col-span-full space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={setForm.description}
                  onChange={(e) =>
                    setSetForm({ ...setForm, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_client_notes">Basket name (optional)</Label>
                <Input
                  id="default_client_notes"
                  value={setForm.default_client_notes}
                  onChange={(e) =>
                    setSetForm({
                      ...setForm,
                      default_client_notes: e.target.value,
                    })
                  }
                  placeholder="Defaults to set name"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={setForm.is_active ? "active" : "inactive"}
                  onValueChange={(value) =>
                    setSetForm({ ...setForm, is_active: value === "active" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Items</h3>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add item
                </Button>
              </div>

              <div className="overflow-x-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-left">URL</th>
                      <th className="p-2 text-left">Supplier</th>
                      <th className="p-2 text-right">Price</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-left">Unit</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.line_number} className="border-t">
                        <td className="p-2">{item.line_number}</td>
                        <td className="p-2">
                          <Input
                            value={item.product_name}
                            onChange={(e) =>
                              updateItem(index, { product_name: e.target.value })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={item.website_url}
                            onChange={(e) =>
                              updateItem(index, { website_url: e.target.value })
                            }
                          />
                        </td>
                        <td className="p-2 min-w-[160px]">
                          <SupplierCombobox
                            value={item.supplier_name}
                            onChange={(value) =>
                              updateItem(index, { supplier_name: value })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="text-right"
                            value={item.unit_price || ""}
                            onChange={(e) =>
                              updateItem(index, {
                                unit_price: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.001"
                            className="text-right"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(index, {
                                quantity: parseFloat(e.target.value) || 1,
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Select
                            value={item.unit_of_measure}
                            onValueChange={(value: "unit" | "m2") =>
                              updateItem(index, { unit_of_measure: value })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unit">pcs</SelectItem>
                              <SelectItem value="m2">m²</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {message && (
              <div
                className={`p-3 rounded text-sm ${
                  message.startsWith("Error")
                    ? "bg-red-50 text-red-600"
                    : "bg-green-50 text-green-600"
                }`}
              >
                {message}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={saveSet} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save set"}
              </Button>
              {selectedSetId && (
                <Button
                  variant="outline"
                  onClick={deleteSet}
                  disabled={saving}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
