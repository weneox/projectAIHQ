import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { apiRouter } from "../src/routes/api/index.js";
import { buildLaunchPosture } from "../src/services/launch/posture.js";
import { createRuntimeAuthorityError } from "../src/services/businessBrain/runtimeAuthority.js";

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    cookiesCleared: [],
    finished: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    clearCookie(name, options = {}) {
      this.cookiesCleared.push({ name, options });
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
  };
}

async function invokeRouter(router, method, path, req = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ req: fullReq, res });
    };
    const headers = Object.fromEntries(
      Object.entries(req.headers || {}).map(([key, value]) => [
        String(key).toLowerCase(),
        value,
      ])
    );
    const fullReq = {
      method: String(method || "GET").toUpperCase(),
      path,
      originalUrl: path,
      url: path,
      headers,
      query: req.query || {},
      body: req.body || {},
      protocol: req.protocol || "https",
      app: req.app || { locals: {} },
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      ...req,
    };
    const res = createMockRes(finish);

    try {
      router.handle(fullReq, res, (err) => {
        if (settled) return;
        if (err) {
          settled = true;
          reject(err);
          return;
        }
        settled = true;
        resolve({ req: fullReq, res });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function buildReq() {
  return {
    user: {
      id: "user-1",
      tenantId: "tenant-1",
      tenantKey: "acme",
      role: "owner",
      email: "owner@acme.test",
    },
    auth: {
      userId: "user-1",
      tenantId: "tenant-1",
      tenantKey: "acme",
      role: "owner",
      email: "owner@acme.test",
    },
  };
}

function truthPayload({ ready = true } = {}) {
  return {
    truth: {
      history: ready ? [{ id: "truth-v1" }] : [],
      readiness: ready
        ? {
            status: "ready",
            message: "Approved truth is available.",
            blockers: [],
          }
        : {
            status: "blocked",
            reasonCode: "approved_truth_unavailable",
            message: "Approved truth is unavailable.",
            blockers: [
              {
                reasonCode: "approved_truth_unavailable",
                title: "Approved truth unavailable",
                subtitle: "Approve business info before launch.",
                nextAction: {
                  label: "Open setup",
                  target: { path: "/home?assistant=setup" },
                },
              },
            ],
          },
    },
  };
}

function readyRuntime() {
  return {
    authority: {
      available: true,
      runtimeProjectionId: "runtime-projection-1",
      runtimeProjectionStatus: "ready",
    },
  };
}

function websitePayload({ ready = false, testingOnly = false } = {}) {
  return {
    state: ready ? "connected" : testingOnly ? "blocked" : "not_connected",
    launchReadiness: {
      status: ready
        ? "production_ready"
        : testingOnly
          ? "testing_only"
          : "not_configured",
      channelConfigured: ready || testingOnly,
      widgetEnabled: ready || testingOnly,
      productionLaunchAllowed: ready,
      productionReady: ready,
      testingOnly,
      targetDomain: "acme.example",
      publicWidgetId: ready || testingOnly ? "ww_acme" : "",
      reasonCode: ready ? "" : "website_not_ready",
      blockers: ready
        ? []
        : [
            {
              reasonCode: testingOnly
                ? "website_domain_verification_required"
                : "website_not_ready",
              title: "Website chat not ready",
              subtitle: "Website chat needs setup.",
            },
          ],
    },
    readiness: {
      status: ready ? "ready" : testingOnly ? "attention" : "blocked",
      blockers: [],
    },
  };
}

function instagramPayload({ ready = false } = {}) {
  return {
    connected: ready,
    state: ready ? "connected" : "not_connected",
    account: {
      displayName: "Acme Instagram",
      username: "acme",
    },
    runtime: {
      deliveryReady: ready,
    },
    readiness: {
      status: ready ? "ready" : "blocked",
      blockers: ready
        ? []
        : [
            {
              reasonCode: "instagram_dm_not_ready",
              title: "Instagram DM not ready",
              subtitle: "Connect Instagram DM.",
            },
          ],
    },
  };
}

function telegramPayload({ ready = false } = {}) {
  return {
    connected: ready,
    state: ready ? "connected" : "not_connected",
    account: {
      displayName: "Acme bot",
      botUsername: "acmebot",
    },
    runtime: {
      deliveryReady: ready,
    },
    readiness: {
      status: ready ? "ready" : "blocked",
      blockers: ready
        ? []
        : [
            {
              reasonCode: "telegram_private_bot_chat_not_ready",
              title: "Telegram private bot chat not ready",
              subtitle: "Connect Telegram private bot chat.",
            },
          ],
    },
  };
}

function deps({
  truthReady = true,
  runtimeReady = true,
  websiteReady = false,
  websiteTestingOnly = false,
  instagramReady = false,
  telegramReady = false,
  inbox = {},
} = {}) {
  return {
    loadTruth: async () => truthPayload({ ready: truthReady }),
    getRuntime: async () => {
      if (runtimeReady) return readyRuntime();
      throw createRuntimeAuthorityError({
        tenantId: "tenant-1",
        tenantKey: "acme",
        reasonCode: "runtime_projection_missing",
        reason: "runtime_projection_missing",
        message: "Approved runtime authority is unavailable.",
      });
    },
    getWebsiteStatus: async () =>
      websitePayload({ ready: websiteReady, testingOnly: websiteTestingOnly }),
    getInstagramStatus: async () => instagramPayload({ ready: instagramReady }),
    getTelegramStatus: async () => telegramPayload({ ready: telegramReady }),
    getInboxPressureSummary: async () => ({
      unreadCount: 0,
      openCount: 0,
      handoffCount: 0,
      assignedOpenCount: 0,
      pendingOutboundCount: 0,
      failedOutboundCount: 0,
      retryingOutboundCount: 0,
      ...inbox,
    }),
    now: () => new Date("2026-04-29T10:00:00.000Z"),
  };
}

test("launch posture route requires authenticated user session", async () => {
  const router = apiRouter({
    db: null,
    wsHub: { broadcast() {} },
    audit: null,
    dbDisabled: true,
  });

  const result = await invokeRouter(router, "get", "/launch/posture", {
    headers: { host: "api.example.test" },
    protocol: "https",
  });

  assert.equal(result.res.statusCode, 401);
  assert.equal(result.res.body?.error, "Unauthorized");
});

test("app launch posture route remains app-authenticated even with internal token", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const router = apiRouter({
      db: null,
      wsHub: { broadcast() {} },
      audit: null,
      dbDisabled: true,
    });

    const result = await invokeRouter(router, "get", "/launch/posture", {
      headers: {
        host: "api.example.test",
        "x-internal-token": "internal-secret",
        "x-internal-audience": "aihq-backend.launch-posture",
      },
      protocol: "https",
    });

    assert.equal(result.res.statusCode, 401);
    assert.equal(result.res.body?.error, "Unauthorized");
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("internal launch posture route rejects missing and wrong internal token", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const router = apiRouter({
      db: null,
      wsHub: { broadcast() {} },
      audit: null,
      dbDisabled: true,
    });

    const missing = await invokeRouter(
      router,
      "get",
      "/internal/launch/posture",
      {
        headers: {
          host: "api.example.test",
          "x-internal-audience": "aihq-backend.launch-posture",
        },
        query: { tenantKey: "acme" },
        protocol: "https",
      }
    );

    const wrong = await invokeRouter(
      router,
      "get",
      "/internal/launch/posture",
      {
        headers: {
          host: "api.example.test",
          "x-internal-token": "wrong-secret",
          "x-internal-audience": "aihq-backend.launch-posture",
        },
        query: { tenantKey: "acme" },
        protocol: "https",
      }
    );

    assert.equal(missing.res.statusCode, 401);
    assert.equal(missing.res.body?.reason, "invalid internal token");
    assert.equal(wrong.res.statusCode, 401);
    assert.equal(wrong.res.body?.reason, "invalid internal token");
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("internal launch posture route returns launch posture contract with valid internal token", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const router = apiRouter({
      db: null,
      wsHub: { broadcast() {} },
      audit: null,
      dbDisabled: true,
    });

    const result = await invokeRouter(
      router,
      "get",
      "/internal/launch/posture",
      {
        headers: {
          host: "api.example.test",
          "x-internal-token": "internal-secret",
          "x-internal-audience": "aihq-backend.launch-posture",
        },
        query: { tenantKey: "acme" },
        protocol: "https",
      }
    );

    assert.equal(result.res.statusCode, 200);
    assert.equal(result.res.body?.ok, true);
    assert.equal(result.res.body?.version, "launch_posture_v1");
    assert.equal(result.res.body?.scope?.id, "aihq_launch_v1_narrow");
    assert.equal(result.res.body?.tenant?.tenantKey, "acme");
    assert.equal(typeof result.res.body?.overall?.launchReady, "boolean");
    assert.ok(result.res.body?.channels?.website);
    assert.ok(result.res.body?.channels?.instagram);
    assert.ok(result.res.body?.channels?.telegram);
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("launch posture blocks when approved truth is unavailable", async () => {
  const payload = await buildLaunchPosture(
    { db: {}, req: buildReq() },
    deps({ truthReady: false, runtimeReady: true, websiteReady: true })
  );

  assert.equal(payload.ok, true);
  assert.equal(payload.overall.launchReady, false);
  assert.equal(payload.overall.status, "blocked");
  assert.equal(payload.truth.ready, false);
  assert.equal(payload.truth.reasonCode, "approved_truth_unavailable");
  assert.equal(payload.blockers[0]?.surface, "truth");
});

test("launch posture blocks when strict runtime authority is missing", async () => {
  const payload = await buildLaunchPosture(
    { db: {}, req: buildReq() },
    deps({ truthReady: true, runtimeReady: false, websiteReady: true })
  );

  assert.equal(payload.overall.launchReady, false);
  assert.equal(payload.overall.status, "blocked");
  assert.equal(payload.runtime.ready, false);
  assert.equal(payload.runtime.reasonCode, "runtime_projection_missing");
});

test("one delivery-ready launch channel satisfies the channel requirement", async () => {
  const payload = await buildLaunchPosture(
    { db: {}, req: buildReq() },
    deps({ truthReady: true, runtimeReady: true, telegramReady: true })
  );

  assert.equal(payload.overall.launchReady, true);
  assert.equal(payload.channelSummary.readyCount, 1);
  assert.deepEqual(payload.channelSummary.deliveryReadyChannelIds, ["telegram"]);
  assert.equal(payload.channels.telegram.deliveryReady, true);
});

test("website testing-only posture does not count as delivery ready", async () => {
  const payload = await buildLaunchPosture(
    { db: {}, req: buildReq() },
    deps({
      truthReady: true,
      runtimeReady: true,
      websiteTestingOnly: true,
    })
  );

  assert.equal(payload.channels.website.status, "testing_only");
  assert.equal(payload.channels.website.deliveryReady, false);
  assert.equal(payload.channelSummary.readyCount, 0);
  assert.equal(payload.overall.launchReady, false);
});

test("zero delivery-ready channels block launch", async () => {
  const payload = await buildLaunchPosture(
    { db: {}, req: buildReq() },
    deps({ truthReady: true, runtimeReady: true })
  );

  assert.equal(payload.channelSummary.readyCount, 0);
  assert.equal(payload.overall.launchReady, false);
  assert.equal(
    payload.blockers.some(
      (blocker) => blocker.reasonCode === "launch_channel_delivery_unavailable"
    ),
    true
  );
});

test("launch posture payload stays within the narrow launch scope", async () => {
  const payload = await buildLaunchPosture(
    { db: {}, req: buildReq() },
    deps({ truthReady: true, runtimeReady: true, websiteReady: true })
  );
  const serialized = JSON.stringify(payload).toLowerCase();

  assert.deepEqual(payload.scope.surfaces, [
    "home",
    "channels",
    "truth",
    "inbox",
    "website_chat",
    "instagram_dm",
    "telegram_private_bot_chat",
  ]);
  for (const forbidden of [
    "voice",
    "comments",
    "publish",
    "proposals",
    "media",
    "gmail",
    "whatsapp",
  ]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `payload unexpectedly included ${forbidden}`
    );
  }
});
