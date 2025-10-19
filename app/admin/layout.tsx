import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Package, Users, Warehouse, FileText, Settings, ShoppingCart, MapPin, BarChart3, TrendingUp } from "lucide-react";
import InternalCostsProfit from "@/components/InternalCostsProfit";
import ClientInfoCard from "@/components/ClientInfoCard";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile with role
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, company:companies(*)")
    .eq("id", user.id)
    .single();

  // Check if user has admin access
  if (!profile || !["admin", "staff_admin"].includes(profile.role)) {
    redirect("/");
  }

  const isStaffAdmin = profile.role === "staff_admin";

  // Get counts for notifications
  // Get order counts - use submitted_at for submitted orders
  const { count: submittedOrdersCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted");

  const { count: pendingToursCount } = await supabase
    .from("tour_bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  // Get confirmed tours participants count - only upcoming tours
  const { data: confirmedToursData } = await supabase
    .from("tour_bookings")
    .select(`
      id,
      tour_id,
      attendee1_name, 
      attendee2_name
    `)
    .eq("status", "confirmed");

  // Get order summary data
  const { data: orderSummary } = await supabase
    .from("orders")
    .select("status")
    .neq("status", "draft")
    .neq("status", "delivered")
    .neq("status", "cancelled");

  // Debug: Check what statuses actually exist
  const { data: allStatuses } = await supabase
    .from("orders")
    .select("status")
    .neq("status", "draft");
    
  console.log("All order statuses in database:", allStatuses?.map(o => o.status));

  const { count: pendingOrdersCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted");

  const { count: inProgressOrdersCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "packed");

  const { count: inDeliveryOrdersCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", ["dispatched", "delivered"]);

  // Debug: Check individual status counts
  console.log("Submitted orders count:", submittedOrdersCount);
  console.log("In progress orders count:", inProgressOrdersCount);
  console.log("In delivery orders count:", inDeliveryOrdersCount);
  
  // Debug: Check specific statuses
  const { data: confirmedOrders } = await supabase
    .from("orders")
    .select("id, status, created_at, submitted_at, confirmed_at")
    .eq("status", "confirmed");
    
  const { data: paidOrders } = await supabase
    .from("orders")
    .select("id, status, created_at, submitted_at, confirmed_at")
    .eq("status", "paid");
    
  const { data: packedOrders } = await supabase
    .from("orders")
    .select("id, status, created_at, submitted_at, confirmed_at")
    .eq("status", "packed");
    
  const { data: dispatchedOrders } = await supabase
    .from("orders")
    .select("id, status, created_at, submitted_at, confirmed_at")
    .eq("status", "dispatched");
    
  console.log("Confirmed orders:", confirmedOrders);
  console.log("Paid orders:", paidOrders);
  console.log("Packed orders:", packedOrders);
  console.log("Dispatched orders:", dispatchedOrders);
  console.log("=== DEBUGGING CLIENT COUNTS ===");

  // Get client information - count profiles with role "client"
  // First try without any filters to see if we can access profiles at all
  const { data: allProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, role, created_at")
    .limit(10);

  console.log("All profiles (first 10):", allProfiles, "Error:", profilesError);

  const { count: totalClientsCount, error: clientsError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "client");

  console.log("Total clients count:", totalClientsCount, "Error:", clientsError);

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
  console.log("Current month filter:", `${currentMonth}-01 to ${currentMonth}-32`);
  
  // First, let's see all clients and their creation dates
  const { data: allClients, error: allClientsError } = await supabase
    .from("profiles")
    .select("id, created_at, role")
    .eq("role", "client")
    .order("created_at", { ascending: false });

  console.log("All clients with dates:", allClients, "Error:", allClientsError);

  const { count: newClientsThisMonth, error: newClientsError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "client")
    .gte("created_at", `${currentMonth}-01`)
    .lt("created_at", `${currentMonth}-32`);

  console.log("New clients this month:", newClientsThisMonth, "Error:", newClientsError);
  console.log("=== END CLIENT COUNTS DEBUG ===");

  // Get tour details separately
  const tourIds = confirmedToursData?.map(booking => booking.tour_id).filter(Boolean) || [];
  const { data: toursData } = await supabase
    .from("tours")
    .select("id, start_date")
    .in("id", tourIds);

  // Combine bookings with tour data
  const bookingsWithTours = confirmedToursData?.map(booking => ({
    ...booking,
    tour: toursData?.find(tour => tour.id === booking.tour_id)
  })) || [];

  // Filter tours to only upcoming ones (start_date >= today)
  const today = new Date().toISOString().split('T')[0];
  const upcomingTours = bookingsWithTours.filter(booking => {
    const tourStartDate = booking.tour?.start_date;
    return tourStartDate && tourStartDate >= today;
  });

  // Calculate confirmed tours participants count - only upcoming tours
  const confirmedToursParticipants = upcomingTours.reduce((sum, booking) => {
    let count = 0;
    if (booking.attendee1_name) count++;
    if (booking.attendee2_name) count++;
    return sum + count;
  }, 0);

  // Count upcoming tours
  const upcomingToursCount = upcomingTours.length;

  const navigation = [
    { 
      name: "Zamówienia", 
      href: "/admin/orders", 
      icon: Package, 
      count: submittedOrdersCount || 0 
    },
    { name: "Zaopatrzenie", href: "/admin/zaopatrzenie", icon: ShoppingCart },
    { 
      name: "Wycieczki", 
      href: "/admin/tours", 
      icon: MapPin, 
      count: pendingToursCount || 0 
    },
    { name: "ERP", href: "/admin/erp", icon: TrendingUp },
    { name: "Magazyn", href: "/admin/warehouse", icon: Warehouse },
    ...(isStaffAdmin ? [{ name: "Użytkownicy", href: "/admin/users", icon: Users }] : []),
    // Settings - only for super admin
    ...(isStaffAdmin ? [{ name: "Ustawienia", href: "/admin/settings", icon: Settings }] : []),
    // Analytics - only for super admin
    ...(profile.role === "admin" ? [{ name: "Analiza", href: "/admin/analytics", icon: BarChart3 }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Logo width={180} height={70} linkToDashboard={false} />
              <div className="border-l pl-6">
                <h2 className="text-lg font-semibold text-primary">Panel Administratora</h2>
                <p className="text-xs text-muted-foreground">
                  {isStaffAdmin ? "Superadministrator" : "Administrator"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {profile.full_name || user.email}
              </span>
              <Link href="/">
                <Button variant="outline" size="sm">
                  Widok Klienta
                </Button>
              </Link>
              <form action="/api/auth/signout" method="post">
                <Button variant="outline" size="sm">
                  Wyloguj
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Side Navigation + Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar */}
          <aside className="w-80 flex-shrink-0">
            <div className="space-y-4">
              {/* Navigation Menu */}
              <nav className="space-y-1 bg-white rounded-lg border p-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.name} href={item.href}>
                      <div className="flex items-center justify-between px-4 py-3 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          {item.name}
                        </div>
                        {(item.count || 0) > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                            {item.count}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </nav>

              {/* Order Summary Card */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-sm text-gray-900 mb-3">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Orders:</span>
                    <span className="font-medium">{orderSummary?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pending:</span>
                    <span className="font-medium text-orange-600">{submittedOrdersCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">In Progress:</span>
                    <span className="font-medium text-blue-600">{inProgressOrdersCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">In Delivery:</span>
                    <span className="font-medium text-purple-600">{inDeliveryOrdersCount || 0}</span>
                  </div>
                </div>
              </div>

              {/* Tours Card */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-sm text-gray-900 mb-3">Wycieczki</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nadchodzące:</span>
                    <span className="font-medium text-green-600">{upcomingToursCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Osoby zapisane:</span>
                    <span className="font-medium text-blue-600">{confirmedToursParticipants}</span>
                  </div>
                </div>
              </div>

              {/* Internal Costs & Profit Card - Only for Super Admin */}
              <InternalCostsProfit isSuperAdmin={profile.role === "admin"} />

              {/* Client Info Card */}
              <ClientInfoCard />
            </div>
          </aside>

          {/* Main Content - Now Wider */}
          <main className="flex-1 min-w-0 max-w-none">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

