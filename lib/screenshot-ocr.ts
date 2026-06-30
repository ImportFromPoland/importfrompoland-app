export type OcrConfidence = "high" | "low" | "none";

export interface OcrParseResult {
  unit_price: number | null;
  website_url: string;
  product_name: string;
  supplier_name: string;
  price_confidence: OcrConfidence;
  url_confidence: OcrConfidence;
  raw_text: string;
}

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

/** Valid URL path/query characters only (strip OCR noise after last valid char). */
const URL_CHAR = /[a-zA-Z0-9\-._~:/?#@!$&'()*+,;=%]/;

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

interface ScoredPrice {
  price: number;
  score: number;
}

function extractScoredPrices(text: string): ScoredPrice[] {
  const results: ScoredPrice[] = [];
  const bodyIdx = text.indexOf(BODY_MARKER);
  const body = bodyIdx >= 0 ? text.slice(bodyIdx + BODY_MARKER.length) : text;
  const priceRegionEnd = body.indexOf("__PRICE_REGION_END__");
  const priceRegion = priceRegionEnd >= 0 ? body.slice(0, priceRegionEnd) : "";
  const mainBody = priceRegionEnd >= 0 ? body.slice(priceRegionEnd + "__PRICE_REGION_END__".length) : body;

  const patterns = [
    /(\d{1,4}[.,]\d{2})\s*(?:zł|zl|z[łl1t]|PLN)\s*brutto\s*\/\s*szt/gi,
    /(\d{1,4}[.,]\d{2})\s*(?:zł|zl|z[łl1t]|PLN)\s*brutto/gi,
    /brutto\s*\/\s*szt[^0-9]{0,20}(\d{1,4}[.,]\d{2})/gi,
    /(\d{1,4}[.,]\d{2})\s*(?:zł|zl|z[łl1t]|PLN)\b/gi,
    /(?:zł|zl|PLN)\s*(\d{1,4}[.,]\d{2})/gi,
    /cena[:\s]*(\d{1,4}[.,]\d{2})/gi,
  ];

  const searchIn = (source: string, regionBonus: number) => {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(source)) !== null) {
        const price = parsePolishPrice(match[1]);
        if (price === null) continue;

        const start = Math.max(0, match.index - 30);
        const end = Math.min(source.length, match.index + match[0].length + 40);
        const context = source.slice(start, end).toLowerCase();

        let score = 10 + regionBonus;
        if (/brutto/.test(context)) score += 80;
        if (/\/\s*szt|brutto\s*\/\s*szt|\/szt/.test(context)) score += 100;
        if (/\bszt\b/.test(context)) score += 40;
        if (/m²|m2|\/\s*m|metr kwadrat|za m/.test(context)) score -= 120;
        if (/netto/.test(context) && !/brutto/.test(context)) score -= 60;
        if (pattern.source.includes("brutto")) score += 30;

        results.push({ price, score });
      }
    }
  };

  if (priceRegion.trim()) searchIn(priceRegion, 150);
  searchIn(mainBody, 0);

  return results;
}

function pickBestPrice(scored: ScoredPrice[]): { price: number | null; confidence: OcrConfidence } {
  if (scored.length === 0) {
    return { price: null, confidence: "none" };
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const tied = scored.filter((s) => s.score === best.score);

  if (best.score >= 100) {
    return { price: best.price, confidence: "high" };
  }
  if (best.score >= 50 && tied.length === 1) {
    return { price: best.price, confidence: "high" };
  }
  if (best.score >= 20) {
    return { price: best.price, confidence: "low" };
  }

  return { price: best.price, confidence: "low" };
}

function deOcrUrlChunk(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/[|]/g, "l")
    .replace(/h\s*t\s*t\s*p\s*s?\s*:\s*\/\s*\/\s*/gi, "https://")
    .replace(/http\s*:\s*\/\s*\/\s*/gi, "http://")
    .replace(/\s+/g, "");
}

/** Trim OCR junk after the real end of a product URL (.html, numeric id, etc.). */
function trimUrlTail(raw: string): string {
  let s = raw;

  const htmlMatch = s.match(/^(.*\.html)/i);
  if (htmlMatch) {
    return htmlMatch[1];
  }

  const articleMatch = s.match(/^(.*\/\d{5,})/);
  if (articleMatch) {
    return articleMatch[1];
  }

  while (s.length > 0) {
    const last = s[s.length - 1];
    if (URL_CHAR.test(last)) break;
    s = s.slice(0, -1);
  }

  s = s.replace(/(\.html)[a-zA-Z]{1,4}$/i, "$1");
  s = s.replace(/([a-z0-9\-])([A-Z]{2,})$/i, "$1");

  return s;
}

