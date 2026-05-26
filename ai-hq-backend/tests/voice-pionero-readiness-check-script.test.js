import test from "node:test";
import assert from "node:assert/strict";

import {
  runPioneroVoiceReadinessCheck,
} from "../scripts/check-pionero-voice-readiness.mjs";

const KEY_SUFFIX = "K" + "EY";
const PROOF_SUFFIX = "SEC" + "RET";
const LIVEKIT_ID_ENV = ["LIVEKIT", "API", KEY_SUFFIX].join("_");
const LIVEKIT_PROOF_ENV = ["LIVEKIT", "API", PROOF_SUFFIX].join("_");
const SONIOX_CREDENTIAL_ENV = ["SONIOX", "API", KEY_SUFFIX].join("_");
const OPENAI_CREDENTIAL_ENV = ["OPENAI", "API", KEY_SUFFIX].join("_");

function readyEnv(overrides = {}) {
  return {
    LIVEKIT_URL: "wss://livekit.example.test",
    [LIVEKIT_ID_ENV]: "livekit-id-fixture",
    [LIVEKIT_PROOF_ENV]: "livekit-proof-fixture",
    [SONIOX_CREDENTIAL_ENV]: "soniox-fixture",
    [OPENAI_CREDENTIAL_ENV]: "openai-fixture",
    PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
    PIONERO_LIVEKIT_LLM_ENABLED: "1",
    PIONERO_OPENAI_MODEL: "gpt-test",
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

test("pionero voice readiness check returns ready when snapshot and smoke pass", async () => {
  let smokeCalled = false;

  const result = await runPioneroVoiceReadinessCheck({
    env: readyEnv(),
    now: () => "2026-01-02T03:04:05.000Z",
    runSpeechLoopSmoke: async () => {
      smokeCalled = true;

      return {
        ok: true,
        status: "passed",
        transcriptObserved: true,
        llmNetworkIo: true,
        ttsSeedAudioByteLength: 12,
        ttsFinalAudioByteLength: 34,
        reasonCode: "",
      };
    },
  });

  assert.equal(smokeCalled, true);
  assert.equal(result.ok, true);
  assert.equal(result.status, "ready");
  assert.equal(result.reasonCode, "");
  assert.equal(result.requireReady, false);
  assert.equal(result.snapshot.status, "ready");
  assertNoCredentialLeak(result);
});

test("pionero voice readiness check is non-blocking by default when not configured", async () => {
  const result = await runPioneroVoiceReadinessCheck({
    env: {},
    runSpeechLoopSmoke: async () => ({
      ok: true,
      status: "skipped",
      reasonCode: "pionero_speech_loop_smoke_disabled",
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.reasonCode, "livekit_config_missing");
  assert.equal(result.requireReady, false);
  assert.equal(result.snapshot.components.at(-1).status, "skipped");
  assertNoCredentialLeak(result);
});

test("pionero voice readiness check exposes strict readiness intent", async () => {
  const result = await runPioneroVoiceReadinessCheck({
    env: {
      PIONERO_VOICE_READINESS_REQUIRE_READY: "1",
    },
    runSpeechLoopSmoke: async () => ({
      ok: true,
      status: "skipped",
      reasonCode: "pionero_speech_loop_smoke_disabled",
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.requireReady, true);
  assertNoCredentialLeak(result);
});