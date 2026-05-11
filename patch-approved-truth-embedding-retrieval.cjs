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

write("ai-hq-backend/src/services/businessTruthAnswer/retrieval.js", `import OpenAI from "openai";

import { cfg } from "../../config.js";
import { arr, firstText, obj, s, uniqStrings } from "./normalize.js";

let openaiSingleton = null;

function getOpenAI() {
  const key = s(cfg?.ai?.openaiApiKey || "");
  if (!key) return null;

  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey: key });
  }

  return openaiSingleton;
}

function embeddingModel() {
  return (
    s(process.env.AIHQ_APPROVED_TRUTH_EMBEDDING_MODEL) ||
    s(process.env.OPENAI_EMBEDDING_MODEL) ||
    "text-embedding-3-small"
  );
}

function visibleInAi(item = {}) {
  if (item?.enabled === false) return false;
  if (item?.active === false) return false;
  if (item?.visibleInAi === false) return false;
  if (item?.visible_in_ai === false) return false;
  if (item?.public === false) return false;
  if (item?.isPublic === false) return false;
  if (item?.is_public === false) return false;
  return true;
}

function cleanText(value = "") {
  return s(value)
    .replace(/\\s+/g, " ")
    .trim();
}

function compactText(...values) {
  return uniqStrings(
    values
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .map((value) => {
        if (typeof value === "string" || typeof value === "number") {
          return cleanText(value);
        }

        if (value && typeof value === "object") {
          return cleanText(
            value.text ||
              value.answer ||
              value.description ||
              value.summary ||
              value.value ||
              value.details ||
              value.content ||
              value.response ||
              ""
          );
        }

        return "";
      })
      .filter(Boolean)
  ).join(" — ");
}

function resolveProjection(profile = {}, runtimeGrounding = {}) {
  const rawProfile = obj(profile?.raw);
  const rawGrounding = obj(runtimeGrounding?.raw);

  return obj(
    rawProfile.projection ||
      profile?.projection ||
      runtimeGrounding?.projection ||
      rawGrounding.projection
  );
}

function pushCandidate(target, candidate = {}) {
  const title = cleanText(candidate.title || candidate.name || candidate.label);
  const text = cleanText(
    candidate.text || candidate.description || candidate.summary || candidate.value
  );

  if (!title && !text) return;

  target.push({
    id: cleanText(candidate.id || candidate.key || title || text).slice(0, 180),
    type: cleanText(candidate.type || "fact"),
    title,
    text: text || title,
    source: cleanText(candidate.source || "approved_truth"),
  });
}

export function collectApprovedTruthCorpus({
  facts = {},
  runtimeGrounding = {},
  profile = {},
} = {}) {
  const corpus = [];
  const projection = resolveProjection(profile, runtimeGrounding);

  pushCandidate(corpus, {
    type: "summary",
    title: "Business summary",
    text: firstText(facts.summary, runtimeGrounding.businessSummary, profile.summary),
    source: "approved_truth.summary",
  });

  pushCandidate(corpus, {
    type: "pricing",
    title: "Pricing",
    text: facts.pricing,
    source: "approved_truth.pricing",
  });

  pushCandidate(corpus, {
    type: "booking",
    title: "Booking",
    text: facts.booking,
    source: "approved_truth.booking",
  });

  pushCandidate(corpus, {
    type: "contact",
    title: "Phone",
    text: facts.phone,
    source: "approved_truth.contact",
  });

  pushCandidate(corpus, {
    type: "contact",
    title: "Email",
    text: facts.email,
    source: "approved_truth.contact",
  });

  pushCandidate(corpus, {
    type: "contact",
    title: "Website",
    text: facts.website,
    source: "approved_truth.contact",
  });

  pushCandidate(corpus, {
    type: "contact",
    title: "Address",
    text: facts.address,
    source: "approved_truth.contact",
  });

  for (const item of [
    ...arr(projection.services_json || projection.servicesJson),
    ...arr(runtimeGrounding.serviceCatalog),
    ...arr(runtimeGrounding.services),
  ]) {
    const x = obj(item);
    if (!visibleInAi(x)) continue;

    const title = cleanText(x.name || x.title || x.serviceName || x.service_name || "Service");
    const text = compactText(
      title,
      x.description,
      x.summary,
      x.details,
      x.pricing,
      x.price,
      x.pricingText,
      x.pricing_text,
      x.responseMode,
      x.response_mode,
      x.contactCaptureMode,
      x.contact_capture_mode
    );

    pushCandidate(corpus, {
      type: "service",
      title,
      text,
      source: "approved_truth.services",
    });
  }

  for (const item of [
    ...arr(projection.products_json || projection.productsJson),
    ...arr(runtimeGrounding.products),
  ]) {
    const x = obj(item);
    if (!visibleInAi(x)) continue;

    const title = cleanText(x.name || x.title || x.productName || x.product_name || "Product");
    const text = compactText(title, x.description, x.summary, x.details, x.pricing, x.price);

    pushCandidate(corpus, {
      type: "product",
      title,
      text,
      source: "approved_truth.products",
    });
  }

  for (const item of arr(runtimeGrounding.knowledgeEntries)) {
    const x = obj(item);
    if (!visibleInAi(x)) continue;

    const title = cleanText(x.title || x.question || x.key || "Knowledge");
    const text = compactText(title, x.question, x.answer, x.text, x.content, x.value);

    pushCandidate(corpus, {
      type: "knowledge",
      title,
      text,
      source: "approved_truth.knowledge",
    });
  }

  for (const item of arr(runtimeGrounding.responsePlaybooks)) {
    const x = obj(item);
    if (!visibleInAi(x)) continue;

    const title = cleanText(x.title || x.name || x.intent || "Response playbook");
    const text = compactText(title, x.intent, x.trigger, x.response, x.answer, x.script);

    pushCandidate(corpus, {
      type: "playbook",
      title,
      text,
      source: "approved_truth.playbooks",
    });
  }

  return corpus.slice(0, 80);
}

function vector(value = []) {
  return arr(value).map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function cosineSimilarity(a = [], b = []) {
  const x = vector(a);
  const y = vector(b);
  const len = Math.min(x.length, y.length);

  if (!len) return 0;

  let dot = 0;
  let xNorm = 0;
  let yNorm = 0;

  for (let i = 0; i < len; i += 1) {
    dot += x[i] * y[i];
    xNorm += x[i] * x[i];
    yNorm += y[i] * y[i];
  }

  if (!xNorm || !yNorm) return 0;
  return dot / (Math.sqrt(xNorm) * Math.sqrt(yNorm));
}

function candidateEmbeddingText(candidate = {}) {
  return [
    candidate.type,
    candidate.title,
    candidate.text,
  ]
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join("\\n");
}

async function defaultEmbedTexts(texts = []) {
  const openai = getOpenAI();

  if (!openai) {
    const error = new Error("OpenAI API key is missing for approved truth embeddings.");
    error.code = "openai_api_key_missing";
    throw error;
  }

  const response = await openai.embeddings.create({
    model: embeddingModel(),
    input: arr(texts).map((item) => cleanText(item)).filter(Boolean),
  });

  return arr(response?.data).map((item) => vector(item.embedding));
}

export async function retrieveApprovedTruthFacts({
  text = "",
  facts = {},
  runtimeGrounding = {},
  profile = {},
  limit = 5,
  minScore = 0.32,
  embedTexts = defaultEmbedTexts,
} = {}) {
  const query = cleanText(text);
  const corpus = collectApprovedTruthCorpus({ facts, runtimeGrounding, profile });

  if (!query) {
    return {
      ok: false,
      method: "approved_truth_embedding_retrieval_v1",
      reasonCode: "empty_query",
      corpusSize: corpus.length,
      matches: [],
    };
  }

  if (!corpus.length) {
    return {
      ok: false,
      method: "approved_truth_embedding_retrieval_v1",
      reasonCode: "approved_truth_corpus_empty",
      corpusSize: 0,
      matches: [],
    };
  }

  try {
    const inputs = [query, ...corpus.map(candidateEmbeddingText)];
    const embeddings = await embedTexts(inputs);
    const queryEmbedding = embeddings[0];

    const matches = corpus
      .map((candidate, index) => ({
        ...candidate,
        score: cosineSimilarity(queryEmbedding, embeddings[index + 1]),
      }))
      .filter((candidate) => candidate.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Number(limit || 5)));

    return {
      ok: true,
      method: "approved_truth_embedding_retrieval_v1",
      model: embeddingModel(),
      corpusSize: corpus.length,
      bestScore: Number(matches[0]?.score || 0),
      confidence: Number(matches[0]?.score || 0),
      matches,
    };
  } catch (error) {
    return {
      ok: false,
      method: "approved_truth_embedding_retrieval_v1",
      reasonCode: s(error?.code || "embedding_retrieval_failed"),
      message: s(error?.message),
      corpusSize: corpus.length,
      matches: [],
    };
  }
}

export const __test__ = {
  candidateEmbeddingText,
  cleanText,
  collectApprovedTruthCorpus,
  cosineSimilarity,
};
`);

