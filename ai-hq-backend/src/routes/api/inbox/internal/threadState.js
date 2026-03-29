import { s } from "../shared.js";
import {
  findAction,
  getStateValue,
  hashText,
  lower,
  normalizeArr,
  normalizeObj,
  nowIso,
} from "./shared.js";
import { normalizeInboxMessageType } from "./execution.js";

export function buildThreadStateForDecision({
  thread,
  tenant,
  tenantKey,
  priorState,
  brain,
  actions,
  leadResults,
  handoffResults,
  executionResults,
}) {
  const prev = normalizeObj(priorState);
  const intent = s(brain?.intent || "");
  const previousIntent = s(
    getStateValue(prev, "last_customer_intent", "lastCustomerIntent") || ""
  );
  const previousRepeatIntent = Number(
    getStateValue(prev, "repeat_intent_count", "repeatIntentCount") || 0
  );

  const firstSendExecution =
    normalizeArr(executionResults).find((item) => item?.actionType === "send_message") || null;
  const sentMessage = firstSendExecution?.message || null;
  const handoffAction = findAction(actions, "handoff");
  const noReplyAction = findAction(actions, "no_reply");
  const repeatIntentCount = intent
    ? lower(intent) === lower(previousIntent)
      ? previousRepeatIntent + 1
      : 1
    : previousRepeatIntent;

  const currentSuppressed =
    Boolean(getStateValue(prev, "suppressed_until_operator_reply", "suppressedUntilOperatorReply"));
  const handoffActive = handoffResults.length
    ? true
    : Boolean(thread?.handoff_active) || currentSuppressed;
  const handoffReason =
    s(handoffAction?.reason || thread?.handoff_reason || prev?.handoffReason || "");
  const handoffPriority =
    s(handoffAction?.priority || thread?.handoff_priority || prev?.handoffPriority || "normal") ||
    "normal";
  const responseMode = sentMessage
    ? "auto_reply"
    : noReplyAction
      ? "no_reply"
      : s(getStateValue(prev, "last_response_mode", "lastResponseMode") || "");

  return {
    thread_id: s(thread?.id || ""),
    tenant_id: s(thread?.tenant_id || tenant?.id || getStateValue(prev, "tenant_id", "tenantId") || ""),
    tenant_key: s(thread?.tenant_key || tenantKey || getStateValue(prev, "tenant_key", "tenantKey") || ""),
    last_customer_intent: intent || previousIntent,
    last_customer_service_key: s(
      getStateValue(prev, "last_customer_service_key", "lastCustomerServiceKey") || ""
    ),
    last_ai_intent: sentMessage
      ? intent || s(getStateValue(prev, "last_ai_intent", "lastAiIntent") || "")
      : s(getStateValue(prev, "last_ai_intent", "lastAiIntent") || ""),
    last_ai_service_key: s(
      getStateValue(prev, "last_ai_service_key", "lastAiServiceKey") || ""
    ),
    last_ai_reply_hash: sentMessage?.text
      ? hashText(sentMessage.text)
      : s(getStateValue(prev, "last_ai_reply_hash", "lastAiReplyHash") || ""),
    last_ai_reply_text: sentMessage?.text
      ? s(sentMessage.text)
      : s(getStateValue(prev, "last_ai_reply_text", "lastAiReplyText") || ""),
    last_ai_cta_type: sentMessage
      ? "reply"
      : s(getStateValue(prev, "last_ai_cta_type", "lastAiCtaType") || ""),
    last_response_mode: responseMode,
    lead_created_at: leadResults.length
      ? nowIso()
      : getStateValue(prev, "lead_created_at", "leadCreatedAt") || null,
    handoff_announced_at: handoffResults.length
      ? nowIso()
      : getStateValue(prev, "handoff_announced_at", "handoffAnnouncedAt") || null,
    handoff_message_id: handoffResults.length
      ? s(sentMessage?.id || getStateValue(prev, "handoff_message_id", "handoffMessageId") || "")
      : s(getStateValue(prev, "handoff_message_id", "handoffMessageId") || ""),
    suppressed_until_operator_reply: handoffResults.length ? true : currentSuppressed,
    repeat_intent_count: repeatIntentCount,
    repeat_service_count: Number(
      getStateValue(prev, "repeat_service_count", "repeatServiceCount") || 0
    ),
    awaiting_customer_answer_to: sentMessage
      ? "reply"
      : s(getStateValue(prev, "awaiting_customer_answer_to", "awaitingCustomerAnswerTo") || ""),
    last_decision_meta: {
      handoffActive,
      handoffReason,
      handoffPriority,
      operatorRecentlyReplied: false,
      closedLike: ["closed", "spam"].includes(lower(thread?.status || "")),
      lastDecisionAt: nowIso(),
      lastDecisionIntent: intent || "",
      leadCreated: leadResults.length > 0,
      queuedExecutionActionTypes: normalizeArr(executionResults).map((item) => item.actionType),
      queuedExecutionMessageIds: normalizeArr(executionResults)
        .map((item) => s(item?.message?.id || ""))
        .filter(Boolean),
      queuedExecutionAttemptIds: normalizeArr(executionResults)
        .map((item) => s(item?.attempt?.id || ""))
        .filter(Boolean),
      noReplyReason: s(noReplyAction?.reason || ""),
      executionPolicyOutcome: s(
        brain?.executionPolicy?.strictestOutcome || ""
      ),
      executionPolicyReasonCodes: normalizeArr(
        brain?.executionPolicy?.reasonCodes
      ),
      replayTrace: normalizeObj(brain?.trace),
    },
  };
}

