import { cleanLower, cleanString, hasDb, serverErr, unauth } from "./utils.js";

export function getAuthTenantKey(req) {
  return cleanLower(req.auth?.tenantKey || "");
}

export function getAuthRole(req) {
  return cleanLower(req.auth?.role || "member");
}

export function getAuthActor(req) {
  return cleanString(req.auth?.email || req.auth?.userId || "user");
}

export function canReadUsers(role) {
  return ["owner", "admin", "operator"].includes(cleanLower(role));
}

export function canWriteUsers(role) {
  return ["owner", "admin"].includes(cleanLower(role));
}

export function requireDb(res, db) {
  if (hasDb(db)) return true;
  serverErr(res, "Database is not available");
  return false;
}

export function requireTenant(req, res) {
  const tenantKey = getAuthTenantKey(req);
  if (!tenantKey) {
    unauth(res, "Missing authenticated tenant context");
    return null;
  }
  return tenantKey;
}