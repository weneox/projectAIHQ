import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { executionsRoutes } from "../src/routes/api/executions/index.js";
import { voiceInternalRoutes } from "../src/routes/api/voice/index.js";
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

test("execution callback rate limiting allows valid first request and blocks repeated hammering", async () => {
  const previousToken = cfg.n8n.callbackToken;
  const previousWindow = cfg.rateLimit.executionCallbackWindowMs;
  const previousMax = cfg.rateLimit.executionCallbackMaxRequests;

  try {
    resetInMemoryRateLimitsForTest();
    cfg.n8n.callbackToken = "callback-secret";
    cfg.rateLimit.executionCallbackWindowMs = 60_000;
    cfg.rateLimit.executionCallbackMaxRequests = 1;

    const router = executionsRoutes({ db: null, wsHub: null });

    const first = await invokeRoute(router, "post", "/executions/callback", {
      headers: {
        "x-webhook-token": "callback-secret",
        "x-forwarded-for": "203.0.113.10",
      },
      body: {
        jobId: "11111111-1111-4111-8111-111111111111",
        status: "completed",
      },
    });

    assert.equal(first.res.statusCode, 503);
    assert.notEqual(first.res.body?.error, "Too many requests");

    const second = await invokeRoute(router, "post", "/executions/callback", {
      headers: {
        "x-webhook-token": "callback-secret",
        "x-forwarded-for": "203.0.113.10",
      },
      body: {
        jobId: "11111111-1111-4111-8111-111111111111",
        status: "completed",
      },
    });

    assert.equal(second.res.statusCode, 429);
    assert.equal(second.res.body?.error, "Too many requests");
    assert.equal(second.res.body?.reason, "execution_callback_rate_limited");
  } finally {
    resetInMemoryRateLimitsForTest();
    cfg.n8n.callbackToken = previousToken;
    cfg.rateLimit.executionCallbackWindowMs = previousWindow;
    cfg.rateLimit.executionCallbackMaxRequests = previousMax;
  }
});

test("execution callback rate limiting keys by source ip so legitimate callers are not globally blocked", async () => {
  const previousToken = cfg.n8n.callbackToken;
  const previousWindow = cfg.rateLimit.executionCallbackWindowMs;
  const previousMax = cfg.rateLimit.executionCallbackMaxRequests;

  try {
    resetInMemoryRateLimitsForTest();
    cfg.n8n.callbackToken = "callback-secret";
    cfg.rateLimit.executionCallbackWindowMs = 60_000;
    cfg.rateLimit.executionCallbackMaxRequests = 1;

    const router = executionsRoutes({ db: null, wsHub: null });

    const firstIp = await invokeRoute(router, "post", "/executions/callback", {
      headers: {
        "x-webhook-token": "callback-secret",
        "x-forwarded-for": "203.0.113.10",
      },
      body: {
        jobId: "11111111-1111-4111-8111-111111111111",
        status: "completed",
      },
    });

    assert.equal(firstIp.res.statusCode, 503);

    const secondIp = await invokeRoute(router, "post", "/executions/callback", {
      headers: {
        "x-webhook-token": "callback-secret",
        "x-forwarded-for": "203.0.113.11",
      },
      body: {
        jobId: "11111111-1111-4111-8111-111111111111",
        status: "completed",
      },
    });

    assert.equal(secondIp.res.statusCode, 503);
    assert.notEqual(secondIp.res.statusCode, 429);
  } finally {
    resetInMemoryRateLimitsForTest();
    cfg.n8n.callbackToken = previousToken;
    cfg.rateLimit.executionCallbackWindowMs = previousWindow;
    cfg.rateLimit.executionCallbackMaxRequests = previousMax;
  }
});

test("internal voice routes are not forced through execution callback rate limiting", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    resetInMemoryRateLimitsForTest();
    cfg.security.aihqInternalToken = "internal-secret";

    const router = voiceInternalRoutes({ db: null });
    const { res } = await invokeRoute(router, "post", "/internal/voice/report", {
      headers: {
        "x-internal-token": "internal-secret",
        "x-internal-service": "twilio-voice-backend",
        "x-internal-audience": "aihq-backend.voice.internal",
        "x-forwarded-for": "203.0.113.10",
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, true);
  } finally {
    resetInMemoryRateLimitsForTest();
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});
