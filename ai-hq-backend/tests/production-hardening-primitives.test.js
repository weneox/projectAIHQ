import test from "node:test";
import assert from "node:assert/strict";

import {
  assertTenantQueryAllowed,
  runWithTenantContext,
  runWithSystemDbContext,
  __test__ as tenantContextTests,
} from "../src/db/tenantContext.js";
import { createStructuredLogEntry } from "../src/utils/logger.js";
import {
  expireStaleOutboundReservations,
  listRetryableOutboundAttempts,
} from "../src/routes/api/inbox/repository/outboundAttempts.js";
import {
  reconcileExpiredExternalSideEffectReservations,
} from "../src/db/helpers/externalIdempotency.js";
import {
  reconcileStaleTenantUsageReservations,
} from "../src/db/helpers/tenantUsage.js";
import { apiResponseStandardMiddleware } from "../src/utils/apiResponse.js";
import {
  inboundWebhookIdempotencyKey,
  outboundDeliveryIdempotencyKey,
} from "../src/utils/idempotency.js";
import { buildQueueIdempotencyKey } from "../src/services/queue.js";
import { __test__ as apiRouteTests } from "../src/routes/api/index.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("tenant DB guard blocks tenant-table queries without context", () => {
  assert.throws(
    () =>
      assertTenantQueryAllowed(
        "select * from inbox_messages where id = $1::uuid",
        ["11111111-1111-4111-8111-111111111111"]
      ),
    /tenant context/i
  );
});

test("tenant DB guard requires an explicit tenant predicate and binding", () => {
  runWithTenantContext({ tenantId: "tenant-1", tenantKey: "acme" }, () => {
    assert.throws(
      () =>
        assertTenantQueryAllowed(
          "select * from inbox_messages where id = $1::uuid",
          ["11111111-1111-4111-8111-111111111111"]
        ),
      /tenant predicate/i
    );

    assert.throws(
      () =>
        assertTenantQueryAllowed(
          "select * from inbox_messages where tenant_key = $1::text",
          ["other"]
        ),
      /tenant binding/i
    );

    assert.equal(
      assertTenantQueryAllowed(
        "select * from inbox_messages where tenant_key = $1::text",
        ["acme"]
      ),
      true
    );
  });
});

test("tenant DB guard allows explicit system DB contexts", () => {
  runWithSystemDbContext("test", () => {
    assert.equal(
      assertTenantQueryAllowed("select * from inbox_messages where id = $1::uuid", [
        "11111111-1111-4111-8111-111111111111",
      ]),
      true
    );
  });
});

test("critical multi-tenant tables are registered as tenant-scoped", () => {
  const scoped = new Set(tenantContextTests.TENANT_SCOPED_TABLES);
  for (const table of [
    "inbox_messages",
    "inbox_threads",
    "proposals",
    "jobs",
    "inbox_outbound_attempts",
  ]) {
    assert.equal(scoped.has(table), true, `${table} must be tenant guarded`);
    assert.equal(
      tenantContextTests.SYSTEM_LEVEL_TABLES.includes(table),
      false,
      `${table} must not bypass tenant guard as a system table`
    );
  }
});

test("API response middleware maps ok false payloads away from HTTP 200", () => {
  const req = { requestId: "req-1" };
  const res = createMockRes();
  apiResponseStandardMiddleware(req, res, () => {});

  res.json({
    ok: false,
    error: "tenant not found",
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.requestId, "req-1");
  assert.equal(res.body.code, "request_failed");
});

test("idempotency helpers are stable and scoped by namespace", () => {
  const inboundA = inboundWebhookIdempotencyKey({
    tenantKey: "acme",
    channel: "instagram",
    externalThreadId: "thread-1",
    externalMessageId: "msg-1",
  });
  const inboundB = inboundWebhookIdempotencyKey({
    externalMessageId: "msg-1",
    externalThreadId: "thread-1",
    channel: "instagram",
    tenantKey: "acme",
  });
  const outbound = outboundDeliveryIdempotencyKey({
    tenantKey: "acme",
    channel: "instagram",
    threadId: "thread-1",
    messageId: "msg-1",
  });

  assert.equal(inboundA, inboundB);
  assert.notEqual(inboundA, outbound);
});

test("queue idempotency key is stable across property order", () => {
  assert.equal(
    buildQueueIdempotencyKey({ tenantKey: "acme", actionType: "x", targetId: "1" }),
    buildQueueIdempotencyKey({ targetId: "1", actionType: "x", tenantKey: "acme" })
  );
});

test("authenticated API rejects client identity override attempts", () => {
  const req = {
    requestId: "req-identity",
    originalUrl: "/api/settings",
    headers: {
      "x-user-id": "attacker",
    },
    body: {},
    query: {},
    auth: {
      userId: "user-1",
      identityId: "identity-1",
      membershipId: "membership-1",
    },
    log: {
      warn() {},
    },
  };
  const res = createMockRes();
  let nextCalled = false;

  apiRouteTests.enforceServerControlledIdentityMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "client_identity_override_rejected");
});

test("structured logs expose production-required reliability fields", () => {
  const entry = createStructuredLogEntry({
    level: "info",
    event: "outbound.send.finalized",
    context: {
      tenantId: "11111111-1111-4111-8111-111111111111",
      requestId: "req-123",
    },
    data: {
      operationType: "outbound_execution",
      executionState: "sent",
    },
  });

  assert.equal(entry.tenant_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(entry.request_id, "req-123");
  assert.equal(entry.operation_type, "outbound_execution");
  assert.equal(entry.execution_state, "sent");
});

test("outbound retry query includes expired reserved/sending recovery path", async () => {
  const db = {
    async query(sql, params) {
      const text = String(sql);
      assert.match(text, /status in \('reserved','sending'\)/);
      assert.match(text, /reserved_until/);
      assert.equal(params[0], 25);
      return { rows: [] };
    },
  };

  await listRetryableOutboundAttempts(db, 25);
});

test("outbound reservation expiry requeues retryable attempts or dead-letters exhausted attempts", async () => {
  const db = {
    async query(sql, params) {
      const text = String(sql);
      assert.match(text, /for update skip locked/i);
      assert.match(text, /when coalesce\(a\.attempt_count, 0\) >= coalesce\(a\.max_attempts, 5\) then 'dead'/i);
      assert.match(text, /else 'retrying'/i);
      assert.equal(params[1], 12);
      return { rows: [] };
    },
  };

  await expireStaleOutboundReservations(db, { limit: 12 });
});

test("external idempotency reconciliation converts expired reservations to retrying", async () => {
  const db = {
    async query(sql, params) {
      const text = String(sql);
      assert.match(text, /state = 'reserved'/);
      assert.match(text, /lease_expires_at/);
      assert.match(text, /state = 'retrying'/);
      assert.equal(params.at(-1), 7);
      return { rows: [] };
    },
  };

  await reconcileExpiredExternalSideEffectReservations(db, { provider: "meta", limit: 7 });
});

test("quota reconciliation releases stale durable reservation counters", async () => {
  const db = {
    async query(sql, params) {
      const text = String(sql);
      assert.match(text, /reserved_api_calls = 0/);
      assert.match(text, /reserved_ai_units = 0/);
      assert.match(text, /for update skip locked/i);
      assert.equal(params[0], 45);
      assert.equal(params[1], 9);
      return { rows: [] };
    },
  };

  await reconcileStaleTenantUsageReservations(db, {
    olderThanMinutes: 45,
    limit: 9,
  });
});
