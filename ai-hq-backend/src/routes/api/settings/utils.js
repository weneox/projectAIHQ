import {
  requireInternalToken,
  getAuthTenantKey,
  getRequestedTenantKey,
  getAuthRole,
  getNormalizedAuthRole,
  getAuthActor,
} from "../../../utils/auth.js";
import { dbAudit } from "../../../db/helpers/audit.js";
import { canManageSettings, canReadAudit } from "../../../utils/roles.js";
import { getTenantCapability } from "../../../services/tenantEntitlements.js";

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
  return cleanLower(getNormalizedAuthRole(req), "member");
}

export function getViewerRole(req) {
  return isInternalServiceRequest(req) ? "internal" : getUserRole(req);
}

export function getActor(req) {
  return cleanNullableString(getAuthActor(req)) || "system";
}

export function buildMutationAuditMeta(req, meta = {}) {
  return {
    actorType: isInternalServiceRequest(req) ? "internal_service" : "user",
    actorId: getActor(req),
    actorRole: getViewerRole(req),
    requestId: cleanNullableString(req?.requestId),
    correlationId: cleanNullableString(req?.correlationId),
    outcome: cleanLower(meta?.outcome || "succeeded"),
    reasonCode: cleanLower(meta?.reasonCode || ""),
    targetArea: cleanLower(meta?.targetArea || meta?.area || ""),
    ...meta,
  };
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
  if (!canManageSettings(role)) {
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

export function canReadControlPlaneAuditHistoryRole(role = "") {
  return canReadAudit(role);
}

export function requireAuditHistoryReader(req, res) {
  if (isInternalServiceRequest(req)) {
    return "internal";
  }

  const role = getUserRole(req);
  if (!canReadControlPlaneAuditHistoryRole(role)) {
    forbidden(res, "Only owner/admin/analyst can read control-plane audit history", {
      reasonCode: "insufficient_role",
      viewerRole: role,
      requiredRoles: ["owner", "admin", "analyst"],
    });
    return null;
  }

  return role;
}

export async function requireMutationRole(
  req,
  res,
  {
    db,
    tenant = null,
    allowedRoles = ["owner", "admin"],
    message = "Only owner/admin can manage this control-plane mutation",
    reasonCode = "insufficient_role",
    auditAction = "settings.mutation.blocked",
    objectType = "tenant_setting",
    objectId = "",
    targetArea = "control_plane",
    auditMeta = {},
  } = {}
) {
  if (isInternalServiceRequest(req)) {
    return "internal";
  }

  const role = getUserRole(req);
  const normalizedAllowed = Array.isArray(allowedRoles)
    ? allowedRoles.map((item) => cleanLower(item)).filter(Boolean)
    : [];

  if (normalizedAllowed.includes(role)) {
    return role;
  }

  await auditSafe(
    db,
    req,
    tenant || { tenant_key: resolveTenantKey(req) || null },
    auditAction,
    objectType,
    objectId || tenant?.id || tenant?.tenant_key || resolveTenantKey(req) || "unknown",
    {
      outcome: "blocked",
      reasonCode,
      targetArea,
      attemptedRole: role,
      requiredRoles: normalizedAllowed,
      ...auditMeta,
    }
  );

  forbidden(res, message, {
    reasonCode,
    viewerRole: role,
    requiredRoles: normalizedAllowed,
  });
  return null;
}

export async function requireOwnerOrAdminMutation(
  req,
  res,
  options = {}
) {
  return requireMutationRole(req, res, {
    allowedRoles: ["owner", "admin"],
    ...options,
  });
}

export async function requireSettingsWriteMutation(
  req,
  res,
  options = {}
) {
  return requireMutationRole(req, res, {
    allowedRoles: ["owner", "admin"],
    message: "Only owner/admin can manage settings",
    reasonCode: "insufficient_role",
    auditAction: "settings.mutation.blocked",
    objectType: "tenant_setting",
    targetArea: "settings",
    ...options,
  });
}

export async function requireTenantCapabilityMutation(
  req,
  res,
  {
    db,
    tenant = null,
    capabilityKey = "",
    message = "This action is not available for the current workspace plan",
    reasonCode = "plan_capability_restricted",
    auditAction = "settings.mutation.blocked",
    objectType = "tenant_setting",
    objectId = "",
    targetArea = "settings",
    auditMeta = {},
  } = {}
) {
  const capability = getTenantCapability(tenant, capabilityKey);

  if (!capability || capability.allowed !== false) {
    return capability || { allowed: true };
  }

  await auditSafe(
    db,
    req,
    tenant || { tenant_key: resolveTenantKey(req) || null },
    auditAction,
    objectType,
    objectId || tenant?.id || tenant?.tenant_key || resolveTenantKey(req) || "unknown",
    {
      outcome: "blocked",
      reasonCode,
      targetArea,
      capabilityKey,
      planKey: capability.planKey,
      normalizedPlanKey: capability.normalizedPlanKey,
      requiredPlans: capability.requiredPlans,
      ...auditMeta,
    }
  );

  forbidden(res, capability.message || message, {
    reasonCode,
    capabilityKey,
    planKey: capability.planKey,
    normalizedPlanKey: capability.normalizedPlanKey,
    requiredPlans: capability.requiredPlans,
  });
  return null;
}

export async function auditSafe(db, req, tenant, action, objectType, objectId, meta = {}) {
  try {
    await dbAudit(db, getActor(req), action, objectType, objectId, {
      tenantId: tenant?.id || null,
      tenantKey: tenant?.tenant_key || tenant?.tenantKey || null,
      viewerRole: isInternalServiceRequest(req) ? "internal" : getUserRole(req),
      ...buildMutationAuditMeta(req, meta),
    });
  } catch {}
}
