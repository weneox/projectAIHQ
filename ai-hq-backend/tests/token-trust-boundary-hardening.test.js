import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { getConfigIssues } from "../src/config/validate.js";
import { executionsRoutes } from "../src/routes/api/executions/index.js";
import { pushRoutes } from "../src/routes/api/push/index.js";
import { resetInMemoryRateLimitsForTest } from "../src/utils/rateLimit.js";

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

test("config validation requires n8n callback and webhook tokens when n8n is configured outside test", () => {
  const previousEnv = cfg.app.env;
  const previousWebhookUrl = cfg.n8n.webhookUrl;
  const previousCallbackToken = cfg.n8n.callbackToken;
  const previousWebhookToken = cfg.n8n.webhookToken;

  try {
    cfg.app.env = "development";
    cfg.n8n.webhookUrl = "https://n8n.example.test/hook";
    cfg.n8n.callbackToken = "";
    cfg.n8n.webhookToken = "";

    const issues = getConfigIssues();
    const webhookIssue = issues.find((item) => item.key === "n8n.webhookToken");
    const callbackIssue = issues.find((item) => item.key === "n8n.callbackToken");

    assert.equal(webhookIssue?.level, "error");
    assert.equal(callbackIssue?.level, "error");
  } finally {
    cfg.app.env = previousEnv;
    cfg.n8n.webhookUrl = previousWebhookUrl;
    cfg.n8n.callbackToken = previousCallbackToken;
    cfg.n8n.webhookToken = previousWebhookToken;
  }
});

test("config validation requires debug token when debug routes are explicitly enabled outside test", () => {
  const previousEnv = cfg.app.env;
  const previousDebugRoutesEnabled = cfg.security.debugRoutesEnabled;
  const previousDebugToken = cfg.security.debugApiToken;

  try {
    cfg.app.env = "development";
    cfg.security.debugRoutesEnabled = true;
    cfg.security.debugApiToken = "";

    const issue = getConfigIssues().find((item) => item.key === "security.debugApiToken");
    assert.equal(issue?.level, "error");
  } finally {
    cfg.app.env = previousEnv;
    cfg.security.debugRoutesEnabled = previousDebugRoutesEnabled;
    cfg.security.debugApiToken = previousDebugToken;
  }
});

test("execution callback fails closed when callback token config is missing outside test", async () => {
  const previousEnv = cfg.app.env;
  const previousCallbackToken = cfg.n8n.callbackToken;
  const previousWebhookToken = cfg.n8n.webhookToken;
  const previousMax = cfg.rateLimit.executionCallbackMaxRequests;

  try {
    resetInMemoryRateLimitsForTest();
    cfg.app.env = "development";
    cfg.n8n.callbackToken = "";
    cfg.n8n.webhookToken = "";
    cfg.rateLimit.executionCallbackMaxRequests = 1000;

    const router = executionsRoutes({ db: null, wsHub: null });
    const { res } = await invokeRoute(router, "post", "/executions/callback", {
      body: {
        jobId: "11111111-1111-4111-8111-111111111111",
        status: "completed",
      },
    });

    assert.equal(res.statusCode, 500);
    assert.equal(res.body?.error, "CallbackAuthMisconfigured");
    assert.equal(res.body?.reason, "callback auth token is not configured");
  } finally {
    resetInMemoryRateLimitsForTest();
    cfg.app.env = previousEnv;
    cfg.n8n.callbackToken = previousCallbackToken;
    cfg.n8n.webhookToken = previousWebhookToken;
    cfg.rateLimit.executionCallbackMaxRequests = previousMax;
  }
});

test("execution callback denies invalid token and preserves valid configured flow", async () => {
  const previousEnv = cfg.app.env;
  const previousCallbackToken = cfg.n8n.callbackToken;
  const previousWebhookToken = cfg.n8n.webhookToken;
  const previousMax = cfg.rateLimit.executionCallbackMaxRequests;

  try {
    resetInMemoryRateLimitsForTest();
    cfg.app.env = "development";
    cfg.n8n.callbackToken = "callback-secret";
    cfg.n8n.webhookToken = "";
    cfg.rateLimit.executionCallbackMaxRequests = 1000;

    const router = executionsRoutes({ db: null, wsHub: null });

    const denied = await invokeRoute(router, "post", "/executions/callback", {
      headers: {
        "x-webhook-token": "wrong-secret",
        "x-forwarded-for": "203.0.113.10",
      },
      body: {
        jobId: "11111111-1111-4111-8111-111111111111",
        status: "completed",
      },
    });

    assert.equal(denied.res.statusCode, 401);
    assert.equal(denied.res.body?.error, "Unauthorized");
    assert.equal(denied.res.body?.reason, "invalid callback token");

    const allowed = await invokeRoute(router, "post", "/executions/callback", {
      headers: {
        "x-webhook-token": "callback-secret",
        "x-forwarded-for": "203.0.113.10",
      },
      body: {
        jobId: "11111111-1111-4111-8111-111111111111",
        status: "completed",
      },
    });

    assert.equal(allowed.res.statusCode, 503);
    assert.notEqual(allowed.res.body?.error, "Unauthorized");
  } finally {
    resetInMemoryRateLimitsForTest();
    cfg.app.env = previousEnv;
    cfg.n8n.callbackToken = previousCallbackToken;
    cfg.n8n.webhookToken = previousWebhookToken;
    cfg.rateLimit.executionCallbackMaxRequests = previousMax;
  }
});

test("debug-token protected push test fails closed when misconfigured and denies invalid token", async () => {
  const previousEnv = cfg.app.env;
  const previousDebugToken = cfg.security.debugApiToken;

  try {
    cfg.app.env = "development";
    cfg.security.debugApiToken = "";

    const router = pushRoutes({ db: null, wsHub: null });

    const misconfigured = await invokeRoute(router, "post", "/push/test", {
      body: {},
    });

    assert.equal(misconfigured.res.statusCode, 500);
    assert.equal(misconfigured.res.body?.error, "DebugAuthMisconfigured");
    assert.equal(misconfigured.res.body?.reason, "debug auth token is not configured");

    cfg.security.debugApiToken = "debug-secret";

    const denied = await invokeRoute(router, "post", "/push/test", {
      headers: {
        "x-debug-token": "wrong-secret",
      },
      body: {},
    });

    assert.equal(denied.res.statusCode, 401);
    assert.equal(denied.res.body?.error, "Unauthorized");
    assert.equal(denied.res.body?.reason, "invalid debug token");

    const allowed = await invokeRoute(router, "post", "/push/test", {
      headers: {
        "x-debug-token": "debug-secret",
      },
      body: {},
    });

    assert.equal(allowed.res.statusCode, 200);
    assert.notEqual(allowed.res.body?.error, "Unauthorized");
  } finally {
    cfg.app.env = previousEnv;
    cfg.security.debugApiToken = previousDebugToken;
  }
});
