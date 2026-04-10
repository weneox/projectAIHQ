import { getInboxPolicy, isPolicyQuietHours } from "../inboxPolicy.js";
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
import { buildAgentReplayTrace } from "../agentReplayTrace.js";
import {
  buildFallbackReply,
  buildKnowledgeReply,
  buildPlaybookReply,
  buildUnsupportedServiceReply,
} from "./fallback.js";
import { isAckOnlyText, normalizeRecentMessages } from "./messages.js";
import {
  classifyTenantAwareIntent,
  forceSafeIntent,
  matchKnowledgeEntries,
  matchPlaybook,
  shouldAllowHandoffByText,
} from "./matchers.js";
import {
  getTenantBusinessProfile,
  pickBehaviorLeadPrompt,
  resolveInboxRuntime,
} from "./runtime.js";
import {
  arr,
  getResolvedTenantKey,
  includesAny,
  lower,
  obj,
  s,
  sanitizeReplyText,
} from "./shared.js";
import {
  buildSuppressedReplyReason,
  getReliabilityFlags,
  getThreadHandoffState,
  isDuplicateReplyCandidate,
} from "./threadState.js";

function getBehaviorKeywords(trigger) {
  switch (lower(trigger)) {
    case "urgent_health_claim":
      return ["urgent", "tecili", "pain", "bleeding", "emergency", "diaqnoz", "diagnosis"];
    case "legal_risk_claim":
      return ["court", "mahkeme", "məhkəmə", "legal advice", "qanuni", "muqavile", "müqavilə"];
    case "financing_or_document_review":
      return ["mortgage", "credit", "loan", "approval", "document", "contract", "sened", "sənəd"];
    case "human_request":
      return [];
    default:
      return [];
  }
}

function getDisallowedClaimKeywords(claim) {
  switch (lower(claim)) {
    case "diagnosis_or_treatment_guarantees":
      return ["diaqnoz", "diagnosis", "treatment guarantee", "guarantee", "zemanet", "zəmanət"];
    case "legal_advice_or_guarantees":
      return ["legal advice", "court win", "guarantee", "zemanet", "zəmanət"];
    case "guaranteed_roi_or_approval":
      return ["roi", "approval", "approved", "guarantee", "zemanet", "zəmanət"];
    case "instant_result_guarantees":
      return ["instant result", "guarantee", "zemanet", "zəmanət"];
    case "unverified_outcome_promises":
      return ["guarantee", "promise", "100%", "definitely"];
    default:
      return [];
  }
}

function detectBehaviorSignals(text, profile) {
  const incoming = lower(text);
  const handoffTriggers = arr(profile?.handoffTriggers);
  const disallowedClaims = arr(profile?.disallowedClaims);
  const urgent = includesAny(incoming, profile?.urgentKeywords);

  const matchedHandoffTrigger = handoffTriggers.find((trigger) => {
    const normalizedTrigger = lower(trigger);
    if (!normalizedTrigger) return false;
    if (normalizedTrigger === "human_request") {
      return includesAny(incoming, profile?.humanKeywords);
    }
    return includesAny(incoming, getBehaviorKeywords(normalizedTrigger));
  });

  const matchedDisallowedClaim = disallowedClaims.find((claim) =>
    includesAny(incoming, getDisallowedClaimKeywords(claim))
  );

  return {
    matchedHandoffTrigger: s(matchedHandoffTrigger),
    matchedDisallowedClaim: s(matchedDisallowedClaim),
    urgent,
  };
}

function buildBehaviorSafeReply(profile, signals) {
  const leadPrompt = pickBehaviorLeadPrompt(profile);
  if (signals?.matchedDisallowedClaim) {
    return sanitizeReplyText(
      `Bu movzuda tesdiqlenmemis iddia vermirik. ${leadPrompt}`
    );
  }

  if (signals?.matchedHandoffTrigger) {
    return sanitizeReplyText(
      `Sizi daha duzgun yonlendirmek ucun komanda uzvu ile davam ede bilerik. ${leadPrompt}`
    );
  }

  return sanitizeReplyText(leadPrompt);
}

