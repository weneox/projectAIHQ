import { resolveTenantKey } from "../../../../tenancy/index.js";
import { isDbReady, isUuid } from "../../../../utils/http.js";
import { normalizeThread } from "../shared.js";

const THREAD_SELECT = `
  id, tenant_id, tenant_key, channel, external_thread_id, external_user_id,
  external_username, customer_name, status, last_message_at,
  last_inbound_at, last_outbound_at, unread_count, assigned_to,
  labels, meta, handoff_active, handoff_reason, handoff_priority,
  handoff_at, handoff_by, created_at, updated_at
`;

export async function refreshThread(db, threadId, fallback = null, tenantKey = "") {
  if (!threadId || !isUuid(threadId)) return fallback;

  const resolvedTenantKey = resolveTenantKey(tenantKey);
  const values = [threadId];
  let where = `where id = $1::uuid`;

  if (resolvedTenantKey) {
    values.push(resolvedTenantKey);
    where += ` and tenant_key = $2::text`;
  }

  const refreshed = await db.query(
    `
    select ${THREAD_SELECT}
    from inbox_threads
    ${where}
    limit 1
    `,
    values
  );

  return normalizeThread(refreshed.rows?.[0] || fallback);
}

export async function getThreadById(db, threadId, tenantKey = "") {
  if (!isDbReady(db)) return null;
  if (!threadId || !isUuid(threadId)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);
  const values = [threadId];
  let where = `where id = $1::uuid`;

  if (resolvedTenantKey) {
    values.push(resolvedTenantKey);
    where += ` and tenant_key = $2::text`;
  }

  const result = await db.query(
    `
    select ${THREAD_SELECT}
    from inbox_threads
    ${where}
    limit 1
    `,
    values
  );

  return normalizeThread(result.rows?.[0] || null);
}
