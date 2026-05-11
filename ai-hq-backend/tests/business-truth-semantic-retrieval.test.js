import test from "node:test";
import assert from "node:assert/strict";

import { retrieveApprovedTruthFacts } from "../src/services/businessTruthAnswer/retrieval.js";
import { composeApprovedTruthAnswer } from "../src/services/businessTruthAnswer/composer.js";

test("approved truth semantic retrieval ranks matching service details", () => {
  const runtimeGrounding = {
    raw: {
      projection: {
        services_json: [
          {
            name: "Website automation",
            description: "We build website chat, inbox routing, and review-first automation for businesses.",
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

  const facts = {
    services: ["Website automation", "Social content"],
  };

  const retrieval = retrieveApprovedTruthFacts({
    text: "Do you build website chat and inbox automation?",
    facts,
    runtimeGrounding,
    classification: {
      primaryIntent: "business.services",
    },
  });

  assert.equal(retrieval.ok, true);
  assert.ok(retrieval.matches.length >= 1);
  assert.equal(retrieval.matches[0].title, "Website automation");
  assert.match(retrieval.matches[0].text, /inbox routing/i);
});

test("approved truth composer uses retrieved service details for real answer", () => {
  const facts = {
    services: ["Website automation"],
    retrieval: {
      bestScore: 6,
      matches: [
        {
          source: "approved_truth.services",
          title: "Website automation",
          text: "We build website chat, inbox routing, and review-first automation for businesses.",
          score: 6,
        },
      ],
    },
  };

  const composed = composeApprovedTruthAnswer({
    classification: {
      language: "en",
      primaryIntent: "business.services",
      intents: ["business.services"],
      shouldHandle: true,
    },
    facts,
  });

  assert.match(composed.replyText, /Website automation/i);
  assert.match(composed.replyText, /inbox routing/i);
  assert.match(composed.factsUsed[0], /approved_truth\.services/i);
});

test("approved truth retrieval does not match unrelated customer question", () => {
  const retrieval = retrieveApprovedTruthFacts({
    text: "Do you sell cars?",
    facts: {
      services: ["Website chat"],
    },
    runtimeGrounding: {
      raw: {
        projection: {
          services_json: [
            {
              name: "Website chat",
              description: "AIHQ captures website messages and routes them into the inbox.",
            },
          ],
        },
      },
    },
  });

  assert.equal(retrieval.matches.length, 0);
});
