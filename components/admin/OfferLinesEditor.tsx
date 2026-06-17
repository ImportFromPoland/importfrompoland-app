"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  OFFER_VAT_PRESETS,
  offerLineGrossAmount,
  offerLineNetAmount,
} from "@/lib/individual-offer-totals";

export type EditableOfferLine = {
  line_number: number;
  label: string;
  amount: number;
  vat_rate: number;
  notes: string;
};

export const emptyOfferLine = (n: number): EditableOfferLine => ({
  line_number: n,
  label: "",
  amount: 0,
  vat_rate: 23,
  notes: "",
});

type OfferLinesEditorProps = {
  lines: EditableOfferLine[];
  onChange: (lines: EditableOfferLine[]) => void;
  readOnly?: boolean;
};

export function OfferLinesEditor({
  lines,
  onChange,
  readOnly = false,
}: OfferLinesEditorProps) {
  if (readOnly) {
    return (
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Line</th>
              <th className="text-right p-2">Net EUR</th>
              <th className="text-right p-2">VAT %</th>
              <th className="text-right p-2">Gross EUR</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.line_number} className="border-t">
                <td className="p-2">
                  <div>{line.label}</div>
                  {line.notes ? (
                    <div className="text-xs text-muted-foreground">{line.notes}</div>
                  ) : null}
                </td>
                <td className="p-2 text-right">
                  {formatCurrency(offerLineNetAmount(line), "EUR")}
                </td>
                <td className="p-2 text-right">{line.vat_rate}%</td>
                <td className="p-2 text-right">
                  {formatCurrency(offerLineGrossAmount(line), "EUR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
        <span>Label</span>
        <span>Net EUR</span>
        <span>VAT %</span>
        <span className="text-right">Gross EUR</span>
        <span>Notes</span>
        <span />
      </div>
      {lines.map((line, index) => (
        <div
          key={line.line_number}
          className="grid md:grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto] gap-2 items-center"
        >
          <Input
            placeholder="Label (e.g. Windows)"
            value={line.label}
            onChange={(e) => {
              const next = [...lines];
              next[index] = { ...line, label: e.target.value };
              onChange(next);
            }}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Net"
            value={line.amount || ""}
            onChange={(e) => {
              const next = [...lines];
              next[index] = {
                ...line,
                amount: parseFloat(e.target.value) || 0,
              };
              onChange(next);
            }}
          />
          <div className="flex gap-1">
            <Input
              type="number"
              step="0.1"
              min="0"
              value={line.vat_rate}
              onChange={(e) => {
                const next = [...lines];
                next[index] = {
                  ...line,
                  vat_rate: parseFloat(e.target.value) || 0,
                };
                onChange(next);
              }}
            />
          </div>
          <div className="text-sm text-right font-medium tabular-nums px-1">
            {line.amount > 0
              ? formatCurrency(offerLineGrossAmount(line), "EUR")
              : "—"}
          </div>
          <Input
            placeholder="Notes"
            value={line.notes}
            onChange={(e) => {
              const next = [...lines];
              next[index] = { ...line, notes: e.target.value };
              onChange(next);
            }}
          />
          <div className="flex flex-wrap gap-1">
            {OFFER_VAT_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const next = [...lines];
                  next[index] = { ...line, vat_rate: preset.value };
                  onChange(next);
                }}
              >
                {preset.value}%
              </Button>
            ))}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...lines, emptyOfferLine(lines.length + 1)])}
      >
        <Plus className="h-4 w-4 mr-1" /> Add line
      </Button>
    </div>
  );
}
