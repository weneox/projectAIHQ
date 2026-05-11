const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, "utf8");
}

const retrievalPath = "ai-hq-backend/src/services/businessTruthAnswer/retrieval.js";

write(retrievalPath, `import { arr, firstText, lower, obj, s, uniqStrings } from "./normalize.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "of",
  "on",
  "or",
  "our",
  "the",
  "to",
  "we",
  "what",
  "with",
  "you",
  "your",
  "bu",
  "bir",
  "biz",
  "mən",
  "men",
  "nə",
  "ne",
  "üçün",
  "ucun",
  "və",
  "ve",
  "var",
  "edir",
  "edirsiz",
  "edirsiniz",
]);

const QUERY_SYNONYMS = {
  price: ["pricing", "cost", "budget", "fee", "quote", "qiymet", "qiymət"],
  pricing: ["price", "cost", "budget", "fee", "quote", "qiymet", "qiymət"],
  qiymet: ["qiymət", "price", "pricing", "cost"],
  qiymət: ["qiymet", "price", "pricing", "cost"],
  service: ["services", "xidmet", "xidmət", "offer", "package", "product"],
  services: ["service", "xidmet", "xidmət", "offer", "package", "product"],
  xidmet: ["xidmət", "service", "services", "offer"],
  xidmət: ["xidmet", "service", "services", "offer"],
  phone: ["telefon", "nomre", "nömrə", "call", "whatsapp", "elaqe", "əlaqə"],
  telefon: ["phone", "nomre", "nömrə", "call", "whatsapp"],
  email: ["mail", "poct", "poçt"],
  website: ["site", "sayt", "link", "web"],
  booking: ["appointment", "reservation", "rezerv", "gorus", "görüş", "book"],
};

function normalizeFreeText(value = "") {
  return lower(value)
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^\\p{L}\\p{N}\\s]/gu, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

function tokenize(value = "") {
  return uniqStrings(
    normalizeFreeText(value)
      .split(" ")
      .map((item) => s(item))
      .filter((item) => item.length >= 2)
      .filter((item) => !STOP_WORDS.has(item))
  );
}

function expandQueryTokens(tokens = []) {
  const out = new Set(arr(tokens));

  for (const token of arr(tokens)) {
    for (const synonym of arr(QUERY_SYNONYMS[token])) {
      out.add(synonym);
    }
  }

  return [...out].filter(Boolean);
}

function visibleInAi(item = {}) {
  if (item?.enabled === false) return false;
  if (item?.active === false) return false;
  if (item?.visibleInAi === false) return false;
  if (item?.visible_in_ai === false) return false;
  return true;
}

function joinText(...values) {
  return uniqStrings(
    values
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .map((value) => {
        if (typeof value === "string" || typeof value === "number") return s(value);
        if (value && typeof value === "object") {
          return s(
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

function pushCandidate(target, candidate = {}) {
  const title = s(candidate.title || candidate.name || candidate.label);
  const text = s(candidate.text || candidate.description || candidate.summary || candidate.value);

  if (!title && !text) return;

  target.push({
    id: s(candidate.id || candidate.key || title || text).slice(0, 160),
    type: s(candidate.type || "fact"),
    title,
    text: text || title,
    source: s(candidate.source || "approved_truth"),
    weight: Number(candidate.weight || 1),
  });
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

function collectApprovedTruthCorpus({
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
    weight: 1.2,
  });

  pushCandidate(corpus, {
    type: "pricing",
    title: "Pricing",
    text: facts.pricing,
    source: "approved_truth.pricing",
    weight: 1.35,
  });

  pushCandidate(corpus, {
    type: "booking",
    title: "Booking",
    text: facts.booking,
    source: "approved_truth.booking",
    weight: 1.15,
  });

  pushCandidate(corpus, {
    type: "contact",
    title: "Phone",
    text: facts.phone,
    source: "approved_truth.contact",
    weight: 1.25,
  });

  pushCandidate(corpus, {
    type: "contact",
    title: "Email",
    text: facts.email,
    source: "approved_truth.contact",
    weight: 1.25,
  });

  pushCandidate(corpus, {
    type: "contact",
    title: "Website",
    text: facts.website,
    source: "approved_truth.contact",
    weight: 1.25,
  });

  for (const item of [
    ...arr(projection.services_json || projection.servicesJson),
    ...arr(runtimeGrounding.serviceCatalog),
    ...arr(runtimeGrounding.services),
  ]) {
    const x = obj(item);
    if (!visibleInAi(x)) continue;

    const name = s(x.name || x.title || x.serviceName || x.service_name);
    const text = joinText(
      name,
      x.description,
      x.summary,
      x.details,
      x.pricing,
      x.price,
      x.pricingText,
      x.pricing_text,
      x.responseMode,
      x.response_mode
    );

    pushCandidate(corpus, {
      type: "service",
      title: name || "Service",
      text,
      source: "approved_truth.services",
      weight: 1.4,
    });
  }

  for (const item of [
    ...arr(projection.products_json || projection.productsJson),
    ...arr(runtimeGrounding.products),
  ]) {
    const x = obj(item);
    if (!visibleInAi(x)) continue;

    const name = s(x.name || x.title || x.productName || x.product_name);
    const text = joinText(name, x.description, x.summary, x.details, x.pricing, x.price);

    pushCandidate(corpus, {
      type: "product",
      title: name || "Product",
      text,
      source: "approved_truth.products",
      weight: 1.25,
    });
  }

  for (const item of arr(runtimeGrounding.knowledgeEntries)) {
    const x = obj(item);
    if (!visibleInAi(x)) continue;

    const title = s(x.title || x.question || x.key || "Knowledge");
    const text = joinText(title, x.question, x.answer, x.text, x.content, x.value);

    pushCandidate(corpus, {
      type: "knowledge",
      title,
      text,
      source: "approved_truth.knowledge",
      weight: 1.3,
    });
  }

  for (const item of arr(runtimeGrounding.responsePlaybooks)) {
    const x = obj(item);
    if (!visibleInAi(x)) continue;

    const title = s(x.title || x.name || x.intent || "Response playbook");
    const text = joinText(title, x.intent, x.trigger, x.response, x.answer, x.script);

    pushCandidate(corpus, {
      type: "playbook",
      title,
      text,
      source: "approved_truth.playbooks",
      weight: 1.15,
    });
  }

  return corpus;
}

function intentBoost(candidate = {}, primaryIntent = "") {
  const intent = lower(primaryIntent);
  const type = lower(candidate.type);
  const text = normalizeFreeText(candidate.title + " " + candidate.text);

  if (intent.includes("pricing")) {
    if (type === "pricing") return 5;
    if (type === "service" && /(price|pricing|cost|qiymet|qiymət)/i.test(text)) return 3;
  }

  if (intent.includes("services") || intent === "sales_interest") {
    if (type === "service") return 3;
    if (type === "summary") return 1;
  }

  if (intent.includes("products") && type === "product") return 3;
  if (intent.includes("booking") && type === "booking") return 4;
  if (intent.includes("contact") && type === "contact") return 4;
  if (intent.includes("summary") && ["summary", "service", "knowledge"].includes(type)) return 2;

  return 0;
}

function scoreCandidate(candidate = {}, queryTokens = [], primaryIntent = "") {
  const haystack = normalizeFreeText(
    candidate.type + " " + candidate.title + " " + candidate.text + " " + candidate.source
  );
  const hayTokens = new Set(tokenize(haystack));
  let score = 0;

  for (const token of arr(queryTokens)) {
    if (!token) continue;

    if (hayTokens.has(token)) {
      score += token.length >= 5 ? 2 : 1;
      continue;
    }

    if (token.length >= 4 && haystack.includes(token)) {
      score += 1;
    }
  }

  if (queryTokens.includes("service") && lower(candidate.type) === "service") score += 2;
  if (queryTokens.includes("services") && lower(candidate.type) === "service") score += 2;
  if (queryTokens.includes("price") && lower(candidate.type) === "pricing") score += 3;
  if (queryTokens.includes("pricing") && lower(candidate.type) === "pricing") score += 3;

  score += intentBoost(candidate, primaryIntent);

  return Math.round(score * Number(candidate.weight || 1) * 100) / 100;
}

export function retrieveApprovedTruthFacts({
  text = "",
  facts = {},
  runtimeGrounding = {},
  profile = {},
  classification = {},
  limit = 5,
} = {}) {
  const baseTokens = tokenize(text);
  const queryTokens = expandQueryTokens(baseTokens);
  const primaryIntent = s(classification.primaryIntent || arr(classification.intents)[0]);
  const corpus = collectApprovedTruthCorpus({ facts, runtimeGrounding, profile });

  const matches = corpus
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate, queryTokens, primaryIntent),
    }))
    .filter((candidate) => candidate.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Number(limit || 5)));

  const bestScore = Number(matches[0]?.score || 0);

  return {
    ok: true,
    method: "approved_truth_semantic_retrieval_v1",
    queryTokens,
    corpusSize: corpus.length,
    bestScore,
    confidence: bestScore > 0 ? Math.min(1, bestScore / Math.max(4, queryTokens.length + 3)) : 0,
    matches,
  };
}

export const __test__ = {
  tokenize,
  expandQueryTokens,
  collectApprovedTruthCorpus,
  scoreCandidate,
};
`);

