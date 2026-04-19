import {
  buildKnowledgeReply,
  buildPlaybookReply,
} from "./fallback.js";
import { arr, lower, s, sanitizeReplyText } from "./shared.js";

const GREETING_TOKENS = new Set([
  "salam",
  "salamlar",
  "salamaleykum",
  "salaməleyküm",
  "aleykum",
  "aleyküm",
  "hi",
  "hello",
  "hey",
  "goodmorning",
  "goodafternoon",
  "goodevening",
  "sabahiniz",
  "axsaminiz",
]);

function normalizeForFastCheck(text = "") {
  return lower(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text = "") {
  const normalized = normalizeForFastCheck(text);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function isGreetingOnlyTurn(text = "") {
  const tokens = tokenize(text);
  if (!tokens.length || tokens.length > 4) return false;
  return tokens.every((token) => GREETING_TOKENS.has(token));
}

function hasStrongKnowledgeMatch(matchedKnowledge = []) {
  const first = arr(matchedKnowledge)[0];
  if (!first) return false;
  const score = Number(first?._score || 0);
  const answer = s(first?.answer || "");
  return score >= 4 || (score >= 2.8 && answer.length <= 280);
}

export function tryFastLaneInboxDecision({
  text,
  profile,
  matchedKnowledge = [],
  matchedPlaybook = null,
}) {
  const cleaned = s(text).trim();
  if (!cleaned) return null;

  if (isGreetingOnlyTurn(cleaned)) {
    return {
      language: s(profile?.languages?.[0] || "az"),
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
      heuristic: true,
      fastLaneReason: "greeting_only",
    };
  }

  if (matchedPlaybook) {
    const replyText = sanitizeReplyText(buildPlaybookReply(matchedPlaybook, profile));
    if (replyText) {
      return {
        language: s(profile?.languages?.[0] || "az"),
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
        createLead: Boolean(matchedPlaybook.createLead),
        handoff: Boolean(matchedPlaybook.handoff),
        handoffReason: s(matchedPlaybook.handoffReason || ""),
        handoffPriority: s(matchedPlaybook.handoffPriority || "normal"),
        noReply: false,
        confidence: 0.9,
        leadScore: matchedPlaybook.createLead ? 62 : 26,
        heuristic: true,
        fastLaneReason: "matched_playbook",
      };
    }
  }

  if (hasStrongKnowledgeMatch(matchedKnowledge)) {
    const replyText = sanitizeReplyText(buildKnowledgeReply(matchedKnowledge, profile));
    if (replyText) {
      return {
        language: s(profile?.languages?.[0] || "az"),
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
        heuristic: true,
        fastLaneReason: "matched_knowledge",
      };
    }
  }

  return null;
}