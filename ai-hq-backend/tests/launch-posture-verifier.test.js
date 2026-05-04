import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInternalServiceHeaders,
  buildLaunchPostureHeaders,
  buildLaunchPostureUrl,
  classifyLaunchPosture,
  resolveLaunchPostureInternalToken,
} from "../../scripts/launch-posture-verifier.mjs";

function validPosture(overrides = {}) {
  return {
    ok: true,
    version: "launch_posture_v1",
    generatedAt: "2026-04-29T10:00:00.000Z",
    tenant: {
      id: "tenant-1",
      tenantKey: "acme",
    },
    scope: {
      id: "aihq_launch_v1_narrow",
      surfaces: [
        "home",
        "channels",
        "truth",
        "inbox",
        "website_chat",
        "instagram_dm",
        "telegram_private_bot_chat",
      ],
    },
    overall: {
      status: "blocked",
      launchReady: false,
    },
    truth: {
      ready: false,
      status: "blocked",
      reasonCode: "approved_truth_unavailable",
    },
    runtime: {
      ready: false,
      status: "blocked",
      reasonCode: "runtime_projection_missing",
    },
    channels: {
      website: {},
      instagram: {},
      telegram: {},
    },
    channelSummary: {
      readyCount: 0,
      connectedCount: 0,
      deliveryReadyChannelIds: [],
      selectedChannelId: "",
    },
    inbox: {
      available: true,
    },
    blockers: [],
    repairActions: [],
    unavailable: [],
    ...overrides,
  };
}

test("launch posture verifier builds internal route URL and headers by default", () => {
  assert.equal(
    buildLaunchPostureUrl("https://api.example.test/", {
      tenantKey: "acme",
    }),
    "https://api.example.test/api/internal/launch/posture?tenantKey=acme"
  );
  assert.equal(
    buildLaunchPostureUrl("https://api.example.test/", { internal: false }),
    "https://api.example.test/api/launch/posture"
  );
  assert.deepEqual(buildLaunchPostureHeaders({ internalToken: "secret" }), {
    accept: "application/json",
    "x-internal-token": "secret",
    "x-internal-audience": "aihq-backend.launch-posture",
    "x-internal-service": "meta-bot-backend",
  });
  assert.deepEqual(
    buildInternalServiceHeaders({
      internalToken: "secret",
      audience: "aihq-backend.diagnostics",
    }),
    {
      "x-internal-token": "secret",
      "x-internal-audience": "aihq-backend.diagnostics",
      "x-internal-service": "meta-bot-backend",
    }
  );
  assert.deepEqual(
    buildLaunchPostureHeaders({
      internal: false,
      sessionCookie: "aihq_user=session-token",
    }),
    {
      accept: "application/json",
      cookie: "aihq_user=session-token",
    }
  );
});

test("launch posture verifier resolves the scoped Meta service token", () => {
  assert.equal(
    resolveLaunchPostureInternalToken({
      AIHQ_INTERNAL_TOKEN: "global-secret",
      AIHQ_INTERNAL_TOKEN_META_BOT: "meta-scoped-secret",
    }),
    "meta-scoped-secret"
  );
  assert.deepEqual(
    buildLaunchPostureHeaders({
      internalToken: resolveLaunchPostureInternalToken({
        AIHQ_PROD_INTERNAL_TOKEN_META_BOT: "prod-meta-scoped-secret",
      }),
    }),
    {
      accept: "application/json",
      "x-internal-token": "prod-meta-scoped-secret",
      "x-internal-audience": "aihq-backend.launch-posture",
      "x-internal-service": "meta-bot-backend",
    }
  );
});

test("launch posture verifier accepts the narrow contract", () => {
  const result = classifyLaunchPosture(validPosture());

  assert.equal(result.ok, true);
  assert.deepEqual(result.details.malformed, []);
  assert.deepEqual(result.details.leakedSurfaces, []);
});

test("launch posture verifier rejects phase-2 surface leaks", () => {
  const result = classifyLaunchPosture(
    validPosture({
      scope: {
        id: "aihq_launch_v1_narrow",
        surfaces: [
          "home",
          "channels",
          "truth",
          "inbox",
          "website_chat",
          "instagram_dm",
          "telegram_private_bot_chat",
          "voice",
        ],
      },
      channels: {
        website: {},
        instagram: {},
        telegram: {},
        gmail: {},
      },
    })
  );

  assert.equal(result.ok, false);
  assert.ok(result.details.malformed.includes("phase_two_surface_leak"));
  assert.ok(result.details.leakedSurfaces.includes("voice"));
  assert.ok(result.details.leakedSurfaces.includes("gmail"));
});
