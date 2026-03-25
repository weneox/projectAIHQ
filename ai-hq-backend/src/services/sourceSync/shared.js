// src/services/sourceSync/shared.js
// FINAL v5.1 — hardened shared text/normalization helpers

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

function lower(v) {
  return s(v).toLowerCase();
}

function uniq(list = []) {
  return [...new Set(arr(list).map((x) => s(x)).filter(Boolean))];
}

function uniqBy(list = [], keyFn = (x) => x) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const key = s(keyFn(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function transliterateForCompare(text = "") {
  return s(text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[əƏ]/g, "e")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıIİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[çÇ]/g, "c");
}

function compactText(text = "", max = 600) {
  const value = s(text).replace(/\s+/g, " ").trim();
  const limit = Math.max(8, Number(max) || 600);

  if (!value) return "";
  if (value.length <= limit) return value;

  const slice = value.slice(0, limit - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const safeSlice =
    lastSpace >= Math.floor(limit * 0.6) ? slice.slice(0, lastSpace) : slice;

  return `${safeSlice.trim()}…`;
}

function cleanInlineText(text = "") {
  return s(text)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r/g, " ")
    .replace(/\t/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[•·▪▫●◦]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+—\s+/g, " — ")
    .replace(/\s+-\s+/g, " - ")
    .trim();
}

function normalizeListItem(x = "") {
  return compactText(
    cleanInlineText(x)
      .replace(/^[-–—•*]+\s*/, "")
      .replace(/^[\d]+[.)-]?\s*/, ""),
    220
  );
}

function normalizeCompareText(text = "") {
  return lower(transliterateForCompare(text))
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeKeyPart(x = "", fallback = "item", max = 64) {
  const v = normalizeCompareText(x)
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, Math.max(8, Number(max) || 64));

  return v || fallback;
}

function shouldKeepTextCandidate(text = "", min = 6) {
  const x = cleanInlineText(text);
  if (!x || x.length < min) return false;
  if (/^[\d\s\-–—./,:;]+$/.test(x)) return false;
  if (
    /^(home|about|about us|services|service|contact|contacts|more|read more|learn more|details|view more|menu|back|next|previous|blog|faq|support|pricing)$/i.test(
      x
    )
  ) {
    return false;
  }
  return true;
}

function sentenceSplit(text = "") {
  return s(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => cleanInlineText(x))
    .filter(Boolean);
}

function sentenceKey(text = "") {
  return normalizeCompareText(text).replace(/\s+/g, "");
}

function dedupeSentences(text = "", max = 1600) {
  const out = [];
  const seen = new Set();

  for (const part of sentenceSplit(text)) {
    const key = sentenceKey(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }

  return compactText(out.join(" "), max);
}

function tokenizeSet(text = "") {
  const words = normalizeCompareText(text)
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x.length >= 3);

  return new Set(words);
}

function jaccardSimilarity(a = "", b = "") {
  const sa = tokenizeSet(a);
  const sb = tokenizeSet(b);

  if (!sa.size || !sb.size) return 0;

  let intersection = 0;
  for (const w of sa) {
    if (sb.has(w)) intersection += 1;
  }

  const union = new Set([...sa, ...sb]).size;
  return union ? intersection / union : 0;
}

function isNearDuplicateText(a = "", b = "") {
  const aa = cleanInlineText(a);
  const bb = cleanInlineText(b);
  if (!aa || !bb) return false;

  const ka = sentenceKey(aa);
  const kb = sentenceKey(bb);

  if (ka && kb && ka === kb) return true;

  const sim = jaccardSimilarity(aa, bb);
  if (sim >= 0.86) return true;

  const shortA = normalizeCompareText(aa);
  const shortB = normalizeCompareText(bb);

  if (shortA && shortB) {
    if (shortA.includes(shortB) || shortB.includes(shortA)) {
      const shorter = Math.min(shortA.length, shortB.length);
      const longer = Math.max(shortA.length, shortB.length);
      if (shorter >= 30 && shorter / longer >= 0.72) return true;
    }
  }

  return false;
}

function dedupeTextList(list = [], { maxItems = 20, maxText = 500 } = {}) {
  const out = [];

  for (const raw of arr(list)) {
    const text = compactText(raw, maxText);
    if (!text) continue;

    const duplicate = out.some((x) => isNearDuplicateText(x, text));
    if (duplicate) continue;

    out.push(text);
    if (out.length >= maxItems) break;
  }

  return out;
}

function removeBrandTail(text = "", brand = "") {
  let x = cleanInlineText(text);
  const b = cleanInlineText(brand);

  if (!x) return "";
  if (!b) return x;

  const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  x = x
    .replace(new RegExp(`\\s+—\\s+${escaped}$`, "i"), "")
    .replace(new RegExp(`\\s+-\\s+${escaped}$`, "i"), "")
    .replace(new RegExp(`\\s+\\|\\s+${escaped}$`, "i"), "")
    .trim();

  return x;
}

function cleanSummaryText(text = "", brandHint = "") {
  let x = cleanInlineText(text);
  if (!x) return "";

  x = x
    .replace(/\bhome\b\s*—?\s*/gi, "")
    .replace(/\babout\b\s*—?\s*/gi, "")
    .replace(/\bservices\b\s*—?\s*/gi, "")
    .replace(/\bcontact\b\s*—?\s*/gi, "")
    .replace(/\bread more\b/gi, "")
    .replace(/\blearn more\b/gi, "")
    .replace(/\bAI\s+—\s+powered\b/gi, "AI-powered")
    .replace(/\bAI\s*-\s*powered\b/gi, "AI-powered")
    .replace(/\s+[|/]+\s+/g, " — ")
    .replace(/\s{2,}/g, " ")
    .trim();

  x = dedupeSentences(x, 1800);
  x = removeBrandTail(x, brandHint);
  x = compactText(x, 1800);

  return x;
}

function normalizeSummaryPart(text = "", brandHint = "") {
  let x = cleanSummaryText(text, brandHint);

  x = x
    .replace(/^[-—–:,;\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  x = dedupeSentences(x, 1200);

  return compactText(x, 1200);
}

function mergeLines(...lists) {
  return uniq(
    lists
      .flatMap((x) => arr(x))
      .map((x) => compactText(x, 320))
      .filter(Boolean)
  );
}

function isPlainRecord(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function humanizePlaceType(type = "") {
  return s(type)
    .replace(/^establishment$/i, "")
    .replace(/^point_of_interest$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(text = "") {
  const x = cleanInlineText(text);
  if (!x) return "";
  return x
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

export {
  arr,
  cleanInlineText,
  cleanSummaryText,
  compactText,
  dedupeSentences,
  dedupeTextList,
  humanizePlaceType,
  isNearDuplicateText,
  isPlainRecord,
  jaccardSimilarity,
  lower,
  mergeLines,
  n,
  normalizeCompareText,
  normalizeListItem,
  normalizeSummaryPart,
  obj,
  removeBrandTail,
  s,
  safeKeyPart,
  sentenceKey,
  sentenceSplit,
  shouldKeepTextCandidate,
  titleCase,
  tokenizeSet,
  uniq,
  uniqBy,
};