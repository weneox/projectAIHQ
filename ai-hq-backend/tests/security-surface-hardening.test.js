import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { getConfigIssues } from "../src/config/validate.js";
import {
  getCallbackTokenAuthResult,
  getDebugTokenAuthResult,
  getInternalTokenAuthResult,
} from "../src/utils/auth.js";
import {
  buildAllowedCorsOrigins,
  isAllowedOrigin,
  sanitizeProviderSecrets,
  shouldAllowDiagnosticsRequest,
  shouldEnableDebugRoutes,
} from "../src/utils/securitySurface.js";

test("production CORS policy denies wildcard origin defaults", () => {
  assert.deepEqual(buildAllowedCorsOrigins("*", "production"), []);
  assert.deepEqual(buildAllowedCorsOrigins("*", "development"), ["*"]);
  assert.deepEqual(
    buildAllowedCorsOrigins("https://app.example.com, https://admin.example.com", "production"),
    ["https://app.example.com", "https://admin.example.com"]
  );
});

test("wildcard preview origin patterns stay explicit to the configured Pages project", () => {
  const allowed = buildAllowedCorsOrigins(
    "https://hq.weneox.com, https://*.hq.pages.dev",
    "production"
  );

  assert.equal(isAllowedOrigin("https://feature-123.hq.pages.dev", allowed, "production"), true);
  assert.equal(isAllowedOrigin("https://preview.hq.pages.dev", allowed, "production"), true);
  assert.equal(isAllowedOrigin("https://feature-123.other.pages.dev", allowed, "production"), false);
  assert.equal(isAllowedOrigin("http://feature-123.hq.pages.dev", allowed, "production"), false);
});

test("config validation rejects wildcard cors origin in production", () => {
  const previousEnv = cfg.app.env;
  const previousCors = cfg.urls.corsOrigin;

  try {
    cfg.app.env = "production";
    cfg.urls.corsOrigin = "*";

    const issue = getConfigIssues().find((item) => item.key === "urls.corsOrigin");
    assert.equal(issue?.level, "error");
  } finally {
    cfg.app.env = previousEnv;
    cfg.urls.corsOrigin = previousCors;
  }
});

