"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

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
  className = "",
}: SuperadminDeleteButtonProps) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    const confirmMessage = {
      basket:
        "Are you sure you want to delete this basket? This action cannot be undone.",
      order:
        "Are you sure you want to delete this order? This action cannot be undone.",
      client:
        "Permanently erase this client (GDPR)? Their login will be removed and they will disappear from the user list. Order history is kept but personal data is anonymized.",
    };

    if (!confirm(confirmMessage[itemType])) {
      return;
    }

    setDeleting(true);
    try {
      if (itemType === "client") {
        const response = await fetch("/api/admin/erase-client", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile_id: itemId }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Erase failed");
        alert("Client erased successfully.");
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        const { error: itemsError } = await supabase
          .from("order_items")
          .delete()
          .eq("order_id", itemId);
        if (itemsError) throw itemsError;

        const { error: orderError } = await supabase
          .from("orders")
          .delete()
          .eq("id", itemId);
        if (orderError) throw orderError;

        alert(
          `${itemType === "basket" ? "Basket" : "Order"} deleted successfully!`
        );
      }

      if (onDelete) onDelete();
      else router.refresh();
    } catch (error: any) {
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
