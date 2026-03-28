import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { createDurableExecutionHelpers } from "../src/db/helpers/durableExecutions.js";
import { finalizeDurableExecution } from "../src/services/durableExecutionService.js";
import { executionsRoutes } from "../src/routes/api/executions/index.js";

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function normalizeSql(sql) {
  return String(sql || "").trim().toLowerCase().replace(/\s+/g, " ");
}

class FakeDurableExecutionDb {
  constructor() {
    this.executions = new Map();
    this.executionAttempts = new Map();
    this.idempotency = new Map();
    this.auditEntries = [];
  }

  _clone(row) {
    return row ? JSON.parse(JSON.stringify(row)) : row;
  }

  _attemptKey(executionId, attemptNumber) {
    return `${executionId}:${attemptNumber}`;
  }

  _listExecutions() {
    return [...this.executions.values()].map((row) => this._clone(row));
  }

  async query(sql, params = []) {
    const text = normalizeSql(sql);

    if (text.startsWith("insert into durable_executions")) {
      const key = [params[2], params[4], params[5], params[11]].join("|");
      const existingId = this.idempotency.get(key);
      if (existingId && this.executions.has(existingId)) {
        return { rows: [this._clone(this.executions.get(existingId))] };
      }

      const row = {
        id: params[0],
        tenant_id: params[1] || null,
        tenant_key: params[2],
        channel: params[3],
        provider: params[4],
        action_type: params[5],
        target_type: params[6],
        target_id: params[7] || null,
        thread_id: params[8] || null,
        conversation_id: params[9] || null,
        message_id: params[10] || null,
        idempotency_key: params[11],
        payload_summary: JSON.parse(params[12]),
        safe_metadata: JSON.parse(params[13]),
        correlation_ids: JSON.parse(params[14]),
        status: "pending",
        attempt_count: 0,
        max_attempts: params[15],
        next_retry_at: params[16],
        lease_token: null,
        lease_expires_at: null,
        claimed_by: null,
        last_attempt_at: null,
        succeeded_at: null,
        dead_lettered_at: null,
        last_error_code: null,
        last_error_message: null,
        last_error_classification: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };

      this.executions.set(row.id, row);
      this.idempotency.set(key, row.id);
      return { rows: [this._clone(row)] };
    }

    if (text.includes("from durable_executions where id = $1::uuid")) {
      return { rows: [this._clone(this.executions.get(params[0]))].filter(Boolean) };
    }

    if (text.startsWith("select * from durable_executions")) {
      const limit = Number(params[params.length - 1] || 50);
      let rows = this._listExecutions();

      if (text.includes("tenant_id =")) {
        rows = rows.filter((row) => String(row.tenant_id || "") === String(params[0] || ""));
      } else if (text.includes("tenant_key =")) {
        rows = rows.filter((row) => String(row.tenant_key || "") === String(params[0] || ""));
      }

      if (text.includes("status = $")) {
        const status = params[params.length - 2];
        rows = rows.filter((row) => row.status === status);
      } else if (text.includes("status in ('retryable','terminal','dead_lettered')")) {
        rows = rows.filter((row) => ["retryable", "terminal", "dead_lettered"].includes(row.status));
      }

      rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      return { rows: rows.slice(0, limit).map((row) => this._clone(row)) };
    }

    if (text.startsWith("with scoped as ( select * from durable_executions")) {
      let rows = this._listExecutions();
      if (text.includes("tenant_id = $1::uuid")) {
        rows = rows.filter((row) => String(row.tenant_id || "") === String(params[0] || ""));
      } else if (text.includes("tenant_key = $1::text")) {
        rows = rows.filter((row) => String(row.tenant_key || "") === String(params[0] || ""));
      }

      const retryableRows = rows
        .filter((row) => row.status === "retryable")
        .sort((a, b) => String(a.next_retry_at || a.created_at).localeCompare(String(b.next_retry_at || b.created_at)));
      const inProgressRows = rows
        .filter((row) => row.status === "in_progress")
        .sort((a, b) => String(a.last_attempt_at || a.created_at).localeCompare(String(b.last_attempt_at || b.created_at)));

      return {
        rows: [{
          pending_count: rows.filter((row) => row.status === "pending").length,
          in_progress_count: rows.filter((row) => row.status === "in_progress").length,
          succeeded_count: rows.filter((row) => row.status === "succeeded").length,
          retryable_count: rows.filter((row) => row.status === "retryable").length,
          terminal_count: rows.filter((row) => row.status === "terminal").length,
          dead_lettered_count: rows.filter((row) => row.status === "dead_lettered").length,
          oldest_retryable: retryableRows[0] ? {
            id: retryableRows[0].id,
            created_at: retryableRows[0].created_at,
            next_retry_at: retryableRows[0].next_retry_at,
            updated_at: retryableRows[0].updated_at,
          } : null,
          oldest_in_progress: inProgressRows[0] ? {
            id: inProgressRows[0].id,
            created_at: inProgressRows[0].created_at,
            last_attempt_at: inProgressRows[0].last_attempt_at,
            lease_expires_at: inProgressRows[0].lease_expires_at,
            updated_at: inProgressRows[0].updated_at,
          } : null,
        }],
      };
    }

    if (text.startsWith("with candidate as ( select id from durable_executions")) {
      const statuses = params[0];
      const leaseToken = params[1];
      const leaseMs = Number(params[2] || 60000);
      const workerId = params[3];
      const now = Date.now();

      const candidates = this._listExecutions()
        .filter((row) => statuses.includes(row.status))
        .filter((row) => {
          const nextRetryMs = row.next_retry_at ? new Date(row.next_retry_at).getTime() : now;
          const leaseExpiresMs = row.lease_expires_at
            ? new Date(row.lease_expires_at).getTime()
            : 0;

          return (
            ((row.status === "pending" || row.status === "retryable") && nextRetryMs <= now) ||
            (row.status === "in_progress" && leaseExpiresMs <= now)
          );
        })
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

      const row = candidates[0];
      if (!row) return { rows: [] };

      row.status = "in_progress";
      row.attempt_count += 1;
      row.lease_token = leaseToken;
      row.lease_expires_at = nowIso(leaseMs);
      row.claimed_by = workerId;
      row.last_attempt_at = nowIso();
      row.next_retry_at = null;
      row.updated_at = nowIso();
      this.executions.set(row.id, row);
      return { rows: [this._clone(row)] };
    }

    if (text.startsWith("insert into durable_execution_attempts")) {
      const key = this._attemptKey(params[0], params[1]);
      const existing = this.executionAttempts.get(key);
      const row = existing || {
        id: `${params[0]}:${params[1]}`,
        execution_id: params[0],
        attempt_number: params[1],
        status_from: params[2],
        status_to: null,
        lease_token: params[3],
        started_at: nowIso(),
        finished_at: null,
        error_code: null,
        error_message: null,
        error_classification: null,
        result_summary: {},
        correlation_ids: JSON.parse(params[4]),
        created_at: nowIso(),
      };

      row.status_from = params[2];
      row.lease_token = params[3];
      row.correlation_ids = JSON.parse(params[4]);
      this.executionAttempts.set(key, row);
      return { rows: [this._clone(row)] };
    }

    if (text.startsWith("update durable_execution_attempts")) {
      const key = this._attemptKey(params[0], params[1]);
      const row = this.executionAttempts.get(key);
      if (!row) return { rows: [] };
      row.status_to = params[2];
      row.finished_at = nowIso();
      row.error_code = params[3] || null;
      row.error_message = params[4] || null;
      row.error_classification = params[5] || null;
      row.result_summary = JSON.parse(params[6]);
      row.correlation_ids = JSON.parse(params[7]);
      this.executionAttempts.set(key, row);
      return { rows: [this._clone(row)] };
    }

    if (text.startsWith("update durable_executions set status = 'succeeded'")) {
      const row = this.executions.get(params[0]);
      if (!row) return { rows: [] };
      row.status = "succeeded";
      row.lease_token = null;
      row.lease_expires_at = null;
      row.claimed_by = null;
      row.succeeded_at = nowIso();
      row.last_error_code = null;
      row.last_error_message = null;
      row.last_error_classification = null;
      row.next_retry_at = null;
      row.updated_at = nowIso();
      return { rows: [this._clone(row)] };
    }

    if (text.startsWith("update durable_executions set status = 'retryable'")) {
      const row = this.executions.get(params[0]);
      if (!row) return { rows: [] };
      row.status = "retryable";
      row.lease_token = null;
      row.lease_expires_at = null;
      row.claimed_by = null;
      row.next_retry_at = params[2];
      row.last_error_code = params[3] || null;
      row.last_error_message = params[4] || null;
      row.last_error_classification = params[5] || null;
      row.updated_at = nowIso();
      return { rows: [this._clone(row)] };
    }

    if (text.startsWith("update durable_executions set status = $3::text")) {
      const row = this.executions.get(params[0]);
      if (!row) return { rows: [] };
      row.status = params[2];
      row.lease_token = null;
      row.lease_expires_at = null;
      row.claimed_by = null;
      row.next_retry_at = null;
      row.last_error_code = params[3] || null;
      row.last_error_message = params[4] || null;
      row.last_error_classification = params[5] || null;
      if (row.status === "dead_lettered") row.dead_lettered_at = nowIso();
      row.updated_at = nowIso();
      return { rows: [this._clone(row)] };
    }

    if (text.startsWith("update durable_executions set status = 'pending'")) {
      const row = this.executions.get(params[0]);
      if (!row || !["retryable", "terminal", "dead_lettered"].includes(row.status)) {
        return { rows: [] };
      }

      row.status = "pending";
      row.lease_token = null;
      row.lease_expires_at = null;
      row.claimed_by = null;
      row.next_retry_at = params[1];
      row.dead_lettered_at = null;
      row.last_error_code = params[2] || null;
      row.updated_at = nowIso();
      return { rows: [this._clone(row)] };
    }

    if (text.startsWith("select * from durable_execution_attempts")) {
      const rows = [...this.executionAttempts.values()]
        .filter((row) => row.execution_id === params[0])
        .sort((a, b) => b.attempt_number - a.attempt_number);
      return { rows: rows.map((row) => this._clone(row)) };
    }

    if (text.startsWith("insert into audit_log")) {
      const row = {
        id: `audit-${this.auditEntries.length + 1}`,
        tenant_id: params[0] || null,
        tenant_key: params[1] || null,
        actor: params[2] || "system",
        action: params[3],
        object_type: params[4],
        object_id: params[5],
        meta: typeof params[6] === "string" ? JSON.parse(params[6]) : params[6],
        created_at: nowIso(),
      };
      this.auditEntries.unshift(row);
      return { rows: [this._clone(row)] };
    }

    if (text.startsWith("select id, tenant_id, tenant_key, actor, action, object_type, object_id, meta, created_at from audit_log")) {
      let rows = this.auditEntries.filter((row) => row.object_type === "durable_execution" && row.object_id === params[0]);
      if (text.includes("tenant_id = $2::uuid")) {
        rows = rows.filter((row) => String(row.tenant_id || "") === String(params[1] || ""));
      } else if (text.includes("lower(coalesce(tenant_key, '')) = $2::text")) {
        rows = rows.filter((row) => String(row.tenant_key || "").toLowerCase() === String(params[1] || "").toLowerCase());
      }
      const limit = Number(params[params.length - 1] || 20);
      return { rows: rows.slice(0, limit).map((row) => this._clone(row)) };
    }

    throw new Error(`Unhandled SQL in FakeDurableExecutionDb: ${text}`);
  }
}

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    finished: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
  };
}

