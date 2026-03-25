// src/services/workspace/db.js
// FINAL v1.2 — safe db helpers for workspace services + tenant-scoped upsert

import { arr, lower, num, pickDateValue, s } from "./shared.js";

const tableExistsCache = new Map();
const tableColumnsCache = new Map();

function hasDbQuery(db) {
  return !!db && typeof db.query === "function";
}

function assertIdent(name) {
  const x = s(name);
  if (!/^[a-z_][a-z0-9_]*$/i.test(x)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return x;
}

function safeLimit(value, fallback = 200, max = 1000) {
  return Math.max(1, Math.min(num(value, fallback), max));
}

function latestRows(rows = []) {
  return [...arr(rows)].sort((a, b) => {
    const aa = Date.parse(pickDateValue(a) || 0) || 0;
    const bb = Date.parse(pickDateValue(b) || 0) || 0;
    return bb - aa;
  });
}

export async function queryRows(db, text, params = []) {
  if (!hasDbQuery(db)) return [];

  try {
    const result = await db.query(text, params);
    return arr(result?.rows);
  } catch {
    return [];
  }
}

export async function queryOne(db, text, params = []) {
  const rows = await queryRows(db, text, params);
  return rows[0] || null;
}

export async function tableExists(db, tableName = "") {
  const table = s(tableName);
  if (!hasDbQuery(db) || !table) return false;

  const key = `public.${table}`;
  if (tableExistsCache.has(key)) {
    return tableExistsCache.get(key);
  }

  try {
    const row = await queryOne(db, `select to_regclass($1) as regclass`, [key]);
    const exists = !!s(row?.regclass);
    tableExistsCache.set(key, exists);
    return exists;
  } catch {
    tableExistsCache.set(key, false);
    return false;
  }
}

export async function getTableColumns(db, tableName = "") {
  const table = s(tableName);
  if (!hasDbQuery(db) || !table) return [];

  const key = `public.${table}`;
  if (tableColumnsCache.has(key)) {
    return tableColumnsCache.get(key);
  }

  if (!(await tableExists(db, table))) {
    tableColumnsCache.set(key, []);
    return [];
  }

  try {
    const rows = await queryRows(
      db,
      `
        select
          column_name,
          data_type,
          udt_name,
          is_nullable,
          ordinal_position
        from information_schema.columns
        where table_schema = 'public'
          and table_name = $1
        order by ordinal_position asc
      `,
      [table]
    );

    tableColumnsCache.set(key, rows);
    return rows;
  } catch {
    tableColumnsCache.set(key, []);
    return [];
  }
}

export async function hasColumn(db, tableName = "", columnName = "") {
  const table = s(tableName);
  const column = s(columnName);
  if (!table || !column) return false;

  const columns = await getTableColumns(db, table);
  return columns.some((x) => s(x.column_name) === column);
}

function columnsMap(columns = []) {
  return new Map(arr(columns).map((x) => [s(x.column_name), x]));
}

function prepareValueForColumn(meta = {}, value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const dataType = lower(meta?.data_type);
  const udtName = lower(meta?.udt_name);

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

function filterDataForTable(columns = [], data = {}) {
  const out = {};
  const map = columnsMap(columns);

  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined) continue;
    if (!map.has(key)) continue;
    out[key] = prepareValueForColumn(map.get(key), value);
  }

  return out;
}

async function queryByTenantColumn(db, table, tenantColumn, value, limit = 200) {
  if (!value) return null;

  const safeTable = assertIdent(table);
  const safeTenantColumn = assertIdent(tenantColumn);

  try {
    return await queryRows(
      db,
      `select * from ${safeTable} where ${safeTenantColumn} = $1 limit $2`,
      [value, safeLimit(limit)]
    );
  } catch {
    return null;
  }
}

async function countByTenantColumn(db, table, tenantColumn, value) {
  if (!value) return null;

  const safeTable = assertIdent(table);
  const safeTenantColumn = assertIdent(tenantColumn);

  try {
    const row = await queryOne(
      db,
      `select count(*)::int as count from ${safeTable} where ${safeTenantColumn} = $1`,
      [value]
    );

    return num(row?.count, 0);
  } catch {
    return null;
  }
}

