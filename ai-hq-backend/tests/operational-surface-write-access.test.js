import test from "node:test";
import assert from "node:assert/strict";

import { __test__ } from "../src/routes/api/index.js";

const { requireOperationalSurfaceWriteAccess } = __test__;

function makeReq({ method = "POST", url = "/api/leads", role = "operator" } = {}) {
  return {
    method,
    originalUrl: url,
    url,
    path: url.replace(/^\/api/, ""),
    auth: {
      userId: "user_test_1",
      email: "operator@example.com",
      tenantId: "11111111-1111-4111-8111-111111111111",
      tenantKey: "demo",
      role,
    },
    user: {
      id: "user_test_1",
      email: "operator@example.com",
      tenantId: "11111111-1111-4111-8111-111111111111",
      tenantKey: "demo",
      role,
    },
  };
}

function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return res;
}

function runMiddleware(req) {
  const res = makeRes();
  let nextCalled = false;

  requireOperationalSurfaceWriteAccess(req, res, () => {
    nextCalled = true;
  });

  return { res, nextCalled };
}

test("operational write guard allows read-only requests through", () => {
  const { res, nextCalled } = runMiddleware(
    makeReq({ method: "GET", url: "/api/leads", role: "member" })
  );

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("operational write guard allows operators to write leads", () => {
  const { res, nextCalled } = runMiddleware(
    makeReq({ method: "POST", url: "/api/leads", role: "operator" })
  );

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test("operational write guard blocks members from writing leads", () => {
  const { res, nextCalled } = runMiddleware(
    makeReq({ method: "POST", url: "/api/leads", role: "member" })
  );

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.ok, false);
});

test("operational write guard blocks members from inbox handoff", () => {
  const { res, nextCalled } = runMiddleware(
    makeReq({
      method: "POST",
      url: "/api/inbox/threads/11111111-1111-4111-8111-111111111111/handoff/activate",
      role: "member",
    })
  );

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.ok, false);
});

test("operational write guard allows operators to update voice settings", () => {
  const { res, nextCalled } = runMiddleware(
    makeReq({ method: "POST", url: "/api/voice/settings", role: "operator" })
  );

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});
