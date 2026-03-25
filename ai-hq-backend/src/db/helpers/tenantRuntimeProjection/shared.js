import crypto from "crypto";
import { db } from "../../index.js";

export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

export function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

export function bool(v, d = false) {
  return typeof v === "boolean" ? v : d;
}

export function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function compactText(text = "", max = 24000) {
  const x = s(text).replace(/\s+/g, " ").trim();
  if (!x) return "";
  if (x.length <= max) return x;
  return `${x.slice(0, max - 1).trim()}…`;
}

export function uniqueBy(list = [], keyFn = (x) => x) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const key = s(keyFn(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

export function sha256Json(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value || {})).digest("hex");
}

export function asJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

export function parseArray(value) {
  const x = asJson(value, []);
  return Array.isArray(x) ? x : [];
}

export function parseObject(value) {
  const x = asJson(value, {});
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

export function pickDb(dbOrClient) {
  return dbOrClient || db;
}

export async function one(client, sql, params = []) {
  const r = await client.query(sql, params);
  return r.rows?.[0] || null;
}

export async function many(client, sql, params = []) {
  const r = await client.query(sql, params);
  return r.rows || [];
}