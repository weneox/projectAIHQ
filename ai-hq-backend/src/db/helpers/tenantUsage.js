import { getTenantContext } from "../tenantContext.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

const METRIC_COLUMNS = Object.freeze({
  api_calls: "api_calls",
  ai_units: "ai_units",
  messages_in: "messages_in",
  messages_out: "messages_out",
  webhook_events: "webhook_events",
  quota_rejections: "quota_rejections",
});

export function normalizeUsageMetric(metric = "") {
  return METRIC_COLUMNS[lower(metric)] || "";
}

function todayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

export async function recordTenantUsage(
  db,
  {
    tenantId = "",
    tenantKey = "",
    planKey = "",
    metric = "",
    quantity = 1,
    source = "",
    requestId = "",
    meta = {},
    usageDate = null,
  } = {}
) {
  if (!db || typeof db.query !== "function") return null;

  const context = getTenantContext() || {};
  const id = s(tenantId || context.tenantId);
  const key = lower(tenantKey || context.tenantKey);
  const column = normalizeUsageMetric(metric);
  const amount = Math.max(0, n(quantity, 1));
  if (!id || !key || !column || amount <= 0) return null;

  const result = await db.query(
    `
    insert into tenant_usage_daily (
      tenant_id,
      tenant_key,
      usage_date,
      plan_key,
      ${column},
      billable_events,
      last_event_at
    )
    values (
      $1::uuid,
      $2::text,
      $3::date,
      nullif($4::text, ''),
      $5::int,
      jsonb_build_array($6::jsonb),
      now()
    )
    on conflict (tenant_id, usage_date)
    do update set
      tenant_key = excluded.tenant_key,
      plan_key = coalesce(excluded.plan_key, tenant_usage_daily.plan_key),
      ${column} = coalesce(tenant_usage_daily.${column}, 0) + excluded.${column},
      billable_events = coalesce(tenant_usage_daily.billable_events, '[]'::jsonb)
        || excluded.billable_events,
      last_event_at = now(),
      updated_at = now()
    returning *
    `,
    [
      id,
      key,
      todayKey(usageDate || new Date()),
      lower(planKey),
      amount,
      JSON.stringify({
        metric: column,
        quantity: amount,
        source: s(source),
        requestId: s(requestId),
        at: new Date().toISOString(),
        meta: obj(meta),
      }),
    ]
  );

  return result.rows?.[0] || null;
}

export async function getTenantUsageSnapshot(
  db,
  { tenantId = "", tenantKey = "", usageDate = null } = {}
) {
  if (!db || typeof db.query !== "function") return null;

  const context = getTenantContext() || {};
  const id = s(tenantId || context.tenantId);
  const key = lower(tenantKey || context.tenantKey);
  if (!id && !key) return null;

  const values = [todayKey(usageDate || new Date())];
  let where = "usage_date = $1::date";
  if (id) {
    values.push(id);
    where += ` and tenant_id = $${values.length}::uuid`;
  } else {
    values.push(key);
    where += ` and tenant_key = $${values.length}::text`;
  }

  const result = await db.query(
    `
    select *
    from tenant_usage_daily
    where ${where}
    limit 1
    `,
    values
  );

  return result.rows?.[0] || {
    tenant_id: id,
    tenant_key: key,
    usage_date: values[0],
    api_calls: 0,
    ai_units: 0,
    messages_in: 0,
    messages_out: 0,
    webhook_events: 0,
    quota_rejections: 0,
  };
}

export const __test__ = {
  normalizeUsageMetric,
};
