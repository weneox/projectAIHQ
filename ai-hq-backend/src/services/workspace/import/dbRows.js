// src/services/workspace/import/dbRows.js
// db/row helpers extracted from src/services/workspace/import.js

import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import { getTableColumns, queryOne, tableExists } from "../db.js";
import {
  arr,
  lower,
  s,
  safeUuidOrNull,
  normalizeSourceType,
  normalizeUrl,
} from "./shared.js";

const allowedColumnValuesCache = new Map();

export function columnsMap(columns = []) {
  return new Map(arr(columns).map((x) => [s(x.column_name), x]));
}

export function hasColumn(columns = [], name = "") {
  return columns.some((x) => s(x.column_name) === s(name));
}

export function getColumnMeta(columns = [], name = "") {
  return arr(columns).find((x) => s(x.column_name) === s(name)) || null;
}

export function prepareValueForColumn(meta = {}, value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const dataType = lower(meta?.data_type);
  const udtName = lower(meta?.udt_name);
  const isUuidColumn = dataType === "uuid" || udtName === "uuid";

  if (isUuidColumn) {
    return safeUuidOrNull(value);
  }

  if (Array.isArray(value)) {
    if (dataType === "json" || dataType === "jsonb") return value;
    if (dataType === "array" || udtName.startsWith("_")) return value;
    return JSON.stringify(value);
  }

  if (value && typeof value === "object") {
    if (dataType === "json" || dataType === "jsonb") return value;
    return JSON.stringify(value);
  }

  return value;
}

export function filterDataForTable(columns = [], data = {}) {
  const map = columnsMap(columns);
  const out = {};

  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined) continue;
    if (!map.has(key)) continue;
    out[key] = prepareValueForColumn(map.get(key), value);
  }

  return out;
}

export async function findFirstExistingTable(db, tableNames = []) {
  for (const table of arr(tableNames)) {
    if (await tableExists(db, table)) {
      return table;
    }
  }
  return "";
}

export async function insertRow(db, table, data = {}) {
  const columns = await getTableColumns(db, table);
  const filtered = filterDataForTable(columns, data);
  const keys = Object.keys(filtered);

  if (!keys.length) {
    throw new Error(`insertRow: no matching columns for table '${table}'`);
  }

  if (!db || typeof db.query !== "function") {
    throw new Error("insertRow: db.query(...) is required");
  }

  const values = keys.map((key) => filtered[key]);
  const placeholders = keys.map((_, i) => `$${i + 1}`);

  const result = await db.query(
    `insert into ${table} (${keys.join(", ")}) values (${placeholders.join(", ")}) returning *`,
    values
  );

  if (!Array.isArray(result?.rows) || !result.rows[0]) {
    throw new Error(`insertRow: insert into '${table}' returned no row`);
  }

  return result.rows[0];
}

export async function updateRowById(db, table, rowId, patch = {}) {
  if (!rowId) return null;

  const columns = await getTableColumns(db, table);
  const filtered = filterDataForTable(columns, patch);
  const keys = Object.keys(filtered);

  if (!keys.length) {
    return queryOne(db, `select * from ${table} where id = $1 limit 1`, [rowId]);
  }

  const values = [];
  const sets = [];

  for (const key of keys) {
    values.push(filtered[key]);
    sets.push(`${key} = $${values.length}`);
  }

  values.push(rowId);

  return (
    (await queryOne(
      db,
      `update ${table} set ${sets.join(", ")} where id = $${values.length} returning *`,
      values
    )) || null
  );
}

export async function resolveTenantScope({ db, tenantId, tenantKey }) {
  const knowledge = createTenantKnowledgeHelpers({ db });
  const tenant = await knowledge.resolveTenantIdentity({ tenantId, tenantKey });

  if (!tenant?.tenant_id && !tenant?.tenant_key) {
    throw new Error("Tenant could not be resolved");
  }

  return {
    tenantId: s(tenant.tenant_id),
    tenantKey: s(tenant.tenant_key),
  };
}

export async function getEnumValues(db, typeName = "") {
  const x = s(typeName);
  if (!x || !db || typeof db.query !== "function") return [];

  const result = await db.query(
    `
    select e.enumlabel
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = $1
    order by e.enumsortorder
    `,
    [x]
  );

  return [...new Set(arr(result?.rows).map((row) => s(row.enumlabel)).filter(Boolean))];
}

export async function getExactCheckConstraintLiteralValues(db, table = "", column = "") {
  if (!db || typeof db.query !== "function") return [];

  const result = await db.query(
    `
    select pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = $2
    where n.nspname = 'public'
      and c.relname = $1
      and con.contype = 'c'
      and a.attnum = any(con.conkey)
    `,
    [s(table), s(column)]
  );

  const out = [];

  for (const row of arr(result?.rows)) {
    const def = s(row.def);

    for (const match of def.matchAll(/'((?:''|[^'])+)'/g)) {
      const value = s(match[1]).replace(/''/g, "'");
      if (value) out.push(value);
    }
  }

  return [...new Set(out)];
}

