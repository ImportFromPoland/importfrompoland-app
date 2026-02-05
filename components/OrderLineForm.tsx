"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/FileUploader";
import { SupplierCombobox } from "@/components/SupplierCombobox";
import { Trash2 } from "lucide-react";
import { PLN_TO_EUR_RATE, EUR_TO_PLN_DIVISOR } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

export interface OrderLineData {
  id?: string;
  line_number: number;
  product_name: string;
  website_url: string;
  supplier_name: string;
  original_supplier_name?: string;
  unit_price: number;
  quantity: number;
  currency: "EUR" | "PLN";
  unit_of_measure: "unit" | "m2";
  discount_percent: number;
  notes: string;
  attachment_url?: string;
  original_net_price?: number;
}

interface OrderLineFormProps {
  line: OrderLineData;
  onUpdate: (line: OrderLineData) => void;
  onRemove: () => void;
  orderCurrency: "EUR" | "PLN";
  vatRate?: number;
  hideUpload?: boolean;
}

export function OrderLineForm({ line, onUpdate, onRemove, orderCurrency, vatRate = 23, hideUpload = false }: OrderLineFormProps) {
  // Currency is always PLN for client input
  // No need to show conversion details to client

  const calculateLineTotal = () => {
    // Price entered is always GROSS (incl VAT) from Polish website
    let pricePLN = line.unit_price * line.quantity;
    let priceEUR = pricePLN * PLN_TO_EUR_RATE;
    
    return priceEUR;
  };

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-white">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Line {line.line_number}</h4>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`product_name_${line.line_number}`}>
            Product Name *
          </Label>
          <Input
            id={`product_name_${line.line_number}`}
            value={line.product_name}
            onChange={(e) => onUpdate({ ...line, product_name: e.target.value })}
            placeholder="Enter product name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`website_url_${line.line_number}`}>
            Website URL
          </Label>
          <Input
            id={`website_url_${line.line_number}`}
            type="url"
            value={line.website_url}
            onChange={(e) => onUpdate({ ...line, website_url: e.target.value })}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-2">
          <SupplierCombobox
            id={`supplier_${line.line_number}`}
            value={line.supplier_name}
            onChange={(value) => onUpdate({ ...line, supplier_name: value, original_supplier_name: value })}
            placeholder="Select or type supplier name"
            label="Supplier Name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`unit_price_${line.line_number}`}>
            Unit Price (enter price from Polish website) *
          </Label>
          <Input
            id={`unit_price_${line.line_number}`}
            type="number"
            step="0.01"
            min="0.01"
            value={line.unit_price || ''}
            onChange={(e) => {
              const value = e.target.value;
              // Remove leading zeros but keep the value as string to avoid issues
              const cleanValue = value.replace(/^0+/, '') || '0';
              onUpdate({ ...line, unit_price: parseFloat(cleanValue) || 0 });
            }}
            placeholder="Enter price"
            required
          />
          {line.unit_price > 0 && (
            <p className="text-xs text-muted-foreground">
              = {formatCurrency(line.unit_price / EUR_TO_PLN_DIVISOR, "EUR")} (incl. VAT)
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`quantity_${line.line_number}`}>Quantity *</Label>
          <Input
            id={`quantity_${line.line_number}`}
            type="number"
            step={line.unit_of_measure === "m2" ? "0.01" : "1"}
            min={line.unit_of_measure === "m2" ? "0.01" : "1"}
            value={line.quantity}
            onChange={(e) =>
              onUpdate({ ...line, quantity: parseFloat(e.target.value) || 1 })
            }
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`unit_${line.line_number}`}>Unit of Measure *</Label>
          <Select
            value={line.unit_of_measure || "unit"}
            onValueChange={(value: "unit" | "m2") =>
              onUpdate({ ...line, unit_of_measure: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unit">Unit (pcs)</SelectItem>
              <SelectItem value="m2">m² (square meters)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Input
            value={line.notes}
            onChange={(e) => onUpdate({ ...line, notes: e.target.value })}
            placeholder="Optional notes"
          />
        </div>
      </div>

      <div className="bg-blue-50 p-3 rounded">
        <p className="text-sm font-semibold text-blue-900">
          Line Total: {formatCurrency(calculateLineTotal(), "EUR")} (incl. VAT & delivery)
        </p>
        <p className="text-xs text-blue-700 mt-1">
          Price includes VAT and delivery to Ireland
        </p>
      </div>

      {!hideUpload && (
        <>
          {line.attachment_url && (
            <div className="text-sm text-green-600">
              ✓ File attached: {line.attachment_url}
            </div>
          )}

          <FileUploader
            bucket="attachments"
            onUploadComplete={(url) => onUpdate({ ...line, attachment_url: url })}
          />
        </>
      )}
    </div>
  );
}

