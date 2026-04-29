import { resolveTenantKey } from "../../../../tenancy/index.js";
import { isDbReady, isUuid } from "../../../../utils/http.js";
import { normalizeThread } from "../shared.js";
import { getOutboundAttemptsSummary } from "./outboundAttempts.js";

const THREAD_SELECT = `
  t.id,
  t.tenant_id,
  t.tenant_key,
  t.channel,
  t.external_thread_id,
  t.external_user_id,
  coalesce(
    nullif(btrim(t.external_username), ''),
    nullif(btrim(latest_identity.fallback_external_username), '')
  ) as external_username,
  coalesce(
    case
      when nullif(btrim(t.customer_name), '') is not null
        and coalesce(t.customer_name, '') !~ '^\\d{5,}$'
      then t.customer_name
      else null
    end,
    nullif(btrim(latest_identity.fallback_customer_name), '')
  ) as customer_name,
  t.status,
  t.last_message_at,
  t.last_inbound_at,
  t.last_outbound_at,
  t.unread_count,
  t.assigned_to,
  t.labels,
  t.meta,
  t.handoff_active,
  t.handoff_reason,
  t.handoff_priority,
  t.handoff_at,
  t.handoff_by,
  t.created_at,
  t.updated_at,
  coalesce(
    nullif(btrim(latest_identity.fallback_avatar_url), ''),
    ''
  ) as avatar_url
`;

const THREAD_IDENTITY_LATERAL = `
  left join lateral (
    select
      nullif(btrim(coalesce(
        m.meta->'identity'->>'externalUsername',
        m.meta->'customerContext'->>'username',
        m.meta->'customerContext'->'profile'->>'username',
        m.meta->'customerContext'->'instagram'->>'username',
        m.meta->'customerContext'->'telegram'->>'username',
        m.meta->'customerContext'->'meta'->>'username',
        m.meta->'raw'->>'username',
        m.meta->'raw'->'from'->>'username',
        m.meta->'raw'->'sender'->>'username',
        m.meta->'raw'->'profile'->>'username',
        ''
      )), '') as fallback_external_username,

      nullif(btrim(coalesce(
        m.meta->'identity'->>'customerName',
        m.meta->'customerContext'->>'fullName',
        m.meta->'customerContext'->>'displayName',
        m.meta->'customerContext'->>'name',
        m.meta->'customerContext'->'profile'->>'fullName',
        m.meta->'customerContext'->'profile'->>'displayName',
        m.meta->'customerContext'->'profile'->>'name',
        m.meta->'customerContext'->'instagram'->>'fullName',
        m.meta->'customerContext'->'instagram'->>'displayName',
        m.meta->'customerContext'->'instagram'->>'name',
        m.meta->'customerContext'->'telegram'->>'fullName',
        m.meta->'customerContext'->'telegram'->>'displayName',
        m.meta->'customerContext'->'telegram'->>'name',
        m.meta->'customerContext'->'meta'->>'fullName',
        m.meta->'customerContext'->'meta'->>'displayName',
        m.meta->'customerContext'->'meta'->>'name',
        m.meta->'raw'->>'customerName',
        m.meta->'raw'->>'customer_name',
        m.meta->'raw'->>'name',
        m.meta->'raw'->>'full_name',
        m.meta->'raw'->'from'->>'name',
        m.meta->'raw'->'from'->>'fullName',
        m.meta->'raw'->'from'->>'full_name',
        m.meta->'raw'->'sender'->>'name',
        m.meta->'raw'->'sender'->>'fullName',
        m.meta->'raw'->'sender'->>'full_name',
        m.meta->'raw'->'profile'->>'name',
        m.meta->'raw'->'profile'->>'fullName',
        m.meta->'raw'->'profile'->>'full_name',
        ''
      )), '') as fallback_customer_name,

      nullif(btrim(coalesce(
        m.meta->>'avatar_url',
        m.meta->>'avatarUrl',
        m.meta->>'profile_picture_url',
        m.meta->>'profilePictureUrl',
        m.meta->'customerContext'->>'avatar_url',
        m.meta->'customerContext'->>'avatarUrl',
        m.meta->'customerContext'->>'profile_picture_url',
        m.meta->'customerContext'->>'profilePictureUrl',
        m.meta->'customerContext'->'profile'->>'avatar_url',
        m.meta->'customerContext'->'profile'->>'avatarUrl',
        m.meta->'customerContext'->'profile'->>'profile_picture_url',
        m.meta->'customerContext'->'profile'->>'profilePictureUrl',
        m.meta->'customerContext'->'instagram'->>'avatar_url',
        m.meta->'customerContext'->'instagram'->>'avatarUrl',
        m.meta->'customerContext'->'instagram'->>'profile_picture_url',
        m.meta->'customerContext'->'instagram'->>'profilePictureUrl',
        m.meta->'customerContext'->'telegram'->>'avatar_url',
        m.meta->'customerContext'->'telegram'->>'avatarUrl',
        m.meta->'customerContext'->'telegram'->>'profile_picture_url',
        m.meta->'customerContext'->'telegram'->>'profilePictureUrl',
        m.meta->'raw'->>'avatar_url',
        m.meta->'raw'->>'avatarUrl',
        m.meta->'raw'->>'profile_picture_url',
        m.meta->'raw'->>'profilePictureUrl',
        m.meta->'raw'->'from'->>'avatar_url',
        m.meta->'raw'->'from'->>'avatarUrl',
        m.meta->'raw'->'from'->>'profile_picture_url',
        m.meta->'raw'->'from'->>'profilePictureUrl',
        m.meta->'raw'->'sender'->>'avatar_url',
        m.meta->'raw'->'sender'->>'avatarUrl',
        m.meta->'raw'->'sender'->>'profile_picture_url',
        m.meta->'raw'->'sender'->>'profilePictureUrl',
        m.meta->'raw'->'profile'->>'avatar_url',
        m.meta->'raw'->'profile'->>'avatarUrl',
        m.meta->'raw'->'profile'->>'profile_picture_url',
        m.meta->'raw'->'profile'->>'profilePictureUrl',
        ''
      )), '') as fallback_avatar_url
    from inbox_messages m
    where m.thread_id = t.id
      and m.tenant_key = t.tenant_key
      and lower(coalesce(m.direction, '')) = 'inbound'
      and lower(coalesce(m.sender_type, '')) = 'customer'
    order by m.sent_at desc, m.created_at desc
    limit 1
  ) latest_identity on true
`;

