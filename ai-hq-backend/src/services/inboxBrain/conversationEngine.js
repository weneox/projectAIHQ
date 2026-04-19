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
import { matchKnowledgeEntries, matchPlaybook } from "./matchers.js";
import {
  buildDisabledServiceLine,
  buildServiceLine,
  resolveInboxRuntime,
} from "./runtime.js";
import {
  arr,
  getResolvedTenantKey,
  lower,
  normalizeTextForCompare,
  obj,
  s,
  sanitizeReplyText,
  uniqStrings,
} from "./shared.js";
import {
  buildHistorySnippet,
  extractStructuredPayload,
  extractText,
  parseJsonLoose,
  stripLeadingCommand,
} from "./messages.js";
import { composeTenantAwareReply } from "./replyComposer.js";

let openaiSingleton = null;

function ensureOpenAI() {
  const key = s(cfg?.ai?.openaiApiKey || "");
  if (!key) return null;

  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey: key });
  }

  return openaiSingleton;
}

function normalizeLanguage(value = "") {
  const x = lower(value);
  if (!x) return "en";
  if (x.startsWith("az")) return "az";
  if (x.startsWith("tr")) return "tr";
  if (x.startsWith("ru")) return "ru";
  if (x.startsWith("es")) return "es";
  if (x.startsWith("de")) return "de";
  if (x.startsWith("fr")) return "fr";
  if (x.startsWith("it")) return "it";
  if (x.startsWith("pt")) return "pt";
  if (x.startsWith("ar")) return "ar";
  if (x.startsWith("nl")) return "nl";
  if (x.startsWith("pl")) return "pl";
  if (x.startsWith("uk")) return "uk";
  if (x.startsWith("zh")) return "zh";
  if (x.startsWith("ja")) return "ja";
  if (x.startsWith("ko")) return "ko";
  if (x.startsWith("hi")) return "hi";
  return "en";
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

function safePreview(value = "", max = 280) {
  const text = s(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function logConversationEngine(event = "", payload = {}) {
  try {
    console.info(`[ai-hq] conversation engine ${event}`, payload);
  } catch {}
}

function logConversationEngineWarn(event = "", payload = {}) {
  try {
    console.warn(`[ai-hq] conversation engine ${event}`, payload);
  } catch {}
}

function logConversationEngineError(event = "", payload = {}) {
  try {
    console.error(`[ai-hq] conversation engine ${event}`, payload);
  } catch {}
}

function modelLikelySupportsStructuredOutputs(model = "") {
  const x = lower(model);
  return (
    x.startsWith("gpt-4o") ||
    x.startsWith("gpt-4.1") ||
    x.startsWith("gpt-5") ||
    x.startsWith("o1") ||
    x.startsWith("o3") ||
    x.startsWith("o4")
  );
}

function buildConversationDecisionJsonSchemaObject() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      language: { type: "string" },
      understoodIntent: { type: "string" },
      detectedService: { type: "string" },
      customerGoal: { type: "string" },
      answerFirst: { type: "string" },
      nextQuestion: { type: "string" },
      replyText: { type: "string" },
      missingInformation: {
        type: "array",
        items: { type: "string" },
      },
      groundedFactsUsed: {
        type: "array",
        items: { type: "string" },
      },
      shouldAskQuestion: { type: "boolean" },
      shouldCreateLead: { type: "boolean" },
      shouldHandoff: { type: "boolean" },
      handoffReason: { type: "string" },
      handoffPriority: { type: "string" },
      confidence: { type: "number" },
      leadScore: { type: "number" },
      askCategory: { type: "string" },
      stage: { type: "string" },
      replyStyle: { type: "string" },
      noReply: { type: "boolean" },
    },
    required: [
      "language",
      "understoodIntent",
      "detectedService",
      "customerGoal",
      "answerFirst",
      "nextQuestion",
      "replyText",
      "missingInformation",
      "groundedFactsUsed",
      "shouldAskQuestion",
      "shouldCreateLead",
      "shouldHandoff",
      "handoffReason",
      "handoffPriority",
      "confidence",
      "leadScore",
      "askCategory",
      "stage",
      "replyStyle",
      "noReply",
    ],
  };
}

function buildStructuredTextFormat(model = "") {
  if (modelLikelySupportsStructuredOutputs(model)) {
    return {
      type: "json_schema",
      name: "tenant_aware_conversation_decision",
      strict: true,
      schema: buildConversationDecisionJsonSchemaObject(),
    };
  }

  return {
    type: "json_object",
  };
}

function parseStructuredOutput(raw = "", model = "") {
  if (!s(raw)) return null;

  if (modelLikelySupportsStructuredOutputs(model)) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return parseJsonLoose(raw);
}

function extractResponseRefusal(resp = {}) {
  for (const outputItem of arr(resp?.output)) {
    for (const contentItem of arr(outputItem?.content)) {
      if (contentItem?.type === "refusal") {
        return s(contentItem?.refusal || contentItem?.text || "");
      }
    }
  }
  return "";
}

