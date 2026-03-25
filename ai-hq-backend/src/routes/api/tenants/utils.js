import { dbAudit } from "../../../db/helpers/audit.js";

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

export function ok(res, data = {}) {
  return res.status(200).json({ ok: true, ...data });
}

export function bad(res, error, extra = {}) {
  return res.status(400).json({ ok: false, error, ...extra });
}

export function serverErr(res, error, extra = {}) {
  return res.status(500).json({ ok: false, error, ...extra });
}

export function rowOrNull(r) {
  return r?.rows?.[0] || null;
}

export function rows(r) {
  return Array.isArray(r?.rows) ? r.rows : [];
}

export function cleanString(v, fallback = "") {
  if (v === null || v === undefined) return String(fallback ?? "").trim();
  const s = String(v).trim();
  if (!s) return String(fallback ?? "").trim();
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
    return String(fallback ?? "").trim();
  }
  return s;
}

export function cleanNullableString(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;
  return s;
}

export function cleanLower(v, fallback = "") {
  return cleanString(v, fallback).toLowerCase();
}

export function cleanUpper(v, fallback = "") {
  return cleanString(v, fallback).toUpperCase();
}

export function asBool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  return fallback;
}

export function asJsonObj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

export function asJsonArr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
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

export function safeEmail(v) {
  return cleanLower(v);
}

export function isLikelyEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

export function defaultEnabledLanguages(input) {
  const arr = asJsonArr(input, ["az"])
    .map((x) => cleanLower(x))
    .filter(Boolean);
  return arr.length ? [...new Set(arr)] : ["az"];
}

export function normalizeUserRole(role) {
  const r = cleanLower(role, "member");
  if (
    r === "owner" ||
    r === "admin" ||
    r === "operator" ||
    r === "member" ||
    r === "marketer" ||
    r === "analyst"
  ) {
    return r;
  }
  return "member";
}

export function normalizeUserStatus(status) {
  const s = cleanLower(status, "invited");
  if (s === "invited" || s === "active" || s === "disabled" || s === "removed") {
    return s;
  }
  return "invited";
}

export function getActor(_req) {
  return "platform_admin";
}

export function ensureDb(res, db) {
  if (db?.query) return true;
  serverErr(res, "Database is not available");
  return false;
}

export async function auditSafe(db, actor, action, objectType, objectId, meta = {}) {
  try {
    await dbAudit(db, actor || "platform_admin", action, objectType, objectId, meta);
  } catch {}
}