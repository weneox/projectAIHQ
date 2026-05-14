import test from "node:test";
import assert from "node:assert/strict";

import { inboxHandlers } from "../src/routes/api/inbox/handlers.js";

const EXPECTED_DIRECT_ROUTES = [
  ["get", "/inbox/outbound/summary"],
  ["get", "/inbox/outbound/failed"],
  ["post", "/inbox/outbound/:attemptId/resend"],
  ["post", "/inbox/outbound/:attemptId/mark-dead"],
  ["get", "/inbox/threads"],
  ["get", "/inbox/threads/:id"],
  ["get", "/inbox/threads/:id/messages"],
  ["get", "/inbox/threads/:id/outbound-attempts"],
  ["post", "/inbox/threads"],
  ["post", "/inbox/threads/:id/messages"],
  ["post", "/inbox/threads/:id/read"],
  ["post", "/inbox/threads/:id/assign"],
  ["post", "/inbox/threads/:id/handoff/activate"],
  ["post", "/inbox/threads/:id/handoff/release"],
  ["post", "/inbox/threads/:id/status"],
];

test("inbox operator routes register as direct route layers", () => {
  const router = inboxHandlers({ db: null, wsHub: null });
  const routeLayers = router.stack.filter((item) => item.route);
  const nestedLayers = router.stack.filter((item) => !item.route);

  assert.deepEqual(
    nestedLayers,
    [],
    "inboxHandlers should not mount nested routers with r.use"
  );

  for (const [method, path] of EXPECTED_DIRECT_ROUTES) {
    const matches = routeLayers.filter(
      (item) => item.route?.path === path && item.route?.methods?.[method]
    );

    assert.equal(
      matches.length,
      1,
      `${method.toUpperCase()} ${path} should be registered directly once`
    );
  }
});
