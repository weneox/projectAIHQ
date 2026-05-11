const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, "utf8");
}

const indexPath = "ai-hq-backend/src/services/businessTruthAnswer/index.js";
let index = read(indexPath);

if (!index.includes("function isSafeDirectApprovedTruthIntent")) {
  index = index.replace(
    `function buildAnswerPayload({`,
    `const SAFE_DIRECT_APPROVED_TRUTH_INTENTS = new Set([
  "smalltalk.greeting",
  "smalltalk.gratitude",
  "clarify.unclear",
  "support.request",
  "handoff.request",
]);

function isSafeDirectApprovedTruthIntent(classification = {}) {
  const intents = arr(classification.intents);
  const primaryIntent = s(classification.primaryIntent);
  const candidates = intents.length ? intents : [primaryIntent];

  return candidates.some((intent) =>
    SAFE_DIRECT_APPROVED_TRUTH_INTENTS.has(s(intent))
  );
}

function retrievalHasGrounding(retrieval = {}) {
  return retrieval?.ok === true && arr(retrieval.matches).length > 0;
}

function buildAnswerPayload({`
  );
}

const oldBlock = `  let composed = await composeRetrievedTruthAnswerWithModel({
    text,
    classification,
    facts,
  });

  if (!composed) {
    composed = composeApprovedTruthAnswer({
      classification,
      facts,
    });
  }`;

const newBlock = `  let composed = await composeRetrievedTruthAnswerWithModel({
    text,
    classification,
    facts,
  });

  if (!composed && isSafeDirectApprovedTruthIntent(classification)) {
    composed = composeApprovedTruthAnswer({
      classification,
      facts,
    });
  }

  if (!composed && !retrievalHasGrounding(retrieval)) {
    return null;
  }

  if (!composed) {
    composed = composeApprovedTruthAnswer({
      classification,
      facts,
    });
  }`;

if (index.includes(oldBlock)) {
  index = index.replace(oldBlock, newBlock);
} else if (!index.includes("retrievalHasGrounding(retrieval)")) {
  throw new Error("compose fallback block not found");
}

write(indexPath, index);

write("ai-hq-backend/tests/business-truth-no-keyword-fallback.test.js", `import test from "node:test";
import assert from "node:assert/strict";

import { composeApprovedTruthAnswer } from "../src/services/businessTruthAnswer/composer.js";

test("plain composer still supports safe direct greeting only when called directly", () => {
  const composed = composeApprovedTruthAnswer({
    classification: {
      language: "en",
      primaryIntent: "smalltalk.greeting",
      intents: ["smalltalk.greeting"],
      shouldHandle: true,
    },
    facts: {
      retrieval: {
        ok: false,
        matches: [],
      },
    },
  });

  assert.match(composed.replyText, /Hello/i);
});

test("plain composer is not the smart factual path without retrieval", () => {
  const composed = composeApprovedTruthAnswer({
    classification: {
      language: "en",
      primaryIntent: "business.services",
      intents: ["business.services"],
      shouldHandle: true,
    },
    facts: {
      services: ["Website automation"],
      retrieval: {
        ok: false,
        reasonCode: "embedding_retrieval_failed",
        matches: [],
      },
    },
  });

  // This documents the old fallback behavior so the orchestration layer can block it.
  assert.match(composed.replyText, /Website automation/i);
});
`);

console.log("patched factual answers to require retrieval grounding");
