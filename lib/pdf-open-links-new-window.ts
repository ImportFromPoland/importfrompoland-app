/**
 * @react-pdf Link annotations open in the same window by default.
 * Patch pdfkit so external URI actions include NewWindow=true.
 */
// @ts-expect-error no types shipped for @react-pdf/pdfkit
import PDFDocument from "@react-pdf/pdfkit";

type PdfKitDoc = {
  ref: (data: Record<string, unknown>) => { end: () => void };
  annotate: (
    x: number,
    y: number,
    w: number,
    h: number,
    options: Record<string, unknown>
  ) => unknown;
  link: (
    x: number,
    y: number,
    w: number,
    h: number,
    url: string | number,
    options?: Record<string, unknown>
  ) => unknown;
};

const proto = PDFDocument.prototype as PdfKitDoc & {
  __ifpNewWindowPatched?: boolean;
};

if (!proto.__ifpNewWindowPatched) {
  const originalLink = proto.link;

  proto.link = function (
    this: PdfKitDoc,
    x: number,
    y: number,
    w: number,
    h: number,
    url: string | number,
    options: Record<string, unknown> = {}
  ) {
    if (typeof url === "number") {
      return originalLink.call(this, x, y, w, h, url, options);
    }

    const opts: Record<string, unknown> = { ...options, Subtype: "Link" };
    opts.A = this.ref({
      S: "URI",
      URI: new String(url),
      NewWindow: true,
    });
    (opts.A as { end: () => void }).end();
    return this.annotate(x, y, w, h, opts);
  };

  proto.__ifpNewWindowPatched = true;
}
