import test from "node:test";
import assert from "node:assert/strict";

import {
  createOutboundAttempt,
  getInboxThreadState,
  getTenantInboxBrainContext,
  upsertInboxThreadState,
} from "../src/routes/api/inbox/repository.js";

test("inbox brain context requests strict runtime authority and stays fail-closed without tenant payload", async () => {
  let captured = null;

  const result = await getTenantInboxBrainContext(
    {},
    "acme",
    "11111111-1111-4111-8111-111111111111",
    {
      runtimeLoader: async (input) => {
        captured = input;
        return {
          tenant: null,
          serviceCatalog: [{ id: "service-1" }],
          knowledgeEntries: [{ id: "knowledge-1" }],
          responsePlaybooks: [{ id: "playbook-1" }],
        };
      },
      threadStateLoader: async () => ({ thread_id: "ignored" }),
    }
  );

  assert.equal(captured?.authorityMode, "strict");
  assert.equal(captured?.tenantKey, "acme");
  assert.deepEqual(result, {
    tenant: null,
    services: [],
    knowledgeEntries: [],
    responsePlaybooks: [],
    threadState: null,
  });
});

test("inbox brain context keeps authoritative runtime catalogs and thread state separated cleanly", async () => {
  const result = await getTenantInboxBrainContext(
    {},
    "acme",
    "11111111-1111-4111-8111-111111111111",
    {
      runtimeLoader: async () => ({
        tenant: { id: "tenant-1", tenant_key: "acme" },
        serviceCatalog: [{ id: "service-1", title: "Sales" }],
        knowledgeEntries: [{ id: "knowledge-1", title: "FAQ" }],
        responsePlaybooks: [{ id: "playbook-1", intent_key: "general" }],
      }),
      threadStateLoader: async (_db, threadId) => ({
        thread_id: threadId,
        handoffActive: false,
      }),
    }
  );

  assert.equal(result.tenant?.id, "tenant-1");
  assert.equal(result.services.length, 1);
  assert.equal(result.knowledgeEntries.length, 1);
  assert.equal(result.responsePlaybooks.length, 1);
  assert.equal(result.threadState?.thread_id, "11111111-1111-4111-8111-111111111111");
});

test("thread state persistence module still normalizes write and read paths", async () => {
  const threadStateRow = {
    thread_id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "22222222-2222-4222-8222-222222222222",
    tenant_key: "acme",
    last_customer_intent: "pricing",
    last_customer_service_key: "sales",
    last_ai_intent: "pricing",
    last_ai_service_key: "sales",
    last_ai_reply_hash: "hash-1",
    last_ai_reply_text: "Here is pricing.",
    last_ai_cta_type: "reply",
    last_response_mode: "auto_reply",
    handoff_message_id: null,
    suppressed_until_operator_reply: false,
    repeat_intent_count: 2,
    repeat_service_count: 1,
    awaiting_customer_answer_to: "reply",
    last_decision_meta: { handoffPriority: "normal" },
    created_at: "2026-03-27T00:00:00.000Z",
    updated_at: "2026-03-27T00:00:00.000Z",
  };

  const db = {
    async query(text) {
      if (String(text).includes("insert into inbox_thread_state")) {
        return { rows: [threadStateRow] };
      }
      if (String(text).includes("from inbox_thread_state")) {
        return { rows: [threadStateRow] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  };

  const written = await upsertInboxThreadState(db, {
    threadId: threadStateRow.thread_id,
    tenantId: threadStateRow.tenant_id,
    tenantKey: threadStateRow.tenant_key,
    lastCustomerIntent: "pricing",
    lastAiReplyText: "Here is pricing.",
    lastDecisionMeta: { handoffPriority: "normal" },
  });
  const read = await getInboxThreadState(db, threadStateRow.thread_id);

  assert.equal(written?.thread_id, threadStateRow.thread_id);
  assert.equal(written?.last_customer_intent, "pricing");
  assert.equal(read?.thread_id, threadStateRow.thread_id);
  assert.equal(read?.last_ai_reply_text, "Here is pricing.");
});

test("outbound attempt persistence module still keeps payload and tenant routing semantics", async () => {
  const db = {
    async query(text, params = []) {
      if (!String(text).includes("insert into inbox_outbound_attempts")) {
        throw new Error(`Unexpected query: ${text}`);
      }

      return {
        rows: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            message_id: params[0],
            thread_id: params[1],
            tenant_key: params[2],
            channel: params[3],
            provider: params[4],
            recipient_id: params[5],
            payload: params[6] ? JSON.parse(params[6]) : {},
            provider_response: {},
            status: params[7],
            attempt_count: 0,
            max_attempts: params[8],
            queued_at: "2026-03-27T00:00:00.000Z",
            created_at: "2026-03-27T00:00:00.000Z",
            updated_at: "2026-03-27T00:00:00.000Z",
          },
        ],
      };
    },
  };

  const attempt = await createOutboundAttempt({
    db,
    messageId: "44444444-4444-4444-8444-444444444444",
    threadId: "55555555-5555-4555-8555-555555555555",
    tenantKey: "Acme",
    channel: "instagram",
    payload: { text: "hello", correlationId: "corr-1" },
    status: "queued",
  });

  assert.equal(attempt?.tenant_key, "acme");
  assert.equal(attempt?.payload?.text, "hello");
  assert.equal(attempt?.status, "queued");
});
