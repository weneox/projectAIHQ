import test from "node:test";
import assert from "node:assert/strict";

import { getConfigIssues } from "../src/config/validate.js";

test("meta config issues carry environment classification metadata", () => {
  const issues = getConfigIssues();
  const secretIssue = issues.find((item) => item.key === "META_APP_SECRET");

  assert.ok(secretIssue);
  assert.equal(secretIssue.level, "error");
  assert.equal(secretIssue.category, "providers");
  assert.equal(secretIssue.phase, "runtime");
  assert.ok(secretIssue.envKeys.includes("META_APP_SECRET"));
});
