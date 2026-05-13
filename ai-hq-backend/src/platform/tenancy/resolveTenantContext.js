import { cfg } from "../../config.js";
import {
  getAuthTenantKey,
  getAuthTenantId,
  getRequestedTenantKey,
  getRequestedTenantId,
  getAuthRole,
  getNormalizedAuthRole,
  getAuthActor,
} from "../../utils/auth.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

export function getDefaultTenantKey() {
  return lower(cfg.tenant?.defaultTenantKey || cfg.DEFAULT_TENANT_KEY, "default");
}

function hasAuthenticatedRequest(req) {
  return Boolean(req?.auth || req?.user);
}

async function findTenantRow(db, { tenantId = "", tenantKey = "" } = {}) {
  if (!db?.query) return null;

  const id = s(tenantId);
  const key = lower(tenantKey);

  if (id) {
    const q = await db.query(
      `
        select
          id::text as id,
          tenant_key,
          company_name,
          industry_key,
          country_code,
          timezone,
          default_language,
          enabled_languages,
          plan_key,
          status,
          active
        from tenants
        where id::text = $1
        limit 1
      `,
      [id]
    );

    if (q?.rows?.[0]) return q.rows[0];
  }

  if (key) {
    const q = await db.query(
      `
        select
          id::text as id,
          tenant_key,
          company_name,
          industry_key,
          country_code,
          timezone,
          default_language,
          enabled_languages,
          plan_key,
          status,
          active
        from tenants
        where lower(tenant_key) = lower($1)
        limit 1
      `,
      [key]
    );

    if (q?.rows?.[0]) return q.rows[0];
  }

  return null;
}

function pickTenantInput(req, options = {}) {
  const authTenantId = s(getAuthTenantId(req));
  const authTenantKey = lower(getAuthTenantKey(req));

  const authenticated = hasAuthenticatedRequest(req);

  // Security rule: if request is authenticated but auth payload has no tenant,
  // do not silently fall back to query/body/header tenant.
  const requestedTenantId = authenticated ? "" : s(getRequestedTenantId(req));
  const requestedTenantKey = authenticated ? "" : lower(getRequestedTenantKey(req));

  const fallbackTenantId = s(options.fallbackTenantId);
  const fallbackTenantKey = lower(options.fallbackTenantKey);

  const allowFallback = options.allowFallback === true;
  const allowDefaultTenant = options.allowDefaultTenant === true;

  let tenantId =
    authTenantId ||
    requestedTenantId ||
    (allowFallback ? fallbackTenantId : "");

  let tenantKey =
    authTenantKey ||
    requestedTenantKey ||
    (allowFallback ? fallbackTenantKey : "");

  let source = "none";

  if (authTenantId || authTenantKey) source = "auth";
  else if (requestedTenantId || requestedTenantKey) source = "request";
  else if (allowFallback && (fallbackTenantId || fallbackTenantKey)) source = "fallback";

  if (!tenantId && !tenantKey && allowDefaultTenant) {
    tenantKey = getDefaultTenantKey();
    source = "default";
  }

  return {
    tenantId,
    tenantKey,
    source,
    authenticated,
  };
}

export async function resolveTenantContext(req, options = {}) {
  const db = options.db || req?.app?.locals?.db || null;

  const picked = pickTenantInput(req, options);
  let tenantId = s(picked.tenantId);
  let tenantKey = lower(picked.tenantKey);

  const tenant = await findTenantRow(db, { tenantId, tenantKey });

  if (tenant) {
    tenantId = s(tenant.id) || tenantId;
    tenantKey = lower(tenant.tenant_key || tenantKey);
  }

  const role = getAuthRole(req);
  const normalizedRole = getNormalizedAuthRole(req);
  const actor = getAuthActor(req);

  return {
    ok: Boolean(tenantId || tenantKey),
    tenantId,
    tenantKey,
    tenant: tenant || null,
    actor,
    role,
    normalizedRole,
    source: picked.source,
    authenticated: picked.authenticated,
    hasDbTenant: Boolean(tenant),
    isDefaultTenant: Boolean(tenantKey && tenantKey === getDefaultTenantKey()),
  };
}

export default resolveTenantContext;
