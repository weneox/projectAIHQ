import { runTenantAwareConversationEngine } from "./conversationEngine.js";
import { arr, obj, s } from "./shared.js";

function normalizeLegacyShape(result = {}) {
  const safe = obj(result);

  return {
    language: s(safe.language || "en"),
    intent: s(safe.intent || "general"),
    askCategory: s(safe.askCategory || "general"),
    stage: s(safe.stage || "general"),
    replyStyle: s(safe.replyStyle || "consultative"),
    customerGoal: s(safe.customerGoal || ""),
    answerFirst: s(safe.answerFirst || ""),
    recommendedNextQuestion: s(safe.recommendedNextQuestion || ""),
    replyText: s(safe.replyText || ""),
    replyBodyText: s(safe.replyBodyText || ""),
    knownFacts: arr(safe.knownFacts),
    missingFacts: arr(safe.missingFacts),
    groundedFactsUsed: arr(safe.groundedFactsUsed),
    confidence: Number(safe.confidence || 0),
    leadScore: Number(safe.leadScore || 0),
    createLead: safe.createLead === true,
    handoff: safe.handoff === true,
    handoffReason: s(safe.handoffReason || ""),
    handoffPriority: s(safe.handoffPriority || "normal"),
    noReply: safe.noReply === true,
    raw: s(safe.raw || ""),
    replyMode: s(safe.replyMode || "conversation_engine"),
    usedFallback: safe.usedFallback === true,
    usedFastLane: false,
    fastLaneReason: "",
    semanticFailureReason: s(safe.semanticFailureReason || ""),
    profile: obj(safe.profile),
    matchedKnowledge: arr(safe.matchedKnowledge),
    matchedPlaybook: safe.matchedPlaybook ?? null,
    runtime: obj(safe.runtime),
    promptBundle: obj(safe.promptBundle),
    trace: obj(safe.trace),
    fallbackReason: s(safe.fallbackReason || ""),
    greetingApplied: safe.greetingApplied === true,
    greetingText: s(safe.greetingText || ""),
    greetingMode: s(safe.greetingMode || ""),
    usedCustomGreeting: safe.usedCustomGreeting === true,
    introModeUsed: s(safe.introModeUsed || ""),
    behaviorSource: s(safe.behaviorSource || ""),
    greetingOnly: safe.greetingOnly === true,
    detectedService: s(safe.detectedService || ""),
    shouldAskQuestion: safe.shouldAskQuestion === true,
  };
}

export async function aiDecideInbox(args = {}) {
  const result = await runTenantAwareConversationEngine(args);
  return normalizeLegacyShape(result);
}

export const __test__ = {
  normalizeLegacyShape,
};