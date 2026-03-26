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
