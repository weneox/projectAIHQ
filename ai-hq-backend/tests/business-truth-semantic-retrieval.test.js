import test from "node:test";
import assert from "node:assert/strict";

import { retrieveApprovedTruthFacts } from "../src/services/businessTruthAnswer/retrieval.js";
import { composeApprovedTruthAnswer } from "../src/services/businessTruthAnswer/composer.js";

function fakeEmbeddingForText(text = "") {
  const value = String(text || "").toLowerCase();

  if (value.includes("unrelated car question") || value.includes("sell cars")) {
    return [0, 0, 1];
  }

  if (value.includes("social content")) {
    return [0, 1, 0];
  }

  return [1, 0, 0];
}

async function fakeEmbedTexts(texts = []) {
  return texts.map(fakeEmbeddingForText);
}

test("embedding retrieval ranks semantically matching approved service details", async () => {
  const runtimeGrounding = {
    raw: {
      projection: {
        services_json: [
          {
            name: "Website automation",
            description:
              "We build website chat, inbox routing, and review-first automation for businesses.",
            pricing: "Pricing depends on the approved project scope.",
          },
          {
            name: "Social content",
            description: "We prepare social media post ideas and captions.",
          },
        ],
      },
    },
  };

  const retrieval = await retrieveApprovedTruthFacts({
    text: "Customer wants automated website conversations",
    runtimeGrounding,
    embedTexts: fakeEmbedTexts,
    minScore: 0.5,
  });

  assert.equal(retrieval.ok, true);
  assert.ok(retrieval.matches.length >= 1);
  assert.equal(retrieval.matches[0].title, "Website automation");
  assert.match(retrieval.matches[0].text, /inbox routing/i);
});

test("approved truth composer uses retrieved service details for real answer", () => {
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
        ok: true,
        method: "approved_truth_embedding_retrieval_v1",
        bestScore: 0.91,
        matches: [
          {
            source: "approved_truth.services",
            title: "Website automation",
            text:
              "We build website chat, inbox routing, and review-first automation for businesses.",
            score: 0.91,
          },
        ],
      },
    },
  });

  assert.match(composed.replyText, /Website automation/i);
  assert.match(composed.replyText, /inbox routing/i);
  assert.match(composed.factsUsed[0], /approved_truth\.services/i);
});

test("embedding retrieval returns no match for unrelated semantic vector", async () => {
  const retrieval = await retrieveApprovedTruthFacts({
    text: "Unrelated car question",
    runtimeGrounding: {
      raw: {
        projection: {
          services_json: [
            {
              name: "Website chat",
              description:
                "AIHQ captures website messages and routes them into the inbox.",
            },
          ],
        },
      },
    },
    embedTexts: fakeEmbedTexts,
    minScore: 0.5,
  });

  assert.equal(retrieval.ok, true);
  assert.equal(retrieval.matches.length, 0);
});
