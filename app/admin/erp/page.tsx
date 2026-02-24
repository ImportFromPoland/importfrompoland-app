"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { TrendingUp, TrendingDown, DollarSign, Percent, Calendar, List, BarChart3, ExternalLink } from "lucide-react";

const EXCHANGE_RATE = 4.1;

interface ERPOrderRow {
  orderId: string;
  number: string;
  status: string;
  date: string;
  valueNetPLN: number;
  purchaseCostPLN: number;
  deliveryCostPLN: number;
  profitPLN: number;
  profitability: number;
}

interface ERPOrderListSums {
  totalValueNetPLN: number;
  totalPurchaseCostPLN: number;
  totalDeliveryCostPLN: number;
  totalProfitPLN: number;
  profitability: number;
}

interface ERPAnalytics {
  currentMonth: {
    sales: number;
    profit: number;
    profitPLN: number;
    profitability: number;
    basketsValue: number;
    ordersInProgressValue: number;
    toursCount: number;
    toursParticipants: number;
  };
  previousMonth: {
    sales: number;
    profit: number;
    profitPLN: number;
    profitability: number;
    basketsValue: number;
    ordersInProgressValue: number;
    toursCount: number;
    toursParticipants: number;
  };
  ytd: {
    sales: number;
    profit: number;
    profitPLN: number;
    profitability: number;
    basketsValue: number;
    ordersInProgressValue: number;
    toursCount: number;
    toursParticipants: number;
  };
  ordersList: ERPOrderRow[];
  orderListSums: ERPOrderListSums;
}

