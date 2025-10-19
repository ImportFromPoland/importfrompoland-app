"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";

export default function WarehousePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (
        !userProfile ||
        !["admin", "staff_admin", "warehouse"].includes(userProfile.role)
      ) {
        router.push("/");
        return;
      }

      setProfile(userProfile);

      // Get orders that need warehouse processing
      const { data: ordersData } = await supabase
        .from("orders")
        .select(`
          *,
          company:companies(name),
          items:order_items(
            *,
            warehouse_task:warehouse_tasks(*)
          )
        `)
        .in("status", [
          "confirmed",
          "invoiced",
          "picking",
          "picked",
          "packed",
          "ready_to_ship",
        ])
        .order("created_at", { ascending: true });

      setOrders(ordersData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (
    orderItemId: string,
    newStatus: string,
    quantityPicked?: number,
    locationNote?: string
  ) => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/advance-warehouse`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({
            order_item_id: orderItemId,
            new_status: newStatus,
            quantity_picked: quantityPicked,
            location_note: locationNote,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update task");
      }

      loadData();
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createShipment = async (orderId: string) => {
    const carrier = prompt("Enter carrier name:");
    if (!carrier) return;

    const tracking = prompt("Enter tracking number (optional):");

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-shipment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({
            order_id: orderId,
            carrier,
            tracking_number: tracking,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create shipment");
      }

      alert("Shipment created successfully!");
      loadData();
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold">Warehouse - Order Queue</h1>
          <p className="text-sm text-muted-foreground">
            Manage picking, packing, and dispatch
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">
                  No orders in queue for processing
                </p>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Order {order.number}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {order.company.name} • Created {formatDate(order.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Line</th>
                          <th className="text-left p-2">Product</th>
                          <th className="text-right p-2">Qty</th>
                          <th className="text-left p-2">Task Status</th>
                          <th className="text-left p-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item: any) => {
                          const task = item.warehouse_task?.[0];
                          const taskStatus = task?.status || "pending";

                          return (
                            <tr key={item.id} className="border-b">
                              <td className="p-2">{item.line_number}</td>
                              <td className="p-2">{item.product_name}</td>
                              <td className="text-right p-2">{item.quantity}</td>
                              <td className="p-2">
                                <span className="text-sm font-medium">
                                  {taskStatus.toUpperCase()}
                                </span>
                              </td>
                              <td className="p-2">
                                <Select
                                  value={taskStatus}
                                  onValueChange={(value) =>
                                    updateTaskStatus(item.id, value, item.quantity)
                                  }
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="picking">Picking</SelectItem>
                                    <SelectItem value="picked">Picked</SelectItem>
                                    <SelectItem value="packed">Packed</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {order.status === "packed" && (
                    <div className="pt-4 border-t">
                      <Button onClick={() => createShipment(order.id)}>
                        Create Shipment & Dispatch
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

