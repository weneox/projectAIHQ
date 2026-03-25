import {
  normalizeTextForCompare,
  nowMs,
  obj,
  s,
} from "./shared.js";
import {
  getLastAiOutbound,
  getLatestOperatorOutbound,
  getLatestOutbound,
  normalizeRecentMessages,
} from "./messages.js";

export function getStateField(state, ...keys) {
  const src = obj(state);
  const meta = obj(src.last_decision_meta || src.lastDecisionMeta);

  for (const key of keys) {
    const value = src?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  for (const key of keys) {
    const value = meta?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return null;
}

export function getThreadStateSignals(threadState = null) {
  const state = obj(threadState);

  return {
    handoffActive:
      Boolean(getStateField(state, "handoffActive", "handoff_active")) ||
      Boolean(
        getStateField(
          state,
          "suppressed_until_operator_reply",
          "suppressedUntilOperatorReply"
        )
      ),
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
    repeatIntentCount: Number(
      getStateField(state, "repeat_intent_count", "repeatIntentCount") || 0
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
  if (reliability?.operatorRecentlyReplied && handoffActive) {
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

export function getReliabilityFlags({
  text,
  thread,
  recentMessages = [],
  quietHoursApplied,
  policy,
  threadState = null,
}) {
  const list = normalizeRecentMessages(recentMessages);
  const latestOutbound = getLatestOutbound(list);
  const lastOperatorOutbound = getLatestOperatorOutbound(list);
  const stateSignals = getThreadStateSignals(threadState);

  const now = nowMs();
  const operatorCooldownMs = Math.max(
    0,
    Number(process.env.INBOX_OPERATOR_REPLY_SUPPRESS_MS || 300000)
  );

  const latestOutboundAgeMs = latestOutbound
    ? Math.max(0, now - Date.parse(String(latestOutbound.sent_at || latestOutbound.created_at || 0)))
    : null;

  const operatorOutboundAgeMs = lastOperatorOutbound
    ? Math.max(0, now - Date.parse(String(lastOperatorOutbound.sent_at || lastOperatorOutbound.created_at || 0)))
    : null;

  const lastKnownAiReplyText = getLatestKnownAiReplyText(list, threadState);

  const duplicateOfLastAiReply =
    Boolean(lastKnownAiReplyText) &&
    normalizeTextForCompare(lastKnownAiReplyText) === normalizeTextForCompare(text);

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
  };
}