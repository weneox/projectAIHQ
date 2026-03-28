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

test("twilio config issues carry environment classification metadata", async () => {
  const envSnapshot = {
    APP_ENV: process.env.APP_ENV,
    NODE_ENV: process.env.NODE_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };

  try {
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "production";
    delete process.env.OPENAI_API_KEY;

    const { getConfigIssues } = await loadValidateFresh("prod-openai-secret");
    const issues = getConfigIssues();

    const openAiIssue = issues.find((item) => item.key === "OPENAI_API_KEY");

    assert.ok(openAiIssue);
    assert.equal(openAiIssue.level, "error");
    assert.equal(openAiIssue.category, "providers");
    assert.equal(openAiIssue.phase, "runtime");
    assert.ok(Array.isArray(openAiIssue.envKeys));
    assert.ok(openAiIssue.envKeys.includes("OPENAI_API_KEY"));
  } finally {
    restoreEnv(envSnapshot);
  }
});