function buildInboxReplayTrace({
  profile,
  channel,
  policy = {},
  intent,
  promptBundle = null,
  matchedHandoffTrigger = "",
  matchedDisallowedClaim = "",
  handoffReason = "",
  handoffPriority = "",
  shouldReply = null,
  shouldHandoff = null,
  qualificationStatus = "",
}) {
  return buildAgentReplayTrace({
    runtime: profile,
    behavior: profile?.behavior || profile,
    policy,
    promptBundle,
    channel: channel || "inbox",
    usecase: "inbox.reply",
    decisions: {
      cta: {
        selected: s(profile?.primaryCta),
        reason: s(profile?.primaryCta) ? "approved_runtime_behavior" : "",
      },
      qualification: {
        mode: obj(profile?.channelBehavior?.inbox).qualificationDepth,
        questionCount: arr(profile?.qualificationQuestions).length,
        reason:
          arr(profile?.qualificationQuestions).length > 0
            ? "approved_runtime_behavior"
            : "",
      },
      handoff: {
        trigger: s(matchedHandoffTrigger),
        reason: s(handoffReason || (intent === "handoff_request" ? "handoff_request" : "")),
        priority: s(handoffPriority),
      },
      claimBlock: {
        blocked: Boolean(matchedDisallowedClaim),
        claim: s(matchedDisallowedClaim),
        reason: matchedDisallowedClaim ? "behavior_guardrail" : "",
      },
    },
    evaluation: {
      outcome: s(
        shouldHandoff === true
          ? "handoff_recommended"
          : shouldReply === true
            ? "reply_recommended"
            : shouldReply === false
              ? "no_reply_recommended"
              : intent
      ),
      ctaDirection: s(
        shouldHandoff === true
          ? "handoff"
          : shouldReply === true
            ? "reply_with_cta"
            : shouldReply === false
              ? "none"
              : ""
      ),
      qualification: {
        status:
          s(qualificationStatus) ||
          (arr(profile?.qualificationQuestions).length > 0 ? "guided" : "none"),
        questionCount: arr(profile?.qualificationQuestions).length,
      },
      handoff: {
        status: shouldHandoff === true ? "recommended" : "clear",
        trigger: s(matchedHandoffTrigger),
        reason: s(handoffReason || (intent === "handoff_request" ? "handoff_request" : "")),
        priority: s(handoffPriority),
      },
      claimBlock: {
        status: matchedDisallowedClaim ? "blocked" : "clear",
        blocked: Boolean(matchedDisallowedClaim),
        claim: s(matchedDisallowedClaim),
        reason: matchedDisallowedClaim ? "behavior_guardrail" : "",
      },
    },
    decisionPath: buildInboxDecisionPath({
      intent,
      matchedDisallowedClaim,
      handoffReason,
      handoffPriority,
      shouldReply,
      shouldHandoff,
    }),
  });
}

function buildInboxDecisionPath({
  intent = "",
  matchedDisallowedClaim = "",
  handoffReason = "",
  handoffPriority = "",
  shouldReply = null,
  shouldHandoff = null,
} = {}) {
  const safeIntent = lower(intent);

  if (matchedDisallowedClaim) {
    return {
      status: shouldReply === true ? "fallback_safe_response" : "refused",
      reasonCode: "behavior_guardrail",
      detail: s(matchedDisallowedClaim),
    };
  }

  if (safeIntent === "unsupported_service" && shouldReply === true) {
    return {
      status: "fallback_safe_response",
      reasonCode: "unsupported_service_safe_reply",
    };
  }

  if (shouldHandoff === true && shouldReply === true) {
    return {
      status: "fallback_safe_response",
      reasonCode: s(handoffReason || "handoff_safe_reply"),
      detail: s(handoffPriority),
    };
  }

  if (shouldHandoff === true) {
    return {
      status: "escalated_to_operator",
      reasonCode: s(handoffReason || "handoff_recommended"),
      detail: s(handoffPriority),
    };
  }

  if (safeIntent === "channel_blocked") {
    return { status: "no_reply", reasonCode: "channel_not_allowed" };
  }
  if (safeIntent === "empty") {
    return { status: "no_reply", reasonCode: "empty_text" };
  }
  if (safeIntent === "thread_blocked") {
    return { status: "no_reply", reasonCode: "thread_status_blocked" };
  }
  if (safeIntent === "handoff_active") {
    return { status: "no_reply", reasonCode: "handoff_active" };
  }
  if (safeIntent === "ack") {
    return { status: "no_reply", reasonCode: "ack_only" };
  }
  if (safeIntent === "operator_recently_replied") {
    return { status: "no_reply", reasonCode: "operator_recently_replied" };
  }

  if (shouldReply === false) {
    return { status: "no_reply", reasonCode: "reply_suppressed" };
  }

  return {
    status: "answered",
    reasonCode:
      {
        playbook: "playbook_reply",
        knowledge_answer: "knowledge_reply",
        unsupported_service: "unsupported_service_safe_reply",
      }[safeIntent] || "approved_runtime_reply",
  };
}

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

