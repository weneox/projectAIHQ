import { arr, s, sanitizeReplyText } from "./shared.js";
import {
  getFallbackDefaultQuestion,
  getFallbackQuestionByIntent,
  getPricingLeadSentence,
  getSupportLeadSentence,
  getHandoffLeadSentence,
  getUrgentLeadSentence,
  getUnsupportedExamplesSentence,
  getUnsupportedCheckSentence,
} from "./prompts/fallback.copy.js";

function resolveLanguage(profile = {}, playbook = null, matches = []) {
  const candidates = [
    s(playbook?.language),
    s(arr(matches)[0]?.language),
    s(arr(profile?.languages)[0]),
    "en",
  ];

  for (const candidate of candidates) {
    const raw = String(candidate || "").trim().toLowerCase();
    if (!raw) continue;

    if (raw.startsWith("az")) return "az";
    if (raw.startsWith("en")) return "en";
    if (raw.startsWith("tr")) return "tr";
    if (raw.startsWith("ru")) return "ru";
    if (raw.startsWith("es")) return "es";
    if (raw.startsWith("de")) return "de";
    if (raw.startsWith("fr")) return "fr";
    if (raw.startsWith("it")) return "it";
    if (raw.startsWith("pt")) return "pt";
    if (raw.startsWith("ar")) return "ar";
    if (raw.startsWith("nl")) return "nl";
    if (raw.startsWith("pl")) return "pl";
    if (raw.startsWith("uk")) return "uk";
    if (raw.startsWith("zh")) return "zh";
    if (raw.startsWith("ja")) return "ja";
    if (raw.startsWith("ko")) return "ko";
    if (raw.startsWith("hi")) return "hi";
  }

  return "en";
}

function splitSentences(text = "") {
  return s(text)
    .split(/(?<=[.!?؟])\s+/)
    .map((part) => sanitizeReplyText(part))
    .filter(Boolean);
}

function clipSentences(text = "", maxSentences = 2) {
  const safeMax = Math.max(1, Math.min(4, Number(maxSentences || 2)));
  return sanitizeReplyText(splitSentences(text).slice(0, safeMax).join(" "));
}

function joinParts(parts = []) {
  return sanitizeReplyText(
    arr(parts)
      .map((part) => sanitizeReplyText(part))
      .filter(Boolean)
      .join(" ")
  );
}

function getActiveVisibleCatalog(profile = {}) {
  return arr(profile?.serviceCatalog).filter(
    (item) => item?.active && item?.visibleInAi
  );
}

function getDisabledVisibleCatalog(profile = {}) {
  return arr(profile?.serviceCatalog).filter(
    (item) => !item?.active && item?.visibleInAi
  );
}

function buildServiceExamples(profile = {}, limit = 3) {
  const names = getActiveVisibleCatalog(profile)
    .map((item) => s(item?.name))
    .filter(Boolean)
    .slice(0, limit);

  return sanitizeReplyText(names.join(", "));
}

function buildSafeQuestion(intent = "general", language = "en") {
  const byIntent = sanitizeReplyText(getFallbackQuestionByIntent(intent, language));
  if (byIntent) return byIntent;
  return sanitizeReplyText(getFallbackDefaultQuestion(language));
}

function buildKnowledgeReplyCore(matches = [], profile = {}) {
  const first = arr(matches)[0];
  if (!first) return "";

  const answer = clipSentences(first?.answer || "", profile?.maxSentences || 2);
  return sanitizeReplyText(answer);
}

function buildGeneralReply(language = "en") {
  return buildSafeQuestion("general", language);
}

function buildGreetingReply(language = "en") {
  return buildSafeQuestion("greeting", language);
}

function buildPricingReply(language = "en") {
  return joinParts([
    getPricingLeadSentence(language),
    buildSafeQuestion("pricing", language),
  ]);
}

function buildSupportReply(language = "en") {
  return joinParts([
    getSupportLeadSentence(language),
    buildSafeQuestion("support", language),
  ]);
}

function buildHandoffReply(language = "en") {
  return joinParts([
    getHandoffLeadSentence(language),
    buildSafeQuestion("handoff_request", language),
  ]);
}

function buildUrgentReply(language = "en") {
  return joinParts([
    getUrgentLeadSentence(language),
    buildSafeQuestion("urgent_interest", language),
  ]);
}

function buildUnsupportedServiceReply(profile = {}) {
  const language = resolveLanguage(profile);
  const disabledSpecific = getDisabledVisibleCatalog(profile).find(
    (item) => s(item?.disabledReplyText)
  );

  if (disabledSpecific?.disabledReplyText) {
    return sanitizeReplyText(disabledSpecific.disabledReplyText);
  }

  const examples = buildServiceExamples(profile, 4);

  if (examples) {
    return joinParts([
      getUnsupportedExamplesSentence(examples, language),
      getUnsupportedCheckSentence(language),
    ]);
  }

  return sanitizeReplyText(getUnsupportedCheckSentence(language));
}

function buildKnowledgeReply(matches = [], profile = {}) {
  const language = resolveLanguage(profile, null, matches);
  const answer = buildKnowledgeReplyCore(matches, profile);

  if (answer) return answer;
  return buildSafeQuestion("knowledge_answer", language);
}

function buildPlaybookReply(playbook, fallbackProfile = {}) {
  const reply = sanitizeReplyText(playbook?.replyTemplate || "");
  if (reply) return reply;

  const language = resolveLanguage(fallbackProfile, playbook);
  return buildGeneralReply(language);
}

function buildFallbackReply({
  intent,
  profile,
  knowledgeEntries = [],
  playbook = null,
}) {
  const language = resolveLanguage(profile, playbook, knowledgeEntries);
  const safeIntent = s(intent);

  if (playbook) {
    return buildPlaybookReply(playbook, profile);
  }

  if (safeIntent === "knowledge_answer") {
    const answer = buildKnowledgeReplyCore(knowledgeEntries, profile);
    if (answer) return answer;
  }

  switch (safeIntent) {
    case "unsupported_service":
      return buildUnsupportedServiceReply(profile);

    case "greeting":
      return buildGreetingReply(language);

    case "pricing":
    case "quote":
      return buildPricingReply(language);

    case "support":
      return buildSupportReply(language);

    case "handoff_request":
      return buildHandoffReply(language);

    case "urgent_interest":
      return buildUrgentReply(language);

    case "knowledge_answer":
      return buildKnowledgeReply(knowledgeEntries, profile);

    default:
      return buildGeneralReply(language);
  }
}

export {
  buildUnsupportedServiceReply,
  buildKnowledgeReply,
  buildPlaybookReply,
  buildFallbackReply,
};