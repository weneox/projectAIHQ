import test from "node:test";
import assert from "node:assert/strict";

import {
  getCommentHandler,
  listCommentsHandler,
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

function createCommentsReadDb({ listRows = [], byIdRows = {} } = {}) {
  return {
    async query(sql, params = []) {
      const text = String(sql || "").toLowerCase();

      if (text.includes("from comments") && text.includes("where tenant_key = $1::text")) {
        return { rows: listRows };
      }

      if (text.includes("from comments") && text.includes("where id = $1::uuid")) {
        return { rows: [byIdRows[params[0]]].filter(Boolean) };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

test("listCommentsHandler exposes durable reply delivery truth for operator reads", async () => {
  const db = createCommentsReadDb({
    listRows: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        tenant_id: "tenant-1",
        tenant_key: "acme",
        channel: "instagram",
        source: "meta",
        external_comment_id: "external-1",
        external_parent_comment_id: null,
        external_post_id: "post-1",
        external_user_id: "user-1",
        external_username: "customer",
        customer_name: "Customer",
        text: "Need help",
        classification: {
          reply: {
            delivery: {
              status: "pending",
              executionId: "execution-1",
            },
          },
        },
        raw: {
          reply: {
            delivery: {
              status: "pending",
              executionId: "execution-1",
              updatedAt: "2026-03-30T09:00:00.000Z",
            },
          },
        },
        created_at: "2026-03-30T08:59:00.000Z",
        updated_at: "2026-03-30T09:00:00.000Z",
      },
    ],
  });

  const handler = listCommentsHandler({ db });
  const req = {
    auth: { tenantKey: "acme" },
    query: {},
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.count, 1);
  assert.deepEqual(res.body?.comments?.[0]?.reply_delivery, {
    status: "pending",
    executionId: "execution-1",
    providerMessageId: "",
    sentAt: "",
    error: "",
    errorCode: "",
    updatedAt: "2026-03-30T09:00:00.000Z",
    provider: null,
    deadLetter: false,
  });
});

test("getCommentHandler exposes sent and failed delivery metadata from persisted durable reply state", async () => {
  const commentId = "22222222-2222-4222-8222-222222222222";
  const db = createCommentsReadDb({
    byIdRows: {
      [commentId]: {
        id: commentId,
        tenant_id: "tenant-1",
        tenant_key: "acme",
        channel: "instagram",
        source: "meta",
        external_comment_id: "external-2",
        external_parent_comment_id: null,
        external_post_id: "post-2",
        external_user_id: "user-2",
        external_username: "customer-2",
        customer_name: "Customer Two",
        text: "How much is it?",
        classification: {
          reply: {
            sent: false,
            error: "provider timeout",
            errorCode: "meta_gateway_timeout",
            delivery: {
              status: "dead",
              executionId: "execution-2",
              providerMessageId: "provider-comment-2",
              sentAt: "2026-03-30T09:05:00.000Z",
            },
          },
        },
        raw: {
          reply: {
            error: "provider timeout",
            errorCode: "meta_gateway_timeout",
            provider: {
              gateway: "meta",
              status: 504,
            },
            delivery: {
              status: "dead",
              executionId: "execution-2",
              providerMessageId: "provider-comment-2",
              sentAt: "2026-03-30T09:05:00.000Z",
              updatedAt: "2026-03-30T09:06:00.000Z",
              deadLetter: true,
            },
          },
        },
        created_at: "2026-03-30T09:00:00.000Z",
        updated_at: "2026-03-30T09:06:00.000Z",
      },
    },
  });

  const handler = getCommentHandler({ db });
  const req = {
    auth: { tenantKey: "acme" },
    params: { id: commentId },
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.found, true);
  assert.deepEqual(res.body?.comment?.reply_delivery, {
    status: "dead",
    executionId: "execution-2",
    providerMessageId: "provider-comment-2",
    sentAt: "2026-03-30T09:05:00.000Z",
    error: "provider timeout",
    errorCode: "meta_gateway_timeout",
    updatedAt: "2026-03-30T09:06:00.000Z",
    provider: {
      gateway: "meta",
      status: 504,
    },
    deadLetter: true,
  });
});
