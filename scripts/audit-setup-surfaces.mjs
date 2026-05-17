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
      hasLegacyToken: legacyHits.length > 0,
      legacyHits,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.file.localeCompare(b.file));

console.log("AIHQ setup surface ownership audit");
console.log("");

for (const item of matched) {
  const marker = item.hasLegacyToken ? "LEGACY?" : "setup";
  console.log(`${marker} ${item.file}`);

  if (item.legacyHits.length) {
    console.log(`  legacy tokens: ${item.legacyHits.join(", ")}`);
  }
}

console.log("");
console.log(`count=${matched.length}`);
console.log(`legacyCandidates=${matched.filter((item) => item.hasLegacyToken).length}`);