export async function listByTenantScope(
  db,
  table,
  { tenantId = "", tenantKey = "" } = {},
  { limit = 200 } = {}
) {
  const safeTable = s(table);
  if (!safeTable) return [];
  if (!(await tableExists(db, safeTable))) return [];

  if (tenantId && (await hasColumn(db, safeTable, "tenant_id"))) {
    const rows = await queryByTenantColumn(db, safeTable, "tenant_id", tenantId, limit);
    if (rows) return rows;
  }

  if (tenantKey && (await hasColumn(db, safeTable, "tenant_key"))) {
    const rows = await queryByTenantColumn(db, safeTable, "tenant_key", tenantKey, limit);
    if (rows) return rows;
  }

  return [];
}

export async function countByTenantScope(
  db,
  table,
  { tenantId = "", tenantKey = "" } = {}
) {
  const safeTable = s(table);
  if (!safeTable) return 0;
  if (!(await tableExists(db, safeTable))) return 0;

  if (tenantId && (await hasColumn(db, safeTable, "tenant_id"))) {
    const count = await countByTenantColumn(db, safeTable, "tenant_id", tenantId);
    if (count !== null) return count;
  }

  if (tenantKey && (await hasColumn(db, safeTable, "tenant_key"))) {
    const count = await countByTenantColumn(db, safeTable, "tenant_key", tenantKey);
    if (count !== null) return count;
  }

  return 0;
}

export async function getRowsFromFirstTable(
  db,
  tableNames = [],
  scope = {},
  { limit = 200 } = {}
) {
  let firstExistingTable = "";

  for (const table of arr(tableNames)) {
    if (!(await tableExists(db, table))) continue;
    if (!firstExistingTable) firstExistingTable = table;

    const rows = await listByTenantScope(db, table, scope, { limit });
    if (rows.length) {
      return { table, rows };
    }
  }

  if (firstExistingTable) {
    const rows = await listByTenantScope(db, firstExistingTable, scope, { limit });
    return { table: firstExistingTable, rows };
  }

  return { table: "", rows: [] };
}

export async function countFromFirstTable(db, tableNames = [], scope = {}) {
  let firstExistingTable = "";

  for (const table of arr(tableNames)) {
    if (!(await tableExists(db, table))) continue;
    if (!firstExistingTable) firstExistingTable = table;

    const count = await countByTenantScope(db, table, scope);
    if (count > 0) {
      return { table, count };
    }
  }

  if (firstExistingTable) {
    const count = await countByTenantScope(db, firstExistingTable, scope);
    return { table: firstExistingTable, count };
  }

  return { table: "", count: 0 };
}

export async function getRowById(db, table, idColumn, value) {
  const safeTable = s(table);
  const safeIdColumn = s(idColumn);
  if (!safeTable || !safeIdColumn || !value) return null;
  if (!(await tableExists(db, safeTable))) return null;

  try {
    return await queryOne(
      db,
      `select * from ${assertIdent(safeTable)} where ${assertIdent(safeIdColumn)} = $1 limit 1`,
      [value]
    );
  } catch {
    return null;
  }
}

export async function findTenantScopedRow(
  db,
  table,
  { tenantId = "", tenantKey = "" } = {}
) {
  const safeTable = s(table);
  if (!safeTable) return null;
  if (!(await tableExists(db, safeTable))) return null;

  const rows = await listByTenantScope(db, safeTable, { tenantId, tenantKey }, { limit: 100 });
  return latestRows(rows)[0] || null;
}

