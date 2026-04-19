import { getInboxPolicy, isPolicyQuietHours } from "../inboxPolicy.js";
import { buildAgentReplayTrace } from "../agentReplayTrace.js";
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
import { aiDecideInbox } from "./ai.js";
import { buildUnsupportedServiceReply } from "./fallback.js";
import { isAckOnlyText, normalizeRecentMessages } from "./messages.js";
import { resolveInboxRuntime } from "./runtime.js";
import { arr, getResolvedTenantKey, obj, s, sanitizeReplyText } from "./shared.js";
import {
  buildSuppressedReplyReason,
  getReliabilityFlags,
  getThreadHandoffState,
  isDuplicateReplyCandidate,
} from "./threadState.js";

function attachReplayTraceToActions(actions = [], trace = null) {
  const replayTrace = obj(trace);
  if (!Object.keys(replayTrace).length) return arr(actions);

  return arr(actions).map((action) => {
    const meta = obj(action?.meta);
    if (Object.keys(obj(meta.replayTrace)).length) return action;
    return {
      ...action,
      meta: {
        ...meta,
        replayTrace,
      },
    };
  });
}

function finalizeInboxDecisionResult(result = {}) {
  return {
    ...result,
    actions: attachReplayTraceToActions(result.actions, result.trace),
  };
}

function getRuntimeReplyGateSnapshot(runtime = {}) {
  const safeRuntime = obj(runtime);
  const tenant = obj(safeRuntime.tenant);
  const aiPolicy = obj(
    safeRuntime.aiPolicy || safeRuntime.ai_policy || tenant.ai_policy
  );
  const inboxPolicy = obj(
    safeRuntime.inboxPolicy || safeRuntime.inbox_policy || tenant.inbox_policy
  );

  return {
    runtimeAiAutoReplyEnabled:
      typeof aiPolicy.auto_reply_enabled === "boolean"
        ? aiPolicy.auto_reply_enabled
        : typeof aiPolicy.autoReplyEnabled === "boolean"
          ? aiPolicy.autoReplyEnabled
          : null,
    runtimeCreateLeadEnabled:
      typeof aiPolicy.create_lead_enabled === "boolean"
        ? aiPolicy.create_lead_enabled
        : typeof aiPolicy.createLeadEnabled === "boolean"
          ? aiPolicy.createLeadEnabled
          : null,
    runtimeInboxEnabled:
      typeof inboxPolicy.enabled === "boolean" ? inboxPolicy.enabled : null,
    runtimeInboxAiReplyEnabled:
      typeof inboxPolicy.ai_reply_enabled === "boolean"
        ? inboxPolicy.ai_reply_enabled
        : typeof inboxPolicy.aiReplyEnabled === "boolean"
          ? inboxPolicy.aiReplyEnabled
          : null,
  };
}

function logInboxReplyGate(label = "", payload = {}) {
  try {
    console.log(`[ai-hq] inbox ${label}`, payload);
  } catch {}
}

function stripLeadingCommand(text = "") {
  const source = s(text);
  if (!source.startsWith("/")) return source.trim();
  return source.replace(/^\/[^\s]+\s*/u, "").trim();
}

