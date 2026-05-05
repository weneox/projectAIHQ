import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateLaunchEvidence } from "../../scripts/check-launch-evidence.mjs";
import { cfg } from "../src/config.js";
import { healthRoutes } from "../src/routes/api/health/index.js";
import { buildApiHealthResponse } from "../src/routes/api/health/builders.js";
import { inboxHandlers } from "../src/routes/api/inbox/handlers.js";
import { registerSettingsSourceGovernanceRoutes } from "../src/routes/api/settings/sources/sourceGovernance.js";
import {
  __test__ as rateLimitTest,
  resetInMemoryRateLimitsForTest,
} from "../src/utils/rateLimit.js";

function readLaunchEvidence() {
  return JSON.parse(
    readFileSync(
      new URL("../../docs/launch/production-launch-evidence.json", import.meta.url),
      "utf8"
    )
  );
}

function makeEvidenceReadyExcept(evidence, excludedId) {
  return {
    ...evidence,
    items: evidence.items
      .filter((item) => item.id !== excludedId)
      .map((item) => ({
        ...item,
        status: "READY",
        evidence: item.evidence || "test evidence",
        reasonMissing: "",
        approver: "test approver",
      })),
  };
}

function createMockRes() {
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
      return this;
    },
  };
}

async function invokeRoute(router, method, path, req = {}) {
  const layer = router.stack.find(
    (item) => item.route?.path === path && item.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route not found for ${method.toUpperCase()} ${path}`);
  }

  const handlers = layer.route.stack.map((item) => item.handle);
  const res = createMockRes();
  const fullReq = {
    method: method.toUpperCase(),
    path,
    originalUrl: path,
    url: path,
    params: {},
    headers: {},
    query: {},
    body: {},
    auth: {},
    user: {},
    app: { locals: {} },
    ...req,
  };

  async function runAt(index) {
    if (index >= handlers.length || res.finished) return;
    const handler = handlers[index];

    if (handler.length >= 3) {
      await new Promise((resolve, reject) => {
        let settled = false;
        const next = (err) => {
          if (settled) return;
          settled = true;
          if (err) {
            reject(err);
            return;
          }
          resolve(runAt(index + 1));
        };

        Promise.resolve(handler(fullReq, res, next))
          .then(() => {
            if (!settled && res.finished) {
              settled = true;
              resolve();
            }
          })
          .catch(reject);
      });
      return;
    }

    await Promise.resolve(handler(fullReq, res));
    if (!res.finished) {
      await runAt(index + 1);
    }
  }

  await runAt(0);
  return { req: fullReq, res };
}

test("launch evidence requires P1-002 rate-limit proof for every launch target", () => {
  const evidence = readLaunchEvidence();
  const item = evidence.items.find((entry) => entry.id === "P1-002");

  assert.ok(item, "P1-002 launch evidence item must exist");
  assert.equal(item.status, "BLOCKED");
  assert.equal(item.blocksLimitedLaunch, true);
  assert.equal(item.blocksPaidLaunch, true);
  assert.equal(item.blocksPublicLaunch, true);
  assert.equal(item.acceptedRiskAllowed, false);
  assert.match(item.evidence, /v1-rate-limiting\.md/);
  assert.match(item.reasonMissing, /auth\/login/i);
  assert.match(item.reasonMissing, /Meta webhook/i);
  assert.match(item.reasonMissing, /shared/i);

  for (const target of ["limited", "paid", "public"]) {
    const result = validateLaunchEvidence(evidence, { target });
    assert.equal(result.ok, false, target);
    assert.match(result.errors.join("\n"), /P1-002/, target);
  }
});

test("launch evidence checker fails closed when P1-002 is missing", () => {
  const evidenceWithoutRateLimit = makeEvidenceReadyExcept(
    readLaunchEvidence(),
    "P1-002"
  );

  for (const target of ["limited", "paid", "public"]) {
    const result = validateLaunchEvidence(evidenceWithoutRateLimit, { target });
    assert.equal(result.ok, false, target);
    assert.match(result.errors.join("\n"), /Missing required launch evidence item "P1-002"/);
  }
});

test("rate-limit health posture treats in-memory mode as non-launch-ready and keeps health safe", async () => {
  const previousEnv = cfg.app.env;
  const previousRateLimit = { ...cfg.rateLimit };

  try {
    cfg.app.env = "production";
    cfg.rateLimit.productionStrategy = "memory";
    cfg.rateLimit.provider = "";
    cfg.rateLimit.externalEvidenceUrl = "";

    const status = rateLimitTest.buildRateLimitControlStatus();
    const response = await buildApiHealthResponse({ db: null });
    const serialized = JSON.stringify(response);

    assert.equal(status.prodLike, true);
    assert.equal(status.strategy, "memory");
    assert.equal(status.sharedAcrossInstances, false);
    assert.equal(status.launchReadyByConfig, false);
    assert.equal(status.memoryModeIsLaunchReady, false);
    assert.ok(
      status.criticalCoverage.some((entry) => entry.surface === "auth_login_and_session")
    );
    assert.ok(
      status.criticalCoverage.some(
        (entry) => entry.surface === "website_widget_public_endpoints"
      )
    );
    assert.ok(
      status.criticalCoverage.some(
        (entry) => entry.surface === "meta_webhook_public_endpoint"
      )
    );
    assert.ok(
      status.criticalCoverage.some((entry) => entry.surface === "inbox_manual_reply")
    );
    assert.ok(
      status.criticalCoverage.some((entry) => entry.surface === "source_sync_trigger")
    );
    assert.ok(
      status.excludedRoutes.includes("ai-hq-backend:GET /api/health")
    );
    assert.equal(response.rateLimit.safeForPublicHealth, true);
    assert.equal(response.rateLimit.sharedAcrossInstances, false);
    assert.equal(response.rateLimit.memoryModeIsLaunchReady, false);
    assert.doesNotMatch(serialized, /redis:\/\//i);
    assert.doesNotMatch(serialized, /token=/i);
  } finally {
    cfg.app.env = previousEnv;
    Object.assign(cfg.rateLimit, previousRateLimit);
  }
});

test("manual inbox reply route is rate-limited even when db is unavailable", async () => {
  const previousWindow = cfg.rateLimit.inboxManualReplyWindowMs;
  const previousMax = cfg.rateLimit.inboxManualReplyMaxRequests;

  try {
    resetInMemoryRateLimitsForTest();
    cfg.rateLimit.inboxManualReplyWindowMs = 60_000;
    cfg.rateLimit.inboxManualReplyMaxRequests = 1;

    const router = inboxHandlers({ db: null, wsHub: null });
    const request = {
      params: { id: "11111111-1111-4111-8111-111111111111" },
      headers: { "x-forwarded-for": "203.0.113.40" },
      auth: { tenantKey: "acme", tenantId: "22222222-2222-4222-8222-222222222222" },
      body: {
        direction: "outbound",
        senderType: "agent",
        text: "hello",
      },
    };

    const first = await invokeRoute(router, "post", "/inbox/threads/:id/messages", request);
    const second = await invokeRoute(router, "post", "/inbox/threads/:id/messages", request);

    assert.notEqual(first.res.statusCode, 429);
    assert.notEqual(first.res.body?.error, "Too many requests");
    assert.equal(second.res.statusCode, 429);
    assert.equal(second.res.body?.reason, "inbox_manual_reply_rate_limited");
  } finally {
    resetInMemoryRateLimitsForTest();
    cfg.rateLimit.inboxManualReplyWindowMs = previousWindow;
    cfg.rateLimit.inboxManualReplyMaxRequests = previousMax;
  }
});

test("source sync trigger route is rate-limited even when sources are unavailable", async () => {
  const previousWindow = cfg.rateLimit.sourceSyncWindowMs;
  const previousMax = cfg.rateLimit.sourceSyncMaxRequests;

  try {
    resetInMemoryRateLimitsForTest();
    cfg.rateLimit.sourceSyncWindowMs = 60_000;
    cfg.rateLimit.sourceSyncMaxRequests = 1;

    const router = {
      stack: [],
      get() {},
      patch() {},
      post(path, ...handlers) {
        this.stack.push({
          route: {
            path,
            methods: { post: true },
            stack: handlers.map((handle) => ({ handle })),
          },
        });
      },
    };

    registerSettingsSourceGovernanceRoutes(router, {
      db: null,
      getSources: () => null,
      getKnowledge: () => null,
      requireSettingsWriteRole: async () => ({ role: "operator" }),
      resolveTenantOr400: async () => ({
        tenant_id: "33333333-3333-4333-8333-333333333333",
        tenant_key: "acme",
      }),
    });

    const request = {
      params: { id: "source-123" },
      headers: { "x-forwarded-for": "203.0.113.50" },
      auth: { tenantKey: "acme", tenantId: "33333333-3333-4333-8333-333333333333" },
      body: {},
      log: { info() {}, error() {} },
    };

    const first = await invokeRoute(router, "post", "/sources/:id/sync", request);
    const second = await invokeRoute(router, "post", "/sources/:id/sync", request);

    assert.equal(first.res.statusCode, 503);
    assert.notEqual(first.res.body?.error, "Too many requests");
    assert.equal(second.res.statusCode, 429);
    assert.equal(second.res.body?.reason, "source_sync_trigger_rate_limited");
  } finally {
    resetInMemoryRateLimitsForTest();
    cfg.rateLimit.sourceSyncWindowMs = previousWindow;
    cfg.rateLimit.sourceSyncMaxRequests = previousMax;
  }
});

test("health routes remain callable and are not pushed behind rate limiting", async () => {
  const router = healthRoutes({ db: null });

  const first = await invokeRoute(router, "get", "/", {
    headers: { "x-forwarded-for": "203.0.113.60" },
  });
  const second = await invokeRoute(router, "get", "/", {
    headers: { "x-forwarded-for": "203.0.113.60" },
  });

  assert.equal(first.res.statusCode, 200);
  assert.equal(first.res.body?.ok, true);
  assert.equal(second.res.statusCode, 200);
  assert.notEqual(second.res.statusCode, 429);
});

test("rate-limit runbook does not claim in-memory launch readiness or expose secrets", () => {
  const runbook = readFileSync(
    new URL("../../docs/runbooks/v1-rate-limiting.md", import.meta.url),
    "utf8"
  );

  assert.match(runbook, /not currently implement a shared multi-instance limiter/i);
  assert.match(runbook, /auth\/login\/session/i);
  assert.match(runbook, /Meta webhook ingress/i);
  assert.match(runbook, /inbox manual reply/i);
  assert.match(runbook, /source sync trigger/i);
  assert.match(runbook, /GET \/api\/health/i);
  assert.doesNotMatch(runbook, /redis:\/\/[^ \n]+/i);
  assert.doesNotMatch(runbook, /Bearer /i);
  assert.doesNotMatch(runbook, /secret=/i);
});