write("ai-hq-backend/src/services/businessTruthAnswer/index.js", `import { classifyApprovedTruthIntentWithModel } from "./classifier.js";
import { composeApprovedTruthAnswer } from "./composer.js";
import { localizeApprovedTruthAnswer } from "./localizer.js";
import { detectConversationRecoveryWithModel } from "./recovery.js";
import { detectRepeatedApprovedTruthRequest } from "./repeat.js";
import { resolveApprovedTruthFacts } from "./resolver.js";
import { retrieveApprovedTruthFacts } from "./retrieval.js";
import { validateApprovedTruthAnswer } from "./validator.js";
import { arr, normalizeIsoLanguage, s } from "./normalize.js";

function buildAnswerPayload({
  classification = {},
  composed = {},
  localized = {},
  source = "approved_truth_answer_engine",
  extraDiagnostics = {},
} = {}) {
  const finalReplyText = s(localized.replyText || composed.replyText);
  const validation = validateApprovedTruthAnswer({
    replyText: finalReplyText,
  });

  if (!validation.ok) return null;

  const language = normalizeIsoLanguage(
    localized.language || classification.language,
    "az"
  );

  return {
    language,
    understoodIntent: s(classification.primaryIntent || "approved_truth_fact"),
    detectedService: "",
    customerGoal: "approved_truth_or_safe_direct",
    answerFirst: finalReplyText,
    nextQuestion: "",
    replyText: finalReplyText,
    missingInformation: [],
    groundedFactsUsed: arr(composed.factsUsed),
    shouldAskQuestion: false,
    shouldCreateLead: false,
    shouldHandoff: false,
    handoffReason: "",
    handoffPriority: "normal",
    confidence: classification.confidence,
    leadScore: 0,
    askCategory: "approved_truth",
    stage: "answer",
    replyStyle: "direct",
    noReply: false,
    shouldReply: true,
    source,
    diagnostics: {
      intents: arr(classification.intents),
      userMeaning: s(classification.userMeaning),
      needsApprovedTruth: classification.needsApprovedTruth === true,
      localized: localized.localized === true,
      localizationReason: s(localized.reason),
      targetLanguage: language,
      ...extraDiagnostics,
    },
  };
}

async function answerConversationRecovery({
  text = "",
  detection = {},
  facts = {},
} = {}) {
  const classification = {
    primaryIntent: "support.request",
    intents: ["support.request"],
    language: normalizeIsoLanguage(detection.language, "az"),
    confidence: detection.confidence,
    needsApprovedTruth: false,
    userMeaning: "conversation_recovery_or_missing_reply_complaint",
    shouldHandle: true,
  };

  const composed = composeApprovedTruthAnswer({
    classification,
    facts,
  });

  const localized = await localizeApprovedTruthAnswer({
    replyText: composed.replyText,
    targetLanguage: classification.language,
    customerText: text,
    classification,
    facts,
  });

  return buildAnswerPayload({
    classification,
    composed,
    localized,
    source: "conversation_recovery_guard",
    extraDiagnostics: {
      recoveryGuard: true,
      recoveryReason: s(detection.reason),
    },
  });
}

export async function answerFromApprovedTruth({
  text = "",
  runtimeGrounding = {},
  profile = {},
  fallbackLanguage = "az",
  recentMessages = [],
  conversationContext = {},
  threadState = null,
} = {}) {
  const baseFacts = resolveApprovedTruthFacts({
    runtimeGrounding,
    profile,
  });

  const recoveryDetection = await detectConversationRecoveryWithModel({
    text,
    fallbackLanguage,
    recentMessages,
    profile,
    conversationContext,
    threadState,
  });

  if (recoveryDetection.isRecoveryComplaint) {
    return answerConversationRecovery({
      text,
      detection: recoveryDetection,
      facts: baseFacts,
    });
  }

  const classification = await classifyApprovedTruthIntentWithModel({
    text,
    fallbackLanguage,
    recentMessages,
    profile,
    conversationContext,
    threadState,
  });

  if (!classification.shouldHandle) {
    return null;
  }

  const retrieval = await retrieveApprovedTruthFacts({
    text,
    facts: baseFacts,
    runtimeGrounding,
    profile,
  });

  const facts = {
    ...baseFacts,
    retrieval,
  };

  const composed = composeApprovedTruthAnswer({
    classification,
    facts,
  });

  const repeatContext = detectRepeatedApprovedTruthRequest({
    classification,
    facts,
    recentMessages,
  });

  const localized = await localizeApprovedTruthAnswer({
    replyText: composed.replyText,
    targetLanguage: classification.language,
    customerText: text,
    classification,
    facts,
    repeatContext,
  });

  return buildAnswerPayload({
    classification,
    composed,
    localized,
    source: "approved_truth_answer_engine",
    extraDiagnostics: {
      retrievalMethod: s(retrieval.method),
      retrievalOk: retrieval.ok === true,
      retrievalReasonCode: s(retrieval.reasonCode),
      retrievalBestScore: Number(retrieval.bestScore || 0),
      retrievalMatchCount: arr(retrieval.matches).length,
      repeatDetected: repeatContext.isRepeat === true,
      repeatReason: s(repeatContext.reason),
      repeatCoverageScore: repeatContext.coverageScore || 0,
      repeatPreviousMessageId: s(repeatContext.previousMessageId),
    },
  });
}
`);

