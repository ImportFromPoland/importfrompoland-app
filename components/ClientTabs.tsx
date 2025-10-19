"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, MapPin, ShoppingCart, Calendar, Trash2 } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

interface ClientTabsProps {
  baskets: any[];
  orders: any[];
  tours: any[];
  myTours?: any[];
}

function ClientTabs({ baskets, orders, tours, myTours = [] }: ClientTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const [activeTab, setActiveTab] = useState("orders");
  const [deletingBasket, setDeletingBasket] = useState<string | null>(null);

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

  const deleteBasket = async (basketId: string) => {
    if (!confirm("Are you sure you want to delete this basket? This action cannot be undone.")) {
      return;
    }

    setDeletingBasket(basketId);
    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", basketId)
        .eq("status", "draft");

      if (error) throw error;

      // Refresh the page to update the baskets list
      router.refresh();
    } catch (error: any) {
      alert("Error deleting basket: " + error.message);
    } finally {
      setDeletingBasket(null);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="orders" className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          Orders
        </TabsTrigger>
        <TabsTrigger value="tours" className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Poland Tours
        </TabsTrigger>
        <TabsTrigger value="settings" className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          Settings
        </TabsTrigger>
      </TabsList>

      {/* Orders Tab */}
      <TabsContent value="orders" className="space-y-12">
        {/* My Baskets Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold">My Baskets</h2>
            <Link href="/orders/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Basket
              </Button>
            </Link>
          </div>

          {baskets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No active baskets</h3>
                <p className="text-muted-foreground mb-4">
                  Create a basket to start building your order
                </p>
                <Link href="/orders/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Basket
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {baskets.map((basket) => (
                <Card key={basket.id} className="hover:shadow-md transition-shadow border-blue-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Link href={`/orders/${basket.id}`}>
                          <CardTitle className="text-xl cursor-pointer hover:text-blue-600">
                            {basket.client_notes || "Unnamed Basket"}
                          </CardTitle>
                        </Link>
                        <CardDescription>
                          Created {formatDate(basket.created_at)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={basket.status} />
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
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {basket.items?.length || 0} item(s)
                      </div>
                      {basket.totals && (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(basket.totals.grand_total, basket.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Total (incl. VAT)
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* My Orders Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold">My Orders</h2>
          </div>

          {orders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No submitted orders yet</h3>
                <p className="text-muted-foreground">
                  Your submitted orders will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {orders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl">
                            {order.number}
                          </CardTitle>
                          <CardDescription>
                            {order.client_notes && (
                              <span className="font-medium">{order.client_notes} • </span>
                            )}
                            Submitted {formatDate(order.submitted_at || order.created_at)}
                          </CardDescription>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          <div>{order.items?.length || 0} item(s)</div>
                          {order.expected_delivery_date && (
                            <div className="mt-1">
                              Expected delivery: {formatDate(order.expected_delivery_date)}
                            </div>
                          )}
                        </div>
                        {order.totals && (
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">
                              {formatCurrency(order.totals.grand_total, order.currency)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Total (incl. VAT)
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </TabsContent>

      {/* Poland Tours Tab */}
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

        <section>
          <div className="mb-6">
            <h2 className="text-3xl font-bold">#PolandMaterialsTours</h2>
            <p className="text-muted-foreground mt-2">
              Discover the wide selection of Polish showrooms in a stress-free environment
            </p>
          </div>
          
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MapPin className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">#PolandMaterialsTours</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Discover the wide selection of Polish showrooms in a stress-free environment
              </p>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>What&apos;s included:</strong> Airport transfers, 3★ hotel accommodation, 
                  guided showroom visits, group dinner, and personalized assistance.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Tours List */}
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Upcoming Tours</h3>
            <div className="grid gap-4">
              {tours && tours.length > 0 ? (
                tours.map((tour) => (
                  <Card key={tour.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{tour.title}</CardTitle>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {tour.departure_airport} → {tour.arrival_airport}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(tour.start_date)} - {formatDate(tour.end_date)}
                            </div>
                          </div>
                        </div>
                        <Badge variant="default">
                          {tour.max_spaces} spaces available
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          €{tour.price_single} single person • €{tour.price_double} two people sharing
                        </div>
                        <Button size="sm" asChild>
                          <Link href={`/tours/${tour.id}`}>
                            Book Now
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No upcoming tours available at the moment.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </section>
      </TabsContent>

      {/* Settings Tab */}
      <TabsContent value="settings" className="space-y-6">
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold">Account Settings</h2>
          </div>
          
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Settings</h3>
              <p className="text-muted-foreground mb-4">
                Manage your account settings and preferences
              </p>
              <Link href="/settings">
                <Button>
                  Go to Settings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </TabsContent>
    </Tabs>
  );
}

export default ClientTabs;