export async function getAllowedColumnValues(db, table = "", column = "", columns = null) {
  const key = `${s(table)}:${s(column)}`;

  if (allowedColumnValuesCache.has(key)) {
    return allowedColumnValuesCache.get(key);
  }

  const cols = columns || (await getTableColumns(db, table));
  const meta = getColumnMeta(cols, column);

  let values = [];

  if (meta && lower(meta.data_type) === "user-defined" && s(meta.udt_name)) {
    values.push(...(await getEnumValues(db, meta.udt_name)));
  }

  values.push(...(await getExactCheckConstraintLiteralValues(db, table, column)));

  values = [...new Set(values.map((x) => s(x)).filter(Boolean))];
  allowedColumnValuesCache.set(key, values);

  return values;
}

export function pickPreferredAllowedValue(allowedValues = [], preferred = []) {
  const allowed = arr(allowedValues).map((x) => s(x)).filter(Boolean);
  const allowedLower = new Set(allowed.map((x) => lower(x)));

  for (const candidate of arr(preferred)) {
    if (allowedLower.has(lower(candidate))) {
      return allowed.find((x) => lower(x) === lower(candidate)) || s(candidate);
    }
  }

  return "";
}

export async function findSourceExact(db, sourceTable, { tenantId, tenantKey, sourceType, url }) {
  const columns = await getTableColumns(db, sourceTable);
  const normalizedType = normalizeSourceType(sourceType);
  const normalizedUrl = normalizeUrl(url);

  const params = [];
  const where = [];
  let idx = 1;

  if (hasColumn(columns, "tenant_id") && tenantId) {
    where.push(`tenant_id = $${idx}`);
    params.push(tenantId);
    idx += 1;
  }

  if (hasColumn(columns, "tenant_key") && tenantKey) {
    where.push(`tenant_key = $${idx}`);
    params.push(tenantKey);
    idx += 1;
  }

  const typeChecks = [];
  if (hasColumn(columns, "source_type")) {
    typeChecks.push(`lower(source_type) = lower($${idx})`);
  }
  if (hasColumn(columns, "type")) {
    typeChecks.push(`lower(type) = lower($${idx})`);
  }
  if (typeChecks.length) {
    where.push(`(${typeChecks.join(" or ")})`);
    params.push(normalizedType);
    idx += 1;
  }

  const urlChecks = [];
  if (hasColumn(columns, "source_url")) {
    urlChecks.push(`source_url = $${idx}`);
  }
  if (hasColumn(columns, "url")) {
    urlChecks.push(`url = $${idx}`);
  }
  if (urlChecks.length) {
    where.push(`(${urlChecks.join(" or ")})`);
    params.push(normalizedUrl);
    idx += 1;
  }

  if (!where.length) return null;

  return (
    (await queryOne(
      db,
      `select * from ${sourceTable} where ${where.join(" and ")} limit 1`,
      params
    )) || null
  );
}

export async function findSourceByKey(
  db,
  sourceTable,
  { tenantId, tenantKey, sourceKey }
) {
  const columns = await getTableColumns(db, sourceTable);
  const normalizedKey = s(sourceKey);

  if (!normalizedKey) return null;

  const params = [];
  const where = [];
  let idx = 1;

  if (hasColumn(columns, "tenant_id") && tenantId) {
    where.push(`tenant_id = $${idx}`);
    params.push(tenantId);
    idx += 1;
  }

  if (hasColumn(columns, "tenant_key") && tenantKey) {
    where.push(`tenant_key = $${idx}`);
    params.push(tenantKey);
    idx += 1;
  }

  if (hasColumn(columns, "source_key")) {
    where.push(`source_key = $${idx}`);
    params.push(normalizedKey);
    idx += 1;
  }

  if (!where.length || !hasColumn(columns, "source_key")) return null;

  return (
    (await queryOne(
      db,
      `select * from ${sourceTable} where ${where.join(" and ")} limit 1`,
      params
    )) || null
  );
}

export async function findLatestRunForSource(db, runTable, { tenantId, tenantKey, sourceId }) {
  const columns = await getTableColumns(db, runTable);

  const params = [];
  const where = [];
  let idx = 1;

  if (hasColumn(columns, "tenant_id") && tenantId) {
    where.push(`tenant_id = $${idx}`);
    params.push(tenantId);
    idx += 1;
  }

  if (hasColumn(columns, "tenant_key") && tenantKey) {
    where.push(`tenant_key = $${idx}`);
    params.push(tenantKey);
    idx += 1;
  }

  if (hasColumn(columns, "source_id") && sourceId) {
    where.push(`source_id = $${idx}`);
    params.push(sourceId);
    idx += 1;
  }

  if (!where.length) return null;

  const orderBy = hasColumn(columns, "created_at")
    ? "created_at desc"
    : hasColumn(columns, "updated_at")
      ? "updated_at desc"
      : hasColumn(columns, "id")
        ? "id desc"
        : "";

  return (
    (await queryOne(
      db,
      `select * from ${runTable} where ${where.join(" and ")}${
        orderBy ? ` order by ${orderBy}` : ""
      } limit 1`,
      params
    )) || null
  );
}
