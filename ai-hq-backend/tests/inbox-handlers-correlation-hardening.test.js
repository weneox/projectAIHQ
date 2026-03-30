import test from "node:test";
import assert from "node:assert/strict";

import { inboxHandlers } from "../src/routes/api/inbox/handlers.js";

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

function getRouteHandler(router, path, method) {
  const layer = router.stack.find(
    (item) => item?.route?.path === path && item?.route?.methods?.[method]
  );
  return layer?.route?.stack?.[0]?.handle || null;
}

test("public outbound thread message creation persists authoritative attempt correlation instead of emitting an empty shell", async () => {
  const threadId = "11111111-1111-4111-8111-111111111111";
  const tenantId = "22222222-2222-4222-8222-222222222222";
  const messageId = "33333333-3333-4333-8333-333333333333";
  const attemptId = "44444444-4444-4444-8444-444444444444";
  const executionId = "55555555-5555-4555-8555-555555555555";
  const audit = [];

  const threadRow = {
    id: threadId,
    tenant_id: tenantId,
    tenant_key: "acme",
    channel: "instagram",
    external_thread_id: "thread-ext-1",
    external_user_id: "user-ext-1",
    external_username: "user1",
    customer_name: "Customer One",
    status: "open",
    last_message_at: "2026-03-30T00:00:00.000Z",
    last_inbound_at: "2026-03-30T00:00:00.000Z",
    last_outbound_at: null,
    unread_count: 0,
    assigned_to: null,
    labels: [],
    meta: {},
    handoff_active: true,
    handoff_reason: "manual_review",
    handoff_priority: "high",
    handoff_at: "2026-03-30T00:00:00.000Z",
    handoff_by: "operator",
    created_at: "2026-03-30T00:00:00.000Z",
    updated_at: "2026-03-30T00:00:00.000Z",
  };

  const db = {
    async query(text, params = []) {
      const sql = String(text || "").toLowerCase();

      if (sql.includes("from inbox_threads") && sql.includes("where id = $1::uuid")) {
        return { rows: [threadRow] };
      }

      if (sql.includes("insert into audit_log")) {
        audit.push({
          action: params[3],
          objectType: params[4],
          objectId: params[5],
          meta: JSON.parse(params[6]),
        });
        return { rows: [] };
      }

      throw new Error(`Unexpected db query: ${text}`);
    },
    async connect() {
      return {
        async query(text, params = []) {
          const sql = String(text || "").toLowerCase();

          if (sql === "begin" || sql === "commit") {
            return { rows: [] };
          }

          if (sql.includes("insert into inbox_messages")) {
            return {
              rows: [
                {
                  id: messageId,
                  thread_id: threadId,
                  tenant_key: "acme",
                  direction: "outbound",
                  sender_type: "agent",
                  external_message_id: null,
                  message_type: "text",
                  text: "hello there",
                  attachments: [],
                  meta: {},
                  sent_at: null,
                  created_at: "2026-03-30T10:00:00.000Z",
                },
              ],
            };
          }

          if (sql.includes("update inbox_threads")) {
            return { rows: [] };
          }

          if (sql.includes("insert into inbox_outbound_attempts")) {
            return {
              rows: [
                {
                  id: attemptId,
                  message_id: messageId,
                  thread_id: threadId,
                  tenant_key: "acme",
                  channel: "instagram",
                  provider: "meta",
                  recipient_id: "user-ext-1",
                  payload: {},
                  provider_response: {},
                  status: "queued",
                  attempt_count: 0,
                  max_attempts: 5,
                  queued_at: "2026-03-30T10:00:00.000Z",
                  created_at: "2026-03-30T10:00:00.000Z",
                  updated_at: "2026-03-30T10:00:00.000Z",
                },
              ],
            };
          }

          if (sql.includes("insert into durable_executions")) {
            return {
              rows: [
                {
                  id: executionId,
                  tenant_id: tenantId,
                  tenant_key: "acme",
                  channel: "instagram",
                  provider: "meta",
                  action_type: "meta.outbound.send",
                  target_type: "thread",
                  target_id: threadId,
                  thread_id: threadId,
                  conversation_id: "",
                  message_id: messageId,
                  idempotency_key: "idem-1",
                  payload_summary: {},
                  safe_metadata: {
                    inboxOutboundAttemptId: attemptId,
                    threadId,
                    messageId,
                    recipientId: "user-ext-1",
                  },
                  correlation_ids: {
                    threadId,
                    messageId,
                    outboundAttemptId: attemptId,
                  },
                  status: "pending",
                  attempt_count: 0,
                  max_attempts: 5,
                  next_retry_at: "2026-03-30T10:00:00.000Z",
                  lease_token: "",
                  lease_expires_at: null,
                  claimed_by: "",
                  last_attempt_at: null,
                  succeeded_at: null,
                  dead_lettered_at: null,
                  last_error_code: "",
                  last_error_message: "",
                  last_error_classification: "",
                  created_at: "2026-03-30T10:00:00.000Z",
                  updated_at: "2026-03-30T10:00:00.000Z",
                },
              ],
            };
          }

          throw new Error(`Unexpected client query: ${text}`);
        },
        release() {},
      };
    },
  };

  const handler = getRouteHandler(
    inboxHandlers({ db, wsHub: null }),
    "/inbox/threads/:id/messages",
    "post"
  );

  const req = {
    params: { id: threadId },
    body: {
      direction: "outbound",
      senderType: "agent",
      operatorName: "operator",
      messageType: "text",
      text: "hello there",
      releaseHandoff: false,
      meta: {
        source: "inbox_ui",
      },
    },
    auth: {
      tenantKey: "acme",
      tenantId,
    },
    headers: {
      "x-tenant-key": "acme",
    },
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.message?.id, messageId);
  assert.deepEqual(res.body?.message?.outbound_attempt_correlation, {
    message_id: messageId,
    latest_attempt_id: attemptId,
    attempt_ids: [attemptId],
    durable_execution_ids: [],
    referenced_attempt_ids: [],
    correlation_state: "correlated",
    reason_code: "attempt_records_present",
    historical_exception: false,
  });
  assert.equal(res.body?.thread?.tenant_id, tenantId);
  assert.equal(Array.isArray(audit), true);
});

