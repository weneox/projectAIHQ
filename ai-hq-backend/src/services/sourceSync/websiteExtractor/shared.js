import { cfg } from "../../../config.js";
import { normalizeUrl, safeFetchText } from "../../../utils/http.js";

export { cfg, normalizeUrl, safeFetchText };

export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

export function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

export function lower(v) {
  return s(v).toLowerCase();
}

export function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

export function uniq(list = []) {
  return [...new Set(arr(list).map((x) => s(x)).filter(Boolean))];
}

export function uniqBy(list = [], keyFn = (x) => x) {
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

export function compactText(text = "", max = 600) {
  const x = s(text).replace(/\s+/g, " ").trim();
  if (!x) return "";
  if (x.length <= max) return x;
  return `${x.slice(0, Math.max(0, max - 1)).trim()}…`;
}