import { s } from "./shared.js";

const tenantOptionalColumnCache = new WeakMap();

async function getTenantOptionalColumns(db) {
  if (!db?.query) {
    return { hasMeta: false, hasInboxPolicy: false };
  }

  const cached = tenantOptionalColumnCache.get(db);
  if (cached) return cached;

  const q = await db.query(
    `
      select column_name
      from information_schema.columns
      where
        table_name = 'tenants'
        and table_schema = any(current_schemas(false))
        and column_name = any($1::text[])
    `,
    [["meta", "inbox_policy"]]
  );

  const found = new Set((q?.rows || []).map((row) => s(row?.column_name).toLowerCase()));

  const result = {
    hasMeta: found.has("meta"),
    hasInboxPolicy: found.has("inbox_policy"),
  };

  tenantOptionalColumnCache.set(db, result);
  return result;
}

async function buildTenantSelectSql(db) {
  const { hasMeta, hasInboxPolicy } = await getTenantOptionalColumns(db);

  return `
    select
      t.id::text as id,
      t.tenant_key,
      t.company_name,
      t.timezone,
      t.default_language,
      ${hasMeta ? "t.meta" : "'{}'::jsonb as meta"},
      ${hasInboxPolicy ? "t.inbox_policy" : "'{}'::jsonb as inbox_policy"}
    from tenants t
  `;
}

export async function findTenantByKeyOrPhone(
  db,
  { tenantKey, toNumber, normalizePhone } = {}
) {
  const key = s(tenantKey).toLowerCase();
  const to =
    typeof normalizePhone === "function"
      ? s(normalizePhone(toNumber))
      : s(toNumber).replace(/[^\d+]/g, "");

  if (!db?.query) return null;

  const tenantSelectSql = await buildTenantSelectSql(db);

  if (key) {
    const q = await db.query(
      `
        ${tenantSelectSql}
        where lower(t.tenant_key) = lower($1)
        limit 1
      `,
      [key]
    );

    if (q?.rows?.[0]) return q.rows[0];
  }

  if (to) {
    const q = await db.query(
      `
        ${tenantSelectSql}
        left join tenant_voice_settings tvs on tvs.tenant_id = t.id
        where regexp_replace(coalesce(tvs.twilio_phone_number, ''), '[^0-9+]', '', 'g') = $1
        limit 1
      `,
      [to]
    );

    if (q?.rows?.[0]) return q.rows[0];
  }

  return null;
}
