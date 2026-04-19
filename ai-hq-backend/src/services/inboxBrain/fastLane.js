import {
  buildKnowledgeReply,
  buildPlaybookReply,
} from "./fallback.js";
import { arr, lower, s, sanitizeReplyText } from "./shared.js";

const START_COMMANDS = new Set([
  "/start",
  "/start@bot",
]);

const GREETING_TOKENS = new Set([
  // English
  "hi",
  "hello",
  "hey",
  "greetings",
  "morning",
  "afternoon",
  "evening",

  // Azerbaijani / Turkish
  "salam",
  "salamlar",
  "salamaleykum",
  "salaməleyküm",
  "aleykum",
  "aleyküm",
  "selam",
  "merhaba",

  // Russian
  "privet",
  "zdravstvuyte",

  // Spanish / Portuguese / Italian / French / German / Dutch
  "hola",
  "ola",
  "olá",
  "ciao",
  "bonjour",
  "hallo",
  "hei",

  // Arabic / Persian transliterations
  "marhaba",
  "salaam",
  "salaamalaikum",
  "salamalaikum",

  // South / East Asia transliterations
  "namaste",
  "nihao",
  "konnichiwa",
  "annyeong",
]);

function normalizeForFastCheck(text = "") {
  return lower(text)
    .replace(/[^\p{L}\p{N}\/\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text = "") {
  const normalized = normalizeForFastCheck(text);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function toTokenSet(text = "") {
  return new Set(tokenize(text));
}

function phraseIncludes(source = "", candidate = "") {
  const a = normalizeForFastCheck(source);
  const b = normalizeForFastCheck(candidate);
  if (!a || !b) return false;
  return a.includes(b);
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

function isStartCommand(text = "") {
  const normalized = normalizeForFastCheck(text);
  if (!normalized) return false;
  if (START_COMMANDS.has(normalized)) return true;
  return normalized.startsWith("/start");
}

function isGreetingOnlyTurn(text = "") {
  const normalized = normalizeForFastCheck(text);
  if (!normalized) return false;
  if (isStartCommand(normalized)) return true;

  const tokens = tokenize(normalized);
  if (!tokens.length || tokens.length > 4) return false;

  return tokens.every((token) => GREETING_TOKENS.has(token));
}

function hasStrongPlaybookMatch(text = "", matchedPlaybook = null) {
  if (!matchedPlaybook) return false;

  const sourceText = normalizeForFastCheck(text);
  const sourceTokens = toTokenSet(sourceText);
  const triggerKeywords = arr(matchedPlaybook?.triggerKeywords)
    .map((item) => s(item))
    .filter(Boolean);

  if (!triggerKeywords.length) return false;

  for (const keyword of triggerKeywords) {
    const normalizedKeyword = normalizeForFastCheck(keyword);
    if (!normalizedKeyword) continue;

    if (phraseIncludes(sourceText, normalizedKeyword)) return true;

    const keywordTokens = toTokenSet(normalizedKeyword);
    const score = overlapScore(sourceTokens, keywordTokens);

    if (keywordTokens.size <= 3 && score >= 0.95) return true;
    if (keywordTokens.size >= 4 && score >= 0.75) return true;
  }

  return false;
}

function hasStrongKnowledgeMatch(text = "", matchedKnowledge = []) {
  const first = arr(matchedKnowledge)[0];
  if (!first) return false;

  const sourceText = normalizeForFastCheck(text);
  const sourceTokens = toTokenSet(sourceText);
  const score = Number(first?._score || 0);
  const title = s(first?.title || "");
  const question = s(first?.question || "");
  const answer = s(first?.answer || "");
  const keywords = arr(first?.keywords).map((item) => s(item)).filter(Boolean);

  if (title && phraseIncludes(sourceText, title)) return true;
  if (question && phraseIncludes(sourceText, question)) return true;
  if (keywords.some((keyword) => phraseIncludes(sourceText, keyword))) return true;

  const answerOverlap = overlapScore(sourceTokens, toTokenSet(answer));
  return score >= 4 || (score >= 2.8 && answer.length > 0 && answerOverlap >= 0.08);
}

function buildGreetingFastLaneDecision(profile = {}, reason = "greeting_only") {
  return {
    language: s(profile?.languages?.[0] || "en"),
    semanticIntent: "greeting",
    askCategory: "greeting",
    conversationStage: "greeting",
    replyStyle: "consultative",
    customerGoal: "",
    knownFacts: [],
    missingFacts: [],
    groundedFactsUsed: ["fast_lane_greeting"],
    answerFirst: "",
    recommendedNextQuestion: "",
    replyText: "",
    createLead: false,
    handoff: false,
    handoffReason: "",
    handoffPriority: "normal",
    noReply: false,
    confidence: 0.96,
    leadScore: 6,
    heuristic: false,
    fastLaneReason: reason,
  };
}

function buildPlaybookFastLaneDecision(matchedPlaybook = null, profile = {}) {
  const replyText = sanitizeReplyText(buildPlaybookReply(matchedPlaybook, profile));
  if (!replyText) return null;

  return {
    language: s(matchedPlaybook?.language || profile?.languages?.[0] || "en"),
    semanticIntent: "playbook",
    askCategory: "general",
    conversationStage: "answer",
    replyStyle: "consultative",
    customerGoal: "",
    knownFacts: [],
    missingFacts: [],
    groundedFactsUsed: ["fast_lane_playbook"],
    answerFirst: replyText,
    recommendedNextQuestion: "",
    replyText,
    createLead: Boolean(matchedPlaybook?.createLead),
    handoff: Boolean(matchedPlaybook?.handoff),
    handoffReason: s(matchedPlaybook?.handoffReason || ""),
    handoffPriority: s(matchedPlaybook?.handoffPriority || "normal"),
    noReply: false,
    confidence: 0.9,
    leadScore: matchedPlaybook?.createLead ? 62 : 26,
    heuristic: false,
    fastLaneReason: "matched_playbook",
  };
}

function buildKnowledgeFastLaneDecision(matchedKnowledge = [], profile = {}) {
  const replyText = sanitizeReplyText(buildKnowledgeReply(matchedKnowledge, profile));
  if (!replyText) return null;

  const first = arr(matchedKnowledge)[0];

  return {
    language: s(first?.language || profile?.languages?.[0] || "en"),
    semanticIntent: "knowledge_answer",
    askCategory: "faq",
    conversationStage: "answer",
    replyStyle: "consultative",
    customerGoal: "",
    knownFacts: [],
    missingFacts: [],
    groundedFactsUsed: ["fast_lane_knowledge"],
    answerFirst: replyText,
    recommendedNextQuestion: "",
    replyText,
    createLead: false,
    handoff: false,
    handoffReason: "",
    handoffPriority: "normal",
    noReply: false,
    confidence: 0.88,
    leadScore: 20,
    heuristic: false,
    fastLaneReason: "matched_knowledge",
  };
}

export function tryFastLaneInboxDecision({
  text,
  profile,
  matchedKnowledge = [],
  matchedPlaybook = null,
}) {
  const cleaned = s(text).trim();
  if (!cleaned) return null;

  if (isStartCommand(cleaned)) {
    return buildGreetingFastLaneDecision(profile, "start_command");
  }

  if (isGreetingOnlyTurn(cleaned)) {
    return buildGreetingFastLaneDecision(profile, "greeting_only");
  }

  if (matchedPlaybook && hasStrongPlaybookMatch(cleaned, matchedPlaybook)) {
    return buildPlaybookFastLaneDecision(matchedPlaybook, profile);
  }

  if (hasStrongKnowledgeMatch(cleaned, matchedKnowledge)) {
    return buildKnowledgeFastLaneDecision(matchedKnowledge, profile);
  }

  return null;
}