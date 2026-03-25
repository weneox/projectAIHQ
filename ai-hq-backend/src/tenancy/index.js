import { cfg } from "../config.js";
import {
  getAuthTenantKey,
  getAuthTenantId,
  getRequestedTenantKey,
  getRequestedTenantId,
} from "../utils/auth.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

export function getDefaultTenantKey() {
  return lower(cfg.DEFAULT_TENANT_KEY, "default");
}

export function resolveTenantKey(input, fallback = "") {
  const x = lower(input);
  if (x) return x;

  const f = lower(fallback);
  if (f) return f;

  return getDefaultTenantKey();
}

export function resolveTenantId(input, fallback = "") {
  const x = s(input);
  if (x) return x;

  const f = s(fallback);
  if (f) return f;

  return "";
}

export function resolveTenantKeyFromReq(req, fallback = "") {
  const authTenantKey = getAuthTenantKey(req);
  if (authTenantKey) {
    return resolveTenantKey(authTenantKey, fallback);
  }

  return resolveTenantKey(getRequestedTenantKey(req), fallback);
}

export function resolveTenantIdFromReq(req, fallback = "") {
  const authTenantId = getAuthTenantId(req);
  if (authTenantId) {
    return resolveTenantId(authTenantId, fallback);
  }

  return resolveTenantId(getRequestedTenantId(req), fallback);
}
