import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const setupRoot = path.resolve("src/services/workspace/setup");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return full.endsWith(".js") ? [full] : [];
  });
}

test("setup source stays free of legacy behavior and keyword inference tokens", () => {
  const forbidden = [
    "assistantBehaviorDraft",
    "pricingBehavior",
    "locationBehavior",
    "bookingBehavior",
    "contactBehavior",
    "handoffBehavior",
    "greetingStyle",
    "afterHoursBehavior",
    "local_reasoning",
    "parseServicesNote",
    "detectPricingMode",
    "buildSourceSignals",
    "setupAssistantAuthorityView",
    "buildSetupAssistantBrainState",
    "buildSetupAssistantFirstPrompt",
  ];

  const violations = [];

  for (const file of walk(setupRoot)) {
    const relative = path.relative(process.cwd(), file).replace(/\\/g, "/");
    const source = fs.readFileSync(file, "utf8");

    for (const token of forbidden) {
      if (source.includes(token)) {
        violations.push(`${relative}: ${token}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
