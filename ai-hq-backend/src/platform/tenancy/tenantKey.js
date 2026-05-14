export const RESERVED_TENANT_KEYS = new Set([
  "www",
  "api",
  "hq",
  "mail",
  "docs",
  "status",
  "admin",
  "app",
  "cdn",
  "assets",
  "blog",
  "help",
  "support",
  "auth",
  "m",
  "dev",
  "staging",
  "demo",
]);

function cleanString(v, fallback = "") {
  if (v === null || v === undefined) return String(fallback ?? "").trim();
  const s = String(v).trim();
  if (!s) return String(fallback ?? "").trim();
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
    return String(fallback ?? "").trim();
  }
  return s;
}

function cleanLower(v, fallback = "") {
  return cleanString(v, fallback).toLowerCase();
}

export function slugTenantKey(v) {
  const raw = cleanLower(v);
  if (!raw) return "";

  return raw
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function validTenantKey(v) {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(String(v || ""));
}

export function isReservedTenantKey(v) {
  return RESERVED_TENANT_KEYS.has(cleanLower(v));
}
