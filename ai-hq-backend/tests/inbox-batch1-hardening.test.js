import test from "node:test";
import assert from "node:assert/strict";

import { inboxRoutes } from "../src/routes/api/inbox/index.js";
import { inboxHandlers } from "../src/routes/api/inbox/handlers.js";
import { parseIngestRequest } from "../src/routes/api/inbox/internal/request.js";
import { resolveInboxRuntime } from "../src/services/inboxBrain/runtime.js";

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    finished: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
  };
}

async function invokeRouter(router, method, path, req = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ req: fullReq, res });
    };

    const normalizedHeaders = Object.fromEntries(
      Object.entries(req.headers || {}).map(([key, value]) => [String(key).toLowerCase(), value])
    );

    const fullReq = {
      method: String(method || "GET").toUpperCase(),
      path,
      originalUrl: path,
      url: path,
      headers: normalizedHeaders,
      query: req.query || {},
      body: req.body || {},
      params: req.params || {},
      auth: req.auth || null,
      user: req.user || null,
      app: req.app || { locals: {} },
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      ...req,
    };

    const res = createMockRes(finish);

    try {
      router.handle(fullReq, res, (err) => {
        if (settled) return;
        if (err) {
          settled = true;
          reject(err);
          return;
        }
        settled = true;
        resolve({ req: fullReq, res });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function buildAuth(role = "member", tenantKey = "acme") {
  return {
    userId: "user-1",
    email: `${role}@${tenantKey}.test`,
    tenantId: "11111111-1111-4111-8111-111111111111",
    tenantKey,
    role,
  };
}

test("inbox browser routes require operator-role access", async () => {
  const router = inboxRoutes({ db: null, wsHub: null });

  const memberResult = await invokeRouter(router, "get", "/inbox/threads", {
    auth: buildAuth("member"),
    user: { id: "user-1", email: "member@acme.test", role: "member", tenantKey: "acme" },
  });
  assert.equal(memberResult.res.statusCode, 403);
  assert.equal(memberResult.res.body?.reason, "operator surface access required");

  const operatorResult = await invokeRouter(router, "get", "/inbox/threads", {
    auth: buildAuth("operator"),
    user: { id: "user-1", email: "operator@acme.test", role: "operator", tenantKey: "acme" },
  });
  assert.equal(operatorResult.res.statusCode, 200);
  assert.equal(operatorResult.res.body?.ok, true);
});

test("inbox thread status mutation fails closed when the uuid is outside the authenticated tenant", async () => {
  const threadId = "22222222-2222-4222-8222-222222222222";
  let sawScopedUpdate = false;

  const db = {
    async query(text, params = []) {
      const sql = String(text || "").toLowerCase();

      if (sql.includes("update inbox_threads")) {
        sawScopedUpdate = true;
        assert.match(sql, /where id = \$1::uuid\s+and tenant_key = \$3::text/);
        assert.equal(params[0], threadId);
        assert.equal(params[2], "acme");
        return { rows: [] };
      }

      throw new Error(`Unexpected db query: ${text}`);
    },
  };

  const result = await invokeRouter(inboxHandlers({ db, wsHub: null }), "post", `/inbox/threads/${threadId}/status`, {
    params: { id: threadId },
    auth: buildAuth("operator", "acme"),
    user: { id: "user-1", email: "operator@acme.test", role: "operator", tenantKey: "acme" },
    headers: { "x-tenant-key": "other-tenant" },
    body: { status: "closed" },
  });

  assert.equal(sawScopedUpdate, true);
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body?.ok, false);
  assert.equal(result.res.body?.error, "thread not found");
});

test("inbox ingest identity does not fall back from userId to externalThreadId", () => {
  const parsed = parseIngestRequest({
    headers: {
      "x-tenant-key": "acme",
    },
    body: {
      userId: "user-ext-42",
      text: "hello",
      channel: "instagram",
    },
  });

  assert.equal(parsed.tenantKey, "acme");
  assert.equal(parsed.externalUserId, "user-ext-42");
  assert.equal(parsed.externalThreadId, null);
});

test("strict inbox runtime stays authoritative and does not hydrate missing fields from legacy fallback inputs", async () => {
  const runtime = await resolveInboxRuntime({
    tenantKey: "acme",
    tenant: {
      id: "legacy-tenant",
      tenant_key: "acme",
      company_name: "Legacy Company",
      default_language: "az",
      profile: {
        brand_name: "Legacy Brand",
        tone_of_voice: "legacy tone",
      },
    },
    services: [
      {
        service_key: "legacy-service",
        title: "Legacy Service",
      },
    ],
    knowledgeEntries: [
      {
        title: "Legacy FAQ",
        answer: "Legacy answer",
        enabled: true,
      },
    ],
    responsePlaybooks: [
      {
        name: "Legacy Playbook",
        ideal_reply: "Legacy reply",
        enabled: true,
      },
    ],
    runtime: {
      tenant: {
        id: "runtime-tenant",
        tenant_key: "acme",
        company_name: "Projected Company",
      },
      profile: {},
      behavior: {},
    },
  });

  assert.equal(runtime.tenant?.id, "runtime-tenant");
  assert.equal(runtime.displayName, "Projected Company");
  assert.deepEqual(runtime.serviceCatalog, []);
  assert.deepEqual(runtime.services, []);
  assert.deepEqual(runtime.knowledgeEntries, []);
  assert.deepEqual(runtime.responsePlaybooks, []);
  assert.equal(runtime.tone, "");
});