export function buildThreadStateForOutbound({
  thread,
  tenantKey,
  priorState,
  message,
  senderType,
  messageType,
  meta,
}) {
  const prev = normalizeObj(priorState);
  const sender = lower(senderType || message?.sender_type || "ai");
  const type = normalizeInboxMessageType(
    messageType || message?.message_type || meta?.storageMessageType || "text",
    "text"
  );
  const messageText = s(message?.text || "");
  const operatorReply = sender === "agent" || sender === "operator";
  const aiReply = (sender === "ai" || sender === "assistant") && type === "text";
  const handoffReset = operatorReply;

  return {
    thread_id: s(thread?.id || ""),
    tenant_key: s(thread?.tenant_key || tenantKey || getStateValue(prev, "tenant_key", "tenantKey") || ""),
    tenant_id: s(thread?.tenant_id || getStateValue(prev, "tenant_id", "tenantId") || ""),
    last_ai_intent: aiReply
      ? s(getStateValue(prev, "last_customer_intent", "lastCustomerIntent") || "")
      : s(getStateValue(prev, "last_ai_intent", "lastAiIntent") || ""),
    last_ai_service_key: s(
      getStateValue(prev, "last_ai_service_key", "lastAiServiceKey") || ""
    ),
    last_ai_reply_hash: aiReply
      ? hashText(messageText)
      : s(getStateValue(prev, "last_ai_reply_hash", "lastAiReplyHash") || ""),
    last_ai_reply_text: aiReply
      ? messageText
      : s(getStateValue(prev, "last_ai_reply_text", "lastAiReplyText") || ""),
    last_ai_cta_type: aiReply
      ? "reply"
      : s(getStateValue(prev, "last_ai_cta_type", "lastAiCtaType") || ""),
    last_response_mode: aiReply
      ? (meta?.internalExecution ? "auto_reply" : "manual_outbound")
      : s(getStateValue(prev, "last_response_mode", "lastResponseMode") || ""),
    suppressed_until_operator_reply: handoffReset
      ? false
      : Boolean(getStateValue(prev, "suppressed_until_operator_reply", "suppressedUntilOperatorReply")),
    handoff_message_id: handoffReset
      ? ""
      : s(getStateValue(prev, "handoff_message_id", "handoffMessageId") || ""),
    awaiting_customer_answer_to: type === "text"
      ? "reply"
      : s(getStateValue(prev, "awaiting_customer_answer_to", "awaitingCustomerAnswerTo") || ""),
    repeat_intent_count: Number(
      getStateValue(prev, "repeat_intent_count", "repeatIntentCount") || 0
    ),
    repeat_service_count: Number(
      getStateValue(prev, "repeat_service_count", "repeatServiceCount") || 0
    ),
    last_decision_meta: {
      handoffActive: handoffReset ? false : Boolean(thread?.handoff_active),
      handoffReason: handoffReset ? "" : s(thread?.handoff_reason || prev?.handoffReason || ""),
      handoffPriority: handoffReset
        ? "normal"
        : s(thread?.handoff_priority || prev?.handoffPriority || "normal") || "normal",
      operatorRecentlyReplied: operatorReply,
      closedLike: ["closed", "spam"].includes(lower(thread?.status || "")),
      lastManualOutboundAt: operatorReply ? nowIso() : undefined,
      lastManualMessageId: operatorReply ? s(message?.id || "") : undefined,
      lastAiOutboundAt: aiReply ? nowIso() : undefined,
      lastAiMessageId: aiReply ? s(message?.id || "") : undefined,
      lastOutboundMessageType: type,
    },
  };
}
