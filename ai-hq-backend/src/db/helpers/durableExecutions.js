import { randomUUID } from "crypto";
import { recordDurableExecutionCreated } from "../../observability/runtimeSignals.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function normalizeExecution(row = {}) {
  if (!row?.id) return null;

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),
    channel: s(row.channel),
    provider: s(row.provider),
    action_type: s(row.action_type),
    target_type: s(row.target_type),
    target_id: s(row.target_id),
    thread_id: s(row.thread_id),
    conversation_id: s(row.conversation_id),
    message_id: s(row.message_id),
    idempotency_key: s(row.idempotency_key),
    payload_summary: obj(row.payload_summary),
    safe_metadata: obj(row.safe_metadata),
    correlation_ids: obj(row.correlation_ids),
    status: s(row.status),
    attempt_count: n(row.attempt_count),
    max_attempts: n(row.max_attempts, 5),
    next_retry_at: row.next_retry_at || null,
    lease_token: s(row.lease_token),
    lease_expires_at: row.lease_expires_at || null,
    claimed_by: s(row.claimed_by),
    last_attempt_at: row.last_attempt_at || null,
    succeeded_at: row.succeeded_at || null,
    dead_lettered_at: row.dead_lettered_at || null,
    last_error_code: s(row.last_error_code),
    last_error_message: s(row.last_error_message),
    last_error_classification: s(row.last_error_classification),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function normalizeAttempt(row = {}) {
  if (!row?.id) return null;

  return {
    id: s(row.id),
    execution_id: s(row.execution_id),
    attempt_number: n(row.attempt_number),
    status_from: s(row.status_from),
    status_to: s(row.status_to),
    lease_token: s(row.lease_token),
    started_at: row.started_at || null,
    finished_at: row.finished_at || null,
    error_code: s(row.error_code),
    error_message: s(row.error_message),
    error_classification: s(row.error_classification),
    result_summary: obj(row.result_summary),
    correlation_ids: obj(row.correlation_ids),
    created_at: row.created_at || null,
  };
}

function normalizeListStatus(status = "") {
  const value = s(status).toLowerCase();

  if (["pending", "in_progress", "succeeded", "retryable", "terminal", "dead_lettered"].includes(value)) {
    return value;
  }

  if (value === "recent_failed") return "recent_failed";
  return "";
}

