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

interface ClientTabsProps {
  baskets: any[];
  orders: any[];
  tours: any[];
  myTours?: any[];
}

function ClientTabsSimple({ baskets, orders, tours, myTours = [] }: ClientTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState("orders");

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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-green-600">ClientTabs Test</h1>
      <p className="text-lg text-gray-600">If you can see this with proper styling, the ClientTabs component is working.</p>
      
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="tours">Tours</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="orders" className="space-y-4">
          <div className="p-4 bg-blue-100 rounded-lg">
            <h2 className="text-xl font-semibold text-blue-800">Orders Tab</h2>
            <p className="text-blue-600">This is the orders tab content.</p>
          </div>
        </TabsContent>
        
        <TabsContent value="tours" className="space-y-4">
          <div className="p-4 bg-green-100 rounded-lg">
            <h2 className="text-xl font-semibold text-green-800">Tours Tab</h2>
            <p className="text-green-600">This is the tours tab content.</p>
          </div>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4">
          <div className="p-4 bg-purple-100 rounded-lg">
            <h2 className="text-xl font-semibold text-purple-800">Settings Tab</h2>
            <p className="text-purple-600">This is the settings tab content.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ClientTabsSimple;