function buildInboxActionsFallback({
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
  services = [],
  knowledgeEntries = [],
  responsePlaybooks = [],
  threadState = null,
  runtime = null,
}) {
  const actions = [];
  const profile =
    runtime ||
    getTenantBusinessProfile(tenant, tenantKey, services);
  const behaviorSignals = detectBehaviorSignals(text, profile);

  const runtimeKnowledge = Array.isArray(runtime?.knowledgeEntries)
    ? runtime.knowledgeEntries
    : knowledgeEntries;

  const runtimePlaybooks = Array.isArray(runtime?.responsePlaybooks)
    ? runtime.responsePlaybooks
    : responsePlaybooks;

  const effectiveThreadState = runtime?.threadState || threadState || null;

  const classified = classifyTenantAwareIntent(text, profile, policy);
  const matchedKnowledge = matchKnowledgeEntries(text, runtimeKnowledge, 5);
  const matchedPlaybook = matchPlaybook(text, runtimePlaybooks);

  let intent = classified.intent;
  let leadScore = classified.score;

  if (matchedPlaybook) {
    intent = "playbook";
    leadScore = Math.max(leadScore, matchedPlaybook.createLead ? 60 : 28);
  } else if (matchedKnowledge.length && ["general", "support", "service_interest"].includes(intent)) {
    intent = "knowledge_answer";
    leadScore = Math.max(leadScore, 32);
  }

  let replyText = sanitizeReplyText(
    buildFallbackReply({
      intent,
      profile,
      knowledgeEntries: matchedKnowledge,
      playbook: matchedPlaybook,
    })
  );

  let shouldCreateLead =
    Boolean(matchedPlaybook?.createLead) ||
    ["pricing", "service_interest", "handoff_request", "urgent_interest", "general"].includes(intent);

  let shouldHandoff =
    Boolean(matchedPlaybook?.handoff) ||
    ["handoff_request", "urgent_interest"].includes(intent);

  let shouldReply = Boolean(policy.autoReplyEnabled);
  let shouldMarkSeen = Boolean(policy.markSeenEnabled);
  let shouldTyping = Boolean(policy.typingIndicatorEnabled);

  let handoffReason = matchedPlaybook?.handoffReason || "";
  let handoffPriority = matchedPlaybook?.handoffPriority || "normal";

  if (intent === "handoff_request") {
    handoffReason = handoffReason || "user_requested_human";
    handoffPriority = handoffPriority || "high";
  }

  if (intent === "urgent_interest") {
    handoffReason = handoffReason || "urgent_request";
    handoffPriority = handoffPriority || "high";
    leadScore = Math.max(leadScore, 92);
  }

  if (behaviorSignals.matchedDisallowedClaim) {
    intent = "handoff_request";
    shouldCreateLead = Boolean(policy.createLeadEnabled);
    shouldHandoff = Boolean(policy.handoffEnabled);
    replyText = buildBehaviorSafeReply(profile, behaviorSignals);
    handoffReason = handoffReason || lower(behaviorSignals.matchedDisallowedClaim);
    handoffPriority = behaviorSignals.urgent ? "high" : "normal";
    leadScore = Math.max(leadScore, behaviorSignals.urgent ? 90 : 68);
  } else if (behaviorSignals.matchedHandoffTrigger) {
    shouldHandoff = Boolean(policy.handoffEnabled);
    shouldCreateLead = Boolean(policy.createLeadEnabled);
    handoffReason = handoffReason || lower(behaviorSignals.matchedHandoffTrigger);
    handoffPriority = behaviorSignals.urgent ? "high" : handoffPriority || "normal";
    leadScore = Math.max(leadScore, behaviorSignals.urgent ? 88 : 58);
  }

  if (quietHoursApplied) {
    shouldReply = false;
    shouldTyping = false;
  }

  if (reliability?.operatorRecentlyReplied && getThreadHandoffState(thread, effectiveThreadState).active) {
    shouldReply = false;
    shouldTyping = false;
  }

  if (reliability?.leadAlreadyCreated && !["urgent_interest", "handoff_request"].includes(intent)) {
    shouldCreateLead = false;
  }

  if (!policy.createLeadEnabled) shouldCreateLead = false;
  if (!policy.handoffEnabled) shouldHandoff = false;
  if (shouldHandoff && !shouldAllowHandoffByText(text, profile) && !matchedPlaybook?.handoff) {
    shouldHandoff = false;
  }

  const duplicateReply = isDuplicateReplyCandidate(replyText, reliability);
  const handoffState = getThreadHandoffState(thread, effectiveThreadState);

  const commonMeta = buildMeta({
    tenantKey,
    thread,
    message,
    intent,
    score: leadScore,
    extra: {
      quietHoursApplied,
      recentMessageCount: normalizeRecentMessages(recentMessages).length,
      policyAutoReplyEnabled: Boolean(policy.autoReplyEnabled),
      policyCreateLeadEnabled: Boolean(policy.createLeadEnabled),
      policyHandoffEnabled: Boolean(policy.handoffEnabled),
      policyMarkSeenEnabled: Boolean(policy.markSeenEnabled),
      policyTypingIndicatorEnabled: Boolean(policy.typingIndicatorEnabled),
      policySuppressAiDuringHandoff: Boolean(policy.suppressAiDuringHandoff),
      timezone: s(policy.timezone || "Asia/Baku"),
      engine: matchedPlaybook ? "playbook" : matchedKnowledge.length ? "knowledge" : "fallback",
      brandName: profile.displayName,
      industry: profile.industry,
      niche: s(profile.niche || profile.businessType),
      services: profile.services,
      disabledServices: profile.disabledServices,
      conversionGoal: s(profile.conversionGoal),
      primaryCta: s(profile.primaryCta),
      leadQualificationMode: s(profile.leadQualificationMode),
      toneProfile: s(profile.toneProfile),
      handoffTriggers: arr(profile.handoffTriggers),
      disallowedClaims: arr(profile.disallowedClaims),
      channelBehaviorInbox: obj(profile.channelBehavior?.inbox),
      operatorRecentlyReplied: Boolean(reliability?.operatorRecentlyReplied),
      duplicateOfLastAiReply: Boolean(reliability?.duplicateOfLastAiReply),
      duplicateReplyCandidate: duplicateReply,
      lastKnownAiReplyText: s(reliability?.lastKnownAiReplyText || ""),
      awaitingCustomerAnswerTo: s(reliability?.awaitingCustomerAnswerTo || ""),
      repeatIntentCount: Number(reliability?.repeatIntentCount || 0),
      leadAlreadyCreated: Boolean(reliability?.leadAlreadyCreated),
      threadState: effectiveThreadState || {},
      matchedKnowledgeTitles: matchedKnowledge.map((x) => x.title).filter(Boolean),
      matchedPlaybookName: s(matchedPlaybook?.name),
    },
  });

  if (shouldMarkSeen) {
    actions.push(markSeenAction({ channel, recipientId: externalUserId, meta: commonMeta }));
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
        reason: handoffReason || "manual_review",
        priority: handoffPriority || "normal",
        meta: commonMeta,
      })
    );
  }

  if (shouldReply && shouldTyping && replyText && !duplicateReply) {
    actions.push(typingOnAction({ channel, recipientId: externalUserId, meta: commonMeta }));
  }

  if (shouldReply && replyText && !duplicateReply) {
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
        reason: buildSuppressedReplyReason({
          quietHoursApplied,
          reliability,
          handoffActive: handoffState.active,
          duplicateReply,
        }),
        meta: commonMeta,
      })
    );
  }

  if (shouldReply && shouldTyping && replyText && !duplicateReply) {
    actions.push(typingOffAction({ channel, recipientId: externalUserId, meta: commonMeta }));
  }

  return finalizeInboxDecisionResult({
    intent,
    leadScore,
    policy,
    actions,
    trace: buildInboxReplayTrace({
      profile,
      channel,
      policy,
      intent,
      matchedHandoffTrigger: behaviorSignals.matchedHandoffTrigger,
      matchedDisallowedClaim: behaviorSignals.matchedDisallowedClaim,
      handoffReason,
      handoffPriority,
      shouldReply,
      shouldHandoff,
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

  const incoming = lower(text);
  const actions = [];
  const handoff = getThreadHandoffState(thread, effectiveThreadState);
  const quietHoursApplied = isPolicyQuietHours(policy);
  const reliability = getReliabilityFlags({
    text,
    thread,
    recentMessages,
    quietHoursApplied,
    policy,
    threadState: effectiveThreadState,
  });

  const profile = resolvedRuntime;
  const behaviorSignals = detectBehaviorSignals(text, profile);
  const matchedKnowledge = matchKnowledgeEntries(text, resolvedRuntime.knowledgeEntries, 5);
  const matchedPlaybook = matchPlaybook(text, resolvedRuntime.responsePlaybooks);

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
    brandName: profile.displayName,
    industry: profile.industry,
    niche: s(profile.niche || profile.businessType),
    services: profile.services,
    disabledServices: profile.disabledServices,
    conversionGoal: s(profile.conversionGoal),
    primaryCta: s(profile.primaryCta),
    leadQualificationMode: s(profile.leadQualificationMode),
    toneProfile: s(profile.toneProfile),
    handoffTriggers: arr(profile.handoffTriggers),
    disallowedClaims: arr(profile.disallowedClaims),
    channelBehaviorInbox: obj(profile.channelBehavior?.inbox),
    matchedBehaviorHandoffTrigger: behaviorSignals.matchedHandoffTrigger,
    matchedBehaviorDisallowedClaim: behaviorSignals.matchedDisallowedClaim,
    threadState: effectiveThreadState || {},
    matchedKnowledgeTitles: matchedKnowledge.map((x) => x.title).filter(Boolean),
    matchedPlaybookName: s(matchedPlaybook?.name),
    awaitingCustomerAnswerTo: s(reliability?.awaitingCustomerAnswerTo || ""),
    repeatIntentCount: Number(reliability?.repeatIntentCount || 0),
    leadAlreadyCreated: Boolean(reliability?.leadAlreadyCreated),
    lastKnownAiReplyText: s(reliability?.lastKnownAiReplyText || ""),
  };

  if (!policy.channelAllowed) {
    return finalizeInboxDecisionResult({
      intent: "channel_blocked",
      leadScore: 0,
      policy,
      actions: [
        noReplyAction({
          reason: "channel_not_allowed",
          meta: metaBase,
        }),
      ],
      trace: buildInboxReplayTrace({
        profile,
        channel,
        policy,
        intent: "channel_blocked",
        shouldReply: false,
      }),
    });
  }

  if (!incoming) {
    return finalizeInboxDecisionResult({
      intent: "empty",
      leadScore: 0,
      policy,
      actions: [
        noReplyAction({
          reason: "empty_text",
          meta: metaBase,
        }),
      ],
      trace: buildInboxReplayTrace({
        profile,
        channel,
        policy,
        intent: "empty",
        shouldReply: false,
      }),
    });
  }

  if (thread?.status === "spam") {
    return finalizeInboxDecisionResult({
      intent: "thread_blocked",
      leadScore: 0,
      policy,
      actions: [
        noReplyAction({
          reason: "thread_status_blocked",
          meta: {
            ...metaBase,
            threadStatus: s(thread?.status),
          },
        }),
      ],
      trace: buildInboxReplayTrace({
        profile,
        channel,
        policy,
        intent: "thread_blocked",
        shouldReply: false,
      }),
    });
  }

  if (handoff.active && policy.suppressAiDuringHandoff && reliability.operatorRecentlyReplied) {
    if (policy.markSeenEnabled) {
      actions.push(
        markSeenAction({
          channel,
          recipientId: externalUserId,
          meta: buildMeta({
            tenantKey: resolvedTenantKey,
            thread,
            message,
            intent: "handoff_active",
            score: 0,
            extra: {
              ...metaBase,
              handoffReason: handoff.reason,
              handoffPriority: handoff.priority,
            },
          }),
        })
      );
    }

    actions.push(
      noReplyAction({
        reason: "handoff_active",
        meta: buildMeta({
          tenantKey: resolvedTenantKey,
          thread,
          message,
          intent: "handoff_active",
          score: 0,
          extra: {
            ...metaBase,
            handoffReason: handoff.reason,
            handoffPriority: handoff.priority,
          },
        }),
      })
    );

    return finalizeInboxDecisionResult({
      intent: "handoff_active",
      leadScore: 0,
      policy,
      actions,
      trace: buildInboxReplayTrace({
        profile,
        channel,
        policy,
        intent: "handoff_active",
        handoffReason: handoff.reason,
        handoffPriority: handoff.priority,
        shouldReply: false,
        shouldHandoff: true,
      }),
    });
  }

  if (isAckOnlyText(incoming)) {
    if (policy.markSeenEnabled) {
      actions.push(
        markSeenAction({
          channel,
          recipientId: externalUserId,
          meta: buildMeta({
            tenantKey: resolvedTenantKey,
            thread,
            message,
            intent: "ack",
            score: 0,
            extra: { ...metaBase, engine: "rule_ack" },
          }),
        })
      );
    }

    actions.push(
      noReplyAction({
        reason: "ack_only",
        meta: buildMeta({
          tenantKey: resolvedTenantKey,
          thread,
          message,
          intent: "ack",
          score: 0,
          extra: { ...metaBase, engine: "rule_ack" },
        }),
      })
    );

    return finalizeInboxDecisionResult({
      intent: "ack",
      leadScore: 0,
      policy,
      actions,
      trace: buildInboxReplayTrace({
        profile,
        channel,
        policy,
        intent: "ack",
        shouldReply: false,
      }),
    });
  }

  if (reliability.operatorRecentlyReplied && handoff.active) {
    if (policy.markSeenEnabled) {
      actions.push(
        markSeenAction({
          channel,
          recipientId: externalUserId,
          meta: buildMeta({
            tenantKey: resolvedTenantKey,
            thread,
            message,
            intent: "operator_recently_replied",
            score: 0,
            extra: metaBase,
          }),
        })
      );
    }

    actions.push(
      noReplyAction({
        reason: "operator_recently_replied",
        meta: buildMeta({
          tenantKey: resolvedTenantKey,
          thread,
          message,
          intent: "operator_recently_replied",
          score: 0,
          extra: metaBase,
        }),
      })
    );

    return finalizeInboxDecisionResult({
      intent: "operator_recently_replied",
      leadScore: 0,
      policy,
      actions,
      trace: buildInboxReplayTrace({
        profile,
        channel,
        policy,
        intent: "operator_recently_replied",
        shouldReply: false,
      }),
    });
  }

  if (behaviorSignals.matchedDisallowedClaim) {
    const intent = "handoff_request";
    const leadScore = behaviorSignals.urgent ? 90 : 68;
    const shouldReply = Boolean(policy.autoReplyEnabled) && !quietHoursApplied;
    const shouldTyping = Boolean(policy.typingIndicatorEnabled) && shouldReply;
    const shouldMarkSeen = Boolean(policy.markSeenEnabled);
    const shouldCreateLead = Boolean(policy.createLeadEnabled) && !reliability?.leadAlreadyCreated;
    const shouldHandoff = Boolean(policy.handoffEnabled);
    const replyText = buildBehaviorSafeReply(profile, behaviorSignals);

    const commonMeta = buildMeta({
      tenantKey: resolvedTenantKey,
      thread,
      message,
      intent,
      score: leadScore,
      extra: {
        ...metaBase,
        engine: "behavior_guardrail",
      },
    });

    if (shouldMarkSeen) {
      actions.push(markSeenAction({ channel, recipientId: externalUserId, meta: commonMeta }));
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
          reason: lower(behaviorSignals.matchedDisallowedClaim) || "restricted_claim",
          priority: behaviorSignals.urgent ? "high" : "normal",
          meta: commonMeta,
        })
      );
    }

    const duplicateReply = isDuplicateReplyCandidate(replyText, reliability);

    if (shouldReply && shouldTyping && replyText && !duplicateReply) {
      actions.push(typingOnAction({ channel, recipientId: externalUserId, meta: commonMeta }));
    }

    if (shouldReply && replyText && !duplicateReply) {
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
          reason: buildSuppressedReplyReason({
            quietHoursApplied,
            reliability,
            handoffActive: handoff.active,
            duplicateReply,
          }),
          meta: commonMeta,
        })
      );
    }

    if (shouldReply && shouldTyping && replyText && !duplicateReply) {
      actions.push(typingOffAction({ channel, recipientId: externalUserId, meta: commonMeta }));
    }

    return finalizeInboxDecisionResult({
      intent,
      leadScore,
      policy,
      actions,
      trace: buildInboxReplayTrace({
        profile,
        channel,
        policy,
        intent,
        matchedDisallowedClaim: behaviorSignals.matchedDisallowedClaim,
        handoffReason: lower(behaviorSignals.matchedDisallowedClaim) || "restricted_claim",
        handoffPriority: behaviorSignals.urgent ? "high" : "normal",
        shouldReply,
        shouldHandoff,
      }),
    });
  }

  if (matchedPlaybook && matchedPlaybook.replyTemplate) {
    const replyText = sanitizeReplyText(buildPlaybookReply(matchedPlaybook, profile));
    const intent = "playbook";
    const leadScore = matchedPlaybook.createLead ? 60 : 28;
    const shouldReply = Boolean(policy.autoReplyEnabled) && !quietHoursApplied;
    const shouldTyping = Boolean(policy.typingIndicatorEnabled) && shouldReply;
    const shouldMarkSeen = Boolean(policy.markSeenEnabled);
    let shouldCreateLead = Boolean(policy.createLeadEnabled && matchedPlaybook.createLead);
    const shouldHandoff = Boolean(policy.handoffEnabled && matchedPlaybook.handoff);

    if (reliability?.leadAlreadyCreated) shouldCreateLead = false;

    const commonMeta = buildMeta({
      tenantKey: resolvedTenantKey,
      thread,
      message,
      intent,
      score: leadScore,
      extra: {
        ...metaBase,
        engine: "playbook",
      },
    });

    if (shouldMarkSeen) {
      actions.push(markSeenAction({ channel, recipientId: externalUserId, meta: commonMeta }));
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
          reason: matchedPlaybook.handoffReason || "manual_review",
          priority: matchedPlaybook.handoffPriority || "normal",
          meta: commonMeta,
        })
      );
    }

    const duplicateReply = isDuplicateReplyCandidate(replyText, reliability);

    if (shouldReply && shouldTyping && replyText && !duplicateReply) {
      actions.push(typingOnAction({ channel, recipientId: externalUserId, meta: commonMeta }));
    }

    if (shouldReply && replyText && !duplicateReply) {
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
          reason: buildSuppressedReplyReason({
            quietHoursApplied,
            reliability,
            handoffActive: handoff.active,
            duplicateReply,
          }),
          meta: commonMeta,
        })
      );
    }

    if (shouldReply && shouldTyping && replyText && !duplicateReply) {
      actions.push(typingOffAction({ channel, recipientId: externalUserId, meta: commonMeta }));
    }

    return finalizeInboxDecisionResult({
      intent,
      leadScore,
      policy,
      actions,
      trace: buildInboxReplayTrace({
        profile,
        channel,
        policy,
        intent,
        handoffReason: matchedPlaybook.handoffReason || "manual_review",
        handoffPriority: matchedPlaybook.handoffPriority || "normal",
        shouldReply,
        shouldHandoff,
      }),
    });
  }

  if (
    matchedKnowledge.length &&
    !includesAny(incoming, profile?.humanKeywords) &&
    !includesAny(incoming, profile?.urgentKeywords)
  ) {
    const replyText = sanitizeReplyText(buildKnowledgeReply(matchedKnowledge, profile));
    if (replyText) {
      const intent = "knowledge_answer";
      const leadScore = 30;
      const shouldReply = Boolean(policy.autoReplyEnabled) && !quietHoursApplied;
      const shouldTyping = Boolean(policy.typingIndicatorEnabled) && shouldReply;
      const shouldMarkSeen = Boolean(policy.markSeenEnabled);

      const commonMeta = buildMeta({
        tenantKey: resolvedTenantKey,
        thread,
        message,
        intent,
        score: leadScore,
        extra: {
          ...metaBase,
          engine: "knowledge",
        },
      });

      if (shouldMarkSeen) {
        actions.push(markSeenAction({ channel, recipientId: externalUserId, meta: commonMeta }));
      }

      const duplicateReply = isDuplicateReplyCandidate(replyText, reliability);

      if (shouldReply && shouldTyping && replyText && !duplicateReply) {
        actions.push(typingOnAction({ channel, recipientId: externalUserId, meta: commonMeta }));
      }

      if (shouldReply && replyText && !duplicateReply) {
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
            reason: buildSuppressedReplyReason({
              quietHoursApplied,
              reliability,
              handoffActive: handoff.active,
              duplicateReply,
            }),
            meta: commonMeta,
          })
        );
      }

      if (shouldReply && shouldTyping && replyText && !duplicateReply) {
        actions.push(typingOffAction({ channel, recipientId: externalUserId, meta: commonMeta }));
      }

      return finalizeInboxDecisionResult({
        intent,
        leadScore,
        policy,
        actions,
        trace: buildInboxReplayTrace({
          profile,
          channel,
          policy,
          intent,
          shouldReply,
        }),
      });
    }
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
    knowledgeEntries: resolvedRuntime.knowledgeEntries,
    responsePlaybooks: resolvedRuntime.responsePlaybooks,
    threadState: effectiveThreadState,
    runtime: resolvedRuntime,
  });

  if (ai) {
    const aiProfile = ai.profile || profile;

    let intent = forceSafeIntent(ai.intent, aiProfile, text);
    let replyText = sanitizeReplyText(ai.replyText || "");
    let leadScore = Math.max(0, Math.min(100, Number(ai.leadScore || 0)));

    let shouldCreateLead =
      Boolean(ai.createLead) ||
      ["pricing", "service_interest", "general"].includes(intent);

    let shouldHandoff =
      Boolean(ai.handoff) &&
      shouldAllowHandoffByText(text, aiProfile);

    let shouldReply = Boolean(policy.autoReplyEnabled) && !Boolean(ai.noReply);
    let shouldMarkSeen = Boolean(policy.markSeenEnabled);
    let shouldTyping = Boolean(policy.typingIndicatorEnabled);
    let handoffReason = s(ai.handoffReason || "");
    let handoffPriority = s(ai.handoffPriority || "normal").toLowerCase() || "normal";

    if (behaviorSignals.matchedHandoffTrigger) {
      shouldHandoff = Boolean(policy.handoffEnabled);
      shouldCreateLead = Boolean(policy.createLeadEnabled) && !reliability?.leadAlreadyCreated;
      handoffReason = handoffReason || lower(behaviorSignals.matchedHandoffTrigger);
      handoffPriority = behaviorSignals.urgent ? "high" : handoffPriority;
      leadScore = Math.max(leadScore, behaviorSignals.urgent ? 88 : 58);
    }

    if (intent === "unsupported_service") {
      replyText = sanitizeReplyText(buildUnsupportedServiceReply(aiProfile));
      shouldCreateLead = false;
      shouldHandoff = false;
      shouldReply = Boolean(policy.autoReplyEnabled);
    }

    if (quietHoursApplied) {
      shouldReply = false;
      shouldTyping = false;
    }

    if (reliability?.leadAlreadyCreated && !["urgent_interest", "handoff_request"].includes(intent)) {
      shouldCreateLead = false;
    }

    if (!policy.createLeadEnabled) shouldCreateLead = false;
    if (!policy.handoffEnabled) shouldHandoff = false;

    if (
      !replyText &&
      ["greeting", "pricing", "service_interest", "support", "general", "unsupported_service", "knowledge_answer"].includes(intent)
    ) {
      replyText = sanitizeReplyText(
        buildFallbackReply({
          intent,
          profile: aiProfile,
          knowledgeEntries: ai.matchedKnowledge || matchedKnowledge,
          playbook: ai.matchedPlaybook || matchedPlaybook,
        })
      );
      shouldReply = true;
    }

    if (
      ai.noReply &&
      ["greeting", "pricing", "service_interest", "support", "general", "unsupported_service", "knowledge_answer"].includes(intent)
    ) {
      shouldReply = true;
    }

    const duplicateReply = isDuplicateReplyCandidate(replyText, reliability);

    if (duplicateReply) {
      shouldReply = false;
      shouldTyping = false;
    }

    const commonMeta = buildMeta({
      tenantKey: resolvedTenantKey,
      thread,
      message,
      intent,
      score: leadScore,
      extra: {
        quietHoursApplied,
        recentMessageCount: normalizeRecentMessages(recentMessages).length,
        policyAutoReplyEnabled: Boolean(policy.autoReplyEnabled),
        policyCreateLeadEnabled: Boolean(policy.createLeadEnabled),
        policyHandoffEnabled: Boolean(policy.handoffEnabled),
        policyMarkSeenEnabled: Boolean(policy.markSeenEnabled),
        policyTypingIndicatorEnabled: Boolean(policy.typingIndicatorEnabled),
        policySuppressAiDuringHandoff: Boolean(policy.suppressAiDuringHandoff),
        timezone: s(policy.timezone || "Asia/Baku"),
        engine: "ai",
        brandName: aiProfile.displayName,
        industry: aiProfile.industry,
        services: aiProfile.services,
        disabledServices: aiProfile.disabledServices,
        operatorRecentlyReplied: Boolean(reliability.operatorRecentlyReplied),
        duplicateOfLastAiReply: Boolean(reliability.duplicateOfLastAiReply),
        duplicateReplyCandidate: duplicateReply,
        lastKnownAiReplyText: s(reliability?.lastKnownAiReplyText || ""),
        awaitingCustomerAnswerTo: s(reliability?.awaitingCustomerAnswerTo || ""),
        repeatIntentCount: Number(reliability?.repeatIntentCount || 0),
        leadAlreadyCreated: Boolean(reliability?.leadAlreadyCreated),
        threadState: effectiveThreadState || {},
        matchedKnowledgeTitles: (ai.matchedKnowledge || matchedKnowledge).map((x) => x.title).filter(Boolean),
        matchedPlaybookName: s((ai.matchedPlaybook || matchedPlaybook)?.name),
      },
    });

    if (shouldMarkSeen) {
      actions.push(markSeenAction({ channel, recipientId: externalUserId, meta: commonMeta }));
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
          reason: handoffReason || "manual_review",
          priority: handoffPriority || "normal",
          meta: commonMeta,
        })
      );
    }

    if (shouldReply && shouldTyping && replyText) {
      actions.push(typingOnAction({ channel, recipientId: externalUserId, meta: commonMeta }));
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
          reason: buildSuppressedReplyReason({
            quietHoursApplied,
            reliability,
            handoffActive: handoff.active,
            duplicateReply,
          }),
          meta: commonMeta,
        })
      );
    }

    if (shouldReply && shouldTyping && replyText) {
      actions.push(typingOffAction({ channel, recipientId: externalUserId, meta: commonMeta }));
    }

    return finalizeInboxDecisionResult({
      intent,
      leadScore,
      policy,
      actions,
      trace: buildInboxReplayTrace({
        profile: aiProfile,
        channel,
        policy,
        intent,
        promptBundle: ai.promptBundle || null,
        matchedHandoffTrigger: behaviorSignals.matchedHandoffTrigger,
        handoffReason,
        handoffPriority,
        shouldReply,
        shouldHandoff,
      }),
    });
  }

  return buildInboxActionsFallback({
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
    services,
    knowledgeEntries: resolvedRuntime.knowledgeEntries,
    responsePlaybooks: resolvedRuntime.responsePlaybooks,
    threadState: effectiveThreadState,
    runtime: resolvedRuntime,
  });
}