test("config validation requires AIHQ_INTERNAL_TOKEN outside test", () => {
  const previousEnv = cfg.app.env;
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.app.env = "development";
    cfg.security.aihqInternalToken = "";

    const issue = getConfigIssues().find(
      (item) => item.key === "security.aihqInternalToken"
    );
    assert.equal(issue?.level, "error");
  } finally {
    cfg.app.env = previousEnv;
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("diagnostics are deny-by-default outside test without debug or internal token", () => {
  const deniedInDev = shouldAllowDiagnosticsRequest(
    {
      headers: {},
      query: {},
      body: {},
    },
    "development"
  );

  const denied = shouldAllowDiagnosticsRequest(
    {
      headers: {},
      query: {},
      body: {},
    },
    "production"
  );

  const allowedInTest = shouldAllowDiagnosticsRequest(
    {
      headers: {},
      query: {},
      body: {},
    },
    "test"
  );

  assert.equal(deniedInDev, false);
  assert.equal(denied, false);
  assert.equal(allowedInTest, true);
});

test("debug routes stay disabled in production unless explicitly enabled", () => {
  const previousEnv = cfg.app.env;
  const previousDebugRoutesEnabled = cfg.security.debugRoutesEnabled;

  try {
    cfg.app.env = "production";
    cfg.security.debugRoutesEnabled = false;
    assert.equal(shouldEnableDebugRoutes(), false);

    cfg.security.debugRoutesEnabled = true;
    assert.equal(shouldEnableDebugRoutes(), true);

    cfg.app.env = "development";
    cfg.security.debugRoutesEnabled = false;
    assert.equal(shouldEnableDebugRoutes(), true);
  } finally {
    cfg.app.env = previousEnv;
    cfg.security.debugRoutesEnabled = previousDebugRoutesEnabled;
  }
});

test("provider secret sanitization strips raw values by default", () => {
  const summary = sanitizeProviderSecrets(
    {
      page_access_token: "secret-token",
      app_secret: "super-secret",
    },
    {
      includeValues: false,
    }
  );

  assert.deepEqual(summary.secretKeys, ["page_access_token", "app_secret"]);
  assert.equal(summary.secrets[0].value, undefined);
  assert.equal(summary.secrets[0].present, true);
  assert.equal(summary.secrets[1].present, true);
});

test("internal auth is fail-closed outside test and explicit in test", () => {
  const previousEnv = cfg.app.env;
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.app.env = "development";
    cfg.security.aihqInternalToken = "";

    const denied = getInternalTokenAuthResult({
      headers: {},
      body: {},
    });

    assert.equal(denied.ok, false);
    assert.equal(denied.code, "internal_token_not_configured");

    cfg.app.env = "test";

    const allowed = getInternalTokenAuthResult({
      headers: {},
      body: {},
    });

    assert.equal(allowed.ok, true);
    assert.equal(allowed.mode, "test_bypass");
  } finally {
    cfg.app.env = previousEnv;
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("internal auth can require caller identity and audience for scoped routes", () => {
  const previousInternalToken = cfg.security.aihqInternalToken;
  const previousMetaToken = cfg.security.aihqInternalMetaBotToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";
    cfg.security.aihqInternalMetaBotToken = "";

    const allowed = getInternalTokenAuthResult(
      {
        headers: {
          "x-internal-token": "internal-secret",
          "x-internal-service": "meta-bot-backend",
          "x-internal-audience": "aihq-backend.tenants.resolve-channel",
        },
        body: {},
      },
      {
        allowedServices: ["meta-bot-backend"],
        allowedAudiences: ["aihq-backend.tenants.resolve-channel"],
      }
    );

    const deniedAudience = getInternalTokenAuthResult(
      {
        headers: {
          "x-internal-token": "internal-secret",
          "x-internal-service": "meta-bot-backend",
          "x-internal-audience": "aihq-backend.executions.voice-sync",
        },
        body: {},
      },
      {
        allowedServices: ["meta-bot-backend"],
        allowedAudiences: ["aihq-backend.tenants.resolve-channel"],
      }
    );

    assert.equal(allowed.ok, true);
    assert.equal(allowed.service, "meta-bot-backend");
    assert.equal(allowed.audience, "aihq-backend.tenants.resolve-channel");
    assert.equal(allowed.tokenScope, "global");
    assert.equal(deniedAudience.ok, false);
    assert.equal(deniedAudience.code, "invalid_internal_audience");
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
    cfg.security.aihqInternalMetaBotToken = previousMetaToken;
  }
});

test("internal auth prefers service-scoped tokens when configured for a caller", () => {
  const previousInternalToken = cfg.security.aihqInternalToken;
  const previousMetaToken = cfg.security.aihqInternalMetaBotToken;

  try {
    cfg.security.aihqInternalToken = "shared-secret";
    cfg.security.aihqInternalMetaBotToken = "meta-secret";

    const scoped = getInternalTokenAuthResult(
      {
        headers: {
          "x-internal-token": "meta-secret",
          "x-internal-service": "meta-bot-backend",
          "x-internal-audience": "aihq-backend.tenants.resolve-channel",
        },
        body: {},
      },
      {
        allowedServices: ["meta-bot-backend"],
        allowedAudiences: ["aihq-backend.tenants.resolve-channel"],
      }
    );

    assert.equal(scoped.ok, true);
    assert.equal(scoped.mode, "service_token");
    assert.equal(scoped.tokenScope, "scoped");
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
    cfg.security.aihqInternalMetaBotToken = previousMetaToken;
  }
});

test("callback and debug auth are fail-closed outside test and explicit in test", () => {
  const previousEnv = cfg.app.env;
  const previousCallbackToken = cfg.n8n.callbackToken;
  const previousWebhookToken = cfg.n8n.webhookToken;
  const previousDebugToken = cfg.security.debugApiToken;

  try {
    cfg.app.env = "development";
    cfg.n8n.callbackToken = "";
    cfg.n8n.webhookToken = "";
    cfg.security.debugApiToken = "";

    const deniedCallback = getCallbackTokenAuthResult({
      headers: {},
      body: {},
    });
    const deniedDebug = getDebugTokenAuthResult({
      headers: {},
      body: {},
      query: {},
    });

    assert.equal(deniedCallback.ok, false);
    assert.equal(deniedCallback.code, "callback_token_not_configured");
    assert.equal(deniedDebug.ok, false);
    assert.equal(deniedDebug.code, "debug_token_not_configured");

    cfg.app.env = "test";

    const allowedCallback = getCallbackTokenAuthResult({
      headers: {},
      body: {},
    });
    const allowedDebug = getDebugTokenAuthResult({
      headers: {},
      body: {},
      query: {},
    });

    assert.equal(allowedCallback.ok, true);
    assert.equal(allowedCallback.mode, "test_bypass");
    assert.equal(allowedDebug.ok, true);
    assert.equal(allowedDebug.mode, "test_bypass");
  } finally {
    cfg.app.env = previousEnv;
    cfg.n8n.callbackToken = previousCallbackToken;
    cfg.n8n.webhookToken = previousWebhookToken;
    cfg.security.debugApiToken = previousDebugToken;
  }
});
