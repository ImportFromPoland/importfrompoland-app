import type { IndividualOfferPDFProps } from "@/components/IndividualOfferPDF";

export async function downloadIndividualOfferPdf(
  props: IndividualOfferPDFProps,
  filename?: string
) {
  const React = await import("react");
  const { pdf } = await import("@react-pdf/renderer");
  const { IndividualOfferPDF } = await import("@/components/IndividualOfferPDF");

  const blob = await pdf(
    React.createElement(IndividualOfferPDF, props)
  ).toBlob();

  const safeName = (filename || props.offerNumber || "offer")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
