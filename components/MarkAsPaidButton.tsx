"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";

interface MarkAsPaidButtonProps {
  orderId: string;
  currentStatus: string;
}

export default function MarkAsPaidButton({ orderId, currentStatus }: MarkAsPaidButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleMarkAsPaid = async () => {
    if (!confirm("Czy na pewno chcesz oznaczyć to zamówienie jako opłacone?")) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ 
          status: "paid",
          paid_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (error) throw error;

      alert("Zamówienie oznaczone jako opłacone!");
      router.refresh(); // Refresh the page to show updated status
    } catch (error: any) {
      alert("Błąd: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Only show button for confirmed orders
  if (currentStatus !== "confirmed") {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleMarkAsPaid}
      disabled={loading}
      className="mr-2"
    >
      <CreditCard className="h-4 w-4 mr-1" />
      {loading ? "Oznaczanie..." : "Opłacone"}
    </Button>
  );
}
