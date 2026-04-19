import { arr, lower, s, uniqStrings } from "./shared.js";
import {
  normalizeKnowledgeEntry,
  normalizePlaybook,
} from "./runtime.js";

function normalizeFreeText(value = "") {
  return lower(s(value))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value = "") {
  const normalized = normalizeFreeText(value);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function toTokenSet(value = "") {
  return new Set(tokenize(value));
}

function overlapScore(sourceTokens = new Set(), candidateTokens = new Set()) {
  if (!sourceTokens.size || !candidateTokens.size) return 0;

  let hits = 0;
  for (const token of candidateTokens) {
    if (sourceTokens.has(token)) hits += 1;
  }

  if (!hits) return 0;
  return hits / Math.max(1, candidateTokens.size);
}

function phraseIncludes(source = "", candidate = "") {
  const a = normalizeFreeText(source);
  const b = normalizeFreeText(candidate);
  if (!a || !b) return false;
  return a.includes(b);
}

function buildServiceKeywordList(profile = {}, active = true) {
  const out = [];
  const catalog = arr(profile?.serviceCatalog);

  for (const service of catalog) {
    if (!service?.visibleInAi) continue;
    if (Boolean(service?.active) !== Boolean(active)) continue;

    if (service?.name) out.push(service.name);
    for (const alias of arr(service?.aliases)) out.push(alias);
  }

  return uniqStrings(out.map((item) => s(item)).filter(Boolean));
}

export function buildServiceMatchKeywords(profile = {}) {
  return buildServiceKeywordList(profile, true);
}

export function buildDisabledServiceMatchKeywords(profile = {}) {
  return buildServiceKeywordList(profile, false);
}

function scoreKnowledgeEntry(text = "", item = {}) {
  const sourceText = normalizeFreeText(text);
  const sourceTokens = toTokenSet(sourceText);

  const title = s(item?.title);
  const question = s(item?.question);
  const answer = s(item?.answer);
  const keywords = arr(item?.keywords).map((x) => s(x)).filter(Boolean);

  let score = 0;

  if (title && phraseIncludes(sourceText, title)) score += 4;
  if (question && phraseIncludes(sourceText, question)) score += 4;

  const titleOverlap = overlapScore(sourceTokens, toTokenSet(title));
  const questionOverlap = overlapScore(sourceTokens, toTokenSet(question));
  const answerOverlap = overlapScore(sourceTokens, toTokenSet(answer));

  score += titleOverlap * 4;
  score += questionOverlap * 4;
  score += answerOverlap * 1.5;

  for (const keyword of keywords) {
    if (phraseIncludes(sourceText, keyword)) {
      score += 2.25;
      continue;
    }

    const keywordOverlap = overlapScore(sourceTokens, toTokenSet(keyword));
    score += keywordOverlap * 1.5;
  }

  return score;
}

export function matchKnowledgeEntries(text, knowledgeEntries = [], limit = 5) {
  const sourceText = normalizeFreeText(text);
  if (!sourceText) return [];

  const normalized = arr(knowledgeEntries)
    .map(normalizeKnowledgeEntry)
    .filter((item) => item?.active && (item?.title || item?.answer || item?.question));

  const scored = normalized
    .map((item) => ({
      ...item,
      _score: scoreKnowledgeEntry(sourceText, item),
    }))
    .filter((item) => item._score > 0.2);

  return scored
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return Number(a.priority || 100) - Number(b.priority || 100);
    })
    .slice(0, Math.max(1, Number(limit || 5)));
}

function scorePlaybook(text = "", item = {}) {
  const sourceText = normalizeFreeText(text);
  const sourceTokens = toTokenSet(sourceText);

  let score = 0;

  for (const keyword of arr(item?.triggerKeywords)) {
    const kw = s(keyword);
    if (!kw) continue;

    if (phraseIncludes(sourceText, kw)) {
      score += 2;
      continue;
    }

    score += overlapScore(sourceTokens, toTokenSet(kw)) * 1.25;
  }

  if (item?.name && phraseIncludes(sourceText, item.name)) {
    score += 0.5;
  }

  return score;
}

export function matchPlaybook(text, responsePlaybooks = []) {
  const sourceText = normalizeFreeText(text);
  if (!sourceText) return null;

  const list = arr(responsePlaybooks)
    .map(normalizePlaybook)
    .filter((item) => item?.active && arr(item?.triggerKeywords).length);

  let best = null;

  for (const item of list) {
    const score = scorePlaybook(sourceText, item);
    if (score <= 0.2) continue;

    if (
      !best ||
      score > best.score ||
      (score === best.score &&
        Number(item.priority || 100) < Number(best.item.priority || 100))
    ) {
      best = { item, score };
    }
  }

  return best?.item || null;
}

/**
 * Compatibility shim only.
 * Intent understanding should come from ai.js semantic output, not from matchers.js.
 */
export function classifyTenantAwareIntent() {
  return { intent: "general", score: 20 };
}

/**
 * Compatibility shim only.
 * Safe-intent coercion should stay minimal and deterministic.
 */
export function forceSafeIntent(intent) {
  const safeIntent = s(intent || "general") || "general";

  if (
    [
      "greeting",
      "pricing",
      "service_interest",
      "support",
      "general",
      "unsupported_service",
      "handoff_request",
      "urgent_interest",
      "knowledge_answer",
      "playbook",
    ].includes(safeIntent)
  ) {
    return safeIntent;
  }

  return "general";
}

/**
 * Compatibility shim only.
 * Handoff permission should be decided by semantic output + policy, not matcher keywords.
 */
export function shouldAllowHandoffByText(text) {
  return Boolean(normalizeFreeText(text));
}