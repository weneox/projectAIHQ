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
import { arr, getResolvedTenantKey, obj, s, sanitizeReplyText } from "./shared.js";
import {
  buildHistorySnippet,
  extractText,
  parseJsonLoose,
} from "./messages.js";
import {
  buildDisabledServiceLine,
  buildServiceLine,
  resolveInboxRuntime,
} from "./runtime.js";
import { matchKnowledgeEntries, matchPlaybook } from "./matchers.js";

let openaiSingleton = null;

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

function lower(value = "") {
  return s(value).toLowerCase();
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

function stripLeadingCommand(text = "") {
  const source = s(text).trim();
  if (!source.startsWith("/")) return source;
  return source.replace(/^\/[^\s]+\s*/u, "").trim();
}

function isCommandOnly(text = "") {
  const raw = s(text).trim();
  if (!raw.startsWith("/")) return false;
  return stripLeadingCommand(raw) === "";
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

function buildSemanticSystemPrompt() {
  return [
    "You are the semantic inbox brain for a multi-tenant business system.",
    "Understand the customer's real meaning, then plan a high-quality business reply.",
    "Do not rely on shallow keyword matching.",
    "If a greeting and a real request appear together, the request is primary.",
    "Use tenant runtime truth as the source of what the business offers and how it should speak.",
    "If grounded knowledge exists, use it.",
    "If a playbook clearly fits, align with it.",
    "Always answer first, then ask at most one next question only if it truly helps.",
    "Never ask the customer to repeat facts already present in the message or history.",
    "Do not invent pricing, timelines, capabilities, or policies.",
    "Do not mention unavailable or disabled services as if they exist.",
    "Avoid robotic lead-capture phrasing and vague filler.",
    "The customer should feel understood by a smart human operator.",
    "Return only valid JSON.",
  ].join(" ");
}

function buildSemanticPrompt({
  promptBundle,
  profile,
  conversation,
  matchedKnowledge,
  matchedPlaybook,
  policy,
}) {
  return `${promptBundle.fullPrompt}

SEMANTIC TASK

LATEST MESSAGE:
${JSON.stringify(conversation.latestCustomerMessage)}

LATEST MESSAGE WITHOUT LEADING COMMAND:
${JSON.stringify(conversation.latestCustomerMessageWithoutCommand)}

RECENT HISTORY:
${conversation.historySnippet}

TENANT RUNTIME TRUTH:
${compactJson(buildRuntimeSnapshot(profile))}

MATCHED KNOWLEDGE:
${compactJson(buildPromptKnowledge(matchedKnowledge))}

MATCHED PLAYBOOK:
${compactJson(buildPromptPlaybook(matchedPlaybook))}

ADDITIONAL CONTEXT:
${compactJson({
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
  })}

INSTRUCTIONS:
1. First interpret what the customer actually wants in this turn.
2. Treat greeting-only language as secondary if the turn also contains a business need.
3. Identify what is already known and what is still missing.
4. If the customer asked something concrete, answer it first.
5. Ask at most one next question, and only if it advances the conversation.
6. If no next question is needed, recommendedNextQuestion must be empty.
7. If the service seems unavailable, be honest and safe.
8. Keep the final reply concise, natural, premium, and useful.

Return only JSON in this exact shape:
{
  "language": string,
  "semanticIntent": string,
  "askCategory": "greeting"|"service_interest"|"recommendation"|"pricing"|"timeline"|"comparison"|"availability"|"booking"|"reservation"|"quote"|"support"|"faq"|"handoff_request"|"general",
  "conversationStage": "greeting"|"discovery"|"recommendation"|"pricing"|"timeline"|"qualification"|"objection"|"handoff"|"support"|"answer"|"closing"|"general",
  "replyStyle": "consultative"|"direct"|"reassuring"|"concise"|"sales"|"supportive"|"professional",
  "customerGoal": string,
  "knownFacts": string[],
  "missingFacts": string[],
  "groundedFactsUsed": string[],
  "answerFirst": string,
  "recommendedNextQuestion": string,
  "replyText": string,
  "createLead": boolean,
  "handoff": boolean,
  "handoffReason": string,
  "handoffPriority": "low"|"normal"|"high"|"urgent",
  "noReply": boolean,
  "confidence": number
}`;
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
  if (matchedPlaybook) {
    const replyText = sanitizeReplyText(buildPlaybookReply(matchedPlaybook, profile));
    return {
      language: s(profile?.languages?.[0] || "az"),
      semanticIntent: "playbook",
      askCategory: "general",
      conversationStage: "answer",
      replyStyle: "consultative",
      customerGoal: "",
      knownFacts: [],
      missingFacts: [],
      groundedFactsUsed: ["matched_playbook"],
      answerFirst: replyText,
      recommendedNextQuestion: "",
      replyText,
      createLead: Boolean(matchedPlaybook.createLead),
      handoff: Boolean(matchedPlaybook.handoff),
      handoffReason: s(matchedPlaybook.handoffReason || ""),
      handoffPriority: s(matchedPlaybook.handoffPriority || "normal"),
      noReply: false,
      confidence: 0.72,
      leadScore: matchedPlaybook.createLead ? 62 : 28,
      heuristic: true,
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
      customerGoal: "",
      knownFacts: [],
      missingFacts: [],
      groundedFactsUsed: ["matched_knowledge"],
      answerFirst: replyText,
      recommendedNextQuestion: "",
      replyText,
      createLead: false,
      handoff: false,
      handoffReason: "",
      handoffPriority: "normal",
      noReply: false,
      confidence: 0.66,
      leadScore: 24,
      heuristic: true,
    };
  }

  const fallbackIntent = conversation.commandOnly ? "greeting" : "general";
  const replyText = sanitizeReplyText(
    buildFallbackReply({
      intent: fallbackIntent,
      profile,
      knowledgeEntries: [],
      playbook: null,
    })
  );

  return {
    language: s(profile?.languages?.[0] || "az"),
    semanticIntent: fallbackIntent,
    askCategory: fallbackIntent === "greeting" ? "greeting" : "general",
    conversationStage: fallbackIntent === "greeting" ? "greeting" : "discovery",
    replyStyle: "consultative",
    customerGoal: "",
    knownFacts: [],
    missingFacts: [],
    groundedFactsUsed: ["runtime_fallback"],
    answerFirst: replyText,
    recommendedNextQuestion: "",
    replyText,
    createLead: false,
    handoff: false,
    handoffReason: "",
    handoffPriority: "normal",
    noReply: false,
    confidence: 0.4,
    leadScore: 20,
    heuristic: true,
  };
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
    profile,
    matchedKnowledge,
    matchedPlaybook,
    runtime: resolvedRuntime,
    promptBundle,
    trace: {},
    heuristic: Boolean(fallbackDecision?.heuristic),
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
  const max_output_tokens = openAiConfig.maxOutputTokens;

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
      }),
    },
  });

  if (!openai) {
    logInboxAiWarn("unavailable_using_fallback", {
      tenantKey: resolvedTenantKey,
      channel: s(channel || "inbox"),
      reason: "openai_api_key_missing",
      model,
      hasApiKey: openAiConfig.hasApiKey,
      apiKeyLength: openAiConfig.apiKeyLength,
    });

    return normalizeAiResult({
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
    });
  }

  const prompt = buildSemanticPrompt({
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
    maxOutputTokens: max_output_tokens,
    quietHoursApplied: Boolean(quietHoursApplied),
    matchedKnowledgeCount: matchedKnowledge.length,
    hasMatchedPlaybook: Boolean(matchedPlaybook),
    threadId: s(thread?.id),
    messageId: s(message?.id),
  });

  try {
    const resp = await openai.responses.create({
      model,
      text: { format: { type: "text" } },
      max_output_tokens,
      input: [
        {
          role: "system",
          content: buildSemanticSystemPrompt(),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const raw = extractText(resp);
    const parsed = parseJsonLoose(raw);

    if (!parsed || typeof parsed !== "object") {
      logInboxAiWarn("invalid_json_using_fallback", {
        tenantKey: resolvedTenantKey,
        channel: s(channel || "inbox"),
        model,
        rawPreview: safePreview(raw),
      });

      const result = normalizeAiResult({
        parsed: fallbackDecision,
        fallbackDecision,
        profile,
        matchedKnowledge,
        matchedPlaybook,
        resolvedRuntime,
        promptBundle,
        channel,
        policy,
        raw,
      });

      logInboxAi("decision", {
        tenantKey: resolvedTenantKey,
        channel: s(channel || "inbox"),
        model,
        intent: result.intent,
        askCategory: result.askCategory,
        stage: result.stage,
        noReply: result.noReply,
        createLead: result.createLead,
        handoff: result.handoff,
        handoffReason: result.handoffReason,
        handoffPriority: result.handoffPriority,
        leadScore: result.leadScore,
        confidence: result.confidence,
        heuristic: true,
        replyPreview: safePreview(result.replyText, 180),
      });

      return result;
    }

    const result = normalizeAiResult({
      parsed,
      fallbackDecision,
      profile,
      matchedKnowledge,
      matchedPlaybook,
      resolvedRuntime,
      promptBundle,
      channel,
      policy,
      raw,
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

    return normalizeAiResult({
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
    });
  }
}