let index = read("ai-hq-backend/src/services/businessTruthAnswer/index.js");

if (!index.includes("./retrieval.js")) {
  index = index.replace(
    'import { resolveApprovedTruthFacts } from "./resolver.js";',
    'import { resolveApprovedTruthFacts } from "./resolver.js";\nimport { retrieveApprovedTruthFacts } from "./retrieval.js";'
  );
}

const oldFactsBlock = `  const facts = resolveApprovedTruthFacts({
    runtimeGrounding,
    profile,
  });

  const recoveryDetection = await detectConversationRecoveryWithModel({`;

const newFactsBlock = `  const baseFacts = resolveApprovedTruthFacts({
    runtimeGrounding,
    profile,
  });
  const retrieval = retrieveApprovedTruthFacts({
    text,
    facts: baseFacts,
    runtimeGrounding,
    profile,
  });
  const facts = {
    ...baseFacts,
    retrieval,
  };

  const recoveryDetection = await detectConversationRecoveryWithModel({`;

if (index.includes(oldFactsBlock)) {
  index = index.replace(oldFactsBlock, newFactsBlock);
} else if (!index.includes("retrieveApprovedTruthFacts({")) {
  throw new Error("businessTruthAnswer/index.js facts block not found");
}

write("ai-hq-backend/src/services/businessTruthAnswer/index.js", index);

