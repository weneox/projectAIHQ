const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, content) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), content, "utf8");
}

write("ai-hq-backend/src/services/businessTruthAnswer/modelComposer.js", `import OpenAI from "openai";

import { cfg } from "../../config.js";
import { arr, normalizeIsoLanguage, obj, s, uniqStrings } from "./normalize.js";

let openaiSingleton = null;

function lower(value = "") {
  return s(value).toLowerCase();
}

function getOpenAI() {
  const key = s(cfg?.ai?.openaiApiKey || "");
  if (!key) return null;

  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey: key });
  }

  return openaiSingleton;
}

function modelName() {
  return s(process.env.AIHQ_APPROVED_TRUTH_COMPOSER_MODEL) || s(cfg?.ai?.openaiModel, "gpt-5");
}

function maxOutputTokens() {
  const value = Number(process.env.AIHQ_APPROVED_TRUTH_COMPOSER_MAX_TOKENS || 420);
  return Number.isFinite(value) ? Math.max(180, Math.min(900, value)) : 420;
}

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      shouldReply: { type: "boolean" },
      language: { type: "string" },
      replyText: { type: "string" },
      factsUsed: {
        type: "array",
        items: { type: "string" },
      },
      reasonCode: { type: "string" },
    },
    required: ["shouldReply", "language", "replyText", "factsUsed", "reasonCode"],
  };
}

function buildTextFormat(model = "") {
  const isGpt5 = lower(model).startsWith("gpt-5");

  return {
    type: "json_schema",
    name: "approved_truth_grounded_reply",
    strict: true,
    schema: buildSchema(),
    ...(isGpt5 ? { verbosity: "low" } : {}),
  };
}

function cleanReply(value = "") {
  return s(value)
    .replace(/\\s+/g, " ")
    .replace(/\\s+([,.!?؟:;])/g, "$1")
    .trim();
}

function truncate(value = "", limit = 900) {
  const text = cleanReply(value);
  if (!text || text.length <= limit) return text;
  return text.slice(0, Math.max(0, limit - 1)).trim() + "…";
}

function normalizeMatch(match = {}, index = 0) {
  const safe = obj(match);
  const title = s(safe.title || "Approved fact");
  const text = s(safe.text || safe.value || safe.summary);
  if (!title && !text) return null;

  return {
    id: "F" + String(index + 1),
    title,
    text,
    source: s(safe.source || "approved_truth"),
    score: Number(safe.score || 0),
  };
}

function buildGroundingFacts(facts = {}) {
  return arr(facts?.retrieval?.matches)
    .map(normalizeMatch)
    .filter(Boolean)
    .filter((item) => s(item.text || item.title))
    .slice(0, 5);
}

function buildSystemPrompt(language = "az") {
  return [
    "You are a public website assistant for a business.",
    "You must answer ONLY from the approved facts provided by the system.",
    "Do not invent prices, services, policies, availability, addresses, phone numbers, or promises.",
    "Do not mention internal systems, embeddings, retrieval, vectors, runtime, projections, or AIHQ internals.",
    "If the approved facts do not answer the customer, return shouldReply=false.",
    "Use a natural, short, helpful customer-facing tone.",
    "Answer in the customer's language when clear; otherwise use this language: " + normalizeIsoLanguage(language, "az") + ".",
  ].join("\\n");
}

function buildUserPrompt({ text = "", classification = {}, groundingFacts = [] } = {}) {
  return JSON.stringify(
    {
      customerMessage: s(text),
      detectedIntent: s(classification.primaryIntent || arr(classification.intents)[0] || ""),
      targetLanguage: normalizeIsoLanguage(classification.language, "az"),
      approvedFacts: groundingFacts.map((fact) => ({
        id: fact.id,
        title: fact.title,
        text: fact.text,
        source: fact.source,
      })),
      outputRules: {
        replyText: "1-3 short sentences. No markdown. No bullet list unless the customer asks for a list.",
        factsUsed: "Use only IDs from approvedFacts, for example F1 or F2.",
        shouldReply: "false if approvedFacts do not answer the customer.",
      },
    },
    null,
    2
  );
}

function parseJsonLoose(value = "") {
  const text = s(value);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {}

  const objectMatch = text.match(/\\{[\\s\\S]*\\}/);
  if (!objectMatch) return null;

  try {
    return JSON.parse(objectMatch[0]);
  } catch {
    return null;
  }
}

function extractText(response = {}) {
  if (s(response?.output_text)) return s(response.output_text);

  for (const outputItem of arr(response?.output)) {
    for (const contentItem of arr(outputItem?.content)) {
      if (s(contentItem?.text)) return s(contentItem.text);
      if (s(contentItem?.output_text)) return s(contentItem.output_text);
      if (contentItem?.parsed && typeof contentItem.parsed === "object") {
        return JSON.stringify(contentItem.parsed);
      }
    }
  }

  return "";
}

function parseModelPayload(response = {}) {
  if (response?.output_parsed && typeof response.output_parsed === "object") {
    return response.output_parsed;
  }

  if (response?.parsed && typeof response.parsed === "object") {
    return response.parsed;
  }

  return parseJsonLoose(extractText(response));
}

function validateModelPayload(payload = {}, groundingFacts = []) {
  const safe = obj(payload);
  if (safe.shouldReply !== true) {
    return {
      ok: false,
      reasonCode: s(safe.reasonCode || "model_declined_to_answer"),
    };
  }

  const replyText = truncate(safe.replyText, 900);
  if (!replyText || replyText.length < 2) {
    return {
      ok: false,
      reasonCode: "model_reply_empty",
    };
  }

  const allowedFactIds = new Set(groundingFacts.map((fact) => fact.id));
  const factsUsed = uniqStrings(arr(safe.factsUsed).map((item) => s(item)));

  if (!factsUsed.length || factsUsed.some((id) => !allowedFactIds.has(id))) {
    return {
      ok: false,
      reasonCode: "model_fact_citation_invalid",
    };
  }

  return {
    ok: true,
    replyText,
    factsUsed,
    language: normalizeIsoLanguage(safe.language, "az"),
  };
}

async function defaultCreateResponse(args = {}) {
  const openai = getOpenAI();

  if (!openai) {
    const error = new Error("OpenAI API key is missing for approved truth composer.");
    error.code = "openai_api_key_missing";
    throw error;
  }

  return openai.responses.create(args);
}

export async function composeRetrievedTruthAnswerWithModel({
  text = "",
  classification = {},
  facts = {},
  createResponse = defaultCreateResponse,
} = {}) {
  const groundingFacts = buildGroundingFacts(facts);
  if (!groundingFacts.length) return null;

  const model = modelName();
  const isGpt5 = lower(model).startsWith("gpt-5");

  try {
    const response = await createResponse({
      model,
      ...(isGpt5 ? { reasoning: { effort: "minimal" } } : {}),
      max_output_tokens: maxOutputTokens(),
      text: {
        format: buildTextFormat(model),
      },
      input: [
        {
          role: "system",
          content: buildSystemPrompt(classification.language),
        },
        {
          role: "user",
          content: buildUserPrompt({
            text,
            classification,
            groundingFacts,
          }),
        },
      ],
    });

    const parsed = parseModelPayload(response);
    const validated = validateModelPayload(parsed, groundingFacts);

    if (!validated.ok) return null;

    const factsById = new Map(groundingFacts.map((fact) => [fact.id, fact]));

    return {
      replyText: validated.replyText,
      factsUsed: validated.factsUsed.map((id) => {
        const fact = factsById.get(id);
        return [fact?.source, fact?.title, fact?.text]
          .map((part) => s(part))
          .filter(Boolean)
          .join(": ");
      }),
      diagnostics: {
        composer: "approved_truth_grounded_model_v1",
        model,
        factIds: validated.factsUsed,
      },
    };
  } catch {
    return null;
  }
}

export const __test__ = {
  buildGroundingFacts,
  buildSystemPrompt,
  buildUserPrompt,
  parseModelPayload,
  validateModelPayload,
};
`);

