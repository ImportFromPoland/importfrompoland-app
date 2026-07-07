"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  BANK_TRANSFER_BONUS_PERCENT,
  VOLUME_DISCOUNT_TIERS_ASC,
} from "@/lib/volume-discount";
import { Landmark, ShoppingBasket, Tag } from "lucide-react";

export function VolumeDiscountsBanner() {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] to-background">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold tracking-wide uppercase">
                Your volume discounts
              </h3>
              <Badge className="bg-primary hover:bg-primary text-primary-foreground text-[10px] px-2 py-0">
                NEW
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              The bigger your basket, the better your delivered price.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {VOLUME_DISCOUNT_TIERS_ASC.map((tier) => (
            <div
              key={tier.min_gross_eur}
              className="flex items-center gap-2 rounded-lg border bg-background/80 px-3 py-2.5"
            >
              <ShoppingBasket className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-medium">
                <span className="text-primary">{tier.discount_percent}%</span> over €
                {tier.min_gross_eur.toLocaleString("en-IE")}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-lg border bg-background/80 px-3 py-2.5">
            <Landmark className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium">
              <span className="text-primary">+{BANK_TRANSFER_BONUS_PERCENT}%</span> bank
              transfer
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Discounts are shown automatically in your basket when you qualify. Exclusions
          apply.
        </p>
      </CardContent>
    </Card>
  );
}
