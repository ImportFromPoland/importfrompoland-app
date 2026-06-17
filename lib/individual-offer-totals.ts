/** `individual_offer_lines.amount` is stored as NET EUR. */

export type OfferLineInput = {
  amount: number | string;
  vat_rate: number | string;
};

export const OFFER_VAT_PRESETS = [
  { label: "Standard 23%", value: 23 },
  { label: "Installation (IE) 13.5%", value: 13.5 },
  { label: "B2B export 0%", value: 0 },
] as const;

export function offerLineNetAmount(line: OfferLineInput): number {
  return Number(line.amount) || 0;
}

export function offerLineVatAmount(line: OfferLineInput): number {
  const net = offerLineNetAmount(line);
  const vat = Number(line.vat_rate) || 0;
  return net * (vat / 100);
}

export function offerLineGrossAmount(line: OfferLineInput): number {
  return offerLineNetAmount(line) + offerLineVatAmount(line);
}

export function offerLinesNetTotal(
  lines: OfferLineInput[]
): number {
  return lines.reduce((sum, line) => sum + offerLineNetAmount(line), 0);
}

export function offerLinesVatTotal(lines: OfferLineInput[]): number {
  return lines.reduce((sum, line) => sum + offerLineVatAmount(line), 0);
}

export function offerLinesGrossTotal(lines: OfferLineInput[]): number {
  return lines.reduce((sum, line) => sum + offerLineGrossAmount(line), 0);
}
