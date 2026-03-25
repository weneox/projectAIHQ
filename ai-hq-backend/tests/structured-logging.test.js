import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRequestLogContext,
  createLogger,
  createStructuredLogEntry,
  requestContextMiddleware,
} from "../src/utils/logger.js";

test("request log context preserves caller request id and auth context", () => {
  const context = buildRequestLogContext({
    method: "POST",
    originalUrl: "/api/setup/import/source",
    headers: {
      "x-request-id": "req-123",
    },
    auth: {
      tenantId: "tenant-1",
      tenantKey: "acme",
      user: {
        id: "user-9",
      },
    },
  });

  assert.equal(context.requestId, "req-123");
  assert.equal(context.method, "POST");
  assert.equal(context.path, "/api/setup/import/source");
  assert.equal(context.tenantId, "tenant-1");
  assert.equal(context.tenantKey, "acme");
  assert.equal(context.userId, "user-9");
});

test("structured log entries carry stable request, run, and session identifiers", () => {
  const entry = createStructuredLogEntry({
    level: "error",
    event: "source_sync.execution.retry_scheduled",
    context: {
      requestId: "req-abc",
      runId: "run-1",
      reviewSessionId: "session-1",
      sourceId: "source-1",
      tenantId: "tenant-1",
    },
    data: {
      delayMs: 5000,
      nextRetryAt: "2026-03-25T10:00:00.000Z",
    },
    error: Object.assign(new Error("temporary failure"), {
      code: "TEMP_FAIL",
      stage: "extract",
    }),
  });

  assert.equal(entry.level, "error");
  assert.equal(entry.event, "source_sync.execution.retry_scheduled");
  assert.equal(entry.requestId, "req-abc");
  assert.equal(entry.runId, "run-1");
  assert.equal(entry.reviewSessionId, "session-1");
  assert.equal(entry.sourceId, "source-1");
  assert.equal(entry.tenantId, "tenant-1");
  assert.equal(entry.delayMs, 5000);
  assert.equal(entry.nextRetryAt, "2026-03-25T10:00:00.000Z");
  assert.equal(entry.error?.code, "TEMP_FAIL");
  assert.equal(entry.error?.stage, "extract");
  assert.equal(entry.error?.message, "temporary failure");
});

test("request context middleware emits request lifecycle logs with one correlation id", async () => {
  const entries = [];
  const logger = createLogger({ service: "test-backend" }, (entry) => {
    entries.push(entry);
  });
  const middleware = requestContextMiddleware({ logger });

  let finishHandler = null;
  const req = {
    method: "GET",
    originalUrl: "/health",
    headers: {
      "x-request-id": "req-health-1",
    },
    auth: {
      tenantId: "tenant-2",
      tenantKey: "globex",
      user: { id: "user-2" },
    },
  };
  const res = {
    statusCode: 204,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    on(event, handler) {
      if (event === "finish") finishHandler = handler;
    },
  };

  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.requestId, "req-health-1");
  assert.equal(res.headers["x-request-id"], "req-health-1");
  assert.equal(typeof req.log?.info, "function");

  finishHandler?.();

  assert.equal(entries.length, 2);
  assert.equal(entries[0].event, "http.request.started");
  assert.equal(entries[1].event, "http.request.completed");
  assert.equal(entries[0].requestId, "req-health-1");
  assert.equal(entries[1].requestId, "req-health-1");
  assert.equal(entries[0].tenantId, "tenant-2");
  assert.equal(entries[1].tenantKey, "globex");
  assert.equal(entries[1].statusCode, 204);
});
