import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBrowserSessionVoiceEvidence,
  buildVoiceRuntimeEvidence,
  VOICE_RUNTIME_EVIDENCE_VERSION,
} from "../src/modules/voice/evidence/voiceRuntimeEvidence.js";
import {
  buildBrowserRealtimeSessionPlan,
} from "../src/modules/voice/engine/browserRealtimeSession.js";

test("voice runtime evidence summarizes readiness provider and speech state", () => {
  const evidence = buildVoiceRuntimeEvidence({
    source: "test_source",
    phase: "test_phase",
    runtimeApplied: true,
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
  });

  assert.equal(evidence.version, VOICE_RUNTIME_EVIDENCE_VERSION);
  assert.equal(evidence.source, "test_source");
  assert.equal(evidence.phase, "test_phase");
  assert.equal(evidence.runtimeApplied, true);
  assert.equal(evidence.blocked, false);
  assert.equal(evidence.reasonCode, "");
  assert.equal(evidence.providerContract.provider, "openai");
  assert.equal(evidence.providerContract.capabilities.browserRealtime, true);
  assert.equal(evidence.speechPipeline.asr.provider, "openai_realtime");
});

test("voice runtime evidence marks blocked unsupported provider", () => {
  const evidence = buildVoiceRuntimeEvidence({
    source: "test_source",
    readiness: {
      ready: false,
      status: "blocked",
      reasonCode: "unsupported_realtime_provider",
      provider: "livekit",
      blockingReasons: [
        {
          scope: "provider",
          reasonCode: "unsupported_realtime_provider",
          provider: "livekit",
        },
      ],
    },
    providerContract: {
      provider: "livekit",
      supported: false,
      status: "unsupported",
      reasonCode: "unsupported_realtime_provider",
    },
  });

  assert.equal(evidence.blocked, true);
  assert.equal(evidence.reasonCode, "unsupported_realtime_provider");
  assert.equal(evidence.readiness.blockingReasons[0].scope, "provider");
  assert.equal(evidence.providerContract.supported, false);
});

test("browser session evidence is built from session plan", () => {
  const plan = buildBrowserRealtimeSessionPlan({
    runtimeConfig: {
      speech: {
        input: {
          provider: "external_stt",
        },
      },
    },
  });

  const evidence = buildBrowserSessionVoiceEvidence({
    sessionPlan: plan,
    runtimeApplied: false,
    runtimeReasonCode: "browser_voice_runtime_unavailable",
  });

  assert.equal(evidence.version, VOICE_RUNTIME_EVIDENCE_VERSION);
  assert.equal(evidence.source, "browser_realtime_session");
  assert.equal(evidence.phase, "browser_session");
  assert.equal(evidence.runtimeApplied, false);
  assert.equal(evidence.runtimeReasonCode, "browser_voice_runtime_unavailable");
  assert.equal(evidence.blocked, true);
  assert.equal(evidence.reasonCode, "browser_voice_runtime_unavailable");
  assert.equal(evidence.speechPipeline.compatibility.browserRealtimeSupported, false);
  assert.equal(evidence.providerContract.provider, "openai");
});
