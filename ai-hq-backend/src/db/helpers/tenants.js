import { createTtlCache } from "../../utils/cache.js";

const tenantCache = createTtlCache({ ttlMs: 30_000, maxEntries: 1000 });

function rowOrNull(r) {
  return r?.rows?.[0] || null;
}

function rows(r) {
  return Array.isArray(r?.rows) ? r.rows : [];
}

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function normalizeTenantMode(v, fallback = "manual") {
  const x = lower(v, fallback);
  if (x === "manual" || x === "auto") return x;
  return fallback;
}

export async function dbGetTenantByKey(db, tenantKey) {
  if (!db || !tenantKey) return null;
  const key = lower(tenantKey);
  if (!key) return null;

  const cacheKey = `tenant:${key}`;
  if (db?.__tenantGuardedDb === true) {
    const cached = tenantCache.get(cacheKey);
    if (cached) return cached;
  }

  const q = await db.query(
    `
      select *
      from tenants
      where lower(tenant_key) = lower($1)
      limit 1
    `,
    [key]
  );

  const tenant = rowOrNull(q);
  if (tenant && db?.__tenantGuardedDb === true) {
    tenantCache.set(cacheKey, tenant);
  }
  return tenant;
}

export function clearTenantCache(tenantKey = "") {
  const key = lower(tenantKey);
  if (!key) return false;
  return tenantCache.del(`tenant:${key}`);
}

export async function dbListTenants(db, opts = {}) {
  if (!db) return [];

  const status = lower(opts.status);
  const activeOnly = opts.activeOnly === true;

  const params = [];
  const where = [];

  if (status) {
    params.push(status);
    where.push(`lower(status) = $${params.length}`);
  }

  if (activeOnly) {
    where.push(`active = true`);
  }

  const q = await db.query(
    `
      select *
      from tenants
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by created_at asc
    `,
    params
  );

  return rows(q);
}

export async function dbGetTenantMode(db, tenantKey) {
  if (!db || !tenantKey) return null;

  const q = await db.query(
    `
      select
        t.tenant_key,
        coalesce(p.publish_policy->>'mode', 'manual') as mode,
        coalesce(p.publish_policy, '{}'::jsonb) as publish_policy
      from tenants t
      left join tenant_ai_policies p
        on p.tenant_id = t.id
      where lower(t.tenant_key) = lower($1)
      limit 1
    `,
    [s(tenantKey)]
  );

  const row = rowOrNull(q);
  if (!row) return null;

  return {
    tenant_key: s(row.tenant_key),
    mode: normalizeTenantMode(row.mode, "manual"),
    publish_policy:
      row.publish_policy && typeof row.publish_policy === "object"
        ? row.publish_policy
        : {},
  };
}
export async function dbSetTenantMode(db, tenantKey, mode) {
  if (!db || !tenantKey) return null;

  const safeMode = normalizeTenantMode(mode, "manual");

  const tenantQ = await db.query(
    `
      select id, tenant_key
      from tenants
      where lower(tenant_key) = lower($1)
      limit 1
    `,
    [s(tenantKey)]
  );

  const tenant = rowOrNull(tenantQ);
  if (!tenant?.id) return null;

  const q = await db.query(
    `
      insert into tenant_ai_policies (
        tenant_id,
        publish_policy
      )
      values (
        $1,
        jsonb_build_object('mode', $2)
      )
      on conflict (tenant_id) do update
      set publish_policy =
        coalesce(tenant_ai_policies.publish_policy, '{}'::jsonb)
        || jsonb_build_object('mode', $2)
      returning
        $3::text as tenant_key,
        coalesce(publish_policy->>'mode', 'manual') as mode
    `,
    [tenant.id, safeMode, tenant.tenant_key]
  );

  const row = rowOrNull(q);
  if (!row) return null;

  return {
    tenant_key: s(row.tenant_key),
    mode: normalizeTenantMode(row.mode, "manual"),
  };
}

