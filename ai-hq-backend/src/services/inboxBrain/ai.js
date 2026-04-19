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
  if (/[?؟]/.test(s(text))) return true;
  return false;
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
    leadQualificationMode: s(profile?.leadQualificationMode),
    bookingFlowType: s(profile?.bookingFlowType),
    qualificationQuestions: arr(profile?.qualificationQuestions).map((x) => s(x)).filter(Boolean),
    leadPrompts: arr(profile?.leadPrompts).map((x) => s(x)).filter(Boolean),
    handoffTriggers: arr(profile?.handoffTriggers).map((x) => s(x)).filter(Boolean),
    disallowedClaims: arr(profile?.disallowedClaims).map((x) => s(x)).filter(Boolean),
    channelBehaviorInbox: obj(profile?.channelBehavior?.inbox),
    behaviorSource: s(profile?.behavior?.source),
    greetingEnabled: Boolean(profile?.behavior?.greetingEnabled),
    greetingMode: s(profile?.behavior?.greetingMode),
    introMode: s(profile?.behavior?.introMode),
    customGreeting: s(profile?.conversationAssets?.customGreeting || ""),
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
    language: s(item?.language),
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
    language: s(matchedPlaybook.language),
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
        selected: "",
        reason: "none",
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
  const latestMessageText =
    s(conversation?.latestCustomerMessageWithoutCommand) ||
    s(conversation?.latestCustomerMessage);

  if (matchedPlaybook) {
    const replyText = sanitizeReplyText(buildPlaybookReply(matchedPlaybook, profile));
    return {
      language: s(matchedPlaybook?.language || profile?.languages?.[0] || "en"),
      semanticIntent: "playbook",
      askCategory: "general",
      conversationStage: "answer",
      replyStyle: "consultative",
      customerGoal: latestMessageText,
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
      heuristic: false,
      fallbackReason: "matched_playbook",
    };
  }

  if (matchedKnowledge.length) {
    const replyText = sanitizeReplyText(buildKnowledgeReply(matchedKnowledge, profile));
    const first = arr(matchedKnowledge)[0];

    return {
      language: s(first?.language || profile?.languages?.[0] || "en"),
      semanticIntent: "knowledge_answer",
      askCategory: "faq",
      conversationStage: "answer",
      replyStyle: "consultative",
      customerGoal: latestMessageText,
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
      heuristic: false,
      fallbackReason: "matched_knowledge",
    };
  }

  const fallbackIntent = conversation?.commandOnly ? "greeting" : "general";
  const replyText = sanitizeReplyText(
    buildFallbackReply({
      intent: fallbackIntent,
      profile,
      knowledgeEntries: [],
      playbook: null,
    })
  );

  return {
    language: s(profile?.languages?.[0] || "en"),
    semanticIntent: fallbackIntent,
    askCategory: fallbackIntent === "greeting" ? "greeting" : "general",
    conversationStage: fallbackIntent === "greeting" ? "greeting" : "general",
    replyStyle: "consultative",
    customerGoal: latestMessageText,
    knownFacts: [],
    missingFacts: [],
    groundedFactsUsed: ["safe_fallback"],
    answerFirst: replyText,
    recommendedNextQuestion: "",
    replyText,
    createLead: false,
    handoff: false,
    handoffReason: "",
    handoffPriority: "normal",
    noReply: false,
    confidence: 0.42,
    leadScore: 18,
    heuristic: false,
    fallbackReason: "safe_fallback",
  };
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

function shouldUseSafeFallbackGuardrail({
  parsed = null,
  conversation = {},
}) {
  const latestMessageText =
    s(conversation?.latestCustomerMessageWithoutCommand) ||
    s(conversation?.latestCustomerMessage);

  if (!isSubstantiveCustomerTurn(latestMessageText)) return false;
  if (!parsed || typeof parsed !== "object") return true;

  const parsedIntent = lower(s(parsed?.semanticIntent || parsed?.intent || ""));
  const parsedAskCategory = lower(s(parsed?.askCategory || ""));
  const parsedStage = lower(s(parsed?.conversationStage || parsed?.stage || ""));
  const replyText = sanitizeReplyText(
    s(parsed?.replyText || "") || joinReplyParts(parsed?.answerFirst, parsed?.recommendedNextQuestion)
  );
  const customerGoal = s(parsed?.customerGoal || "");

  if (!replyText) return true;
  if (parsedIntent === "greeting" || parsedAskCategory === "greeting") return true;
  if (parsedStage === "greeting" && !customerGoal) return true;
  if (replyText.length < 12 && !customerGoal) return true;

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
    language: s(parsed?.language || fallbackDecision.language || profile?.languages?.[0] || "en"),
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
    usedFallback:
      replyMode === "fallback_safe" || replyMode === "semantic_guardrail_safe_fallback",
    usedFastLane: replyMode.startsWith("fast_lane"),
    fastLaneReason: s(parsed?.fastLaneReason || ""),
    semanticFailureReason: s(semanticFailureReason || ""),
    profile,
    matchedKnowledge,
    matchedPlaybook,
    runtime: resolvedRuntime,
    promptBundle,
    trace: {},
    fallbackReason: s(fallbackDecision?.fallbackReason || ""),
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
    language: s(composed.language || result.language || profile?.languages?.[0] || "en"),
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
      outputLanguage: profile.languages?.[0] || "en",
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
        fallbackReason: fallbackDecision.fallbackReason,
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
        replyMode: "fallback_safe",
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
        replyMode = "fallback_safe";
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
      replyMode = "fallback_safe";
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
        replyMode = "fallback_safe";
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
      replyMode = "fallback_safe";
      semanticFailureReason = "weak_payload_no_repair";
    }

    if (
      shouldUseSafeFallbackGuardrail({
        parsed,
        conversation,
      })
    ) {
      parsed = fallbackDecision;
      replyMode =
        replyMode === "semantic" || replyMode === "semantic_repaired"
          ? "semantic_guardrail_safe_fallback"
          : "fallback_safe";
      semanticFailureReason =
        semanticFailureReason || "semantic_guardrail_safe_fallback";

      logInboxAiWarn("safe_fallback_guardrail_override", {
        tenantKey: resolvedTenantKey,
        channel: s(channel || "inbox"),
        model,
        replyMode,
        semanticFailureReason,
        fallbackReason: s(fallbackDecision?.fallbackReason || ""),
        customerTurnPreview: safePreview(
          conversation?.latestCustomerMessageWithoutCommand ||
            conversation?.latestCustomerMessage ||
            "",
          180
        ),
        rawPreview: safePreview(raw),
      });
    }

    const result = applyReplyComposer({
      result: normalizeAiResult({
        parsed:
          replyMode === "fallback_safe" ||
          replyMode === "semantic_guardrail_safe_fallback"
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
      fallbackReason: result.fallbackReason,
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
        replyMode: "fallback_safe",
        semanticFailureReason: s(error?.message || "openai_request_failed"),
      }),
      profile,
      text,
      recentMessages,
    });
  }
}