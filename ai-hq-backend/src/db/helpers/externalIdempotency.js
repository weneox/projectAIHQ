import { randomUUID } from "crypto";

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

function normalize(row = {}) {
  if (!row?.id) return null;
  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: lower(row.tenant_key),
    provider: lower(row.provider),
    action_type: s(row.action_type),
    idempotency_key: s(row.idempotency_key),
    execution_id: s(row.execution_id),
    attempt_id: s(row.attempt_id),
    state: lower(row.state),
    lease_token: s(row.lease_token),
    lease_expires_at: row.lease_expires_at || null,
    provider_message_id: s(row.provider_message_id),
    provider_response: obj(row.provider_response),
    error_code: s(row.error_code),
    error_message: s(row.error_message),
    attempt_count: n(row.attempt_count),
    first_reserved_at: row.first_reserved_at || null,
    last_reserved_at: row.last_reserved_at || null,
    completed_at: row.completed_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function requireKey(input = {}) {
  const tenantKey = lower(input.tenantKey || input.tenant_key);
  const provider = lower(input.provider || "internal");
  const actionType = s(input.actionType || input.action_type);
  const idempotencyKey = s(input.idempotencyKey || input.idempotency_key);

  if (!tenantKey || !provider || !actionType || !idempotencyKey) {
    const err = new Error("external side effect requires tenant/provider/action/idempotency key");
    err.code = "EXTERNAL_IDEMPOTENCY_KEY_REQUIRED";
    throw err;
  }

  return {
    tenantId: s(input.tenantId || input.tenant_id),
    tenantKey,
    provider,
    actionType,
    idempotencyKey,
  };
}

export async function reserveExternalSideEffect(
  db,
  {
    tenantId = "",
    tenantKey = "",
    provider = "",
    actionType = "",
    idempotencyKey = "",
    executionId = "",
    attemptId = "",
    leaseToken = "",
    leaseMs = 60_000,
  } = {}
) {
  const key = requireKey({ tenantId, tenantKey, provider, actionType, idempotencyKey });
  const token = s(leaseToken) || randomUUID();
  const ttlMs = Math.max(10_000, n(leaseMs, 60_000));

  const result = await db.query(
    `
    insert into external_idempotency_keys (
      tenant_id,
      tenant_key,
      provider,
      action_type,
      idempotency_key,
      execution_id,
      attempt_id,
      state,
      lease_token,
      lease_expires_at,
      attempt_count,
      first_reserved_at,
      last_reserved_at
    )
    values (
      nullif($1::text, '')::uuid,
      $2::text,
      $3::text,
      $4::text,
      $5::text,
      nullif($6::text, '')::uuid,
      nullif($7::text, '')::uuid,
      'reserved',
      $8::text,
      now() + make_interval(secs => greatest(1, ($9::int / 1000))),
      1,
      now(),
      now()
    )
    on conflict (tenant_key, provider, action_type, idempotency_key)
    do update set
      tenant_id = coalesce(external_idempotency_keys.tenant_id, excluded.tenant_id),
      execution_id = coalesce(external_idempotency_keys.execution_id, excluded.execution_id),
      attempt_id = coalesce(excluded.attempt_id, external_idempotency_keys.attempt_id),
      state = 'reserved',
      lease_token = excluded.lease_token,
      lease_expires_at = excluded.lease_expires_at,
      attempt_count = coalesce(external_idempotency_keys.attempt_count, 0) + 1,
      first_reserved_at = coalesce(external_idempotency_keys.first_reserved_at, now()),
      last_reserved_at = now(),
      error_code = null,
      error_message = null
    where external_idempotency_keys.state = 'pending'
      or (
        external_idempotency_keys.state = 'retrying'
        and coalesce(external_idempotency_keys.lease_expires_at, now()) <= now()
      )
    returning *, true as acquired
    `,
    [
      key.tenantId,
      key.tenantKey,
      key.provider,
      key.actionType,
      key.idempotencyKey,
      s(executionId),
      s(attemptId),
      token,
      ttlMs,
    ]
  );

  const reserved = normalize(result.rows?.[0] || null);
  if (reserved) {
    return {
      acquired: true,
      leaseToken: token,
      record: reserved,
    };
  }

  const existing = await getExternalSideEffect(db, key);
  return {
    acquired: false,
    leaseToken: token,
    record: existing,
  };
}

export async function getExternalSideEffect(
  db,
  {
    tenantKey = "",
    provider = "",
    actionType = "",
    idempotencyKey = "",
  } = {}
) {
  const key = requireKey({ tenantKey, provider, actionType, idempotencyKey });
  const result = await db.query(
    `
    select *
    from external_idempotency_keys
    where tenant_key = $1::text
      and provider = $2::text
      and action_type = $3::text
      and idempotency_key = $4::text
    limit 1
    `,
    [key.tenantKey, key.provider, key.actionType, key.idempotencyKey]
  );
  return normalize(result.rows?.[0] || null);
}

export async function markExternalSideEffectSent(
  db,
  {
    tenantKey = "",
    provider = "",
    actionType = "",
    idempotencyKey = "",
    leaseToken = "",
    providerMessageId = "",
    providerResponse = {},
  } = {}
) {
  const key = requireKey({ tenantKey, provider, actionType, idempotencyKey });
  const result = await db.query(
    `
    update external_idempotency_keys
    set
      state = 'sent',
      lease_token = null,
      lease_expires_at = null,
      provider_message_id = nullif($5::text, ''),
      provider_response = coalesce($6::jsonb, '{}'::jsonb),
      error_code = null,
      error_message = null,
      completed_at = now()
    where tenant_key = $1::text
      and provider = $2::text
      and action_type = $3::text
      and idempotency_key = $4::text
      and ($7::text = '' or lease_token = $7::text)
    returning *
    `,
    [
      key.tenantKey,
      key.provider,
      key.actionType,
      key.idempotencyKey,
      s(providerMessageId),
      JSON.stringify(obj(providerResponse)),
      s(leaseToken),
    ]
  );
  return normalize(result.rows?.[0] || null);
}

export async function markExternalSideEffectFailed(
  db,
  {
    tenantKey = "",
    provider = "",
    actionType = "",
    idempotencyKey = "",
    leaseToken = "",
    retryable = false,
    retryDelaySeconds = 120,
    errorCode = "",
    errorMessage = "",
    providerResponse = {},
  } = {}
) {
  const key = requireKey({ tenantKey, provider, actionType, idempotencyKey });
  const result = await db.query(
    `
    update external_idempotency_keys
    set
      state = case when $5::boolean then 'retrying' else 'failed' end,
      lease_token = null,
      lease_expires_at = case
        when $5::boolean then now() + make_interval(secs => greatest(1, $6::int))
        else null
      end,
      provider_response = coalesce($9::jsonb, '{}'::jsonb),
      error_code = nullif($7::text, ''),
      error_message = nullif($8::text, ''),
      completed_at = case when $5::boolean then null else now() end
    where tenant_key = $1::text
      and provider = $2::text
      and action_type = $3::text
      and idempotency_key = $4::text
      and ($10::text = '' or lease_token = $10::text)
    returning *
    `,
    [
      key.tenantKey,
      key.provider,
      key.actionType,
      key.idempotencyKey,
      Boolean(retryable),
      Math.max(1, n(retryDelaySeconds, 120)),
      s(errorCode),
      s(errorMessage),
      JSON.stringify(obj(providerResponse)),
      s(leaseToken),
    ]
  );
  return normalize(result.rows?.[0] || null);
}

export const __test__ = {
  normalize,
};