let composer = read("ai-hq-backend/src/services/businessTruthAnswer/composer.js");

if (!composer.includes("function buildRetrievedTruthReply")) {
  composer = composer.replace(
    "function behaviorFactParts(facts = {}) {",
    `function truncateRetrievedText(value = "", limit = 440) {
  const text = s(value).replace(/\\s+/g, " ").trim();
  if (!text || text.length <= limit) return text;
  return text.slice(0, Math.max(0, limit - 1)).trim() + "…";
}

function formatRetrievedMatch(match = {}) {
  const title = s(match.title);
  const text = truncateRetrievedText(match.text);

  if (!title && !text) return "";
  if (!title) return sentence(text);

  const cleanTitle = title.toLowerCase();
  const cleanText = text.toLowerCase();

  if (cleanText.startsWith(cleanTitle)) {
    return sentence(text);
  }

  return sentence(title + ": " + text);
}

function buildRetrievedTruthReply({ facts = {} } = {}) {
  const retrieval = facts?.retrieval || {};
  if (retrieval.ok !== true) return null;

  const matches = arr(retrieval.matches)
    .filter((match) => s(match?.text || match?.title))
    .slice(0, 2);

  if (!matches.length) return null;

  const replyText = cleanReply(
    matches
      .map(formatRetrievedMatch)
      .filter(Boolean)
      .join(" ")
  );

  if (!replyText) return null;

  return {
    replyText,
    factsUsed: uniqStrings(
      matches.map((match) =>
        [match.source, match.title, match.text]
          .map((part) => s(part))
          .filter(Boolean)
          .join(": ")
      )
    ),
  };
}

function behaviorFactParts(facts = {}) {`
  );
}

