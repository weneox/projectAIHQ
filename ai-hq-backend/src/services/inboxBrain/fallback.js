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

const WEBSITE_KEYWORDS = [
  "veb sayt",
  "vebsayt",
  "web sayt",
  "website",
  "site",
  "sayt",
  "landing page",
  "landing",
];

const ECOMMERCE_KEYWORDS = [
  "ecommerce",
  "e-commerce",
  "magaza",
  "mağaza",
  "online shop",
  "shop",
  "store",
  "satis",
  "satış",
  "product catalog",
  "katalog",
];

const SOFTWARE_KEYWORDS = [
  "software",
  "soft",
  "sistem",
  "system",
  "platform",
  "crm",
  "erp",
  "app",
  "application",
  "mobile app",
  "dashboard",
  "admin panel",
  "portal",
  "automation",
  "chatbot",
  "bot",
];

const BOOKING_KEYWORDS = [
  "booking",
  "rezervasiya",
  "reservation",
  "bron",
  "appointment",
  "randevu",
  "calendar",
];

const PRICING_KEYWORDS = [
  "qiymet",
  "qiymət",
  "price",
  "pricing",
  "cost",
  "budget",
  "büdcə",
  "budce",
  "neceye",
  "neçəyə",
  "how much",
  "quote",
];

const TIMELINE_KEYWORDS = [
  "ne vaxta",
  "nə vaxta",
  "deadline",
  "timeline",
  "müddət",
  "muddet",
  "how long",
  "when",
  "tez",
  "urgent",
  "təcili",
  "tecili",
];

const SUPPORT_KEYWORDS = [
  "problem",
  "issue",
  "error",
  "xeta",
  "xəta",
  "duzelt",
  "düzəlt",
  "support",
  "help",
  "kömək",
  "komek",
  "işləmir",
  "islemir",
  "broken",
  "bug",
];

const RECOMMENDATION_KEYWORDS = [
  "hangi",
  "hansı",
  "which",
  "recommend",
  "məsləhət",
  "meslehet",
  "tovsiyə",
  "tovsiye",
  "what should",
];

const DOMAIN_HINTS = [
  { label: "hotel", keywords: ["hotel", "otel", "resort"] },
  { label: "clinic", keywords: ["clinic", "klinika", "hospital", "doctor", "dentist", "medical"] },
  { label: "restaurant", keywords: ["restaurant", "restoran", "cafe", "kafe"] },
  { label: "salon", keywords: ["salon", "spa", "beauty", "gözəllik", "gozellik"] },
  { label: "real_estate", keywords: ["real estate", "daşınmaz", "dasinmaz", "property"] },
  { label: "education", keywords: ["academy", "course", "kurs", "school", "məktəb", "mekteb"] },
];

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

