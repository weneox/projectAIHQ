import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMetaCommentReplyExecutionInput,
  processMetaCommentReplyExecution,
} from "../src/services/durableExecutionService.js";

function nowIso() {
  return new Date("2026-03-30T00:00:00.000Z").toISOString();
}

function createCommentDb(commentRow) {
  const state = {
    comment: {
      ...commentRow,
      classification: commentRow.classification || {},
      raw: commentRow.raw || {},
    },
    auditEntries: [],
  };

  return {
    state,
    async query(sql, params = []) {
      const text = String(sql || "").toLowerCase();

      if (text.includes("from comments") && text.includes("where id = $1::uuid")) {
        return { rows: [state.comment] };
      }

      if (text.includes("update comments")) {
        state.comment = {
          ...state.comment,
          classification: JSON.parse(params[1]),
          raw: JSON.parse(params[2]),
          updated_at: nowIso(),
        };
        return { rows: [state.comment] };
      }

      if (text.includes("insert into audit_log")) {
        const entry = {
          actor: params[0],
          action: params[1],
          object_type: params[2],
          object_id: params[3],
          meta: JSON.parse(params[4]),
        };
        state.auditEntries.push(entry);
        return {
          rows: [{ id: `audit-${state.auditEntries.length}`, ...entry, created_at: nowIso() }],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

test("buildMetaCommentReplyExecutionInput keeps durable idempotency and comment routing stable", () => {
  const input = buildMetaCommentReplyExecutionInput({
    tenantId: "tenant-1",
    tenantKey: "acme",
    channel: "instagram",
    commentId: "comment-1",
    externalCommentId: "external-1",
    externalPostId: "post-1",
    externalUserId: "user-1",
    replyText: "Hello there",
    actor: "operator",
  });

  assert.equal(input.actionType, "meta.comment.reply");
  assert.equal(input.targetType, "comment");
  assert.equal(input.targetId, "comment-1");
  assert.equal(input.payloadSummary.actions[0].type, "reply_comment");
  assert.equal(input.safeMetadata.commentId, "comment-1");
  assert.equal(typeof input.idempotencyKey, "string");
  assert.equal(input.idempotencyKey.length > 20, true);
});

test("processMetaCommentReplyExecution marks comment sent and emits truthful audit/realtime", async () => {
  const db = createCommentDb({
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "tenant-1",
    tenant_key: "acme",
    channel: "instagram",
    external_comment_id: "external-1",
    external_post_id: "post-1",
    external_user_id: "user-1",
    classification: { category: "support" },
    raw: {},
  });
  const events = [];
  const wsHub = {
    broadcast(event) {
      events.push(event);
      return true;
    },
  };

  const result = await processMetaCommentReplyExecution({
    db,
    wsHub,
    execution: {
      id: "execution-1",
      tenant_key: "acme",
      safe_metadata: {
        commentId: "11111111-1111-4111-8111-111111111111",
        replyText: "Hello there",
        actor: "operator",
        approved: true,
      },
      payload_summary: {
        tenantKey: "acme",
        actions: [{ type: "reply_comment", text: "Hello there" }],
      },
    },
    logger: {
      info() {},
      warn() {},
    },
    sendCommentActions: async () => ({
      ok: true,
      status: 200,
      json: {
        ok: true,
        result: {
          response: {
            id: "provider-comment-1",
          },
        },
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(db.state.comment.classification.reply.sent, true);
  assert.equal(db.state.comment.classification.reply.delivery.status, "sent");
  assert.equal(db.state.comment.raw.reply.delivery.executionId, "execution-1");
  assert.equal(db.state.comment.raw.reply.delivery.providerMessageId, "provider-comment-1");
  assert.equal(db.state.auditEntries[0]?.action, "comment.reply_delivery_sent");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "comment.updated");
});

test("processMetaCommentReplyExecution marks retryable failures without faking sent state", async () => {
  const db = createCommentDb({
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "tenant-1",
    tenant_key: "acme",
    channel: "instagram",
    external_comment_id: "external-1",
    external_post_id: "post-1",
    external_user_id: "user-1",
    classification: { category: "support" },
    raw: {},
  });

  const result = await processMetaCommentReplyExecution({
    db,
    wsHub: null,
    execution: {
      id: "execution-2",
      tenant_key: "acme",
      safe_metadata: {
        commentId: "11111111-1111-4111-8111-111111111111",
        replyText: "Hello there",
        actor: "operator",
        approved: true,
      },
      payload_summary: {
        tenantKey: "acme",
        actions: [{ type: "reply_comment", text: "Hello there" }],
      },
    },
    logger: {
      info() {},
      warn() {},
    },
    sendCommentActions: async () => ({
      ok: false,
      status: 503,
      error: "temporary upstream failure",
      json: { ok: false },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.retryable, true);
  assert.equal(db.state.comment.classification.reply.sent, false);
  assert.equal(db.state.comment.classification.reply.delivery.status, "failed");
  assert.equal(db.state.comment.raw.reply.error, "temporary upstream failure");
  assert.equal(db.state.auditEntries[0]?.action, "comment.reply_delivery_failed");
});
