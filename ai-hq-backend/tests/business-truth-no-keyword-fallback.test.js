import test from "node:test";
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
