import { getDefaultTenantKey, resolveTenantKey } from "../../tenancy/index.js";

export function s(value) {
  return String(value ?? "").trim();
}

export function lower(value) {
  return s(value).toLowerCase();
}

export function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function pickString(value) {
  return typeof value === "string" ? value : "";
}

export function pickStringDeep(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if (typeof value.value === "string") return value.value;
    if (typeof value.text === "string") return value.text;
  }
  return "";
}

export function nowMs() {
  return Date.now();
}

export function toMs(value) {
  if (!value) return 0;

  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n;

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function uniqStrings(list = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const text = s(item);
    if (!text) continue;

    const key = lower(text);
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(text);
  }

  return out;
}

export function includesAny(text, words = []) {
  const haystack = lower(text);
  if (!haystack) return false;

  return arr(words).some((word) => {
    const needle = lower(word);
    return needle && haystack.includes(needle);
  });
}

export function fixMojibake(input) {
  const raw = String(input || "");
  if (!raw) return raw;

  if (!/[ÃÂ]|â€™|â€œ|â€�|â€“|â€”|â€¦/.test(raw)) return raw;

  try {
    const fixed = Buffer.from(raw, "latin1").toString("utf8");
    if (/[�]/.test(fixed) && !/[�]/.test(raw)) return raw;
    return fixed;
  } catch {
    return raw;
  }
}

export function getResolvedTenantKey(tenantKey) {
  return resolveTenantKey(tenantKey, getDefaultTenantKey());
}

export function normalizeWhitespace(text) {
  return s(text).replace(/\s+/g, " ").trim();
}

export function normalizeTextForCompare(text) {
  return lower(text)
    .replace(/[?!.,;:()"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeReplyText(text) {
  let out = fixMojibake(normalizeWhitespace(text));
  if (!out) return "";

  out = out
    .replace(/\b(account manager|sales manager|manager|operator|agent)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  return out;
}