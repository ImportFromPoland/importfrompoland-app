import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AdminOrdersTabs from "@/components/admin/AdminOrdersTabs";

export default async function AdminOrdersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id)
    .single();

  const isSuperadmin = profile?.role === "staff_admin";

  const { data: orders } = await supabase
    .from("orders")
    .select(`
      *,
      company:companies(
        name,
        vat_number,
        profiles!fk_profiles_company(full_name, email)
      ),
      created_by_profile:profiles!created_by(full_name, email),
      items:order_items(id)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  const ordersWithTotals = await Promise.all(
    (orders || []).map(async (order) => {
      const { data: totals } = await supabase
        .from("order_totals")
        .select("*")
        .eq("order_id", order.id)
        .single();

      return { ...order, totals };
    })
  );

  const baskets = ordersWithTotals.filter((o) => o.status === "draft");
  const activeOrders = ordersWithTotals.filter(
    (o) =>
      o.status !== "draft" &&
      o.status !== "delivered" &&
      o.status !== "cancelled"
  );
  const deliveredOrders = ordersWithTotals.filter(
    (o) => o.status === "delivered"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Management</h1>
          <p className="text-muted-foreground">
            View and manage all customer orders
          </p>
        </div>
        <Link href="/admin/orders/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create New Basket
          </Button>
        </Link>
      </div>

      <AdminOrdersTabs
        baskets={baskets}
        activeOrders={activeOrders}
        deliveredOrders={deliveredOrders}
        isSuperadmin={!!isSuperadmin}
      />
    </div>
  );
}
