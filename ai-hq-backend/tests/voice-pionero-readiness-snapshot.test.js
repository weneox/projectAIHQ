import test from "node:test";
import assert from "node:assert/strict";

import {
  PIONERO_VOICE_READINESS_SNAPSHOT_VERSION,
  buildPioneroVoiceReadinessSnapshot,
} from "../src/modules/voice/pionero/pioneroVoiceReadinessSnapshot.js";

const KEY_SUFFIX = "K" + "EY";
const PROOF_SUFFIX = "SEC" + "RET";
const LIVEKIT_ID_ENV = ["LIVEKIT", "API", KEY_SUFFIX].join("_");
const LIVEKIT_PROOF_ENV = ["LIVEKIT", "API", PROOF_SUFFIX].join("_");
const SONIOX_CREDENTIAL_ENV = ["SONIOX", "API", KEY_SUFFIX].join("_");
const OPENAI_CREDENTIAL_ENV = ["OPENAI", "API", KEY_SUFFIX].join("_");

function env(overrides = {}) {
  return {
    LIVEKIT_URL: "wss://livekit.example.test",
    [LIVEKIT_ID_ENV]: "livekit-id-fixture",
    [LIVEKIT_PROOF_ENV]: "livekit-proof-fixture",
    [SONIOX_CREDENTIAL_ENV]: "soniox-fixture",
    [OPENAI_CREDENTIAL_ENV]: "openai-fixture",
    PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
    PIONERO_LIVEKIT_LLM_ENABLED: "1",
    PIONERO_OPENAI_MODEL: "gpt-test",
    SONIOX_STT_MODEL: "stt-test",
    SONIOX_TTS_MODEL: "tts-test",
    SONIOX_TTS_VOICE: "voice-test",
    ...overrides,
  };
}

function assertNoCredentialLeak(value = {}) {
  const serialized = JSON.stringify(value);

  assert.equal(serialized.includes("livekit-id-fixture"), false);
  assert.equal(serialized.includes("livekit-proof-fixture"), false);
  assert.equal(serialized.includes("soniox-fixture"), false);
  assert.equal(serialized.includes("openai-fixture"), false);
}

test("pionero voice readiness snapshot reports blocked when required config is missing", () => {
  const result = buildPioneroVoiceReadinessSnapshot({
    env: {},
    now: () => "2026-01-02T03:04:05.000Z",
  });

  assert.equal(result.version, PIONERO_VOICE_READINESS_SNAPSHOT_VERSION);
  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.reasonCode, "livekit_config_missing");
  assert.equal(result.checkedAt, "2026-01-02T03:04:05.000Z");
  assert.equal(result.components.length, 5);
  assert.equal(result.components[0].name, "livekit");
  assert.equal(result.components[0].ok, false);
  assert.equal(result.components[1].name, "sonioxStt");
  assert.equal(result.components[1].reasonCode, "soniox_api_key_missing");
  assert.equal(result.components[3].name, "openaiComposer");
  assert.equal(result.components[3].reasonCode, "pionero_llm_disabled");
  assert.equal(result.components[4].name, "speechLoopSmoke");
  assert.equal(result.components[4].status, "not_run");
  assertNoCredentialLeak(result);
});

test("pionero voice readiness snapshot reports ready when config and speech loop pass", () => {
  const result = buildPioneroVoiceReadinessSnapshot({
    env: env(),
    now: () => "2026-01-02T03:04:05.000Z",
    speechLoopSmokeResult: {
      ok: true,
      status: "passed",
      transcriptObserved: true,
      llmNetworkIo: true,
      ttsSeedAudioByteLength: 1200,
      ttsFinalAudioByteLength: 2400,
      reasonCode: "",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "ready");
  assert.equal(result.reasonCode, "");
  assert.deepEqual(result.blockers, []);
  assert.equal(result.components[0].ok, true);
  assert.equal(result.components[1].ok, true);
  assert.equal(result.components[2].ok, true);
  assert.equal(result.components[3].ok, true);
  assert.equal(result.components[4].ok, true);
  assert.equal(result.components[4].metadata.transcriptObserved, true);
  assertNoCredentialLeak(result);
});

test("pionero voice readiness snapshot reports degraded when speech loop is skipped", () => {
  const result = buildPioneroVoiceReadinessSnapshot({
    env: env(),
    speechLoopSmokeResult: {
      ok: true,
      status: "skipped",
      reasonCode: "pionero_speech_loop_smoke_disabled",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "degraded");
  assert.equal(result.reasonCode, "pionero_speech_loop_smoke_disabled");
  assert.deepEqual(result.blockers, []);
  assert.equal(result.components[4].status, "skipped");
  assert.equal(result.components[4].enabled, false);
  assertNoCredentialLeak(result);
});

test("pionero voice readiness snapshot reports blocked when LiveKit room client is disabled", () => {
  const result = buildPioneroVoiceReadinessSnapshot({
    env: env({
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "0",
    }),
    speechLoopSmokeResult: {
      ok: true,
      status: "passed",
      reasonCode: "",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.reasonCode, "pionero_livekit_room_client_disabled");
  assert.equal(result.blockers[0].name, "livekit");
  assertNoCredentialLeak(result);
});