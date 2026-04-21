import {
  buildMeta,
  createLeadAction,
  handoffAction,
  markSeenAction,
  noReplyAction,
  sendMessageAction,
  typingOffAction,
  typingOnAction,
} from "./actions.js";
import { getThreadHandoffState, getReliabilityFlags } from "./threadState.js";
import { lower, obj, s, getResolvedTenantKey } from "./shared.js";

function normalizeLanguage(value = "") {
  const x = lower(value);
  if (!x) return "en";
  if (x.startsWith("az")) return "az";
  if (x.startsWith("tr")) return "tr";
  if (x.startsWith("ru")) return "ru";
  return "en";
}

function normalizePriority(value = "") {
  const x = lower(value);
  if (["low", "normal", "high", "urgent"].includes(x)) return x;
  return "normal";
}

function normalizeFreeText(value = "") {
  return lower(value)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text = "", list = []) {
  const haystack = normalizeFreeText(text);
  if (!haystack) return false;

  return list.some((item) => {
    const needle = normalizeFreeText(item);
    return needle && haystack.includes(needle);
  });
}

function isSalesAskCategory(value = "") {
  const x = lower(value);
  return [
    "service_interest",
    "recommendation",
    "pricing",
    "quote",
    "comparison",
    "timeline",
  ].includes(x);
}

function isSalesStage(value = "") {
  const x = lower(value);
  return [
    "discovery",
    "qualification",
    "recommendation",
    "pricing",
    "timeline",
    "objection",
    "closing",
  ].includes(x);
}

function isSalesFlow(control = {}) {
  return isSalesAskCategory(control?.askCategory) || isSalesStage(control?.stage);
}

function looksLikeSupportFlow(control = {}) {
  const askCategory = lower(control?.askCategory || "");
  const stage = lower(control?.stage || "");
  const intent = lower(control?.intent || "");

  return (
    askCategory === "support" ||
    stage === "support" ||
    intent === "support" ||
    intent === "unsupported_service"
  );
}

function detectExplicitHumanRequest(text = "", policy = {}) {
  const normalized = normalizeFreeText(text);
  if (!normalized) return false;

  const policyKeywords = Array.isArray(policy?.humanKeywords)
    ? policy.humanKeywords
    : [];

  const strongDefaultKeywords = [
    "operator",
    "human",
    "real person",
    "agent",
    "manager",
    "call me",
    "phone me",
    "ring me",
    "speak to someone",
    "support agent",
    "live agent",
    "customer representative",

    "operatorla",
    "operator ile",
    "insanla",
    "menecer",
    "menecerle",
    "zeng edin",
    "zəng edin",
    "mene zeng",
    "mənə zəng",
    "real insan",
    "canli destek",
    "canlı dəstək",

    "operatör",
    "insanla konuşmak",
    "biriyle konuşmak",
    "beni arayın",

    "оператор",
    "человек",
    "сотрудник",
    "менеджер",
    "перезвоните",
  ];

  return hasAny(normalized, [...policyKeywords, ...strongDefaultKeywords]);
}

function buildHumanRouteReply(language = "en") {
  const lang = normalizeLanguage(language);

  if (lang === "az") {
    return "Başa düşdüm. Sizi operatora yönləndirirəm.";
  }

  if (lang === "tr") {
    return "Anladım. Sizi operatöre yönlendiriyorum.";
  }

  if (lang === "ru") {
    return "Понял. Передаю вас оператору.";
  }

  return "Understood. I’m routing you to an operator.";
}

function buildAiEscalationReply(language = "en") {
  const lang = normalizeLanguage(language);

  if (lang === "az") {
    return "Başa düşdüm. Bu mövzuda operatorun qoşulması daha düzgündür, yönləndirirəm.";
  }

  if (lang === "tr") {
    return "Anladım. Bu konuda operatörün devreye girmesi daha doğru, yönlendiriyorum.";
  }

  if (lang === "ru") {
    return "Понял. По этой теме правильнее подключить оператора, передаю дальше.";
  }

  return "Understood. This is better handled by an operator, so I’m routing it now.";
}

