"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface SuperadminDeleteButtonProps {
  itemId: string;
  itemType: "basket" | "order" | "client";
  onDelete?: () => void;
  className?: string;
}

export default function SuperadminDeleteButton({ 
  itemId, 
  itemType, 
  onDelete,
  className = ""
}: SuperadminDeleteButtonProps) {
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleDelete = async () => {
    const confirmMessage = {
      basket: "Are you sure you want to delete this basket? This action cannot be undone.",
      order: "Are you sure you want to delete this order? This action cannot be undone.",
      client: "Are you sure you want to delete this client and all their data? This action cannot be undone."
    };

    if (!confirm(confirmMessage[itemType])) {
      return;
    }

    setDeleting(true);
    try {
      if (itemType === "basket" || itemType === "order") {
        // Delete order items first
        const { error: itemsError } = await supabase
          .from("order_items")
          .delete()
          .eq("order_id", itemId);

        if (itemsError) throw itemsError;

        // Delete the order
        const { error: orderError } = await supabase
          .from("orders")
          .delete()
          .eq("id", itemId);

        if (orderError) throw orderError;

        console.log(`${itemType} deleted:`, itemId);
        alert(`${itemType === "basket" ? "Basket" : "Order"} deleted successfully!`);
      } else if (itemType === "client") {
        // Delete client and all their data
        // First get all orders for this client
        const { data: clientOrders } = await supabase
          .from("orders")
          .select("id")
          .eq("company_id", itemId);

        if (clientOrders && clientOrders.length > 0) {
          // Delete order items for all client orders
          const orderIds = clientOrders.map(o => o.id);
          const { error: itemsError } = await supabase
            .from("order_items")
            .delete()
            .in("order_id", orderIds);

          if (itemsError) throw itemsError;

          // Delete all client orders
          const { error: ordersError } = await supabase
            .from("orders")
            .delete()
            .eq("company_id", itemId);

          if (ordersError) throw ordersError;
        }

        // Delete client profiles
        const { error: profilesError } = await supabase
          .from("profiles")
          .delete()
          .eq("company_id", itemId);

        if (profilesError) throw profilesError;

        // Delete the company
        const { error: companyError } = await supabase
          .from("companies")
          .delete()
          .eq("id", itemId);

        if (companyError) throw companyError;

        console.log("Client deleted:", itemId);
        alert("Client and all their data deleted successfully!");
      }

      // Call callback if provided
      if (onDelete) {
        onDelete();
      } else {
        // Refresh the page
        router.refresh();
      }
    } catch (error: any) {
      console.error(`Error deleting ${itemType}:`, error);
      alert(`Error deleting ${itemType}: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={deleting}
      className={`text-red-600 hover:text-red-700 hover:bg-red-50 ${className}`}
      title={`Delete ${itemType} (Superadmin)`}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}


