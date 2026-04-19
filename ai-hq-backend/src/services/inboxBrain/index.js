import { buildAgentReplayTrace } from "../agentReplayTrace.js";
import { isPolicyQuietHours } from "../inboxPolicy.js";
import { noReplyAction } from "./actions.js";
import { buildConversationControlDecision } from "./conversationControlEngine.js";
import { buildRealtimeReplyDecision } from "./realtimeReplyEngine.js";
import { arr, obj, s } from "./shared.js";

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

function resolveQualificationQuestionCount(decision = {}) {
  const reply = obj(decision?.reply);
  const diagnostics = obj(decision?.diagnostics);
  const text = s(reply?.text);

  if (!reply?.shouldReply) return 0;
  if (!text) return 0;
  if (!/[?？]/u.test(text)) return 0;
  if (reply?.mode === "recovered_need_aware") return 1;
  if (diagnostics?.genericClarifierDetected) return 1;
  return 1;
}

function buildConversationTrace(decision = {}, channel = "") {
  const runtime = obj(decision?.runtime);
  const policy = obj(decision?.policy);
  const reply = obj(decision?.reply);
  const control = obj(decision?.control);
  const diagnostics = obj(decision?.diagnostics);

  const qualificationQuestionCount = resolveQualificationQuestionCount(decision);

  const outcome = control?.shouldStartHandoff
    ? "handoff_recommended"
    : control?.shouldSendMessage
      ? "reply_recommended"
      : "no_reply_recommended";

  const decisionPathStatus = control?.shouldStartHandoff
    ? "escalated_to_operator"
    : control?.shouldSendMessage
      ? "answered"
      : "no_reply";

  const decisionPathReason = s(
    control?.shouldStartHandoff
      ? control?.handoffReason || "manual_review"
      : reply?.reasonCode || diagnostics?.noReplyReason || "approved_runtime_behavior"
  );

  return buildAgentReplayTrace({
    runtime,
    behavior: runtime?.behavior || runtime,
    policy,
    channel: s(channel || "inbox"),
    usecase: "inbox.reply",
    decisions: {
      cta: {
        selected: s(runtime?.primaryCta || ""),
        reason: s(runtime?.primaryCta ? "approved_runtime_behavior" : ""),
      },
      qualification: {
        mode: s(control?.askCategory || diagnostics?.inferredNeedCategory || "general"),
        questionCount: qualificationQuestionCount,
        reason: qualificationQuestionCount > 0 ? "realtime_reply_engine" : "",
      },
      handoff: {
        trigger: control?.explicitHumanRequest ? "human_keywords" : "",
        reason: s(control?.handoffReason || ""),
        priority: s(control?.handoffPriority || "normal"),
      },
      claimBlock: {
        blocked: false,
        claim: "",
        reason: "",
      },
    },
    evaluation: {
      outcome,
      ctaDirection: control?.shouldStartHandoff
        ? "handoff"
        : control?.shouldSendMessage
          ? "reply_with_cta"
          : "none",
      qualification: {
        status: qualificationQuestionCount > 0 ? "questioned" : "none",
        questionCount: qualificationQuestionCount,
      },
      handoff: {
        status: control?.shouldStartHandoff ? "recommended" : "clear",
        trigger: control?.explicitHumanRequest ? "human_keywords" : "",
        reason: s(control?.handoffReason || ""),
        priority: s(control?.handoffPriority || "normal"),
      },
      claimBlock: {
        status: "clear",
        blocked: false,
        claim: "",
        reason: "",
      },
    },
    decisionPath: {
      status: decisionPathStatus,
      reasonCode: decisionPathReason,
      detail: s(reply?.mode || ""),
    },
  });
}

function applyQuietHoursGuard(decision = {}) {
  const safeDecision = obj(decision);
  const policy = obj(safeDecision?.policy);
  const quietHoursApplied = isPolicyQuietHours(policy);

  if (!quietHoursApplied) {
    return {
      ...safeDecision,
      diagnostics: {
        ...obj(safeDecision?.diagnostics),
        quietHoursApplied: false,
      },
    };
  }

  const existingActions = arr(safeDecision?.actions);
  const survivingActions = existingActions.filter((action) => {
    const type = s(action?.type).toLowerCase();
    return type !== "send_message" && type !== "typing_on" && type !== "typing_off";
  });

  const firstMeta =
    obj(existingActions.find((action) => obj(action?.meta) && Object.keys(obj(action.meta)).length)?.meta);

  const hasNoReply = survivingActions.some(
    (action) => s(action?.type).toLowerCase() === "no_reply"
  );

  if (!hasNoReply) {
    survivingActions.push(
      noReplyAction({
        reason: "quiet_hours",
        meta: firstMeta,
      })
    );
  }

  return {
    ...safeDecision,
    reply: {
      ...obj(safeDecision?.reply),
      shouldReply: false,
      text: "",
      mode: "suppressed",
      reasonCode: "quiet_hours",
    },
    control: {
      ...obj(safeDecision?.control),
      shouldTyping: false,
      shouldSendMessage: false,
      shouldNoReply: true,
    },
    diagnostics: {
      ...obj(safeDecision?.diagnostics),
      quietHoursApplied: true,
      noReplyReason: "quiet_hours",
    },
    actions: survivingActions,
  };
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
  services = [],
  knowledgeEntries = [],
  responsePlaybooks = [],
  threadState = null,
  runtime = null,
}) {
  const realtimeDecision = await buildRealtimeReplyDecision({
    text,
    channel,
    externalUserId,
    tenantKey,
    thread,
    message,
    tenant,
    recentMessages,
    customerContext,
    formData,
    leadContext,
    conversationContext,
    services,
    knowledgeEntries,
    responsePlaybooks,
    threadState,
    runtime,
  });

  const controlDecision = buildConversationControlDecision({
    realtimeDecision,
    text,
    channel,
    externalUserId,
    tenantKey,
    thread,
    message,
    recentMessages,
    threadState: realtimeDecision?.runtime?.threadState || threadState,
  });

  const guardedDecision = applyQuietHoursGuard(controlDecision);
  const trace = buildConversationTrace(guardedDecision, channel);

  return finalizeInboxDecisionResult({
    intent: s(guardedDecision?.control?.intent || "general"),
    leadScore: Number(guardedDecision?.control?.leadScore || 0),
    policy: guardedDecision?.policy || {},
    runtime: guardedDecision?.runtime || {},
    reply: guardedDecision?.reply || {},
    control: guardedDecision?.control || {},
    diagnostics: guardedDecision?.diagnostics || {},
    actions: guardedDecision?.actions || [],
    trace,
  });
}

export const __test__ = {
  attachReplayTraceToActions,
  buildConversationTrace,
  applyQuietHoursGuard,
};