async function fetchThreadRow(db, whereSql, values = []) {
  const result = await db.query(
    `
    select ${THREAD_SELECT}
    from inbox_threads t
    ${THREAD_IDENTITY_LATERAL}
    ${whereSql}
    limit 1
    `,
    values
  );

  return result.rows?.[0] || null;
}

export async function refreshThread(db, threadId, fallback = null, tenantKey = "") {
  if (!threadId || !isUuid(threadId)) return fallback;

  const resolvedTenantKey = resolveTenantKey(tenantKey);
  const values = [threadId];
  let where = `where t.id = $1::uuid`;

  if (resolvedTenantKey) {
    values.push(resolvedTenantKey);
    where += ` and t.tenant_key = $2::text`;
  }

  const row = await fetchThreadRow(db, where, values);
  return normalizeThread(row || fallback);
}

export async function getThreadById(db, threadId, tenantKey = "") {
  if (!isDbReady(db)) return null;
  if (!threadId || !isUuid(threadId)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);
  const values = [threadId];
  let where = `where t.id = $1::uuid`;

  if (resolvedTenantKey) {
    values.push(resolvedTenantKey);
    where += ` and t.tenant_key = $2::text`;
  }

  const row = await fetchThreadRow(db, where, values);
  return normalizeThread(row || null);
}

export async function getInboxPressureSummary(
  db,
  tenantKey = "",
  { outboundSummaryLoader = getOutboundAttemptsSummary } = {}
) {
  if (!isDbReady(db)) {
    throw new Error("database unavailable");
  }

  const resolvedTenantKey = resolveTenantKey(tenantKey);
  const [threadResult, outboundSummary] = await Promise.all([
    db.query(
      `
      select
        coalesce(sum(greatest(coalesce(unread_count, 0), 0)), 0)::int as unread_count,
        count(*) filter (where lower(coalesce(status, '')) = 'open')::int as open_count,
        count(*) filter (where coalesce(handoff_active, false) = true)::int as handoff_count,
        count(*) filter (
          where lower(coalesce(status, '')) = 'open'
            and nullif(btrim(coalesce(assigned_to, '')), '') is not null
        )::int as assigned_open_count
      from inbox_threads
      where tenant_key = $1::text
      `,
      [resolvedTenantKey]
    ),
    outboundSummaryLoader(db, resolvedTenantKey),
  ]);

  const row = threadResult.rows?.[0] || {};
  const outbound = outboundSummary || {};
  const queued = Number(outbound.queued || 0);
  const sending = Number(outbound.sending || 0);
  const failed = Number(outbound.failed || 0);
  const retrying = Number(outbound.retrying || 0);

  return {
    tenantKey: resolvedTenantKey,
    unreadCount: Number(row.unread_count || 0),
    openCount: Number(row.open_count || 0),
    handoffCount: Number(row.handoff_count || 0),
    assignedOpenCount: Number(row.assigned_open_count || 0),
    pendingOutboundCount: queued + sending + failed + retrying,
    failedOutboundCount: failed,
    retryingOutboundCount: retrying,
  };
}