function buildNoReplyReason({
  policy,
  reply,
  handoffState,
  reliability,
  shouldSendMessage,
  explicitHumanRequest,
}) {
  if (!policy?.autoReplyEnabled) return "auto_reply_disabled";
  if (explicitHumanRequest && handoffState?.active && reliability?.operatorRecentlyReplied) {
    return "human_request_waiting_for_operator";
  }
  if (handoffState?.active && reliability?.operatorRecentlyReplied) {
    return "handoff_active_operator_recently_replied";
  }
  if (!reply?.shouldReply) {
    return s(reply?.reasonCode || "reply_unavailable");
  }
  if (!shouldSendMessage) {
    return "reply_suppressed";
  }
  return "";
}

function shouldCreateLead({
  policy,
  control,
  reliability,
  explicitHumanRequest,
}) {
  if (!policy?.createLeadEnabled) return false;
  if (reliability?.leadAlreadyCreated) return false;

  const leadScore = Number(control?.leadScore || 0);
  const salesFlow = isSalesFlow(control);
  const supportFlow = looksLikeSupportFlow(control);

  if (control?.createLeadSuggested) return true;
  if (supportFlow) return false;
  if (salesFlow && leadScore >= 40) return true;
  if (salesFlow && ["pricing", "quote", "recommendation"].includes(lower(control?.askCategory || ""))) {
    return true;
  }
  if (explicitHumanRequest && leadScore >= 30) return true;
  if (leadScore >= 70) return true;

  return false;
}

function shouldStartHandoff({
  policy,
  control,
  handoffState,
  explicitHumanRequest,
}) {
  if (!policy?.handoffEnabled) return false;
  if (handoffState?.active) return false;

  const salesFlow = isSalesFlow(control);
  const supportFlow = looksLikeSupportFlow(control);
  const suggested = control?.handoffSuggested === true;
  const handoffReason = lower(control?.handoffReason || "");
  const manualReviewLike =
    !handoffReason ||
    handoffReason === "manual_review" ||
    handoffReason === "review" ||
    handoffReason === "manual";

  if (explicitHumanRequest) return true;

  if (supportFlow && suggested) return true;

  if (salesFlow) {
    if (!suggested) return false;
    if (manualReviewLike) return false;
    return ["urgent", "legal", "sensitive", "human_requested", "operator_required"].includes(
      handoffReason
    );
  }

  return suggested;
}

function resolveHandoffReason({
  control,
  explicitHumanRequest,
  handoffState,
}) {
  if (explicitHumanRequest) return "human_requested";
  if (s(control?.handoffReason)) return s(control.handoffReason);
  if (s(handoffState?.reason)) return s(handoffState.reason);
  return "manual_review";
}

function resolveHandoffPriority({
  control,
  explicitHumanRequest,
  handoffState,
}) {
  if (explicitHumanRequest) return "high";
  if (s(control?.handoffPriority)) return normalizePriority(control.handoffPriority);
  if (s(handoffState?.priority)) return normalizePriority(handoffState.priority);
  return "normal";
}

function resolveMetaBusinessContext({ thread, message, runtime } = {}) {
  const threadMeta = obj(thread?.meta);
  const messageMeta = obj(message?.meta);
  const runtimeMeta = obj(runtime?.channels?.meta);

  return {
    pageId: s(
      messageMeta.pageId ||
        messageMeta.page_id ||
        threadMeta.pageId ||
        threadMeta.page_id ||
        runtimeMeta.pageId ||
        runtimeMeta.page_id
    ),
    igUserId: s(
      messageMeta.igUserId ||
        messageMeta.ig_user_id ||
        messageMeta.instagramBusinessAccountId ||
        messageMeta.instagram_business_account_id ||
        threadMeta.igUserId ||
        threadMeta.ig_user_id ||
        threadMeta.instagramBusinessAccountId ||
        threadMeta.instagram_business_account_id ||
        runtimeMeta.igUserId ||
        runtimeMeta.ig_user_id ||
        runtimeMeta.instagramBusinessAccountId ||
        runtimeMeta.instagram_business_account_id
    ),
    externalAccountId: s(
      messageMeta.externalAccountId ||
        messageMeta.external_account_id ||
        threadMeta.externalAccountId ||
        threadMeta.external_account_id
    ),
  };
}