function countWordLikeTokens(text = "") {
  const cleaned = s(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

function isSubstantiveText(text = "") {
  const cleaned = stripLeadingCommand(text);
  if (!cleaned) return false;
  if (isAckOnlyText(cleaned)) return false;

  const tokenCount = countWordLikeTokens(cleaned);

  if (cleaned.length >= 20 && tokenCount >= 3) return true;
  if (cleaned.length >= 12 && tokenCount >= 4) return true;
  if (tokenCount >= 6) return true;

  return false;
}

function normalizeSemanticClass(value = "") {
  return s(value || "").trim().toLowerCase();
}

function isSemanticBusinessTurn(ai = {}, text = "") {
  const askCategory = normalizeSemanticClass(ai?.askCategory);
  const stage = normalizeSemanticClass(ai?.stage);
  const intent = normalizeSemanticClass(ai?.intent);

  if (
    [
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
    ].includes(askCategory)
  ) {
    return true;
  }

  if (
    [
      "discovery",
      "recommendation",
      "pricing",
      "timeline",
      "qualification",
      "objection",
      "support",
      "answer",
      "closing",
    ].includes(stage)
  ) {
    return true;
  }

  if (
    ["knowledge_answer", "playbook", "unsupported_service", "service_interest"].includes(
      intent
    )
  ) {
    return true;
  }

  return isSubstantiveText(text);
}

function shouldSilenceGreetingOnlyTurn({
  ai = {},
  reliability = {},
  text = "",
}) {
  const askCategory = normalizeSemanticClass(ai?.askCategory);
  const stage = normalizeSemanticClass(ai?.stage);
  const intent = normalizeSemanticClass(ai?.intent);
  const cleaned = stripLeadingCommand(text);

  const looksGreetingOnly =
    askCategory === "greeting" ||
    stage === "greeting" ||
    intent === "greeting";

  if (!looksGreetingOnly) return false;
  if (!s(reliability?.awaitingCustomerAnswerTo || "")) return false;
  if (isSubstantiveText(cleaned)) return false;

  return countWordLikeTokens(cleaned) <= 3 && cleaned.length <= 24;
}

function shouldBypassDuplicateSuppression({
  ai = {},
  text = "",
}) {
  return isSemanticBusinessTurn(ai, text);
}

function composeAiReply(ai = {}) {
  const replyText = sanitizeReplyText(ai?.replyText || "");
  if (replyText) return replyText;

  const answerFirst = sanitizeReplyText(ai?.answerFirst || "");
  const nextQuestion = sanitizeReplyText(ai?.recommendedNextQuestion || "");

  if (answerFirst && nextQuestion) {
    return sanitizeReplyText(`${answerFirst} ${nextQuestion}`);
  }
  return answerFirst || nextQuestion || "";
}

function buildSuppressionDebugPayload({
  tenantKey = "",
  channel = "",
  policy = {},
  runtime = {},
  ai = {},
  handoff = {},
  reliability = {},
  quietHoursApplied = false,
  duplicateReply = false,
  shouldReply = false,
  shouldTyping = false,
  replyText = "",
  suppressedReason = "",
  thread = null,
  message = null,
} = {}) {
  return {
    tenantKey: s(tenantKey),
    channel: s(channel),
    threadId: s(thread?.id),
    messageId: s(message?.id),
    quietHoursApplied: Boolean(quietHoursApplied),
    aiNoReply: Boolean(ai?.noReply),
    aiIntent: s(ai?.intent || ""),
    aiAskCategory: s(ai?.askCategory || ""),
    aiStage: s(ai?.stage || ""),
    aiReplyStyle: s(ai?.replyStyle || ""),
    aiConfidence: Number(ai?.confidence || 0),
    shouldReply: Boolean(shouldReply),
    shouldTyping: Boolean(shouldTyping),
    duplicateReply: Boolean(duplicateReply),
    suppressedReason: s(suppressedReason),
    replyTextPresent: Boolean(s(replyText)),
    replyPreview: s(replyText).slice(0, 220),
    handoffActive: Boolean(handoff?.active),
    handoffReason: s(handoff?.reason),
    operatorRecentlyReplied: Boolean(reliability?.operatorRecentlyReplied),
    duplicateOfLastAiReply: Boolean(reliability?.duplicateOfLastAiReply),
    lastKnownAiReplyText: s(reliability?.lastKnownAiReplyText || "").slice(0, 220),
    awaitingCustomerAnswerTo: s(reliability?.awaitingCustomerAnswerTo || ""),
    repeatIntentCount: Number(reliability?.repeatIntentCount || 0),
    leadAlreadyCreated: Boolean(reliability?.leadAlreadyCreated),
    policyAutoReplyEnabled: Boolean(policy?.autoReplyEnabled),
    policyCreateLeadEnabled: Boolean(policy?.createLeadEnabled),
    policyHandoffEnabled: Boolean(policy?.handoffEnabled),
    policyMarkSeenEnabled: Boolean(policy?.markSeenEnabled),
    policyTypingIndicatorEnabled: Boolean(policy?.typingIndicatorEnabled),
    policySuppressAiDuringHandoff: Boolean(policy?.suppressAiDuringHandoff),
    ...getRuntimeReplyGateSnapshot(runtime),
  };
}

function buildAiMetaExtra({
  metaBase = {},
  ai = {},
  profile = {},
  reliability = {},
  quietHoursApplied = false,
}) {
  return {
    ...metaBase,
    quietHoursApplied,
    engine: "ai",
    brandName: s(profile?.displayName || ""),
    industry: s(profile?.industry || ""),
    services: arr(profile?.services || []),
    disabledServices: arr(profile?.disabledServices || []),
    conversionGoal: s(profile?.conversionGoal || ""),
    primaryCta: s(profile?.primaryCta || ""),
    leadQualificationMode: s(profile?.leadQualificationMode || ""),
    toneProfile: s(profile?.toneProfile || ""),
    channelBehaviorInbox: obj(profile?.channelBehavior?.inbox),
    aiIntent: s(ai?.intent || ""),
    aiAskCategory: s(ai?.askCategory || ""),
    aiStage: s(ai?.stage || ""),
    aiReplyStyle: s(ai?.replyStyle || ""),
    aiCustomerGoal: s(ai?.customerGoal || ""),
    aiAnswerFirst: s(ai?.answerFirst || ""),
    aiRecommendedNextQuestion: s(ai?.recommendedNextQuestion || ""),
    aiKnownFacts: arr(ai?.knownFacts || []),
    aiMissingFacts: arr(ai?.missingFacts || []),
    aiGroundedFactsUsed: arr(ai?.groundedFactsUsed || []),
    aiConfidence: Number(ai?.confidence || 0),
    operatorRecentlyReplied: Boolean(reliability?.operatorRecentlyReplied),
    duplicateOfLastAiReply: Boolean(reliability?.duplicateOfLastAiReply),
    lastKnownAiReplyText: s(reliability?.lastKnownAiReplyText || ""),
    awaitingCustomerAnswerTo: s(reliability?.awaitingCustomerAnswerTo || ""),
    repeatIntentCount: Number(reliability?.repeatIntentCount || 0),
    leadAlreadyCreated: Boolean(reliability?.leadAlreadyCreated),
    ...getRuntimeReplyGateSnapshot(profile),
  };
}

function buildOrchestrationTrace({
  runtime,
  policy,
  promptBundle = null,
  channel,
  ai = {},
  shouldReply = false,
  shouldHandoff = false,
  suppressedReason = "",
}) {
  return buildAgentReplayTrace({
    runtime,
    behavior: runtime?.behavior || runtime,
    policy,
    promptBundle,
    channel: channel || "inbox",
    usecase: "inbox.reply",
    decisions: {
      cta: {
        selected: s(runtime?.primaryCta || ""),
        reason: s(runtime?.primaryCta || "") ? "approved_runtime_behavior" : "",
      },
      qualification: {
        mode: obj(runtime?.channelBehavior?.inbox).qualificationDepth,
        questionCount: arr(ai?.missingFacts || []).length,
        reason: arr(ai?.missingFacts || []).length > 0 ? "semantic_interpreter" : "",
      },
      handoff: {
        reason: s(ai?.handoffReason || ""),
        priority: s(ai?.handoffPriority || "normal"),
      },
    },
    evaluation: {
      outcome: shouldHandoff
        ? "handoff_recommended"
        : shouldReply
          ? "reply_recommended"
          : "no_reply_recommended",
      ctaDirection: shouldHandoff ? "handoff" : shouldReply ? "reply_with_cta" : "none",
      qualification: {
        status: s(ai?.stage || "general"),
        questionCount: arr(ai?.missingFacts || []).length,
      },
      handoff: {
        status: shouldHandoff ? "recommended" : "clear",
        reason: s(ai?.handoffReason || ""),
        priority: s(ai?.handoffPriority || "normal"),
      },
    },
    decisionPath: {
      status: shouldHandoff ? "escalated_to_operator" : shouldReply ? "answered" : "no_reply",
      reasonCode: s(
        suppressedReason ||
          ai?.handoffReason ||
          (shouldHandoff
            ? "ai_handoff_recommended"
            : shouldReply
              ? "semantic_reply_generated"
              : "reply_suppressed")
      ),
      detail: s(ai?.stage || ""),
    },
  });
}

function buildSimpleNoReplyResult({
  reason = "reply_suppressed",
  intent = "general",
  tenantKey,
  thread,
  message,
  policy,
  runtime,
  channel,
  leadScore = 0,
  extra = {},
}) {
  const meta = buildMeta({
    tenantKey,
    thread,
    message,
    intent,
    score: leadScore,
    extra: {
      ...extra,
      ...getRuntimeReplyGateSnapshot(runtime),
    },
  });

  return finalizeInboxDecisionResult({
    intent,
    leadScore,
    policy,
    actions: [
      noReplyAction({
        reason,
        meta,
      }),
    ],
    trace: buildOrchestrationTrace({
      runtime,
      policy,
      channel,
      ai: { intent, stage: "general" },
      shouldReply: false,
      shouldHandoff: false,
      suppressedReason: reason,
    }),
  });
}

export async function buildInboxActions({
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
  tenantContext = {},
  services = [],
  knowledgeEntries = [],
  responsePlaybooks = [],
  threadState = null,
  runtime = null,
}) {
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);

  const policy = getInboxPolicy({
    tenantKey: resolvedTenantKey,
    channel,
    tenant,
  });

  const resolvedRuntime = await resolveInboxRuntime({
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
    runtime: runtime || tenantContext?.runtime || tenantContext,
  });

  const effectiveThreadState = resolvedRuntime.threadState || threadState || null;
  const quietHoursApplied = isPolicyQuietHours(policy);
  const handoff = getThreadHandoffState(thread, effectiveThreadState);
  const reliability = getReliabilityFlags({
    text,
    thread,
    recentMessages,
    quietHoursApplied,
    policy,
    threadState: effectiveThreadState,
  });

  const metaBase = {
    tenantKey: resolvedTenantKey,
    threadId: s(thread?.id),
    messageId: s(message?.id),
    channelAllowed: Boolean(policy.channelAllowed),
    quietHoursApplied,
    handoffActive: Boolean(handoff.active),
    operatorRecentlyReplied: Boolean(reliability.operatorRecentlyReplied),
    duplicateOfLastAiReply: Boolean(reliability.duplicateOfLastAiReply),
    recentMessageCount: normalizeRecentMessages(recentMessages).length,
    latestCustomerText: s(text),
    awaitingCustomerAnswerTo: s(reliability?.awaitingCustomerAnswerTo || ""),
    repeatIntentCount: Number(reliability?.repeatIntentCount || 0),
    leadAlreadyCreated: Boolean(reliability?.leadAlreadyCreated),
    lastKnownAiReplyText: s(reliability?.lastKnownAiReplyText || ""),
  };

  logInboxReplyGate("runtime reply gate inputs", {
    tenantKey: resolvedTenantKey,
    channel: s(channel),
    threadId: s(thread?.id),
    messageId: s(message?.id),
    policyAutoReplyEnabled: Boolean(policy.autoReplyEnabled),
    policyCreateLeadEnabled: Boolean(policy.createLeadEnabled),
    policyHandoffEnabled: Boolean(policy.handoffEnabled),
    policyMarkSeenEnabled: Boolean(policy.markSeenEnabled),
    policyTypingIndicatorEnabled: Boolean(policy.typingIndicatorEnabled),
    policySuppressAiDuringHandoff: Boolean(policy.suppressAiDuringHandoff),
    ...getRuntimeReplyGateSnapshot(resolvedRuntime),
  });

  if (!policy.channelAllowed) {
    return buildSimpleNoReplyResult({
      reason: "channel_not_allowed",
      intent: "channel_blocked",
      tenantKey: resolvedTenantKey,
      thread,
      message,
      policy,
      runtime: resolvedRuntime,
      channel,
      extra: metaBase,
    });
  }

  if (!s(text)) {
    return buildSimpleNoReplyResult({
      reason: "empty_text",
      intent: "empty",
      tenantKey: resolvedTenantKey,
      thread,
      message,
      policy,
      runtime: resolvedRuntime,
      channel,
      extra: metaBase,
    });
  }

  if (thread?.status === "spam") {
    return buildSimpleNoReplyResult({
      reason: "thread_status_blocked",
      intent: "thread_blocked",
      tenantKey: resolvedTenantKey,
      thread,
      message,
      policy,
      runtime: resolvedRuntime,
      channel,
      extra: {
        ...metaBase,
        threadStatus: s(thread?.status),
      },
    });
  }

  if (handoff.active && policy.suppressAiDuringHandoff && reliability.operatorRecentlyReplied) {
    const actions = [];
    const meta = buildMeta({
      tenantKey: resolvedTenantKey,
      thread,
      message,
      intent: "handoff_active",
      score: 0,
      extra: {
        ...metaBase,
        handoffReason: handoff.reason,
        handoffPriority: handoff.priority,
        ...getRuntimeReplyGateSnapshot(resolvedRuntime),
      },
    });

    if (policy.markSeenEnabled) {
      actions.push(
        markSeenAction({
          channel,
          recipientId: externalUserId,
          meta,
        })
      );
    }

    actions.push(
      noReplyAction({
        reason: "handoff_active",
        meta,
      })
    );

    return finalizeInboxDecisionResult({
      intent: "handoff_active",
      leadScore: 0,
      policy,
      actions,
      trace: buildOrchestrationTrace({
        runtime: resolvedRuntime,
        policy,
        channel,
        ai: {
          intent: "handoff_active",
          handoffReason: handoff.reason,
          handoffPriority: handoff.priority,
        },
        shouldReply: false,
        shouldHandoff: true,
        suppressedReason: "handoff_active",
      }),
    });
  }

  if (isAckOnlyText(text)) {
    const actions = [];
    const meta = buildMeta({
      tenantKey: resolvedTenantKey,
      thread,
      message,
      intent: "ack",
      score: 0,
      extra: {
        ...metaBase,
        engine: "ack_guard",
        ...getRuntimeReplyGateSnapshot(resolvedRuntime),
      },
    });

    if (policy.markSeenEnabled) {
      actions.push(
        markSeenAction({
          channel,
          recipientId: externalUserId,
          meta,
        })
      );
    }

    actions.push(
      noReplyAction({
        reason: "ack_only",
        meta,
      })
    );

    return finalizeInboxDecisionResult({
      intent: "ack",
      leadScore: 0,
      policy,
      actions,
      trace: buildOrchestrationTrace({
        runtime: resolvedRuntime,
        policy,
        channel,
        ai: { intent: "ack" },
        shouldReply: false,
        shouldHandoff: false,
        suppressedReason: "ack_only",
      }),
    });
  }

  const ai = await aiDecideInbox({
    text,
    channel,
    externalUserId,
    tenantKey: resolvedTenantKey,
    thread,
    message,
    tenant,
    policy,
    quietHoursApplied,
    recentMessages,
    reliability,
    customerContext,
    formData,
    leadContext,
    conversationContext,
    services,
    knowledgeEntries: resolvedRuntime.knowledgeEntries || knowledgeEntries,
    responsePlaybooks: resolvedRuntime.responsePlaybooks || responsePlaybooks,
    threadState: effectiveThreadState,
    runtime: resolvedRuntime,
  });

  if (!ai) {
    return buildSimpleNoReplyResult({
      reason: "ai_unavailable",
      intent: "general",
      tenantKey: resolvedTenantKey,
      thread,
      message,
      policy,
      runtime: resolvedRuntime,
      channel,
      extra: {
        ...metaBase,
        engine: "ai_missing",
      },
    });
  }

  const aiProfile = ai.profile || resolvedRuntime;
  let intent = s(ai.intent || "general") || "general";
  let replyText = composeAiReply(ai);
  let leadScore = Math.max(0, Math.min(100, Number(ai.leadScore || 0)));

  let shouldCreateLead = Boolean(ai.createLead);
  let shouldHandoff = Boolean(ai.handoff) && Boolean(policy.handoffEnabled);
  let shouldReply =
    Boolean(policy.autoReplyEnabled) &&
    (Boolean(replyText) || Boolean(ai.answerFirst) || Boolean(ai.recommendedNextQuestion)) &&
    (!Boolean(ai.noReply) || isSemanticBusinessTurn(ai, text));
  let shouldMarkSeen = Boolean(policy.markSeenEnabled);
  let shouldTyping = Boolean(policy.typingIndicatorEnabled);

  if (intent === "unsupported_service") {
    replyText = sanitizeReplyText(buildUnsupportedServiceReply(aiProfile));
    shouldReply = Boolean(policy.autoReplyEnabled) && Boolean(replyText);
    shouldCreateLead = false;
    shouldHandoff = false;
  }

  if (quietHoursApplied) {
    shouldReply = false;
    shouldTyping = false;
  }

  if (reliability?.leadAlreadyCreated) {
    shouldCreateLead = false;
  }

  if (!policy.createLeadEnabled) {
    shouldCreateLead = false;
  }

  if (shouldSilenceGreetingOnlyTurn({ ai, reliability, text })) {
    shouldReply = false;
    shouldTyping = false;
  }

  let duplicateReply = isDuplicateReplyCandidate(replyText, reliability);
  if (duplicateReply && shouldBypassDuplicateSuppression({ ai, text })) {
    duplicateReply = false;
  }

  if (duplicateReply) {
    shouldReply = false;
    shouldTyping = false;
  }

  const suppressedReason =
    !shouldReply || !replyText
      ? shouldSilenceGreetingOnlyTurn({ ai, reliability, text })
        ? "greeting_without_new_information"
        : buildSuppressedReplyReason({
            quietHoursApplied,
            reliability,
            handoffActive: handoff.active,
            duplicateReply,
          })
      : "";

  logInboxReplyGate(
    "ai reply gating",
    buildSuppressionDebugPayload({
      tenantKey: resolvedTenantKey,
      channel,
      policy,
      runtime: aiProfile,
      ai,
      handoff,
      reliability,
      quietHoursApplied,
      duplicateReply,
      shouldReply,
      shouldTyping,
      replyText,
      suppressedReason,
      thread,
      message,
    })
  );

  const commonMeta = buildMeta({
    tenantKey: resolvedTenantKey,
    thread,
    message,
    intent,
    score: leadScore,
    extra: buildAiMetaExtra({
      metaBase,
      ai,
      profile: aiProfile,
      reliability,
      quietHoursApplied,
    }),
  });

  const actions = [];

  if (shouldMarkSeen) {
    actions.push(
      markSeenAction({
        channel,
        recipientId: externalUserId,
        meta: commonMeta,
      })
    );
  }

  if (shouldCreateLead) {
    actions.push(
      createLeadAction({
        channel,
        externalUserId,
        thread,
        text,
        intent,
        meta: commonMeta,
      })
    );
  }

  if (shouldHandoff) {
    actions.push(
      handoffAction({
        channel,
        externalUserId,
        thread,
        reason: s(ai.handoffReason || "manual_review"),
        priority: s(ai.handoffPriority || "normal"),
        meta: commonMeta,
      })
    );
  }

  if (shouldReply && shouldTyping && replyText) {
    actions.push(
      typingOnAction({
        channel,
        recipientId: externalUserId,
        meta: commonMeta,
      })
    );
  }

  if (shouldReply && replyText) {
    actions.push(
      sendMessageAction({
        channel,
        recipientId: externalUserId,
        text: replyText,
        meta: commonMeta,
      })
    );
  } else {
    actions.push(
      noReplyAction({
        reason: suppressedReason || "reply_suppressed",
        meta: commonMeta,
      })
    );
  }

  if (shouldReply && shouldTyping && replyText) {
    actions.push(
      typingOffAction({
        channel,
        recipientId: externalUserId,
        meta: commonMeta,
      })
    );
  }

  return finalizeInboxDecisionResult({
    intent,
    leadScore,
    policy,
    actions,
    trace:
      obj(ai.trace) && Object.keys(obj(ai.trace)).length
        ? ai.trace
        : buildOrchestrationTrace({
            runtime: aiProfile,
            policy,
            promptBundle: ai.promptBundle || null,
            channel,
            ai,
            shouldReply,
            shouldHandoff,
            suppressedReason,
          }),
  });
}