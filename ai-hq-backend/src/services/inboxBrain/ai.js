import OpenAI from "openai";
import { cfg } from "../../config.js";
import { buildAgentReplayTrace } from "../agentReplayTrace.js";
import { buildPromptBundle } from "../promptBundle.js";
import {
  buildFallbackReply,
  buildKnowledgeReply,
  buildPlaybookReply,
  buildUnsupportedServiceReply,
} from "./fallback.js";
import { arr, getResolvedTenantKey, lower, obj, s, sanitizeReplyText } from "./shared.js";
import {
  buildHistorySnippet,
  extractText,
  parseJsonLoose,
  stripLeadingCommand,
} from "./messages.js";
import {
  buildDisabledServiceLine,
  buildServiceLine,
  pickBehaviorLeadPrompt,
  resolveInboxRuntime,
} from "./runtime.js";
import { matchKnowledgeEntries, matchPlaybook } from "./matchers.js";
import { buildSemanticSystemPrompt } from "./prompts/system.semantic.js";
import { buildSemanticUserPrompt } from "./prompts/user.semantic.js";
import { buildSemanticRepairSystemPrompt } from "./prompts/system.repair.js";
import { buildSemanticRepairUserPrompt } from "./prompts/user.repair.js";
import { composeTenantAwareReply } from "./replyComposer.js";
import { tryFastLaneInboxDecision } from "./fastLane.js";

let openaiSingleton = null;

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
  "ne vaxta",
  "timeline",
  "deadline",
  "müddət",
  "muddet",
  "how long",
  "when",
  "tez",
  "urgent",
  "təcili",
  "tecili",
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

const DOMAIN_HINTS = [
  { label: "hotel", keywords: ["hotel", "otel", "resort"] },
  { label: "clinic", keywords: ["clinic", "klinika", "hospital", "doctor", "dentist", "medical"] },
  { label: "restaurant", keywords: ["restaurant", "restoran", "cafe", "kafe"] },
  { label: "salon", keywords: ["salon", "spa", "beauty", "gözəllik", "gozellik"] },
  { label: "real_estate", keywords: ["real estate", "daşınmaz", "dasinmaz", "property"] },
  { label: "education", keywords: ["academy", "course", "kurs", "school", "məktəb", "mekteb"] },
];

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function summarizeOpenAIConfig() {
  const apiKey = s(cfg?.ai?.openaiApiKey || "");
  const model = s(cfg?.ai?.openaiModel || "gpt-5") || "gpt-5";
  const maxOutputTokens = Number(cfg?.ai?.openaiMaxOutputTokens || 800);

  return {
    hasApiKey: Boolean(apiKey),
    apiKeyLength: apiKey.length,
    model,
    maxOutputTokens,
  };
}

function safePreview(value = "", max = 280) {
  const text = s(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function logInboxAi(event = "", payload = {}) {
  try {
    console.info(`[ai-hq] inbox ai ${event}`, payload);
  } catch {}
}

function logInboxAiWarn(event = "", payload = {}) {
  try {
    console.warn(`[ai-hq] inbox ai ${event}`, payload);
  } catch {}
}

function logInboxAiError(event = "", payload = {}) {
  try {
    console.error(`[ai-hq] inbox ai ${event}`, payload);
  } catch {}
}

function ensureOpenAI() {
  const key = s(cfg?.ai?.openaiApiKey || "");
  if (!key) return null;

  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey: key });
  }

  return openaiSingleton;
}

