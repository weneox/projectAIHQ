import crypto from "crypto";
import { fixText } from "../../../../utils/textFix.js";
import { s } from "../shared.js";

export const INBOX_THREAD_SELECT_COLUMNS = `
  id, tenant_id, tenant_key, channel, external_thread_id, external_user_id,
  external_username, customer_name, status, last_message_at,
  last_inbound_at, last_outbound_at, unread_count, assigned_to,
  labels, meta, handoff_active, handoff_reason, handoff_priority,
  handoff_at, handoff_by, created_at, updated_at
`;

export function normalizeObj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function normalizeArr(v) {
  return Array.isArray(v) ? v : [];
}

export function safeJson(v) {
  return JSON.stringify(normalizeObj(v));
}

export function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

export function nowIso() {
  return new Date().toISOString();
}

export function logInfo(message, data = null) {
  try {
    if (data) console.log(`[ai-hq] ${message}`, data);
    else console.log(`[ai-hq] ${message}`);
  } catch {}
}

export async function resolveTenantRow(client, tenantKey = "") {
  const key = fixText(s(tenantKey || ""));
  if (!client || !key) return null;

  const result = await client.query(
    `
    select id, tenant_key, company_name, timezone, inbox_policy
    from tenants
    where tenant_key = $1::text
    limit 1
    `,
    [key]
  );

  return result.rows?.[0] || null;
}

export function hashText(text) {
  const value = s(text || "");
  if (!value) return "";
  try {
    return crypto.createHash("sha256").update(value).digest("hex");
  } catch {
    return "";
  }
}

export function getStateValue(state, ...keys) {
  const src = normalizeObj(state);
  for (const key of keys) {
    const value = src?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

export function findAction(actions = [], type = "") {
  const target = lower(type);
  return normalizeArr(actions).find((item) => lower(item?.type) === target) || null;
}

export async function rollbackAndRelease(client) {
  if (!client) return;
  try {
    await client.query("ROLLBACK");
  } catch {}
  try {
    client.release();
  } catch {}
}
