// src/services/workspace/mutations/scope.js
// scope/db mutation helpers extracted from src/services/workspace/mutations.js

import { obj, s } from "../shared.js";
import {
  arr,
  cleanArrayStrings,
  assertIdent,
  q,
  tableExists,
  buildSetClause,
  buildInsertParts,
  cleanPatch,
} from "./shared.js";

export async function resolveTenantScope({ db, tenantId, tenantKey, tenant = null }) {
  const existingId = s(tenant?.id || tenantId);
  const existingKey = s(tenant?.tenant_key || tenant?.key || tenantKey);

  let result;

  if (existingId) {
    result = await q(
      db,
      `
        select
          id,
          tenant_key,
          company_name,
          legal_name,
          industry_key,
          timezone,
          default_language,
          enabled_languages
        from tenants
        where id = $1::uuid
        limit 1
      `,
      [existingId]
    );
  } else if (existingKey) {
    result = await q(
      db,
      `
        select
          id,
          tenant_key,
          company_name,
          legal_name,
          industry_key,
          timezone,
          default_language,
          enabled_languages
        from tenants
        where tenant_key = $1
        limit 1
      `,
      [existingKey]
    );
  } else {
    throw new Error("Tenant scope is required");
  }

  const row = result?.rows?.[0];
  if (!row) {
    throw new Error("Tenant could not be resolved");
  }

  return {
    id: s(row.id),
    tenantKey: s(row.tenant_key),
    companyName: s(row.company_name),
    legalName: s(row.legal_name),
    industryKey: s(row.industry_key || "generic_business"),
    timezone: s(row.timezone || "Asia/Baku"),
    defaultLanguage: s(row.default_language || "az"),
    enabledLanguages: cleanArrayStrings(row.enabled_languages),
  };
}

export async function updateRowById({
  db,
  tableName,
  idColumn = "id",
  idValue,
  patch = {},
}) {
  const table = assertIdent(tableName);
  const idCol = assertIdent(idColumn);

  if (!(await tableExists(db, table))) {
    return null;
  }

  const { sets, params, changedFields } = buildSetClause(patch, 2);
  if (!sets.length) {
    return null;
  }

  const sql = `
    update ${table}
    set ${sets.join(", ")},
        updated_at = now()
    where ${idCol} = $1
  `;

  const res = await q(db, sql, [idValue, ...params]);

  if (!res.rowCount) {
    return null;
  }

  return {
    table,
    action: "update",
    changedFields,
  };
}

export async function upsertByTenantId({
  db,
  tableName,
  tenantId,
  insertPatch = {},
  updatePatch = {},
}) {
  const table = assertIdent(tableName);

  if (!(await tableExists(db, table))) {
    return null;
  }

  const insertData = cleanPatch({
    tenant_id: tenantId,
    ...insertPatch,
    ...updatePatch,
  });

  const updateData = cleanPatch(updatePatch);

  const insertParts = buildInsertParts(insertData, 1);
  if (!insertParts.columns.length) {
    return null;
  }

  const updateEntries = Object.entries(updateData);
  const assignments = updateEntries.map(([rawKey]) => {
    const key = assertIdent(rawKey);
    return `${key} = excluded.${key}`;
  });

  assignments.push(`updated_at = now()`);

  const sql = `
    insert into ${table} (${insertParts.columns.join(", ")})
    values (${insertParts.values.join(", ")})
    on conflict (tenant_id)
    do update set ${assignments.join(", ")}
    returning (xmax = 0) as inserted
  `;

  const res = await q(db, sql, insertParts.params);

  return {
    table,
    action: res?.rows?.[0]?.inserted ? "insert" : "update",
    changedFields: Object.keys(updateData),
  };
}

export async function firstScopedRow(db, tableName, { tenantId = "", tenantKey = "" } = {}) {
  const table = assertIdent(tableName);

  if (!(await tableExists(db, table))) {
    return null;
  }

  if (tenantId) {
    const res = await q(
      db,
      `select * from ${table} where tenant_id = $1::uuid limit 1`,
      [tenantId]
    );
    if (res?.rows?.[0]) return res.rows[0];
  }

  if (tenantKey) {
    const res = await q(
      db,
      `select * from ${table} where tenant_key = $1 limit 1`,
      [tenantKey]
    );
    if (res?.rows?.[0]) return res.rows[0];
  }

  return null;
}