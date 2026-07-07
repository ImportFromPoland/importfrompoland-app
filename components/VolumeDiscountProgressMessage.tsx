"use client";

import { getVolumeDiscountProgress } from "@/lib/volume-discount";
import { formatCurrency } from "@/lib/utils";
import { PartyPopper, TrendingUp } from "lucide-react";

interface VolumeDiscountProgressMessageProps {
  grossBeforeDiscountEur: number;
}

export function VolumeDiscountProgressMessage({
  grossBeforeDiscountEur,
}: VolumeDiscountProgressMessageProps) {
  const progress = getVolumeDiscountProgress(grossBeforeDiscountEur);

  if (progress.status === "max") {
    return (
      <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-primary">
        <div className="flex items-start gap-2">
          <PartyPopper className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold">Congratulations!</span> You&apos;ve reached our
            maximum volume discount ({progress.currentPercent}%). Bank transfer adds a
            further +1% at checkout.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-muted/40 px-3 py-2.5 text-sm">
      <div className="flex items-start gap-2">
        <TrendingUp className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <p>
          Add{" "}
          <span className="font-semibold text-primary">
            {formatCurrency(progress.amountNeeded, "EUR")}
          </span>{" "}
          more to unlock{" "}
          <span className="font-semibold">{progress.nextPercent}%</span> discount (orders
          over €{progress.nextThreshold.toLocaleString("en-IE")} gross).
        </p>
      </div>
    </div>
  );
}
