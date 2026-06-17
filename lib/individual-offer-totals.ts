/** Lines store gross EUR amounts; derive net for display. */
export function offerLinesNetTotal(
  lines: { amount: number | string; vat_rate: number | string }[]
): number {
  return lines.reduce((sum, line) => {
    const gross = Number(line.amount) || 0;
    const vat = Number(line.vat_rate) || 0;
    return sum + gross / (1 + vat / 100);
  }, 0);
}
