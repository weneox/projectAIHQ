import fs from "node:fs";
import path from "node:path";

const roots = [
  "ai-hq-backend/src/services/workspace/setup",
  "ai-hq-backend/tests",
  "ai-hq-frontend/src",
  "ai-hq-frontend/src/test",
];

const setupTokens = [
  "setup",
  "Setup",
  "setupAssistant",
  "SetupAssistant",
  "reviewRoom",
  "ReviewRoom",
  "businessTruth",
  "BusinessTruth",
];

const legacyTokens = [
  "assistantBehaviorDraft",
  "pricingBehavior",
  "locationBehavior",
  "bookingBehavior",
  "contactBehavior",
  "handoffBehavior",
  "greetingStyle",
  "afterHoursBehavior",
  "local_reasoning",
  "wizard",
  "Wizard",
  "questionnaire",
  "Questionnaire",
];

const allowedLegacyReferencePaths = [
  "ai-hq-backend/tests/setup-legacy-token-guard.test.js",
  "ai-hq-backend/tests/setup-assistant-session-payload.test.js",
  "ai-hq-backend/tests/setup-session-payload-business-only.test.js",
  "ai-hq-backend/tests/setup-projection-business-only.test.js",
  "ai-hq-backend/tests/setup-assistant-sanitize-business-only.test.js",
  "ai-hq-frontend/src/lib/setupReviewRoom.js",
  "ai-hq-frontend/src/test/lib/setupReviewRoom.test.js",
];

function isTestFile(file = "") {
  return file.includes("/tests/") || file.includes("/src/test/");
}

function isAllowedLegacyReference(file = "") {
  return allowedLegacyReferencePaths.includes(file);
}

function classifySetupSurface(file = "", legacyHits = []) {
  if (!legacyHits.length) return "canonical";
  if (isAllowedLegacyReference(file)) return "allowed_legacy_guard";
  if (isTestFile(file)) return "legacy_test_fixture";
  return "active_legacy_candidate";
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);

    return /\.(js|jsx|mjs|ts|tsx)$/.test(entry.name)
      ? [full.replace(/\\/g, "/")]
      : [];
  });
}

const files = roots.flatMap(walk);

const matched = files
  .map((file) => {
    const source = fs.readFileSync(file, "utf8");

    const hasSetupToken =
      setupTokens.some((token) => source.includes(token)) ||
      file.toLowerCase().includes("setup");

    const legacyHits = legacyTokens.filter((token) => source.includes(token));

    if (!hasSetupToken && !legacyHits.length) return null;

    return {
      file,
      className: classifySetupSurface(file, legacyHits),
      hasLegacyToken: legacyHits.length > 0,
      legacyHits,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.file.localeCompare(b.file));

console.log("AIHQ setup surface ownership audit");
console.log("");

for (const item of matched) {
  const marker =
    item.className === "active_legacy_candidate"
      ? "ACTIVE_LEGACY?"
      : item.className === "legacy_test_fixture"
        ? "legacy_test"
        : item.className === "allowed_legacy_guard"
          ? "allowed_guard"
          : "setup";

  console.log(`${marker} ${item.file}`);

  if (item.legacyHits.length) {
    console.log(`  legacy tokens: ${item.legacyHits.join(", ")}`);
  }
}

const activeLegacy = matched.filter(
  (item) => item.className === "active_legacy_candidate"
);
const legacyTests = matched.filter((item) => item.className === "legacy_test_fixture");
const allowedGuards = matched.filter((item) => item.className === "allowed_legacy_guard");

console.log("");
console.log(`count=${matched.length}`);
console.log(`legacyCandidates=${matched.filter((item) => item.hasLegacyToken).length}`);
console.log(`activeLegacyCandidates=${activeLegacy.length}`);
console.log(`legacyTestFixtures=${legacyTests.length}`);
console.log(`allowedLegacyGuards=${allowedGuards.length}`);

if (process.env.SETUP_SURFACE_AUDIT_STRICT === "1" && activeLegacy.length) {
  console.error("");
  console.error("Active legacy setup surfaces remain:");
  for (const item of activeLegacy) {
    console.error(`- ${item.file}: ${item.legacyHits.join(", ")}`);
  }
  process.exitCode = 1;
}
