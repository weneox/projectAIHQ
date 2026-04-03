import test from "node:test";
import assert from "node:assert/strict";

import { workspaceSettingsRoutes } from "../src/routes/api/settings/workspace.js";
import { operationalSettingsRoutes } from "../src/routes/api/settings/operational.js";
import { commentsRoutes } from "../src/routes/api/comments/index.js";
import { listCommentsHandler } from "../src/routes/api/comments/handlers/read.js";
import { voiceRoutes } from "../src/routes/api/voice/index.js";

function createMockRes() {
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

function missingRelation(message = 'relation "missing_table" does not exist') {
  const error = new Error(message);
  error.code = "42P01";
  return error;
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

function buildUser(role = "operator") {
  return {
    id: "user-1",
    email: `${role}@acme.test`,
    role,
    tenantId: "tenant-1",
    tenantKey: "acme",
  };
}

class WorkspaceReadFallbackDb {
  async query(input, values = []) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const params = Array.isArray(input?.values) ? input.values : values;

    if (text.includes("from tenants")) {
      return {
        rows: [
          {
            id: "tenant-1",
            tenant_key: String(params[0] || "acme"),
            company_name: "Acme",
            legal_name: "Acme LLC",
            industry_key: "clinic",
            country_code: "AZ",
            timezone: "Asia/Baku",
            default_language: "en",
            enabled_languages: ["en"],
            market_region: "",
            plan_key: "starter",
            status: "active",
            active: true,
          },
        ],
      };
    }

    throw missingRelation();
  }
}

test("workspace settings read returns defaults when optional settings tables are missing locally", async () => {
  const router = workspaceSettingsRoutes({ db: new WorkspaceReadFallbackDb() });
  const { res } = await invokeRoute(router, "get", "/settings/workspace", {
    auth: buildAuth("operator"),
    user: buildUser("operator"),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.tenant?.tenant_key, "acme");
  assert.deepEqual(res.body?.channels, []);
  assert.deepEqual(res.body?.agents, []);
  assert.deepEqual(res.body?.users, []);
});

test("operational settings read returns degraded payload instead of failing when optional tables are missing locally", async () => {
  const router = operationalSettingsRoutes({ db: new WorkspaceReadFallbackDb() });
  const { res } = await invokeRoute(router, "get", "/settings/operational", {
    auth: buildAuth("operator"),
    user: buildUser("operator"),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.tenant?.tenantKey, "acme");
  assert.deepEqual(res.body?.channels?.items, []);
  assert.equal(res.body?.voice?.operational?.ready, false);
});

test("comments list handler returns empty degraded payload when local comments schema is missing", async () => {
  const handler = listCommentsHandler({
    db: { query: async () => ({ rows: [] }) },
    list: async () => {
      throw missingRelation();
    },
  });
  const res = createMockRes();

  await handler(
    {
      query: {},
      auth: buildAuth("operator"),
      user: buildUser("operator"),
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.deepEqual(res.body?.comments, []);
  assert.equal(res.body?.degraded, true);
});

test("voice overview calls and live routes return empty degraded payloads when local voice schema is missing", async () => {
  const db = {
    query: async (input) => {
      const text = String(input?.text || input || "").trim().toLowerCase();
      if (text.includes("from tenants")) {
        return { rows: [{ id: "tenant-1", tenant_key: "acme" }] };
      }
      throw missingRelation();
    },
  };
  const router = voiceRoutes({ db, dbDisabled: false, audit: null });
  const reqBase = {
    auth: buildAuth("operator"),
    user: buildUser("operator"),
  };

  const overview = await invokeRoute(router, "get", "/voice/overview", reqBase);
  assert.equal(overview.res.statusCode, 200);
  assert.equal(overview.res.body?.ok, true);
  assert.equal(overview.res.body?.degraded, true);

  const calls = await invokeRoute(router, "get", "/voice/calls", reqBase);
  assert.equal(calls.res.statusCode, 200);
  assert.equal(calls.res.body?.ok, true);
  assert.deepEqual(calls.res.body?.calls, []);

  const live = await invokeRoute(router, "get", "/voice/live", reqBase);
  assert.equal(live.res.statusCode, 200);
  assert.equal(live.res.body?.ok, true);
  assert.deepEqual(live.res.body?.sessions, []);
});

test("operator read surfaces still reject ordinary members even with degraded local schema handling", async () => {
  const commentsRouter = commentsRoutes({ db: { query: async () => ({ rows: [] }) }, wsHub: null });
  const voiceRouter = voiceRoutes({ db: { query: async () => ({ rows: [] }) }, dbDisabled: false, audit: null });

  const commentList = await invokeRoute(commentsRouter, "get", "/comments", {
    auth: buildAuth("member"),
    user: buildUser("member"),
  });
  assert.equal(commentList.res.statusCode, 403);

  const voiceOverview = await invokeRoute(voiceRouter, "get", "/voice/overview", {
    auth: buildAuth("member"),
    user: buildUser("member"),
  });
  assert.equal(voiceOverview.res.statusCode, 403);
});
