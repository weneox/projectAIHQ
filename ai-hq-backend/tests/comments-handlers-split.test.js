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

function createDecisionEventDb() {
  const decisionEvents = [];
  return {
    decisionEvents,
    async query(input, values = []) {
      const text = String(input?.text || input || "").trim().toLowerCase();
      const params = Array.isArray(input?.values) ? input.values : values;

      if (text.includes("insert into tenant_decision_events")) {
        const row = {
          id: `decision-${decisionEvents.length + 1}`,
          tenant_id: params[0],
          tenant_key: params[1],
          event_type: params[2],
          actor: params[3],
          source: params[4],
          surface: params[5],
          channel_type: params[6],
          policy_outcome: params[7],
          reason_codes: JSON.parse(params[8]),
          health_state_json: JSON.parse(params[9]),
          approval_posture_json: JSON.parse(params[10]),
          execution_posture_json: JSON.parse(params[11]),
          control_state_json: JSON.parse(params[12]),
          truth_version_id: params[13],
          runtime_projection_id: params[14],
          affected_surfaces: JSON.parse(params[15]),
          recommended_next_action_json: JSON.parse(params[16]),
          decision_context_json: JSON.parse(params[17]),
          event_at: params[18],
          created_at: params[18],
        };
        decisionEvents.unshift(row);
        return { rows: [row] };
      }

      return { rows: [] };
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

test("comments ingest treats insert-time unique collisions as canonical duplicates without fake create side effects", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;
  const auditCalls = [];
  const emitted = [];
  let createLeadCalls = 0;

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
        },
      }),
      getExistingComment: async () => null,
      classify: async () => ({
        category: "support",
        shouldCreateLead: false,
      }),
      insert: async () => ({
        id: "comment-race-1",
        tenant_key: "acme",
        tenant_id: "tenant-1",
        channel: "instagram",
        external_comment_id: "external-race-1",
        classification: { category: "support" },
        raw: {},
        duplicate: true,
        deduped: true,
      }),
      createLead: async () => {
        createLeadCalls += 1;
        return { id: "lead-race-1" };
      },
      buildActions: ({ lead }) => [{ type: "noop", leadId: lead?.id || "" }],
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
        externalCommentId: "external-race-1",
        text: "Need help",
        channel: "instagram",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.duplicate, true);
    assert.equal(res.body?.deduped, true);
    assert.equal(res.body?.comment?.id, "comment-race-1");
    assert.equal(res.body?.lead?.id, "lead-race-1");
    assert.equal(createLeadCalls, 1);
    assert.equal(auditCalls.length, 0);
    assert.equal(emitted.length, 0);
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("replyCommentHandler keeps reply orchestration, audit, and gateway semantics intact", async () => {
  const auditCalls = [];
  const emitted = [];
  const db = createDecisionEventDb();
  const queuedExecutions = [];

  const handler = replyCommentHandler({
    db,
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
    enqueueReplyExecution: async (input) => {
      queuedExecutions.push(input);
      return {
        id: "execution-1",
        status: "pending",
        tenant_key: input.tenantKey,
        action_type: "meta.comment.reply",
      };
    },
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
    getRuntime: async () => ({
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
        runtimeProjectionId: "projection-1",
        projectionHash: "hash-1",
        health: { status: "ready" },
      },
      tenant: {
        id: "tenant-1",
        tenant_key: "acme",
      },
      raw: {
        projection: {
          metadata_json: {
            publishedTruthVersionId: "truth-v1",
            approvalPolicy: {
              strictestOutcome: "auto_approvable",
              risk: { level: "low" },
            },
          },
        },
      },
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
  assert.equal(res.body?.replyQueued, true);
  assert.equal(res.body?.replySent, false);
  assert.equal(res.body?.gateway, null);
  assert.equal(res.body?.durableExecution?.id, "execution-1");
  assert.equal(res.body?.executionPolicy?.outcome, "allowed_with_logging");
  assert.equal(queuedExecutions.length, 1);
  assert.equal(queuedExecutions[0].commentId, "11111111-1111-4111-8111-111111111111");
  assert.equal(queuedExecutions[0].replyText, "Thanks, we can help.");
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, "comment.reply_requested");
  assert.equal(
    auditCalls[0].meta?.executionPolicy?.outcome,
    "allowed_with_logging"
  );
  assert.equal(auditCalls[0].meta?.deliveryStatus, "pending");
  assert.equal(auditCalls[0].meta?.executionId, "execution-1");
  assert.equal(db.decisionEvents.length, 1);
  assert.equal(db.decisionEvents[0].event_type, "execution_policy_decision");
  assert.equal(db.decisionEvents[0].truth_version_id, "truth-v1");
  assert.equal(db.decisionEvents[0].runtime_projection_id, "projection-1");
  assert.equal(
    db.decisionEvents[0].decision_context_json?.runtimeAuthoritySource,
    "approved_runtime_projection"
  );
  assert.equal(
    db.decisionEvents[0].decision_context_json?.approvedRuntime,
    true
  );
  assert.equal(
    db.decisionEvents[0].decision_context_json?.projectionHash,
    "hash-1"
  );
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].type, "comment.updated");
});

test("replyCommentHandler blocks execution when policy requires repair", async () => {
  const db = createDecisionEventDb();
  const handler = replyCommentHandler({
    db,
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
    getRuntime: async () => ({
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
        runtimeProjectionId: "projection-1",
        projectionHash: "hash-1",
        health: {
          status: "stale",
          primaryReasonCode: "projection_stale",
        },
      },
      tenant: {
        id: "tenant-1",
        tenant_key: "acme",
      },
      raw: {
        projection: {
          metadata_json: {
            publishedTruthVersionId: "truth-v1",
            approvalPolicy: {
              strictestOutcome: "auto_approvable",
              risk: { level: "low" },
            },
          },
        },
      },
    }),
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

  assert.equal(res.body?.ok, false);
  assert.equal(res.body?.error, "execution_policy_blocked");
  assert.equal(res.body?.executionPolicy?.outcome, "blocked_until_repair");
  assert.equal(db.decisionEvents.length, 2);
  assert.equal(db.decisionEvents[0].event_type, "blocked_action_outcome");
  assert.equal(db.decisionEvents[0].truth_version_id, "truth-v1");
  assert.equal(
    db.decisionEvents[0].decision_context_json?.runtimeAuthoritySource,
    "approved_runtime_projection"
  );
  assert.equal(db.decisionEvents[1].event_type, "blocked_action_outcome");
});
