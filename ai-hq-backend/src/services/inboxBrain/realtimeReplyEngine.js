import { getInboxPolicy } from "../inboxPolicy.js";
import { aiDecideInbox } from "./ai.js";
import {
  isAckOnlyText,
  normalizeRecentMessages,
  stripLeadingCommand,
} from "./messages.js";
import { resolveInboxRuntime } from "./runtime.js";
import { getResolvedTenantKey, lower, obj, s, sanitizeReplyText } from "./shared.js";

function normalizeLanguage(value = "") {
  const x = lower(value);
  if (!x) return "en";
  if (x.startsWith("az")) return "az";
  if (x.startsWith("tr")) return "tr";
  if (x.startsWith("ru")) return "ru";
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

function hasAny(text = "", words = []) {
  const haystack = normalizeFreeText(text);
  if (!haystack) return false;

  return words.some((word) => {
    const needle = normalizeFreeText(word);
    return needle && haystack.includes(needle);
  });
}

function isMeaningfulCustomerNeed(text = "") {
  const cleaned = stripLeadingCommand(text);
  if (!cleaned) return false;
  if (isAckOnlyText(cleaned)) return false;

  const normalized = normalizeFreeText(cleaned);
  const tokenCount = countTokens(normalized);

  if (
    hasAny(normalized, [
      "need",
      "want",
      "looking for",
      "help",
      "problem",
      "issue",
      "price",
      "pricing",
      "quote",
      "book",
      "booking",
      "reservation",
      "website",
      "web site",
      "web sayt",
      "sayt",
      "site",
      "qiymet",
      "qiymət",
      "destek",
      "dəstək",
      "support",
      "rezerv",
      "reservation",
      "mene",
      "mənə",
      "lazim",
      "lazımdır",
      "lazimdi",
      "isteyirem",
      "istəyirəm",
      "istiyirem",
      "problemim",
      "sorun",
      "xeta",
      "xəta",
    ])
  ) {
    return true;
  }

  if (tokenCount >= 4) return true;
  if (cleaned.length >= 18) return true;

  return false;
}

function inferNeedCategory(text = "") {
  const normalized = normalizeFreeText(stripLeadingCommand(text));

  if (
    hasAny(normalized, [
      "website",
      "web site",
      "web",
      "site",
      "sayt",
      "web sayt",
      "landing page",
      "ecommerce",
      "e commerce",
      "online store",
    ])
  ) {
    return "website";
  }

  if (
    hasAny(normalized, [
      "price",
      "pricing",
      "quote",
      "cost",
      "qiymet",
      "qiymət",
      "teklif",
      "budget",
    ])
  ) {
    return "pricing";
  }

  if (
    hasAny(normalized, [
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
    ])
  ) {
    return "support";
  }

  if (
    hasAny(normalized, [
      "book",
      "booking",
      "reservation",
      "reserve",
      "appointment",
      "rezerv",
      "bron",
      "gorus",
      "görüş",
    ])
  ) {
    return "booking";
  }

  if (
    hasAny(normalized, [
      "service",
      "xidmet",
      "xidmət",
      "offer",
      "offerings",
      "what do you do",
    ])
  ) {
    return "service";
  }

  return "general";
}

const GENERIC_REPEAT_PATTERNS = [
  "tell me briefly what you need",
  "tell me briefly what you need help with",
  "share what you need",
  "describe the issue briefly",
  "tell me the topic briefly",
  "write briefly what you need",
  "qisa olaraq neye ehtiyaciniz oldugunu yazin",
  "qisa olaraq neye ehtiyaciniz oldugunu yazin",
  "ne ile bagli komek lazim oldugunu qisa yazin",
  "mövzunu qısa yazın",
  "problemi qisa yazin",
  "nəyə ehtiyacınız olduğunu yazın",
  "nə ilə bağlı kömək lazım olduğunu qısa yazın",
  "kısaca neye ihtiyacınız olduğunu yazın",
  "hangi konuda yardıma ihtiyacınız olduğunu kısaca yazın",
  "kratko napishite chto vam nuzhno",
];

function isGenericRepeatReply(replyText = "") {
  const normalized = normalizeFreeText(replyText);
  if (!normalized) return true;

  return GENERIC_REPEAT_PATTERNS.some((pattern) =>
    normalized.includes(normalizeFreeText(pattern))
  );
}

function pickLanguage(ai = {}, runtime = {}) {
  return normalizeLanguage(
    ai?.language || runtime?.languages?.[0] || runtime?.profile?.language || "en"
  );
}

function getLocalizedCopy(language = "en") {
  const lang = normalizeLanguage(language);

  if (lang === "az") {
    return {
      ack: "Başa düşdüm.",
      categories: {
        website: "Sizə veb sayt lazımdır.",
        pricing: "Qiymətlə bağlı soruşursunuz.",
        support: "Problemlə bağlı yazırsınız.",
        booking: "Rezervasiya ilə bağlı yazırsınız.",
        service: "Xidmətlə bağlı soruşursunuz.",
        general: "Mövzunu anladım.",
      },
      questions: {
        website:
          "Daha düzgün yönləndirmək üçün birini yazın: sayt sıfırdan qurulacaq, yoxsa mövcud sayt yenilənəcək?",
        pricing:
          "Daha düzgün cavab vermək üçün qiyməti hansı xidmət üçün istədiyinizi yazın.",
        support:
          "Dəqiq kömək etmək üçün problemin harada göründüyünü bir cümlə ilə yazın.",
        booking:
          "Dəqiq yönləndirmək üçün hansı xidmət üçün rezervasiya istədiyinizi yazın.",
        service:
          "Dəqiq yönləndirmək üçün sizə konkret hansı xidmətin lazım olduğunu yazın.",
        general:
          "Dəqiq yönləndirmək üçün əsas məqsədinizi bir cümlə ilə yazın.",
      },
    };
  }

  if (lang === "tr") {
    return {
      ack: "Anladım.",
      categories: {
        website: "Size web sitesi gerekiyor.",
        pricing: "Fiyat tarafını soruyorsunuz.",
        support: "Bir problem desteği istiyorsunuz.",
        booking: "Rezervasyon tarafını soruyorsunuz.",
        service: "Hizmet tarafını soruyorsunuz.",
        general: "Konuyu anladım.",
      },
      questions: {
        website:
          "Daha net yönlendirmem için şunu yazın: site sıfırdan mı yapılacak, yoksa mevcut site mi yenilenecek?",
        pricing:
          "Daha net cevap verebilmem için fiyatı hangi hizmet için istediğinizi yazın.",
        support:
          "Daha doğru yardımcı olabilmem için sorunun nerede göründüğünü tek cümleyle yazın.",
        booking:
          "Daha doğru yönlendirmem için hangi hizmet için rezervasyon istediğinizi yazın.",
        service:
          "Daha net yönlendirmem için tam olarak hangi hizmete ihtiyacınız olduğunu yazın.",
        general:
          "Daha net yönlendirmem için ana amacınızı tek cümleyle yazın.",
      },
    };
  }

  if (lang === "ru") {
    return {
      ack: "Понял.",
      categories: {
        website: "Вам нужен сайт.",
        pricing: "Вы спрашиваете о стоимости.",
        support: "Вы пишете по проблеме.",
        booking: "Вы пишете по бронированию.",
        service: "Вы спрашиваете об услуге.",
        general: "Я понял тему.",
      },
      questions: {
        website:
          "Чтобы точнее сориентировать, напишите одно: сайт нужен с нуля или требуется обновление существующего?",
        pricing:
          "Чтобы ответить точнее, напишите, для какой именно услуги нужна стоимость.",
        support:
          "Чтобы помочь точнее, напишите одним предложением, где именно проявляется проблема.",
        booking:
          "Чтобы правильно направить дальше, напишите, для какой услуги нужно бронирование.",
        service:
          "Чтобы точнее направить дальше, напишите, какая именно услуга вам нужна.",
        general:
          "Чтобы точнее направить дальше, напишите одной фразой вашу основную цель.",
      },
    };
  }

  return {
    ack: "Understood.",
    categories: {
      website: "You need a website.",
      pricing: "You are asking about pricing.",
      support: "You are writing about a problem.",
      booking: "You are asking about booking.",
      service: "You are asking about a service.",
      general: "I understand the topic.",
    },
    questions: {
      website:
        "To guide this properly, tell me one thing: do you need a brand new site, or an update to an existing one?",
      pricing:
        "To answer this properly, tell me which service you want pricing for.",
      support:
        "To help accurately, write in one sentence where the problem appears.",
      booking:
        "To guide this properly, tell me which service you want to book.",
      service:
        "To guide this properly, tell me which exact service you need.",
      general:
        "To guide this properly, write your main goal in one sentence.",
    },
  };
}

function buildNeedAwareRecoveryReply({
  customerText = "",
  language = "en",
  category = "general",
}) {
  const copy = getLocalizedCopy(language);
  const safeCategory = copy.categories[category] ? category : "general";

  const pieces = [
    copy.ack,
    copy.categories[safeCategory],
    copy.questions[safeCategory],
  ].filter(Boolean);

  return sanitizeReplyText(pieces.join(" "));
}

function buildNoReply({
  runtime,
  policy,
  reasonCode = "reply_suppressed",
  language = "en",
  diagnostics = {},
  control = {},
}) {
  return {
    ok: true,
    runtime,
    policy,
    ai: null,
    reply: {
      shouldReply: false,
      text: "",
      mode: "suppressed",
      reasonCode: s(reasonCode),
      language: normalizeLanguage(language),
      confidence: 0,
      usedRecovery: false,
    },
    control,
    diagnostics,
  };
}

function buildDiagnostics({
  customerText = "",
  category = "general",
  explicitNeed = false,
  genericClarifierDetected = false,
  ackOnly = false,
  commandOnly = false,
  usedRecovery = false,
  ai = null,
  replyText = "",
}) {
  return {
    explicitNeed,
    inferredNeedCategory: s(category),
    genericClarifierDetected,
    ackOnly,
    commandOnly,
    usedRecovery,
    customerTextPreview: s(customerText).slice(0, 220),
    aiIntent: s(ai?.intent || ""),
    aiAskCategory: s(ai?.askCategory || ""),
    aiStage: s(ai?.stage || ""),
    aiReplyMode: s(ai?.replyMode || ""),
    aiSemanticFailureReason: s(ai?.semanticFailureReason || ""),
    replyPreview: s(replyText).slice(0, 220),
  };
}

function buildControl(ai = {}) {
  return {
    intent: s(ai?.intent || "general"),
    askCategory: s(ai?.askCategory || "general"),
    stage: s(ai?.stage || "general"),
    leadScore: Number(ai?.leadScore || 0),
    createLeadSuggested: ai?.createLead === true,
    handoffSuggested: ai?.handoff === true,
    handoffReason: s(ai?.handoffReason || ""),
    handoffPriority: s(ai?.handoffPriority || "normal"),
    noReplySuggested: ai?.noReply === true,
    confidence: Number(ai?.confidence || 0),
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

  const language = pickLanguage({}, resolvedRuntime);
  const category = inferNeedCategory(cleanedCustomerText);
  const explicitNeed = isMeaningfulCustomerNeed(cleanedCustomerText);

  if (!policy.channelAllowed) {
    return buildNoReply({
      runtime: resolvedRuntime,
      policy,
      reasonCode: "channel_not_allowed",
      language,
      diagnostics: buildDiagnostics({
        customerText: cleanedCustomerText,
        category,
        explicitNeed,
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
      language,
      diagnostics: buildDiagnostics({
        customerText: cleanedCustomerText,
        category,
        explicitNeed,
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
      language,
      diagnostics: buildDiagnostics({
        customerText: cleanedCustomerText,
        category,
        explicitNeed,
        ackOnly,
        commandOnly,
      }),
      control: buildControl(),
    });
  }

  const ai = await aiDecideInbox({
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

  const aiLanguage = pickLanguage(ai, resolvedRuntime);
  const aiReplyText = sanitizeReplyText(
    ai?.replyText || ai?.replyBodyText || ai?.answerFirst || ""
  );
  const genericClarifierDetected = isGenericRepeatReply(aiReplyText);

  let replyText = aiReplyText;
  let replyMode = s(ai?.replyMode || "semantic") || "semantic";
  let shouldReply =
    policy.autoReplyEnabled &&
    !ai?.noReply &&
    Boolean(replyText);

  let usedRecovery = false;
  if (
    explicitNeed &&
    (genericClarifierDetected || !replyText) &&
    !commandOnly
  ) {
    replyText = buildNeedAwareRecoveryReply({
      customerText: cleanedCustomerText,
      language: aiLanguage,
      category,
    });
    replyMode = "recovered_need_aware";
    shouldReply = policy.autoReplyEnabled && Boolean(replyText);
    usedRecovery = Boolean(replyText);
  }

  if (!policy.autoReplyEnabled) {
    shouldReply = false;
  }

  const control = buildControl(ai);
  const diagnostics = buildDiagnostics({
    customerText: cleanedCustomerText,
    category,
    explicitNeed,
    genericClarifierDetected,
    ackOnly,
    commandOnly,
    usedRecovery,
    ai,
    replyText,
  });

  if (!shouldReply) {
    return {
      ok: true,
      runtime: resolvedRuntime,
      policy,
      ai,
      reply: {
        shouldReply: false,
        text: "",
        mode: "suppressed",
        reasonCode: !policy.autoReplyEnabled
          ? "auto_reply_disabled"
          : s(ai?.noReply ? "ai_no_reply" : "reply_unavailable"),
        language: aiLanguage,
        confidence: Number(ai?.confidence || 0),
        usedRecovery,
      },
      control,
      diagnostics,
    };
  }

  return {
    ok: true,
    runtime: resolvedRuntime,
    policy,
    ai,
    reply: {
      shouldReply: true,
      text: replyText,
      mode: replyMode,
      reasonCode: usedRecovery ? "need_aware_recovery" : "",
      language: aiLanguage,
      confidence: Number(ai?.confidence || 0),
      usedRecovery,
    },
    control,
    diagnostics,
  };
}

export const __test__ = {
  normalizeLanguage,
  isMeaningfulCustomerNeed,
  inferNeedCategory,
  isGenericRepeatReply,
  buildNeedAwareRecoveryReply,
};