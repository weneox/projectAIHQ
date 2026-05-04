import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCorrelationHeaders,
  buildRequestContext,
  createStructuredLogger,
  requestContextMiddleware,
} from "../logger.js";

test("buildRequestContext preserves incoming request and correlation ids", () => {
  const context = buildRequestContext({
    method: "POST",
    originalUrl: "/internal/outbound/send",
    headers: {
      "x-request-id": "req-123",
      "x-correlation-id": "corr-123",
      "x-forwarded-for": "203.0.113.5, 10.0.0.1",
    },
  });

  assert.equal(context.requestId, "req-123");
  assert.equal(context.correlationId, "corr-123");
  assert.equal(context.method, "POST");
  assert.equal(context.path, "/internal/outbound/send");
  assert.equal(context.remoteIp, "203.0.113.5");
});

test("buildCorrelationHeaders emits both request and correlation ids", () => {
  const headers = buildCorrelationHeaders({
    requestId: "req-1",
    correlationId: "corr-1",
    headers: {
      Accept: "application/json",
    },
  });

  assert.equal(headers.Accept, "application/json");
  assert.equal(headers["x-request-id"], "req-1");
  assert.equal(headers["x-correlation-id"], "corr-1");
});

test("requestContextMiddleware emits lifecycle logs and response headers", () => {
  const entries = [];
  const logger = createStructuredLogger({ service: "test-service" }, (entry) => {
    entries.push(entry);
  });
  const middleware = requestContextMiddleware({ logger });

  let finishHandler = null;
  const req = {
    method: "GET",
    originalUrl: "/health",
    headers: {
      "x-request-id": "req-health-1",
      "x-correlation-id": "corr-health-1",
    },
  };
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    on(event, handler) {
      if (event === "finish") finishHandler = handler;
    },
  };

  middleware(req, res, () => {});
  finishHandler?.();

  assert.equal(req.requestId, "req-health-1");
  assert.equal(req.correlationId, "corr-health-1");
  assert.equal(res.headers["x-request-id"], "req-health-1");
  assert.equal(res.headers["x-correlation-id"], "corr-health-1");
  assert.equal(entries.length, 2);
  assert.equal(entries[0].event, "http.request.started");
  assert.equal(entries[1].event, "http.request.completed");
  assert.equal(entries[1].correlationId, "corr-health-1");
});

test("structured logger redacts secret-like fields before emission", () => {
  const entries = [];
  const logger = createStructuredLogger(
    {
      service: "meta-bot-backend",
      metaWebhookSecret: "should-not-leak",
    },
    (entry) => {
      entries.push(entry);
    }
  );

  logger.warn("meta.webhook.verify.rejected", {
    authorization: "Bearer should-not-leak",
    secret: "should-not-leak",
    secretSource: "META_WEBHOOK_APP_SECRET",
    secretFingerprint: "sha256:abcd",
    hasMetaAppSecret: true,
    message: "forward failed token=should-not-leak",
    nested: {
      accessToken: "should-not-leak",
      safeStatus: "blocked",
    },
  });
  logger.error(
    "meta.webhook.forward.failed",
    new Error("provider rejected Authorization: Bearer should-not-leak")
  );

  const serialized = JSON.stringify(entries);
  assert.equal(entries[0].metaWebhookSecret, "[REDACTED]");
  assert.equal(entries[0].authorization, "[REDACTED]");
  assert.equal(entries[0].secret, "[REDACTED]");
  assert.equal(entries[0].secretSource, "META_WEBHOOK_APP_SECRET");
  assert.equal(entries[0].secretFingerprint, "sha256:abcd");
  assert.equal(entries[0].hasMetaAppSecret, true);
  assert.equal(entries[0].message, "forward failed token=[REDACTED]");
  assert.equal(entries[0].nested.accessToken, "[REDACTED]");
  assert.equal(entries[0].nested.safeStatus, "blocked");
  assert.equal(
    entries[1].error.message,
    "provider rejected Authorization: Bearer [REDACTED]"
  );
  assert.doesNotMatch(serialized, /should-not-leak/);
});
