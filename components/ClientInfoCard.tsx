"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ClientInfoCardProps {
  className?: string;
}

export default function ClientInfoCard({ className }: ClientInfoCardProps) {
  const [totalClients, setTotalClients] = useState(0);
  const [newClientsThisMonth, setNewClientsThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClientCounts = async () => {
      try {
        const supabase = createClient();
        
        console.log("=== CLIENT INFO CARD DEBUG ===");
        
        // Get total clients count
        const { count: totalCount, error: totalError } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "client");

        console.log("Total clients count:", totalCount, "Error:", totalError);
        setTotalClients(totalCount || 0);

        // Get new clients this month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        
        const { count: newCount, error: newError } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "client")
          .gte("created_at", startOfMonth.toISOString())
          .lt("created_at", startOfNextMonth.toISOString());

        console.log("New clients this month:", newCount, "Error:", newError);
        console.log("Current month filter:", `${startOfMonth.toISOString()} to ${startOfNextMonth.toISOString()}`);
        setNewClientsThisMonth(newCount || 0);

        // Debug: Get all clients with dates
        const { data: allClients, error: allClientsError } = await supabase
          .from("profiles")
          .select("id, created_at, role")
          .eq("role", "client")
          .order("created_at", { ascending: false });

        console.log("All clients with dates:", allClients, "Error:", allClientsError);
        console.log("=== END CLIENT INFO CARD DEBUG ===");
        
      } catch (error) {
        console.error("Error loading client counts:", error);
      } finally {
        setLoading(false);
      }
    };

    loadClientCounts();
  }, []);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border p-4 ${className}`}>
        <h3 className="font-semibold text-sm text-gray-900 mb-3">Client Information</h3>
        <div className="space-y-2 text-sm">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border p-4 ${className}`}>
      <h3 className="font-semibold text-sm text-gray-900 mb-3">Client Information</h3>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-600">Active Clients:</span>
          <span className="font-medium ml-2">{totalClients}</span>
        </div>
        <div>
          <span className="text-gray-600">New This Month:</span>
          <span className="font-medium ml-2">{newClientsThisMonth}</span>
        </div>
      </div>
    </div>
  );
}