function normalizeForIntent(text = "") {
  return s(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyKeyword(text = "", keywords = []) {
  const normalized = normalizeForIntent(text);
  if (!normalized) return false;
  return arr(keywords).some((keyword) => normalized.includes(String(keyword || "").toLowerCase()));
}

function countWords(text = "") {
  const normalized = normalizeForIntent(text);
  if (!normalized) return 0;
  return normalized.split(" ").filter(Boolean).length;
}

function hasSubstantiveMessage(text = "") {
  const normalized = normalizeForIntent(text);
  if (!normalized) return false;

  if (normalized.length >= 18) return true;
  if (countWords(normalized) >= 4) return true;

  return (
    hasAnyKeyword(normalized, WEBSITE_KEYWORDS) ||
    hasAnyKeyword(normalized, ECOMMERCE_KEYWORDS) ||
    hasAnyKeyword(normalized, SOFTWARE_KEYWORDS) ||
    hasAnyKeyword(normalized, BOOKING_KEYWORDS) ||
    hasAnyKeyword(normalized, PRICING_KEYWORDS) ||
    hasAnyKeyword(normalized, TIMELINE_KEYWORDS) ||
    hasAnyKeyword(normalized, SUPPORT_KEYWORDS) ||
    hasAnyKeyword(normalized, RECOMMENDATION_KEYWORDS)
  );
}

function detectDomainHint(text = "") {
  const normalized = normalizeForIntent(text);
  if (!normalized) return "";

  for (const hint of DOMAIN_HINTS) {
    if (arr(hint?.keywords).some((keyword) => normalized.includes(String(keyword || "").toLowerCase()))) {
      return s(hint?.label);
    }
  }

  return "";
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

function buildProjectObjectFromText(text = "") {
  const normalized = normalizeForIntent(text);

  if (hasAnyKeyword(normalized, ECOMMERCE_KEYWORDS)) {
    return "online satış yönümlü sayt";
  }

  if (hasAnyKeyword(normalized, SOFTWARE_KEYWORDS)) {
    return "xüsusi software həlli";
  }

  if (hasAnyKeyword(normalized, BOOKING_KEYWORDS) && hasAnyKeyword(normalized, WEBSITE_KEYWORDS)) {
    return "rezervasiya funksiyalı sayt";
  }

  if (hasAnyKeyword(normalized, BOOKING_KEYWORDS)) {
    return "rezervasiya axını";
  }

  if (hasAnyKeyword(normalized, WEBSITE_KEYWORDS)) {
    return "veb sayt";
  }

  return "";
}

function buildDomainPrefixedObject(text = "") {
  const domain = detectDomainHint(text);
  const projectObject = buildProjectObjectFromText(text);

  const domainMap = {
    hotel: "Hotel üçün",
    clinic: "Klinika üçün",
    restaurant: "Restoran üçün",
    salon: "Salon üçün",
    real_estate: "Daşınmaz əmlak üçün",
    education: "Təhsil layihəsi üçün",
  };

  if (domain && projectObject && domainMap[domain]) {
    return `${domainMap[domain]} ${projectObject}`;
  }

  return projectObject;
}

function buildScopedLead(text = "", profile = {}) {
  const brand = buildBrandLead(profile);
  const scopedObject = buildDomainPrefixedObject(text);

  if (scopedObject) {
    return sanitizeReplyText(`${scopedObject} üzrə kömək edə bilərik.`);
  }

  const projectObject = buildProjectObjectFromText(text);
  if (projectObject) {
    return sanitizeReplyText(`${brand} olaraq ${projectObject} üzrə kömək edə bilərik.`);
  }

  return buildOfferLead(profile);
}

function buildScopedQuestion(text = "", profile = {}, intent = "general") {
  const custom = sanitizeReplyText(pickBehaviorLeadPrompt(profile));
  const normalized = normalizeForIntent(text);
  const projectObject = buildProjectObjectFromText(normalized);

  if (intent === "pricing") {
    if (projectObject) {
      return sanitizeReplyText(
        `Təxmini yönləndirmə üçün ${projectObject} üzrə əsas məqsədi və vacib 1-2 funksiyanı yazın.`
      );
    }
    return sanitizeReplyText(
      "Təxmini yönləndirmə üçün əsas məqsədi və vacib 1-2 tələbi yazın."
    );
  }

  if (intent === "timeline") {
    if (projectObject) {
      return sanitizeReplyText(
        `${projectObject} üçün əsas scope-u və varsa deadline-i yazın.`
      );
    }
    return sanitizeReplyText(
      "Daha düzgün müddət yönləndirməsi üçün əsas scope-u və varsa deadline-i yazın."
    );
  }

  if (intent === "support") {
    return sanitizeReplyText(
      "Problemin nə olduğunu və harada baş verdiyini qısa yazın."
    );
  }

  if (projectObject) {
    return sanitizeReplyText(
      custom || `Daha düzgün yönləndirmə üçün ${projectObject} üzrə əsas məqsədi və vacib funksiyaları yazın.`
    );
  }

  return sanitizeReplyText(custom || buildSingleQuestion(profile, intent));
}

function buildServiceInterestReplyFromMessage(text = "", profile = {}) {
  return joinParts([
    buildScopedLead(text, profile),
    buildScopedQuestion(text, profile, "service_interest"),
  ]);
}

function buildPricingReplyFromMessage(text = "", profile = {}) {
  const normalized = normalizeForIntent(text);
  const projectObject = buildProjectObjectFromText(normalized);

  const leadSentence = projectObject
    ? `Dəqiq qiymət ${projectObject} üzrə scope, funksiyalar və iş həcminə görə dəyişir.`
    : getPricingLeadSentence();

  return joinParts([
    leadSentence,
    buildScopedQuestion(text, profile, "pricing"),
  ]);
}

function buildTimelineReplyFromMessage(text = "", profile = {}) {
  const normalized = normalizeForIntent(text);
  const projectObject = buildProjectObjectFromText(normalized);

  const leadSentence = projectObject
    ? `${projectObject} üzrə müddət scope və təsdiqlənən funksiyalardan asılı olur.`
    : "Müddət scope və təsdiqlənən iş həcminə görə dəyişir.";

  return joinParts([
    leadSentence,
    buildScopedQuestion(text, profile, "timeline"),
  ]);
}

function buildSupportReplyFromMessage(text = "", profile = {}) {
  return joinParts([
    getSupportLeadSentence(),
    buildScopedQuestion(text, profile, "support"),
  ]);
}

function buildRecommendationReplyFromMessage(text = "", profile = {}) {
  return joinParts([
    buildScopedLead(text, profile),
    buildScopedQuestion(text, profile, "service_interest"),
  ]);
}

function buildGeneralReplyFromMessage(text = "", profile = {}) {
  if (hasSubstantiveMessage(text)) {
    return joinParts([
      buildScopedLead(text, profile),
      buildScopedQuestion(text, profile, "general"),
    ]);
  }

  return joinParts([
    buildOfferLead(profile),
    buildSingleQuestion(profile, "general"),
  ]);
}

function buildGreetingReply(profile = {}) {
  return joinParts([
    buildOfferLead(profile),
    buildSingleQuestion(profile, "greeting"),
  ]);
}

function buildPricingReply(profile = {}, text = "") {
  if (hasSubstantiveMessage(text)) {
    return buildPricingReplyFromMessage(text, profile);
  }

  return joinParts([
    getPricingLeadSentence(),
    buildSingleQuestion(profile, "pricing"),
  ]);
}

function buildServiceInterestReply(profile = {}, text = "") {
  if (hasSubstantiveMessage(text)) {
    return buildServiceInterestReplyFromMessage(text, profile);
  }

  return joinParts([
    buildOfferLead(profile),
    buildSingleQuestion(profile, "service_interest"),
  ]);
}

function buildSupportReply(profile = {}, text = "") {
  if (hasSubstantiveMessage(text)) {
    return buildSupportReplyFromMessage(text, profile);
  }

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

function buildGeneralReply(profile = {}, text = "") {
  return buildGeneralReplyFromMessage(text, profile);
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

export function buildFallbackReply({
  intent,
  profile,
  knowledgeEntries = [],
  playbook = null,
  text = "",
  latestMessageText = "",
  customerGoal = "",
}) {
  const effectiveText =
    s(latestMessageText) ||
    s(customerGoal) ||
    s(text);

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
      return buildPricingReply(profile, effectiveText);

    case "timeline":
      return buildTimelineReplyFromMessage(effectiveText, profile);

    case "service_interest":
      return buildServiceInterestReply(profile, effectiveText);

    case "recommendation":
      return buildRecommendationReplyFromMessage(effectiveText, profile);

    case "support":
      return buildSupportReply(profile, effectiveText);

    case "handoff_request":
      return buildHandoffReply(profile);

    case "urgent_interest":
      return buildUrgentReply(profile);

    case "knowledge_answer":
      return buildKnowledgeReply(knowledgeEntries, profile);

    default:
      return buildGeneralReply(profile, effectiveText);
  }
}