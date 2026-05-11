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

index = index.replace(
  `export async function answerFromApprovedTruth({
  text = "",
  runtimeGrounding = {},
  profile = {},
  fallbackLanguage = "az",
  recentMessages = [],
  conversationContext = {},
  threadState = null,
} = {}) {`,
  `export async function answerFromApprovedTruth({
  text = "",
  runtimeGrounding = {},
  profile = {},
  fallbackLanguage = "az",
  recentMessages = [],
  conversationContext = {},
  threadState = null,
  classifyIntent = classifyApprovedTruthIntentWithModel,
  detectRecovery = detectConversationRecoveryWithModel,
  retrieveFacts = retrieveApprovedTruthFacts,
  composeWithModel = composeRetrievedTruthAnswerWithModel,
} = {}) {`
);

index = index.replace(
  `  const recoveryDetection = await detectConversationRecoveryWithModel({`,
  `  const recoveryDetection = await detectRecovery({`
);

index = index.replace(
  `  const classification = await classifyApprovedTruthIntentWithModel({`,
  `  const classification = await classifyIntent({`
);

index = index.replace(
  `  const retrieval = await retrieveApprovedTruthFacts({`,
  `  const retrieval = await retrieveFacts({`
);

index = index.replace(
  `  let composed = await composeRetrievedTruthAnswerWithModel({`,
  `  let composed = await composeWithModel({`
);

write(indexPath, index);

write("ai-hq-backend/tests/business-truth-grounding-orchestration.test.js", `import test from "node:test";
import assert from "node:assert/strict";

import { answerFromApprovedTruth } from "../src/services/businessTruthAnswer/index.js";

function noRecovery() {
  return {
    isRecoveryComplaint: false,
  };
}

test("factual approved truth answer returns null when retrieval has no grounding", async () => {
  const answer = await answerFromApprovedTruth({
    text: "Can you build automated website conversations?",
    runtimeGrounding: {
      raw: {
        projection: {
          services_json: [
            {
              name: "Website automation",
              description: "Old field fallback must not answer without retrieval.",
            },
          ],
        },
      },
    },
    detectRecovery: async () => noRecovery(),
    classifyIntent: async () => ({
      shouldHandle: true,
      primaryIntent: "business.services",
      intents: ["business.services"],
      language: "en",
      confidence: 0.9,
      needsApprovedTruth: true,
      userMeaning: "customer asks about services",
    }),
    retrieveFacts: async () => ({
      ok: false,
      method: "approved_truth_embedding_retrieval_v1",
      reasonCode: "embedding_retrieval_failed",
      matches: [],
    }),
    composeWithModel: async () => null,
  });

  assert.equal(answer, null);
});

test("safe direct approved truth greeting still answers without retrieval grounding", async () => {
  const answer = await answerFromApprovedTruth({
    text: "Hello",
    detectRecovery: async () => noRecovery(),
    classifyIntent: async () => ({
      shouldHandle: true,
      primaryIntent: "smalltalk.greeting",
      intents: ["smalltalk.greeting"],
      language: "en",
      confidence: 0.95,
      needsApprovedTruth: false,
      userMeaning: "greeting",
    }),
    retrieveFacts: async () => ({
      ok: false,
      method: "approved_truth_embedding_retrieval_v1",
      reasonCode: "approved_truth_corpus_empty",
      matches: [],
    }),
    composeWithModel: async () => null,
  });

  assert.ok(answer);
  assert.equal(answer.shouldReply, true);
  assert.match(answer.replyText, /hello/i);
});

test("grounded model composer answer is returned for factual approved truth", async () => {
  const answer = await answerFromApprovedTruth({
    text: "Can you automate website chat?",
    detectRecovery: async () => noRecovery(),
    classifyIntent: async () => ({
      shouldHandle: true,
      primaryIntent: "business.services",
      intents: ["business.services"],
      language: "en",
      confidence: 0.9,
      needsApprovedTruth: true,
      userMeaning: "customer asks about services",
    }),
    retrieveFacts: async () => ({
      ok: true,
      method: "approved_truth_embedding_retrieval_v1",
      bestScore: 0.91,
      matches: [
        {
          source: "approved_truth.services",
          title: "Website automation",
          text: "We build website chat, inbox routing, and review-first automation.",
          score: 0.91,
        },
      ],
    }),
    composeWithModel: async () => ({
      replyText:
        "Yes. We build website chat, inbox routing, and review-first automation.",
      factsUsed: [
        "approved_truth.services: Website automation: We build website chat, inbox routing, and review-first automation.",
      ],
      diagnostics: {
        composer: "approved_truth_grounded_model_v1",
      },
    }),
  });

  assert.ok(answer);
  assert.equal(answer.shouldReply, true);
  assert.match(answer.replyText, /website chat/i);
  assert.match(answer.groundedFactsUsed[0], /approved_truth\\.services/i);
  assert.equal(answer.diagnostics.retrievalOk, true);
  assert.equal(answer.diagnostics.retrievalMatchCount, 1);
});
`);

console.log("patched approved truth grounding orchestration tests");
