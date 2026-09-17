import { Font } from "@react-pdf/renderer";

let registered = false;

/** Roboto with Latin Extended — required for Polish diacritics in PDFs. */
export function registerPdfFonts() {
  if (registered) return;
  Font.register({
    family: "Roboto",
    fonts: [
      {
        src: "/fonts/Roboto-Regular.ttf",
        fontWeight: 400,
        fontStyle: "normal",
      },
      {
        src: "/fonts/Roboto-Bold.ttf",
        fontWeight: 700,
        fontStyle: "normal",
      },
      {
        src: "/fonts/Roboto-Italic.ttf",
        fontWeight: 400,
        fontStyle: "italic",
      },
      {
        src: "/fonts/Roboto-BoldItalic.ttf",
        fontWeight: 700,
        fontStyle: "italic",
      },
    ],
  });
  registered = true;
}

registerPdfFonts();
