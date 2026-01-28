"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, MapPin, ShoppingCart, Calendar, Trash2, RotateCcw } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SettingsForm from "@/components/SettingsForm";

interface ClientTabsProps {
  baskets: any[];
  orders: any[];
  tours: any[];
  myTours?: any[];
  userRole?: string;
}

function ClientTabsFixed({ baskets, orders, tours, myTours = [], userRole }: ClientTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState("orders");
  const [deletingBasket, setDeletingBasket] = useState<string | null>(null);
  const [revertingOrder, setRevertingOrder] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["orders", "tours", "settings"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const revertToBasket = async (orderId: string) => {
    if (!confirm("Are you sure you want to revert this order back to basket? You will be able to edit it again.")) {
      return;
    }

    setRevertingOrder(orderId);
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from("orders")
        .update({
          status: "draft",
          submitted_at: null,
        })
        .eq("id", orderId);

      if (error) throw error;

      // Refresh the page to update the orders list
      router.refresh();
    } catch (error: any) {
      alert("Error reverting order: " + error.message);
    } finally {
      setRevertingOrder(null);
    }
  };

  const deleteBasket = async (basketId: string) => {
    if (!confirm("Are you sure you want to delete this basket? This action cannot be undone.")) {
      return;
    }

    setDeletingBasket(basketId);
    try {
      const supabase = createClient();
      
      console.log("Deleting basket:", basketId);
      
      // First delete all order items for this basket
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", basketId)
        .select();

      if (itemsError) {
        console.error("Error deleting order items:", itemsError);
        throw new Error(`Failed to delete order items: ${itemsError.message}`);
      }
      console.log("Order items deleted successfully:", itemsData);

      // Then delete the basket itself
      const { data: basketData, error: basketError } = await supabase
        .from("orders")
        .delete()
        .eq("id", basketId)
        .eq("status", "draft")
        .select();

      if (basketError) {
        console.error("Error deleting basket:", basketError);
        throw new Error(`Failed to delete basket: ${basketError.message}`);
      }
      
      if (!basketData || basketData.length === 0) {
        throw new Error("Basket not found or not a draft order");
      }
      
      console.log("Basket deleted successfully:", basketData);

      // Force page reload to update the UI
      window.location.reload();
    } catch (error: any) {
      console.error("Error deleting basket:", error);
      alert("Error deleting basket: " + (error.message || "Unknown error"));
    } finally {
      setDeletingBasket(null);
    }
  };

  const deleteBasketAsSuperadmin = async (basketId: string) => {
    if (!confirm("Are you sure you want to delete this basket? This action cannot be undone.")) {
      return;
    }

    setDeletingBasket(basketId);
    try {
      const supabase = createClient();
      
      // Delete order items first
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", basketId);

      if (itemsError) throw itemsError;

      // Delete the order itself
      const { error: orderError } = await supabase
        .from("orders")
        .delete()
        .eq("id", basketId)
        .eq("status", "draft");

      if (orderError) throw itemsError;

      console.log("Basket deleted by superadmin:", basketId);
      alert("Basket deleted successfully!");
      
      // Force page reload to update the UI
      window.location.reload();
    } catch (error: any) {
      console.error("Error deleting basket as superadmin:", error);
      alert("Error deleting basket: " + (error.message || "Unknown error"));
    } finally {
      setDeletingBasket(null);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="orders">Orders</TabsTrigger>
        <TabsTrigger value="tours">Tours</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="orders" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Orders</h2>
            <p className="text-muted-foreground mt-2">
              Manage your orders and track their status
            </p>
          </div>
          <Button asChild>
            <Link href="/orders/new">
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Link>
          </Button>
        </div>

        {/* Baskets Section */}
        <section>
          <h3 className="text-xl font-semibold mb-4">Draft Orders (Baskets)</h3>
          {baskets.length > 0 ? (
            <div className="grid gap-4">
              {baskets.map((basket) => (
                <Link key={basket.id} href={`/orders/${basket.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{basket.client_notes || "Unnamed Basket"}</CardTitle>
                          <CardDescription>
                            Created {formatDate(basket.created_at)}
                          </CardDescription>
                        </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={basket.status} />
                        {userRole === "staff_admin" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteBasketAsSuperadmin(basket.id);
                            }}
                            disabled={deletingBasket === basket.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete basket (Superadmin)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteBasket(basket.id);
                            }}
                            disabled={deletingBasket === basket.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {basket.items?.length || 0} items
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">
                          {basket.totals?.grand_total ? formatCurrency(basket.totals.grand_total) : 'Calculating...'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No draft orders</h3>
                <p className="text-muted-foreground mb-4">
                  Start by creating a new order to add items to your basket
                </p>
                <Button asChild>
                  <Link href="/orders/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Order
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Orders Section */}
        <section>
          <h3 className="text-xl font-semibold mb-4">Submitted Orders</h3>
          {orders.length > 0 ? (
            <div className="grid gap-4">
              {orders.map((order) => (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Link href={`/orders/${order.id}`}>
                          <CardTitle className="text-lg cursor-pointer hover:text-blue-600">
                            {order.number}
                          </CardTitle>
                        </Link>
                        <CardDescription>
                          {order.client_notes && (
                            <span className="font-medium text-foreground">{order.client_notes} • </span>
                          )}
                          Submitted {formatDate(order.created_at)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={order.status} />
                        {order.status === "submitted" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              revertToBasket(order.id);
                            }}
                            disabled={revertingOrder === order.id}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Revert to basket"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            {revertingOrder === order.id ? "Reverting..." : "Revert to Basket"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {order.items?.length || 0} items
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">
                          {order.totals?.grand_total ? formatCurrency(order.totals.grand_total) : 'Calculating...'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No submitted orders</h3>
                <p className="text-muted-foreground">
                  Your submitted orders will appear here
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      </TabsContent>

      <TabsContent value="tours" className="space-y-6">
        {/* My Tours Section */}
        {myTours && myTours.length > 0 && (
          <section>
            <div className="mb-6">
              <h2 className="text-3xl font-bold">My Tours</h2>
              <p className="text-muted-foreground mt-2">
                Your booked tours and their current status
              </p>
            </div>
            <div className="grid gap-4">
              {myTours.map((booking) => (
                <Card key={booking.id} className="hover:shadow-md transition-shadow border-green-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">{booking.tour?.title}</CardTitle>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {booking.tour?.departure_airport} → {booking.tour?.arrival_airport}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(booking.tour?.start_date)} - {formatDate(booking.tour?.end_date)}
                          </div>
                        </div>
                      </div>
                      <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                        {booking.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        <div>Attendee: {booking.attendee1_name}</div>
                        {booking.attendee2_name && (
                          <div>Attendee 2: {booking.attendee2_name}</div>
                        )}
                        <div>Contact: {booking.contact_number}</div>
                      </div>
                      <Button size="sm" asChild>
                        <Link href={`/tours/${booking.tour_id}`}>
                          View Details
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Tours Section */}
        <section>
          <div className="mb-6">
            <h2 className="text-3xl font-bold">Upcoming Tours</h2>
            <p className="text-muted-foreground mt-2">
              Discover our guided shopping tours in Poland
            </p>
          </div>
          {tours.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tours.map((tour) => (
                <Card key={tour.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-xl">{tour.title}</CardTitle>
                    <CardDescription>
                      {formatDate(tour.start_date)} - {formatDate(tour.end_date)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {tour.departure_airport} → {tour.arrival_airport}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        {tour.available_spaces === 0 ? (
                          <span className="text-red-600 font-semibold">Fully booked</span>
                        ) : (
                          <span className="text-muted-foreground">
                            {tour.available_spaces} of {tour.max_spaces} spaces available
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-semibold">
                          From {formatCurrency(tour.price_single)}
                        </div>
                        <Button asChild>
                          <Link href={`/tours/${tour.id}`}>
                            View Details
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No tours available</h3>
                <p className="text-muted-foreground">
                  Check back later for new tour announcements
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      </TabsContent>

      <TabsContent value="settings" className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Settings</h2>
          <p className="text-muted-foreground mt-2">
            Manage your account and preferences
          </p>
        </div>
        <SettingsForm />
      </TabsContent>
    </Tabs>
  );
}

export default ClientTabsFixed;
