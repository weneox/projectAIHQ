import OpenAI from "openai";

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
    .replace(/\s+/g, " ")
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
    .join("\n");
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