function compactJson(value, max = 7000) {
  try {
    const raw = JSON.stringify(value ?? {});
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max)}…`;
  } catch {
    return "{}";
  }
}

function normalizeStage(value = "") {
  const normalized = lower(value);
  const allowed = new Set([
    "greeting",
    "discovery",
    "recommendation",
    "pricing",
    "timeline",
    "qualification",
    "objection",
    "handoff",
    "support",
    "answer",
    "closing",
    "general",
  ]);
  return allowed.has(normalized) ? normalized : "general";
}

function normalizeAskCategory(value = "") {
  const normalized = lower(value);
  const allowed = new Set([
    "greeting",
    "service_interest",
    "recommendation",
    "pricing",
    "timeline",
    "comparison",
    "availability",
    "booking",
    "reservation",
    "quote",
    "support",
    "faq",
    "handoff_request",
    "general",
  ]);
  return allowed.has(normalized) ? normalized : "general";
}

function normalizeReplyStyle(value = "") {
  const normalized = lower(value);
  const allowed = new Set([
    "consultative",
    "direct",
    "reassuring",
    "concise",
    "sales",
    "supportive",
    "professional",
  ]);
  return allowed.has(normalized) ? normalized : "consultative";
}

function normalizePriority(value = "") {
  const normalized = lower(value);
  return ["low", "normal", "high", "urgent"].includes(normalized)
    ? normalized
    : "normal";
}

function coerceBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = lower(value);
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return fallback;
}

function coerceNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coerceStringArray(value = []) {
  return uniqStrings(
    arr(value)
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return s(item.label || item.name || item.value || item.key);
        }
        return s(item);
      })
      .filter(Boolean)
  );
}

function sanitizeSentence(value = "") {
  return sanitizeReplyText(s(value).replace(/\s+/g, " "));
}

function joinReplyParts(answerFirst = "", nextQuestion = "") {
  const first = sanitizeSentence(answerFirst);
  const second = sanitizeSentence(nextQuestion);

  if (!first && !second) return "";
  if (first && !second) return first;
  if (!first && second) return second;

  const firstBase = lower(first.replace(/[.?!]+$/g, ""));
  const secondBase = lower(second.replace(/[.?!]+$/g, ""));
  if (firstBase && firstBase === secondBase) return first;

  return sanitizeReplyText(`${first} ${second}`);
}

function isCommandOnly(text = "") {
  const raw = s(text).trim();
  if (!raw.startsWith("/")) return false;
  return stripLeadingCommand(raw) === "";
}

function normalizeForIntent(text = "") {
  return lower(s(text))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyKeyword(text = "", keywords = []) {
  const normalized = normalizeForIntent(text);
  if (!normalized) return false;
  return arr(keywords).some((keyword) => normalized.includes(lower(keyword)));
}

function detectDomainHint(text = "") {
  const normalized = normalizeForIntent(text);
  if (!normalized) return "";

  for (const hint of DOMAIN_HINTS) {
    if (arr(hint?.keywords).some((keyword) => normalized.includes(lower(keyword)))) {
      return s(hint?.label);
    }
  }

  return "";
}

function detectHeuristicIntent(text = "") {
  const normalized = normalizeForIntent(text);
  if (!normalized) {
    return {
      intent: "general",
      askCategory: "general",
      stage: "general",
      customerGoal: "",
      domainHint: "",
      detectedNeeds: [],
      shouldUseHeuristicFallback: false,
    };
  }

  const detectedNeeds = [];
  const domainHint = detectDomainHint(normalized);

  if (hasAnyKeyword(normalized, WEBSITE_KEYWORDS)) detectedNeeds.push("website");
  if (hasAnyKeyword(normalized, ECOMMERCE_KEYWORDS)) detectedNeeds.push("ecommerce");
  if (hasAnyKeyword(normalized, SOFTWARE_KEYWORDS)) detectedNeeds.push("software");
  if (hasAnyKeyword(normalized, BOOKING_KEYWORDS)) detectedNeeds.push("booking");
  if (hasAnyKeyword(normalized, PRICING_KEYWORDS)) detectedNeeds.push("pricing");
  if (hasAnyKeyword(normalized, TIMELINE_KEYWORDS)) detectedNeeds.push("timeline");
  if (hasAnyKeyword(normalized, RECOMMENDATION_KEYWORDS)) detectedNeeds.push("recommendation");
  if (hasAnyKeyword(normalized, SUPPORT_KEYWORDS)) detectedNeeds.push("support");

  const shouldUseHeuristicFallback =
    detectedNeeds.length > 0 || normalized.length >= 18 || normalized.split(" ").length >= 4;

  if (detectedNeeds.includes("support")) {
    return {
      intent: "support",
      askCategory: "support",
      stage: "support",
      customerGoal: s(text),
      domainHint,
      detectedNeeds,
      shouldUseHeuristicFallback,
    };
  }

  if (detectedNeeds.includes("pricing")) {
    return {
      intent: "pricing",
      askCategory: "pricing",
      stage: "pricing",
      customerGoal: s(text),
      domainHint,
      detectedNeeds,
      shouldUseHeuristicFallback,
    };
  }

  if (detectedNeeds.includes("timeline")) {
    return {
      intent: "timeline",
      askCategory: "timeline",
      stage: "timeline",
      customerGoal: s(text),
      domainHint,
      detectedNeeds,
      shouldUseHeuristicFallback,
    };
  }

  if (detectedNeeds.includes("recommendation")) {
    return {
      intent: "service_interest",
      askCategory: "recommendation",
      stage: "recommendation",
      customerGoal: s(text),
      domainHint,
      detectedNeeds,
      shouldUseHeuristicFallback,
    };
  }

  if (
    detectedNeeds.includes("website") ||
    detectedNeeds.includes("ecommerce") ||
    detectedNeeds.includes("software") ||
    detectedNeeds.includes("booking")
  ) {
    return {
      intent: "service_interest",
      askCategory: "service_interest",
      stage: "discovery",
      customerGoal: s(text),
      domainHint,
      detectedNeeds,
      shouldUseHeuristicFallback: true,
    };
  }

  return {
    intent: "general",
    askCategory: "general",
    stage: "discovery",
    customerGoal: s(text),
    domainHint,
    detectedNeeds,
    shouldUseHeuristicFallback,
  };
}

function buildHeuristicServiceInterestReply({
  text = "",
  profile = {},
  heuristic = {},
}) {
  const brandName = s(profile?.displayName || "Biz");
  const primaryLeadPrompt = sanitizeReplyText(pickBehaviorLeadPrompt(profile));
  const domainHint = s(heuristic?.domainHint || "");
  const needs = arr(heuristic?.detectedNeeds).map((x) => s(x)).filter(Boolean);

  const domainLeadMap = {
    hotel: "Hotel üçün",
    clinic: "Klinika üçün",
    restaurant: "Restoran üçün",
    salon: "Salon üçün",
    real_estate: "Daşınmaz əmlak üçün",
    education: "Təhsil layihəsi üçün",
  };

  let projectType = "";
  if (needs.includes("ecommerce")) {
    projectType = "online satış yönümlü sayt";
  } else if (needs.includes("software")) {
    projectType = "xüsusi software həlli";
  } else if (needs.includes("booking")) {
    projectType = "rezervasiya/booking axını olan sayt və ya sistem";
  } else if (needs.includes("website")) {
    projectType = "veb sayt";
  }

  const leadPrefix = domainHint && domainLeadMap[domainHint] ? domainLeadMap[domainHint] : "";
  const leadSentence =
    leadPrefix && projectType
      ? `${leadPrefix} ${projectType} üzrə kömək edə bilərik.`
      : projectType
        ? `${brandName} olaraq ${projectType} üzrə kömək edə bilərik.`
        : `${brandName} olaraq bu istiqamətdə kömək edə bilərik.`;

  const nextQuestion = primaryLeadPrompt
    ? primaryLeadPrompt
    : "Daha düzgün yönləndirmə üçün əsas məqsədi və 1-2 vacib tələbi yazın.";

  return sanitizeReplyText(`${leadSentence} ${nextQuestion}`);
}

function buildHeuristicPricingReply({
  profile = {},
  heuristic = {},
}) {
  const needs = arr(heuristic?.detectedNeeds).map((x) => s(x)).filter(Boolean);

  let pricingObject = "layihə";
  if (needs.includes("website")) pricingObject = "veb sayt";
  if (needs.includes("ecommerce")) pricingObject = "e-commerce layihəsi";
  if (needs.includes("software")) pricingObject = "software həlli";
  if (needs.includes("booking")) pricingObject = "booking funksiyalı layihə";

  return sanitizeReplyText(
    `Dəqiq qiymət ${pricingObject} üzrə scope, funksiyalar və iş həcminə görə dəyişir. Təxmini yönləndirmə üçün əsas məqsədi, vacib funksiyaları və varsa deadline-i yazın.`
  );
}

function buildHeuristicTimelineReply({
  profile = {},
  heuristic = {},
}) {
  const needs = arr(heuristic?.detectedNeeds).map((x) => s(x)).filter(Boolean);

  let timelineObject = "layihə";
  if (needs.includes("website")) timelineObject = "veb sayt";
  if (needs.includes("ecommerce")) timelineObject = "e-commerce sayt";
  if (needs.includes("software")) timelineObject = "software layihəsi";

  return sanitizeReplyText(
    `${timelineObject} üzrə müddət scope və təsdiqlənən funksiyalardan asılı olur. Dəqiq yönləndirmə üçün nə qurmaq istədiyinizi və əsas prioritetləri yazın.`
  );
}

function buildHeuristicSupportReply() {
  return sanitizeReplyText(
    "Kömək edək. Problemin nə olduğunu və harada baş verdiyini qısa yazın."
  );
}

function buildHeuristicGeneralReply({
  profile = {},
  heuristic = {},
}) {
  const brandName = s(profile?.displayName || "Biz");
  const nextQuestion = sanitizeReplyText(pickBehaviorLeadPrompt(profile));

  if (s(heuristic?.customerGoal || "")) {
    return sanitizeReplyText(
      `${brandName} olaraq bu mövzu üzrə kömək edə bilərik. ${nextQuestion || "Daha düzgün yönləndirmə üçün məqsədinizi bir az daha konkret yazın."}`
    );
  }

  return sanitizeReplyText(
    `${brandName} olaraq kömək edə bilərik. ${nextQuestion || "Əsas ehtiyacınızı qısa yazın."}`
  );
}

function buildHeuristicFallbackDecision({
  text = "",
  profile = {},
  matchedKnowledge = [],
  matchedPlaybook = null,
}) {
  if (matchedPlaybook) {
    const replyText = sanitizeReplyText(buildPlaybookReply(matchedPlaybook, profile));
    return {
      language: s(profile?.languages?.[0] || "az"),
      semanticIntent: "playbook",
      askCategory: "general",
      conversationStage: "answer",
      replyStyle: "consultative",
      customerGoal: s(text),
      knownFacts: [],
      missingFacts: [],
      groundedFactsUsed: ["heuristic_playbook"],
      answerFirst: replyText,
      recommendedNextQuestion: "",
      replyText,
      createLead: Boolean(matchedPlaybook.createLead),
      handoff: Boolean(matchedPlaybook.handoff),
      handoffReason: s(matchedPlaybook.handoffReason || ""),
      handoffPriority: s(matchedPlaybook.handoffPriority || "normal"),
      noReply: false,
      confidence: 0.74,
      leadScore: matchedPlaybook.createLead ? 64 : 28,
      heuristic: true,
      heuristicReason: "matched_playbook",
    };
  }

  if (matchedKnowledge.length) {
    const replyText = sanitizeReplyText(buildKnowledgeReply(matchedKnowledge, profile));
    return {
      language: s(profile?.languages?.[0] || "az"),
      semanticIntent: "knowledge_answer",
      askCategory: "faq",
      conversationStage: "answer",
      replyStyle: "consultative",
      customerGoal: s(text),
      knownFacts: [],
      missingFacts: [],
      groundedFactsUsed: ["heuristic_knowledge"],
      answerFirst: replyText,
      recommendedNextQuestion: "",
      replyText,
      createLead: false,
      handoff: false,
      handoffReason: "",
      handoffPriority: "normal",
      noReply: false,
      confidence: 0.68,
      leadScore: 24,
      heuristic: true,
      heuristicReason: "matched_knowledge",
    };
  }

  const heuristic = detectHeuristicIntent(text);

  let replyText = "";
  if (heuristic.intent === "pricing") {
    replyText = buildHeuristicPricingReply({ profile, heuristic });
  } else if (heuristic.intent === "timeline") {
    replyText = buildHeuristicTimelineReply({ profile, heuristic });
  } else if (heuristic.intent === "support") {
    replyText = buildHeuristicSupportReply();
  } else if (heuristic.intent === "service_interest") {
    replyText = buildHeuristicServiceInterestReply({ text, profile, heuristic });
  } else {
    replyText = buildHeuristicGeneralReply({ profile, heuristic });
  }

  return {
    language: s(profile?.languages?.[0] || "az"),
    semanticIntent: heuristic.intent || "general",
    askCategory: heuristic.askCategory || "general",
    conversationStage: heuristic.stage || "general",
    replyStyle: "consultative",
    customerGoal: s(heuristic.customerGoal || text),
    knownFacts: [],
    missingFacts: [],
    groundedFactsUsed: ["heuristic_message_understanding"],
    answerFirst: replyText,
    recommendedNextQuestion: "",
    replyText,
    createLead: heuristic.intent === "service_interest" || heuristic.intent === "pricing",
    handoff: false,
    handoffReason: "",
    handoffPriority: "normal",
    noReply: false,
    confidence: heuristic.shouldUseHeuristicFallback ? 0.62 : 0.42,
    leadScore:
      heuristic.intent === "service_interest"
        ? 58
        : heuristic.intent === "pricing"
          ? 54
          : heuristic.intent === "timeline"
            ? 50
            : heuristic.intent === "support"
              ? 38
              : 26,
    heuristic: true,
    heuristicReason: "message_intent_guardrail",
  };
}

function buildRuntimeSnapshot(profile = {}) {
  const enabledServiceCatalog = arr(profile?.serviceCatalog)
    .filter((item) => item?.active && item?.visibleInAi)
    .map((item) => ({
      key: s(item.key),
      name: s(item.name),
      description: s(item.description),
      aliases: arr(item.aliases).map((x) => s(x)).filter(Boolean).slice(0, 8),
      pricingMode: s(item.pricingMode),
      responseMode: s(item.responseMode),
      contactCaptureMode: s(item.contactCaptureMode),
      handoffMode: s(item.handoffMode),
    }));

  const disabledServiceCatalog = arr(profile?.serviceCatalog)
    .filter((item) => !item?.active && item?.visibleInAi)
    .map((item) => ({
      key: s(item.key),
      name: s(item.name),
      aliases: arr(item.aliases).map((x) => s(x)).filter(Boolean).slice(0, 8),
      disabledReplyText: s(item.disabledReplyText),
    }));

  return {
    displayName: s(profile?.displayName),
    industry: s(profile?.industry),
    businessSummary: s(profile?.businessSummary),
    services: arr(profile?.services).map((x) => s(x)).filter(Boolean),
    disabledServices: arr(profile?.disabledServices).map((x) => s(x)).filter(Boolean),
    languages: arr(profile?.languages).map((x) => s(x)).filter(Boolean),
    tone: s(profile?.tone),
    toneProfile: s(profile?.toneProfile),
    conversionGoal: s(profile?.conversionGoal),
    primaryCta: s(profile?.primaryCta),
    leadQualificationMode: s(profile?.leadQualificationMode),
    bookingFlowType: s(profile?.bookingFlowType),
    qualificationQuestions: arr(profile?.qualificationQuestions).map((x) => s(x)).filter(Boolean),
    handoffTriggers: arr(profile?.handoffTriggers).map((x) => s(x)).filter(Boolean),
    disallowedClaims: arr(profile?.disallowedClaims).map((x) => s(x)).filter(Boolean),
    channelBehaviorInbox: obj(profile?.channelBehavior?.inbox),
    behaviorSource: s(profile?.behavior?.source),
    greetingEnabled: Boolean(profile?.behavior?.greetingEnabled),
    greetingMode: s(profile?.behavior?.greetingMode),
    introMode: s(profile?.behavior?.introMode),
    customGreeting: s(profile?.behavior?.customGreeting),
    enabledServiceCatalog,
    disabledServiceCatalog,
  };
}

function buildPromptKnowledge(matchedKnowledge = []) {
  return matchedKnowledge.map((item) => ({
    title: s(item?.title),
    question: s(item?.question),
    answer: s(item?.answer),
    keywords: arr(item?.keywords).map((x) => s(x)).filter(Boolean).slice(0, 12),
  }));
}

function buildPromptPlaybook(matchedPlaybook = null) {
  if (!matchedPlaybook) return {};
  return {
    name: s(matchedPlaybook.name),
    triggerKeywords: arr(matchedPlaybook.triggerKeywords).map((x) => s(x)).filter(Boolean),
    replyTemplate: s(matchedPlaybook.replyTemplate),
    actionType: s(matchedPlaybook.actionType),
    createLead: Boolean(matchedPlaybook.createLead),
    handoff: Boolean(matchedPlaybook.handoff),
    handoffReason: s(matchedPlaybook.handoffReason),
    handoffPriority: s(matchedPlaybook.handoffPriority || "normal"),
  };
}

function buildConversationSnapshot({
  text,
  recentMessages = [],
  customerContext = {},
  formData = {},
  leadContext = {},
  conversationContext = {},
  threadState = null,
}) {
  const latestMessage = s(text);
  const latestMessageWithoutCommand = stripLeadingCommand(latestMessage);
  const normalizedHistory = buildHistorySnippet(recentMessages, 8);

  return {
    latestCustomerMessage: latestMessage,
    latestCustomerMessageWithoutCommand: latestMessageWithoutCommand || latestMessage,
    historySnippet: normalizedHistory || "(empty)",
    commandOnly: isCommandOnly(latestMessage),
    customerContext: obj(customerContext),
    formData: obj(formData),
    leadContext: obj(leadContext),
    conversationContext: obj(conversationContext),
    threadState: obj(threadState),
  };
}

function buildTraceFromDecision({
  resolvedRuntime,
  policy,
  promptBundle,
  channel,
  result,
}) {
  return buildAgentReplayTrace({
    runtime: resolvedRuntime,
    behavior: resolvedRuntime.behavior,
    policy,
    promptBundle,
    channel: channel || "inbox",
    usecase: "inbox.reply",
    decisions: {
      cta: {
        selected: resolvedRuntime.primaryCta,
        reason: "approved_runtime_behavior",
      },
      qualification: {
        mode: obj(resolvedRuntime.channelBehavior?.inbox).qualificationDepth,
        questionCount: arr(result.missingFacts).length,
        reason: arr(result.missingFacts).length ? "semantic_interpreter" : "",
      },
      handoff: {
        reason: s(result.handoffReason || ""),
        priority: s(result.handoffPriority || "normal").toLowerCase(),
      },
    },
    evaluation: {
      outcome: Boolean(result.handoff)
        ? "handoff_recommended"
        : Boolean(result.noReply)
          ? "no_reply_recommended"
          : "reply_recommended",
      ctaDirection: Boolean(result.handoff)
        ? "handoff"
        : Boolean(result.noReply)
          ? "none"
          : "reply_with_cta",
      qualification: {
        status: s(result.stage || "general"),
        questionCount: arr(result.missingFacts).length,
      },
      handoff: {
        status: Boolean(result.handoff) ? "recommended" : "clear",
        reason: s(result.handoffReason || ""),
        priority: s(result.handoffPriority || "normal").toLowerCase(),
      },
    },
    decisionPath: {
      status: Boolean(result.handoff)
        ? "escalated_to_operator"
        : Boolean(result.noReply)
          ? "no_reply"
          : "answered",
      reasonCode:
        s(result.handoffReason || "") ||
        (Boolean(result.handoff)
          ? "ai_handoff_recommended"
          : Boolean(result.noReply)
            ? "ai_no_reply_recommended"
            : "semantic_reply_generated"),
      detail: s(result.stage || ""),
    },
  });
}

function buildFallbackSemanticDecision({
  profile,
  matchedKnowledge = [],
  matchedPlaybook = null,
  conversation,
}) {
  return buildHeuristicFallbackDecision({
    text: conversation?.latestCustomerMessageWithoutCommand || conversation?.latestCustomerMessage || "",
    profile,
    matchedKnowledge,
    matchedPlaybook,
  });
}

function hasMeaningfulSemanticPayload(parsed = {}) {
  if (!parsed || typeof parsed !== "object") return false;

  return Boolean(
    s(parsed.semanticIntent || parsed.intent) ||
      s(parsed.replyText) ||
      s(parsed.answerFirst) ||
      s(parsed.recommendedNextQuestion) ||
      s(parsed.customerGoal) ||
      arr(parsed.knownFacts).length ||
      arr(parsed.missingFacts).length
  );
}

function looksGenericRestateReply(replyText = "", customerGoal = "") {
  const reply = normalizeForIntent(replyText);
  const goal = normalizeForIntent(customerGoal);

  if (!reply) return false;

  const genericPatterns = [
    "esas ehtiyacinizi bir cumle ile yazin",
    "hazirda size en vacib olan ehtiyaci bir cumle ile yazin",
    "ne qurmaq almaq ve ya hell etmek istediyinizi bir cumle ile yazin",
    "sizin ucun en vacib neticeni bir cumle ile yazin",
    "qisa olaraq size hansi xidmet ve ya mehsul lazim oldugunu yazin",
    "ehtiyacinizi bir cumle ile yazin",
  ];

  const isGeneric = genericPatterns.some((pattern) => reply.includes(pattern));
  if (!isGeneric) return false;

  return goal.length >= 16 || goal.split(" ").length >= 4;
}

function shouldUseHeuristicGuardrail({
  parsed = null,
  fallbackDecision = {},
  conversation = {},
}) {
  const goal = s(
    conversation?.latestCustomerMessageWithoutCommand ||
      conversation?.latestCustomerMessage ||
      ""
  );

  const heuristic = detectHeuristicIntent(goal);
  if (!heuristic.shouldUseHeuristicFallback) return false;

  if (!parsed || typeof parsed !== "object") return true;

  const parsedIntent = s(parsed?.semanticIntent || parsed?.intent || "").toLowerCase();
  const parsedReply = sanitizeReplyText(parsed?.replyText || parsed?.answerFirst || "");
  const parsedGoal = s(parsed?.customerGoal || "");

  if (!parsedIntent) return true;
  if (!parsedReply) return true;

  if (
    heuristic.intent === "service_interest" &&
    ["greeting", "general"].includes(parsedIntent) &&
    looksGenericRestateReply(parsedReply, goal)
  ) {
    return true;
  }

  if (
    heuristic.intent === "pricing" &&
    !["pricing", "quote"].includes(parsed?.askCategory || "") &&
    looksGenericRestateReply(parsedReply, goal)
  ) {
    return true;
  }

  if (!parsedGoal && goal.length >= 18 && looksGenericRestateReply(parsedReply, goal)) {
    return true;
  }

  return false;
}

function normalizeAiResult({
  parsed,
  fallbackDecision,
  profile,
  matchedKnowledge,
  matchedPlaybook,
  resolvedRuntime,
  promptBundle,
  channel,
  policy,
  raw = "",
  repairRaw = "",
  replyMode = "semantic",
  semanticFailureReason = "",
}) {
  const answerFirst = sanitizeSentence(parsed?.answerFirst || "");
  const recommendedNextQuestion = sanitizeSentence(
    parsed?.recommendedNextQuestion || ""
  );

  let replyText = sanitizeReplyText(parsed?.replyText || "");
  if (!replyText) {
    replyText = joinReplyParts(answerFirst, recommendedNextQuestion);
  }
  if (!replyText) {
    replyText = sanitizeReplyText(fallbackDecision.replyText || "");
  }

  const intent = s(
    parsed?.semanticIntent ||
      parsed?.intent ||
      fallbackDecision.semanticIntent ||
      "general"
  ) || "general";

  const askCategory = normalizeAskCategory(
    parsed?.askCategory || fallbackDecision.askCategory || "general"
  );

  let finalReplyText = replyText;
  if (intent === "unsupported_service" && !finalReplyText) {
    finalReplyText = sanitizeReplyText(buildUnsupportedServiceReply(profile));
  }

  const result = {
    language: s(parsed?.language || fallbackDecision.language || profile?.languages?.[0] || "az"),
    intent,
    askCategory,
    stage: normalizeStage(
      parsed?.conversationStage ||
        parsed?.stage ||
        fallbackDecision.conversationStage ||
        "general"
    ),
    replyStyle: normalizeReplyStyle(
      parsed?.replyStyle || fallbackDecision.replyStyle || "consultative"
    ),
    customerGoal: s(parsed?.customerGoal || fallbackDecision.customerGoal || ""),
    answerFirst: answerFirst || sanitizeSentence(fallbackDecision.answerFirst || ""),
    recommendedNextQuestion:
      recommendedNextQuestion ||
      sanitizeSentence(fallbackDecision.recommendedNextQuestion || ""),
    replyText: finalReplyText,
    knownFacts:
      coerceStringArray(parsed?.knownFacts).length
        ? coerceStringArray(parsed?.knownFacts)
        : coerceStringArray(fallbackDecision.knownFacts),
    missingFacts:
      coerceStringArray(parsed?.missingFacts).length
        ? coerceStringArray(parsed?.missingFacts)
        : coerceStringArray(fallbackDecision.missingFacts),
    groundedFactsUsed:
      coerceStringArray(parsed?.groundedFactsUsed).length
        ? coerceStringArray(parsed?.groundedFactsUsed)
        : coerceStringArray(fallbackDecision.groundedFactsUsed),
    confidence: Math.max(
      0,
      Math.min(1, coerceNumber(parsed?.confidence, fallbackDecision.confidence || 0.45))
    ),
    leadScore: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          coerceNumber(parsed?.leadScore, fallbackDecision.leadScore || 0)
        )
      )
    ),
    createLead: coerceBoolean(
      parsed?.createLead,
      Boolean(fallbackDecision.createLead)
    ),
    handoff: coerceBoolean(parsed?.handoff, Boolean(fallbackDecision.handoff)),
    handoffReason: s(parsed?.handoffReason || fallbackDecision.handoffReason || ""),
    handoffPriority: normalizePriority(
      parsed?.handoffPriority || fallbackDecision.handoffPriority || "normal"
    ),
    noReply: coerceBoolean(parsed?.noReply, false),
    raw,
    repairRaw,
    replyMode,
    usedFallback: replyMode === "fallback" || replyMode === "fallback_heuristic",
    usedFastLane: replyMode.startsWith("fast_lane"),
    fastLaneReason: s(parsed?.fastLaneReason || ""),
    semanticFailureReason: s(semanticFailureReason || ""),
    profile,
    matchedKnowledge,
    matchedPlaybook,
    runtime: resolvedRuntime,
    promptBundle,
    trace: {},
    heuristic: Boolean(fallbackDecision?.heuristic),
    heuristicReason: s(fallbackDecision?.heuristicReason || ""),
  };

  if (!result.replyText) {
    result.replyText = joinReplyParts(
      result.answerFirst,
      result.recommendedNextQuestion
    );
  }

  if (result.intent === "unsupported_service" && !result.replyText) {
    result.replyText = sanitizeReplyText(buildUnsupportedServiceReply(profile));
  }

  result.trace = buildTraceFromDecision({
    resolvedRuntime,
    policy,
    promptBundle,
    channel,
    result,
  });

  return result;
}

function applyReplyComposer({
  result,
  profile,
  text,
  recentMessages,
}) {
  const composed = composeTenantAwareReply({
    result,
    profile,
    text,
    recentMessages,
  });

  return {
    ...result,
    replyBodyText: composed.replyBodyText,
    replyText: composed.replyText || result.replyText,
    greetingApplied: Boolean(composed.greetingApplied),
    greetingText: s(composed.greetingText),
    greetingMode: s(composed.greetingMode),
    usedCustomGreeting: Boolean(composed.usedCustomGreeting),
    introModeUsed: s(composed.introModeUsed),
    behaviorSource: s(composed.behaviorSource || profile?.behavior?.source || ""),
    language: s(composed.language || result.language || profile?.languages?.[0] || "az"),
    greetingOnly: Boolean(composed.greetingOnly),
  };
}

async function runOpenAiText({
  openai,
  model,
  maxOutputTokens,
  systemPrompt,
  userPrompt,
}) {
  const resp = await openai.responses.create({
    model,
    text: { format: { type: "text" } },
    max_output_tokens: maxOutputTokens,
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  return extractText(resp);
}

function buildSemanticPromptInput({
  promptBundle,
  profile,
  conversation,
  matchedKnowledge,
  matchedPlaybook,
  policy,
}) {
  return {
    fullPrompt: promptBundle.fullPrompt,
    latestMessageJson: JSON.stringify(conversation.latestCustomerMessage),
    latestMessageWithoutCommandJson: JSON.stringify(
      conversation.latestCustomerMessageWithoutCommand
    ),
    historySnippet: conversation.historySnippet,
    runtimeSnapshotJson: compactJson(buildRuntimeSnapshot(profile)),
    knowledgeJson: compactJson(buildPromptKnowledge(matchedKnowledge)),
    playbookJson: compactJson(buildPromptPlaybook(matchedPlaybook)),
    additionalContextJson: compactJson({
      customerContext: conversation.customerContext,
      formData: conversation.formData,
      leadContext: conversation.leadContext,
      conversationContext: conversation.conversationContext,
      threadState: conversation.threadState,
      policy: {
        autoReplyEnabled: Boolean(policy?.autoReplyEnabled),
        createLeadEnabled: Boolean(policy?.createLeadEnabled),
        handoffEnabled: Boolean(policy?.handoffEnabled),
      },
    }),
  };
}

async function tryRepairSemanticJson({
  openai,
  model,
  maxOutputTokens,
  conversation,
  profile,
  raw,
  fallbackDecision,
}) {
  if (!s(raw)) {
    return {
      parsed: null,
      repairRaw: "",
      semanticFailureReason: "empty_semantic_output",
    };
  }

  const repairSystemPrompt = buildSemanticRepairSystemPrompt();
  const repairUserPrompt = buildSemanticRepairUserPrompt({
    latestMessageJson: JSON.stringify(conversation.latestCustomerMessage),
    latestMessageWithoutCommandJson: JSON.stringify(
      conversation.latestCustomerMessageWithoutCommand
    ),
    historySnippet: conversation.historySnippet,
    runtimeSnapshotJson: compactJson(buildRuntimeSnapshot(profile)),
    rawModelOutputJson: JSON.stringify(raw),
    fallbackReferenceJson: compactJson(fallbackDecision),
  });

  try {
    const repairRaw = await runOpenAiText({
      openai,
      model,
      maxOutputTokens,
      systemPrompt: repairSystemPrompt,
      userPrompt: repairUserPrompt,
    });

    const repaired = parseJsonLoose(repairRaw);

    if (!repaired || typeof repaired !== "object") {
      return {
        parsed: null,
        repairRaw,
        semanticFailureReason: "semantic_repair_invalid_json",
      };
    }

    if (!hasMeaningfulSemanticPayload(repaired)) {
      return {
        parsed: null,
        repairRaw,
        semanticFailureReason: "semantic_repair_weak_payload",
      };
    }

    return {
      parsed: repaired,
      repairRaw,
      semanticFailureReason: "",
    };
  } catch (error) {
    return {
      parsed: null,
      repairRaw: "",
      semanticFailureReason: s(error?.message || "semantic_repair_failed"),
    };
  }
}

export async function aiDecideInbox({
  text,
  channel,
  externalUserId,
  tenantKey,
  thread,
  message,
  tenant = null,
  policy,
  quietHoursApplied,
  recentMessages = [],
  reliability = {},
  customerContext = {},
  formData = {},
  leadContext = {},
  conversationContext = {},
  services = [],
  knowledgeEntries = [],
  responsePlaybooks = [],
  threadState = null,
  runtime = null,
}) {
  const openAiConfig = summarizeOpenAIConfig();
  const openai = ensureOpenAI();

  const model = openAiConfig.model;
  const maxOutputTokens = openAiConfig.maxOutputTokens;

  const resolvedRuntime =
    runtime ||
    (await resolveInboxRuntime({
      tenantKey,
      tenant,
      services,
      knowledgeEntries,
      responsePlaybooks,
      threadState,
      channel,
      thread,
      message,
      recentMessages,
      customerContext,
      formData,
      leadContext,
      conversationContext,
    }));

  const profile = resolvedRuntime;
  const servicesLine = buildServiceLine(profile);
  const disabledServicesLine = buildDisabledServiceLine(profile);
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);

  const matchedKnowledge = matchKnowledgeEntries(
    text,
    resolvedRuntime.knowledgeEntries,
    5
  );
  const matchedPlaybook = matchPlaybook(text, resolvedRuntime.responsePlaybooks);

  const conversation = buildConversationSnapshot({
    text,
    recentMessages,
    customerContext,
    formData,
    leadContext,
    conversationContext,
    threadState: resolvedRuntime.threadState || threadState || null,
  });

  const fallbackDecision = buildFallbackSemanticDecision({
    profile,
    matchedKnowledge,
    matchedPlaybook,
    conversation,
  });

  const promptBundle = buildPromptBundle("inbox.reply", {
    tenant: {
      ...obj(tenant),
      tenantKey: resolvedTenantKey,
      tenantId: resolvedTenantKey,
      companyName: profile.displayName,
      brandName: profile.displayName,
      industryKey: profile.industry,
      outputLanguage: profile.languages?.[0] || "az",
      toneText: profile.tone,
      services: profile.services,
      servicesText: servicesLine || "general business services",
      businessContext: profile.businessSummary || "",
      ai_policy: {
        ...obj(tenant?.ai_policy),
        ...obj(profile.aiPolicy),
      },
      behavior: {
        niche: s(profile.industry),
        conversionGoal: s(profile.conversionGoal),
        primaryCta: s(profile.primaryCta),
        toneProfile: s(profile.toneProfile),
        disallowedClaims: arr(profile.disallowedClaims),
        handoffTriggers: arr(profile.handoffTriggers),
        channelBehavior: obj(profile.channelBehavior),
      },
      profile: {
        ...obj(tenant?.profile),
        ...obj(profile.profile),
        brand_name: profile.displayName,
        tone_of_voice: profile.tone,
      },
    },
    extra: {
      channel: JSON.stringify(s(channel || "inbox")),
      externalUserId: JSON.stringify(s(externalUserId || "")),
      threadId: JSON.stringify(s(thread?.id || "")),
      messageId: JSON.stringify(s(message?.id || "")),
      threadStatus: JSON.stringify(s(thread?.status || "open")),
      quietHoursApplied: quietHoursApplied ? "true" : "false",
      policyAutoReplyEnabled: Boolean(policy?.autoReplyEnabled),
      policyCreateLeadEnabled: Boolean(policy?.createLeadEnabled),
      policyHandoffEnabled: Boolean(policy?.handoffEnabled),
      servicesLine: JSON.stringify(servicesLine),
      disabledServicesLine: JSON.stringify(disabledServicesLine),
      incomingMessage: JSON.stringify(String(text || "")),
      historySnippet: conversation.historySnippet,
      customerContext: compactJson(customerContext || {}),
      formData: compactJson(formData || {}),
      leadContext: compactJson(leadContext || {}),
      conversationContext: compactJson(conversationContext || {}),
      threadState: compactJson(resolvedRuntime.threadState || threadState || {}),
      reliability: compactJson(reliability || {}),
      matchedKnowledge: compactJson(buildPromptKnowledge(matchedKnowledge)),
      matchedPlaybook: compactJson(buildPromptPlaybook(matchedPlaybook)),
      runtimeSnapshot: compactJson(buildRuntimeSnapshot(profile)),
      fallbackDecision: compactJson({
        intent: fallbackDecision.semanticIntent,
        askCategory: fallbackDecision.askCategory,
        stage: fallbackDecision.conversationStage,
        replyText: fallbackDecision.replyText,
        heuristicReason: fallbackDecision.heuristicReason,
      }),
    },
  });

  const fastLaneDecision = tryFastLaneInboxDecision({
    text,
    profile,
    matchedKnowledge,
    matchedPlaybook,
  });

  if (fastLaneDecision) {
    const fastLaneResult = applyReplyComposer({
      result: normalizeAiResult({
        parsed: fastLaneDecision,
        fallbackDecision,
        profile,
        matchedKnowledge,
        matchedPlaybook,
        resolvedRuntime,
        promptBundle,
        channel,
        policy,
        raw: "",
        repairRaw: "",
        replyMode: `fast_lane_${s(fastLaneDecision.fastLaneReason || "direct")}`,
        semanticFailureReason: "",
      }),
      profile,
      text,
      recentMessages,
    });

    logInboxAi("fast_lane_hit", {
      tenantKey: resolvedTenantKey,
      channel: s(channel || "inbox"),
      reason: s(fastLaneDecision.fastLaneReason || ""),
      replyMode: fastLaneResult.replyMode,
      replyPreview: safePreview(fastLaneResult.replyText, 180),
    });

    return fastLaneResult;
  }

  if (!openai) {
    logInboxAiWarn("unavailable_using_fallback", {
      tenantKey: resolvedTenantKey,
      channel: s(channel || "inbox"),
      reason: "openai_api_key_missing",
      model,
      hasApiKey: openAiConfig.hasApiKey,
      apiKeyLength: openAiConfig.apiKeyLength,
    });

    return applyReplyComposer({
      result: normalizeAiResult({
        parsed: fallbackDecision,
        fallbackDecision,
        profile,
        matchedKnowledge,
        matchedPlaybook,
        resolvedRuntime,
        promptBundle,
        channel,
        policy,
        raw: "",
        repairRaw: "",
        replyMode: "fallback_heuristic",
        semanticFailureReason: "openai_api_key_missing",
      }),
      profile,
      text,
      recentMessages,
    });
  }

  const semanticPromptInput = buildSemanticPromptInput({
    promptBundle,
    profile,
    conversation,
    matchedKnowledge,
    matchedPlaybook,
    policy,
  });

  logInboxAi("request_start", {
    tenantKey: resolvedTenantKey,
    channel: s(channel || "inbox"),
    model,
    maxOutputTokens,
    quietHoursApplied: Boolean(quietHoursApplied),
    matchedKnowledgeCount: matchedKnowledge.length,
    hasMatchedPlaybook: Boolean(matchedPlaybook),
    threadId: s(thread?.id),
    messageId: s(message?.id),
  });

  try {
    const raw = await runOpenAiText({
      openai,
      model,
      maxOutputTokens,
      systemPrompt: buildSemanticSystemPrompt(),
      userPrompt: buildSemanticUserPrompt(semanticPromptInput),
    });

    let parsed = parseJsonLoose(raw);
    let repairRaw = "";
    let replyMode = "semantic";
    let semanticFailureReason = "";

    const shouldAttemptRepair =
      s(text).trim().length >= 10 || matchedKnowledge.length > 0 || matchedPlaybook;

    if ((!parsed || typeof parsed !== "object") && shouldAttemptRepair) {
      logInboxAiWarn("invalid_json", {
        tenantKey: resolvedTenantKey,
        channel: s(channel || "inbox"),
        model,
        rawPreview: safePreview(raw),
      });

      const repaired = await tryRepairSemanticJson({
        openai,
        model,
        maxOutputTokens,
        conversation,
        profile,
        raw,
        fallbackDecision,
      });

      parsed = repaired.parsed;
      repairRaw = repaired.repairRaw;
      semanticFailureReason = repaired.semanticFailureReason;

      if (parsed) {
        replyMode = "semantic_repaired";
        logInboxAi("repair_succeeded", {
          tenantKey: resolvedTenantKey,
          channel: s(channel || "inbox"),
          model,
          repairRawPreview: safePreview(repairRaw),
        });
      } else {
        replyMode = "fallback_heuristic";
        logInboxAiWarn("repair_failed_using_fallback", {
          tenantKey: resolvedTenantKey,
          channel: s(channel || "inbox"),
          model,
          semanticFailureReason,
          rawPreview: safePreview(raw),
          repairRawPreview: safePreview(repairRaw),
        });
      }
    } else if ((!parsed || typeof parsed !== "object") && !shouldAttemptRepair) {
      replyMode = "fallback_heuristic";
      semanticFailureReason = "invalid_json_no_repair";
    } else if (!hasMeaningfulSemanticPayload(parsed) && shouldAttemptRepair) {
      logInboxAiWarn("weak_semantic_payload", {
        tenantKey: resolvedTenantKey,
        channel: s(channel || "inbox"),
        model,
        rawPreview: safePreview(raw),
      });

      const repaired = await tryRepairSemanticJson({
        openai,
        model,
        maxOutputTokens,
        conversation,
        profile,
        raw,
        fallbackDecision,
      });

      parsed = repaired.parsed;
      repairRaw = repaired.repairRaw;
      semanticFailureReason = repaired.semanticFailureReason || "weak_semantic_payload";

      if (parsed) {
        replyMode = "semantic_repaired";
        logInboxAi("repair_succeeded", {
          tenantKey: resolvedTenantKey,
          channel: s(channel || "inbox"),
          model,
          repairRawPreview: safePreview(repairRaw),
        });
      } else {
        replyMode = "fallback_heuristic";
        logInboxAiWarn("weak_payload_using_fallback", {
          tenantKey: resolvedTenantKey,
          channel: s(channel || "inbox"),
          model,
          semanticFailureReason,
          rawPreview: safePreview(raw),
          repairRawPreview: safePreview(repairRaw),
        });
      }
    } else if (!hasMeaningfulSemanticPayload(parsed) && !shouldAttemptRepair) {
      replyMode = "fallback_heuristic";
      semanticFailureReason = "weak_payload_no_repair";
    }

    if (
      shouldUseHeuristicGuardrail({
        parsed,
        fallbackDecision,
        conversation,
      })
    ) {
      parsed = fallbackDecision;
      replyMode =
        replyMode === "semantic" || replyMode === "semantic_repaired"
          ? "semantic_guardrail_heuristic"
          : "fallback_heuristic";
      semanticFailureReason =
        semanticFailureReason || "semantic_generic_restate_guardrail";
      logInboxAiWarn("heuristic_guardrail_override", {
        tenantKey: resolvedTenantKey,
        channel: s(channel || "inbox"),
        model,
        replyMode,
        semanticFailureReason,
        fallbackHeuristicReason: s(fallbackDecision?.heuristicReason || ""),
        customerGoal: s(
          conversation?.latestCustomerMessageWithoutCommand ||
            conversation?.latestCustomerMessage ||
            ""
        ),
        rawPreview: safePreview(raw),
      });
    }

    const result = applyReplyComposer({
      result: normalizeAiResult({
        parsed:
          replyMode === "fallback_heuristic" ||
          replyMode === "semantic_guardrail_heuristic"
            ? fallbackDecision
            : parsed,
        fallbackDecision,
        profile,
        matchedKnowledge,
        matchedPlaybook,
        resolvedRuntime,
        promptBundle,
        channel,
        policy,
        raw,
        repairRaw,
        replyMode,
        semanticFailureReason,
      }),
      profile,
      text,
      recentMessages,
    });

    logInboxAi("decision", {
      tenantKey: resolvedTenantKey,
      channel: s(channel || "inbox"),
      model,
      intent: result.intent,
      askCategory: result.askCategory,
      stage: result.stage,
      replyStyle: result.replyStyle,
      noReply: result.noReply,
      createLead: result.createLead,
      handoff: result.handoff,
      handoffReason: result.handoffReason,
      handoffPriority: result.handoffPriority,
      leadScore: result.leadScore,
      confidence: result.confidence,
      groundedFactsUsed: result.groundedFactsUsed,
      knownFacts: result.knownFacts,
      missingFacts: result.missingFacts,
      replyMode: result.replyMode,
      usedFallback: result.usedFallback,
      usedFastLane: result.usedFastLane,
      fastLaneReason: result.fastLaneReason,
      semanticFailureReason: result.semanticFailureReason,
      heuristicReason: result.heuristicReason,
      greetingApplied: result.greetingApplied,
      greetingMode: result.greetingMode,
      usedCustomGreeting: result.usedCustomGreeting,
      introModeUsed: result.introModeUsed,
      behaviorSource: result.behaviorSource,
      replyPreview: safePreview(result.replyText, 180),
    });

    return result;
  } catch (error) {
    logInboxAiError("failed_using_fallback", {
      tenantKey: resolvedTenantKey,
      channel: s(channel || "inbox"),
      model,
      errorName: s(error?.name || "Error"),
      errorMessage: s(error?.message || "Unknown OpenAI error"),
      errorCode: s(error?.code),
      errorType: s(error?.type),
      errorStatus:
        Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
      errorParam: s(error?.param),
      errorRawType: s(error?.error?.type),
      errorRawCode: s(error?.error?.code),
      errorRawMessage: s(error?.error?.message),
    });

    return applyReplyComposer({
      result: normalizeAiResult({
        parsed: fallbackDecision,
        fallbackDecision,
        profile,
        matchedKnowledge,
        matchedPlaybook,
        resolvedRuntime,
        promptBundle,
        channel,
        policy,
        raw: "",
        repairRaw: "",
        replyMode: "fallback_heuristic",
        semanticFailureReason: s(error?.message || "openai_request_failed"),
      }),
      profile,
      text,
      recentMessages,
    });
  }
}