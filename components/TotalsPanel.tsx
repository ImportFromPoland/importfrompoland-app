"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Info } from "lucide-react";

interface TotalsPanelProps {
  itemsNet: number;
  vatRate: number;
  vatAmount: number;
  itemsGross: number;
  shippingCost: number;
  headerDiscountPercent: number;
  headerMarkupPercent: number;
  grandTotal: number;
  currency: string;
  showTooltip?: boolean;
  clientView?: boolean; // Simplified view for clients
}

export function TotalsPanel({
  itemsNet,
  vatRate,
  vatAmount,
  itemsGross,
  shippingCost,
  headerDiscountPercent,
  headerMarkupPercent,
  grandTotal,
  currency,
  showTooltip = true,
  clientView = false,
}: TotalsPanelProps) {
  // Simplified client view - just show the grand total
  if (clientView) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Basket Summary</CardTitle>
            {showTooltip && (
              <div className="group relative">
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                <div className="absolute right-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  All prices include VAT and delivery to Ireland
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-base">
            <span>Subtotal (excl. VAT):</span>
            <span className="font-medium">{formatCurrency(itemsNet, currency)}</span>
          </div>

          <div className="flex justify-between text-base">
            <span>VAT:</span>
            <span className="font-medium">{formatCurrency(vatAmount, currency)}</span>
          </div>

          {shippingCost > 0 && (
            <div className="flex justify-between text-base">
              <span>Shipping:</span>
              <span className="font-medium">{formatCurrency(shippingCost, currency)}</span>
            </div>
          )}

          <div className="border-t pt-4 flex justify-between text-xl font-bold">
            <span>Grand Total:</span>
            <span className="text-primary">{formatCurrency(grandTotal, currency)}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full admin view with all details
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Order Totals</CardTitle>
          {showTooltip && (
            <div className="group relative">
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              <div className="absolute right-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                PLN prices are converted by ÷3.1 which includes service & delivery to Ireland
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span>Items Net (before header modifiers):</span>
          <span className="font-medium">{formatCurrency(itemsNet, currency)}</span>
        </div>

        {headerDiscountPercent > 0 && (
          <div className="flex justify-between text-sm text-red-600">
            <span>Header Discount ({headerDiscountPercent}%):</span>
            <span className="font-medium">
              -{formatCurrency(itemsNet * (headerDiscountPercent / 100), currency)}
            </span>
          </div>
        )}

        {headerMarkupPercent > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Header Markup ({headerMarkupPercent}%):</span>
            <span className="font-medium">
              +{formatCurrency(itemsNet * (headerMarkupPercent / 100), currency)}
            </span>
          </div>
        )}

        <div className="border-t pt-2 flex justify-between text-sm">
          <span>Items Net (after header modifiers):</span>
          <span className="font-semibold">
            {formatCurrency(
              itemsNet * (1 - headerDiscountPercent / 100) * (1 + headerMarkupPercent / 100),
              currency
            )}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span>VAT ({vatRate}%):</span>
          <span className="font-medium">{formatCurrency(vatAmount, currency)}</span>
        </div>

        <div className="flex justify-between text-sm font-semibold">
          <span>Items Gross:</span>
          <span>{formatCurrency(itemsGross, currency)}</span>
        </div>

        {shippingCost > 0 && (
          <div className="flex justify-between text-sm">
            <span>Shipping:</span>
            <span className="font-medium">{formatCurrency(shippingCost, currency)}</span>
          </div>
        )}

        <div className="border-t pt-3 flex justify-between text-lg font-bold">
          <span>Grand Total:</span>
          <span className="text-primary">{formatCurrency(grandTotal, currency)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

