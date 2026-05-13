import { resolveTenantContext } from "./resolveTenantContext.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

/**
 * Compatibility helper for legacy modules that still need only tenantKey.
 *
 * Important:
 * - Does not use default tenant unless explicitly allowed.
 * - Does not trust request tenant when authenticated user has no tenant.
 * - Returns fallback only when explicitly passed and allowed.
 */
export async function resolveTenantKeyCompat(req, options = {}) {
  const ctx = await resolveTenantContext(req, {
    db: options.db || req?.app?.locals?.db || null,
    fallbackTenantKey: options.fallbackTenantKey,
    allowFallback: options.allowFallback === true,
    allowDefaultTenant: options.allowDefaultTenant === true,
  });

  return lower(ctx?.tenantKey || "");
}

/**
 * Sync/lightweight version for legacy code paths that cannot await yet.
 * Mirrors old resolveTenantKeyFromReq behavior by reading already-attached
 * tenant context first, then request/auth values via req.tenantKey.
 */
export function getAttachedTenantKey(req) {
  return lower(
    req?.tenantContext?.tenantKey ||
      req?.tenantKey ||
      req?.tenant?.tenant_key ||
      req?.tenant?.key ||
      ""
  );
}
