import test from "node:test";
import assert from "node:assert/strict";

import { leadsRoutes } from "../src/routes/api/leads/index.js";

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
      protocol: req.protocol || "https",
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

function buildAuth(role = "operator") {
  return {
    userId: "user-1",
    email: `${role}@acme.test`,
    tenantId: "tenant-1",
    tenantKey: "acme",
    role,
  };
}

test("lead lookup by inbox thread stays operator-scoped and tenant-safe", async () => {
  const db = {
    query: async (sql, values) => {
      assert.match(sql, /from leads/i);
      assert.equal(values[0], "acme");
      assert.equal(values[1], "11111111-1111-4111-8111-111111111111");

      return {
        rows: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            tenant_key: "acme",
            inbox_thread_id: "11111111-1111-4111-8111-111111111111",
            full_name: "Lead Person",
            status: "open",
            stage: "new",
            extra: {},
          },
        ],
      };
    },
  };

  const router = leadsRoutes({ db, wsHub: null });
  const result = await invokeRouter(
    router,
    "get",
    "/leads/by-thread/11111111-1111-4111-8111-111111111111",
    { auth: buildAuth("operator") }
  );

  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body?.ok, true);
  assert.equal(result.res.body?.lead?.id, "22222222-2222-4222-8222-222222222222");
  assert.equal(result.res.body?.lead?.inbox_thread_id, "11111111-1111-4111-8111-111111111111");
});
