import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceOperatorQueueReadModel,
  buildVoiceOperatorQueueRow,
  VOICE_OPERATOR_QUEUE_READ_MODEL_VERSION,
} from "../src/modules/voice/qa/voiceOperatorQueueReadModel.js";

test("voice operator queue row builds score from call meta", () => {
  const row = buildVoiceOperatorQueueRow({
    id: "call-1",
    tenantId: "tenant-1",
    tenantKey: "acme",
    status: "completed",
    outcome: "unknown",
    startedAt: "2026-05-23T00:00:00.000Z",
    fromNumber: "+994501112233",
    callerName: "Emil",
    summary: "Caller wants appointment follow-up.",
    meta: {
      qa: {
        latestVerdict: "needs_fix",
        latestSeverity: "medium",
        latestNaturalnessLabels: ["recording_like"],
        latestNaturalnessScore: 2,
        needsFix: true,
      },
    },
  });

  assert.equal(row.version, VOICE_OPERATOR_QUEUE_READ_MODEL_VERSION);
  assert.equal(row.callId, "call-1");
  assert.equal(row.scoreStatus, "naturalness_issue");
  assert.equal(row.operatorAction, "apply_qa_correction");
  assert.equal(row.needsHumanReview, true);
  assert.equal(row.phone, "+994501112233");
});

test("voice operator queue row exposes operator state from call meta", () => {
  const row = buildVoiceOperatorQueueRow({
    id: "call-operator",
    tenantId: "tenant-1",
    tenantKey: "acme",
    startedAt: "2026-05-23T00:00:00.000Z",
    meta: {
      operator: {
        operatorStatus: "assigned",
        assigneeId: "operator-2",
        reviewedAt: "2026-05-23T00:01:00.000Z",
        reviewedBy: "admin@acme.test",
        assignedAt: "2026-05-23T00:02:00.000Z",
        assignedBy: "operator@acme.test",
        followUpNeeded: true,
        resolvedAt: "2026-05-23T00:03:00.000Z",
        resolvedBy: "admin@acme.test",
        reopenedAt: "2026-05-23T00:04:00.000Z",
        reopenedBy: "operator@acme.test",
        lastAction: "assign",
        note: "Route to specialist",
        reasonCode: "billing_question",
      },
    },
  });

  assert.equal(row.operatorStatus, "assigned");
  assert.equal(row.assigneeId, "operator-2");
  assert.equal(row.reviewedAt, "2026-05-23T00:01:00.000Z");
  assert.equal(row.reviewedBy, "admin@acme.test");
  assert.equal(row.assignedAt, "2026-05-23T00:02:00.000Z");
  assert.equal(row.assignedBy, "operator@acme.test");
  assert.equal(row.followUpNeeded, true);
  assert.equal(row.resolvedAt, "2026-05-23T00:03:00.000Z");
  assert.equal(row.resolvedBy, "admin@acme.test");
  assert.equal(row.reopenedAt, "2026-05-23T00:04:00.000Z");
  assert.equal(row.reopenedBy, "operator@acme.test");
  assert.equal(row.lastOperatorAction, "assign");
  assert.equal(row.operatorNote, "Route to specialist");
  assert.equal(row.operatorReasonCode, "billing_question");
});

test("voice operator queue prioritizes human-review calls", () => {
  const queue = buildVoiceOperatorQueueReadModel({
    calls: [
      {
        id: "call-ok",
        startedAt: "2026-05-23T00:00:03.000Z",
        meta: {
          qa: {
            latestVerdict: "pass",
          },
        },
      },
      {
        id: "call-runtime",
        startedAt: "2026-05-23T00:00:01.000Z",
        meta: {
          runtimeEvidence: {
            blocked: true,
            reasonCode: "unsupported_realtime_provider",
          },
        },
      },
      {
        id: "call-request",
        startedAt: "2026-05-23T00:00:02.000Z",
        extraction: {
          operationRequestId: "request-1",
          voiceOutcome: {
            status: "request_recorded",
          },
        },
      },
    ],
    sort: "priority",
    limit: 10,
  });

  assert.equal(queue.version, VOICE_OPERATOR_QUEUE_READ_MODEL_VERSION);
  assert.equal(queue.total, 3);
  assert.equal(queue.rows[0].callId, "call-runtime");
  assert.equal(queue.rows[0].scoreStatus, "runtime_issue");
  assert.equal(queue.rows[1].callId, "call-request");
  assert.equal(queue.rows[1].scoreStatus, "needs_human");
  assert.equal(queue.summary.needsHumanReview, 2);
});

test("voice operator queue filters by operator state", () => {
  const calls = [
    {
      id: "call-assigned",
      meta: {
        operator: {
          operatorStatus: "assigned",
          assigneeId: "operator-2",
          followUpNeeded: false,
        },
      },
    },
    {
      id: "call-follow-up",
      meta: {
        operator: {
          operatorStatus: "follow_up_needed",
          assigneeId: "operator-3",
          followUpNeeded: true,
        },
      },
    },
    {
      id: "call-resolved",
      meta: {
        operator: {
          operatorStatus: "resolved",
          assigneeId: "operator-2",
          followUpNeeded: false,
        },
      },
    },
  ];

  const byStatus = buildVoiceOperatorQueueReadModel({
    calls,
    filters: {
      operatorStatus: "follow_up_needed",
    },
  });
  assert.equal(byStatus.filteredTotal, 1);
  assert.equal(byStatus.rows[0].callId, "call-follow-up");

  const byAssignee = buildVoiceOperatorQueueReadModel({
    calls,
    filters: {
      assigneeId: "operator-2",
    },
  });
  assert.equal(byAssignee.filteredTotal, 2);
  assert.deepEqual(
    byAssignee.rows.map((row) => row.callId).sort(),
    ["call-assigned", "call-resolved"]
  );

  const byFollowUp = buildVoiceOperatorQueueReadModel({
    calls,
    filters: {
      followUpNeeded: "true",
    },
  });
  assert.equal(byFollowUp.filteredTotal, 1);
  assert.equal(byFollowUp.rows[0].callId, "call-follow-up");
});

