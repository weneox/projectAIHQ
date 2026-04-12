import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

import { runSchemaMigrations } from "../src/db/runSchemaMigrations.js";
import { dbUpsertTenantCore } from "../src/db/helpers/settings.js";
import { inboxHandlers } from "../src/routes/api/inbox/handlers.js";

const { Pool } = pg;

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function hasRealDb() {
  return Boolean(s(process.env.DATABASE_URL));
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    finished: false,
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
    send(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
  };
}

async function invokeRoute(router, method, path, req = {}) {
  const layer = router.stack.find(
    (item) => item.route?.path === path && item.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route not found for ${method.toUpperCase()} ${path}`);
  }

  const handlers = layer.route.stack.map((item) => item.handle);
  const res = createMockRes();
  const fullReq = {
    method: method.toUpperCase(),
    path,
    originalUrl: path,
    url: path,
    headers: {},
    query: {},
    body: {},
    params: {},
    auth: {},
    user: {},
    app: { locals: {} },
    ...req,
  };

  async function runAt(index) {
    if (index >= handlers.length || res.finished) return;

    const handler = handlers[index];

    if (handler.length >= 3) {
      await new Promise((resolve, reject) => {
        let settled = false;

        const next = (err) => {
          if (settled) return;
          settled = true;
          if (err) {
            reject(err);
            return;
          }
          resolve(runAt(index + 1));
        };

        Promise.resolve(handler(fullReq, res, next))
          .then(() => {
            if (!settled && res.finished) {
              settled = true;
              resolve();
            }
          })
          .catch(reject);
      });
      return;
    }

    await Promise.resolve(handler(fullReq, res));
    if (!res.finished) {
      await runAt(index + 1);
    }
  }

  await runAt(0);
  return { req: fullReq, res };
}

function createTransactionalRouteDb(client, prefix = "inbox_operator_lane") {
  let savepointIndex = 0;

  function emptyResult(command) {
    return {
      command,
      rowCount: 0,
      rows: [],
      fields: [],
    };
  }

  return {
    query(text, params) {
      return client.query(text, params);
    },
    async connect() {
      const savepoint = `${prefix}_${savepointIndex += 1}`;
      let transactionOpen = false;
      let finalized = false;

      return {
        async query(text, params) {
          const sql = s(typeof text === "string" ? text : text?.text);
          const normalized = sql.toUpperCase();

          if (normalized === "BEGIN" || normalized.startsWith("BEGIN ")) {
            if (!transactionOpen) {
              await client.query(`SAVEPOINT ${savepoint}`);
              transactionOpen = true;
            }
            return emptyResult("BEGIN");
          }

          if (normalized === "COMMIT" || normalized.startsWith("COMMIT ")) {
            if (transactionOpen && !finalized) {
              await client.query(`RELEASE SAVEPOINT ${savepoint}`);
              finalized = true;
            }
            return emptyResult("COMMIT");
          }

          if (normalized === "ROLLBACK" || normalized.startsWith("ROLLBACK ")) {
            if (transactionOpen && !finalized) {
              await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
              await client.query(`RELEASE SAVEPOINT ${savepoint}`);
              finalized = true;
            }
            return emptyResult("ROLLBACK");
          }

          return client.query(text, params);
        },
        release() {},
      };
    },
  };
}

let pool = null;
let migrationsReady = false;

test.before(async () => {
  if (!hasRealDb()) return;

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
    });
  }

  if (!migrationsReady) {
    await runSchemaMigrations(pool);
    migrationsReady = true;
  }
});

test.after(async () => {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
});

test(
  "db-backed inbox operator lane supports thread lifecycle, operator reply, handoff, and status changes",
  { skip: !hasRealDb() ? "DATABASE_URL not configured for integration test" : false },
  async () => {
    const client = await pool.connect();
    const tenantKey = `inbox-${randomUUID().slice(0, 8)}`;
    const operatorName = "Operator One";

    try {
      await client.query("begin");

      const tenant = await dbUpsertTenantCore(client, tenantKey, {
        company_name: "Inbox Ops Co",
        legal_name: "Inbox Ops Co LLC",
        industry_key: "software",
        country_code: "US",
        timezone: "America/New_York",
        default_language: "en",
        enabled_languages: ["en"],
      });

      assert.ok(tenant?.id, "tenant should be created");

      const routeDb = createTransactionalRouteDb(client);
      const router = inboxHandlers({
        db: routeDb,
        wsHub: null,
      });

      const authReq = {
        auth: {
          tenantKey,
          tenantId: tenant.id,
          role: "operator",
          email: "operator@inbox.test",
        },
      };

      const createThreadCall = await invokeRoute(
        router,
        "post",
        "/inbox/threads",
        {
          ...authReq,
          body: {
            channel: "website",
            externalThreadId: "web-thread-1",
            externalUserId: "visitor-1",
            externalUsername: "visitor_handle",
            customerName: "Taylor Visitor",
            status: "open",
            assignedTo: "",
            labels: ["new"],
            meta: {
              source: "website_widget",
            },
          },
        }
      );

      assert.equal(createThreadCall.res.statusCode, 200);
      assert.equal(createThreadCall.res.body?.ok, true);

      const threadId = s(createThreadCall.res.body?.thread?.id);
      assert.ok(threadId, "thread id should be returned");
      assert.equal(s(createThreadCall.res.body?.thread?.customer_name), "Taylor Visitor");
      assert.equal(s(createThreadCall.res.body?.thread?.channel), "website");

      const inboundMessageCall = await invokeRoute(
        router,
        "post",
        "/inbox/threads/:id/messages",
        {
          ...authReq,
          params: { id: threadId },
          body: {
            direction: "inbound",
            senderType: "customer",
            messageType: "text",
            text: "Hello from the website.",
            meta: {
              source: "public_widget",
            },
          },
        }
      );

      assert.equal(inboundMessageCall.res.statusCode, 200);
      assert.equal(inboundMessageCall.res.body?.ok, true);
      assert.equal(
        s(inboundMessageCall.res.body?.message?.text),
        "Hello from the website."
      );
      assert.equal(
        s(inboundMessageCall.res.body?.message?.direction),
        "inbound"
      );
      assert.equal(
        Number(inboundMessageCall.res.body?.thread?.unread_count ?? 0),
        1
      );

      const outboundReplyCall = await invokeRoute(
        router,
        "post",
        "/inbox/threads/:id/messages",
        {
          ...authReq,
          params: { id: threadId },
          body: {
            direction: "outbound",
            senderType: "agent",
            operatorName,
            externalMessageId: "ext-operator-reply-1",
            messageType: "text",
            text: "Hi Taylor — how can we help?",
            meta: {
              provider: "website_widget",
            },
            releaseHandoff: true,
          },
        }
      );

      assert.equal(outboundReplyCall.res.statusCode, 200);
      assert.equal(outboundReplyCall.res.body?.ok, true);
      assert.equal(
        s(outboundReplyCall.res.body?.message?.text),
        "Hi Taylor — how can we help?"
      );
      assert.equal(
        s(outboundReplyCall.res.body?.message?.direction),
        "outbound"
      );

      const listThreadsCall = await invokeRoute(
        router,
        "get",
        "/inbox/threads",
        {
          ...authReq,
          query: {
            limit: "20",
          },
        }
      );

      assert.equal(listThreadsCall.res.statusCode, 200);
      assert.equal(listThreadsCall.res.body?.ok, true);
      assert.equal(Array.isArray(listThreadsCall.res.body?.threads), true);
      assert.equal(listThreadsCall.res.body?.threads.length >= 1, true);

      const listedThread = listThreadsCall.res.body.threads.find(
        (item) => s(item?.id) === threadId
      );

      assert.ok(listedThread, "thread should be listed");
      assert.equal(s(listedThread?.customer_name), "Taylor Visitor");
      assert.equal(
        s(listedThread?.last_message_text),
        "Hi Taylor — how can we help?"
      );

      const threadDetailCall = await invokeRoute(
        router,
        "get",
        "/inbox/threads/:id",
        {
          ...authReq,
          params: { id: threadId },
        }
      );

      assert.equal(threadDetailCall.res.statusCode, 200);
      assert.equal(threadDetailCall.res.body?.ok, true);
      assert.equal(s(threadDetailCall.res.body?.thread?.id), threadId);

      const messagesCall = await invokeRoute(
        router,
        "get",
        "/inbox/threads/:id/messages",
        {
          ...authReq,
          params: { id: threadId },
          query: {
            limit: "20",
          },
        }
      );

      assert.equal(messagesCall.res.statusCode, 200);
      assert.equal(messagesCall.res.body?.ok, true);
      assert.equal(Array.isArray(messagesCall.res.body?.messages), true);
      assert.equal(messagesCall.res.body?.messages.length, 2);
      assert.equal(
        s(messagesCall.res.body?.messages?.[0]?.text),
        "Hello from the website."
      );
      assert.equal(
        s(messagesCall.res.body?.messages?.[1]?.text),
        "Hi Taylor — how can we help?"
      );
      assert.equal(
        s(messagesCall.res.body?.messages?.[1]?.direction),
        "outbound"
      );

      const outboundAttemptsCall = await invokeRoute(
        router,
        "get",
        "/inbox/threads/:id/outbound-attempts",
        {
          ...authReq,
          params: { id: threadId },
          query: {
            limit: "20",
          },
        }
      );

      assert.equal(outboundAttemptsCall.res.statusCode, 200);
      assert.equal(outboundAttemptsCall.res.body?.ok, true);
      assert.equal(Array.isArray(outboundAttemptsCall.res.body?.attempts), true);
      assert.equal(outboundAttemptsCall.res.body?.attempts.length >= 1, true);

      const attempt = outboundAttemptsCall.res.body.attempts[0];
      assert.equal(s(attempt?.provider), "website_widget");
      assert.equal(s(attempt?.status), "sent");

      const outboundSummaryCall = await invokeRoute(
        router,
        "get",
        "/inbox/outbound/summary",
        {
          ...authReq,
        }
      );

      assert.equal(outboundSummaryCall.res.statusCode, 200);
      assert.equal(outboundSummaryCall.res.body?.ok, true);
      assert.equal(Number(outboundSummaryCall.res.body?.summary?.sent ?? 0) >= 1, true);

      const markReadCall = await invokeRoute(
        router,
        "post",
        "/inbox/threads/:id/read",
        {
          ...authReq,
          params: { id: threadId },
        }
      );

      assert.equal(markReadCall.res.statusCode, 200);
      assert.equal(markReadCall.res.body?.ok, true);
      assert.equal(Number(markReadCall.res.body?.thread?.unread_count ?? 0), 0);

      const assignCall = await invokeRoute(
        router,
        "post",
        "/inbox/threads/:id/assign",
        {
          ...authReq,
          params: { id: threadId },
          body: {
            assignedTo: "operator_queue",
            actor: operatorName,
          },
        }
      );

      assert.equal(assignCall.res.statusCode, 200);
      assert.equal(assignCall.res.body?.ok, true);
      assert.equal(s(assignCall.res.body?.thread?.assigned_to), "operator_queue");

      const activateHandoffCall = await invokeRoute(
        router,
        "post",
        "/inbox/threads/:id/handoff/activate",
        {
          ...authReq,
          params: { id: threadId },
          body: {
            actor: operatorName,
            assignedTo: "human_handoff",
            reason: "manual_review",
            priority: "high",
          },
        }
      );

      assert.equal(activateHandoffCall.res.statusCode, 200);
      assert.equal(activateHandoffCall.res.body?.ok, true);
      assert.equal(activateHandoffCall.res.body?.thread?.handoff_active, true);
      assert.equal(
        s(activateHandoffCall.res.body?.thread?.handoff_reason),
        "manual_review"
      );

      const releaseHandoffCall = await invokeRoute(
        router,
        "post",
        "/inbox/threads/:id/handoff/release",
        {
          ...authReq,
          params: { id: threadId },
          body: {
            actor: operatorName,
          },
        }
      );

      assert.equal(releaseHandoffCall.res.statusCode, 200);
      assert.equal(releaseHandoffCall.res.body?.ok, true);
      assert.equal(releaseHandoffCall.res.body?.thread?.handoff_active, false);

      const resolveStatusCall = await invokeRoute(
        router,
        "post",
        "/inbox/threads/:id/status",
        {
          ...authReq,
          params: { id: threadId },
          body: {
            actor: operatorName,
            status: "resolved",
          },
        }
      );

      assert.equal(resolveStatusCall.res.statusCode, 200);
      assert.equal(resolveStatusCall.res.body?.ok, true);
      assert.equal(s(resolveStatusCall.res.body?.thread?.status), "resolved");

      const finalDetailCall = await invokeRoute(
        router,
        "get",
        "/inbox/threads/:id",
        {
          ...authReq,
          params: { id: threadId },
        }
      );

      assert.equal(finalDetailCall.res.statusCode, 200);
      assert.equal(finalDetailCall.res.body?.ok, true);
      assert.equal(s(finalDetailCall.res.body?.thread?.status), "resolved");
      assert.equal(Number(finalDetailCall.res.body?.thread?.unread_count ?? 0), 0);
      assert.equal(s(finalDetailCall.res.body?.thread?.assigned_to), "operator_queue");
      assert.equal(finalDetailCall.res.body?.thread?.handoff_active, false);
    } finally {
      await client.query("rollback").catch(() => {});
      client.release();
    }
  }
);
