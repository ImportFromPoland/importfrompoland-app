"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { Settings, Plus, Trash2 } from "lucide-react";

interface ExchangeRate {
  id: string;
  rate: number;
  effective_from: string;
  effective_to?: string;
  notes?: string;
  created_at: string;
}

export default function AdminSettingsPage() {
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRate, setNewRate] = useState({
    rate: "",
    effective_from: "",
    notes: ""
  });

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get current user role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setUserRole(profile?.role || "");
      }

      // Load exchange rates
      const { data: rates } = await supabase
        .from("exchange_rates")
        .select("*")
        .order("effective_from", { ascending: false });

      setExchangeRates(rates || []);
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const addExchangeRate = async () => {
    if (!newRate.rate || !newRate.effective_from) {
      alert("Please fill in rate and effective date");
      return;
    }

    try {
      // First, end the current rate if it exists
      const currentRate = exchangeRates.find(rate => !rate.effective_to);
      if (currentRate) {
        await supabase
          .from("exchange_rates")
          .update({ effective_to: newRate.effective_from })
          .eq("id", currentRate.id);
      }

      // Add new rate
      const { error } = await supabase
        .from("exchange_rates")
        .insert({
          rate: parseFloat(newRate.rate),
          effective_from: newRate.effective_from,
          notes: newRate.notes || null
        });

      if (error) throw error;

      alert("Exchange rate updated successfully!");
      setNewRate({ rate: "", effective_from: "", notes: "" });
      setShowAddForm(false);
      loadData();
    } catch (error: any) {
      alert("Error adding exchange rate: " + error.message);
    }
  };

  const deleteExchangeRate = async (rateId: string) => {
    if (!confirm("Are you sure you want to delete this exchange rate?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("exchange_rates")
        .delete()
        .eq("id", rateId);

      if (error) throw error;

      alert("Exchange rate deleted successfully!");
      loadData();
    } catch (error: any) {
      alert("Error deleting exchange rate: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Loading...</p>
      </div>
    );
  }

  if (userRole !== "staff_admin") {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Access denied. Superadmin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">
          Manage system configuration and exchange rates
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Exchange Rates for Profitability Calculations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Configure EUR to PLN exchange rates used for profitability calculations. 
                Orders will use the rate effective at the time they were created.
              </p>
              <Button onClick={() => setShowAddForm(!showAddForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Add New Rate
              </Button>
            </div>

            {showAddForm && (
              <Card className="p-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="rate">Exchange Rate (EUR to PLN)</Label>
                      <Input
                        id="rate"
                        type="number"
                        step="0.0001"
                        value={newRate.rate}
                        onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })}
                        placeholder="4.2000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="effective_from">Effective From</Label>
                      <Input
                        id="effective_from"
                        type="datetime-local"
                        value={newRate.effective_from}
                        onChange={(e) => setNewRate({ ...newRate, effective_from: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={newRate.notes}
                      onChange={(e) => setNewRate({ ...newRate, notes: e.target.value })}
                      placeholder="Reason for rate change..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addExchangeRate}>Add Rate</Button>
                    <Button variant="outline" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rate (EUR → PLN)</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exchangeRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-mono">
                      {rate.rate.toFixed(4)}
                    </TableCell>
                    <TableCell>
                      {formatDate(rate.effective_from)}
                    </TableCell>
                    <TableCell>
                      {rate.effective_to ? formatDate(rate.effective_to) : "Current"}
                    </TableCell>
                    <TableCell>
                      {rate.notes || "-"}
                    </TableCell>
                    <TableCell>
                      {formatDate(rate.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteExchangeRate(rate.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
