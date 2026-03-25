// src/services/workspace/mutations/shared.js
// shared/sql helpers extracted from src/services/workspace/mutations.js

import { obj, s } from "../shared.js";

export const PARAM_WRAPPER = Symbol("PARAM_WRAPPER");

const tableExistsCache = new Map();

export function jsonb(value) {
  return {
    [PARAM_WRAPPER]: true,
    cast: "jsonb",
    value: JSON.stringify(value ?? {}),
  };
}

export function isWrappedParam(value) {
  return !!(value && typeof value === "object" && value[PARAM_WRAPPER]);
}

export function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

export function cleanArrayStrings(list = []) {
  return arr(list)
    .map((x) => s(x))
    .filter(Boolean);
}

export function assertIdent(name) {
  const x = s(name);
  if (!/^[a-z_][a-z0-9_]*$/i.test(x)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return x;
}

export async function q(db, text, params = []) {
  if (!db || typeof db.query !== "function") {
    throw new Error("Database client is not available");
  }
  return db.query(text, params);
}

export async function tableExists(db, tableName) {
  const table = assertIdent(tableName);

  if (tableExistsCache.has(table)) {
    return tableExistsCache.get(table);
  }

  const { rows } = await q(
    db,
    `select to_regclass($1) as regclass`,
    [`public.${table}`]
  );

  const exists = !!rows?.[0]?.regclass;
  tableExistsCache.set(table, exists);
  return exists;
}

export function cleanPatch(patch = {}) {
  return Object.fromEntries(
    Object.entries(obj(patch)).filter(([, value]) => value !== undefined)
  );
}

export function buildSetClause(patch = {}, startIndex = 1) {
  const entries = Object.entries(cleanPatch(patch));
  const sets = [];
  const params = [];
  const changedFields = [];
  let index = startIndex;

  for (const [rawKey, rawValue] of entries) {
    const key = assertIdent(rawKey);
    changedFields.push(key);

    if (isWrappedParam(rawValue)) {
      params.push(rawValue.value);
      sets.push(`${key} = $${index}::${rawValue.cast}`);
      index += 1;
      continue;
    }

    params.push(rawValue);
    sets.push(`${key} = $${index}`);
    index += 1;
  }

  return {
    sets,
    params,
    changedFields,
  };
}

export function buildInsertParts(patch = {}, startIndex = 1) {
  const entries = Object.entries(cleanPatch(patch));
  const columns = [];
  const values = [];
  const params = [];
  let index = startIndex;

  for (const [rawKey, rawValue] of entries) {
    const key = assertIdent(rawKey);
    columns.push(key);

    if (isWrappedParam(rawValue)) {
      params.push(rawValue.value);
      values.push(`$${index}::${rawValue.cast}`);
      index += 1;
      continue;
    }

    params.push(rawValue);
    values.push(`$${index}`);
    index += 1;
  }

  return {
    columns,
    values,
    params,
  };
}

export function hasOwn(source, key) {
  return !!source && Object.prototype.hasOwnProperty.call(source, key);
}

export function hasAny(source, keys = []) {
  return keys.some((key) => hasOwn(source, key));
}

export function normalizeApprovalMode(value = "") {
  const x = s(value).toLowerCase();

  if (!x) return "";
  if (["manual", "human", "review", "approval", "human_review"].includes(x)) {
    return "manual";
  }
  if (["auto", "automatic", "autosend", "auto_send"].includes(x)) {
    return "auto";
  }
  if (["hybrid", "assisted", "mixed", "human_in_the_loop"].includes(x)) {
    return "hybrid";
  }

  return x;
}