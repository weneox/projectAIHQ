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

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const x = lower(value);
    if (["true", "1", "yes", "on"].includes(x)) return true;
    if (["false", "0", "no", "off"].includes(x)) return false;
  }
  return fallback;
}

function pickFirstString(...values) {
  for (const value of values) {
    const text = s(value || "");
    if (text) return text;
  }
  return "";
}

function pickFirstBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return false;
}

function normalizeReplyMode(value = "") {
  const x = lower(value);
  if (!x) return "";
  return x;
}

function normalizePriority(value = "") {
  const x = lower(value);
  if (["low", "normal", "high", "urgent"].includes(x)) return x;
  return "normal";
}

function normalizeReasonCode(value = "") {
  return lower(value || "");
}

function normalizePreview(value = "", max = 240) {
  const text = s(value || "");
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function hasQuestionLikeText(value = "") {
  return /[?？]/u.test(s(value || ""));
}

function summarizeExecutionResults(executionResults = []) {
  const list = normalizeArr(executionResults);

  return {
    actionTypes: list.map((item) => s(item?.actionType || "")).filter(Boolean),
    messageIds: list
      .map((item) => s(item?.message?.id || ""))
      .filter(Boolean),
    attemptIds: list
      .map((item) => s(item?.attempt?.id || ""))
      .filter(Boolean),
  };
}

function extractBrainReply(brain = {}) {
  return normalizeObj(brain?.reply);
}

function extractBrainControl(brain = {}) {
  return normalizeObj(brain?.control);
}

function extractBrainDiagnostics(brain = {}) {
  return normalizeObj(brain?.diagnostics);
}

function deriveAwaitingCustomerAnswerTo({
  sentMessage = null,
  reply = {},
  control = {},
  diagnostics = {},
  previousValue = "",
}) {
  if (!sentMessage?.text) {
    return s(previousValue || "");
  }

  if (control?.shouldStartHandoff) {
    return "operator_handoff";
  }

  if (reply?.mode === "recovered_need_aware") {
    return pickFirstString(
      diagnostics?.inferredNeedCategory,
      control?.askCategory,
      "clarification"
    );
  }

  if (hasQuestionLikeText(sentMessage?.text)) {
    return pickFirstString(
      control?.askCategory,
      diagnostics?.inferredNeedCategory,
      "reply"
    );
  }

  return "reply";
}

function deriveResponseMode({
  sentMessage = null,
  noReplyAction = null,
  reply = {},
  diagnostics = {},
  previousValue = "",
}) {
  if (sentMessage?.text) {
    return normalizeReplyMode(reply?.mode || "auto_reply");
  }

  if (noReplyAction) {
    const noReplyReason = normalizeReasonCode(
      noReplyAction?.reason || diagnostics?.noReplyReason || reply?.reasonCode
    );

    if (noReplyReason === "quiet_hours") return "quiet_hours";
    if (noReplyReason) return "no_reply";
    return "no_reply";
  }

  return s(previousValue || "");
}

function deriveLastAiCtaType({
  sentMessage = null,
  control = {},
  previousValue = "",
}) {
  if (!sentMessage?.text) {
    return s(previousValue || "");
  }

  if (control?.shouldStartHandoff) return "handoff";
  if (control?.shouldCreateLead) return "lead_capture";
  return "reply";
}

function deriveContactRequestedAt({
  sentMessage = null,
  control = {},
  diagnostics = {},
  previousValue = null,
}) {
  if (!sentMessage?.text) {
    return previousValue || null;
  }

  const askCategory = lower(
    control?.askCategory || diagnostics?.inferredNeedCategory || ""
  );

  if (["booking", "service_interest", "quote", "pricing"].includes(askCategory)) {
    return nowIso();
  }

  return previousValue || null;
}

function derivePricingExplainedAt({
  sentMessage = null,
  control = {},
  diagnostics = {},
  previousValue = null,
}) {
  if (!sentMessage?.text) {
    return previousValue || null;
  }

  const askCategory = lower(
    control?.askCategory || diagnostics?.inferredNeedCategory || ""
  );

  if (askCategory === "pricing") {
    return nowIso();
  }

  return previousValue || null;
}

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
  const reply = extractBrainReply(brain);
  const control = extractBrainControl(brain);
  const diagnostics = extractBrainDiagnostics(brain);

  const intent = s(brain?.intent || control?.intent || "");
  const previousIntent = s(
    getStateValue(prev, "last_customer_intent", "lastCustomerIntent") || ""
  );
  const previousRepeatIntent = Number(
    getStateValue(prev, "repeat_intent_count", "repeatIntentCount") || 0
  );

  const firstSendExecution =
    normalizeArr(executionResults).find(
      (item) => item?.actionType === "send_message"
    ) || null;
  const sentMessage = firstSendExecution?.message || null;

  const handoffAction = findAction(actions, "handoff");
  const noReplyAction = findAction(actions, "no_reply");

  const repeatIntentCount = intent
    ? lower(intent) === lower(previousIntent)
      ? previousRepeatIntent + 1
      : 1
    : previousRepeatIntent;

  const currentSuppressed = Boolean(
    getStateValue(
      prev,
      "suppressed_until_operator_reply",
      "suppressedUntilOperatorReply"
    )
  );

  const handoffActive = handoffResults.length
    ? true
    : Boolean(thread?.handoff_active) || currentSuppressed;

  const handoffReason = pickFirstString(
    handoffAction?.reason,
    control?.handoffReason,
    thread?.handoff_reason,
    prev?.handoffReason
  );

  const handoffPriority = normalizePriority(
    pickFirstString(
      handoffAction?.priority,
      control?.handoffPriority,
      thread?.handoff_priority,
      prev?.handoffPriority,
      "normal"
    )
  );

  const responseMode = deriveResponseMode({
    sentMessage,
    noReplyAction,
    reply,
    diagnostics,
    previousValue: getStateValue(prev, "last_response_mode", "lastResponseMode"),
  });

  const executionSummary = summarizeExecutionResults(executionResults);

  return {
    thread_id: s(thread?.id || ""),
    tenant_id: s(
      thread?.tenant_id ||
        tenant?.id ||
        getStateValue(prev, "tenant_id", "tenantId") ||
        ""
    ),
    tenant_key: s(
      thread?.tenant_key ||
        tenantKey ||
        getStateValue(prev, "tenant_key", "tenantKey") ||
        ""
    ),
    last_customer_intent: intent || previousIntent,
    last_customer_service_key: s(
      getStateValue(
        prev,
        "last_customer_service_key",
        "lastCustomerServiceKey"
      ) || ""
    ),
    last_ai_intent: sentMessage
      ? intent ||
        s(getStateValue(prev, "last_ai_intent", "lastAiIntent") || "")
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
    last_ai_cta_type: deriveLastAiCtaType({
      sentMessage,
      control,
      previousValue: getStateValue(prev, "last_ai_cta_type", "lastAiCtaType"),
    }),
    last_response_mode: responseMode,
    lead_created_at: leadResults.length
      ? nowIso()
      : getStateValue(prev, "lead_created_at", "leadCreatedAt") || null,
    handoff_announced_at: handoffResults.length
      ? nowIso()
      : getStateValue(prev, "handoff_announced_at", "handoffAnnouncedAt") ||
        null,
    handoff_message_id: handoffResults.length
      ? s(
          sentMessage?.id ||
            getStateValue(prev, "handoff_message_id", "handoffMessageId") ||
            ""
        )
      : s(getStateValue(prev, "handoff_message_id", "handoffMessageId") || ""),
    suppressed_until_operator_reply: handoffResults.length
      ? true
      : currentSuppressed,
    repeat_intent_count: repeatIntentCount,
    repeat_service_count: Number(
      getStateValue(prev, "repeat_service_count", "repeatServiceCount") || 0
    ),
    awaiting_customer_answer_to: deriveAwaitingCustomerAnswerTo({
      sentMessage,
      reply,
      control,
      diagnostics,
      previousValue: getStateValue(
        prev,
        "awaiting_customer_answer_to",
        "awaitingCustomerAnswerTo"
      ),
    }),
    contact_requested_at: deriveContactRequestedAt({
      sentMessage,
      control,
      diagnostics,
      previousValue:
        getStateValue(prev, "contact_requested_at", "contactRequestedAt") ||
        null,
    }),
    pricing_explained_at: derivePricingExplainedAt({
      sentMessage,
      control,
      diagnostics,
      previousValue:
        getStateValue(prev, "pricing_explained_at", "pricingExplainedAt") ||
        null,
    }),
    last_decision_meta: {
      handoffActive,
      handoffReason,
      handoffPriority,
      operatorRecentlyReplied: false,
      closedLike: ["closed", "spam"].includes(lower(thread?.status || "")),
      lastDecisionAt: nowIso(),
      lastDecisionIntent: intent || "",
      leadCreated: leadResults.length > 0,
      queuedExecutionActionTypes: executionSummary.actionTypes,
      queuedExecutionMessageIds: executionSummary.messageIds,
      queuedExecutionAttemptIds: executionSummary.attemptIds,
      noReplyReason: normalizeReasonCode(
        noReplyAction?.reason || diagnostics?.noReplyReason || reply?.reasonCode
      ),
      realtimeReplyShouldReply: Boolean(reply?.shouldReply),
      realtimeReplyMode: normalizeReplyMode(reply?.mode),
      realtimeReplyReasonCode: normalizeReasonCode(reply?.reasonCode),
      realtimeReplyLanguage: s(reply?.language || ""),
      realtimeReplyConfidence:
        typeof reply?.confidence === "number" ? reply.confidence : null,
      realtimeReplyUsedRecovery: Boolean(reply?.usedRecovery),
      explicitHumanRequest: Boolean(control?.explicitHumanRequest),
      inferredNeedCategory: s(
        diagnostics?.inferredNeedCategory || control?.askCategory || ""
      ),
      askCategory: s(control?.askCategory || ""),
      stage: s(control?.stage || ""),
      shouldCreateLead: Boolean(control?.shouldCreateLead),
      shouldStartHandoff: Boolean(control?.shouldStartHandoff),
      shouldMarkSeen: Boolean(control?.shouldMarkSeen),
      shouldTyping: Boolean(control?.shouldTyping),
      shouldSendMessage: Boolean(control?.shouldSendMessage),
      shouldNoReply: Boolean(control?.shouldNoReply),
      quietHoursApplied: Boolean(diagnostics?.quietHoursApplied),
      genericClarifierDetected: Boolean(diagnostics?.genericClarifierDetected),
      explicitNeed: Boolean(diagnostics?.explicitNeed),
      leadScore: Number(brain?.leadScore || control?.leadScore || 0),
      replayTrace: normalizeObj(brain?.trace),
      finalReplyPreview: normalizePreview(
        sentMessage?.text || reply?.text || ""
      ),
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
  const explicitResumeAutomation = Boolean(
    meta?.releaseHandoff === true ||
      meta?.release_handoff === true ||
      meta?.resumeAutomation === true ||
      meta?.resume_automation === true
  );
  const handoffReset = operatorReply && explicitResumeAutomation;

  return {
    thread_id: s(thread?.id || ""),
    tenant_key: s(
      thread?.tenant_key ||
        tenantKey ||
        getStateValue(prev, "tenant_key", "tenantKey") ||
        ""
    ),
    tenant_id: s(
      thread?.tenant_id || getStateValue(prev, "tenant_id", "tenantId") || ""
    ),
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
      ? s(meta?.replayTrace?.decisionPath?.status === "escalated_to_operator"
          ? "handoff"
          : "reply")
      : s(getStateValue(prev, "last_ai_cta_type", "lastAiCtaType") || ""),
    last_response_mode: aiReply
      ? s(
          meta?.replyMode ||
            meta?.realtimeReplyMode ||
            (meta?.internalExecution ? "auto_reply" : "manual_outbound")
        )
      : s(getStateValue(prev, "last_response_mode", "lastResponseMode") || ""),
    suppressed_until_operator_reply: handoffReset
      ? false
      : Boolean(
          getStateValue(
            prev,
            "suppressed_until_operator_reply",
            "suppressedUntilOperatorReply"
          )
        ),
    handoff_message_id: handoffReset
      ? ""
      : s(getStateValue(prev, "handoff_message_id", "handoffMessageId") || ""),
    awaiting_customer_answer_to:
      type === "text"
        ? s(meta?.askCategory || "reply")
        : s(
            getStateValue(
              prev,
              "awaiting_customer_answer_to",
              "awaitingCustomerAnswerTo"
            ) || ""
          ),
    repeat_intent_count: Number(
      getStateValue(prev, "repeat_intent_count", "repeatIntentCount") || 0
    ),
    repeat_service_count: Number(
      getStateValue(prev, "repeat_service_count", "repeatServiceCount") || 0
    ),
    contact_requested_at:
      type === "text" &&
      ["pricing", "quote", "booking", "service_interest"].includes(
        lower(meta?.askCategory || "")
      )
        ? nowIso()
        : getStateValue(prev, "contact_requested_at", "contactRequestedAt") ||
          null,
    pricing_explained_at:
      type === "text" && lower(meta?.askCategory || "") === "pricing"
        ? nowIso()
        : getStateValue(prev, "pricing_explained_at", "pricingExplainedAt") ||
          null,
    last_decision_meta: {
      handoffActive: handoffReset ? false : Boolean(thread?.handoff_active),
      handoffReason: handoffReset
        ? ""
        : s(thread?.handoff_reason || prev?.handoffReason || ""),
      handoffPriority: handoffReset
        ? "normal"
        : normalizePriority(
            s(thread?.handoff_priority || prev?.handoffPriority || "normal")
          ),
      operatorRecentlyReplied: operatorReply,
      closedLike: ["closed", "spam"].includes(lower(thread?.status || "")),
      lastManualOutboundAt: operatorReply ? nowIso() : undefined,
      lastManualMessageId: operatorReply ? s(message?.id || "") : undefined,
      lastAiOutboundAt: aiReply ? nowIso() : undefined,
      lastAiMessageId: aiReply ? s(message?.id || "") : undefined,
      lastOutboundMessageType: type,
      lastOutboundReplyMode: aiReply
        ? s(meta?.replyMode || meta?.realtimeReplyMode || "")
        : undefined,
      lastOutboundAskCategory: aiReply ? s(meta?.askCategory || "") : undefined,
      lastOutboundStage: aiReply ? s(meta?.stage || "") : undefined,
      lastOutboundUsedRecovery: aiReply
        ? bool(meta?.replyUsedRecovery, false)
        : undefined,
      replayTrace: normalizeObj(meta?.replayTrace),
    },
  };
}