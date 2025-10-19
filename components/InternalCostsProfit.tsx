"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

interface InternalCostsProfitProps {
  isSuperAdmin: boolean;
}

export default function InternalCostsProfit({ isSuperAdmin }: InternalCostsProfitProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    totalRevenue: 0,
    totalCosts: 0,
    netProfit: 0,
    profitMargin: 0
  });

  const supabase = createClient();

  // Generate month options for the last 12 months
  const getMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    
    return options;
  };

  const loadData = async () => {
    if (!isSuperAdmin) return;
    
    setLoading(true);
    try {
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split('T')[0];

      // Get orders from the selected month
      const { data: orders } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          status,
          totals:order_totals(grand_total, subtotal_without_vat, vat_amount)
        `)
        .gte("created_at", startDate)
        .lt("created_at", endDate)
        .neq("status", "draft")
        .neq("status", "cancelled");

      // Get supplier orders from the selected month
      const { data: supplierOrders } = await supabase
        .from("supplier_orders")
        .select("total_cost_pln, created_at")
        .gte("created_at", startDate)
        .lt("created_at", endDate);

      // Calculate revenue (from confirmed orders)
      const confirmedOrders = orders?.filter(order => 
        ["confirmed", "paid", "partially_packed", "packed", "partially_dispatched", "dispatched", "partially_delivered", "delivered"].includes(order.status)
      ) || [];

      const totalRevenue = confirmedOrders.reduce((sum, order) => {
        return sum + (order.totals?.grand_total || 0);
      }, 0);

      // Calculate costs (from supplier orders)
      const totalCostsPLN = supplierOrders?.reduce((sum, order) => {
        return sum + (order.total_cost_pln || 0);
      }, 0) || 0;

      // Convert PLN to EUR using exchange rate for the month
      // For now, use 4.2 as the profitability rate (this should be fetched from exchange_rates table)
      const exchangeRate = 4.2; // TODO: Fetch from exchange_rates table based on order date
      const totalCosts = totalCostsPLN / exchangeRate;

      const netProfit = totalRevenue - totalCosts;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      setData({
        totalRevenue,
        totalCosts,
        netProfit,
        profitMargin
      });

    } catch (error) {
      console.error("Error loading costs and profit data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, isSuperAdmin]);

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Internal Costs & Profit</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Revenue:</span>
            <span className="font-medium text-green-600">
              {formatCurrency(data.totalRevenue, "EUR")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Costs:</span>
            <span className="font-medium text-red-600">
              {formatCurrency(data.totalCosts, "EUR")}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="text-gray-600">Net Profit:</span>
            <span className={`font-medium ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.netProfit, "EUR")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Profit Margin:</span>
            <span className={`font-medium ${data.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.profitMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
