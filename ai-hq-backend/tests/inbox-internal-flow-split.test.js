import test from "node:test";
import assert from "node:assert/strict";

import {
  buildThreadStateForDecision,
  createInboxIngestHandler,
  loadStrictInboxRuntime,
  persistOutboundMessage,
} from "../src/routes/api/inbox/internal.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("strict inbox runtime loading stays fail-closed and requests strict authority", async () => {
  let captured = null;

  const result = await loadStrictInboxRuntime({
    client: {},
    tenantKey: "acme",
    threadState: { thread_id: "thread-1" },
    service: "inbox.ingest",
    getRuntime: async (input) => {
      captured = input;
      return {
        authority: {
          available: false,
          reasonCode: "runtime_projection_missing",
        },
        tenant: null,
      };
    },
  });

  assert.equal(captured?.authorityMode, "strict");
  assert.equal(captured?.tenantKey, "acme");
  assert.equal(result.ok, false);
  assert.equal(result.response?.error, "runtime_authority_unavailable");
  assert.equal(
    result.response?.details?.authority?.reasonCode,
    "runtime_projection_missing"
  );
});

test("inbox ingest duplicate handling short-circuits before runtime and brain orchestration", async () => {
  const thread = {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "22222222-2222-4222-8222-222222222222",
    tenant_key: "acme",
    channel: "instagram",
    external_thread_id: "thread-ext-1",
    external_user_id: "user-ext-1",
    external_username: "user1",
    customer_name: "Customer One",
    status: "open",
    last_message_at: "2026-03-27T00:00:00.000Z",
    last_inbound_at: "2026-03-27T00:00:00.000Z",
    last_outbound_at: null,
    unread_count: 1,
    assigned_to: null,
    labels: [],
    meta: {},
    handoff_active: false,
    handoff_reason: "",
    handoff_priority: "normal",
    handoff_at: null,
    handoff_by: null,
    created_at: "2026-03-27T00:00:00.000Z",
    updated_at: "2026-03-27T00:00:00.000Z",
  };

  const duplicateMessage = {
    id: "33333333-3333-4333-8333-333333333333",
    thread_id: thread.id,
    tenant_key: "acme",
    direction: "inbound",
    sender_type: "customer",
    external_message_id: "msg-ext-1",
    message_type: "text",
    text: "hello",
    attachments: [],
    meta: {},
    sent_at: "2026-03-27T00:00:00.000Z",
    created_at: "2026-03-27T00:00:00.000Z",
  };

  let runtimeCalls = 0;
  let brainCalls = 0;

  const client = {
    async query(text, values = []) {
      const sql = String(text?.text || text || "").toLowerCase();

      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("from tenants")) {
        return {
          rows: [
            {
              id: thread.tenant_id,
              tenant_key: "acme",
            },
          ],
        };
      }
      if (sql.includes("from inbox_threads") && sql.includes("external_thread_id")) {
        return { rows: [] };
      }
      if (sql.includes("insert into inbox_threads")) {
        return { rows: [thread] };
      }
      if (sql.includes("from inbox_messages") && sql.includes("direction = 'inbound'")) {
        return { rows: [duplicateMessage] };
      }
      if (sql.includes("from inbox_thread_state")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${text}`);
    },
    release() {},
  };

  const handler = createInboxIngestHandler({
    db: {
      connect: async () => client,
      query: async () => ({ rows: [] }),
    },
    wsHub: null,
    getRuntime: async () => {
      runtimeCalls += 1;
      return { tenant: { id: thread.tenant_id, tenant_key: "acme" } };
    },
    buildActions: async () => {
      brainCalls += 1;
      return { actions: [] };
    },
  });

  const req = {
    headers: {
      "x-tenant-key": "acme",
      "x-internal-token": "secret",
    },
    body: {
      externalThreadId: "thread-ext-1",
      externalUserId: "user-ext-1",
      externalMessageId: "msg-ext-1",
      text: "hello",
      channel: "instagram",
    },
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.duplicate, true);
  assert.equal(res.body?.message?.id, duplicateMessage.id);
  assert.equal(runtimeCalls, 0);
  assert.equal(brainCalls, 0);
});

test("persistOutboundMessage preserves payload metadata and durable correlation wiring", async () => {
  const thread = {
    id: "11111111-1111-4111-8111-111111111111",
  };

  const createAttemptCalls = [];
  const enqueueCalls = [];

  const result = await persistOutboundMessage({
    client: {
      async query(text) {
        const sql = String(text || "").toLowerCase();
        if (sql.includes("insert into inbox_messages")) {
          return {
            rows: [
              {
                id: "44444444-4444-4444-8444-444444444444",
                thread_id: thread.id,
                tenant_key: "acme",
                direction: "outbound",
                sender_type: "ai",
                external_message_id: null,
                message_type: "text",
                text: "hello back",
                attachments: [],
                meta: {},
                sent_at: "2026-03-27T00:00:00.000Z",
                created_at: "2026-03-27T00:00:00.000Z",
              },
            ],
          };
        }
        if (sql.includes("update inbox_threads")) {
          return { rows: [] };
        }
        throw new Error(`Unexpected query: ${text}`);
      },
    },
    thread,
    tenantId: "22222222-2222-4222-8222-222222222222",
    tenantKey: "acme",
    channel: "instagram",
    recipientId: "user-ext-1",
    senderType: "ai",
    requestedMessageType: "text",
    text: "hello back",
    attachments: [],
    meta: {
      correlationId: "corr-1",
      internalExecution: true,
    },
    createAttempt: async (input) => {
      createAttemptCalls.push(input);
      return { id: "attempt-1", tenant_key: input.tenantKey };
    },
    enqueueOutboundExecution: async (input) => {
      enqueueCalls.push(input);
    },
  });

  assert.equal(result.message?.id, "44444444-4444-4444-8444-444444444444");
  assert.equal(createAttemptCalls[0]?.payload?.meta?.correlationId, "corr-1");
  assert.equal(createAttemptCalls[0]?.payload?.meta?.internalExecution, true);
  assert.equal(enqueueCalls[0]?.payload?.meta?.correlationId, "corr-1");
  assert.equal(enqueueCalls[0]?.correlationIds?.messageId, result.message.id);
  assert.equal(enqueueCalls[0]?.safeMetadata?.recipientId, "user-ext-1");
});

test("decision thread-state shaping keeps queued execution and handoff semantics explicit", () => {
  const nextState = buildThreadStateForDecision({
    thread: {
      id: "thread-1",
      tenant_id: "tenant-1",
      tenant_key: "acme",
      status: "open",
      handoff_active: false,
      handoff_reason: "",
      handoff_priority: "normal",
    },
    tenant: {
      id: "tenant-1",
      tenant_key: "acme",
    },
    tenantKey: "acme",
    priorState: {
      last_customer_intent: "pricing",
      repeat_intent_count: 1,
      suppressed_until_operator_reply: false,
    },
    brain: {
      intent: "pricing",
    },
    actions: [{ type: "handoff", reason: "operator_needed", priority: "high" }],
    leadResults: [{ id: "lead-1" }],
    handoffResults: [{ ok: true }],
    executionResults: [
      {
        actionType: "send_message",
        message: { id: "msg-1", text: "We can help." },
        attempt: { id: "attempt-1" },
      },
    ],
  });

  assert.equal(nextState.repeat_intent_count, 2);
  assert.equal(nextState.suppressed_until_operator_reply, true);
  assert.equal(nextState.last_response_mode, "auto_reply");
  assert.deepEqual(nextState.last_decision_meta.queuedExecutionActionTypes, ["send_message"]);
  assert.deepEqual(nextState.last_decision_meta.queuedExecutionMessageIds, ["msg-1"]);
  assert.deepEqual(nextState.last_decision_meta.queuedExecutionAttemptIds, ["attempt-1"]);
});

test("inbox ingest blocks autonomous reply execution when runtime health is stale", async () => {
  const decisionEvents = [];
  const thread = {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "22222222-2222-4222-8222-222222222222",
    tenant_key: "acme",
    channel: "instagram",
    external_thread_id: "thread-ext-1",
    external_user_id: "user-ext-1",
    status: "open",
    handoff_active: false,
    handoff_reason: "",
    handoff_priority: "normal",
    meta: {},
  };

  const client = {
    async query(text) {
      const sql = String(text || "").toLowerCase();
      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("from tenants")) {
        return {
          rows: [{ id: thread.tenant_id, tenant_key: "acme" }],
        };
      }
      if (sql.includes("from inbox_threads") && sql.includes("external_thread_id")) {
        return { rows: [] };
      }
      if (sql.includes("insert into inbox_threads")) {
        return { rows: [thread] };
      }
      if (sql.includes("insert into inbox_messages")) {
        return {
          rows: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              thread_id: thread.id,
              tenant_key: "acme",
              direction: "inbound",
              sender_type: "customer",
              external_message_id: "msg-ext-1",
              message_type: "text",
              text: "hello",
              attachments: [],
              meta: {},
              sent_at: "2026-03-27T00:00:00.000Z",
              created_at: "2026-03-27T00:00:00.000Z",
            },
          ],
        };
      }
      if (sql.includes("from inbox_messages") && sql.includes("order by")) {
        return { rows: [] };
      }
      if (sql.includes("from inbox_thread_state")) {
        return { rows: [] };
      }
      if (sql.includes("update inbox_threads")) {
        return { rows: [] };
      }
      if (sql.includes("insert into inbox_thread_state")) {
        return { rows: [{}] };
      }
      if (sql.includes("insert into tenant_decision_events")) {
        const row = {
          id: `decision-${decisionEvents.length + 1}`,
          tenant_id: values?.[0],
          tenant_key: values?.[1],
          event_type: values?.[2],
          policy_outcome: values?.[7],
          runtime_projection_id: values?.[14],
        };
        decisionEvents.unshift(row);
        return { rows: [row] };
      }

      throw new Error(`Unexpected query: ${text}`);
    },
    release() {},
  };

  const handler = createInboxIngestHandler({
    db: {
      connect: async () => client,
      query: async () => ({ rows: [] }),
    },
    wsHub: null,
    getRuntime: async () => ({
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: thread.tenant_id,
        tenantKey: "acme",
        runtimeProjectionId: "projection-1",
        health: {
          status: "stale",
          primaryReasonCode: "projection_stale",
        },
      },
      tenant: {
        id: thread.tenant_id,
        tenant_key: "acme",
      },
      raw: {
        projection: {
          metadata_json: {
            approvalPolicy: {
              strictestOutcome: "auto_approvable",
              risk: { level: "low" },
            },
          },
        },
      },
      threadState: {},
      serviceCatalog: [],
      knowledgeEntries: [],
      responsePlaybooks: [],
    }),
    buildActions: async () => ({
      intent: "knowledge_answer",
      leadScore: 24,
      actions: [
        {
          type: "send_message",
          recipientId: "user-ext-1",
          text: "We can help.",
          meta: { intent: "knowledge_answer" },
        },
      ],
    }),
  });

  const req = {
    headers: {
      "x-tenant-key": "acme",
      "x-internal-token": "secret",
    },
    body: {
      externalThreadId: "thread-ext-1",
      externalUserId: "user-ext-1",
      externalMessageId: "msg-ext-1",
      text: "hello",
      channel: "instagram",
    },
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.executionPolicy?.strictestOutcome, "blocked_until_repair");
  assert.equal(res.body?.actions?.[0]?.type, "no_reply");
  assert.equal(res.body?.executionResults?.length, 0);
  assert.equal(Array.isArray(decisionEvents), true);
});
