import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceQaCallInspector,
  VOICE_QA_CALL_INSPECTOR_VERSION,
} from "../src/modules/voice/qa/voiceQaCallInspector.js";
import {
  readVoiceCallDetails,
  readVoiceCallEvents,
} from "../src/modules/voice/callRead.js";

const runtimeEvidence = {
  version: "voice-runtime-evidence-v1",
  source: "browser_realtime_session",
  phase: "browser_session",
  blocked: false,
  reasonCode: "",
  readiness: {
    ready: true,
    status: "ready",
    provider: "openai",
    transport: "webrtc",
  },
  providerContract: {
    provider: "openai",
    supported: true,
    status: "supported",
    capabilities: {
      browserRealtime: true,
    },
  },
  speechPipeline: {
    mode: "realtime_audio",
    asr: {
      provider: "openai_realtime",
      model: "gpt-4o-mini-transcribe",
    },
    tts: {
      provider: "openai_realtime",
      voice: "coral",
    },
    compatibility: {
      browserRealtimeSupported: true,
    },
  },
};

test("voice QA call inspector summarizes runtime evidence and tool outcomes", () => {
  const call = {
    id: "call-1",
    tenantId: "tenant-1",
    tenantKey: "acme",
    provider: "other",
    direction: "inbound",
    status: "in_progress",
    outcome: "unknown",
    language: "az",
    agentMode: "assistant",
    transcript: "Caller: Salam",
    handoffRequested: false,
    meta: {
      runtimeEvidence,
    },
  };

  const events = [
    {
      id: "event-1",
      eventType: "browser_voice.provider_session_linked",
      createdAt: "2026-05-23T00:00:00.000Z",
      payload: {
        runtimeEvidence,
      },
    },
    {
      id: "event-2",
      eventType: "browser_voice.tool_executed",
      createdAt: "2026-05-23T00:00:05.000Z",
      payload: {
        toolName: "create_business_request",
        toolCallId: "tool-1",
        resultStatus: "missing_required_fields",
        missingRequired: ["phone"],
        result: {
          status: "missing_required_fields",
          missingRequired: ["phone"],
          nextPromptHint: {
            prompt: "Telefon nömrəsini soruş.",
          },
        },
      },
    },
  ];

  const inspector = buildVoiceQaCallInspector({ call, events });

  assert.equal(inspector.version, VOICE_QA_CALL_INSPECTOR_VERSION);
  assert.equal(inspector.callId, "call-1");
  assert.equal(inspector.call.hasTranscript, true);
  assert.equal(inspector.runtime.hasEvidence, true);
  assert.equal(inspector.runtime.providerContract.provider, "openai");
  assert.equal(inspector.runtime.speechPipeline.asr.provider, "openai_realtime");
  assert.equal(inspector.tools.total, 1);
  assert.equal(inspector.tools.hasMissingRequired, true);
  assert.deepEqual(inspector.tools.missingRequired, ["phone"]);
  assert.equal(inspector.flags.needsHumanReview, true);
  assert.equal(inspector.flags.operatorAction, "ask_missing_details");
});

test("voice QA call inspector marks blocked runtime as fix_runtime action", () => {
  const inspector = buildVoiceQaCallInspector({
    call: {
      id: "call-2",
      status: "queued",
      meta: {
        runtimeEvidence: {
          blocked: true,
          reasonCode: "unsupported_realtime_provider",
          readiness: {
            ready: false,
            reasonCode: "unsupported_realtime_provider",
            provider: "livekit",
          },
          providerContract: {
            provider: "livekit",
            supported: false,
            reasonCode: "unsupported_realtime_provider",
          },
        },
      },
    },
    events: [],
  });

  assert.equal(inspector.runtime.blocked, true);
  assert.equal(inspector.runtime.reasonCode, "unsupported_realtime_provider");
  assert.equal(inspector.flags.operatorAction, "fix_runtime");
  assert.equal(inspector.flags.needsHumanReview, true);
});

test("voice call read details exposes QA inspector without changing existing inspect shape", async () => {
  const fakeDb = {
    async query(sql, params) {
      assert.equal(params[0], "call-3");
      return {
        rows: [
          {
            id: "event-3",
            call_id: "call-3",
            tenant_id: "tenant-1",
            tenant_key: "acme",
            event_type: "browser_voice.tool_executed",
            actor: "system",
            payload: {
              toolName: "create_business_request",
              resultStatus: "request_recorded",
              result: {
                status: "request_recorded",
                requestOnly: true,
                confirmed: false,
              },
            },
            created_at: "2026-05-23T00:00:00.000Z",
          },
        ],
      };
    },
  };

  const call = {
    id: "call-3",
    tenantId: "tenant-1",
    tenantKey: "acme",
    status: "in_progress",
    meta: {
      runtimeEvidence,
    },
  };

  const details = await readVoiceCallDetails({ db: fakeDb, call });

  assert.equal(details.call.id, "call-3");
  assert.equal(details.events.length, 1);
  assert.ok(details.inspect);
  assert.equal(details.qaInspector.version, VOICE_QA_CALL_INSPECTOR_VERSION);
  assert.equal(details.inspector.version, VOICE_QA_CALL_INSPECTOR_VERSION);
  assert.equal(details.qaInspector.tools.hasRequestRecorded, true);
  assert.equal(details.qaInspector.flags.operatorAction, "process_request");
});

test("voice call events read exposes same QA inspector summary", async () => {
  const fakeDb = {
    async query(sql, params) {
      assert.equal(params[0], "call-4");
      return {
        rows: [
          {
            id: "event-4",
            call_id: "call-4",
            tenant_id: "tenant-1",
            tenant_key: "acme",
            event_type: "caller_transcript",
            actor: "caller",
            payload: {
              text: "Salam",
            },
            created_at: "2026-05-23T00:00:00.000Z",
          },
        ],
      };
    },
  };

  const result = await readVoiceCallEvents({
    db: fakeDb,
    call: {
      id: "call-4",
      tenantId: "tenant-1",
      tenantKey: "acme",
      status: "in_progress",
      meta: {
        runtimeEvidence,
      },
    },
  });

  assert.equal(result.events.length, 1);
  assert.equal(result.qaInspector.timeline.total, 1);
  assert.equal(result.qaInspector.runtime.hasEvidence, true);
});
