"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderLineForm, type OrderLineData } from "@/components/OrderLineForm";
import { TotalsPanel } from "@/components/TotalsPanel";
import { Plus, Save, ArrowLeft, User, Building2 } from "lucide-react";
import { PLN_TO_EUR_RATE, DEFAULT_VAT_RATE } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

export default function AdminNewBasketPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<any>(null);

  const [currency, setCurrency] = useState<"EUR" | "PLN">("EUR");
  const [vatRate, setVatRate] = useState(DEFAULT_VAT_RATE);
  const [shippingCost, setShippingCost] = useState(0);
  const [headerDiscountPercent, setHeaderDiscountPercent] = useState(0);
  const [headerMarkupPercent, setHeaderMarkupPercent] = useState(0);
  const [clientNotes, setClientNotes] = useState("");

  const [lines, setLines] = useState<OrderLineData[]>([
    {
      line_number: 1,
      product_name: "",
      website_url: "",
      supplier_name: "",
      unit_price: 0,
      quantity: 1,
      currency: "PLN",
      unit_of_measure: "unit",
      discount_percent: 0,
      notes: "",
    },
  ]);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("name");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        line_number: lines.length + 1,
        product_name: "",
        website_url: "",
        supplier_name: "",
        unit_price: 0,
        quantity: 1,
        currency: "PLN",
        unit_of_measure: "unit",
        discount_percent: 0,
        notes: "",
      },
    ]);
  };

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index);
    // Renumber lines
    newLines.forEach((line, i) => {
      line.line_number = i + 1;
    });
    setLines(newLines);
  };

  const updateLine = (index: number, updatedLine: OrderLineData) => {
    const newLines = [...lines];
    newLines[index] = updatedLine;
    setLines(newLines);
  };

  const calculateTotals = () => {
    let itemsNet = 0;

    lines.forEach((line) => {
      let lineNet = 0;
      
      // Check if we have original_net_price (from database)
      if (line.original_net_price) {
        // Use stored original net price (maintains consistency when VAT changes)
        lineNet = line.original_net_price * line.quantity;
      } else {
        // Calculate NET from current gross price (for new items)
        let lineGrossPLN = line.unit_price * line.quantity;
        let lineGrossEUR = lineGrossPLN;
        if (line.currency === "PLN" && currency === "EUR") {
          lineGrossEUR = lineGrossPLN * PLN_TO_EUR_RATE;
        }
        lineNet = lineGrossEUR / (1 + vatRate / 100);
      }

      // Apply line discount to NET
      if (line.discount_percent > 0) {
        lineNet = lineNet * (1 - line.discount_percent / 100);
      }

      itemsNet += lineNet;
    });

    // Apply header modifiers
    const itemsNetAfterHeader =
      itemsNet * (1 - headerDiscountPercent / 100) * (1 + headerMarkupPercent / 100);

    const vatAmount = (itemsNetAfterHeader * vatRate) / 100;
    const itemsGross = itemsNetAfterHeader + vatAmount;
    const grandTotal = itemsGross + shippingCost;

    return {
      itemsNet,
      itemsNetAfterHeader,
      vatAmount,
      itemsGross,
      grandTotal,
    };
  };

  const totals = calculateTotals();

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    const company = companies.find(c => c.id === companyId);
    setSelectedCompany(company);
  };

  const saveBasket = async () => {
    if (!selectedCompanyId) {
      alert("Please select a client company");
      return;
    }

    setSaving(true);
    try {
      // Get current admin user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          company_id: selectedCompanyId,
          created_by: user.id,
          status: "draft",
          currency,
          vat_rate: vatRate,
          shipping_cost: shippingCost,
          discount_percent: headerDiscountPercent,
          markup_percent: headerMarkupPercent,
          client_notes: clientNotes,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const items = lines
        .filter((line) => line.product_name && line.unit_price > 0)
        .map((line) => {
          // Calculate original net price from gross price with default 23% VAT
          let originalNetPrice = 0;
          if (line.currency === "PLN" && currency === "EUR") {
            const grossEUR = line.unit_price * PLN_TO_EUR_RATE;
            originalNetPrice = grossEUR / 1.23; // Remove 23% VAT
          } else if (line.currency === currency) {
            originalNetPrice = line.unit_price / 1.23; // Remove 23% VAT
          } else {
            originalNetPrice = line.unit_price / 1.23; // Remove 23% VAT
          }

          return {
            order_id: order.id,
            line_number: line.line_number,
            product_name: line.product_name,
            website_url: line.website_url,
            supplier_name: line.supplier_name,
            original_supplier_name: line.original_supplier_name || line.supplier_name,
            unit_price: line.unit_price,
            quantity: line.quantity,
            currency: line.currency,
            discount_percent: line.discount_percent,
            notes: line.notes,
            attachment_url: line.attachment_url,
            original_net_price: originalNetPrice,
          };
        });

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(items);

        if (itemsError) throw itemsError;
      }

      router.push(`/admin/orders/${order.id}`);
    } catch (error: any) {
      alert("Error creating basket: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Create New Basket for Client</h1>
            <p className="text-muted-foreground">
              Create a new basket and add items for a client
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Select Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Client Company</Label>
                  <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client company..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {company.name}
                            {company.vat_number && (
                              <span className="text-muted-foreground">
                                (VAT: {company.vat_number})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCompany && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Selected Client:</h4>
                    <div className="text-sm text-gray-600">
                      <div className="font-medium">{selectedCompany.name}</div>
                      {selectedCompany.vat_number && (
                        <div>VAT: {selectedCompany.vat_number}</div>
                      )}
                      {selectedCompany.address_line1 && (
                        <div>
                          {selectedCompany.address_line1}
                          {selectedCompany.address_line2 && (
                            <div>{selectedCompany.address_line2}</div>
                          )}
                          <div>
                            {selectedCompany.city}, {selectedCompany.postal_code}
                          </div>
                          <div>{selectedCompany.country}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Basket Items</CardTitle>
                <Button onClick={addLine} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {lines.map((line, index) => (
                <OrderLineForm
                  key={index}
                  line={line}
                  onUpdate={(updated) => updateLine(index, updated)}
                  onRemove={() => removeLine(index)}
                  orderCurrency={currency}
                  vatRate={vatRate}
                />
              ))}
            </CardContent>
          </Card>

          {/* Client Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Basket Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Basket name or notes for the client..."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Basket Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={(value: "EUR" | "PLN") => setCurrency(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="PLN">PLN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>VAT Rate</Label>
                <Select
                  value={vatRate.toString()}
                  onValueChange={(value) => setVatRate(parseFloat(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="23">23% (Standard Polish VAT)</SelectItem>
                    <SelectItem value="0">0% (EU VAT Registered - Reverse Charge)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Shipping Cost ({currency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label>Header Discount (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={headerDiscountPercent}
                  onChange={(e) => setHeaderDiscountPercent(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label>Header Markup (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={headerMarkupPercent}
                  onChange={(e) => setHeaderMarkupPercent(parseFloat(e.target.value) || 0)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <TotalsPanel
            itemsNet={totals.itemsNet}
            vatRate={vatRate}
            vatAmount={totals.vatAmount}
            itemsGross={totals.itemsGross}
            shippingCost={shippingCost}
            headerDiscountPercent={headerDiscountPercent}
            headerMarkupPercent={headerMarkupPercent}
            grandTotal={totals.grandTotal}
            currency={currency}
            clientView={false}
          />

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={saveBasket}
              className="w-full"
              disabled={saving || !selectedCompanyId}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Creating Basket..." : "Create Basket"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
