import { getInboxPolicy } from "../inboxPolicy.js";
import {
  isAckOnlyText,
  normalizeRecentMessages,
  stripLeadingCommand,
} from "./messages.js";
import { resolveInboxRuntime } from "./runtime.js";
import { runTenantAwareConversationEngine } from "./conversationEngine.js";
import { getResolvedTenantKey, lower, s } from "./shared.js";

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

function normalizeFreeText(value = "") {
  return lower(value)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countTokens(value = "") {
  const normalized = normalizeFreeText(value);
  if (!normalized) return 0;
  return normalized.split(" ").filter(Boolean).length;
}

function isMeaningfulCustomerNeed(text = "") {
  const cleaned = stripLeadingCommand(text);
  if (!cleaned) return false;
  if (isAckOnlyText(cleaned)) return false;

  const normalized = normalizeFreeText(cleaned);
  if (!normalized) return false;

  if (countTokens(normalized) >= 4) return true;
  if (cleaned.length >= 18) return true;
  if (/[?؟]/u.test(cleaned)) return true;

  return false;
}

function pickLanguage(engine = {}, runtime = {}) {
  return normalizeLanguage(
    engine?.language || runtime?.languages?.[0] || runtime?.profile?.language || "en"
  );
}

function inferNeedCategoryFromEngine(engine = {}, runtime = {}, customerText = "") {
  const detectedService = s(engine?.detectedService || "");
  if (detectedService) return "service_interest";

  const askCategory = lower(engine?.askCategory || "");
  if (askCategory) return askCategory;

  const normalized = normalizeFreeText(customerText);
  if (!normalized) return "general";

  if (
    [
      "price",
      "pricing",
      "quote",
      "cost",
      "qiymet",
      "qiymət",
      "teklif",
      "budget",
      "fee",
    ].some((word) => normalized.includes(normalizeFreeText(word)))
  ) {
    return "pricing";
  }

  if (
    [
      "problem",
      "issue",
      "bug",
      "error",
      "xeta",
      "xəta",
      "sorun",
      "support",
      "dəstək",
      "destek",
      "help",
    ].some((word) => normalized.includes(normalizeFreeText(word)))
  ) {
    return "support";
  }

  if (
    [
      "book",
      "booking",
      "reservation",
      "reserve",
      "appointment",
      "rezerv",
      "bron",
      "gorus",
      "görüş",
    ].some((word) => normalized.includes(normalizeFreeText(word)))
  ) {
    return "booking";
  }

  const activeServices = Array.isArray(runtime?.services) ? runtime.services : [];
  if (
    activeServices.some((item) =>
      normalized.includes(normalizeFreeText(item))
    )
  ) {
    return "service_interest";
  }

  return "general";
}

function buildDiagnostics({
  customerText = "",
  explicitNeed = false,
  category = "general",
  ackOnly = false,
  commandOnly = false,
  engine = null,
}) {
  return {
    explicitNeed,
    inferredNeedCategory: s(category || "general"),
    genericClarifierDetected: false,
    ackOnly,
    commandOnly,
    usedRecovery: false,
    customerTextPreview: s(customerText).slice(0, 220),
    aiIntent: s(engine?.intent || ""),
    aiAskCategory: s(engine?.askCategory || ""),
    aiStage: s(engine?.stage || ""),
    aiReplyMode: s(engine?.replyMode || ""),
    aiSemanticFailureReason: s(engine?.semanticFailureReason || ""),
    detectedService: s(engine?.detectedService || ""),
    shouldAskQuestion: Boolean(engine?.shouldAskQuestion),
    fallbackReason: s(engine?.fallbackReason || ""),
    replyPreview: s(engine?.replyText || "").slice(0, 220),
  };
}

function buildControl(engine = {}) {
  return {
    intent: s(engine?.intent || "general"),
    askCategory: s(engine?.askCategory || "general"),
    stage: s(engine?.stage || "general"),
    leadScore: Number(engine?.leadScore || 0),
    createLeadSuggested: engine?.createLead === true,
    handoffSuggested: engine?.handoff === true,
    handoffReason: s(engine?.handoffReason || ""),
    handoffPriority: s(engine?.handoffPriority || "normal"),
    noReplySuggested: engine?.noReply === true,
    confidence: Number(engine?.confidence || 0),
  };
}

function buildNoReply({
  runtime,
  policy,
  reasonCode = "reply_suppressed",
  language = "en",
  diagnostics = {},
  control = {},
  engine = null,
}) {
  return {
    ok: true,
    runtime,
    policy,
    ai: engine,
    reply: {
      shouldReply: false,
      text: "",
      mode: "suppressed",
      reasonCode: s(reasonCode),
      language: normalizeLanguage(language),
      confidence: Number(engine?.confidence || 0),
      usedRecovery: false,
    },
    control,
    diagnostics,
  };
}

export async function buildRealtimeReplyDecision({
  text,
  channel,
  externalUserId,
  tenantKey,
  thread,
  message,
  tenant = null,
  recentMessages = [],
  customerContext = {},
  formData = {},
  leadContext = {},
  conversationContext = {},
  services = [],
  knowledgeEntries = [],
  responsePlaybooks = [],
  threadState = null,
  runtime = null,
} = {}) {
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);
  const customerText = s(text);
  const cleanedCustomerText = stripLeadingCommand(customerText);
  const commandOnly = customerText.startsWith("/") && !cleanedCustomerText;
  const ackOnly = isAckOnlyText(cleanedCustomerText);

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
    }));

  const policy = getInboxPolicy({
    tenantKey: resolvedTenantKey,
    channel,
    tenant: resolvedRuntime?.tenant || tenant,
  });

  const baseLanguage = pickLanguage({}, resolvedRuntime);
  const explicitNeed = isMeaningfulCustomerNeed(cleanedCustomerText);

  if (!policy.channelAllowed) {
    return buildNoReply({
      runtime: resolvedRuntime,
      policy,
      reasonCode: "channel_not_allowed",
      language: baseLanguage,
      diagnostics: buildDiagnostics({
        customerText: cleanedCustomerText,
        explicitNeed,
        category: "general",
        ackOnly,
        commandOnly,
      }),
      control: buildControl(),
    });
  }

  if (!customerText) {
    return buildNoReply({
      runtime: resolvedRuntime,
      policy,
      reasonCode: "empty_text",
      language: baseLanguage,
      diagnostics: buildDiagnostics({
        customerText: cleanedCustomerText,
        explicitNeed,
        category: "general",
        ackOnly,
        commandOnly,
      }),
      control: buildControl(),
    });
  }

  if (ackOnly) {
    return buildNoReply({
      runtime: resolvedRuntime,
      policy,
      reasonCode: "ack_only",
      language: baseLanguage,
      diagnostics: buildDiagnostics({
        customerText: cleanedCustomerText,
        explicitNeed,
        category: "general",
        ackOnly,
        commandOnly,
      }),
      control: buildControl(),
    });
  }

  const engine = await runTenantAwareConversationEngine({
    text: customerText,
    channel,
    externalUserId,
    tenantKey: resolvedTenantKey,
    thread,
    message,
    tenant: resolvedRuntime?.tenant || tenant,
    policy,
    quietHoursApplied: false,
    recentMessages: normalizeRecentMessages(recentMessages),
    reliability: {},
    customerContext,
    formData,
    leadContext,
    conversationContext,
    services: resolvedRuntime?.serviceCatalog || services,
    knowledgeEntries: resolvedRuntime?.knowledgeEntries || knowledgeEntries,
    responsePlaybooks: resolvedRuntime?.responsePlaybooks || responsePlaybooks,
    threadState: resolvedRuntime?.threadState || threadState,
    runtime: resolvedRuntime,
  });

  const language = pickLanguage(engine, resolvedRuntime);
  const inferredCategory = inferNeedCategoryFromEngine(
    engine,
    resolvedRuntime,
    cleanedCustomerText
  );

  const diagnostics = buildDiagnostics({
    customerText: cleanedCustomerText,
    explicitNeed,
    category: inferredCategory,
    ackOnly,
    commandOnly,
    engine,
  });

  const control = buildControl(engine);

  const replyText = s(engine?.replyText || "");
  const shouldReply =
    policy.autoReplyEnabled &&
    !engine?.noReply &&
    Boolean(replyText);

  if (!shouldReply) {
    return {
      ok: true,
      runtime: resolvedRuntime,
      policy,
      ai: engine,
      reply: {
        shouldReply: false,
        text: "",
        mode: "suppressed",
        reasonCode: !policy.autoReplyEnabled
          ? "auto_reply_disabled"
          : s(engine?.noReply ? "conversation_engine_no_reply" : "reply_unavailable"),
        language,
        confidence: Number(engine?.confidence || 0),
        usedRecovery: false,
      },
      control,
      diagnostics,
    };
  }

  return {
    ok: true,
    runtime: resolvedRuntime,
    policy,
    ai: engine,
    reply: {
      shouldReply: true,
      text: replyText,
      mode: s(engine?.replyMode || "conversation_engine"),
      reasonCode: s(engine?.fallbackReason || ""),
      language,
      confidence: Number(engine?.confidence || 0),
      usedRecovery: false,
    },
    control,
    diagnostics,
  };
}

export const __test__ = {
  normalizeLanguage,
  isMeaningfulCustomerNeed,
  inferNeedCategoryFromEngine,
};