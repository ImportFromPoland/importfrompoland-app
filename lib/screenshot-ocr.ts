export type OcrConfidence = "high" | "low" | "none";

export interface OcrParseResult {
  unit_price: number | null;
  website_url: string;
  supplier_name: string;
  product_name: string;
  price_confidence: OcrConfidence;
  url_confidence: OcrConfidence;
  raw_text: string;
}

const PRICE_PATTERNS = [
  /(\d{1,3}(?:[\s\u00a0]\d{3})*(?:[.,]\d{1,2})?)\s*(?:zł|zl|PLN|pln)\b/gi,
  /(?:zł|zl|PLN|pln)\s*(\d{1,3}(?:[\s\u00a0]\d{3})*(?:[.,]\d{1,2})?)/gi,
  /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))\s*(?:zł|zl)/gi,
];

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

function parsePolishPrice(raw: string): number | null {
  const normalized = raw
    .replace(/\s/g, "")
    .replace(/\u00a0/g, "")
    .replace(",", ".");
  const parts = normalized.split(".");
  let value: number;
  if (parts.length > 2) {
    const decimals = parts.pop()!;
    value = parseFloat(parts.join("") + "." + decimals);
  } else {
    value = parseFloat(normalized);
  }
  if (!Number.isFinite(value) || value <= 0 || value > 9_999_999) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function extractPrices(text: string): number[] {
  const found: number[] = [];
  for (const pattern of PRICE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const price = parsePolishPrice(match[1]);
      if (price !== null) {
        found.push(price);
      }
    }
  }
  return found;
}

function pickBestPrice(prices: number[], text: string): { price: number | null; confidence: OcrConfidence } {
  if (prices.length === 0) {
    return { price: null, confidence: "none" };
  }

  const unique = [...new Set(prices)];
  const lower = text.toLowerCase();

  const nearKeywords = unique.filter((p) => {
    const formatted = p.toFixed(2).replace(".", ",");
    const alt = p.toString();
    return (
      lower.includes(`${formatted} zł`) ||
      lower.includes(`${alt} zł`) ||
      lower.includes(`cena`) ||
      lower.includes(`price`)
    );
  });

  if (nearKeywords.length === 1) {
    return { price: nearKeywords[0], confidence: "high" };
  }

  const withDecimals = unique.filter((p) => !Number.isInteger(p) || p < 1000);
  const pool = withDecimals.length > 0 ? withDecimals : unique;
  const chosen = Math.max(...pool);

  if (unique.length === 1) {
    return { price: chosen, confidence: "high" };
  }

  return { price: chosen, confidence: "low" };
}

function cleanUrl(raw: string): string {
  return raw.replace(/[.,;)\]]+$/, "").trim();
}

function extractUrl(text: string): { url: string; confidence: OcrConfidence } {
  const matches = text.match(URL_PATTERN);
  if (!matches?.length) {
    return { url: "", confidence: "none" };
  }

  const cleaned = matches.map(cleanUrl);
  const productLike = cleaned.find(
    (u) =>
      !u.includes("google.") &&
      !u.includes("facebook.") &&
      !u.includes("gstatic.") &&
      u.length > 12
  );

  const url = productLike || cleaned[0];
  try {
    new URL(url);
    const confidence: OcrConfidence =
      matches.length === 1 && url.includes("www.") ? "high" : "low";
    return { url, confidence };
  } catch {
    return { url: "", confidence: "none" };
  }
}

function supplierFromUrl(url: string): string {
  if (!url) return "";
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    const part = host.split(".")[0];
    if (!part || part.length < 2) return "";
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  } catch {
    return "";
  }
}

function extractProductName(text: string, url: string, prices: number[]): string {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const candidates = lines.filter((line) => {
    if (line.length < 8 || line.length > 200) return false;
    if (URL_PATTERN.test(line)) return false;
    if (/(?:zł|zl|pln)\b/i.test(line) && /\d/.test(line)) return false;
    if (/^(koszyk|cart|menu|szukaj|search|zaloguj|login)/i.test(line)) return false;
    return /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]{4,}/.test(line);
  });

  if (candidates.length === 0) return "";

  candidates.sort((a, b) => b.length - a.length);
  return candidates[0].slice(0, 200);
}

export function parseOcrText(text: string): OcrParseResult {
  const normalized = text.replace(/\r/g, "\n");
  const prices = extractPrices(normalized);
  const { price, confidence: price_confidence } = pickBestPrice(prices, normalized);
  const { url, confidence: url_confidence } = extractUrl(normalized);
  const supplier_name = supplierFromUrl(url);
  const product_name = extractProductName(normalized, url, prices);

  return {
    unit_price: price,
    website_url: url,
    supplier_name,
    product_name,
    price_confidence,
    url_confidence,
    raw_text: normalized,
  };
}

export function buildReviewNotes(result: OcrParseResult): string {
  const parts: string[] = [];

  if (result.price_confidence === "none") {
    parts.push("Admin: verify price from screenshot.");
  } else if (result.price_confidence === "low") {
    parts.push("Admin: auto-detected price — please verify against screenshot.");
  }

  if (result.url_confidence === "none") {
    parts.push("Admin: verify product link from screenshot.");
  } else if (result.url_confidence === "low") {
    parts.push("Admin: auto-detected URL may be incorrect — please verify.");
  }

  if (parts.length === 0) {
    return "[Screenshot] Attached for reference.";
  }

  return `[Screenshot] ${parts.join(" ")}`;
}

export function appendScreenshotNotes(existing: string, reviewNotes: string): string {
  const trimmed = existing.trim();
  if (!trimmed) return reviewNotes;
  if (trimmed.includes("[Screenshot]")) return trimmed;
  return `${trimmed} ${reviewNotes}`;
}

export async function recognizeImageText(file: Blob): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("pol+eng", 1, {
    logger: () => {},
  });

  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text || "";
  } finally {
    await worker.terminate();
  }
}