function buildControlMeta({
  tenantKey,
  thread,
  message,
  channel,
  reply,
  control,
  diagnostics,
  runtime,
}) {
  const metaBusinessContext = resolveMetaBusinessContext({
    thread,
    message,
    runtime,
  });

  return buildMeta({
    tenantKey,
    thread,
    message,
    intent: s(control?.intent || "general"),
    score: Number(control?.leadScore || 0),
    extra: {
      channel: s(channel),
      askCategory: s(control?.askCategory || "general"),
      stage: s(control?.stage || "general"),
      handoffSuggested: Boolean(control?.handoffSuggested),
      createLeadSuggested: Boolean(control?.createLeadSuggested),
      noReplySuggested: Boolean(control?.noReplySuggested),
      replyMode: s(reply?.mode || ""),
      replyLanguage: s(reply?.language || ""),
      replyConfidence: Number(reply?.confidence || 0),
      replyUsedRecovery: Boolean(reply?.usedRecovery),
      diagnostics: obj(diagnostics),
      runtimeAuthority: obj(runtime?.authority),
      pageId: metaBusinessContext.pageId,
      igUserId: metaBusinessContext.igUserId,
      externalAccountId: metaBusinessContext.externalAccountId,
    },
  });
}

export function buildConversationControlDecision({
  realtimeDecision,
  text,
  channel,
  externalUserId,
  tenantKey,
  thread,
  message,
  recentMessages = [],
  threadState = null,
} = {}) {
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);
  const realtime = obj(realtimeDecision);
  const runtime = obj(realtime.runtime);
  const policy = obj(realtime.policy);
  const reply = obj(realtime.reply);
  const control = obj(realtime.control);
  const diagnostics = obj(realtime.diagnostics);

  const effectiveThreadState = runtime?.threadState || threadState || null;
  const reliability = getReliabilityFlags({
    text,
    thread,
    recentMessages,
    quietHoursApplied: false,
    policy,
    threadState: effectiveThreadState,
  });

  const handoffState = getThreadHandoffState(thread, effectiveThreadState);
  const language = normalizeLanguage(reply?.language || "en");
  const explicitHumanRequest = detectExplicitHumanRequest(text, policy);
  const salesFlow = isSalesFlow(control);
  const supportFlow = looksLikeSupportFlow(control);

  const shouldOpenHandoff = shouldStartHandoff({
    policy,
    control,
    handoffState,
    explicitHumanRequest,
  });

  const shouldLead = shouldCreateLead({
    policy,
    control,
    reliability,
    explicitHumanRequest,
  });

  const shouldSuppressForOperator =
    handoffState.active && reliability.operatorRecentlyReplied;

  let finalReplyText = s(reply?.text || "");
  let finalReplyMode = s(reply?.mode || "");
  let finalReplyReasonCode = s(reply?.reasonCode || "");

  if (shouldOpenHandoff && explicitHumanRequest) {
    finalReplyText = buildHumanRouteReply(language);
    finalReplyMode = "control_handoff_human_request";
    finalReplyReasonCode = "human_requested";
  } else if (shouldOpenHandoff && !finalReplyText) {
    finalReplyText = buildAiEscalationReply(language);
    finalReplyMode = "control_handoff_ai_escalation";
    finalReplyReasonCode = s(control?.handoffReason || "manual_review");
  }

  const shouldSendMessage =
    policy.autoReplyEnabled &&
    !shouldSuppressForOperator &&
    Boolean(finalReplyText);

  const shouldMarkSeen = Boolean(policy.markSeenEnabled);
  const shouldTyping =
    Boolean(policy.typingIndicatorEnabled) &&
    shouldSendMessage &&
    !explicitHumanRequest;

  const noReplyReason = buildNoReplyReason({
    policy,
    reply: {
      ...reply,
      shouldReply: Boolean(finalReplyText),
      reasonCode: finalReplyReasonCode || reply?.reasonCode,
    },
    handoffState,
    reliability,
    shouldSendMessage,
    explicitHumanRequest,
  });

  const meta = buildControlMeta({
    tenantKey: resolvedTenantKey,
    thread,
    message,
    channel,
    reply: {
      ...reply,
      text: finalReplyText,
      mode: finalReplyMode || reply?.mode,
      reasonCode: finalReplyReasonCode || reply?.reasonCode,
    },
    control,
    diagnostics: {
      ...diagnostics,
      explicitHumanRequest,
      operatorRecentlyReplied: Boolean(reliability.operatorRecentlyReplied),
      leadAlreadyCreated: Boolean(reliability.leadAlreadyCreated),
      handoffActive: Boolean(handoffState.active),
      salesFlow,
      supportFlow,
    },
    runtime,
  });

  const actions = [];

  if (shouldMarkSeen) {
    actions.push(
      markSeenAction({
        channel,
        recipientId: externalUserId,
        meta,
      })
    );
  }

  if (shouldLead) {
    actions.push(
      createLeadAction({
        channel,
        externalUserId,
        thread,
        text,
        intent: s(control?.intent || "general"),
        meta,
      })
    );
  }

  if (shouldOpenHandoff) {
    actions.push(
      handoffAction({
        channel,
        externalUserId,
        thread,
        reason: resolveHandoffReason({
          control,
          explicitHumanRequest,
          handoffState,
        }),
        priority: resolveHandoffPriority({
          control,
          explicitHumanRequest,
          handoffState,
        }),
        meta,
      })
    );
  }

  if (shouldTyping) {
    actions.push(
      typingOnAction({
        channel,
        recipientId: externalUserId,
        meta,
      })
    );
  }

  if (shouldSendMessage) {
    actions.push(
      sendMessageAction({
        channel,
        recipientId: externalUserId,
        text: finalReplyText,
        meta,
      })
    );
  } else {
    actions.push(
      noReplyAction({
        reason: noReplyReason || "reply_suppressed",
        meta,
      })
    );
  }

  if (shouldTyping) {
    actions.push(
      typingOffAction({
        channel,
        recipientId: externalUserId,
        meta,
      })
    );
  }

  return {
    ok: true,
    runtime,
    policy,
    reply: {
      ...reply,
      shouldReply: shouldSendMessage,
      text: shouldSendMessage ? finalReplyText : "",
      mode: shouldSendMessage ? finalReplyMode || reply?.mode : "suppressed",
      reasonCode: shouldSendMessage
        ? finalReplyReasonCode || reply?.reasonCode || ""
        : noReplyReason || "reply_suppressed",
      language,
    },
    control: {
      ...control,
      explicitHumanRequest,
      salesFlow,
      supportFlow,
      shouldCreateLead: shouldLead,
      shouldStartHandoff: shouldOpenHandoff,
      handoffReason: resolveHandoffReason({
        control,
        explicitHumanRequest,
        handoffState,
      }),
      handoffPriority: resolveHandoffPriority({
        control,
        explicitHumanRequest,
        handoffState,
      }),
      shouldMarkSeen,
      shouldTyping,
      shouldSendMessage,
      shouldNoReply: !shouldSendMessage,
    },
    diagnostics: {
      ...diagnostics,
      explicitHumanRequest,
      salesFlow,
      supportFlow,
      operatorRecentlyReplied: Boolean(reliability.operatorRecentlyReplied),
      latestOutboundAgeMs: reliability.latestOutboundAgeMs,
      operatorOutboundAgeMs: reliability.operatorOutboundAgeMs,
      lastAiOutboundAgeMs: reliability.lastAiOutboundAgeMs,
      leadAlreadyCreated: Boolean(reliability.leadAlreadyCreated),
      handoffActive: Boolean(handoffState.active),
      handoffReason: s(handoffState.reason || ""),
      handoffPriority: s(handoffState.priority || "normal"),
      noReplyReason: s(noReplyReason || ""),
      finalReplyPreview: s(finalReplyText).slice(0, 220),
    },
    actions,
  };
}

export const __test__ = {
  normalizeLanguage,
  buildHumanRouteReply,
  buildAiEscalationReply,
  shouldCreateLead,
  shouldStartHandoff,
  resolveHandoffReason,
  resolveHandoffPriority,
  detectExplicitHumanRequest,
  isSalesFlow,
  looksLikeSupportFlow,
};
