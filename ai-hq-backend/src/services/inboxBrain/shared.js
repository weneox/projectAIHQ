import { getDefaultTenantKey, resolveTenantKey } from "../../tenancy/index.js";

export function s(v) {
  return String(v ?? "").trim();
}

export function lower(v) {
  return s(v).toLowerCase();
}

export function arr(v) {
  return Array.isArray(v) ? v : [];
}

export function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function includesAny(text, words = []) {
  const hay = lower(text);
  return arr(words).some((w) => {
    const needle = lower(w);
    return needle && hay.includes(needle);
  });
}

export function pickString(x) {
  return typeof x === "string" ? x : "";
}

export function pickStringDeep(x) {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    if (typeof x.value === "string") return x.value;
    if (typeof x.text === "string") return x.text;
  }
  return "";
}

export function nowMs() {
  return Date.now();
}

export function toMs(v) {
  if (!v) return 0;

  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n;

  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}

export function uniqStrings(list = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const x = s(item);
    if (!x) continue;
    const k = lower(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }

  return out;
}

export function fixMojibake(input) {
  const t = String(input || "");
  if (!t) return t;

  if (!/[ÃÂ]|â€™|â€œ|â€�|â€“|â€”|â€¦/.test(t)) return t;

  try {
    const fixed = Buffer.from(t, "latin1").toString("utf8");
    if (/[�]/.test(fixed) && !/[�]/.test(t)) return t;
    return fixed;
  } catch {
    return t;
  }
}

export function getResolvedTenantKey(tenantKey) {
  return resolveTenantKey(tenantKey, getDefaultTenantKey());
}

export function normalizeTextForCompare(text) {
  return lower(text)
    .replace(/[?!.,;:()"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeReplyText(text) {
  let out = fixMojibake(s(text));
  if (!out) return "";

  out = out
    .replace(/\b(account manager|sales manager|manager|operator|agent)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  return out;
}