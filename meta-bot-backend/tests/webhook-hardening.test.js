import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.META_APP_SECRET = "meta-secret";
process.env.AIHQ_INTERNAL_TOKEN = "internal-meta-token";

const { signMetaBody } = await import("../src/config.js");
const { registerWebhookRoutes } = await import("../src/routes/webhook.js");
const { internalOutboundRoutes } = await import("../src/routes/internal.outbound.js");
const {
  __test__: reliabilityTest,
  getRuntimeMetricsSnapshot,
} = await import("../src/services/runtimeReliability.js");

const originalFetch = global.fetch;

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
    send(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
    sendStatus(code) {
      this.statusCode = code;
      this.finished = true;
      onFinish?.();
      return this;
    },
  };
}

async function invokeHandler(appOrRouter, method, path, req = {}) {
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
      rawBody: req.rawBody,
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      ...req,
    };

    const res = createMockRes(finish);
    appOrRouter.handle(fullReq, res, (err) => {
      if (settled) return;
      if (err) {
        settled = true;
        reject(err);
        return;
      }
      settled = true;
      resolve({ req: fullReq, res });
    });
  });
}

test.after(() => {
  global.fetch = originalFetch;
});

test("valid Meta webhook signature is accepted", async () => {
  const app = express();
  registerWebhookRoutes(app);

  const body = { object: "page", entry: [] };
  const rawBody = Buffer.from(JSON.stringify(body), "utf8");
  const signature = signMetaBody(rawBody);

  const { res } = await invokeHandler(app, "post", "/webhook", {
    body,
    rawBody,
    headers: {
      "x-hub-signature-256": signature,
    },
  });

  assert.equal(res.statusCode, 200);
});

test("missing or invalid Meta webhook signatures are rejected", async () => {
  const app = express();
  registerWebhookRoutes(app);
  reliabilityTest.metrics.clear();

  const body = { object: "page", entry: [] };
  const rawBody = Buffer.from(JSON.stringify(body), "utf8");

  const missing = await invokeHandler(app, "post", "/webhook", {
    body,
    rawBody,
  });
  assert.equal(missing.res.statusCode, 403);
  assert.equal(missing.res.body?.error, "missing_meta_signature");

  const invalid = await invokeHandler(app, "post", "/webhook", {
    body,
    rawBody,
    headers: {
      "x-hub-signature-256": "sha256=bad",
    },
  });
  assert.equal(invalid.res.statusCode, 403);
  assert.equal(invalid.res.body?.error, "invalid_meta_signature");

  const metrics = getRuntimeMetricsSnapshot();
  assert.equal(metrics["meta_webhook_verification_failures_total:missing_meta_signature"], 1);
  assert.equal(metrics["meta_webhook_verification_failures_total:invalid_meta_signature"], 1);
});

