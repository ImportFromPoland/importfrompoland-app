import { Font } from "@react-pdf/renderer";

let registered = false;

/** Roboto with Latin Extended — required for Polish diacritics in PDFs. */
export function registerPdfFonts() {
  if (registered) return;
  Font.register({
    family: "Roboto",
    fonts: [
      { src: "/fonts/Roboto-Regular.ttf", fontWeight: "normal" },
      { src: "/fonts/Roboto-Bold.ttf", fontWeight: "bold" },
    ],
  });
  registered = true;
}

registerPdfFonts();