let index = read("ai-hq-backend/src/services/businessTruthAnswer/index.js");

if (!index.includes("./modelComposer.js")) {
  index = index.replace(
    'import { retrieveApprovedTruthFacts } from "./retrieval.js";',
    'import { retrieveApprovedTruthFacts } from "./retrieval.js";\nimport { composeRetrievedTruthAnswerWithModel } from "./modelComposer.js";'
  );
}

const oldBlock = `  const composed = composeApprovedTruthAnswer({
    classification,
    facts,
  });`;

const newBlock = `  let composed = await composeRetrievedTruthAnswerWithModel({
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

const searchStart = index.indexOf("  const retrieval = await retrieveApprovedTruthFacts({");
if (searchStart === -1) {
  throw new Error("retrieval block not found. Run the embedding retrieval patch first.");
}

const blockIndex = index.indexOf(oldBlock, searchStart);
if (blockIndex === -1) {
  if (!index.includes("composeRetrievedTruthAnswerWithModel({")) {
    throw new Error("main compose block not found");
  }
} else {
  index = index.slice(0, blockIndex) + newBlock + index.slice(blockIndex + oldBlock.length);
}

write("ai-hq-backend/src/services/businessTruthAnswer/index.js", index);

write("ai-hq-backend/tests/business-truth-model-composer.test.js", `import test from "node:test";
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
  assert.match(composed.factsUsed[0], /approved_truth\\.services/i);
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
`);

console.log("patched grounded approved truth model composer v1");
