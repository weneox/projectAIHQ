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
  "meta-bot config prefers META_WEBHOOK_APP_SECRET over legacy fallback",
  { concurrency: false },
  async () => {
    const envSnapshot = { ...process.env };

    try {
      process.env.META_WEBHOOK_APP_SECRET = "preferred-secret";
      process.env.META_APP_SECRET = "preferred-secret";

      const { getMetaWebhookSecretConfig } = await loadConfigFresh("preferred");
      const secretConfig = getMetaWebhookSecretConfig();

      assert.equal(secretConfig.resolvedSecret, "preferred-secret");
      assert.equal(secretConfig.resolvedSource, "META_WEBHOOK_APP_SECRET");
      assert.equal(secretConfig.mismatch, false);
      assert.equal(secretConfig.resolvedFingerprint.length > 0, true);
    } finally {
      restoreEnv(envSnapshot);
    }
  }
);

test(
  "meta-bot config falls back to META_APP_SECRET when explicit env is absent",
  { concurrency: false },
  async () => {
    const envSnapshot = { ...process.env };

    try {
      process.env.APP_ENV = "development";
      delete process.env.META_WEBHOOK_APP_SECRET;
      process.env.META_APP_SECRET = "fallback-secret";

      const { getMetaWebhookSecretConfig } = await loadConfigFresh("fallback");
      const secretConfig = getMetaWebhookSecretConfig();

      assert.equal(secretConfig.resolvedSecret, "fallback-secret");
      assert.equal(secretConfig.resolvedSource, "META_APP_SECRET");
      assert.equal(secretConfig.mismatch, false);
      assert.equal(secretConfig.prodLike, false);
      assert.equal(secretConfig.fallbackDisallowed, false);
    } finally {
      restoreEnv(envSnapshot);
    }
  }
);

test(
  "meta-bot config rejects META_APP_SECRET fallback in production-like environments",
  { concurrency: false },
  async () => {
    const envSnapshot = { ...process.env };

    try {
      process.env.APP_ENV = "production";
      process.env.NODE_ENV = "production";
      process.env.VERIFY_TOKEN = "verify-token";
      process.env.PUBLIC_BASE_URL = "https://meta.example.test";
      process.env.AIHQ_BASE_URL = "https://aihq.example.test";
      process.env.AIHQ_INTERNAL_TOKEN = "internal-token";
      process.env.CONTACT_EMAIL = "ops@example.test";
      delete process.env.META_WEBHOOK_APP_SECRET;
      process.env.META_APP_SECRET = "fallback-secret";

      const { getMetaWebhookSecretConfig } = await loadConfigFresh("prod-fallback");
      const secretConfig = getMetaWebhookSecretConfig();

      assert.equal(secretConfig.fallbackDisallowed, true);
      assert.equal(secretConfig.resolvedSecret, "");
      assert.equal(secretConfig.resolvedSource, "");

      const { getConfigIssues } = await loadValidateFresh("prod-fallback");
      const issues = getConfigIssues();
      const secretIssue = issues.find(
        (item) => item.key === "META_WEBHOOK_APP_SECRET"
      );

      assert.ok(secretIssue);
      assert.equal(secretIssue.level, "error");
      assert.equal(secretIssue.category, "providers");
      assert.match(String(secretIssue.message || ""), /production-like/i);
      assert.ok(secretIssue.envKeys.includes("META_WEBHOOK_APP_SECRET"));
      assert.ok(secretIssue.envKeys.includes("META_APP_SECRET"));
    } finally {
      restoreEnv(envSnapshot);
    }
  }
);

test(
  "meta-bot config accepts explicit META_WEBHOOK_APP_SECRET in production-like environments",
  { concurrency: false },
  async () => {
    const envSnapshot = { ...process.env };

    try {
      process.env.APP_ENV = "production";
      process.env.NODE_ENV = "production";
      process.env.VERIFY_TOKEN = "verify-token";
      process.env.PUBLIC_BASE_URL = "https://meta.example.test";
      process.env.AIHQ_BASE_URL = "https://aihq.example.test";
      process.env.AIHQ_INTERNAL_TOKEN = "internal-token";
      process.env.CONTACT_EMAIL = "ops@example.test";
      process.env.META_WEBHOOK_APP_SECRET = "preferred-secret";
      delete process.env.META_APP_SECRET;

      const { getConfigIssues } = await loadValidateFresh("prod-explicit");
      const issues = getConfigIssues();
      const secretIssue = issues.find(
        (item) => item.key === "META_WEBHOOK_APP_SECRET"
      );

      assert.equal(secretIssue, undefined);
    } finally {
      restoreEnv(envSnapshot);
    }
  }
);

test(
  "meta-bot config validation fails when explicit and fallback secrets differ",
  { concurrency: false },
  async () => {
    const envSnapshot = { ...process.env };

    try {
      process.env.APP_ENV = "production";
      process.env.NODE_ENV = "production";
      process.env.VERIFY_TOKEN = "verify-token";
      process.env.PUBLIC_BASE_URL = "https://meta.example.test";
      process.env.AIHQ_BASE_URL = "https://aihq.example.test";
      process.env.AIHQ_INTERNAL_TOKEN = "internal-token";
      process.env.CONTACT_EMAIL = "ops@example.test";
      process.env.META_WEBHOOK_APP_SECRET = "preferred-secret";
      process.env.META_APP_SECRET = "fallback-secret";

      const { getConfigIssues } = await loadValidateFresh("mismatch");
      const issues = getConfigIssues();
      const secretIssue = issues.find(
        (item) => item.key === "META_WEBHOOK_APP_SECRET"
      );

      assert.ok(secretIssue);
      assert.equal(secretIssue.level, "error");
      assert.equal(secretIssue.category, "providers");
      assert.equal(secretIssue.phase, "runtime");
      assert.ok(secretIssue.envKeys.includes("META_WEBHOOK_APP_SECRET"));
      assert.ok(secretIssue.envKeys.includes("META_APP_SECRET"));
      assert.match(String(secretIssue.message || ""), /differ/i);
    } finally {
      restoreEnv(envSnapshot);
    }
  }
);
