import {
  normalizeTextForCompare,
  nowMs,
  obj,
  s,
  toMs,
} from "./shared.js";
import {
  getLastAiOutbound,
  getLatestOperatorOutbound,
  getLatestOutbound,
  normalizeRecentMessages,
} from "./messages.js";

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hasMeaningfulValue(value) {
  return value !== undefined && value !== null && value !== "";
}

export function getStateField(state, ...keys) {
  const src = obj(state);
  const meta = obj(src.last_decision_meta || src.lastDecisionMeta);

  for (const key of keys) {
    const value = src?.[key];
    if (hasMeaningfulValue(value)) return value;
  }

  for (const key of keys) {
    const value = meta?.[key];
    if (hasMeaningfulValue(value)) return value;
  }

  return null;
}

export function getThreadStateSignals(threadState = null) {
  const state = obj(threadState);

  const handoffActive =
    Boolean(getStateField(state, "handoffActive", "handoff_active")) ||
    Boolean(
      getStateField(
        state,
        "suppressed_until_operator_reply",
        "suppressedUntilOperatorReply"
      )
    );

  return {
    handoffActive,
    handoffReason: s(
      getStateField(state, "handoffReason", "handoff_reason") || ""
    ),
    handoffPriority:
      s(getStateField(state, "handoffPriority", "handoff_priority") || "normal") ||
      "normal",

    operatorRecentlyReplied: Boolean(
      getStateField(
        state,
        "operatorRecentlyReplied",
        "operator_recently_replied"
      )
    ),

    closedLike: Boolean(getStateField(state, "closedLike", "closed_like")),

    lastAiReplyText: s(
      getStateField(state, "last_ai_reply_text", "lastAiReplyText") || ""
    ),
    lastAiReplyHash: s(
      getStateField(state, "last_ai_reply_hash", "lastAiReplyHash") || ""
    ),

    lastCustomerIntent: s(
      getStateField(state, "last_customer_intent", "lastCustomerIntent") || ""
    ),

    repeatIntentCount: safeNumber(
      getStateField(state, "repeat_intent_count", "repeatIntentCount"),
      0
    ),

    awaitingCustomerAnswerTo: s(
      getStateField(
        state,
        "awaiting_customer_answer_to",
        "awaitingCustomerAnswerTo"
      ) || ""
    ),

    leadAlreadyCreated: Boolean(
      getStateField(state, "lead_created_at", "leadCreatedAt")
    ),

    contactRequestedAt:
      getStateField(state, "contact_requested_at", "contactRequestedAt") || null,

    pricingExplainedAt:
      getStateField(state, "pricing_explained_at", "pricingExplainedAt") || null,

    suppressedUntilOperatorReply: Boolean(
      getStateField(
        state,
        "suppressed_until_operator_reply",
        "suppressedUntilOperatorReply"
      )
    ),

    lastDecisionAt:
      getStateField(state, "last_decision_at", "lastDecisionAt") || null,
  };
}

export function getLatestKnownAiReplyText(recentMessages = [], threadState = null) {
  const lastAiOutbound = getLastAiOutbound(recentMessages);
  const fromMessages = s(lastAiOutbound?.text || "");
  if (fromMessages) return fromMessages;

  const signals = getThreadStateSignals(threadState);
  return s(signals.lastAiReplyText || "");
}

export function isDuplicateReplyCandidate(replyText, reliability = {}) {
  const nextText = normalizeTextForCompare(replyText);
  const lastText = normalizeTextForCompare(reliability?.lastKnownAiReplyText || "");
  return Boolean(nextText && lastText && nextText === lastText);
}

export function buildSuppressedReplyReason({
  quietHoursApplied,
  reliability = {},
  handoffActive = false,
  duplicateReply = false,
}) {
  if (quietHoursApplied) return "quiet_hours";
  if (duplicateReply) return "duplicate_ai_reply_guard";
  if (handoffActive && reliability?.operatorRecentlyReplied) {
    return "operator_recently_replied";
  }
  return "reply_suppressed";
}

