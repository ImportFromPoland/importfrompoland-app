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
  unitType: "unit" | "unknown";
  lineIndex: number;
}

type PriceUnitKind = "unit" | "m2" | "kg" | "netto" | "unknown";

function parsePriceGroups(g1: string, g2?: string): number | null {
  if (g2 !== undefined) {
    return parsePolishPrice(`${g1}.${g2}`);
  }
  return parsePolishPrice(g1);
}

function classifyUnitKind(context: string, nextLine = "", prevLine = ""): PriceUnitKind {
  const combined = `${prevLine}\n${context}\n${nextLine}`.toLowerCase();

  if (
    /m²|m2|m\^2|brutto\s*\/\s*m\b|\/\s*m²|\/\s*m2|za\s+m²|za\s+m2|metr\s*kw|\/\s*m\b(?!\w)|cena\s+za\s+m/i.test(
      combined
    )
  ) {
    return "m2";
  }
  if (/kg|kilogram|brutto\s*\/\s*kg|\/\s*kg\b|za\s+kg/i.test(combined)) {
    return "kg";
  }
  if (
    /brutto\s*\/\s*szt|\/\s*szt\.?|\bszt\.?\b|za\s*szt|na\s*sztuk|1\s*szt|jednostkow/i.test(
      combined
    )
  ) {
    return "unit";
  }
  if (/netto/.test(combined) && !/brutto/.test(combined)) {
    return "netto";
  }
  return "unknown";
}

function extractPriceFromLine(line: string): number | null {
  const patterns: Array<RegExp> = [
    /(\d{1,4}[.,]\d{2})\s*(?:zł|zl|z[łl1t]|PLN)\b/i,
    /(?:zł|zl|PLN)\s*(\d{1,4}[.,]\d{2})/i,
    /^(\d{1,3})\s+(\d{2})\s*(?:zł|zl|z)?\s*$/i,
    /^(\d{1,4}[.,]\d{2})\s*$/,
    /(\d{1,4}[.,]\d{2})\s*(?:zł|zl|z[łl1t])/i,
    /cena[:\s]*(\d{1,4}[.,]\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (!match) continue;
    const price =
      match[2] !== undefined && /^\d{2}$/.test(match[2])
        ? parsePriceGroups(match[1], match[2])
        : parsePolishPrice(match[1]);
    if (price !== null && price >= 0.01 && price <= 50000) {
      return price;
    }
  }
  return null;
}

/** Line-aware extraction — handles "37,99 zł" followed by "brutto / szt." on the next line. */
function extractPricesFromLines(source: string, regionBonus = 0): ScoredPrice[] {
  const lines = source.split(/\n/).map((l) => l.trim());
  const results: ScoredPrice[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const price = extractPriceFromLine(line);
    if (price === null) continue;

    const prev = lines[i - 1] || "";
    const next = lines[i + 1] || "";
    const next2 = lines[i + 2] || "";
    const unitKind = classifyUnitKind(line, `${next}\n${next2}`, prev);

    if (unitKind === "m2" || unitKind === "kg" || unitKind === "netto") {
      continue;
    }

    let score = 20 + regionBonus;
    let unitType: ScoredPrice["unitType"] = "unknown";

    if (unitKind === "unit") {
      score = 250 + regionBonus;
      unitType = "unit";
    } else if (/brutto/i.test(next) && !/m²|m2|\/\s*m/i.test(next)) {
      score = 180 + regionBonus;
      unitType = "unit";
    } else if (/^(?:zł|zl|pln|\d)/i.test(line) && /szt/i.test(`${next} ${next2}`)) {
      score = 200 + regionBonus;
      unitType = "unit";
    } else if (line.match(/zł|zl|z[łl1t]|PLN/i)) {
      score = 60 + regionBonus;
    }

    if (/cena\s+poprzednia|było|przecena|stara\s+cena|~~|-\s*\d/i.test(`${prev} ${line}`)) {
      score -= 80;
    }

    results.push({ price, score, unitType, lineIndex: i });
  }

  return results;
}

function extractPricesWithRegex(source: string, regionBonus = 0): ScoredPrice[] {
  const results: ScoredPrice[] = [];
  const patterns: Array<{ re: RegExp; bonus: number }> = [
    { re: /(\d{1,4}[.,]\d{2})\s*(?:zł|zl|z[łl1t]|PLN)\s*brutto\s*\/\s*szt/gi, bonus: 120 },
    { re: /(\d{1,4}[.,]\d{2})\s*(?:zł|zl|z[łl1t]|PLN)\s*\/\s*szt/gi, bonus: 110 },
    { re: /brutto\s*\/\s*szt[^0-9]{0,25}(\d{1,4}[.,]\d{2})/gi, bonus: 100 },
    { re: /(\d{1,3})\s+(\d{2})\s*(?:zł|zl|z[łl1t])/gi, bonus: 70 },
    { re: /(\d{1,4}[.,]\d{2})\s*(?:zł|zl|z[łl1t]|PLN)\b/gi, bonus: 30 },
    { re: /(?:zł|zl|PLN)\s*(\d{1,4}[.,]\d{2})/gi, bonus: 25 },
  ];

  for (const { re, bonus } of patterns) {
    const regex = new RegExp(re.source, re.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      const price =
        match[2] !== undefined && /^\d{2}$/.test(match[2])
          ? parsePriceGroups(match[1], match[2])
          : parsePolishPrice(match[1]);
      if (price === null) continue;

      const after = source.slice(match.index, match.index + match[0].length + 100);
      const before = source.slice(Math.max(0, match.index - 40), match.index);
      const nextLineStart = source.indexOf("\n", match.index + match[0].length);
      const nextLine =
        nextLineStart >= 0
          ? source.slice(nextLineStart + 1, nextLineStart + 80).split("\n")[0] || ""
          : "";

      const unitKind = classifyUnitKind(`${before}${match[0]}${after}`, nextLine);
      if (unitKind === "m2" || unitKind === "kg") continue;
      if (unitKind === "netto" && !/brutto/.test(after)) continue;

      let score = 10 + bonus + regionBonus;
      let unitType: ScoredPrice["unitType"] = "unknown";
      if (unitKind === "unit") {
        score += 150;
        unitType = "unit";
      }

      results.push({ price, score, unitType, lineIndex: match.index });
    }
  }

  return results;
}

function extractScoredPrices(text: string): ScoredPrice[] {
  const bodyIdx = text.indexOf(BODY_MARKER);
  const body = bodyIdx >= 0 ? text.slice(bodyIdx + BODY_MARKER.length) : text;
  const priceRegionEnd = body.indexOf("__PRICE_REGION_END__");
  const priceRegion = priceRegionEnd >= 0 ? body.slice(0, priceRegionEnd) : "";
  const mainBody = priceRegionEnd >= 0 ? body.slice(priceRegionEnd + "__PRICE_REGION_END__".length) : body;

  const fromPriceRegion = priceRegion.trim()
    ? [
        ...extractPricesFromLines(priceRegion, 80),
        ...extractPricesWithRegex(priceRegion, 80),
      ]
    : [];

  const fromMain = [
    ...extractPricesFromLines(mainBody, 0),
    ...extractPricesWithRegex(mainBody, 0),
  ];

  const all = [...fromPriceRegion, ...fromMain];

  const deduped = new Map<number, ScoredPrice>();
  for (const item of all) {
    const key = item.price;
    const existing = deduped.get(key);
    if (!existing || item.score > existing.score) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()];
}

function pickBestPrice(scored: ScoredPrice[]): { price: number | null; confidence: OcrConfidence } {
  if (scored.length === 0) {
    return { price: null, confidence: "none" };
  }

  const unitPrices = scored.filter((s) => s.unitType === "unit");
  if (unitPrices.length > 0) {
    unitPrices.sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex);
    const best = unitPrices[0];
    return {
      price: best.price,
      confidence: best.score >= 150 ? "high" : "low",
    };
  }

  scored.sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex);
  const best = scored[0];

  if (best.score >= 80) {
    return { price: best.price, confidence: "low" };
  }

  if (best.score >= 40) {
    return { price: best.price, confidence: "low" };
  }

  return { price: null, confidence: "none" };
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
    if (part.toLowerCase() === "lidl") return "Lidl";
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

