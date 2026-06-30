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
  /cena[:\s]*(\d{1,3}(?:[\s\u00a0]\d{3})*(?:[.,]\d{1,2})?)/gi,
];

const URL_BAR_MARKER = "__URL_BAR__";
const BODY_MARKER = "__BODY__";

const BLOCKED_HOSTS = [
  "google.",
  "facebook.",
  "gstatic.",
  "chrome.",
  "mozilla.",
  "apple.com",
  "microsoft.com",
  "bing.com",
];

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

/** Fix common OCR breaks inside URLs (spaces, split protocol). */
function deOcrUrlChunk(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/[|]/g, "l")
    .replace(/h\s*t\s*t\s*p\s*s?\s*:\s*\/\s*\/\s*/gi, "https://")
    .replace(/http\s*:\s*\/\s*\/\s*/gi, "http://")
    .replace(/\s+/g, "");
}

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return BLOCKED_HOSTS.some((h) => lower.includes(h));
}

function tryParseUrl(candidate: string): URL | null {
  const cleaned = deOcrUrlChunk(candidate).replace(/[.,;)\]'"]+$/, "");
  if (!cleaned || cleaned.length < 8) return null;

  const attempts = [
    cleaned,
    cleaned.startsWith("http") ? cleaned : `https://${cleaned}`,
    cleaned.replace(/^https?:\/\//i, "https://www."),
  ];

  for (const attempt of attempts) {
    try {
      const url = new URL(attempt);
      if (!url.hostname.includes(".")) continue;
      if (isBlockedHost(url.hostname)) continue;
      return url;
    } catch {
      continue;
    }
  }
  return null;
}

function scoreUrl(url: URL, fromUrlBar: boolean): number {
  let score = url.href.length;
  if (fromUrlBar) score += 500;
  if (url.pathname.length > 1) score += 100;
  if (url.hostname.endsWith(".pl")) score += 50;
  if (url.hostname.startsWith("www.")) score += 20;
  return score;
}

function collectUrlCandidates(text: string): Array<{ url: URL; fromUrlBar: boolean }> {
  const results: Array<{ url: URL; fromUrlBar: boolean }> = [];
  const seen = new Set<string>();

  const addFromChunk = (chunk: string, fromUrlBar: boolean) => {
    const patterns = [
      /https?:\/\/[\w./%?\-\s=&+#:]+/gi,
      /(?:www\.)?[a-z0-9][\w.\-]*\.(?:pl|com|eu|net|org|shop)(?:\/[\w./%?\-\s=&+#:]*)?/gi,
    ];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(chunk)) !== null) {
        const parsed = tryParseUrl(match[0]);
        if (!parsed) continue;
        const key = parsed.href.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ url: parsed, fromUrlBar });
      }
    }
  };

  const urlBarIdx = text.indexOf(URL_BAR_MARKER);
  const bodyIdx = text.indexOf(BODY_MARKER);

  if (urlBarIdx >= 0 && bodyIdx > urlBarIdx) {
    addFromChunk(text.slice(urlBarIdx + URL_BAR_MARKER.length, bodyIdx), true);
    addFromChunk(text.slice(bodyIdx + BODY_MARKER.length), false);
  } else {
    addFromChunk(text, false);
  }

  return results;
}

function extractUrl(text: string): { url: string; confidence: OcrConfidence } {
  const candidates = collectUrlCandidates(text);
  if (candidates.length === 0) {
    return { url: "", confidence: "none" };
  }

  candidates.sort(
    (a, b) => scoreUrl(b.url, b.fromUrlBar) - scoreUrl(a.url, a.fromUrlBar)
  );

  const best = candidates[0];
  const href = best.url.href;

  let confidence: OcrConfidence = "low";
  if (best.fromUrlBar && best.url.pathname.length > 1) {
    confidence = "high";
  } else if (candidates.length === 1 && href.length > 20) {
    confidence = "high";
  }

  return { url: href, confidence };
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

function isBreadcrumb(line: string): boolean {
  if (line.includes(">")) return true;
  if (/strona\s+główna|strona glowna|produkty|products|home\s*[/\\]/i.test(line)) {
    return true;
  }
  return false;
}

function extractProductName(text: string): string {
  const bodyIdx = text.indexOf(BODY_MARKER);
  const body = bodyIdx >= 0 ? text.slice(bodyIdx + BODY_MARKER.length) : text;

  const lines = body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const candidates = lines.filter((line) => {
    if (line.length < 8 || line.length > 200) return false;
    if (isBreadcrumb(line)) return false;
    if (/https?:\/\//i.test(line)) return false;
    if (/(?:zł|zl|pln)\b/i.test(line) && /\d/.test(line)) return false;
    if (/^(koszyk|cart|menu|szukaj|search|zaloguj|login|dodaj do)/i.test(line)) return false;
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
  const product_name = extractProductName(normalized);

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

async function cropTopRegion(file: Blob, heightRatio = 0.14): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  try {
    const bitmap = await createImageBitmap(file);
    const cropH = Math.max(48, Math.floor(bitmap.height * heightRatio));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, bitmap.width, cropH, 0, 0, bitmap.width, cropH);
    bitmap.close();

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch {
    return null;
  }
}

export async function recognizeImageText(file: Blob): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("pol+eng", 1, {
    logger: () => {},
  });

  try {
    const topCrop = await cropTopRegion(file);
    let topText = "";

    if (topCrop) {
      const {
        data: { text },
      } = await worker.recognize(topCrop);
      topText = text || "";
    }

    const {
      data: { text: fullText },
    } = await worker.recognize(file);

    return `${URL_BAR_MARKER}\n${topText}\n${BODY_MARKER}\n${fullText || ""}`;
  } finally {
    await worker.terminate();
  }
}