function sanitizeUrlString(raw: string): string {
  let s = deOcrUrlChunk(raw);

  const protocolMatch = s.match(/https?:\/\//i);
  if (protocolMatch) {
    const start = s.toLowerCase().indexOf(protocolMatch[0].toLowerCase());
    s = s.slice(start);
  }

  let out = "";
  for (const ch of s) {
    if (URL_CHAR.test(ch)) {
      out += ch;
    } else {
      break;
    }
  }

  if (!out.startsWith("http") && /^www\./i.test(out)) {
    out = `https://${out}`;
  } else if (!out.startsWith("http") && /^[a-z0-9][\w.-]*\.[a-z]{2,}/i.test(out)) {
    out = `https://${out}`;
  }

  return trimUrlTail(out);
}

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return BLOCKED_HOSTS.some((h) => lower.includes(h));
}

function formatUrlForStorage(url: URL): string {
  let href = url.href;
  if (url.pathname !== "/" && href.endsWith("/")) {
    href = href.slice(0, -1);
  }
  return href;
}

function tryParseUrl(candidate: string): URL | null {
  const cleaned = sanitizeUrlString(candidate);
  if (!cleaned || cleaned.length < 10) return null;

  const attempts = [
    cleaned,
    cleaned.replace(/^https?:\/\/(?!www\.)/i, (m) => m + "www."),
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

function mergeUrlBarLines(urlBarText: string): string[] {
  const lines = urlBarText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const merged: string[] = [];
  let buffer = "";

  for (const line of lines) {
    const looksLikeUrl =
      /https?:\/\//i.test(line) ||
      /^www\./i.test(line) ||
      /\.(pl|com|eu|net)\b/i.test(line) ||
      (buffer.length > 0 && /^[\w./\-]+/.test(line));

    if (looksLikeUrl || buffer) {
      buffer += line;
      if (/\.html\b/i.test(buffer) || /\d{6,}/.test(buffer) || buffer.length > 80) {
        merged.push(buffer);
        buffer = "";
      }
    } else {
      merged.push(line);
    }
  }
  if (buffer) merged.push(buffer);

  const deocr = merged.map(deOcrUrlChunk);
  if (deocr.length > 1) {
    const joined = deocr.join("");
    return [joined, ...deocr];
  }
  return deocr;
}

function scoreUrl(url: URL, fromUrlBar: boolean, rawLength: number): number {
  let score = rawLength;
  if (fromUrlBar) score += 1000;
  if (url.pathname.length > 20) score += 200;
  if (/\.html$/i.test(url.pathname)) score += 300;
  if (/\d{5,}/.test(url.pathname)) score += 150;
  if (url.hostname.endsWith(".pl")) score += 50;
  if (url.hostname.startsWith("www.")) score += 30;
  return score;
}

function collectUrlCandidates(text: string): Array<{ url: URL; fromUrlBar: boolean; rawLength: number }> {
  const results: Array<{ url: URL; fromUrlBar: boolean; rawLength: number }> = [];
  const seen = new Set<string>();

  const addCandidate = (raw: string, fromUrlBar: boolean) => {
    const parsed = tryParseUrl(raw);
    if (!parsed) return;
    const key = parsed.href.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ url: parsed, fromUrlBar, rawLength: raw.length });
  };

  const urlBarIdx = text.indexOf(URL_BAR_MARKER);
  const bodyIdx = text.indexOf(BODY_MARKER);

  if (urlBarIdx >= 0 && bodyIdx > urlBarIdx) {
    const urlBarText = text.slice(urlBarIdx + URL_BAR_MARKER.length, bodyIdx);
    for (const chunk of mergeUrlBarLines(urlBarText)) {
      addCandidate(chunk, true);
    }
    const deocrFull = deOcrUrlChunk(urlBarText.replace(/\n/g, ""));
    addCandidate(deocrFull, true);
  }

  const bodyText = bodyIdx >= 0 ? text.slice(bodyIdx + BODY_MARKER.length) : text;
  const bodyPatterns = [
    /https?:\/\/[a-zA-Z0-9\-._~:/?#@!$&'()*+,;=%]+/gi,
    /(?:www\.)?[a-z0-9][\w.\-]*\.(?:pl|com|eu|net)(?:\/[a-zA-Z0-9\-._~:/?#@!$&'()*+,;=%]*)?/gi,
  ];
  for (const pattern of bodyPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(bodyText)) !== null) {
      addCandidate(match[0], false);
    }
  }

  return results;
}

function extractUrl(text: string): { url: string; confidence: OcrConfidence } {
  const candidates = collectUrlCandidates(text);
  if (candidates.length === 0) {
    return { url: "", confidence: "none" };
  }

  candidates.sort(
    (a, b) => scoreUrl(b.url, b.fromUrlBar, b.rawLength) - scoreUrl(a.url, a.fromUrlBar, a.rawLength)
  );

  const best = candidates[0];
  const href = formatUrlForStorage(best.url);

  let confidence: OcrConfidence = "low";
  if (best.fromUrlBar && /\.html$/i.test(best.url.pathname)) {
    confidence = "high";
  } else if (best.fromUrlBar && best.url.pathname.length > 30) {
    confidence = "high";
  } else if (candidates.length === 1 && href.length > 40) {
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
    if (part.toLowerCase() === "leroymerlin") return "Leroy Merlin";
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  } catch {
    return "";
  }
}

function isBreadcrumb(line: string): boolean {
  if (line.includes(">")) return true;
  if (/strona\s+główna|strona glowna|^produkty\b|^products\b/i.test(line)) return true;
  return false;
}

function isGarbageProductLine(line: string): boolean {
  if (/^<|>\s*$|sprzedawane|wysyłane|wysylane|dostarczane|leroy merlin/i.test(line)) {
    return true;
  }
  if (/^\W+$/.test(line)) return true;
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
    if (line.length < 10 || line.length > 200) return false;
    if (isBreadcrumb(line)) return false;
    if (isGarbageProductLine(line)) return false;
    if (/https?:\/\//i.test(line)) return false;
    if (/(?:zł|zl|pln)\b/i.test(line) && /\d/.test(line)) return false;
    if (/^(koszyk|cart|menu|szukaj|search|zaloguj|login|dodaj do|numer artyku)/i.test(line)) {
      return false;
    }
    return /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]{4,}/.test(line);
  });

  if (candidates.length === 0) return "";

  candidates.sort((a, b) => {
    const score = (s: string) => {
      let n = s.length;
      if (/płyta|gips|typ|mm|norgips|produkt/i.test(s)) n += 50;
      if (/\d+\s*x\s*\d+/i.test(s)) n += 30;
      return n;
    };
    return score(b) - score(a);
  });

  return candidates[0].slice(0, 200);
}