test("thread message reads classify legacy outbound rows without attempts as historical exceptions", async () => {
  const threadId = "11111111-1111-4111-8111-111111111111";
  const messageId = "33333333-3333-4333-8333-333333333333";

  const db = {
    async query(text, params = []) {
      const sql = String(text || "").toLowerCase();

      if (sql.includes("from inbox_messages") && sql.includes("where thread_id = $1::uuid")) {
        return {
          rows: [
            {
              id: messageId,
              thread_id: threadId,
              tenant_key: "acme",
              direction: "outbound",
              sender_type: "operator",
              external_message_id: "provider-legacy-1",
              message_type: "text",
              text: "legacy send",
              attachments: [],
              meta: {
                delivery: {
                  status: "sent",
                  providerMessageId: "provider-legacy-1",
                },
              },
              sent_at: "2026-03-20T10:00:00.000Z",
              created_at: "2026-03-20T10:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("from inbox_outbound_attempts")) {
        return { rows: [] };
      }

      if (sql.includes("from durable_executions")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected db query: ${text}`);
    },
  };

  const handler = getRouteHandler(
    inboxHandlers({ db, wsHub: null }),
    "/inbox/threads/:id/messages",
    "get"
  );

  const req = {
    params: { id: threadId },
    query: {},
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.deepEqual(res.body?.messages?.[0]?.outbound_attempt_correlation, {
    message_id: messageId,
    latest_attempt_id: null,
    attempt_ids: [],
    durable_execution_ids: [],
    referenced_attempt_ids: [],
    correlation_state: "historical_missing_attempt",
    reason_code: "legacy_message_without_attempt_records",
    historical_exception: true,
  });
});
