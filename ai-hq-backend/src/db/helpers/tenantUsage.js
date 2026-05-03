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

const RESERVED_METRIC_COLUMNS = Object.freeze({
  api_calls: "reserved_api_calls",
  ai_units: "reserved_ai_units",
  messages_in: "reserved_messages_in",
  messages_out: "reserved_messages_out",
  webhook_events: "reserved_webhook_events",
});

export function normalizeUsageMetric(metric = "") {
  return METRIC_COLUMNS[lower(metric)] || "";
}

function normalizeReservedUsageMetric(metric = "") {
  return RESERVED_METRIC_COLUMNS[lower(metric)] || "";
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

function combineReservations(items = []) {
  const combined = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const metric = normalizeUsageMetric(item?.metric);
    const reservedColumn = normalizeReservedUsageMetric(item?.metric);
    const amount = Math.max(0, n(item?.quantity ?? item?.cost, 1));
    if (!metric || !reservedColumn || amount <= 0) continue;
    const existing = combined.get(metric) || {
      metric,
      reservedColumn,
      quantity: 0,
      limit: Math.max(0, n(item?.limit, 0)),
      class: s(item?.class || item?.source),
    };
    existing.quantity += amount;
    existing.limit = Math.max(existing.limit, Math.max(0, n(item?.limit, 0)));
    combined.set(metric, existing);
  }
  return [...combined.values()];
}