async function invokeRouter(router, method, path, req = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ req: fullReq, res });
    };

    const normalizedHeaders = Object.fromEntries(
      Object.entries(req.headers || {}).map(([key, value]) => [String(key).toLowerCase(), value])
    );

    const fullReq = {
      method: String(method || "GET").toUpperCase(),
      path,
      originalUrl: path,
      url: path,
      params: req.params || {},
      headers: normalizedHeaders,
      query: req.query || {},
      body: req.body || {},
      protocol: "https",
      app: { locals: {} },
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      ...req,
    };

    const res = createMockRes(finish);

    try {
      router.handle(fullReq, res, (err) => {
        if (settled) return;
        if (err) {
          settled = true;
          reject(err);
          return;
        }
        settled = true;
        resolve({ req: fullReq, res });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function buildAuth(role = "operator") {
  return {
    userId: "user-1",
    email: `${role}@acme.test`,
    tenantId: "tenant-1",
    tenantKey: "acme",
    role,
  };
}

test("idempotency returns the same durable execution instead of duplicating work", async () => {
  const db = new FakeDurableExecutionDb();
  const helpers = createDurableExecutionHelpers({ db });

  const first = await helpers.enqueueExecution({
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "tenant-1",
    tenantKey: "acme",
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
    idempotencyKey: "idem-1",
    payloadSummary: { text: "hello" },
  });

  const second = await helpers.enqueueExecution({
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: "tenant-1",
    tenantKey: "acme",
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
    idempotencyKey: "idem-1",
    payloadSummary: { text: "hello again" },
  });

  assert.equal(first?.id, second?.id);
  assert.equal(db.executions.size, 1);
});

test("retryable failures reschedule with a durable retry timestamp", async () => {
  const db = new FakeDurableExecutionDb();
  const helpers = createDurableExecutionHelpers({ db });
  await helpers.enqueueExecution({
    id: "33333333-3333-4333-8333-333333333333",
    tenantId: "tenant-1",
    tenantKey: "acme",
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
    idempotencyKey: "idem-retry",
    payloadSummary: { text: "retry me" },
  });

  const claimed = await helpers.claimNextExecution({
    workerId: "worker-a",
    leaseToken: "lease-a",
    leaseMs: 60000,
  });
  await helpers.createAttemptStart({
    executionId: claimed.id,
    attemptNumber: claimed.attempt_count,
    statusFrom: "pending",
    leaseToken: claimed.lease_token,
  });

  const updated = await finalizeDurableExecution({
    db,
    execution: claimed,
    result: {
      ok: false,
      retryable: true,
      errorCode: "http_503",
      errorMessage: "temporary failure",
      classification: "retryable_gateway_failure",
    },
  });

  assert.equal(updated?.status, "retryable");
  assert.equal(Boolean(updated?.next_retry_at), true);
});

test("exhausted retryable failures become dead-lettered durably", async () => {
  const db = new FakeDurableExecutionDb();
  const helpers = createDurableExecutionHelpers({ db });
  await helpers.enqueueExecution({
    id: "44444444-4444-4444-8444-444444444444",
    tenantId: "tenant-1",
    tenantKey: "acme",
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
    idempotencyKey: "idem-dead",
    payloadSummary: { text: "fail forever" },
    maxAttempts: 1,
  });

  const claimed = await helpers.claimNextExecution({
    workerId: "worker-a",
    leaseToken: "lease-a",
    leaseMs: 60000,
  });
  await helpers.createAttemptStart({
    executionId: claimed.id,
    attemptNumber: claimed.attempt_count,
    statusFrom: "pending",
    leaseToken: claimed.lease_token,
  });

  const updated = await finalizeDurableExecution({
    db,
    execution: claimed,
    result: {
      ok: false,
      retryable: true,
      errorCode: "http_503",
      errorMessage: "still failing",
      classification: "retryable_gateway_failure",
    },
  });

  const attempts = await helpers.listAttempts(claimed.id);
  assert.equal(updated?.status, "dead_lettered");
  assert.equal(attempts[0]?.status_to, "dead_lettered");
});

test("concurrent claims do not hand the same execution to two workers", async () => {
  const db = new FakeDurableExecutionDb();
  const helpers = createDurableExecutionHelpers({ db });
  await helpers.enqueueExecution({
    id: "55555555-5555-4555-8555-555555555555",
    tenantId: "tenant-1",
    tenantKey: "acme",
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
    idempotencyKey: "idem-claim",
    payloadSummary: { text: "claim me once" },
  });

  const [first, second] = await Promise.all([
    helpers.claimNextExecution({
      workerId: "worker-a",
      leaseToken: "lease-a",
      leaseMs: 60000,
    }),
    helpers.claimNextExecution({
      workerId: "worker-b",
      leaseToken: "lease-b",
      leaseMs: 60000,
    }),
  ]);

  assert.equal(Boolean(first?.id) || Boolean(second?.id), true);
  assert.equal(Boolean(first?.id && second?.id), false);
});

test("pending and retryable work remains claimable across helper re-instantiation", async () => {
  const db = new FakeDurableExecutionDb();
  const firstHelpers = createDurableExecutionHelpers({ db });
  const inserted = await firstHelpers.enqueueExecution({
    id: "66666666-6666-4666-8666-666666666666",
    tenantId: "tenant-1",
    tenantKey: "acme",
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
    idempotencyKey: "idem-restart",
    payloadSummary: { text: "survive restart" },
  });

  const secondHelpers = createDurableExecutionHelpers({ db });
  const claimed = await secondHelpers.claimNextExecution({
    workerId: "worker-after-restart",
    leaseToken: "lease-after-restart",
    leaseMs: 60000,
  });

  assert.equal(claimed?.id, inserted?.id);
});

test("manual retry remains operator-only and requeues durable executions for admins", async () => {
  const db = new FakeDurableExecutionDb();
  const helpers = createDurableExecutionHelpers({ db });
  const execution = await helpers.enqueueExecution({
    id: "77777777-7777-4777-8777-777777777777",
    tenantId: "tenant-1",
    tenantKey: "acme",
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
    idempotencyKey: "idem-manual-retry",
    payloadSummary: { text: "retry me later" },
  });

  await helpers.markExecutionTerminal({
    executionId: execution.id,
    errorCode: "http_400",
    errorMessage: "bad request",
    errorClassification: "terminal_gateway_failure",
    deadLetter: true,
  });

  const router = executionsRoutes({ db, wsHub: null });
  const denied = await invokeRouter(
    router,
    "post",
    `/executions/durable/${execution.id}/retry`,
    {
      params: { id: execution.id },
      auth: buildAuth("member"),
    }
  );
  assert.equal(denied.res.statusCode, 403);

  const allowed = await invokeRouter(
    router,
    "post",
    `/executions/durable/${execution.id}/retry`,
    {
      params: { id: execution.id },
      auth: buildAuth("admin"),
    }
  );

  assert.equal(allowed.res.statusCode, 200);
  assert.equal(allowed.res.body?.ok, true);
  assert.equal(allowed.res.body?.execution?.status, "pending");
  assert.equal(allowed.res.body?.auditTrail?.[0]?.action, "durable_execution.manual_retry");
});

test("durable summary endpoint exposes queue counts and worker health", async () => {
  const db = new FakeDurableExecutionDb();
  const helpers = createDurableExecutionHelpers({ db });
  await helpers.enqueueExecution({
    id: "88888888-8888-4888-8888-888888888888",
    tenantId: "tenant-1",
    tenantKey: "acme",
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
    idempotencyKey: "idem-summary-1",
    payloadSummary: {},
  });
  await helpers.enqueueExecution({
    id: "99999999-9999-4999-8999-999999999999",
    tenantId: "tenant-1",
    tenantKey: "acme",
    provider: "twilio",
    channel: "voice",
    actionType: "voice.sync.state",
    idempotencyKey: "idem-summary-2",
    payloadSummary: {},
  });
  await helpers.markExecutionRetryable({
    executionId: "99999999-9999-4999-8999-999999999999",
    nextRetryAt: nowIso(60_000),
    errorCode: "http_503",
    errorMessage: "retry later",
    errorClassification: "retryable_voice_sync_failure",
  });

  const router = executionsRoutes({ db, wsHub: null });
  const result = await invokeRouter(router, "get", "/executions/durable/summary", {
    auth: buildAuth("operator"),
    app: {
      locals: {
        durableExecutionWorker: {
          getState() {
            return {
              enabled: true,
              running: false,
              lastClaimAt: "2026-03-26T10:00:00.000Z",
            };
          },
        },
        sourceSyncWorker: {
          getState() {
            return {
              enabled: true,
              running: true,
              lastHeartbeatAt: "2026-03-26T10:02:00.000Z",
            };
          },
        },
      },
    },
  });

  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body?.ok, true);
  assert.equal(result.res.body?.summary?.counts?.retryable, 1);
  assert.equal(result.res.body?.summary?.worker?.enabled, true);
  assert.equal(result.res.body?.summary?.sourceSyncWorker?.enabled, true);
  assert.equal(result.res.body?.summary?.operational?.status, "ok");
});

test("durable detail endpoint includes manual retry audit trail", async () => {
  const db = new FakeDurableExecutionDb();
  const helpers = createDurableExecutionHelpers({ db });
  const execution = await helpers.enqueueExecution({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenantId: "tenant-1",
    tenantKey: "acme",
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
    idempotencyKey: "idem-audit-detail",
    payloadSummary: {},
  });
  db.auditEntries.unshift({
    id: "audit-seeded",
    tenant_id: "tenant-1",
    tenant_key: "acme",
    actor: "admin@acme.test",
    action: "durable_execution.manual_retry",
    object_type: "durable_execution",
    object_id: execution.id,
    meta: { requestedBy: "admin@acme.test" },
    created_at: nowIso(),
  });

  const router = executionsRoutes({ db, wsHub: null });
  const result = await invokeRouter(router, "get", `/executions/durable/${execution.id}`, {
    params: { id: execution.id },
    auth: buildAuth("operator"),
  });

  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body?.auditTrail?.[0]?.action, "durable_execution.manual_retry");
});

test("voice sync internal enqueue accepts work into the durable ledger instead of executing inline", async () => {
  const db = new FakeDurableExecutionDb();
  const router = executionsRoutes({ db, wsHub: null });
  const previousEnv = cfg.app.env;
  const previousToken = cfg.security.aihqInternalToken;

  try {
    cfg.app.env = "development";
    cfg.security.aihqInternalToken = "internal-secret";

    const result = await invokeRouter(router, "post", "/internal/executions/voice-sync", {
      headers: {
        "x-internal-token": "internal-secret",
        "x-internal-service": "twilio-voice-backend",
        "x-internal-audience": "aihq-backend.executions.voice-sync",
      },
      body: {
        actionType: "voice.sync.state",
        tenantKey: "acme",
        idempotencyKey: "voice-sync-1",
        payload: {
          providerCallSid: "CA123",
          status: "completed",
        },
      },
      app: { locals: {} },
    });

    assert.equal(result.res.statusCode, 202);
    assert.equal(result.res.body?.execution?.status, "pending");
  } finally {
    cfg.app.env = previousEnv;
    cfg.security.aihqInternalToken = previousToken;
  }
});
