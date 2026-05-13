import { resolveTenantContext } from "./resolveTenantContext.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

export function getTenantContext(req) {
  return req?.tenantContext || null;
}

export function attachTenantContext(req, ctx = {}) {
  const tenantId = s(ctx.tenantId || ctx.tenant?.id);
  const tenantKey = s(ctx.tenantKey || ctx.tenant?.tenant_key || ctx.tenant?.key);

  req.tenantContext = {
    ...ctx,
    tenantId,
    tenantKey,
  };

  req.tenantId = tenantId;
  req.tenantKey = tenantKey;

  req.tenant = {
    ...(ctx.tenant || {}),
    id: tenantId,
    tenant_key: tenantKey,
    key: tenantKey,
  };

  return req.tenantContext;
}

export function createRequireTenantContext(options = {}) {
  return async function requireTenantContext(req, res, next) {
    try {
      const ctx = await resolveTenantContext(req, {
        db: options.db || req?.app?.locals?.db || null,
        fallbackTenantId: options.fallbackTenantId,
        fallbackTenantKey: options.fallbackTenantKey,
        allowFallback: options.allowFallback === true,
        allowDefaultTenant: options.allowDefaultTenant === true,
      });

      if (!ctx?.ok) {
        return res.status(400).json({
          ok: false,
          error: "TenantRequired",
          reason: "tenant context is required",
        });
      }

      if (options.requireDbTenant === true && !ctx.hasDbTenant) {
        return res.status(404).json({
          ok: false,
          error: "TenantNotFound",
          tenantId: ctx.tenantId || null,
          tenantKey: ctx.tenantKey || null,
        });
      }

      attachTenantContext(req, ctx);
      return next();
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: "TenantContextFailed",
        reason: err?.message || "failed to resolve tenant context",
      });
    }
  };
}

export default createRequireTenantContext;
