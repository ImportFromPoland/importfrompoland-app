"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, Percent, Calendar } from "lucide-react";

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
      // Get current month data
      const currentMonthStart = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
      const currentMonthEnd = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      
      console.log("Current month range:", currentMonthStart, "to", currentMonthEnd);
      
      // Get previous month data
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const prevMonthStart = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`;
      const prevMonthEnd = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0];
      
      // Get YTD data
      const ytdStart = `${selectedYear}-01-01`;
      const ytdEnd = currentMonthEnd;

      // First, let's check what orders exist and their timestamps from orders table
      const { data: allOrders } = await supabase
        .from("orders")
        .select("status, created_at, submitted_at, confirmed_at")
        .limit(10);
      
      console.log("Sample orders from orders table:", allOrders);
      
      // Check what statuses actually exist
      const { data: statusCounts } = await supabase
        .from("orders")
        .select("status")
        .neq("status", "draft");
        
      const statuses = statusCounts?.map(o => o.status) || [];
      const uniqueStatuses = Array.from(new Set(statuses));
      console.log("Unique statuses in database:", uniqueStatuses);

      // Try using orders table directly - get all orders first
      const { data: allCurrentMonthOrders } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          created_at,
          submitted_at,
          confirmed_at,
          vat_rate,
          shipping_cost
        `)
        .neq("status", "draft");
        
      console.log("All current month orders:", allCurrentMonthOrders);
      
      // Filter by date range and status manually
      const currentMonthOrders = allCurrentMonthOrders?.filter(order => {
        const orderDate = order.submitted_at || order.created_at;
        const isInDateRange = orderDate >= currentMonthStart && orderDate <= currentMonthEnd;
        const isRelevantStatus = ["confirmed", "paid", "partially_packed", "packed", "partially_dispatched", "dispatched", "delivered"].includes(order.status);
        return isInDateRange && isRelevantStatus;
      }) || [];


      // Get current exchange rate (default 4.2)
      const exchangeRate = 4.2; // TODO: Fetch from exchange_rates table

      // Calculate sales - for now just count orders and estimate
      const currentMonthSales = (currentMonthOrders?.length || 0) * 100; // Placeholder calculation
      
      // Calculate previous month and YTD from the same data
      const previousMonthOrders = allCurrentMonthOrders?.filter(order => {
        const orderDate = order.submitted_at || order.created_at;
        const isInDateRange = orderDate >= prevMonthStart && orderDate <= prevMonthEnd;
        const isRelevantStatus = ["confirmed", "paid", "partially_packed", "packed", "partially_dispatched", "dispatched", "delivered"].includes(order.status);
        return isInDateRange && isRelevantStatus;
      }) || [];
      
      const ytdOrders = allCurrentMonthOrders?.filter(order => {
        const orderDate = order.submitted_at || order.created_at;
        const isInDateRange = orderDate >= ytdStart && orderDate <= ytdEnd;
        const isRelevantStatus = ["confirmed", "paid", "partially_packed", "packed", "partially_dispatched", "dispatched", "delivered"].includes(order.status);
        return isInDateRange && isRelevantStatus;
      }) || [];
      
      const previousMonthSales = (previousMonthOrders?.length || 0) * 100;
      const ytdSales = (ytdOrders?.length || 0) * 100;

      // For now, we'll estimate profit as 20% of sales (this should be replaced with actual cost data)
      const currentMonthProfit = currentMonthSales * 0.2;
      const previousMonthProfit = previousMonthSales * 0.2;
      const ytdProfit = ytdSales * 0.2;

      // Calculate profit in PLN
      const currentMonthProfitPLN = currentMonthProfit * exchangeRate;
      const previousMonthProfitPLN = previousMonthProfit * exchangeRate;
      const ytdProfitPLN = ytdProfit * exchangeRate;

      // Calculate profitability
      const currentMonthProfitability = currentMonthSales > 0 ? (currentMonthProfit / currentMonthSales) * 100 : 0;
      const previousMonthProfitability = previousMonthSales > 0 ? (previousMonthProfit / previousMonthSales) * 100 : 0;
      const ytdProfitability = ytdSales > 0 ? (ytdProfit / ytdSales) * 100 : 0;

      // Fetch baskets (draft orders) for current month - use created_at for drafts
      const { data: currentMonthBaskets } = await supabase
        .from("orders")
        .select("id, status, created_at")
        .gte("created_at", currentMonthStart)
        .lte("created_at", currentMonthEnd)
        .eq("status", "draft");
        
      console.log("Current month baskets:", currentMonthBaskets);

      // Fetch orders in progress (submitted to packed) for current month
      const { data: allOrdersInProgress } = await supabase
        .from("orders")
        .select("id, status, created_at, submitted_at, confirmed_at")
        .neq("status", "draft");
        
      // Filter by date range and status manually
      const currentMonthOrdersInProgress = allOrdersInProgress?.filter(order => {
        const orderDate = order.submitted_at || order.created_at;
        const isInDateRange = orderDate >= currentMonthStart && orderDate <= currentMonthEnd;
        const isRelevantStatus = ["submitted", "confirmed", "paid", "partially_packed", "packed"].includes(order.status);
        return isInDateRange && isRelevantStatus;
      }) || [];
        
      console.log("Current month orders in progress:", currentMonthOrdersInProgress);

      // First check what statuses exist
      const { data: allBookings } = await supabase
        .from("tour_bookings")
        .select("id, status");
        
      console.log("All bookings statuses:", allBookings?.map(b => b.status));
      
      // First, let's check what fields exist in tour_bookings
      const { data: sampleBooking } = await supabase
        .from("tour_bookings")
        .select("*")
        .limit(1);
        
      console.log("Sample booking fields:", sampleBooking?.[0]);
      
      // Fetch tours with confirmed bookings - get all first, then filter
      const { data: allTours } = await supabase
        .from("tour_bookings")
        .select(`
          id,
          status,
          tour_id,
          attendee1_name,
          attendee2_name
        `)
        .eq("status", "confirmed");
        
      console.log("All tours from database:", allTours);
      console.log("Sample tour booking:", allTours?.[0]);
      
      // Get tour details separately - check what field name is used for tour reference
      const tourField = sampleBooking?.[0]?.tour_id ? 'tour_id' : 
                       sampleBooking?.[0]?.tour ? 'tour' : 
                       Object.keys(sampleBooking?.[0] || {}).find(key => key.includes('tour')) || 'tour_id';
      
      console.log("Tour field name:", tourField);
      
      const tourIds = allTours?.map(booking => (booking as any)[tourField]).filter(Boolean) || [];
      console.log("Tour IDs:", tourIds);
      
      const { data: toursData } = await supabase
        .from("tours")
        .select("id, title, start_date, end_date")
        .in("id", tourIds);
        
      console.log("Tours data:", toursData);
      
      // Combine bookings with tour data
      const bookingsWithTours = allTours?.map(booking => ({
        ...booking,
        tour: toursData?.find(tour => tour.id === (booking as any)[tourField])
      })) || [];
      
      console.log("Bookings with tours:", bookingsWithTours);
        
      // Filter by tour start date - show all upcoming tours (not just current month)
      const today = new Date().toISOString().split('T')[0];
      const currentMonthTours = bookingsWithTours.filter(booking => {
        const tourStartDate = booking.tour?.start_date;
        if (!tourStartDate) {
          console.log(`Tour booking ${booking.id} has no start_date`);
          return false;
        }
        const isUpcoming = tourStartDate >= today;
        console.log(`Tour: ${booking.tour?.title || 'Unknown'}, Start: ${tourStartDate}, Today: ${today}, Upcoming: ${isUpcoming}`);
        return isUpcoming; // Show all upcoming tours
      });
      
      console.log("Current month tours after filtering:", currentMonthTours);

      // Calculate tours data
      const currentMonthToursCount = currentMonthTours?.length || 0;
      const currentMonthToursParticipants = currentMonthTours?.reduce((sum, booking) => {
        let count = 0;
        if (booking.attendee1_name) count++;
        if (booking.attendee2_name) count++;
        return sum + count;
      }, 0) || 0;

      console.log("Current month tours count:", currentMonthToursCount);
      console.log("Current month tours participants:", currentMonthToursParticipants);

      // Calculate baskets value - placeholder calculation
      const currentMonthBasketsValue = (currentMonthBaskets?.length || 0) * 50; // Placeholder

      // Calculate orders in progress value - placeholder calculation
      const currentMonthOrdersInProgressValue = (currentMonthOrdersInProgress?.length || 0) * 75; // Placeholder

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
        }
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
          <h1 className="text-3xl font-bold">ERP - Globalne Analizy</h1>
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
                    <span>1 EUR = 4.2 PLN</span>
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
        </div>
      )}
    </div>
  );
}