async function cropRegion(
  file: Blob,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  try {
    const bitmap = await createImageBitmap(file);
    const x = Math.floor(bitmap.width * xRatio);
    const y = Math.floor(bitmap.height * yRatio);
    const w = Math.max(1, Math.floor(bitmap.width * wRatio));
    const h = Math.max(1, Math.floor(bitmap.height * hRatio));
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

async function cropPriceRegions(file: Blob): Promise<string[]> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("pol+eng", 1, { logger: () => {} });

  const regions = [
    { x: 0.5, y: 0.15, w: 0.48, h: 0.28 },
    { x: 0.35, y: 0.12, w: 0.6, h: 0.32 },
    { x: 0.55, y: 0.1, w: 0.42, h: 0.35 },
  ];

  const texts: string[] = [];

  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });

    for (const r of regions) {
      const crop = await cropRegion(file, r.x, r.y, r.w, r.h);
      if (!crop) continue;
      const {
        data: { text },
      } = await worker.recognize(crop);
      if (text?.trim()) texts.push(text.trim());
    }

    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  } finally {
    await worker.terminate();
  }

  return texts;
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

    const priceTexts = await cropPriceRegions(file);
    const priceText = priceTexts.join("\n---\n");

    const {
      data: { text: fullText },
    } = await worker.recognize(file);

    return `${URL_BAR_MARKER}\n${topText}\n${BODY_MARKER}\n${priceText}\n__PRICE_REGION_END__\n${fullText || ""}`;
  } finally {
    await worker.terminate();
  }
}
