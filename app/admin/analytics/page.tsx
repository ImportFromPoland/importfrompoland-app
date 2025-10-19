"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BarChart3, TrendingUp, Package, Users, Clock } from "lucide-react";

export default function AnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    sales: {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      ordersByStatus: {} as Record<string, number>
    },
    purchases: {
      totalSupplierOrders: 0,
      totalCosts: 0,
      averageOrderCost: 0,
      ordersBySupplier: {} as Record<string, number>
    },
    performance: {
      averageFulfillmentTime: 0,
      ordersDeliveredOnTime: 0,
      totalOrdersDelivered: 0
    }
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

  const getDateRange = () => {
    if (selectedPeriod === "month") {
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split('T')[0];
      return { startDate, endDate };
    } else if (selectedPeriod === "custom") {
      return { startDate: customStartDate, endDate: customEndDate };
    }
    return { startDate: "", endDate: "" };
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      
      if (!startDate || !endDate) {
        setLoading(false);
        return;
      }

      // Load sales data
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

      // Load purchase data
      const { data: supplierOrders } = await supabase
        .from("supplier_orders")
        .select(`
          id,
          created_at,
          supplier_name,
          total_cost_pln,
          status
        `)
        .gte("created_at", startDate)
        .lt("created_at", endDate);

      // Calculate sales metrics
      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + (order.totals?.[0]?.grand_total || 0), 0) || 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Count orders by status
      const ordersByStatus = orders?.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Calculate purchase metrics
      const totalSupplierOrders = supplierOrders?.length || 0;
      const totalCostsPLN = supplierOrders?.reduce((sum, order) => sum + (order.total_cost_pln || 0), 0) || 0;
      const totalCosts = totalCostsPLN / 4.2; // Convert to EUR using profitability rate
      const averageOrderCost = totalSupplierOrders > 0 ? totalCosts / totalSupplierOrders : 0;

      // Count orders by supplier
      const ordersBySupplier = supplierOrders?.reduce((acc, order) => {
        acc[order.supplier_name] = (acc[order.supplier_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Calculate performance metrics (simplified)
      const deliveredOrders = orders?.filter(order => order.status === "delivered") || [];
      const averageFulfillmentTime = 0; // This would need more complex calculation
      const ordersDeliveredOnTime = deliveredOrders.length; // Simplified
      const totalOrdersDelivered = deliveredOrders.length;

      setData({
        sales: {
          totalOrders,
          totalRevenue,
          averageOrderValue,
          ordersByStatus
        },
        purchases: {
          totalSupplierOrders,
          totalCosts,
          averageOrderCost,
          ordersBySupplier
        },
        performance: {
          averageFulfillmentTime,
          ordersDeliveredOnTime,
          totalOrdersDelivered
        }
      });

    } catch (error) {
      console.error("Error loading analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod, selectedMonth, customStartDate, customEndDate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Global sales, purchases, and performance analytics
        </p>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Analysis Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="period">Period:</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedPeriod === "month" && (
              <div className="flex items-center gap-2">
                <Label htmlFor="month">Month:</Label>
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
              </div>
            )}

            {selectedPeriod === "custom" && (
              <>
                <div className="flex items-center gap-2">
                  <Label htmlFor="startDate">From:</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="endDate">To:</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </>
            )}

            <Button onClick={loadAnalytics} disabled={loading}>
              {loading ? "Loading..." : "Refresh Data"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sales Analytics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Łączne Zamówienia</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.sales.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              Zamówienia w wybranym okresie
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Łączny Przychód</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.sales.totalRevenue, "EUR")}
            </div>
            <p className="text-xs text-muted-foreground">
              Przychód z zamówień
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.sales.averageOrderValue, "EUR")}
            </div>
            <p className="text-xs text-muted-foreground">
              Average per order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zamówienia u Dostawców</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.purchases.totalSupplierOrders}</div>
            <p className="text-xs text-muted-foreground">
              Zamówienia u dostawców
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Zamówienia według Statusu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.sales.ordersByStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between">
                  <span className="capitalize">{status.replace('_', ' ')}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zamówienia według Dostawcy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.purchases.ordersBySupplier).map(([supplier, count]) => (
                <div key={supplier} className="flex justify-between">
                  <span className="truncate">{supplier}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Metryki Wydajności</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.performance.averageFulfillmentTime}</div>
              <p className="text-sm text-muted-foreground">Średni Czas Realizacji (dni)</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{data.performance.ordersDeliveredOnTime}</div>
              <p className="text-sm text-muted-foreground">Zamówienia Dostarczone na Czas</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {data.performance.totalOrdersDelivered > 0 
                  ? ((data.performance.ordersDeliveredOnTime / data.performance.totalOrdersDelivered) * 100).toFixed(1)
                  : 0}%
              </div>
              <p className="text-sm text-muted-foreground">On-Time Delivery Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