let composer = read("ai-hq-backend/src/services/businessTruthAnswer/composer.js");

if (!composer.includes("function buildSemanticReply")) {
  const semanticHelpers = `
const SEMANTIC_REPLY_INTENTS = new Set([
  "sales_interest",
  "business.summary",
  "business.services",
  "business.products",
  "business.pricing",
  "business.booking",
]);

function truncateSemanticText(value = "", limit = 420) {
  const text = s(value).replace(/\\s+/g, " ").trim();
  if (!text || text.length <= limit) return text;
  return text.slice(0, Math.max(0, limit - 1)).trim() + "…";
}

function formatSemanticMatch(match = {}) {
  const title = s(match.title);
  const text = truncateSemanticText(match.text);
  if (!text && !title) return "";
  if (!title) return sentence(text);

  const normalizedTitle = title.toLowerCase();
  const normalizedText = text.toLowerCase();

  if (normalizedText.startsWith(normalizedTitle)) {
    return sentence(text);
  }

  return sentence(title + ": " + text);
}

function buildSemanticReply({ facts = {}, intents = [] } = {}) {
  if (!arr(intents).some((intent) => SEMANTIC_REPLY_INTENTS.has(s(intent)))) {
    return null;
  }

  const retrieval = facts?.retrieval || {};
  const matches = arr(retrieval.matches)
    .filter((match) => s(match?.text || match?.title))
    .slice(0, 2);

  const bestScore = Number(retrieval.bestScore || matches[0]?.score || 0);
  if (!matches.length || bestScore < 2) return null;

  const replyText = cleanReply(
    matches
      .map(formatSemanticMatch)
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
`;

  composer = composer.replace(
    "function behaviorFactParts(facts = {}) {",
    semanticHelpers + "\nfunction behaviorFactParts(facts = {}) {"
  );
}

const composeNeedle = `  const parts = [];
  const factsUsed = [];`;

const composePatch = `  const semanticReply = buildSemanticReply({ facts, intents });
  if (semanticReply) return semanticReply;

  const parts = [];
  const factsUsed = [];`;

if (composer.includes(composeNeedle) && !composer.includes("const semanticReply = buildSemanticReply")) {
  composer = composer.replace(composeNeedle, composePatch);
} else if (!composer.includes("const semanticReply = buildSemanticReply")) {
  throw new Error("composer compose block not found");
}

write("ai-hq-backend/src/services/businessTruthAnswer/composer.js", composer);

write("ai-hq-backend/tests/business-truth-semantic-retrieval.test.js", `import test from "node:test";
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
  assert.match(composed.factsUsed[0], /approved_truth\\.services/i);
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
`);

console.log("patched approved truth semantic retrieval v1");
