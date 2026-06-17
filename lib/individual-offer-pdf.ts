import type {
  IndividualOfferPDFLine,
  IndividualOfferPDFLink,
  IndividualOfferPDFProps,
} from "@/components/IndividualOfferPDF";

/** Map version-level spec links onto lines by sort_order / index (1st link → line 1, etc.). */
export function attachSpecLinksToLines(
  lines: Omit<IndividualOfferPDFLine, "specLinks">[],
  specLinks: IndividualOfferPDFLink[] = []
): IndividualOfferPDFLine[] {
  const byLine = new Map<number, IndividualOfferPDFLink[]>();

  specLinks.forEach((link, index) => {
    const lineNumber = link.line_number ?? index + 1;
    if (lineNumber < 1 || lineNumber > lines.length) return;
    const bucket = byLine.get(lineNumber) ?? [];
    bucket.push({ title: link.title, url: link.url });
    byLine.set(lineNumber, bucket);
  });

  return lines.map((line, index) => ({
    ...line,
    specLinks: byLine.get(index + 1) ?? [],
  }));
}

export async function downloadIndividualOfferPdf(
  props: IndividualOfferPDFProps,
  filename?: string
) {
  const React = await import("react");
  const { pdf } = await import("@react-pdf/renderer");
  const { IndividualOfferPDF } = await import("@/components/IndividualOfferPDF");

  const linesWithLinks = attachSpecLinksToLines(props.lines, props.specLinks);

  const blob = await pdf(
    React.createElement(IndividualOfferPDF, {
      ...props,
      lines: linesWithLinks,
      specLinks: undefined,
    })
  ).toBlob();

  const safeName = (filename || props.offerNumber || "offer").replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
