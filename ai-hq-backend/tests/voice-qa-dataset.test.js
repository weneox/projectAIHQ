import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceQaDataset,
  buildVoiceQaDatasetRow,
  VOICE_QA_DATASET_VERSION,
} from "../src/modules/voice/qa/voiceQaDataset.js";

const baseInspector = {
  call: {
    id: "call-1",
    tenantId: "tenant-1",
    tenantKey: "acme",
    provider: "other",
    direction: "inbound",
    status: "completed",
    language: "az",
    agentMode: "assistant",
  },
  runtime: {
    blocked: false,
    reasonCode: "",
    providerContract: {
      provider: "openai",
    },
    speechPipeline: {
      mode: "realtime_audio",
      asr: {
        provider: "openai_realtime",
      },
      tts: {
        provider: "openai_realtime",
      },
    },
  },
  tools: {
    total: 1,
    missingRequired: ["phone"],
    hasMissingRequired: true,
    latest: {
      status: "missing_required_fields",
      toolName: "create_business_request",
    },
  },
  flags: {
    operatorAction: "apply_qa_correction",
    needsHumanReview: true,
    qaNeedsFix: true,
  },
  qa: {
    latestVerdict: "needs_fix",
    latestSeverity: "medium",
    annotationCount: 1,
    issueLabels: ["missing_slot", "unnatural_az"],
    slotLabels: ["phone"],
    lastAnnotation: {
      id: "annotation-1",
      operatorNote: "Telefon soruşulmalı idi.",
    },
    needsFix: true,
  },
};

test("voice QA dataset row turns inspector into trainable QA sample", () => {
  const row = buildVoiceQaDatasetRow({
    call: {
      id: "call-1",
      transcript: "Caller: Salam",
      summary: "Müştəri rezervasiya istədi.",
    },
    inspector: baseInspector,
  });

  assert.equal(row.version, VOICE_QA_DATASET_VERSION);
  assert.equal(row.callId, "call-1");
  assert.equal(row.label, "needs_fix");
  assert.equal(row.use, "naturalness_eval");
  assert.equal(row.qaVerdict, "needs_fix");
  assert.equal(row.runtimeBlocked, false);
  assert.equal(row.realtimeProvider, "openai");
  assert.equal(row.asrProvider, "openai_realtime");
  assert.equal(row.toolStatus, "missing_required_fields");
  assert.deepEqual(row.issueLabels, ["missing_slot", "unnatural_az"]);
  assert.deepEqual(row.slotLabels, ["phone"]);
  assert.equal(row.hasTranscript, true);
  assert.equal(row.transcriptSnippet, "Caller: Salam");
  assert.equal(Object.hasOwn(row, "transcript"), false);
});

test("voice QA dataset can include full text only when requested", () => {
  const row = buildVoiceQaDatasetRow({
    call: {
      id: "call-2",
      transcript: "full transcript",
      summary: "full summary",
    },
    inspector: {
      ...baseInspector,
      call: {
        ...baseInspector.call,
        id: "call-2",
      },
    },
    includeText: true,
  });

  assert.equal(row.transcript, "full transcript");
  assert.equal(row.summary, "full summary");
});

test("voice QA dataset filters and summarizes rows", () => {
  const dataset = buildVoiceQaDataset({
    items: [
      {
        call: {
          id: "call-1",
        },
        inspector: baseInspector,
      },
      {
        call: {
          id: "call-2",
        },
        inspector: {
          call: {
            id: "call-2",
            status: "completed",
          },
          runtime: {
            blocked: false,
          },
          tools: {
            total: 0,
          },
          qa: {
            latestVerdict: "pass",
            latestSeverity: "low",
            annotationCount: 1,
          },
          flags: {
            operatorAction: "reviewed_pass",
            qaPassed: true,
            needsHumanReview: false,
          },
        },
      },
    ],
    filters: {
      onlyAnnotated: true,
    },
  });

  assert.equal(dataset.version, VOICE_QA_DATASET_VERSION);
  assert.equal(dataset.rows.length, 2);
  assert.equal(dataset.summary.total, 2);
  assert.equal(dataset.summary.byLabel.needs_fix, 1);
  assert.equal(dataset.summary.byLabel.pass, 1);
  assert.equal(dataset.summary.byUse.naturalness_eval, 1);
  assert.equal(dataset.summary.byUse.golden_sample, 1);
  assert.equal(dataset.summary.annotated, 2);
});

test("voice QA dataset filters by issue label and operator action", () => {
  const dataset = buildVoiceQaDataset({
    items: [
      {
        call: {
          id: "call-1",
        },
        inspector: baseInspector,
      },
      {
        call: {
          id: "call-2",
        },
        inspector: {
          ...baseInspector,
          call: {
            ...baseInspector.call,
            id: "call-2",
          },
          qa: {
            ...baseInspector.qa,
            issueLabels: ["wrong_tool"],
            latestIssueLabels: ["wrong_tool"],
          },
          flags: {
            operatorAction: "process_request",
            needsHumanReview: true,
          },
        },
      },
    ],
    filters: {
      issueLabel: "wrong_tool",
      operatorAction: "process_request",
    },
  });

  assert.equal(dataset.rows.length, 1);
  assert.equal(dataset.rows[0].callId, "call-2");
  assert.equal(dataset.rows[0].use, "tool_policy_eval");
});
