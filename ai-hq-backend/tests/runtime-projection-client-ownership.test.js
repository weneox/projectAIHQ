import test from "node:test";
import assert from "node:assert/strict";

import { resolveClientAccess } from "../src/db/helpers/tenantRuntimeProjection/shared.js";

test("resolveClientAccess reuses already-connected pg clients without reconnecting", async () => {
  let connectCalls = 0;
  const client = {
    query() {},
    connect() {
      connectCalls += 1;
      throw new Error("should not reconnect an active client");
    },
  };

  const result = await resolveClientAccess(client);

  assert.equal(result.client, client);
  assert.equal(result.ownsClient, false);
  assert.equal(connectCalls, 0);
});

test("resolveClientAccess acquires a client from pools", async () => {
  const pooledClient = {
    query() {},
    release() {},
  };
  let connectCalls = 0;
  const pool = {
    async connect() {
      connectCalls += 1;
      return pooledClient;
    },
  };

  const result = await resolveClientAccess(pool);

  assert.equal(result.client, pooledClient);
  assert.equal(result.ownsClient, true);
  assert.equal(connectCalls, 1);
});
