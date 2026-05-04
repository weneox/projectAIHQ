import test from "node:test";
import assert from "node:assert/strict";

import { createDurableExecutionHelpers } from "../src/db/helpers/durableExecutions.js";
import {
  createTenantGuardedDb,
  getTenantContext,
} from "../src/db/tenantContext.js";
import { createDurableExecutionWorker } from "../src/workers/durableExecutionWorker.js";

const EXECUTION_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";

function compactSql(sql = "") {
  return String(sql || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function createMemoryLogger() {
  const events = [];
  const logger = {
    events,
    info(event, data = {}) {
      events.push({ level: "info", event, data });
    },
    warn(event, data = {}) {
      events.push({ level: "warn", event, data });
    },
    error(event, error = null, data = {}) {
      events.push({
        level: "error",
        event,
        data,
        errorCode: error?.code || "",
        errorMessage: error?.message || String(error || ""),
      });
    },
    child() {
      return logger;
    },
  };
  return logger;
}

function baseExecution(overrides = {}) {
  return {
    id: EXECUTION_ID,
    tenant_id: TENANT_ID,
    tenant_key: "acme",
    channel: "instagram",
    provider: "meta",
    action_type: "meta.outbound.send",
    target_type: "message",
    target_id: "msg-1",
    thread_id: "33333333-3333-4333-8333-333333333333",
    conversation_id: "conversation-1",
    message_id: "44444444-4444-4444-8444-444444444444",
    idempotency_key: "idem-1",
    payload_summary: { text: "hello" },
    safe_metadata: {},
    correlation_ids: { requestId: "req-worker-1" },
    status: "in_progress",
    attempt_count: 1,
    max_attempts: 3,
    next_retry_at: null,
    lease_token: "lease-1",
    lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
    claimed_by: "durable-execution-worker:test",
    last_attempt_at: new Date().toISOString(),
    succeeded_at: null,
    dead_lettered_at: null,
    last_error_code: null,
    last_error_message: null,
    last_error_classification: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createGuardedDurableDb() {
  const queries = [];
  let claimCount = 0;
  const execution = baseExecution();

  const rawDb = {
    async query(sql, params = []) {
      const text = compactSql(sql);
      const context = { ...(getTenantContext() || {}) };
      let kind = "unknown";

      if (text.includes("external_idempotency_keys")) {
        kind = "external-idempotency-reconcile";
        queries.push({ kind, sql: text, params, context });
        return { rows: [] };
      }

      if (text.includes("with candidate as") && text.includes("update durable_executions d")) {
        kind = "durable-claim";
        queries.push({ kind, sql: text, params, context });
        claimCount += 1;
        if (claimCount > 1) return { rows: [] };
        return {
          rows: [
            baseExecution({
              lease_token: params[1],
              lease_expires_at: new Date(Date.now() + Number(params[2] || 60_000)).toISOString(),
              claimed_by: params[3],
            }),
          ],
        };
      }

      if (text.startsWith("insert into durable_execution_attempts")) {
        kind = "durable-attempt-start";
        queries.push({ kind, sql: text, params, context });
        return {
          rows: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              execution_id: params[0],
              attempt_number: params[1],
              status_from: params[2],
              lease_token: params[3],
              correlation_ids: JSON.parse(params[4] || "{}"),
              created_at: new Date().toISOString(),
            },
          ],
        };
      }

      if (text.startsWith("update durable_execution_attempts")) {
        kind = "durable-attempt-complete";
        queries.push({ kind, sql: text, params, context });
        return {
          rows: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              execution_id: params[0],
              attempt_number: params[1],
              status_from: "pending",
              status_to: params[2],
              result_summary: JSON.parse(params[6] || "{}"),
              correlation_ids: JSON.parse(params[7] || "{}"),
              created_at: new Date().toISOString(),
            },
          ],
        };
      }

      if (text.startsWith("update durable_executions set status = 'succeeded'")) {
        kind = "durable-finalize-success";
        queries.push({ kind, sql: text, params, context });
        return {
          rows: [
            {
              ...execution,
              id: params[0],
              status: "succeeded",
              lease_token: null,
              succeeded_at: new Date().toISOString(),
            },
          ],
        };
      }

      queries.push({ kind, sql: text, params, context });
      throw new Error(`unexpected durable worker query: ${text}`);
    },
  };

  return {
    db: createTenantGuardedDb(rawDb),
    queries,
    execution,
  };
}

test("durable queue claim remains fail-closed without system context", async () => {
  const rawDb = {
    async query() {
      return { rows: [] };
    },
  };
  const db = createTenantGuardedDb(rawDb);
  const helpers = createDurableExecutionHelpers({ db });

  await assert.rejects(
    () =>
      helpers.claimNextExecution({
        workerId: "worker-1",
        leaseToken: "lease-1",
        leaseMs: 60_000,
      }),
    (error) => error?.code === "TENANT_CONTEXT_REQUIRED"
  );
});

test("durable worker tick uses system context for control-plane queue work and tenant context for execution", async () => {
  const { db, queries, execution } = createGuardedDurableDb();
  const logger = createMemoryLogger();
  const processContexts = [];

  const worker = createDurableExecutionWorker({
    db,
    logger,
    async processExecution({ execution: claimed }) {
      processContexts.push({ ...(getTenantContext() || {}) });
      assert.equal(claimed.id, execution.id);
      return {
        ok: true,
        resultSummary: { processed: true },
      };
    },
  });

  await worker.runOnce();

  assert.equal(
    logger.events.some(
      (event) =>
        event.event === "durable_execution.tick.failed" &&
        event.errorCode === "TENANT_CONTEXT_REQUIRED"
    ),
    false
  );
  assert.equal(
    logger.events.some((event) => event.event === "durable_execution.tick.failed"),
    false
  );

  assert.deepEqual(processContexts, [
    {
      tenantId: execution.tenant_id,
      tenantKey: execution.tenant_key,
      userId: "",
      requestId: execution.correlation_ids.requestId,
      source: "durable_execution_worker",
      system: false,
      reason: "",
    },
  ]);

  for (const kind of [
    "external-idempotency-reconcile",
    "durable-claim",
    "durable-attempt-start",
    "durable-attempt-complete",
    "durable-finalize-success",
  ]) {
    const matches = queries.filter((query) => query.kind === kind);
    assert.ok(matches.length > 0, `${kind} should run during the worker tick`);
    for (const query of matches) {
      assert.equal(query.context.system, true, `${kind} must use system DB context`);
    }
  }
});
