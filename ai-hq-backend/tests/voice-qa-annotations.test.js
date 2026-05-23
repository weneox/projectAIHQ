import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceQaAnnotationCallPatch,
  buildVoiceQaAnnotationEventPayload,
  buildVoiceQaAnnotationRecord,
  normalizeVoiceQaIssueLabels,
  normalizeVoiceQaNaturalnessLabels,
  normalizeVoiceQaSeverity,
  normalizeVoiceQaVerdict,
  VOICE_QA_ANNOTATION_VERSION,
} from "../src/modules/voice/qa/voiceQaAnnotations.js";

test("voice QA annotation normalizes operator correction input", () => {
  const record = buildVoiceQaAnnotationRecord({
    id: "annotation-1",
    now: "2026-05-23T00:00:00.000Z",
    actor: "operator-1",
    call: {
      id: "call-1",
    },
    input: {
      verdict: "needs_fix",
      issueLabels: ["missing_slot", "robotic_voice", "unknown_label"],
      slotLabels: ["phone", "date", "phone"],
      expectedOutcome: "ask_missing_details",
      operatorNote: "Telefon nömrəsi soruşulmalı idi.",
      naturalnessIssue: "Çox robot kimi səsləndi.",
    },
  });

  assert.equal(record.ok, true);
  assert.equal(record.annotation.version, VOICE_QA_ANNOTATION_VERSION);
  assert.equal(record.annotation.id, "annotation-1");
  assert.equal(record.annotation.callId, "call-1");
  assert.equal(record.annotation.actor, "operator-1");
  assert.equal(record.annotation.verdict, "needs_fix");
  assert.equal(record.annotation.severity, "medium");
  assert.deepEqual(record.annotation.issueLabels, ["missing_slot", "robotic_voice", "other"]);
  assert.deepEqual(record.annotation.slotLabels, ["phone", "date"]);
  assert.equal(record.annotation.expectedOutcome, "ask_missing_details");
});

test("voice QA annotation rejects empty reviewed input", () => {
  const record = buildVoiceQaAnnotationRecord({
    call: {
      id: "call-2",
    },
    input: {},
  });

  assert.equal(record.ok, false);
  assert.equal(record.reasonCode, "voice_qa_annotation_empty");
  assert.equal(record.annotation.verdict, "reviewed");
});

test("voice QA annotation derives verdict and severity from labels", () => {
  assert.equal(normalizeVoiceQaVerdict("", ["missing_slot"]), "needs_fix");
  assert.equal(normalizeVoiceQaVerdict("bad_call"), "bad_call");
  assert.equal(normalizeVoiceQaSeverity("", "bad_call"), "high");
  assert.deepEqual(normalizeVoiceQaIssueLabels(["fake_confirmation", "bad_x"]), [
    "fake_confirmation",
    "other",
  ]);
});

test("voice QA annotation event payload stays compact and inspectable", () => {
  const annotation = buildVoiceQaAnnotationRecord({
    id: "annotation-3",
    call: {
      id: "call-3",
    },
    input: {
      verdict: "bad_call",
      issueLabels: ["fake_confirmation"],
      operatorNote: "Agent təsdiqlənməmiş rezervasiyanı təsdiqlədi.",
    },
  }).annotation;

  const payload = buildVoiceQaAnnotationEventPayload({
    annotation,
    call: {
      id: "call-3",
    },
  });

  assert.equal(payload.version, VOICE_QA_ANNOTATION_VERSION);
  assert.equal(payload.callId, "call-3");
  assert.equal(payload.verdict, "bad_call");
  assert.deepEqual(payload.issueLabels, ["fake_confirmation"]);
  assert.equal(payload.annotation.operatorNote, "Agent təsdiqlənməmiş rezervasiyanı təsdiqlədi.");
});

test("voice QA annotation call patch appends bounded QA history in call meta", () => {
  const previousAnnotations = Array.from({ length: 22 }, (_, index) => ({
    id: `old-${index}`,
    verdict: "reviewed",
    createdAt: `2026-05-23T00:00:${String(index).padStart(2, "0")}.000Z`,
  }));

  const annotation = buildVoiceQaAnnotationRecord({
    id: "annotation-final",
    now: "2026-05-23T01:00:00.000Z",
    call: {
      id: "call-4",
    },
    input: {
      verdict: "needs_fix",
      issueLabels: ["wrong_tool"],
      slotLabels: ["service"],
      operatorNote: "Tool düzgün seçilmədi.",
    },
  }).annotation;

  const patch = buildVoiceQaAnnotationCallPatch({
    call: {
      id: "call-4",
      meta: {
        existing: true,
        qa: {
          annotations: previousAnnotations,
        },
      },
    },
    annotation,
  });

  assert.equal(patch.meta.existing, true);
  assert.equal(patch.meta.qa.annotations.length, 20);
  assert.equal(patch.meta.qa.annotations.at(-1).id, "annotation-final");
  assert.equal(patch.meta.qa.lastAnnotation.id, "annotation-final");
  assert.equal(patch.meta.qa.summary.latestVerdict, "needs_fix");
  assert.equal(patch.meta.qa.summary.needsFix, true);
  assert.equal(patch.meta.qa.summary.badCall, false);
});


test("voice QA annotation normalizes naturalness labels and score", () => {
  const record = buildVoiceQaAnnotationRecord({
    id: "annotation-naturalness-1",
    now: "2026-05-23T00:00:00.000Z",
    call: {
      id: "call-naturalness-1",
    },
    input: {
      verdict: "needs_fix",
      naturalnessLabels: ["recording_like", "too_formal", "unknown_label"],
      naturalnessScore: 2.4,
      naturalnessIssue: "Səs yazı kimi başlayır və çox rəsmi bağlanır.",
    },
  });

  assert.equal(record.ok, true);
  assert.deepEqual(record.annotation.naturalnessLabels, [
    "recording_like",
    "too_formal",
    "other",
  ]);
  assert.equal(record.annotation.naturalnessScore, 2);
  assert.deepEqual(normalizeVoiceQaNaturalnessLabels(["turn_taking", "bad_x"]), [
    "turn_taking",
    "other",
  ]);

  const payload = buildVoiceQaAnnotationEventPayload({
    annotation: record.annotation,
    call: {
      id: "call-naturalness-1",
    },
  });

  assert.deepEqual(payload.naturalnessLabels, [
    "recording_like",
    "too_formal",
    "other",
  ]);
  assert.equal(payload.naturalnessScore, 2);

  const patch = buildVoiceQaAnnotationCallPatch({
    call: {
      id: "call-naturalness-1",
      meta: {},
    },
    annotation: record.annotation,
  });

  assert.deepEqual(patch.meta.qa.summary.latestNaturalnessLabels, [
    "recording_like",
    "too_formal",
    "other",
  ]);
  assert.equal(patch.meta.qa.summary.latestNaturalnessScore, 2);
});
