import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

const guardedServiceFiles = [
  "ai-hq-backend/src/services/channelDelivery.js",
  "ai-hq-backend/src/services/auth/selfServiceWorkspace.js",
  "ai-hq-backend/src/services/auth/canonicalUserAccess.js",
  "ai-hq-backend/src/services/voiceInternalRuntime.js",
];

test("fixed backend services do not import route-layer files", () => {
  for (const relativePath of guardedServiceFiles) {
    const fullPath = path.join(root, relativePath);
    const content = fs.readFileSync(fullPath, "utf8");

    assert.equal(
      content.includes("/routes/") ||
        content.includes("../routes/") ||
        content.includes("../../routes/") ||
        content.includes("routes/api/"),
      false,
      `${relativePath} must not import route-layer files`
    );
  }
});