async function withOptionalTransaction(db, fn) {
  const isPool = db && typeof db.connect === "function" && db.release === undefined;

  if (isPool) {
    const client = await db.connect();

    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  // already client case (NO connect, NO BEGIN/COMMIT)
  return fn(db);
}

async function reserveMetric(client, {
  tenantId,
  tenantKey,
  usageDate,
  planKey,
  metric,
  reservedColumn,
  quantity,
  limit,
}) {
  const result = await client.query(
    `
    insert into tenant_usage_daily (
      tenant_id,
      tenant_key,
      usage_date,
      plan_key,
      ${reservedColumn}
    )
    values (
      $1::uuid,
      $2::text,
      $3::date,
      nullif($4::text, ''),
      $5::int
    )
    on conflict (tenant_id, usage_date)
    do update set
      tenant_key = excluded.tenant_key,
      plan_key = coalesce(excluded.plan_key, tenant_usage_daily.plan_key),
      ${reservedColumn} = coalesce(tenant_usage_daily.${reservedColumn}, 0) + excluded.${reservedColumn},
      updated_at = now()
    where $6::int <= 0
      or (
        coalesce(tenant_usage_daily.${metric}, 0)
        + coalesce(tenant_usage_daily.${reservedColumn}, 0)
        + excluded.${reservedColumn}
      ) <= $6::int
    returning *
    `,
    [tenantId, tenantKey, usageDate, lower(planKey), quantity, Math.max(0, n(limit, 0))]
  );

  return result.rows?.[0] || null;
}

export async function reserveTenantUsageQuota(
  db,
  {
    tenantId = "",
    tenantKey = "",
    planKey = "",
    reservations = [],
    requestId = "",
    meta = {},
    usageDate = null,
  } = {}
) {
  if (!db || typeof db.query !== "function") {
    const err = new Error("quota reservation requires database");
    err.code = "TENANT_QUOTA_STORE_UNAVAILABLE";
    throw err;
  }

  const context = getTenantContext() || {};
  const id = s(tenantId || context.tenantId);
  const key = lower(tenantKey || context.tenantKey);
  if (!id || !key) {
    const err = new Error("quota reservation requires tenant identity");
    err.code = "TENANT_QUOTA_TENANT_REQUIRED";
    throw err;
  }

  const dateKey = todayKey(usageDate || new Date());
  const items = combineReservations(reservations);
  if (!items.length) {
    return {
      ok: true,
      reservation: null,
      rows: [],
    };
  }

  const rows = await withOptionalTransaction(db, async (client) => {
    const reservedRows = [];
    for (const item of items) {
      const row = await reserveMetric(client, {
        tenantId: id,
        tenantKey: key,
        usageDate: dateKey,
        planKey,
        ...item,
      });
      if (!row) {
        const err = new Error("tenant quota exceeded");
        err.code = "TENANT_QUOTA_EXCEEDED";
        err.metric = item.metric;
        err.limit = item.limit;
        err.quantity = item.quantity;
        throw err;
      }
      reservedRows.push(row);
    }
    return reservedRows;
  });

  return {
    ok: true,
    rows,
    reservation: {
      tenantId: id,
      tenantKey: key,
      planKey: lower(planKey),
      usageDate: dateKey,
      requestId: s(requestId),
      meta: obj(meta),
      items,
    },
  };
}

async function applyReservation(client, reservation = {}, mode = "commit") {
  const id = s(reservation.tenantId);
  const dateKey = s(reservation.usageDate);
  const items = combineReservations(reservation.items);
  if (!id || !dateKey || !items.length) return [];

  const rows = [];
  for (const item of items) {
    const event =
      mode === "commit"
        ? JSON.stringify({
            metric: item.metric,
            quantity: item.quantity,
            source: item.class || "quota.reservation",
            requestId: s(reservation.requestId),
            at: new Date().toISOString(),
            meta: obj(reservation.meta),
            reserved: true,
          })
        : null;

    const result = await client.query(
      mode === "commit"
        ? `
          update tenant_usage_daily
          set
            ${item.reservedColumn} = greatest(0, coalesce(${item.reservedColumn}, 0) - $3::int),
            ${item.metric} = coalesce(${item.metric}, 0) + $3::int,
            billable_events = coalesce(billable_events, '[]'::jsonb) || jsonb_build_array($4::jsonb),
            last_event_at = now(),
            updated_at = now()
          where tenant_id = $1::uuid
            and usage_date = $2::date
          returning *
          `
        : `
          update tenant_usage_daily
          set
            ${item.reservedColumn} = greatest(0, coalesce(${item.reservedColumn}, 0) - $3::int),
            updated_at = now()
          where tenant_id = $1::uuid
            and usage_date = $2::date
          returning *
          `,
      mode === "commit"
        ? [id, dateKey, item.quantity, event]
        : [id, dateKey, item.quantity]
    );
    rows.push(result.rows?.[0] || null);
  }
  return rows;
}

export async function commitTenantUsageReservation(db, reservation = {}) {
  if (!reservation?.items?.length) return null;
  return withOptionalTransaction(db, (client) =>
    applyReservation(client, reservation, "commit")
  );
}

export async function releaseTenantUsageReservation(db, reservation = {}) {
  if (!reservation?.items?.length) return null;
  return withOptionalTransaction(db, (client) =>
    applyReservation(client, reservation, "release")
  );
}

export async function reconcileStaleTenantUsageReservations(
  db,
  { olderThanMinutes = 30, limit = 100 } = {}
) {
  if (!db || typeof db.query !== "function") return [];

  const minutes = Math.max(5, n(olderThanMinutes, 30));
  const result = await db.query(
    `
    with stale as (
      select tenant_id, usage_date
      from tenant_usage_daily
      where (
          coalesce(reserved_api_calls, 0) > 0
          or coalesce(reserved_ai_units, 0) > 0
          or coalesce(reserved_messages_in, 0) > 0
          or coalesce(reserved_messages_out, 0) > 0
          or coalesce(reserved_webhook_events, 0) > 0
        )
        and coalesce(updated_at, created_at, now()) < now() - make_interval(mins => $1::int)
      order by updated_at asc nulls first, created_at asc
      for update skip locked
      limit $2::int
    )
    update tenant_usage_daily u
    set
      reserved_api_calls = 0,
      reserved_ai_units = 0,
      reserved_messages_in = 0,
      reserved_messages_out = 0,
      reserved_webhook_events = 0,
      updated_at = now()
    from stale
    where u.tenant_id = stale.tenant_id
      and u.usage_date = stale.usage_date
    returning u.*
    `,
    [minutes, Math.max(1, n(limit, 100))]
  );

  return result.rows || [];
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
    reserved_api_calls: 0,
    reserved_ai_units: 0,
    reserved_messages_in: 0,
    reserved_messages_out: 0,
    reserved_webhook_events: 0,
  };
}

export const __test__ = {
  normalizeUsageMetric,
};