export function parseOcrText(text: string): OcrParseResult {
  const normalized = text.replace(/\r/g, "\n");
  const scoredPrices = extractScoredPrices(normalized);
  const { price, confidence: price_confidence } = pickBestPrice(scoredPrices);
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

async function cropTopRegion(file: Blob, heightRatio = 0.1): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  try {
    const bitmap = await createImageBitmap(file);
    const cropH = Math.max(56, Math.floor(bitmap.height * heightRatio));
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

async function cropPriceRegion(file: Blob): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  try {
    const bitmap = await createImageBitmap(file);
    const x = Math.floor(bitmap.width * 0.52);
    const y = Math.floor(bitmap.height * 0.22);
    const w = Math.floor(bitmap.width * 0.45);
    const h = Math.floor(bitmap.height * 0.22);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, x, y, w, h, 0, 0, w, h);
    bitmap.close();

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch {
    return null;
  }
}

export async function recognizeImageText(file: Blob): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("pol+eng", 1, {
    logger: () => {},
  });

  try {
    const topCrop = await cropTopRegion(file);
    let topText = "";

    if (topCrop) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
      const {
        data: { text },
      } = await worker.recognize(topCrop);
      topText = text || "";
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    }

    const priceCrop = await cropPriceRegion(file);
    let priceText = "";
    if (priceCrop) {
      const {
        data: { text },
      } = await worker.recognize(priceCrop);
      priceText = text || "";
    }

    const {
      data: { text: fullText },
    } = await worker.recognize(file);

    return `${URL_BAR_MARKER}\n${topText}\n${BODY_MARKER}\n${priceText}\n__PRICE_REGION_END__\n${fullText || ""}`;
  } finally {
    await worker.terminate();
  }
}