async function runStructuredDecision({
  openai,
  model,
  maxOutputTokens,
  systemPrompt,
  userPrompt,
}) {
  const response = await openai.responses.create({
    model,
    max_output_tokens: maxOutputTokens,
    text: {
      format: buildStructuredTextFormat(model),
    },
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

  const parsed = extractStructuredPayload(response);
  const raw = parsed ? JSON.stringify(parsed) : extractText(response);
  const refusal = extractResponseRefusal(response);

  return {
    raw,
    refusal,
    parsed,
  };
}

function normalizeFreeText(value = "") {
  return lower(s(value))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWordLikeTokens(text = "") {
  const normalized = normalizeFreeText(text);
  if (!normalized) return 0;
  return normalized.split(" ").filter(Boolean).length;
}

function isSubstantiveCustomerTurn(text = "") {
  const normalized = normalizeFreeText(text);
  if (!normalized) return false;
  if (normalized.length >= 18) return true;
  if (countWordLikeTokens(normalized) >= 4) return true;
  if (/[?؟]/u.test(s(text))) return true;
  return false;
}

function normalizePriority(value = "") {
  const x = lower(value);
  return ["low", "normal", "high", "urgent"].includes(x) ? x : "normal";
}

function normalizeReplyStyle(value = "") {
  const x = lower(value);
  if (
    [
      "consultative",
      "direct",
      "reassuring",
      "concise",
      "sales",
      "supportive",
      "professional",
    ].includes(x)
  ) {
    return x;
  }
  return "consultative";
}

function normalizeStage(value = "") {
  const x = lower(value);
  if (
    [
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
    ].includes(x)
  ) {
    return x;
  }
  return "general";
}

function normalizeAskCategory(value = "") {
  const x = lower(value);
  if (
    [
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
    ].includes(x)
  ) {
    return x;
  }
  return "general";
}

function coerceBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const x = lower(value);
    if (["true", "1", "yes"].includes(x)) return true;
    if (["false", "0", "no"].includes(x)) return false;
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
  const historySnippet = buildHistorySnippet(recentMessages, 8);

  return {
    latestCustomerMessage: latestMessage,
    latestCustomerMessageWithoutCommand:
      latestMessageWithoutCommand || latestMessage,
    historySnippet: historySnippet || "(empty)",
    customerContext: obj(customerContext),
    formData: obj(formData),
    leadContext: obj(leadContext),
    conversationContext: obj(conversationContext),
    threadState: obj(threadState),
  };
}

function buildRuntimeGrounding(profile = {}) {
  return {
    displayName: s(profile?.displayName),
    industry: s(profile?.industry),
    businessSummary: s(profile?.businessSummary),
    businessType: s(profile?.businessType),
    niche: s(profile?.niche),
    subNiche: s(profile?.subNiche),
    languages: arr(profile?.languages).map((x) => s(x)).filter(Boolean).slice(0, 6),
    tone: s(profile?.tone),
    toneProfile: s(profile?.toneProfile),
    conversionGoal: s(profile?.conversionGoal),
    leadQualificationMode: s(profile?.leadQualificationMode),
    bookingFlowType: s(profile?.bookingFlowType),
    qualificationQuestions: arr(profile?.qualificationQuestions)
      .map((x) => s(x))
      .filter(Boolean)
      .slice(0, 5),
    leadPrompts: arr(profile?.leadPrompts)
      .map((x) => s(x))
      .filter(Boolean)
      .slice(0, 5),
    handoffTriggers: arr(profile?.handoffTriggers)
      .map((x) => s(x))
      .filter(Boolean)
      .slice(0, 8),
    disallowedClaims: arr(profile?.disallowedClaims)
      .map((x) => s(x))
      .filter(Boolean)
      .slice(0, 10),
    services: arr(profile?.serviceCatalog)
      .filter((item) => item?.visibleInAi)
      .map((item) => ({
        key: s(item?.key),
        name: s(item?.name),
        description: s(item?.description),
        aliases: arr(item?.aliases).map((x) => s(x)).filter(Boolean).slice(0, 10),
        active: item?.active === true,
        faqAnswer: s(item?.faqAnswer),
        disabledReplyText: s(item?.disabledReplyText),
        responseMode: s(item?.responseMode),
        pricingMode: s(item?.pricingMode),
        contactCaptureMode: s(item?.contactCaptureMode),
        handoffMode: s(item?.handoffMode),
      }))
      .slice(0, 24),
    activeServiceNames: arr(profile?.services).map((x) => s(x)).filter(Boolean).slice(0, 20),
    disabledServiceNames: arr(profile?.disabledServices)
      .map((x) => s(x))
      .filter(Boolean)
      .slice(0, 20),
  };
}

function buildConversationSystemPrompt() {
  return [
    "You are a tenant-aware business conversation engine for inbound customer messages.",
    "Your job is to understand the business runtime, understand the customer message, answer naturally, and ask at most one smart next question only when necessary.",
    "You are NOT a canned fallback bot.",
    "You must not answer with generic lines like 'tell me what you need', 'how can I help', or similar when the customer already stated a concrete need.",
    "You must sound like a sharp, attentive human operator.",
    "Use the tenant grounding. Do not invent services the business does not offer.",
    "If the customer message is concrete, first acknowledge what they actually need, then guide the next step.",
    "If there is enough information, answer directly without unnecessary clarification.",
    "If something important is missing, ask one precise next question, not multiple questions.",
    "If the requested service looks outside the tenant's active services, do not pretend it exists. Guide carefully based on the real business scope.",
    "Prefer short, natural, confident responses.",
    "Return only valid JSON that matches the schema.",
  ].join("\n");
}

function buildConversationUserPrompt({
  runtimeGrounding,
  conversation,
  matchedKnowledge,
  matchedPlaybook,
  policy,
}) {
  return [
    "Tenant runtime grounding:",
    compactJson(runtimeGrounding, 5000),
    "",
    "Top matched knowledge:",
    compactJson(
      matchedKnowledge.slice(0, 4).map((item) => ({
        title: s(item?.title),
        question: s(item?.question),
        answer: s(item?.answer),
        keywords: arr(item?.keywords).slice(0, 8),
        language: s(item?.language),
        score: Number(item?._score || 0),
      })),
      2500
    ),
    "",
    "Top matched playbook:",
    compactJson(
      matchedPlaybook
        ? {
            name: s(matchedPlaybook?.name),
            triggerKeywords: arr(matchedPlaybook?.triggerKeywords).slice(0, 8),
            replyTemplate: s(matchedPlaybook?.replyTemplate),
            actionType: s(matchedPlaybook?.actionType),
            createLead: matchedPlaybook?.createLead === true,
            handoff: matchedPlaybook?.handoff === true,
            handoffReason: s(matchedPlaybook?.handoffReason),
            handoffPriority: s(matchedPlaybook?.handoffPriority),
          }
        : {},
      1500
    ),
    "",
    "Conversation context:",
    compactJson(
      {
        latestCustomerMessage: conversation.latestCustomerMessage,
        latestCustomerMessageWithoutCommand:
          conversation.latestCustomerMessageWithoutCommand,
        historySnippet: conversation.historySnippet,
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
      },
      4500
    ),
    "",
    "Write the best natural reply for this tenant and this customer.",
    "If the customer already said the goal clearly, do not ask a generic 'what do you need' question.",
    "If you ask a question, ask only one precise question.",
  ].join("\n");
}

function buildRepairPrompt({
  runtimeGrounding,
  conversation,
  previousRaw = "",
  validationErrors = [],
}) {
  return [
    "The previous JSON decision was rejected.",
    "Repair it.",
    "",
    "Validation errors:",
    compactJson(validationErrors, 2000),
    "",
    "Original tenant grounding:",
    compactJson(runtimeGrounding, 4000),
    "",
    "Original conversation context:",
    compactJson(
      {
        latestCustomerMessage: conversation.latestCustomerMessage,
        latestCustomerMessageWithoutCommand:
          conversation.latestCustomerMessageWithoutCommand,
        historySnippet: conversation.historySnippet,
      },
      2500
    ),
    "",
    "Previous raw JSON:",
    s(previousRaw || ""),
    "",
    "Return corrected JSON only.",
  ].join("\n");
}

function buildServiceLookup(profile = {}) {
  return arr(profile?.serviceCatalog)
    .filter((item) => item?.visibleInAi)
    .map((item) => ({
      ...item,
      _matchTerms: uniqStrings([
        s(item?.key),
        s(item?.name),
        ...arr(item?.aliases).map((x) => s(x)),
      ]),
    }));
}

function buildDisabledServiceLookup(profile = {}) {
  return arr(profile?.serviceCatalog)
    .filter((item) => item?.visibleInAi && item?.active === false)
    .map((item) => ({
      ...item,
      _matchTerms: uniqStrings([
        s(item?.key),
        s(item?.name),
        ...arr(item?.aliases).map((x) => s(x)),
      ]),
    }));
}

function scoreServiceAgainstText(text = "", service = {}) {
  const source = normalizeTextForCompare(text);
  if (!source) return 0;

  let score = 0;
  for (const term of arr(service?._matchTerms)) {
    const normalizedTerm = normalizeTextForCompare(term);
    if (!normalizedTerm) continue;
    if (source.includes(normalizedTerm)) {
      score = Math.max(score, normalizedTerm.split(" ").length + 1);
    }
  }

  return score;
}

function findMatchedActiveService(text = "", profile = {}) {
  let best = null;

  for (const service of buildServiceLookup(profile)) {
    const score = scoreServiceAgainstText(text, service);
    if (score <= 0) continue;

    if (!best || score > best.score) {
      best = { service, score };
    }
  }

  return best?.service || null;
}

function findMatchedDisabledService(text = "", profile = {}) {
  let best = null;

  for (const service of buildDisabledServiceLookup(profile)) {
    const score = scoreServiceAgainstText(text, service);
    if (score <= 0) continue;

    if (!best || score > best.score) {
      best = { service, score };
    }
  }

  return best?.service || null;
}

function pickPrimaryLanguage(profile = {}, fallback = "en") {
  return normalizeLanguage(profile?.languages?.[0] || fallback);
}

function localizedEmergencyCopy(language = "en") {
  const lang = normalizeLanguage(language);

  if (lang === "az") {
    return {
      ack: "Başa düşdüm.",
      serviceLead: (serviceName) => `${serviceName} ilə bağlı yazırsınız.`,
      generalLead: "Bununla kömək edə bilərəm.",
      unsupportedLead: "Bu istək hazır aktiv xidmətlər içində görünmür.",
      serviceQuestion:
        "Sizi düzgün yönləndirmək üçün bu mövzuda əsas məqsədinizi bir cümlə ilə yazın.",
      generalQuestion:
        "Sizi düzgün yönləndirmək üçün əsas ehtiyacınızı bir cümlə ilə yazın.",
    };
  }

  if (lang === "tr") {
    return {
      ack: "Anladım.",
      serviceLead: (serviceName) => `${serviceName} ile ilgili yazıyorsunuz.`,
      generalLead: "Bununla yardımcı olabilirim.",
      unsupportedLead: "Bu talep şu anda aktif hizmetler içinde net görünmüyor.",
      serviceQuestion:
        "Sizi doğru yönlendirmem için bu konudaki ana ihtiyacınızı tek cümleyle yazın.",
      generalQuestion:
        "Sizi doğru yönlendirmem için ana ihtiyacınızı tek cümleyle yazın.",
    };
  }

  if (lang === "ru") {
    return {
      ack: "Понял.",
      serviceLead: (serviceName) => `Вы пишете по теме ${serviceName}.`,
      generalLead: "Я могу помочь с этим.",
      unsupportedLead: "Этот запрос сейчас не выглядит как активная услуга бизнеса.",
      serviceQuestion:
        "Чтобы точнее сориентировать, напишите одной фразой вашу основную цель по этому вопросу.",
      generalQuestion:
        "Чтобы точнее сориентировать, напишите одной фразой вашу основную потребность.",
    };
  }

  return {
    ack: "Understood.",
    serviceLead: (serviceName) => `You are asking about ${serviceName}.`,
    generalLead: "I can help with that.",
    unsupportedLead:
      "This request does not clearly match the active services right now.",
    serviceQuestion:
      "To guide this properly, write your main goal for this in one sentence.",
    generalQuestion:
      "To guide this properly, write your main need in one sentence.",
  };
}

function buildRuntimeGroundedEmergencyFallback({
  text,
  profile,
  matchedKnowledge = [],
  matchedPlaybook = null,
}) {
  const language = pickPrimaryLanguage(profile, "en");

  if (matchedPlaybook) {
    const replyText = sanitizeReplyText(buildPlaybookReply(matchedPlaybook, profile));
    return {
      intent: "playbook",
      askCategory: "general",
      stage: "answer",
      replyStyle: "consultative",
      customerGoal: s(text),
      answerFirst: replyText,
      nextQuestion: "",
      replyText,
      missingInformation: [],
      groundedFactsUsed: ["matched_playbook", "runtime_grounded_emergency_fallback"],
      shouldAskQuestion: false,
      shouldCreateLead: Boolean(matchedPlaybook.createLead),
      shouldHandoff: Boolean(matchedPlaybook.handoff),
      handoffReason: s(matchedPlaybook.handoffReason || ""),
      handoffPriority: s(matchedPlaybook.handoffPriority || "normal"),
      confidence: 0.62,
      leadScore: matchedPlaybook.createLead ? 60 : 24,
      noReply: false,
      fallbackReason: "matched_playbook",
      language,
      understoodIntent: "playbook",
      detectedService: "",
    };
  }

  if (matchedKnowledge.length) {
    const replyText = sanitizeReplyText(buildKnowledgeReply(matchedKnowledge, profile));
    return {
      intent: "knowledge_answer",
      askCategory: "faq",
      stage: "answer",
      replyStyle: "consultative",
      customerGoal: s(text),
      answerFirst: replyText,
      nextQuestion: "",
      replyText,
      missingInformation: [],
      groundedFactsUsed: ["matched_knowledge", "runtime_grounded_emergency_fallback"],
      shouldAskQuestion: false,
      shouldCreateLead: false,
      shouldHandoff: false,
      handoffReason: "",
      handoffPriority: "normal",
      confidence: 0.58,
      leadScore: 18,
      noReply: false,
      fallbackReason: "matched_knowledge",
      language,
      understoodIntent: "knowledge_answer",
      detectedService: "",
    };
  }

  const copy = localizedEmergencyCopy(language);
  const matchedActiveService = findMatchedActiveService(text, profile);
  const matchedDisabledService = findMatchedDisabledService(text, profile);

  if (matchedDisabledService) {
    const replyText = sanitizeReplyText(buildUnsupportedServiceReply(profile));
    return {
      intent: "unsupported_service",
      askCategory: "general",
      stage: "general",
      replyStyle: "consultative",
      customerGoal: s(text),
      answerFirst: replyText,
      nextQuestion: "",
      replyText,
      missingInformation: [],
      groundedFactsUsed: ["disabled_service_match", "runtime_grounded_emergency_fallback"],
      shouldAskQuestion: false,
      shouldCreateLead: false,
      shouldHandoff: false,
      handoffReason: "",
      handoffPriority: "normal",
      confidence: 0.44,
      leadScore: 10,
      noReply: false,
      fallbackReason: "disabled_service_match",
      language,
      understoodIntent: "unsupported_service",
      detectedService: s(matchedDisabledService?.name || matchedDisabledService?.key),
    };
  }

  if (matchedActiveService) {
    const replyText = sanitizeReplyText(
      [
        copy.ack,
        copy.serviceLead(s(matchedActiveService?.name || matchedActiveService?.key)),
        copy.serviceQuestion,
      ].join(" ")
    );

    return {
      intent: "service_interest",
      askCategory: "service_interest",
      stage: "discovery",
      replyStyle: "consultative",
      customerGoal: s(text),
      answerFirst: sanitizeReplyText(
        [copy.ack, copy.serviceLead(s(matchedActiveService?.name || matchedActiveService?.key))].join(" ")
      ),
      nextQuestion: copy.serviceQuestion,
      replyText,
      missingInformation: ["service_scope"],
      groundedFactsUsed: ["active_service_match", "runtime_grounded_emergency_fallback"],
      shouldAskQuestion: true,
      shouldCreateLead: false,
      shouldHandoff: false,
      handoffReason: "",
      handoffPriority: "normal",
      confidence: 0.48,
      leadScore: 28,
      noReply: false,
      fallbackReason: "active_service_match",
      language,
      understoodIntent: "service_interest",
      detectedService: s(matchedActiveService?.name || matchedActiveService?.key),
    };
  }

  const replyText = sanitizeReplyText(
    [copy.ack, copy.generalLead, copy.generalQuestion].join(" ")
  );

  return {
    intent: "general",
    askCategory: "general",
    stage: "discovery",
    replyStyle: "consultative",
    customerGoal: s(text),
    answerFirst: sanitizeReplyText([copy.ack, copy.generalLead].join(" ")),
    nextQuestion: copy.generalQuestion,
    replyText,
    missingInformation: ["customer_goal"],
    groundedFactsUsed: ["runtime_grounded_emergency_fallback"],
    shouldAskQuestion: true,
    shouldCreateLead: false,
    shouldHandoff: false,
    handoffReason: "",
    handoffPriority: "normal",
    confidence: 0.36,
    leadScore: 16,
    noReply: false,
    fallbackReason: "runtime_grounded_emergency_fallback",
    language,
    understoodIntent: "general",
    detectedService: "",
  };
}

const GENERIC_REPLY_PATTERNS = [
  "how can i help",
  "how may i help",
  "tell me what you need",
  "tell me what you need help with",
  "what do you need",
  "write what you need",
  "describe what you need",
  "nə lazım olduğunu yazın",
  "nə ilə bağlı kömək lazım olduğunu",
  "nece komek ede bilerem",
  "ne lazım oldugunu yazin",
  "hangi konuda yardıma ihtiyacınız",
  "chem mogu pomoch",
];

function looksLikeGenericClarifier(replyText = "") {
  const normalized = normalizeTextForCompare(replyText);
  if (!normalized) return true;

  return GENERIC_REPLY_PATTERNS.some((pattern) =>
    normalized.includes(normalizeTextForCompare(pattern))
  );
}

function looksLikeGreetingOnly(parsed = {}) {
  const intent = lower(parsed?.understoodIntent || parsed?.intent || "");
  const askCategory = lower(parsed?.askCategory || "");
  const stage = lower(parsed?.stage || "");
  const customerGoal = s(parsed?.customerGoal || "");
  const replyText = sanitizeReplyText(
    s(parsed?.replyText || "") ||
      joinReplyParts(parsed?.answerFirst, parsed?.nextQuestion)
  );

  if (customerGoal) return false;
  if (!replyText) return true;

  return (
    intent === "greeting" ||
    askCategory === "greeting" ||
    stage === "greeting"
  );
}

function normalizeConversationDecision(parsed = {}, fallbackLanguage = "en") {
  const answerFirst = sanitizeSentence(parsed?.answerFirst || "");
  const nextQuestion = sanitizeSentence(parsed?.nextQuestion || "");
  let replyText = sanitizeReplyText(parsed?.replyText || "");

  if (!replyText) {
    replyText = joinReplyParts(answerFirst, nextQuestion);
  }

  return {
    language: normalizeLanguage(parsed?.language || fallbackLanguage || "en"),
    understoodIntent:
      s(parsed?.understoodIntent || parsed?.intent || "general") || "general",
    detectedService: s(parsed?.detectedService || ""),
    customerGoal: s(parsed?.customerGoal || ""),
    answerFirst,
    nextQuestion,
    replyText,
    missingInformation: coerceStringArray(parsed?.missingInformation),
    groundedFactsUsed: coerceStringArray(parsed?.groundedFactsUsed),
    shouldAskQuestion: coerceBoolean(parsed?.shouldAskQuestion, false),
    shouldCreateLead: coerceBoolean(parsed?.shouldCreateLead, false),
    shouldHandoff: coerceBoolean(parsed?.shouldHandoff, false),
    handoffReason: s(parsed?.handoffReason || ""),
    handoffPriority: normalizePriority(parsed?.handoffPriority || "normal"),
    confidence: Math.max(0, Math.min(1, coerceNumber(parsed?.confidence, 0.45))),
    leadScore: Math.max(
      0,
      Math.min(100, Math.round(coerceNumber(parsed?.leadScore, 20)))
    ),
    askCategory: normalizeAskCategory(parsed?.askCategory || "general"),
    stage: normalizeStage(parsed?.stage || "general"),
    replyStyle: normalizeReplyStyle(parsed?.replyStyle || "consultative"),
    noReply: coerceBoolean(parsed?.noReply, false),
  };
}

function validateConversationDecision({
  parsed = {},
  customerText = "",
  profile = {},
  matchedKnowledge = [],
  matchedPlaybook = null,
}) {
  const normalized = normalizeConversationDecision(
    parsed,
    profile?.languages?.[0] || "en"
  );
  const reasons = [];

  const substantive = isSubstantiveCustomerTurn(customerText);
  const genericClarifier = looksLikeGenericClarifier(normalized.replyText);
  const greetingOnly = looksLikeGreetingOnly(normalized);
  const matchedActiveService = findMatchedActiveService(customerText, profile);
  const matchedDisabledService = findMatchedDisabledService(customerText, profile);

  if (!normalized.replyText && normalized.noReply !== true) {
    reasons.push("reply_text_empty");
  }

  if (substantive && greetingOnly) {
    reasons.push("substantive_turn_cannot_return_greeting_only");
  }

  if (substantive && genericClarifier && !normalized.customerGoal) {
    reasons.push("generic_clarifier_on_substantive_turn");
  }

  if (
    substantive &&
    matchedActiveService &&
    !normalized.detectedService &&
    genericClarifier
  ) {
    reasons.push("matched_service_not_acknowledged");
  }

  if (
    matchedDisabledService &&
    normalized.detectedService &&
    lower(normalized.detectedService) ===
      lower(matchedDisabledService?.name || matchedDisabledService?.key) &&
    !/unsupported|outside|not available|not active|uygun deyil|aktiv deyil/i.test(
      normalized.replyText
    )
  ) {
    reasons.push("disabled_service_not_handled_safely");
  }

  if (
    normalized.shouldAskQuestion &&
    !normalized.nextQuestion &&
    !/[?؟]/u.test(normalized.replyText)
  ) {
    reasons.push("question_expected_but_missing");
  }

  if (countWordLikeTokens(normalized.replyText) < 3 && substantive) {
    reasons.push("reply_too_short_for_substantive_turn");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    normalized,
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
    usecase: "inbox.conversation",
    decisions: {
      cta: {
        selected: "",
        reason: "none",
      },
      qualification: {
        mode: s(result.askCategory || "general"),
        questionCount: result.shouldAskQuestion ? 1 : 0,
        reason: result.shouldAskQuestion ? "conversation_engine" : "",
      },
      handoff: {
        reason: s(result.handoffReason || ""),
        priority: s(result.handoffPriority || "normal").toLowerCase(),
      },
    },
    evaluation: {
      outcome: Boolean(result.shouldHandoff)
        ? "handoff_recommended"
        : Boolean(result.noReply)
          ? "no_reply_recommended"
          : "reply_recommended",
      ctaDirection: Boolean(result.shouldHandoff)
        ? "handoff"
        : Boolean(result.noReply)
          ? "none"
          : "reply_with_cta",
      qualification: {
        status: s(result.stage || "general"),
        questionCount: result.shouldAskQuestion ? 1 : 0,
      },
      handoff: {
        status: Boolean(result.shouldHandoff) ? "recommended" : "clear",
        reason: s(result.handoffReason || ""),
        priority: s(result.handoffPriority || "normal").toLowerCase(),
      },
    },
    decisionPath: {
      status: Boolean(result.shouldHandoff)
        ? "escalated_to_operator"
        : Boolean(result.noReply)
          ? "no_reply"
          : "answered",
      reasonCode:
        s(result.handoffReason || "") ||
        (Boolean(result.shouldHandoff)
          ? "conversation_engine_handoff"
          : Boolean(result.noReply)
            ? "conversation_engine_no_reply"
            : "conversation_engine_reply"),
      detail: s(result.stage || ""),
    },
  });
}

function finalizeConversationResult({
  parsed,
  profile,
  matchedKnowledge,
  matchedPlaybook,
  resolvedRuntime,
  promptBundle,
  channel,
  policy,
  raw = "",
  replyMode = "conversation_engine",
  semanticFailureReason = "",
  fallbackReason = "",
}) {
  const normalized = normalizeConversationDecision(
    parsed,
    profile?.languages?.[0] || "en"
  );

  const baseResult = {
    language: normalized.language,
    intent: normalized.understoodIntent,
    askCategory: normalized.askCategory,
    stage: normalized.stage,
    replyStyle: normalized.replyStyle,
    customerGoal: normalized.customerGoal,
    answerFirst: normalized.answerFirst,
    recommendedNextQuestion: normalized.nextQuestion,
    replyText: normalized.replyText,
    knownFacts: [],
    missingFacts: normalized.missingInformation,
    groundedFactsUsed: normalized.groundedFactsUsed,
    confidence: normalized.confidence,
    leadScore: normalized.leadScore,
    createLead: normalized.shouldCreateLead,
    handoff: normalized.shouldHandoff,
    handoffReason: normalized.handoffReason,
    handoffPriority: normalized.handoffPriority,
    noReply: normalized.noReply,
    raw,
    replyMode,
    usedFallback: replyMode !== "conversation_engine",
    usedFastLane: false,
    fastLaneReason: "",
    semanticFailureReason: s(semanticFailureReason || ""),
    profile,
    matchedKnowledge,
    matchedPlaybook,
    runtime: resolvedRuntime,
    promptBundle,
    trace: {},
    fallbackReason: s(fallbackReason || ""),
    detectedService: normalized.detectedService,
    shouldAskQuestion: normalized.shouldAskQuestion,
  };

  const composed = composeTenantAwareReply({
    result: baseResult,
    profile,
    text: "",
    recentMessages: [],
  });

  const finalResult = {
    ...baseResult,
    replyBodyText: composed.replyBodyText,
    replyText: composed.replyText || baseResult.replyText,
    greetingApplied: Boolean(composed.greetingApplied),
    greetingText: s(composed.greetingText),
    greetingMode: s(composed.greetingMode),
    usedCustomGreeting: Boolean(composed.usedCustomGreeting),
    introModeUsed: s(composed.introModeUsed),
    behaviorSource: s(
      composed.behaviorSource || profile?.behavior?.source || ""
    ),
    language: s(
      composed.language || baseResult.language || profile?.languages?.[0] || "en"
    ),
    greetingOnly: Boolean(composed.greetingOnly),
  };

  finalResult.trace = buildTraceFromDecision({
    resolvedRuntime,
    policy,
    promptBundle,
    channel,
    result: {
      ...normalized,
      shouldHandoff: normalized.shouldHandoff,
    },
  });

  return finalResult;
}

export async function runTenantAwareConversationEngine({
  text,
  channel,
  externalUserId,
  tenantKey,
  thread,
  message,
  tenant = null,
  policy = {},
  quietHoursApplied = false,
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
  const openai = ensureOpenAI();
  const model = s(cfg?.ai?.openaiModel || "gpt-4.1-mini") || "gpt-4.1-mini";
  const configuredMaxTokens = Number(cfg?.ai?.openaiMaxOutputTokens || 650);
  const maxOutputTokens = Math.max(220, Math.min(650, configuredMaxTokens || 650));
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);

  const resolvedRuntime =
    runtime ||
    (await resolveInboxRuntime({
      tenantKey: resolvedTenantKey,
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
      runtime,
    }));

  const profile = resolvedRuntime;
  const runtimeGrounding = buildRuntimeGrounding(profile);

  const matchedKnowledge = matchKnowledgeEntries(
    text,
    resolvedRuntime.knowledgeEntries,
    4
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

  const promptBundle = buildPromptBundle("inbox.conversation", {
    tenant: {
      ...obj(tenant),
      tenantKey: resolvedTenantKey,
      tenantId: resolvedTenantKey,
      companyName: profile.displayName,
      brandName: profile.displayName,
      industryKey: profile.industry,
      outputLanguage: profile.languages?.[0] || "en",
      toneText: profile.tone,
      services: profile.services,
      servicesText: buildServiceLine(profile) || "tenant business services",
      disabledServicesText: buildDisabledServiceLine(profile) || "",
      businessContext: profile.businessSummary || "",
      ai_policy: {
        ...obj(tenant?.ai_policy),
        ...obj(profile.aiPolicy),
      },
      behavior: {
        niche: s(profile.niche || profile.industry),
        conversionGoal: s(profile.conversionGoal),
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
      servicesLine: JSON.stringify(buildServiceLine(profile)),
      disabledServicesLine: JSON.stringify(buildDisabledServiceLine(profile)),
      reliability: compactJson(reliability || {}),
      runtimeGrounding: compactJson(runtimeGrounding, 5000),
      historySnippet: conversation.historySnippet,
    },
  });

  if (!openai) {
    const fallback = buildRuntimeGroundedEmergencyFallback({
      text,
      profile,
      matchedKnowledge,
      matchedPlaybook,
    });

    return finalizeConversationResult({
      parsed: fallback,
      profile,
      matchedKnowledge,
      matchedPlaybook,
      resolvedRuntime,
      promptBundle,
      channel,
      policy,
      raw: "",
      replyMode: "conversation_engine_emergency_fallback",
      semanticFailureReason: "openai_api_key_missing",
      fallbackReason: fallback.fallbackReason || "runtime_grounded_emergency_fallback",
    });
  }

  const systemPrompt = buildConversationSystemPrompt();
  const userPrompt = buildConversationUserPrompt({
    runtimeGrounding,
    conversation,
    matchedKnowledge,
    matchedPlaybook,
    policy,
  });

  logConversationEngine("request_start", {
    tenantKey: resolvedTenantKey,
    channel: s(channel || "inbox"),
    model,
    maxOutputTokens,
    matchedKnowledgeCount: matchedKnowledge.length,
    hasMatchedPlaybook: Boolean(matchedPlaybook),
    threadId: s(thread?.id),
    messageId: s(message?.id),
    latestMessagePreview: safePreview(
      conversation.latestCustomerMessageWithoutCommand ||
        conversation.latestCustomerMessage,
      180
    ),
  });

  try {
    let raw = "";
    let refusal = "";
    let parsed = null;
    let semanticFailureReason = "";
    let replyMode = "conversation_engine";

    const firstPass = await runStructuredDecision({
      openai,
      model,
      maxOutputTokens,
      systemPrompt,
      userPrompt,
    });

    raw = firstPass.raw;
    refusal = firstPass.refusal;
    parsed = firstPass.parsed || parseStructuredOutput(raw, model);

    const firstValidation = validateConversationDecision({
      parsed,
      customerText:
        conversation.latestCustomerMessageWithoutCommand ||
        conversation.latestCustomerMessage,
      profile,
      matchedKnowledge,
      matchedPlaybook,
    });

    if (refusal) {
      semanticFailureReason = "model_refusal";

      const fallback = buildRuntimeGroundedEmergencyFallback({
        text,
        profile,
        matchedKnowledge,
        matchedPlaybook,
      });

      return finalizeConversationResult({
        parsed: fallback,
        profile,
        matchedKnowledge,
        matchedPlaybook,
        resolvedRuntime,
        promptBundle,
        channel,
        policy,
        raw,
        replyMode: "conversation_engine_emergency_fallback",
        semanticFailureReason,
        fallbackReason: fallback.fallbackReason || "runtime_grounded_emergency_fallback",
      });
    }

    if (!firstValidation.ok) {
      logConversationEngineWarn("repair_attempt", {
        tenantKey: resolvedTenantKey,
        channel: s(channel || "inbox"),
        reasons: firstValidation.reasons,
        rawPreview: safePreview(raw, 400),
      });

      const repairPass = await runStructuredDecision({
        openai,
        model,
        maxOutputTokens,
        systemPrompt,
        userPrompt: buildRepairPrompt({
          runtimeGrounding,
          conversation,
          previousRaw: raw,
          validationErrors: firstValidation.reasons,
        }),
      });

      raw = repairPass.raw;
      refusal = repairPass.refusal;
      parsed = repairPass.parsed || parseStructuredOutput(raw, model);

      const repairValidation = validateConversationDecision({
        parsed,
        customerText:
          conversation.latestCustomerMessageWithoutCommand ||
          conversation.latestCustomerMessage,
        profile,
        matchedKnowledge,
        matchedPlaybook,
      });

      if (!repairValidation.ok || refusal) {
        semanticFailureReason = refusal
          ? "repair_model_refusal"
          : `validation_failed:${repairValidation.reasons.join(",")}`;

        const fallback = buildRuntimeGroundedEmergencyFallback({
          text,
          profile,
          matchedKnowledge,
          matchedPlaybook,
        });

        logConversationEngineWarn("repair_failed_using_emergency_fallback", {
          tenantKey: resolvedTenantKey,
          channel: s(channel || "inbox"),
          reasons: refusal ? ["repair_model_refusal"] : repairValidation.reasons,
          fallbackReason: fallback.fallbackReason,
          rawPreview: safePreview(raw, 400),
        });

        return finalizeConversationResult({
          parsed: fallback,
          profile,
          matchedKnowledge,
          matchedPlaybook,
          resolvedRuntime,
          promptBundle,
          channel,
          policy,
          raw,
          replyMode: "conversation_engine_emergency_fallback",
          semanticFailureReason,
          fallbackReason:
            fallback.fallbackReason || "runtime_grounded_emergency_fallback",
        });
      }

      replyMode = "conversation_engine_repaired";
    }

    const normalized = normalizeConversationDecision(
      parsed,
      profile?.languages?.[0] || "en"
    );

    const result = finalizeConversationResult({
      parsed: normalized,
      profile,
      matchedKnowledge,
      matchedPlaybook,
      resolvedRuntime,
      promptBundle,
      channel,
      policy,
      raw,
      replyMode,
      semanticFailureReason,
      fallbackReason: "",
    });

    logConversationEngine("decision", {
      tenantKey: resolvedTenantKey,
      channel: s(channel || "inbox"),
      model,
      intent: result.intent,
      detectedService: s(result.detectedService),
      askCategory: result.askCategory,
      stage: result.stage,
      replyStyle: result.replyStyle,
      customerGoal: result.customerGoal,
      shouldAskQuestion: Boolean(result.shouldAskQuestion),
      createLead: result.createLead,
      handoff: result.handoff,
      handoffReason: result.handoffReason,
      handoffPriority: result.handoffPriority,
      leadScore: result.leadScore,
      confidence: result.confidence,
      replyMode: result.replyMode,
      usedFallback: result.usedFallback,
      semanticFailureReason: result.semanticFailureReason,
      fallbackReason: result.fallbackReason,
      replyPreview: safePreview(result.replyText, 180),
    });

    return result;
  } catch (error) {
    logConversationEngineError("failed_using_emergency_fallback", {
      tenantKey: resolvedTenantKey,
      channel: s(channel || "inbox"),
      model,
      errorName: s(error?.name || "Error"),
      errorMessage: s(error?.message || "Unknown conversation engine error"),
      errorCode: s(error?.code),
      errorType: s(error?.type),
      errorStatus:
        Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
      errorParam: s(error?.param),
      errorRawType: s(error?.error?.type),
      errorRawCode: s(error?.error?.code),
      errorRawMessage: s(error?.error?.message),
    });

    const fallback = buildRuntimeGroundedEmergencyFallback({
      text,
      profile,
      matchedKnowledge,
      matchedPlaybook,
    });

    return finalizeConversationResult({
      parsed: fallback,
      profile,
      matchedKnowledge,
      matchedPlaybook,
      resolvedRuntime,
      promptBundle,
      channel,
      policy,
      raw: "",
      replyMode: "conversation_engine_emergency_fallback",
      semanticFailureReason: s(error?.message || "conversation_engine_failed"),
      fallbackReason:
        fallback.fallbackReason || "runtime_grounded_emergency_fallback",
    });
  }
}

export const __test__ = {
  normalizeLanguage,
  isSubstantiveCustomerTurn,
  buildRuntimeGrounding,
  findMatchedActiveService,
  findMatchedDisabledService,
  looksLikeGenericClarifier,
  validateConversationDecision,
  normalizeConversationDecision,
};