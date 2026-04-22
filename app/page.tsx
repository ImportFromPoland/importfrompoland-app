import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, MapPin, ShoppingCart, Calendar } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientTabsFixed from "@/components/ClientTabsFixed";

export default async function DashboardPage() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile with role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*, company:companies(*)")
    .eq("id", user.id)
    .single();

  // Keep onboarding minimal: only require the user's name.
  // Company/address can be filled later in Settings (existing behavior).
  if (profileError || !profile || !profile.full_name || profile.full_name.trim().length === 0) {
    redirect("/onboarding");
  }

  // Redirect based on role
  if (profile.role === "admin" || profile.role === "staff_admin") {
    redirect("/admin/orders");
  }

  if (profile.role === "warehouse") {
    redirect("/warehouse");
  }

  const hasCompany = Boolean(profile.company_id);

  // Client dashboard - get baskets (draft) and orders (submitted+)
  const { data: allOrders } = hasCompany
    ? await supabase
        .from("orders")
        .select(
          `
      *,
      company:companies(name),
      items:order_items(id)
    `
        )
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as any[] };

  // Separate baskets from orders and sort them chronologically (newest first)
  const baskets = (allOrders?.filter(o => o.status === 'draft') || [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const allNonDraftOrders = allOrders?.filter(o => o.status !== 'draft') || [];
  
  // Sort orders: processed orders first, then delivered orders
  // Within each group, sort by created_at descending (newest first)
  const orders = allNonDraftOrders.sort((a, b) => {
    const aIsDelivered = a.status === 'delivered';
    const bIsDelivered = b.status === 'delivered';
    
    // If one is delivered and one isn't, non-delivered comes first
    if (aIsDelivered && !bIsDelivered) return 1;
    if (!aIsDelivered && bIsDelivered) return -1;
    
    // If both are in the same group, sort by created_at descending
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Get totals for baskets
  const basketsWithTotals = await Promise.all(
    baskets.map(async (order) => {
      const { data: totals } = await supabase
        .from("order_totals")
        .select("*")
        .eq("order_id", order.id)
        .single();

      return { ...order, totals };
    })
  );

  // Get totals for orders
  const ordersWithTotals = await Promise.all(
    orders.map(async (order) => {
      const { data: totals } = await supabase
        .from("order_totals")
        .select("*")
        .eq("order_id", order.id)
        .single();

      return { ...order, totals };
    })
  );

  // Load active tours for the tours section
  const { data: toursData } = await supabase
    .from('tours')
    .select('*')
    .eq('is_active', true)
    .eq('is_archived', false)
    .gte('start_date', new Date().toISOString().split('T')[0]) // Only future tours
    .order('start_date', { ascending: true })
    .limit(3); // Show max 3 tours on dashboard

  // Calculate available spaces for each tour
  const tours = await Promise.all(
    (toursData || []).map(async (tour) => {
      const { data: bookings } = await supabase
        .from('tour_bookings')
        .select('booking_type')
        .eq('tour_id', tour.id)
        .eq('status', 'confirmed');

      const bookedSpaces = bookings?.reduce((total, booking) => {
        return total + (booking.booking_type === 'single' ? 1 : 2);
      }, 0) || 0;

      return {
        ...tour,
        available_spaces: tour.max_spaces - bookedSpaces
      };
    })
  );

  // Load user's tour bookings (only if linked to a company)
  const { data: myTours } = hasCompany
    ? await supabase
        .from("tour_bookings")
        .select(
          `
      *,
      tour:tours(*)
    `
        )
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo width={200} height={80} linkToDashboard={true} />
              <div>
                <p className="text-sm text-muted-foreground">
                  {profile.company?.name ?? ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm">{profile.full_name || user.email}</span>
              <Link href="/settings">
                <Button variant="outline" size="sm">
                  Settings
                </Button>
              </Link>
              <form action="/api/auth/signout" method="post">
                <Button variant="outline" size="sm">
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!hasCompany && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Finish your profile anytime</CardTitle>
              <CardDescription>
                You can add company details and delivery address later in Settings. You’re ready to use the app.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings">
                <Button variant="outline">Go to Settings</Button>
              </Link>
            </CardContent>
          </Card>
        )}
        <ClientTabsFixed 
          baskets={basketsWithTotals}
          orders={ordersWithTotals}
          tours={tours}
          myTours={myTours || []}
          userRole={profile.role}
        />
      </main>
    </div>
  );
}