test("malformed internal outbound payload is rejected", async () => {
  const router = internalOutboundRoutes();
  const { res } = await invokeHandler(router, "post", "/internal/outbound/send", {
    headers: {
      "x-internal-token": "internal-meta-token",
    },
    body: {
      tenantKey: "acme",
      text: "",
      attachments: [],
    },
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.error, "recipient_id_required");
});

test("meta webhook fails closed before automation when projected runtime authority is unavailable", async () => {
  const app = express();
  registerWebhookRoutes(app);

  const seenUrls = [];
  global.fetch = async (url) => {
    seenUrls.push(String(url));
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          ok: true,
          tenantKey: "acme",
          tenantId: "tenant-1",
          resolvedChannel: "instagram",
          tenant: {
            id: "tenant-1",
            tenant_key: "acme",
          },
          channelConfig: {
            channelType: "instagram",
          },
          projectedRuntime: {
            authority: {
              mode: "strict",
              required: true,
              available: false,
              source: "approved_runtime_projection",
              tenantId: "tenant-1",
              tenantKey: "acme",
              reasonCode: "runtime_projection_missing",
            },
            tenant: {
              tenantId: "tenant-1",
              tenantKey: "acme",
              companyName: "Acme",
            },
            channels: {
              meta: {
                channelType: "instagram",
                pageId: "page-1",
                igUserId: "ig-1",
              },
            },
          },
        });
      },
    };
  };

  const body = {
    object: "page",
    entry: [
      {
        messaging: [
          {
            sender: { id: "user-1" },
            recipient: { id: "page-1", instagram_id: "ig-1" },
            timestamp: Date.now(),
            message: { mid: "mid-1", text: "hello" },
          },
        ],
      },
    ],
  };
  const rawBody = Buffer.from(JSON.stringify(body), "utf8");
  const signature = signMetaBody(rawBody);

  const { res } = await invokeHandler(app, "post", "/webhook", {
    body,
    rawBody,
    headers: {
      "x-hub-signature-256": signature,
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(res.statusCode, 200);
  assert.equal(seenUrls.length, 1);
  assert.match(seenUrls[0], /\/api\/tenants\/resolve-channel\?/);
});

test("meta webhook executes automation normally when approved projected runtime exists", async () => {
  const app = express();
  registerWebhookRoutes(app);

  const seenUrls = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    seenUrls.push(target);

    if (target.includes("/api/tenants/resolve-channel")) {
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            ok: true,
            tenantKey: "acme",
            tenantId: "tenant-1",
            resolvedChannel: "instagram",
            tenant: {
              id: "tenant-1",
              tenant_key: "acme",
            },
            channelConfig: {
              channelType: "instagram",
            },
            projectedRuntime: {
              authority: {
                mode: "strict",
                required: true,
                available: true,
                source: "approved_runtime_projection",
                tenantId: "tenant-1",
                tenantKey: "acme",
                runtimeProjectionId: "projection-1",
              },
              tenant: {
                tenantId: "tenant-1",
                tenantKey: "acme",
                companyName: "Acme",
              },
              channels: {
                meta: {
                  channelType: "instagram",
                  pageId: "page-1",
                  igUserId: "ig-1",
                },
              },
            },
          });
        },
      };
    }

    if (target.endsWith("/api/inbox/ingest")) {
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            ok: true,
            tenant: {
              tenant_key: "acme",
            },
            thread: {
              id: "thread-1",
            },
            actions: [
              {
                type: "send_message",
                channel: "instagram",
                recipientId: "user-1",
                text: "Hello back",
                meta: {
                  tenantKey: "acme",
                  skipOutboundAck: true,
                },
              },
            ],
          });
        },
      };
    }

    if (target.includes("/api/internal/providers/meta-channel-access")) {
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            ok: true,
            projectedRuntime: {
              authority: {
                mode: "strict",
                required: true,
                available: true,
                source: "approved_runtime_projection",
                tenantId: "tenant-1",
                tenantKey: "acme",
                runtimeProjectionId: "projection-1",
              },
              tenant: {
                tenantId: "tenant-1",
                tenantKey: "acme",
                companyName: "Acme",
              },
            },
            operationalChannels: {
              meta: {
                available: true,
                ready: true,
                provider: "meta",
                channelType: "instagram",
                pageId: "page-1",
                igUserId: "ig-1",
              },
            },
            providerAccess: {
              provider: "meta",
              tenantKey: "acme",
              tenantId: "tenant-1",
              available: true,
              pageId: "page-1",
              igUserId: "ig-1",
              pageAccessToken: "token-1",
              appSecret: "app-secret",
              secretKeys: ["page_access_token", "app_secret"],
            },
          });
        },
      };
    }

    if (target.includes("graph.facebook.com")) {
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            message_id: "meta-message-1",
          });
        },
      };
    }

    throw new Error(`unexpected fetch target: ${target} ${(options.method || "GET")}`);
  };

  const body = {
    object: "page",
    entry: [
      {
        messaging: [
          {
            sender: { id: "user-1" },
            recipient: { id: "page-1", instagram_id: "ig-1" },
            timestamp: Date.now(),
            message: { mid: "mid-2", text: "hello" },
          },
        ],
      },
    ],
  };
  const rawBody = Buffer.from(JSON.stringify(body), "utf8");
  const signature = signMetaBody(rawBody);

  const { res } = await invokeHandler(app, "post", "/webhook", {
    body,
    rawBody,
    headers: {
      "x-hub-signature-256": signature,
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(res.statusCode, 200);
  assert.ok(seenUrls.some((url) => url.includes("/api/tenants/resolve-channel")));
  assert.ok(seenUrls.some((url) => url.endsWith("/api/inbox/ingest")));
  assert.ok(
    seenUrls.some((url) => url.includes("/api/internal/providers/meta-channel-access"))
  );
  assert.ok(seenUrls.some((url) => url.includes("graph.facebook.com")));
});
