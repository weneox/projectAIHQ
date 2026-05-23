import { s } from "../shared.js";

const obj = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

export const VOICE_OPERATOR_ACTIONS = Object.freeze([
  "mark_reviewed",
  "assign",
  "follow_up_needed",
  "resolve",
  "reopen",
]);

const VOICE_OPERATOR_ACTION_SET = new Set(VOICE_OPERATOR_ACTIONS);

function isoNow(now = new Date()) {
  try {
    return new Date(now).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function buildVoiceOperatorActionUpdate({
  call = {},
  input = {},
  actor = "unknown",
  now = new Date(),
} = {}) {
  const action = s(input.action).toLowerCase();
  if (!VOICE_OPERATOR_ACTION_SET.has(action)) {
    return {
      ok: false,
      statusCode: 400,
      reasonCode: "voice_operator_action_invalid",
      action,
      allowedActions: [...VOICE_OPERATOR_ACTIONS],
    };
  }

  const timestamp = isoNow(now);
  const normalizedActor = s(actor, "unknown");
  const note = s(input.note);
  const reasonCode = s(input.reasonCode || input.reason_code);
  const currentMeta = obj(call.meta);
  const currentOperatorState = obj(currentMeta.operator);
  let actionState = {};

  if (action === "mark_reviewed") {
    actionState = {
      reviewedAt: timestamp,
      reviewedBy: normalizedActor,
      operatorStatus: "reviewed",
    };
  } else if (action === "assign") {
    actionState = {
      assigneeId: s(input.assigneeId || input.assignee_id),
      assignedAt: timestamp,
      assignedBy: normalizedActor,
      operatorStatus: "assigned",
    };
  } else if (action === "follow_up_needed") {
    actionState = {
      followUpNeeded: true,
      operatorStatus: "follow_up_needed",
    };
  } else if (action === "resolve") {
    actionState = {
      operatorStatus: "resolved",
      resolvedAt: timestamp,
      resolvedBy: normalizedActor,
    };
  } else if (action === "reopen") {
    actionState = {
      operatorStatus: "open",
      reopenedAt: timestamp,
      reopenedBy: normalizedActor,
    };
  }

  const operatorState = {
    ...currentOperatorState,
    ...actionState,
  };

  return {
    ok: true,
    action,
    auditAction: `voice.operator.${action}`,
    operatorState,
    patch: {
      meta: {
        ...currentMeta,
        operator: operatorState,
      },
    },
    eventPayload: {
      action,
      actor: normalizedActor,
      note,
      reasonCode,
      operatorState,
    },
  };
}