export function getThreadHandoffState(thread, threadState = null) {
  const signals = getThreadStateSignals(threadState);
  const metaHandoff =
    thread?.meta && typeof thread.meta === "object" && thread.meta.handoff
      ? thread.meta.handoff
      : null;

  const active =
    Boolean(signals.handoffActive) ||
    Boolean(signals.suppressedUntilOperatorReply) ||
    Boolean(thread?.handoff_active) ||
    Boolean(metaHandoff?.active);

  return {
    active,
    reason:
      s(signals.handoffReason) ||
      s(thread?.handoff_reason || metaHandoff?.reason || ""),
    priority:
      s(signals.handoffPriority) ||
      s(thread?.handoff_priority || metaHandoff?.priority || "normal") ||
      "normal",
  };
}

function getLatestTimestamps(messages = []) {
  const latestOutbound = getLatestOutbound(messages);
  const latestOperatorOutbound = getLatestOperatorOutbound(messages);
  const lastAiOutbound = getLastAiOutbound(messages);

  return {
    latestOutbound,
    latestOperatorOutbound,
    lastAiOutbound,
    latestOutboundAt: toMs(latestOutbound?.sent_at || latestOutbound?.created_at),
    latestOperatorOutboundAt: toMs(
      latestOperatorOutbound?.sent_at || latestOperatorOutbound?.created_at
    ),
    lastAiOutboundAt: toMs(lastAiOutbound?.sent_at || lastAiOutbound?.created_at),
  };
}

function getOperatorCooldownMs() {
  return Math.max(
    0,
    Number(process.env.INBOX_OPERATOR_REPLY_SUPPRESS_MS || 300000)
  );
}

export function getReliabilityFlags({
  text,
  thread,
  recentMessages = [],
  quietHoursApplied,
  policy,
  threadState = null,
}) {
  const list = normalizeRecentMessages(recentMessages);
  const stateSignals = getThreadStateSignals(threadState);

  const now = nowMs();
  const operatorCooldownMs = getOperatorCooldownMs();

  const {
    latestOutbound,
    latestOperatorOutbound,
    lastAiOutbound,
    latestOutboundAt,
    latestOperatorOutboundAt,
    lastAiOutboundAt,
  } = getLatestTimestamps(list);

  const latestOutboundAgeMs =
    latestOutboundAt > 0 ? Math.max(0, now - latestOutboundAt) : null;

  const operatorOutboundAgeMs =
    latestOperatorOutboundAt > 0
      ? Math.max(0, now - latestOperatorOutboundAt)
      : null;

  const lastAiOutboundAgeMs =
    lastAiOutboundAt > 0 ? Math.max(0, now - lastAiOutboundAt) : null;

  const lastKnownAiReplyText = getLatestKnownAiReplyText(list, threadState);

  const duplicateOfLastAiReply =
    Boolean(lastKnownAiReplyText) &&
    normalizeTextForCompare(lastKnownAiReplyText) ===
      normalizeTextForCompare(text);

  const operatorRecentlyReplied =
    Boolean(stateSignals.operatorRecentlyReplied) ||
    (operatorOutboundAgeMs !== null &&
      Number.isFinite(operatorOutboundAgeMs) &&
      operatorOutboundAgeMs < operatorCooldownMs);

  const closedLike =
    Boolean(stateSignals.closedLike) ||
    thread?.status === "closed" ||
    thread?.status === "spam";

  return {
    latestOutboundAgeMs,
    operatorRecentlyReplied,
    operatorOutboundAgeMs,
    lastAiOutboundAgeMs,
    duplicateOfLastAiReply,
    quietHoursApplied: Boolean(quietHoursApplied),
    channelAllowed: Boolean(policy?.channelAllowed),
    closedLike,
    lastKnownAiReplyText,
    awaitingCustomerAnswerTo: stateSignals.awaitingCustomerAnswerTo,
    repeatIntentCount: stateSignals.repeatIntentCount,
    leadAlreadyCreated: stateSignals.leadAlreadyCreated,
    contactRequestedAt: stateSignals.contactRequestedAt,
    pricingExplainedAt: stateSignals.pricingExplainedAt,
    handoffActive: stateSignals.handoffActive,
    handoffReason: stateSignals.handoffReason,
    handoffPriority: stateSignals.handoffPriority,
    suppressedUntilOperatorReply: stateSignals.suppressedUntilOperatorReply,
    lastDecisionAt: stateSignals.lastDecisionAt,
    latestOutboundSenderType: s(latestOutbound?.sender_type || ""),
    latestOperatorOutboundId: s(latestOperatorOutbound?.id || ""),
    lastAiOutboundId: s(lastAiOutbound?.id || ""),
  };
}