"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BANK_TRANSFER_BONUS_PERCENT } from "@/lib/volume-discount";

interface BankTransferDiscountOptionProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function BankTransferDiscountOption({
  checked,
  onCheckedChange,
  disabled = false,
}: BankTransferDiscountOptionProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
      <Checkbox
        id="prefers_bank_transfer"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="space-y-1">
        <Label
          htmlFor="prefers_bank_transfer"
          className="cursor-pointer font-medium leading-snug"
        >
          Pay by bank transfer (+{BANK_TRANSFER_BONUS_PERCENT}% discount)
        </Label>
        <p className="text-sm text-muted-foreground">
          I will pay by bank transfer to the company account. You will receive bank
          details on the order confirmation instead of an online payment link.
        </p>
      </div>
    </div>
  );
}
