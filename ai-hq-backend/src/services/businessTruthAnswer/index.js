import { classifyApprovedTruthIntentWithModel } from "./classifier.js";
import { composeApprovedTruthAnswer } from "./composer.js";
import { localizeApprovedTruthAnswer } from "./localizer.js";
import { resolveApprovedTruthFacts } from "./resolver.js";
import { validateApprovedTruthAnswer } from "./validator.js";
import { arr, normalizeIsoLanguage, s } from "./normalize.js";

export async function answerFromApprovedTruth({
  text = "",
  runtimeGrounding = {},
  profile = {},
  fallbackLanguage = "az",
} = {}) {
  const classification = await classifyApprovedTruthIntentWithModel({
    text,
    fallbackLanguage,
  });

  if (!classification.shouldHandle) {
    return null;
  }

  const facts = resolveApprovedTruthFacts({
    runtimeGrounding,
    profile,
  });

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

  const finalReplyText = s(localized.replyText || composed.replyText);
  const validation = validateApprovedTruthAnswer({
    replyText: finalReplyText,
  });

  if (!validation.ok) {
    return null;
  }

  const language = normalizeIsoLanguage(
    localized.language || classification.language,
    fallbackLanguage
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
    source: "approved_truth_answer_engine",
    diagnostics: {
      intents: arr(classification.intents),
      userMeaning: s(classification.userMeaning),
      needsApprovedTruth: classification.needsApprovedTruth === true,
      localized: localized.localized === true,
      localizationReason: s(localized.reason),
      targetLanguage: language,
    },
  };
}
