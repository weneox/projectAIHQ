import {
  requireInternalToken,
  getAuthTenantKey,
  getRequestedTenantKey,
  getAuthRole,
  getAuthActor,
} from "../../../utils/auth.js";
import { dbAudit } from "../../../db/helpers/audit.js";

export function ok(res, data = {}) {
  return res.status(200).json({ ok: true, ...data });
}

export function bad(res, error, extra = {}) {
  return res.status(400).json({ ok: false, error, ...extra });
}

export function forbidden(res, error = "Forbidden", extra = {}) {
  return res.status(403).json({ ok: false, error, ...extra });
}

export function unauth(res, error = "Unauthorized", extra = {}) {
  return res.status(401).json({ ok: false, error, ...extra });
}

export function serverErr(res, error, extra = {}) {
  return res.status(500).json({ ok: false, error, ...extra });
}

export function safeJsonObj(v, fallback = {}) {
  if (v && typeof v === "object" && !Array.isArray(v)) return v;
  return fallback;
}

export function safeJsonArr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
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

export function normalizeBool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  return fallback;
}

export function normalizeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeJsonDateish(v) {
  const s = cleanNullableString(v);
  return s || null;
}

export function hasDb(db) {
  return !!db?.query;
}

export function requireDb(res, db) {
  if (hasDb(db)) return true;
  serverErr(res, "Database is not available");
  return false;
}

export function isInternalServiceRequest(req) {
  try {
    return requireInternalToken(req) === true;
  } catch {
    return false;
  }
}

export function getUserRole(req) {
  return cleanLower(getAuthRole(req), "member");
}

export function getActor(req) {
  return cleanNullableString(getAuthActor(req)) || "system";
}

export function resolveTenantKey(req) {
  if (isInternalServiceRequest(req)) {
    return cleanLower(getRequestedTenantKey(req));
  }

  return cleanLower(getAuthTenantKey(req));
}

export function requireTenant(req, res) {
  const tenantKey = resolveTenantKey(req);
  if (!tenantKey) {
    unauth(res, "Missing tenant context");
    return null;
  }
  return tenantKey;
}

export function requireOwnerOrAdmin(req, res) {
  if (isInternalServiceRequest(req)) {
    return "internal";
  }

  const role = getUserRole(req);
  if (role !== "owner" && role !== "admin") {
    forbidden(res, "Only owner/admin can manage settings");
    return null;
  }
  return role;
}

export function requireOperationalManager(req, res) {
  if (isInternalServiceRequest(req)) {
    return "internal";
  }

  const role = getUserRole(req);
  if (role !== "owner" && role !== "admin" && role !== "operator") {
    forbidden(
      res,
      "Only owner/admin/operator can manage operational settings"
    );
    return null;
  }
  return role;
}

export async function auditSafe(db, req, tenant, action, objectType, objectId, meta = {}) {
  try {
    await dbAudit(db, getActor(req), action, objectType, objectId, {
      tenantId: tenant?.id || null,
      tenantKey: tenant?.tenant_key || tenant?.tenantKey || null,
      viewerRole: isInternalServiceRequest(req) ? "internal" : getUserRole(req),
      ...meta,
    });
  } catch {}
}
