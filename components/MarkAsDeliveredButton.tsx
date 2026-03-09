"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface MarkAsDeliveredButtonProps {
  orderId: string;
  currentStatus: string;
}

export default function MarkAsDeliveredButton({ orderId, currentStatus }: MarkAsDeliveredButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleMarkAsDelivered = async () => {
    if (!confirm("Czy na pewno chcesz oznaczyć to zamówienie jako dostarczone?")) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      alert("Zamówienie oznaczone jako dostarczone!");
      router.refresh();
    } catch (error: any) {
      alert("Błąd: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Only show for dispatched or partially_dispatched orders
  if (!["dispatched", "partially_dispatched"].includes(currentStatus)) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleMarkAsDelivered}
      disabled={loading}
      className="border-green-600 text-green-600 hover:bg-green-50"
    >
      <CheckCircle2 className="h-4 w-4 mr-1" />
      {loading ? "Zapisywanie..." : "Dostarczone"}
    </Button>
  );
}
