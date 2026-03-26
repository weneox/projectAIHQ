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
