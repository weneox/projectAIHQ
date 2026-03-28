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

async function loadValidateFresh(tag = "default") {
  const url = new URL(`../src/config/validate.js?case=${tag}`, import.meta.url);
  return import(url.href);
}

test("meta config issues carry environment classification metadata", async () => {
  const envSnapshot = {
    APP_ENV: process.env.APP_ENV,
    NODE_ENV: process.env.NODE_ENV,
    META_APP_SECRET: process.env.META_APP_SECRET,
    VERIFY_TOKEN: process.env.VERIFY_TOKEN,
    AIHQ_BASE_URL: process.env.AIHQ_BASE_URL,
    AIHQ_INTERNAL_TOKEN: process.env.AIHQ_INTERNAL_TOKEN,
  };

  try {
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "production";
    delete process.env.META_APP_SECRET;

    const { getConfigIssues } = await loadValidateFresh("prod-meta-secret");
    const issues = getConfigIssues();

    const secretIssue = issues.find((item) => item.key === "META_APP_SECRET");

    assert.ok(secretIssue);
    assert.equal(secretIssue.level, "error");
    assert.equal(secretIssue.category, "providers");
    assert.equal(secretIssue.phase, "runtime");
    assert.ok(Array.isArray(secretIssue.envKeys));
    assert.ok(secretIssue.envKeys.includes("META_APP_SECRET"));
  } finally {
    restoreEnv(envSnapshot);
  }
});