export async function upsertTenantScopedRow(
  db,
  table,
  { tenantId = "", tenantKey = "" } = {},
  patch = {},
  {
    insertDefaults = {},
    createIfMissing = true,
    touchUpdatedAt = true,
  } = {}
) {
  const safeTable = s(table);
  if (!safeTable) {
    return {
      ok: false,
      action: "skipped",
      table: safeTable,
      reason: "table_required",
      changedFields: [],
      row: null,
    };
  }

  if (!(await tableExists(db, safeTable))) {
    return {
      ok: false,
      action: "skipped",
      table: safeTable,
      reason: "table_missing",
      changedFields: [],
      row: null,
    };
  }

  const sqlTable = assertIdent(safeTable);
  const columns = await getTableColumns(db, safeTable);
  const columnSet = new Set(columns.map((x) => s(x.column_name)));

  if (!tenantId && !tenantKey) {
    return {
      ok: false,
      action: "skipped",
      table: safeTable,
      reason: "tenant_scope_required",
      changedFields: [],
      row: null,
    };
  }

  const scopeColumns = {};
  if (tenantId && columnSet.has("tenant_id")) scopeColumns.tenant_id = tenantId;
  if (tenantKey && columnSet.has("tenant_key")) scopeColumns.tenant_key = tenantKey;

  if (!Object.keys(scopeColumns).length) {
    return {
      ok: false,
      action: "skipped",
      table: safeTable,
      reason: "no_tenant_columns",
      changedFields: [],
      row: null,
    };
  }

  const nowIso = new Date().toISOString();

  const filteredPatch = filterDataForTable(columns, patch);
  if (touchUpdatedAt && columnSet.has("updated_at") && filteredPatch.updated_at === undefined) {
    filteredPatch.updated_at = prepareValueForColumn(
      columns.find((x) => s(x.column_name) === "updated_at"),
      nowIso
    );
  }

  const existing = await findTenantScopedRow(db, safeTable, { tenantId, tenantKey });

  if (existing) {
    const changedFields = Object.keys(filteredPatch);

    if (!changedFields.length) {
      return {
        ok: true,
        action: "noop",
        table: safeTable,
        reason: "",
        changedFields,
        row: existing,
      };
    }

    const setEntries = Object.entries(filteredPatch);
    const params = [];
    const setSql = [];

    for (const [key, value] of setEntries) {
      const safeKey = assertIdent(key);
      params.push(value);
      setSql.push(`${safeKey} = $${params.length}`);
    }

    let whereSql = "";
    if (columnSet.has("id") && existing.id) {
      params.push(existing.id);
      whereSql = `id = $${params.length}`;
    } else if (scopeColumns.tenant_id) {
      params.push(scopeColumns.tenant_id);
      whereSql = `tenant_id = $${params.length}`;
    } else {
      params.push(scopeColumns.tenant_key);
      whereSql = `tenant_key = $${params.length}`;
    }

    const row = await queryOne(
      db,
      `update ${sqlTable} set ${setSql.join(", ")} where ${whereSql} returning *`,
      params
    );

    return {
      ok: true,
      action: "update",
      table: safeTable,
      reason: "",
      changedFields,
      row: row || existing,
    };
  }

  if (!createIfMissing) {
    return {
      ok: false,
      action: "skipped",
      table: safeTable,
      reason: "row_missing",
      changedFields: [],
      row: null,
    };
  }

  const insertBase = {
    ...insertDefaults,
    ...scopeColumns,
    ...filteredPatch,
  };

  if (columnSet.has("created_at") && insertBase.created_at === undefined) {
    insertBase.created_at = nowIso;
  }
  if (touchUpdatedAt && columnSet.has("updated_at") && insertBase.updated_at === undefined) {
    insertBase.updated_at = nowIso;
  }

  const filteredInsert = filterDataForTable(columns, insertBase);
  const changedFields = Object.keys(filteredInsert);

  if (!changedFields.length) {
    return {
      ok: false,
      action: "skipped",
      table: safeTable,
      reason: "no_matching_columns",
      changedFields: [],
      row: null,
    };
  }

  const insertKeys = Object.keys(filteredInsert).map((key) => assertIdent(key));
  const params = Object.keys(filteredInsert).map((key) => filteredInsert[key]);
  const placeholders = insertKeys.map((_, i) => `$${i + 1}`);

  const row = await queryOne(
    db,
    `insert into ${sqlTable} (${insertKeys.join(", ")}) values (${placeholders.join(", ")}) returning *`,
    params
  );

  return {
    ok: true,
    action: "insert",
    table: safeTable,
    reason: "",
    changedFields,
    row,
  };
}