export default function ERPPage() {
  const [analytics, setAnalytics] = useState<ERPAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const supabase = createClient();

  useEffect(() => {
    loadAnalytics();
  }, [selectedYear, selectedMonth]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const currentMonthStart = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
      const currentMonthEnd = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const prevMonthStart = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`;
      const prevMonthEnd = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0];
      const ytdStart = `${selectedYear}-01-01`;
      const ytdEnd = currentMonthEnd;

      // Pobierz order_totals (widok z grand_total, subtotal_without_vat) - filtruj po dacie
      const { data: allTotals } = await supabase
        .from("order_totals")
        .select("order_id, number, grand_total, subtotal_without_vat, status, submitted_at, created_at")
        .neq("status", "draft")
        .neq("status", "cancelled");

      const relevantStatuses = ["confirmed", "paid", "partially_packed", "packed", "partially_dispatched", "dispatched", "partially_delivered", "delivered"];

      const filterByDateRange = (totals: any[], start: string, end: string) =>
        (totals || []).filter(t => {
          const d = t.submitted_at || t.created_at;
          if (!d) return false;
          const dateStr = typeof d === "string" ? d.split("T")[0] : d;
          return dateStr >= start && dateStr <= end;
        });

      const currentMonthTotals = filterByDateRange(allTotals || [], currentMonthStart, currentMonthEnd)
        .filter(t => relevantStatuses.includes(t.status));
      const previousMonthTotals = filterByDateRange(allTotals || [], prevMonthStart, prevMonthEnd)
        .filter(t => relevantStatuses.includes(t.status));
      const ytdTotals = filterByDateRange(allTotals || [], ytdStart, ytdEnd)
        .filter(t => relevantStatuses.includes(t.status));

      const currentMonthSales = currentMonthTotals.reduce((s, t) => s + (Number(t.grand_total) || 0), 0);
      const previousMonthSales = previousMonthTotals.reduce((s, t) => s + (Number(t.grand_total) || 0), 0);
      const ytdSales = ytdTotals.reduce((s, t) => s + (Number(t.grand_total) || 0), 0);

      const orderIds = [...new Set((allTotals || []).map((t: any) => t.order_id))];
      let ordersWithCosts: any[] = [];
      let supplierOrders: any[] = [];
      if (orderIds.length > 0) {
        const [owc, so] = await Promise.all([
          supabase.from("orders").select("id, transport_cost_pln, logistics_cost").in("id", orderIds),
          supabase.from("supplier_orders").select("order_id, total_cost_pln").in("order_id", orderIds),
        ]);
        ordersWithCosts = owc.data || [];
        supplierOrders = so.data || [];
      }

      const supplierCostPLNByOrder = new Map<string, number>();
      (supplierOrders || []).forEach((so: any) => {
        const curr = supplierCostPLNByOrder.get(so.order_id) || 0;
        supplierCostPLNByOrder.set(so.order_id, curr + (Number(so.total_cost_pln) || 0));
      });
      const costByOrder = new Map<string, number>();
      (ordersWithCosts || []).forEach((o: any) => {
        const supplierPLN = supplierCostPLNByOrder.get(o.id) || 0;
        const transportPLN = Number(o.transport_cost_pln) || 0;
        const logisticsEUR = Number(o.logistics_cost) || 0;
        const totalEUR = (supplierPLN + transportPLN) / EXCHANGE_RATE + logisticsEUR;
        costByOrder.set(o.id, totalEUR);
      });

      const calcProfit = (totals: any[]) =>
        totals.reduce((s, t) => {
          const rev = Number(t.grand_total) || 0;
          const cost = costByOrder.get(t.order_id) ?? (rev * 0.8);
          return s + (rev - cost);
        }, 0);

      const currentMonthProfit = calcProfit(currentMonthTotals);
      const previousMonthProfit = calcProfit(previousMonthTotals);
      const ytdProfit = calcProfit(ytdTotals);

      const currentMonthProfitPLN = currentMonthProfit * EXCHANGE_RATE;
      const previousMonthProfitPLN = previousMonthProfit * EXCHANGE_RATE;
      const ytdProfitPLN = ytdProfit * EXCHANGE_RATE;

      const currentMonthProfitability = currentMonthSales > 0 ? (currentMonthProfit / currentMonthSales) * 100 : 0;
      const previousMonthProfitability = previousMonthSales > 0 ? (previousMonthProfit / previousMonthSales) * 100 : 0;
      const ytdProfitability = ytdSales > 0 ? (ytdProfit / ytdSales) * 100 : 0;

      // Lista zamówień z rentownością (PLN, kurs 4.1)
      const transportByOrder = new Map<string, number>();
      const logisticsByOrder = new Map<string, number>();
      (ordersWithCosts || []).forEach((o: any) => {
        transportByOrder.set(o.id, Number(o.transport_cost_pln) || 0);
        logisticsByOrder.set(o.id, Number(o.logistics_cost) || 0);
      });
      const ordersList: ERPOrderRow[] = currentMonthTotals.map((t: any) => {
        const valueNetEUR = Number(t.subtotal_without_vat) || 0;
        const valueNetPLN = valueNetEUR * EXCHANGE_RATE;
        const purchaseCostPLN = supplierCostPLNByOrder.get(t.order_id) || 0;
        const deliveryCostPLN = transportByOrder.get(t.order_id) || 0;
        const logisticsPLN = (logisticsByOrder.get(t.order_id) || 0) * EXCHANGE_RATE;
        const totalCostPLN = purchaseCostPLN + deliveryCostPLN + logisticsPLN;
        const profitPLN = valueNetPLN - totalCostPLN;
        const profitability = valueNetPLN > 0 ? (profitPLN / valueNetPLN) * 100 : 0;
        const d = t.submitted_at || t.created_at;
        const dateStr = d ? (typeof d === "string" ? d.split("T")[0] : d) : "-";
        return {
          orderId: t.order_id,
          number: t.number || String(t.order_id),
          status: t.status,
          date: dateStr,
          valueNetPLN,
          purchaseCostPLN,
          deliveryCostPLN,
          profitPLN,
          profitability,
        };
      });
      const orderListSums: ERPOrderListSums = ordersList.reduce(
        (acc, r) => ({
          totalValueNetPLN: acc.totalValueNetPLN + r.valueNetPLN,
          totalPurchaseCostPLN: acc.totalPurchaseCostPLN + r.purchaseCostPLN,
          totalDeliveryCostPLN: acc.totalDeliveryCostPLN + r.deliveryCostPLN,
          totalProfitPLN: acc.totalProfitPLN + r.profitPLN,
          profitability: 0,
        }),
        { totalValueNetPLN: 0, totalPurchaseCostPLN: 0, totalDeliveryCostPLN: 0, totalProfitPLN: 0, profitability: 0 }
      );
      orderListSums.profitability =
        orderListSums.totalValueNetPLN > 0
          ? (orderListSums.totalProfitPLN / orderListSums.totalValueNetPLN) * 100
          : 0;

      // Koszyki (draft) - suma grand_total z order_totals
      const { data: draftTotals } = await supabase
        .from("order_totals")
        .select("order_id, grand_total, created_at")
        .eq("status", "draft")
        .gte("created_at", currentMonthStart)
        .lte("created_at", currentMonthEnd + "T23:59:59");
      const currentMonthBasketsValue = (draftTotals || []).reduce((s, t) => s + (Number(t.grand_total) || 0), 0);

      // Zamówienia w trakcie (submitted..packed)
      const inProgressStatuses = ["submitted", "in_review", "confirmed", "paid", "partially_packed", "packed"];
      const currentMonthOrdersInProgressTotals = filterByDateRange(allTotals || [], currentMonthStart, currentMonthEnd)
        .filter((t: any) => inProgressStatuses.includes(t.status));
      const currentMonthOrdersInProgressValue = currentMonthOrdersInProgressTotals.reduce(
        (s, t) => s + (Number(t.grand_total) || 0),
        0
      );

      // Tours (opcjonalnie - tabela może nie istnieć)
      let currentMonthToursCount = 0;
      let currentMonthToursParticipants = 0;
      try {
        const { data: allTours } = await supabase
          .from("tour_bookings")
          .select("id, tour_id, attendee1_name, attendee2_name")
          .eq("status", "confirmed");
        const tourIds = [...new Set((allTours || []).map((b: any) => b.tour_id).filter(Boolean))];
        const { data: toursData } = tourIds.length
          ? await supabase.from("tours").select("id, start_date").in("id", tourIds)
          : { data: [] };
        const today = new Date().toISOString().split("T")[0];
        const bookingsWithTours = (allTours || []).map((b: any) => ({
          ...b,
          tour: (toursData || []).find((t: any) => t.id === b.tour_id),
        }));
        const currentMonthTours = bookingsWithTours.filter((b: any) => {
          const d = b.tour?.start_date;
          return d && d >= today;
        });
        currentMonthToursCount = currentMonthTours.length;
        currentMonthToursParticipants = currentMonthTours.reduce(
          (s: number, b: any) => s + (b.attendee1_name ? 1 : 0) + (b.attendee2_name ? 1 : 0),
          0
        );
      } catch {
        // Ignore - tour_bookings może nie istnieć
      }

      setAnalytics({
        currentMonth: {
          sales: currentMonthSales,
          profit: currentMonthProfit,
          profitPLN: currentMonthProfitPLN,
          profitability: currentMonthProfitability,
          basketsValue: currentMonthBasketsValue,
          ordersInProgressValue: currentMonthOrdersInProgressValue,
          toursCount: currentMonthToursCount,
          toursParticipants: currentMonthToursParticipants
        },
        previousMonth: {
          sales: previousMonthSales,
          profit: previousMonthProfit,
          profitPLN: previousMonthProfitPLN,
          profitability: previousMonthProfitability,
          basketsValue: 0, // TODO: Add previous month calculations
          ordersInProgressValue: 0, // TODO: Add previous month calculations
          toursCount: 0, // TODO: Add previous month calculations
          toursParticipants: 0 // TODO: Add previous month calculations
        },
        ytd: {
          sales: ytdSales,
          profit: ytdProfit,
          profitPLN: ytdProfitPLN,
          profitability: ytdProfitability,
          basketsValue: 0, // TODO: Add YTD calculations
          ordersInProgressValue: 0, // TODO: Add YTD calculations
          toursCount: 0, // TODO: Add YTD calculations
          toursParticipants: 0 // TODO: Add YTD calculations
        },
        ordersList,
        orderListSums
      });

    } catch (error) {
      console.error("Error loading ERP analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number) => {
    const months = [
      "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
      "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
    ];
    return months[month - 1];
  };

  const getSalesChange = () => {
    if (!analytics) return 0;
    if (analytics.previousMonth.sales === 0) return 100;
    return ((analytics.currentMonth.sales - analytics.previousMonth.sales) / analytics.previousMonth.sales) * 100;
  };

  const getProfitChange = () => {
    if (!analytics) return 0;
    if (analytics.previousMonth.profit === 0) return 100;
    return ((analytics.currentMonth.profit - analytics.previousMonth.profit) / analytics.previousMonth.profit) * 100;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">ERP</h1>
          <p className="text-muted-foreground">Analiza sprzedaży i rentowności</p>
        </div>
        <div className="flex gap-4">
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <SelectItem key={month} value={month.toString()}>{getMonthName(month)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {analytics && (
      <Tabs defaultValue="global" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="global" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Globalne analizy
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Lista zamówień ({analytics.ordersList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Sprzedaż */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sprzedaż</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(analytics.currentMonth.sales, "EUR")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getMonthName(selectedMonth)} {selectedYear}
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  {getSalesChange() >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <span className={getSalesChange() >= 0 ? "text-green-600" : "text-red-600"}>
                    {Math.abs(getSalesChange()).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">vs poprzedni miesiąc</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Poprzedni miesiąc:</span>
                    <span>{formatCurrency(analytics.previousMonth.sales, "EUR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">YTD:</span>
                    <span>{formatCurrency(analytics.ytd.sales, "EUR")}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Zysk Netto EUR */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Zysk Netto (EUR)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(analytics.currentMonth.profit, "EUR")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getMonthName(selectedMonth)} {selectedYear}
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  {getProfitChange() >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <span className={getProfitChange() >= 0 ? "text-green-600" : "text-red-600"}>
                    {Math.abs(getProfitChange()).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">vs poprzedni miesiąc</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Poprzedni miesiąc:</span>
                    <span>{formatCurrency(analytics.previousMonth.profit, "EUR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">YTD:</span>
                    <span>{formatCurrency(analytics.ytd.profit, "EUR")}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Zysk Netto PLN */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Zysk Netto (PLN)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">
                    {analytics.currentMonth.profitPLN.toFixed(2)} zł
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getMonthName(selectedMonth)} {selectedYear}
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Poprzedni miesiąc:</span>
                    <span>{analytics.previousMonth.profitPLN.toFixed(2)} zł</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">YTD:</span>
                    <span>{analytics.ytd.profitPLN.toFixed(2)} zł</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kurs wymiany:</span>
                    <span>1 EUR = {EXCHANGE_RATE} PLN</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rentowność */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rentowność</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">
                    {analytics.currentMonth.profitability.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getMonthName(selectedMonth)} {selectedYear}
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Poprzedni miesiąc:</span>
                    <span>{analytics.previousMonth.profitability.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">YTD:</span>
                    <span>{analytics.ytd.profitability.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Koszyki */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Koszyki</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(analytics.currentMonth.basketsValue, "EUR")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getMonthName(selectedMonth)} {selectedYear}
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Poprzedni miesiąc:</span>
                    <span>{formatCurrency(analytics.previousMonth.basketsValue, "EUR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">YTD:</span>
                    <span>{formatCurrency(analytics.ytd.basketsValue, "EUR")}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Zamówienia w trakcie */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Zamówienia w trakcie</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(analytics.currentMonth.ordersInProgressValue, "EUR")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getMonthName(selectedMonth)} {selectedYear}
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Poprzedni miesiąc:</span>
                    <span>{formatCurrency(analytics.previousMonth.ordersInProgressValue, "EUR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">YTD:</span>
                    <span>{formatCurrency(analytics.ytd.ordersInProgressValue, "EUR")}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Wycieczki */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wycieczki</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">
                    {analytics.currentMonth.toursCount}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.currentMonth.toursParticipants} osób
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Poprzedni miesiąc:</span>
                    <span>{analytics.previousMonth.toursCount} ({analytics.previousMonth.toursParticipants})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">YTD:</span>
                    <span>{analytics.ytd.toursCount} ({analytics.ytd.toursParticipants})</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Podsumowanie zamówień (PLN) - sumy z listy zamówień */}
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Podsumowanie zamówień ({getMonthName(selectedMonth)} {selectedYear}) - PLN</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block">Wartość netto</span>
                  <span className="font-semibold">{analytics.orderListSums.totalValueNetPLN.toFixed(2)} zł</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Koszt zakupu</span>
                  <span className="font-semibold">{analytics.orderListSums.totalPurchaseCostPLN.toFixed(2)} zł</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Koszt dostawy</span>
                  <span className="font-semibold">{analytics.orderListSums.totalDeliveryCostPLN.toFixed(2)} zł</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Zysk netto</span>
                  <span className={`font-semibold ${analytics.orderListSums.totalProfitPLN >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {analytics.orderListSums.totalProfitPLN.toFixed(2)} zł
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Rentowność</span>
                  <span className={`font-semibold ${analytics.orderListSums.profitability >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {analytics.orderListSums.profitability.toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista zamówień - {getMonthName(selectedMonth)} {selectedYear}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Wartości netto w PLN (kurs 1 EUR = {EXCHANGE_RATE} zł). Koszt dostawy można dodać w szczegółach zamówienia.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nr</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Wartość netto (PLN)</TableHead>
                      <TableHead className="text-right">Koszt zakupu (PLN)</TableHead>
                      <TableHead className="text-right">Koszt dostawy (PLN)</TableHead>
                      <TableHead className="text-right">Zysk (PLN)</TableHead>
                      <TableHead className="text-right">Rentowność</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.ordersList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Brak zamówień w wybranym okresie
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {analytics.ordersList.map((row) => (
                          <TableRow key={row.orderId}>
                            <TableCell className="font-medium">{row.number}</TableCell>
                            <TableCell>{row.date}</TableCell>
                            <TableCell><StatusBadge status={row.status} /></TableCell>
                            <TableCell className="text-right">{row.valueNetPLN.toFixed(2)} zł</TableCell>
                            <TableCell className="text-right">{row.purchaseCostPLN.toFixed(2)} zł</TableCell>
                            <TableCell className="text-right">{row.deliveryCostPLN.toFixed(2)} zł</TableCell>
                            <TableCell className={`text-right font-medium ${row.profitPLN >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {row.profitPLN.toFixed(2)} zł
                            </TableCell>
                            <TableCell className={`text-right font-medium ${row.profitability >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {row.profitability.toFixed(1)}%
                            </TableCell>
                            <TableCell>
                              <Link href={`/admin/orders/${row.orderId}`} className="text-primary hover:underline inline-flex items-center gap-1 text-sm">
                                <ExternalLink className="h-3 w-3" />
                                Szczegóły
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell colSpan={3}>Suma</TableCell>
                          <TableCell className="text-right">{analytics.orderListSums.totalValueNetPLN.toFixed(2)} zł</TableCell>
                          <TableCell className="text-right">{analytics.orderListSums.totalPurchaseCostPLN.toFixed(2)} zł</TableCell>
                          <TableCell className="text-right">{analytics.orderListSums.totalDeliveryCostPLN.toFixed(2)} zł</TableCell>
                          <TableCell className={`text-right ${analytics.orderListSums.totalProfitPLN >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {analytics.orderListSums.totalProfitPLN.toFixed(2)} zł
                          </TableCell>
                          <TableCell className={`text-right ${analytics.orderListSums.profitability >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {analytics.orderListSums.profitability.toFixed(1)}%
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