if (!composer.includes("const retrievedReply = buildRetrievedTruthReply")) {
  composer = composer.replace(
    `  const parts = [];
  const factsUsed = [];`,
    `  const retrievedReply = buildRetrievedTruthReply({ facts });
  if (retrievedReply) return retrievedReply;

  const parts = [];
  const factsUsed = [];`
  );
}

write("ai-hq-backend/src/services/businessTruthAnswer/composer.js", composer);

write("ai-hq-backend/tests/business-truth-embedding-retrieval.test.js", `import test from "node:test";
import assert from "node:assert/strict";

import { retrieveApprovedTruthFacts } from "../src/services/businessTruthAnswer/retrieval.js";
import { composeApprovedTruthAnswer } from "../src/services/businessTruthAnswer/composer.js";

function fakeEmbeddingForText(text = "") {
  const value = String(text || "").toLowerCase();

  if (value.includes("customer wants automated website conversations")) {
    return [1, 0, 0];
  }

  if (
    value.includes("website automation") ||
    value.includes("website chat, inbox routing")
  ) {
    return [0.97, 0.03, 0];
  }

  if (value.includes("social content")) {
    return [0, 1, 0];
  }

  if (value.includes("unrelated car question")) {
    return [0, 0, 1];
  }

  return [0.1, 0.1, 0.1];
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

test("approved truth composer uses retrieved details instead of plain service names", () => {
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
  assert.match(composed.factsUsed[0], /approved_truth\\.services/i);
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
`);

console.log("patched embedding-based approved truth retrieval");
