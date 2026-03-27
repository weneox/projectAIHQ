import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import {
  ingestCommentHandler,
  replyCommentHandler,
} from "../src/routes/api/comments/handlers.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
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

test("comments ingest dedupes existing comments while keeping strict runtime authority explicit", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;
  const calls = [];

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const handler = ingestCommentHandler({
      db: { query: async () => ({ rows: [] }) },
      wsHub: null,
      getRuntime: async (input) => {
        calls.push(input);
        return {
          tenant: {
            id: "tenant-1",
            tenant_key: "acme",
            company_name: "Acme",
            timezone: "Asia/Baku",
          },
          services: ["Support"],
        };
      },
      getExistingComment: async () => ({
        id: "comment-1",
        tenant_key: "acme",
        channel: "instagram",
        external_comment_id: "external-1",
        classification: { category: "support", shouldCreateLead: false },
      }),
      classify: async () => {
        throw new Error("classify should not run on duplicates");
      },
      createLead: async () => ({ id: "lead-1" }),
      buildActions: ({ classification, lead }) => [
        { type: "noop", category: classification.category, leadId: lead?.id || "" },
      ],
    });

    const req = {
      headers: {
        "x-internal-token": "internal-secret",
        "x-tenant-key": "acme",
      },
      body: {
        externalCommentId: "external-1",
        text: "Need help",
        channel: "instagram",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].authorityMode, "strict");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.duplicate, true);
    assert.equal(res.body?.comment?.id, "comment-1");
    assert.equal(res.body?.lead?.id, "lead-1");
    assert.equal(res.body?.tenant?.tenant_key, "acme");
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("comments ingest persists new comments and keeps audit/realtime hooks intact", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;
  const auditCalls = [];
  const emitted = [];

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const handler = ingestCommentHandler({
      db: { query: async () => ({ rows: [] }) },
      wsHub: { name: "hub" },
      getRuntime: async () => ({
        tenant: {
          id: "tenant-1",
          tenant_key: "acme",
          company_name: "Acme",
          timezone: "Asia/Baku",
          profile: { brand_name: "Acme" },
        },
        services: ["Pricing"],
        tone: "professional",
        language: "az",
      }),
      getExistingComment: async () => null,
      classify: async () => ({
        category: "sales",
        shouldCreateLead: true,
        reason: "pricing_interest",
      }),
      insert: async (_db, payload) => ({
        id: "comment-2",
        tenant_key: payload.tenantKey,
        tenant_id: "tenant-1",
        channel: payload.channel,
        external_comment_id: payload.externalCommentId,
        external_post_id: payload.externalPostId,
        classification: payload.classification,
        raw: payload.raw,
      }),
      createLead: async () => ({ id: "lead-2" }),
      buildActions: ({ lead }) => [{ type: "create_lead", leadId: lead?.id || "" }],
      auditWriter: async (_db, payload) => {
        auditCalls.push(payload);
      },
      emitEvent: (_hub, payload) => {
        emitted.push(payload);
      },
    });

    const req = {
      headers: {
        "x-internal-token": "internal-secret",
        "x-tenant-key": "acme",
      },
      body: {
        externalCommentId: "external-2",
        externalPostId: "post-1",
        externalUserId: "user-1",
        externalUsername: "customer",
        customerName: "Customer",
        text: "How much does it cost?",
        channel: "instagram",
        platform: "instagram",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.duplicate, false);
    assert.equal(res.body?.lead?.id, "lead-2");
    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0].action, "comment.ingested");
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].type, "comment.created");
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("replyCommentHandler keeps reply orchestration, audit, and gateway semantics intact", async () => {
  const auditCalls = [];
  const emitted = [];

  const handler = replyCommentHandler({
    db: { query: async () => ({ rows: [] }) },
    wsHub: { name: "hub" },
    getOwnedComment: async () => ({
      ok: true,
      comment: {
        id: "11111111-1111-4111-8111-111111111111",
        tenant_key: "acme",
        tenant_id: "tenant-1",
        channel: "instagram",
        external_comment_id: "external-3",
        external_post_id: "post-3",
        classification: { category: "support" },
        raw: {},
      },
    }),
    forwardReply: async () => ({
      ok: true,
      status: 200,
      json: { ok: true, provider: "meta" },
      error: null,
      skipped: false,
    }),
    updateState: async (_db, id, classification, raw) => ({
      id,
      tenant_key: "acme",
      tenant_id: "tenant-1",
      channel: "instagram",
      external_comment_id: "external-3",
      external_post_id: "post-3",
      classification,
      raw,
    }),
    auditWriter: async (_db, payload) => {
      auditCalls.push(payload);
    },
    emitEvent: (_hub, payload) => {
      emitted.push(payload);
    },
  });

  const req = {
    params: {
      id: "11111111-1111-4111-8111-111111111111",
    },
    auth: {
      tenantKey: "acme",
    },
    body: {
      replyText: "Thanks, we can help.",
      actor: "operator",
      approved: true,
      executeNow: true,
    },
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.replySent, true);
  assert.equal(res.body?.gateway?.status, 200);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, "comment.reply_sent");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].type, "comment.updated");
});