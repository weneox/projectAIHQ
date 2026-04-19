import { arr, s, sanitizeReplyText } from "./shared.js";
import {
  buildServiceLine,
  pickBehaviorLeadPrompt,
} from "./runtime.js";
import {
  getFallbackDefaultQuestion,
  getFallbackQuestionByIntent,
  getHandoffLeadSentence,
  getPricingLeadSentence,
  getSupportLeadSentence,
  getUnsupportedCheckSentence,
  getUnsupportedExamplesSentence,
  getUrgentLeadSentence,
} from "./prompts/fallback.copy.js";

function splitSentences(text = "") {
  return s(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => sanitizeReplyText(part))
    .filter(Boolean);
}

function clipSentences(text = "", maxSentences = 2) {
  const safeMax = Math.max(1, Math.min(4, Number(maxSentences || 2)));
  return sanitizeReplyText(splitSentences(text).slice(0, safeMax).join(" "));
}

function getVisibleCatalog(profile = {}) {
  return arr(profile?.serviceCatalog).filter((item) => item?.visibleInAi);
}

function getActiveVisibleCatalog(profile = {}) {
  return getVisibleCatalog(profile).filter((item) => item?.active);
}

function getDisabledVisibleCatalog(profile = {}) {
  return getVisibleCatalog(profile).filter((item) => !item?.active);
}

function buildBrandLead(profile = {}) {
  return s(profile?.displayName || "Biz");
}

function buildOfferLead(profile = {}) {
  const brand = buildBrandLead(profile);
  const serviceLine = buildServiceLine(profile);
  const summary = clipSentences(profile?.businessSummary || "", 1);

  if (serviceLine) {
    return sanitizeReplyText(`${brand} olaraq əsasən ${serviceLine} üzrə kömək edirik.`);
  }

  if (summary) {
    return sanitizeReplyText(summary);
  }

  return sanitizeReplyText(`${brand} olaraq kömək edə bilərik.`);
}

function buildSingleQuestion(profile = {}, intent = "general") {
  const configured = arr(profile?.qualificationQuestions)
    .map((item) => sanitizeReplyText(item))
    .filter(Boolean);

  if (configured.length) return configured[0];

  const behaviorPrompt = sanitizeReplyText(pickBehaviorLeadPrompt(profile));
  if (behaviorPrompt) return behaviorPrompt;

  return sanitizeReplyText(
    getFallbackQuestionByIntent(intent) || getFallbackDefaultQuestion()
  );
}

function buildServiceExamples(profile = {}, limit = 3) {
  const names = getActiveVisibleCatalog(profile)
    .map((item) => s(item?.name))
    .filter(Boolean)
    .slice(0, limit);

  if (!names.length) return "";
  return sanitizeReplyText(names.join(", "));
}

function joinParts(parts = []) {
  return sanitizeReplyText(
    arr(parts)
      .map((part) => sanitizeReplyText(part))
      .filter(Boolean)
      .join(" ")
  );
}

function buildKnowledgeReplyCore(matches = [], profile = {}) {
  const first = arr(matches)[0];
  const answer = clipSentences(first?.answer || "", profile?.maxSentences || 2);
  return sanitizeReplyText(answer);
}

export function buildUnsupportedServiceReply(profile = {}) {
  const disabledSpecific = getDisabledVisibleCatalog(profile).find(
    (item) => s(item?.disabledReplyText)
  );

  if (disabledSpecific?.disabledReplyText) {
    return sanitizeReplyText(disabledSpecific.disabledReplyText);
  }

  const offerLead = buildOfferLead(profile);
  const examples = buildServiceExamples(profile, 4);
  const question = buildSingleQuestion(profile, "unsupported_service");

  if (examples) {
    return joinParts([
      offerLead,
      getUnsupportedExamplesSentence(examples),
      question,
    ]);
  }

  return joinParts([
    offerLead,
    getUnsupportedCheckSentence(),
    question,
  ]);
}

export function buildKnowledgeReply(matches = [], profile = {}) {
  const answer = buildKnowledgeReplyCore(matches, profile);
  if (answer) return answer;

  return joinParts([
    buildOfferLead(profile),
    buildSingleQuestion(profile, "knowledge_answer"),
  ]);
}

export function buildPlaybookReply(playbook, fallbackProfile = {}) {
  const reply = sanitizeReplyText(playbook?.replyTemplate || "");
  if (reply) return reply;

  return joinParts([
    buildOfferLead(fallbackProfile),
    buildSingleQuestion(fallbackProfile, "general"),
  ]);
}

function buildGreetingReply(profile = {}) {
  return joinParts([
    buildOfferLead(profile),
    buildSingleQuestion(profile, "greeting"),
  ]);
}

function buildPricingReply(profile = {}) {
  return joinParts([
    getPricingLeadSentence(),
    buildSingleQuestion(profile, "pricing"),
  ]);
}

function buildServiceInterestReply(profile = {}) {
  return joinParts([
    buildOfferLead(profile),
    buildSingleQuestion(profile, "service_interest"),
  ]);
}

function buildSupportReply(profile = {}) {
  return joinParts([
    getSupportLeadSentence(),
    buildSingleQuestion(profile, "support"),
  ]);
}

function buildHandoffReply(profile = {}) {
  return joinParts([
    getHandoffLeadSentence(),
    buildSingleQuestion(profile, "handoff_request"),
  ]);
}

function buildUrgentReply(profile = {}) {
  return joinParts([
    getUrgentLeadSentence(),
    buildSingleQuestion(profile, "urgent_interest"),
  ]);
}

function buildGeneralReply(profile = {}) {
  return joinParts([
    buildOfferLead(profile),
    buildSingleQuestion(profile, "general"),
  ]);
}

export function buildFallbackReply({
  intent,
  profile,
  knowledgeEntries = [],
  playbook = null,
}) {
  if (playbook) {
    return buildPlaybookReply(playbook, profile);
  }

  if (intent === "knowledge_answer") {
    const answer = buildKnowledgeReplyCore(knowledgeEntries, profile);
    if (answer) return answer;
  }

  switch (s(intent)) {
    case "unsupported_service":
      return buildUnsupportedServiceReply(profile);

    case "greeting":
      return buildGreetingReply(profile);

    case "pricing":
      return buildPricingReply(profile);

    case "service_interest":
      return buildServiceInterestReply(profile);

    case "support":
      return buildSupportReply(profile);

    case "handoff_request":
      return buildHandoffReply(profile);

    case "urgent_interest":
      return buildUrgentReply(profile);

    case "knowledge_answer":
      return buildKnowledgeReply(knowledgeEntries, profile);

    default:
      return buildGeneralReply(profile);
  }
}