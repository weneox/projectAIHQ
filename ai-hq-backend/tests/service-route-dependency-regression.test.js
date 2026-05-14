import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(testDir, "..");

const guardedServiceFiles = [
  "src/services/channelDelivery.js",
  "src/services/launch/posture.js",
  "src/services/auth/selfServiceWorkspace.js",
  "src/services/auth/canonicalUserAccess.js",
  "src/services/voiceInternalRuntime.js",
];

test("fixed backend services do not import route-layer files", () => {
  for (const relativePath of guardedServiceFiles) {
    const fullPath = path.join(backendRoot, relativePath);
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
