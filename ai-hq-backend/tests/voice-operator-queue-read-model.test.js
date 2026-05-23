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

test("voice operator queue respects score sorting", () => {
  const queue = buildVoiceOperatorQueueReadModel({
    calls: [
      {
        id: "call-high",
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
    ],
    sort: "score_asc",
  });

  assert.equal(queue.rows[0].callId, "call-low");
  assert.equal(queue.rows[1].callId, "call-high");
});
