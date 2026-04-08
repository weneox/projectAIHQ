import test from "node:test";
import assert from "node:assert/strict";

import { createRuntimeAuthorityError } from "../src/services/businessBrain/runtimeAuthority.js";
import { persistOutboundMessage } from "../src/routes/api/inbox/internal/execution.js";
import { createWebsiteWidgetHandlers } from "../src/routes/api/websiteWidget/index.js";
import { issueWebsiteWidgetSession } from "../src/routes/api/websiteWidget/session.js";

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

const tenantRow = {
  id: "11111111-1111-4111-8111-111111111111",
  tenant_key: "acme",
  company_name: "Acme Clinic",
  timezone: "Asia/Baku",
  website_url: "https://acme.example",
  widget_channel_status: "",
  widget_display_name: "",
  widget_config: {},
};

test("website widget bootstrap returns a real session and honest blocked automation when strict runtime is unavailable", async () => {
  const db = {
    async query(text) {
      const sql = String(text?.text || text || "").toLowerCase();
      if (sql.includes("from tenants t")) {
        return { rows: [tenantRow] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  };

  const { bootstrapWebsiteWidget } = createWebsiteWidgetHandlers({
    db,
    wsHub: null,
    getRuntime: async () => {
      throw createRuntimeAuthorityError({
        mode: "strict",
        tenantKey: "acme",
        reasonCode: "runtime_projection_missing",
        reason: "runtime_projection_missing",
        message: "Approved runtime authority is stale.",
      });
    },
  });

  const req = {
    body: {
      tenantKey: "acme",
      page: {
        url: "https://acme.example/pricing",
      },
    },
    headers: {
      origin: "https://acme.example",
    },
  };
  const res = createMockRes();

  await bootstrapWebsiteWidget(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.automation?.mode, "blocked_until_repair");
  assert.match(String(res.body?.sessionToken || ""), /\./);
  assert.equal(res.body?.thread, null);
});

test("website widget message persists the website thread and activates handoff when strict runtime is unavailable", async () => {
  const thread = {
    id: "22222222-2222-4222-8222-222222222222",
    tenant_id: tenantRow.id,
    tenant_key: "acme",
    channel: "web",
    external_thread_id: "website:session-1",
    external_user_id: "visitor-1",
    external_username: null,
    customer_name: "Website visitor",
    status: "open",
    last_message_at: "2026-04-08T09:00:00.000Z",
    last_inbound_at: "2026-04-08T09:00:00.000Z",
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
    created_at: "2026-04-08T09:00:00.000Z",
    updated_at: "2026-04-08T09:00:00.000Z",
  };

  const handoffThread = {
    ...thread,
    assigned_to: "human_handoff",
    labels: ["handoff", "high"],
    handoff_active: true,
    handoff_reason: "runtime_authority_unavailable",
    handoff_priority: "high",
    handoff_at: "2026-04-08T09:00:10.000Z",
    handoff_by: "website_widget",
    meta: {
      handoff: {
        active: true,
        reason: "runtime_authority_unavailable",
        priority: "high",
      },
    },
  };

  const inboundMessage = {
    id: "33333333-3333-4333-8333-333333333333",
    thread_id: thread.id,
    tenant_key: "acme",
    direction: "inbound",
    sender_type: "customer",
    external_message_id: "website:session-1:msg-1",
    message_type: "text",
    text: "Can someone help me today?",
    attachments: [],
    meta: {},
    sent_at: "2026-04-08T09:00:05.000Z",
    created_at: "2026-04-08T09:00:05.000Z",
  };

  const storedThreadState = {
    thread_id: thread.id,
    tenant_id: tenantRow.id,
    tenant_key: "acme",
    last_customer_intent: "",
    last_ai_intent: "",
    last_response_mode: "no_reply",
    suppressed_until_operator_reply: true,
    repeat_intent_count: 0,
    repeat_service_count: 0,
    awaiting_customer_answer_to: "",
    last_decision_meta: {
      executionPolicyOutcome: "blocked_until_repair",
    },
    created_at: "2026-04-08T09:00:10.000Z",
    updated_at: "2026-04-08T09:00:10.000Z",
  };

  const transactionCalls = [];

  const client = {
    async query(text) {
      const sql = String(text?.text || text || "").toLowerCase();
      transactionCalls.push(sql);

      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("from inbox_threads") && sql.includes("external_thread_id")) {
        return { rows: [] };
      }
      if (sql.includes("insert into inbox_threads")) {
        return { rows: [thread] };
      }
      if (sql.includes("from inbox_messages") && sql.includes("direction = 'inbound'")) {
        return { rows: [] };
      }
      if (sql.includes("insert into inbox_messages")) {
        return { rows: [inboundMessage] };
      }
      if (sql.includes("from inbox_messages") && sql.includes("order by sent_at desc")) {
        return { rows: [inboundMessage] };
      }
      if (sql.includes("from inbox_thread_state")) {
        return { rows: [] };
      }
      if (sql.includes("update inbox_threads") && sql.includes("handoff_active = true")) {
        return { rows: [handoffThread] };
      }
      if (sql.includes("insert into tenant_decision_events")) {
        return { rows: [{}] };
      }
      if (sql.includes("insert into inbox_thread_state")) {
        return { rows: [storedThreadState] };
      }

      throw new Error(`Unexpected query: ${text}`);
    },
    release() {},
  };

  const db = {
    async query(text) {
      const sql = String(text?.text || text || "").toLowerCase();
      if (sql.includes("from tenants t")) return { rows: [tenantRow] };
      throw new Error(`Unexpected db query: ${text}`);
    },
    connect: async () => client,
  };

  const { postWebsiteWidgetMessage } = createWebsiteWidgetHandlers({
    db,
    wsHub: null,
    getRuntime: async () => {
      throw createRuntimeAuthorityError({
        mode: "strict",
        tenantKey: "acme",
        reasonCode: "runtime_projection_missing",
        reason: "runtime_projection_missing",
        message: "Approved runtime authority is stale.",
      });
    },
  });

  const req = {
    body: {
      tenantKey: "acme",
      text: "Can someone help me today?",
      messageId: "msg-1",
      page: {
        url: "https://acme.example/pricing",
      },
    },
    headers: {
      origin: "https://acme.example",
    },
  };
  const res = createMockRes();

  await postWebsiteWidgetMessage(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.thread?.channel, "web");
  assert.equal(res.body?.thread?.handoffActive, true);
  assert.equal(res.body?.delivery?.mode, "operator_only");
  assert.equal(res.body?.messages?.[0]?.text, inboundMessage.text);
  assert.equal(transactionCalls.includes("commit"), true);
});

test("website widget transcript only exposes delivered outbound replies", async () => {
  const thread = {
    id: "44444444-4444-4444-8444-444444444444",
    tenant_id: tenantRow.id,
    tenant_key: "acme",
    channel: "web",
    external_thread_id: "website:session-2",
    external_user_id: "visitor-2",
    external_username: null,
    customer_name: "Website visitor",
    status: "open",
    last_message_at: "2026-04-08T09:30:00.000Z",
    last_inbound_at: "2026-04-08T09:30:00.000Z",
    last_outbound_at: "2026-04-08T09:31:00.000Z",
    unread_count: 0,
    assigned_to: null,
    labels: [],
    meta: {},
    handoff_active: false,
    handoff_reason: "",
    handoff_priority: "normal",
    handoff_at: null,
    handoff_by: null,
    created_at: "2026-04-08T09:30:00.000Z",
    updated_at: "2026-04-08T09:31:00.000Z",
  };

  const session = issueWebsiteWidgetSession({
    tenantId: tenantRow.id,
    tenantKey: "acme",
    threadId: thread.id,
    sessionId: "session-2",
    visitorId: "visitor-2",
  });

  const db = {
    async query(text) {
      const sql = String(text?.text || text || "").toLowerCase();
      if (sql.includes("from tenants t")) return { rows: [tenantRow] };
      if (sql.includes("from inbox_threads")) return { rows: [thread] };
      if (sql.includes("from inbox_messages")) {
        return {
          rows: [
            {
              id: "msg-in-1",
              thread_id: thread.id,
              tenant_key: "acme",
              direction: "inbound",
              sender_type: "customer",
              external_message_id: "ext-in-1",
              message_type: "text",
              text: "Hi there",
              attachments: [],
              meta: {},
              sent_at: "2026-04-08T09:30:00.000Z",
              created_at: "2026-04-08T09:30:00.000Z",
            },
            {
              id: "msg-out-pending",
              thread_id: thread.id,
              tenant_key: "acme",
              direction: "outbound",
              sender_type: "operator",
              external_message_id: "ext-out-pending",
              message_type: "text",
              text: "Pending reply",
              attachments: [],
              meta: {
                delivery: {
                  status: "pending",
                },
              },
              sent_at: null,
              created_at: "2026-04-08T09:30:30.000Z",
            },
            {
              id: "msg-out-sent",
              thread_id: thread.id,
              tenant_key: "acme",
              direction: "outbound",
              sender_type: "operator",
              external_message_id: "ext-out-sent",
              message_type: "text",
              text: "Delivered reply",
              attachments: [],
              meta: {
                delivery: {
                  status: "sent",
                },
              },
              sent_at: "2026-04-08T09:31:00.000Z",
              created_at: "2026-04-08T09:31:00.000Z",
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  };

  const { getWebsiteWidgetTranscript } = createWebsiteWidgetHandlers({
    db,
    wsHub: null,
  });

  const req = {
    body: {
      tenantKey: "acme",
      sessionToken: session.token,
      page: {
        url: "https://acme.example/pricing",
      },
    },
    headers: {
      origin: "https://acme.example",
    },
  };
  const res = createMockRes();

  await getWebsiteWidgetTranscript(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.deepEqual(
    res.body?.messages?.map((item) => item.id),
    ["msg-in-1", "msg-out-sent"]
  );
});

test("persistOutboundMessage auto-delivers website replies without queueing worker execution", async () => {
  const createAttemptCalls = [];
  const enqueueCalls = [];

  const result = await persistOutboundMessage({
    client: {
      async query(text, params = []) {
        const sql = String(text || "").toLowerCase();
        if (sql.includes("insert into inbox_messages")) {
          assert.ok(params[3]);
          assert.ok(params[8]);
          return {
            rows: [
              {
                id: "55555555-5555-4555-8555-555555555555",
                thread_id: "66666666-6666-4666-8666-666666666666",
                tenant_key: "acme",
                direction: "outbound",
                sender_type: "operator",
                external_message_id: params[3],
                message_type: "text",
                text: "Operator reply",
                attachments: [],
                meta: JSON.parse(params[7]),
                sent_at: params[8],
                created_at: "2026-04-08T10:00:00.000Z",
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
    thread: {
      id: "66666666-6666-4666-8666-666666666666",
    },
    tenantId: tenantRow.id,
    tenantKey: "acme",
    channel: "web",
    recipientId: "visitor-3",
    senderType: "operator",
    requestedMessageType: "text",
    text: "Operator reply",
    attachments: [],
    meta: {
      source: "manual_reply",
    },
    createAttempt: async (input) => {
      createAttemptCalls.push(input);
      return {
        id: "attempt-1",
        ...input,
      };
    },
    enqueueOutboundExecution: async (input) => {
      enqueueCalls.push(input);
    },
  });

  assert.equal(result.provider, "website_widget");
  assert.equal(createAttemptCalls.length, 1);
  assert.equal(createAttemptCalls[0]?.status, "sent");
  assert.equal(enqueueCalls.length, 0);
  assert.ok(result.message?.sent_at);
});
