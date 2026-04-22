import test from "node:test";
import assert from "node:assert/strict";

function restoreEnv(snapshot) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function loadConfigFresh(tag = "default") {
  const url = new URL(`../src/config.js?case=${tag}`, import.meta.url);
  return import(url.href);
}

async function loadValidateFresh(tag = "default") {
  const url = new URL(`../src/config/validate.js?case=${tag}`, import.meta.url);
  return import(url.href);
}

test(
  "ai-hq config prefers META_CONNECT_APP_SECRET over legacy fallback",
  { concurrency: false },
  async () => {
    const envSnapshot = { ...process.env };

    try {
      process.env.META_CONNECT_APP_SECRET = "connect-secret";
      process.env.META_APP_SECRET = "connect-secret";

      const { getMetaConnectSecretConfig } = await loadConfigFresh("preferred");
      const secretConfig = getMetaConnectSecretConfig();

      assert.equal(secretConfig.resolvedSecret, "connect-secret");
      assert.equal(secretConfig.resolvedSource, "META_CONNECT_APP_SECRET");
      assert.equal(secretConfig.mismatch, false);
      assert.equal(secretConfig.resolvedFingerprint.length > 0, true);
    } finally {
      restoreEnv(envSnapshot);
    }
  }
);

test(
  "ai-hq config falls back to META_APP_SECRET when explicit connect env is absent",
  { concurrency: false },
  async () => {
    const envSnapshot = { ...process.env };

    try {
      delete process.env.META_CONNECT_APP_SECRET;
      process.env.META_APP_SECRET = "legacy-connect-secret";

      const { getMetaConnectSecretConfig } = await loadConfigFresh("fallback");
      const secretConfig = getMetaConnectSecretConfig();

      assert.equal(secretConfig.resolvedSecret, "legacy-connect-secret");
      assert.equal(secretConfig.resolvedSource, "META_APP_SECRET");
      assert.equal(secretConfig.mismatch, false);
    } finally {
      restoreEnv(envSnapshot);
    }
  }
);

test(
  "ai-hq config validation fails when explicit and fallback connect secrets differ",
  { concurrency: false },
  async () => {
    const envSnapshot = { ...process.env };

    try {
      process.env.META_APP_ID = "meta-app-id";
      process.env.META_REDIRECT_URI =
        "https://app.example.test/api/channels/meta/callback";
      process.env.META_CONNECT_APP_SECRET = "connect-secret-a";
      process.env.META_APP_SECRET = "connect-secret-b";

      const { getConfigIssues } = await loadValidateFresh("mismatch");
      const issues = getConfigIssues();
      const metaIssue = issues.find((item) => item.key === "meta.oauth");

      assert.ok(metaIssue);
      assert.equal(metaIssue.level, "error");
      assert.equal(metaIssue.category, "provider-oauth");
      assert.equal(metaIssue.phase, "runtime");
      assert.ok(metaIssue.envKeys.includes("META_CONNECT_APP_SECRET"));
      assert.ok(metaIssue.envKeys.includes("META_APP_SECRET"));
      assert.match(String(metaIssue.message || ""), /differ/i);
    } finally {
      restoreEnv(envSnapshot);
    }
  }
);
