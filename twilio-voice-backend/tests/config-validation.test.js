import test from "node:test";
import assert from "node:assert/strict";

import { getConfigIssues } from "../src/config/validate.js";

test("twilio config issues carry environment classification metadata", () => {
  const issues = getConfigIssues();
  const openAiIssue = issues.find((item) => item.key === "OPENAI_API_KEY");

  assert.ok(openAiIssue);
  assert.equal(openAiIssue.level, "error");
  assert.equal(openAiIssue.category, "providers");
  assert.equal(openAiIssue.phase, "runtime");
  assert.ok(openAiIssue.envKeys.includes("OPENAI_API_KEY"));
});
