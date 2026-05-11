import test from "node:test";
import assert from "node:assert/strict";

import {
  composeRetrievedTruthAnswerWithModel,
  __test__,
} from "../src/services/businessTruthAnswer/modelComposer.js";

test("grounded model composer sends only approved facts and accepts cited reply", async () => {
  let capturedArgs = null;

  const composed = await composeRetrievedTruthAnswerWithModel({
    text: "Can you automate my website chat?",
    classification: {
      language: "en",
      primaryIntent: "business.services",
      intents: ["business.services"],
    },
    facts: {
      retrieval: {
        ok: true,
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
    createResponse: async (args) => {
      capturedArgs = args;

      return {
        output_text: JSON.stringify({
          shouldReply: true,
          language: "en",
          replyText:
            "Yes. We build website chat, inbox routing, and review-first automation for businesses.",
          factsUsed: ["F1"],
          reasonCode: "",
        }),
      };
    },
  });

  assert.ok(capturedArgs);
  assert.match(capturedArgs.input[0].content, /ONLY from the approved facts/i);
  assert.match(capturedArgs.input[1].content, /Website automation/i);
  assert.match(composed.replyText, /website chat/i);
  assert.match(composed.factsUsed[0], /approved_truth\.services/i);
});

test("grounded model composer rejects unknown fact citations", async () => {
  const composed = await composeRetrievedTruthAnswerWithModel({
    text: "Can you automate my website chat?",
    classification: {
      language: "en",
      primaryIntent: "business.services",
    },
    facts: {
      retrieval: {
        ok: true,
        matches: [
          {
            source: "approved_truth.services",
            title: "Website automation",
            text: "We build website chat and inbox routing.",
            score: 0.91,
          },
        ],
      },
    },
    createResponse: async () => ({
      output_text: JSON.stringify({
        shouldReply: true,
        language: "en",
        replyText: "Yes, we do everything you need.",
        factsUsed: ["F9"],
        reasonCode: "",
      }),
    }),
  });

  assert.equal(composed, null);
});

test("grounded model composer returns null without retrieved facts", async () => {
  const composed = await composeRetrievedTruthAnswerWithModel({
    text: "What do you do?",
    classification: {
      language: "en",
    },
    facts: {
      retrieval: {
        ok: true,
        matches: [],
      },
    },
    createResponse: async () => {
      throw new Error("should not call model");
    },
  });

  assert.equal(composed, null);
});

test("model composer parser validates cited payload", () => {
  const payload = __test__.parseModelPayload({
    output_text: JSON.stringify({
      shouldReply: true,
      language: "en",
      replyText: "Website automation is available.",
      factsUsed: ["F1"],
      reasonCode: "",
    }),
  });

  const validation = __test__.validateModelPayload(payload, [
    {
      id: "F1",
      title: "Website automation",
      text: "Website automation is available.",
      source: "approved_truth.services",
    },
  ]);

  assert.equal(validation.ok, true);
  assert.equal(validation.factsUsed[0], "F1");
});
