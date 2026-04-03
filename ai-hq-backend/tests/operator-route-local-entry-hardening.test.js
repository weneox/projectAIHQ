import test from "node:test";
import assert from "node:assert/strict";

import { createLeadHandlers } from "../src/routes/api/leads/handlers.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    finished: false,
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

function missingRelation(message = 'relation "leads" does not exist') {
  const error = new Error(message);
  error.code = "42P01";
  return error;
}

test("leads list read degrades to an empty payload when the local leads schema is missing", async () => {
  const handlers = createLeadHandlers({
    db: { query: async () => { throw missingRelation(); } },
    wsHub: null,
  });
  const res = createMockRes();

  await handlers.getLeads(
    {
      query: {},
      auth: { tenantKey: "acme" },
      user: { tenantKey: "acme", role: "operator" },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.deepEqual(res.body?.leads, []);
  assert.equal(res.body?.degraded, true);
});
