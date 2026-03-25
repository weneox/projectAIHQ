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