test("voice operator queue priority prefers follow-up and open items before resolved", () => {
  const queue = buildVoiceOperatorQueueReadModel({
    calls: [
      {
        id: "call-resolved-critical",
        startedAt: "2026-05-23T00:00:03.000Z",
        meta: {
          operator: {
            operatorStatus: "resolved",
          },
          qa: {
            outcomeScore: {
              status: "bad_call",
              outcome: "bad_call",
              score: 1,
              severity: "critical",
              needsHumanReview: true,
              operatorAction: "review_bad_call",
            },
          },
        },
      },
      {
        id: "call-open",
        startedAt: "2026-05-23T00:00:02.000Z",
        meta: {
          operator: {
            operatorStatus: "open",
          },
          qa: {
            outcomeScore: {
              status: "review_optional",
              outcome: "review_optional",
              score: 99,
              severity: "none",
              needsHumanReview: false,
              operatorAction: "review_optional",
            },
          },
        },
      },
      {
        id: "call-follow-up",
        startedAt: "2026-05-23T00:00:01.000Z",
        meta: {
          operator: {
            operatorStatus: "resolved",
            followUpNeeded: true,
          },
          qa: {
            outcomeScore: {
              status: "review_optional",
              outcome: "review_optional",
              score: 100,
              severity: "none",
              needsHumanReview: false,
              operatorAction: "review_optional",
            },
          },
        },
      },
    ],
    sort: "priority",
  });

  assert.deepEqual(
    queue.rows.map((row) => row.callId),
    ["call-follow-up", "call-open", "call-resolved-critical"]
  );
});

test("voice operator queue summary counts operator state", () => {
  const queue = buildVoiceOperatorQueueReadModel({
    calls: [
      {
        id: "call-assigned",
        meta: {
          operator: {
            operatorStatus: "assigned",
            assigneeId: "operator-1",
          },
        },
      },
      {
        id: "call-reviewed",
        meta: {
          operator: {
            operatorStatus: "reviewed",
          },
        },
      },
      {
        id: "call-resolved",
        meta: {
          operator: {
            operatorStatus: "resolved",
          },
        },
      },
      {
        id: "call-follow-up",
        meta: {
          operator: {
            operatorStatus: "follow_up_needed",
            followUpNeeded: true,
          },
        },
      },
    ],
  });

  assert.equal(queue.summary.byOperatorStatus.assigned, 1);
  assert.equal(queue.summary.byOperatorStatus.reviewed, 1);
  assert.equal(queue.summary.byOperatorStatus.resolved, 1);
  assert.equal(queue.summary.byOperatorStatus.follow_up_needed, 1);
  assert.equal(queue.summary.followUpNeeded, 1);
  assert.equal(queue.summary.assigned, 1);
  assert.equal(queue.summary.reviewed, 1);
  assert.equal(queue.summary.resolved, 1);
});

test("voice operator queue filters by score status and operator action", () => {
  const queue = buildVoiceOperatorQueueReadModel({
    calls: [
      {
        id: "call-natural",
        meta: {
          qa: {
            latestVerdict: "needs_fix",
            latestNaturalnessLabels: ["too_formal"],
            latestNaturalnessScore: 2,
            needsFix: true,
          },
        },
      },
      {
        id: "call-request",
        extraction: {
          operationRequestId: "request-1",
          voiceOutcome: {
            status: "request_recorded",
          },
        },
      },
    ],
    filters: {
      scoreStatus: "naturalness_issue",
      operatorAction: "apply_qa_correction",
      needsHumanReview: "true",
    },
  });

  assert.equal(queue.filteredTotal, 1);
  assert.equal(queue.rows.length, 1);
  assert.equal(queue.rows[0].callId, "call-natural");
  assert.equal(queue.summary.byScoreStatus.naturalness_issue, 1);
  assert.equal(queue.summary.byScoreStatus.needs_human, 1);
});

test("voice operator queue respects existing score and date sorting", () => {
  const calls = [
    {
      id: "call-high",
      startedAt: "2026-05-23T00:00:02.000Z",
      meta: {
        qa: {
          outcomeScore: {
            status: "review_optional",
            outcome: "review_optional",
            score: 91,
            severity: "none",
            needsHumanReview: false,
            operatorAction: "review_optional",
          },
        },
      },
    },
    {
      id: "call-low",
      startedAt: "2026-05-23T00:00:01.000Z",
      meta: {
        qa: {
          outcomeScore: {
            status: "bad_call",
            outcome: "bad_call",
            score: 30,
            severity: "critical",
            needsHumanReview: true,
            operatorAction: "review_bad_call",
          },
        },
      },
    },
  ];

  const scoreAsc = buildVoiceOperatorQueueReadModel({ calls, sort: "score_asc" });
  const scoreDesc = buildVoiceOperatorQueueReadModel({ calls, sort: "score_desc" });
  const oldest = buildVoiceOperatorQueueReadModel({ calls, sort: "oldest" });
  const newest = buildVoiceOperatorQueueReadModel({ calls, sort: "newest" });

  assert.equal(scoreAsc.rows[0].callId, "call-low");
  assert.equal(scoreAsc.rows[1].callId, "call-high");
  assert.equal(scoreDesc.rows[0].callId, "call-high");
  assert.equal(scoreDesc.rows[1].callId, "call-low");
  assert.equal(oldest.rows[0].callId, "call-low");
  assert.equal(newest.rows[0].callId, "call-high");
});