export function createDurableExecutionHelpers({ db }) {
  async function enqueueExecution(input = {}) {
    const payloadSummary = obj(input.payloadSummary);
    const safeMetadata = obj(input.safeMetadata);
    const correlationIds = obj(input.correlationIds);
    const maxAttempts = Math.max(1, n(input.maxAttempts, 5));
    const nextRetryAt = input.nextRetryAt || new Date().toISOString();
    const id = s(input.id) || randomUUID();

    const result = await db.query(
      `
      insert into durable_executions (
        id,
        tenant_id,
        tenant_key,
        channel,
        provider,
        action_type,
        target_type,
        target_id,
        thread_id,
        conversation_id,
        message_id,
        idempotency_key,
        payload_summary,
        safe_metadata,
        correlation_ids,
        status,
        max_attempts,
        next_retry_at
      )
      values (
        $1::uuid,
        nullif($2::text, '')::uuid,
        $3::text,
        $4::text,
        $5::text,
        $6::text,
        $7::text,
        nullif($8::text, ''),
        nullif($9::text, '')::uuid,
        nullif($10::text, ''),
        nullif($11::text, '')::uuid,
        $12::text,
        $13::jsonb,
        $14::jsonb,
        $15::jsonb,
        'pending',
        $16::int,
        $17::timestamptz
      )
      on conflict (tenant_key, provider, action_type, idempotency_key)
      do update
      set
        payload_summary = durable_executions.payload_summary,
        safe_metadata = durable_executions.safe_metadata,
        correlation_ids = durable_executions.correlation_ids
      returning *
      `,
      [
        id,
        s(input.tenantId),
        s(input.tenantKey || "default").toLowerCase(),
        s(input.channel || "system").toLowerCase(),
        s(input.provider || "internal").toLowerCase(),
        s(input.actionType),
        s(input.targetType || "runtime"),
        s(input.targetId),
        s(input.threadId),
        s(input.conversationId),
        s(input.messageId),
        s(input.idempotencyKey),
        JSON.stringify(payloadSummary),
        JSON.stringify(safeMetadata),
        JSON.stringify(correlationIds),
        maxAttempts,
        nextRetryAt,
      ]
    );

    const execution = normalizeExecution(result.rows?.[0] || null);

    if (execution && execution.id === id) {
      recordDurableExecutionCreated({
        provider: execution.provider,
        channel: execution.channel,
        actionType: execution.action_type,
      });
    }

    return execution;
  }

  async function getExecutionById(id) {
    const result = await db.query(
      `
      select *
      from durable_executions
      where id = $1::uuid
      limit 1
      `,
      [id]
    );

    return normalizeExecution(result.rows?.[0] || null);
  }

  async function listExecutions({
    status = "",
    actionType = "",
    tenantId = "",
    tenantKey = "",
    limit = 50,
  } = {}) {
    const normalizedStatus = normalizeListStatus(status);
    const values = [];
    const where = [];

    if (tenantId) {
      values.push(tenantId);
      where.push(`tenant_id = $${values.length}::uuid`);
    } else if (tenantKey) {
      values.push(tenantKey.toLowerCase());
      where.push(`tenant_key = $${values.length}::text`);
    }

    if (s(actionType)) {
      values.push(s(actionType));
      where.push(`action_type = $${values.length}::text`);
    }

    if (normalizedStatus && normalizedStatus !== "recent_failed") {
      values.push(normalizedStatus);
      where.push(`status = $${values.length}::text`);
    } else if (normalizedStatus === "recent_failed") {
      where.push(`status in ('retryable','terminal','dead_lettered')`);
    }

    values.push(Math.max(1, Math.min(200, n(limit, 50))));

    const result = await db.query(
      `
      select *
      from durable_executions
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by coalesce(updated_at, created_at) desc, created_at desc
      limit $${values.length}::int
      `,
      values
    );

    return (result.rows || []).map(normalizeExecution).filter(Boolean);
  }

  async function listAttempts(executionId) {
    const result = await db.query(
      `
      select *
      from durable_execution_attempts
      where execution_id = $1::uuid
      order by attempt_number desc, created_at desc
      `,
      [executionId]
    );

    return (result.rows || []).map(normalizeAttempt).filter(Boolean);
  }

  async function getExecutionSummary({
    tenantId = "",
    tenantKey = "",
  } = {}) {
    const values = [];
    const where = [];

    if (tenantId) {
      values.push(tenantId);
      where.push(`tenant_id = $${values.length}::uuid`);
    } else if (tenantKey) {
      values.push(tenantKey.toLowerCase());
      where.push(`tenant_key = $${values.length}::text`);
    }

    const scopeWhere = where.length ? `where ${where.join(" and ")}` : "";
    const result = await db.query(
      `
      with scoped as (
        select *
        from durable_executions
        ${scopeWhere}
      ),
      counts as (
        select
          count(*) filter (where status = 'pending')::int as pending_count,
          count(*) filter (where status = 'in_progress')::int as in_progress_count,
          count(*) filter (where status = 'succeeded')::int as succeeded_count,
          count(*) filter (where status = 'retryable')::int as retryable_count,
          count(*) filter (where status = 'terminal')::int as terminal_count,
          count(*) filter (where status = 'dead_lettered')::int as dead_lettered_count
        from scoped
      ),
      oldest_retryable as (
        select id, created_at, next_retry_at, updated_at
        from scoped
        where status = 'retryable'
        order by coalesce(next_retry_at, created_at) asc, created_at asc
        limit 1
      ),
      oldest_in_progress as (
        select id, created_at, last_attempt_at, lease_expires_at, updated_at
        from scoped
        where status = 'in_progress'
        order by coalesce(last_attempt_at, created_at) asc, created_at asc
        limit 1
      )
      select
        counts.*,
        row_to_json(oldest_retryable.*) as oldest_retryable,
        row_to_json(oldest_in_progress.*) as oldest_in_progress
      from counts
      left join oldest_retryable on true
      left join oldest_in_progress on true
      `
      ,
      values
    );

    const row = result.rows?.[0] || {};
    return {
      counts: {
        pending: n(row.pending_count),
        in_progress: n(row.in_progress_count),
        succeeded: n(row.succeeded_count),
        retryable: n(row.retryable_count),
        terminal: n(row.terminal_count),
        dead_lettered: n(row.dead_lettered_count),
      },
      oldestRetryable: row.oldest_retryable || null,
      oldestInProgress: row.oldest_in_progress || null,
      deadLetterCount: n(row.dead_lettered_count),
    };
  }

  async function listExecutionAuditTrail(executionId, {
    tenantId = "",
    tenantKey = "",
    limit = 20,
  } = {}) {
    const values = [executionId];
    const where = [
      `object_type = 'durable_execution'`,
      `object_id = $1::text`,
    ];

    if (tenantId) {
      values.push(tenantId);
      where.push(`tenant_id = $${values.length}::uuid`);
    } else if (tenantKey) {
      values.push(tenantKey.toLowerCase());
      where.push(`lower(coalesce(tenant_key, '')) = $${values.length}::text`);
    }

    values.push(Math.max(1, Math.min(100, n(limit, 20))));

    const result = await db.query(
      `
      select
        id,
        tenant_id,
        tenant_key,
        actor,
        action,
        object_type,
        object_id,
        meta,
        created_at
      from audit_log
      where ${where.join(" and ")}
      order by created_at desc
      limit $${values.length}::int
      `,
      values
    );

    return (result.rows || []).map((row) => ({
      id: s(row.id),
      tenant_id: s(row.tenant_id),
      tenant_key: s(row.tenant_key),
      actor: s(row.actor),
      action: s(row.action),
      object_type: s(row.object_type),
      object_id: s(row.object_id),
      meta: obj(row.meta),
      created_at: row.created_at || null,
    }));
  }

  async function claimNextExecution({
    workerId,
    leaseToken,
    leaseMs = 60_000,
    statusFilter = [],
  } = {}) {
    const normalizedStatuses = Array.isArray(statusFilter) && statusFilter.length
      ? statusFilter.map((item) => s(item).toLowerCase()).filter(Boolean)
      : ["pending", "retryable", "in_progress"];

    const result = await db.query(
      `
      with candidate as (
        select id
        from durable_executions
        where status = any($1::text[])
          and (
            (status in ('pending', 'retryable') and coalesce(next_retry_at, now()) <= now())
            or (status = 'in_progress' and coalesce(lease_expires_at, now()) <= now())
          )
        order by
          case status when 'in_progress' then 0 else 1 end,
          coalesce(next_retry_at, created_at) asc,
          created_at asc
        for update skip locked
        limit 1
      )
      update durable_executions d
      set
        status = 'in_progress',
        attempt_count = coalesce(d.attempt_count, 0) + 1,
        lease_token = $2::text,
        lease_expires_at = now() + make_interval(secs => greatest(1, ($3::int / 1000))),
        claimed_by = $4::text,
        last_attempt_at = now(),
        next_retry_at = null
      from candidate
      where d.id = candidate.id
      returning d.*
      `,
      [
        normalizedStatuses,
        s(leaseToken),
        Math.max(1_000, n(leaseMs, 60_000)),
        s(workerId),
      ]
    );

    return normalizeExecution(result.rows?.[0] || null);
  }

  async function createAttemptStart({
    executionId,
    attemptNumber,
    statusFrom = "pending",
    leaseToken = "",
    correlationIds = {},
  } = {}) {
    const result = await db.query(
      `
      insert into durable_execution_attempts (
        execution_id,
        attempt_number,
        status_from,
        lease_token,
        correlation_ids
      )
      values (
        $1::uuid,
        $2::int,
        $3::text,
        $4::text,
        $5::jsonb
      )
      on conflict (execution_id, attempt_number)
      do update
      set
        status_from = excluded.status_from,
        lease_token = excluded.lease_token,
        correlation_ids = excluded.correlation_ids
      returning *
      `,
      [
        executionId,
        Math.max(1, n(attemptNumber, 1)),
        s(statusFrom),
        s(leaseToken),
        JSON.stringify(obj(correlationIds)),
      ]
    );

    return normalizeAttempt(result.rows?.[0] || null);
  }

  async function completeAttempt({
    executionId,
    attemptNumber,
    statusTo,
    errorCode = "",
    errorMessage = "",
    errorClassification = "",
    resultSummary = {},
    correlationIds = {},
  } = {}) {
    const result = await db.query(
      `
      update durable_execution_attempts
      set
        status_to = $3::text,
        finished_at = now(),
        error_code = nullif($4::text, ''),
        error_message = nullif($5::text, ''),
        error_classification = nullif($6::text, ''),
        result_summary = $7::jsonb,
        correlation_ids = $8::jsonb
      where execution_id = $1::uuid
        and attempt_number = $2::int
      returning *
      `,
      [
        executionId,
        Math.max(1, n(attemptNumber, 1)),
        s(statusTo),
        s(errorCode),
        s(errorMessage),
        s(errorClassification),
        JSON.stringify(obj(resultSummary)),
        JSON.stringify(obj(correlationIds)),
      ]
    );

    return normalizeAttempt(result.rows?.[0] || null);
  }

  async function markExecutionSucceeded({
    executionId,
    leaseToken = "",
  } = {}) {
    const result = await db.query(
      `
      update durable_executions
      set
        status = 'succeeded',
        lease_token = null,
        lease_expires_at = null,
        claimed_by = null,
        succeeded_at = now(),
        last_error_code = null,
        last_error_message = null,
        last_error_classification = null,
        next_retry_at = null
      where id = $1::uuid
        and ($2::text = '' or lease_token = $2::text or lease_token is null)
      returning *
      `,
      [executionId, s(leaseToken)]
    );

    return normalizeExecution(result.rows?.[0] || null);
  }

  async function markExecutionRetryable({
    executionId,
    leaseToken = "",
    nextRetryAt,
    errorCode = "",
    errorMessage = "",
    errorClassification = "retryable",
  } = {}) {
    const result = await db.query(
      `
      update durable_executions
      set
        status = 'retryable',
        lease_token = null,
        lease_expires_at = null,
        claimed_by = null,
        next_retry_at = $3::timestamptz,
        last_error_code = nullif($4::text, ''),
        last_error_message = nullif($5::text, ''),
        last_error_classification = nullif($6::text, '')
      where id = $1::uuid
        and ($2::text = '' or lease_token = $2::text or lease_token is null)
      returning *
      `,
      [executionId, s(leaseToken), nextRetryAt, s(errorCode), s(errorMessage), s(errorClassification)]
    );

    return normalizeExecution(result.rows?.[0] || null);
  }

  async function markExecutionTerminal({
    executionId,
    leaseToken = "",
    errorCode = "",
    errorMessage = "",
    errorClassification = "terminal",
    deadLetter = false,
  } = {}) {
    const status = deadLetter ? "dead_lettered" : "terminal";
    const result = await db.query(
      `
      update durable_executions
      set
        status = $3::text,
        lease_token = null,
        lease_expires_at = null,
        claimed_by = null,
        next_retry_at = null,
        dead_lettered_at = case when $3::text = 'dead_lettered' then now() else dead_lettered_at end,
        last_error_code = nullif($4::text, ''),
        last_error_message = nullif($5::text, ''),
        last_error_classification = nullif($6::text, '')
      where id = $1::uuid
        and ($2::text = '' or lease_token = $2::text or lease_token is null)
      returning *
      `,
      [executionId, s(leaseToken), status, s(errorCode), s(errorMessage), s(errorClassification)]
    );

    return normalizeExecution(result.rows?.[0] || null);
  }

  async function retryExecution({
    executionId,
    nextRetryAt = new Date().toISOString(),
    reason = "manual_retry",
  } = {}) {
    const result = await db.query(
      `
      update durable_executions
      set
        status = 'pending',
        lease_token = null,
        lease_expires_at = null,
        claimed_by = null,
        next_retry_at = $2::timestamptz,
        dead_lettered_at = null,
        last_error_code = nullif($3::text, ''),
        last_error_message = case
          when nullif($3::text, '') is null then last_error_message
          else nullif(last_error_message, '')
        end
      where id = $1::uuid
        and status in ('retryable', 'terminal', 'dead_lettered')
      returning *
      `,
      [executionId, nextRetryAt, s(reason)]
    );

    return normalizeExecution(result.rows?.[0] || null);
  }

  return {
    enqueueExecution,
    getExecutionById,
    listExecutions,
    listAttempts,
    getExecutionSummary,
    listExecutionAuditTrail,
    claimNextExecution,
    createAttemptStart,
    completeAttempt,
    markExecutionSucceeded,
    markExecutionRetryable,
    markExecutionTerminal,
    retryExecution,
  };
}

export const __test__ = {
  normalizeExecution,
  normalizeAttempt,
  normalizeListStatus,
};
