import { classifyApprovedTruthIntentWithModel } from "./classifier.js";
import { composeApprovedTruthAnswer } from "./composer.js";
import { localizeApprovedTruthAnswer } from "./localizer.js";
import { detectConversationRecoveryWithModel } from "./recovery.js";
import { detectRepeatedApprovedTruthRequest } from "./repeat.js";
import { resolveApprovedTruthFacts } from "./resolver.js";
import { retrieveApprovedTruthFacts } from "./retrieval.js";
import { composeRetrievedTruthAnswerWithModel } from "./modelComposer.js";
import { validateApprovedTruthAnswer } from "./validator.js";
import { arr, normalizeIsoLanguage, s } from "./normalize.js";

const SAFE_DIRECT_APPROVED_TRUTH_INTENTS = new Set([
  "smalltalk.greeting",
  "smalltalk.gratitude",
  "clarify.unclear",
  "support.request",
  "handoff.request",
]);

function isSafeDirectApprovedTruthIntent(classification = {}) {
  const intents = arr(classification.intents);
  const primaryIntent = s(classification.primaryIntent);
  const candidates = intents.length ? intents : [primaryIntent];

  return candidates.some((intent) =>
    SAFE_DIRECT_APPROVED_TRUTH_INTENTS.has(s(intent))
  );
}

function retrievalHasGrounding(retrieval = {}) {
  return retrieval?.ok === true && arr(retrieval.matches).length > 0;
}

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

  let composed = await composeRetrievedTruthAnswerWithModel({
    text,
    classification,
    facts,
  });

  if (!composed && isSafeDirectApprovedTruthIntent(classification)) {
    composed = composeApprovedTruthAnswer({
      classification,
      facts,
    });
  }

  if (!composed && !retrievalHasGrounding(retrieval)) {
    return null;
  }

  if (!composed) {
    composed = composeApprovedTruthAnswer({
      classification,
      facts,
    });
  }

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
