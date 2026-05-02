import test from "node:test";
import assert from "node:assert/strict";

import {
  assertTenantQueryAllowed,
  runWithTenantContext,
  runWithSystemDbContext,
} from "../src/db/tenantContext.js";
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
