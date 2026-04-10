import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOperatorInspectFromReplayTrace,
  buildVoiceEventInspect,
} from "../src/services/operatorReplayInspect.js";

function buildReplayTrace({
  channel = "",
  usecase = "",
  status = "",
  reasonCode = "",
} = {}) {
  return {
    schema: "agent_replay_trace.v1",
    channel,
    usecase,
    runtimeVersion: "projection-1:hash-1",
    runtimeRef: {
      source: "approved_runtime_projection",
      approvedRuntime: true,
      runtimeProjectionId: "projection-1",
      projectionHash: "hash-1",
      truthVersionId: "truth-v1",
      tenantKey: "acme",
    },
    behavior: {
      conversionGoal: "answer_and_route",
      primaryCta: "book_consult",
      toneProfile: "warm_confident",
      qualificationQuestionCount: 2,
      channelBehavior: {
        handoffBias: "conditional",
        qualificationDepth: "guided",
      },
    },
    policy: {
      language: "en",
      autoReplyEnabled: true,
      createLeadEnabled: true,
      handoffEnabled: true,
      qualificationMode: "guided",
      handoffBias: "conditional",
      tonePolicyPresent: true,
    },
    decisionPath: {
      status,
      reasonCode,
    },
  };
}

test("operator inspect read model normalizes inbox, comments, and voice actions to one contract", () => {
  const inboxInspect = buildOperatorInspectFromReplayTrace({
    channel: "inbox",
    surface: "inbox",
    sourceType: "inbox_action",
    sourceId: "msg-1",
    actionType: "inbox.reply",
    actor: "assistant",
    timestamp: "2026-04-10T08:00:00.000Z",
    replayTrace: buildReplayTrace({
      channel: "inbox",
      usecase: "inbox.reply",
      status: "answered",
      reasonCode: "reply_generated",
    }),
    summary: {
      messageId: "msg-1",
    },
  });

  const commentInspect = buildOperatorInspectFromReplayTrace({
    channel: "comments",
    surface: "comments",
    sourceType: "comment_classification",
    sourceId: "comment-1",
    actionType: "meta.comment_reply",
    actor: "assistant",
    timestamp: "2026-04-10T08:01:00.000Z",
    replayTrace: buildReplayTrace({
      channel: "comments",
      usecase: "meta.comment_reply",
      status: "escalated_to_operator",
      reasonCode: "behavior_handoff_trigger",
    }),
    summary: {
      commentId: "comment-1",
    },
  });

  const voiceInspect = buildVoiceEventInspect({
    id: "voice-event-1",
    eventType: "operator_joined",
    actor: "operator",
    createdAt: "2026-04-10T08:02:00.000Z",
    payload: {
      mutationOutcome: "applied",
      callStatus: "in_progress",
      sessionStatus: "agent_live",
      operatorJoinMode: "live",
      replayTrace: buildReplayTrace({
        channel: "voice",
        usecase: "voice.operator_control",
        status: "escalated_to_operator",
        reasonCode: "operator_joined",
      }),
    },
  });

  for (const item of [inboxInspect, commentInspect, voiceInspect]) {
    assert.equal(item.schema, "operator_replay_inspect.v1");
    assert.equal(item.authority?.approvedRuntime, true);
    assert.equal(item.authority?.runtimeProjectionId, "projection-1");
    assert.equal(item.authority?.truthVersionId, "truth-v1");
    assert.equal(item.policy?.language, "en");
    assert.equal(item.behavior?.conversionGoal, "answer_and_route");
    assert.equal(item.flags?.approvedRuntime, true);
    assert.equal(
      Object.prototype.hasOwnProperty.call(item.authority || {}, "reviewSessionId"),
      false
    );
  }

  assert.equal(inboxInspect.channel, "inbox");
  assert.equal(inboxInspect.decision?.status, "answered");
  assert.equal(commentInspect.channel, "comments");
  assert.equal(commentInspect.decision?.status, "escalated_to_operator");
  assert.equal(voiceInspect.channel, "voice");
  assert.equal(voiceInspect.sourceType, "voice_call_event");
  assert.equal(voiceInspect.decision?.status, "escalated_to_operator");
  assert.equal(voiceInspect.summary?.operatorJoinMode, "live");
  assert.equal(voiceInspect.flags?.operatorHandoff, true);
});

test("voice inspect fallback stays explicit about live authority and does not imply setup draft authority", () => {
  const inspect = buildVoiceEventInspect({
    id: "voice-event-2",
    eventType: "session_state_rejected",
    actor: "voice_backend",
    createdAt: "2026-04-10T08:03:00.000Z",
    payload: {
      mutationOutcome: "rejected",
      reasonCode: "terminal_state_regression",
      currentStatus: "completed",
      requestedStatus: "bot_active",
      replayTrace: {
        schema: "agent_replay_trace.v1",
        channel: "voice",
        usecase: "voice.session.control",
        runtimeRef: {
          source: "approved_runtime_projection",
          approvedRuntime: false,
          reasonCode: "runtime_authority_unavailable",
        },
        decisionPath: {
          status: "refused",
          reasonCode: "terminal_state_regression",
        },
      },
    },
  });

  assert.equal(inspect.authority?.approvedRuntime, false);
  assert.equal(inspect.decision?.status, "refused");
  assert.equal(inspect.decision?.reasonCode, "terminal_state_regression");
  assert.equal(inspect.flags?.runtimeUnavailable, true);
  assert.equal(
    JSON.stringify(inspect).toLowerCase().includes("setup_review"),
    false
  );
  assert.equal(JSON.stringify(inspect).toLowerCase().includes("draft"), false);
});
