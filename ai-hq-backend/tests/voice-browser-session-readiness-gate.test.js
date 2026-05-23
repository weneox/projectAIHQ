import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBrowserRealtimeSessionReadinessBlock,
} from "../src/routes/api/voice/public.js";
import {
  buildBrowserRealtimeSessionPlan,
} from "../src/modules/voice/engine/browserRealtimeSession.js";

test("browser session readiness gate allows default ready OpenAI session plan", () => {
  const plan = buildBrowserRealtimeSessionPlan();

  assert.equal(plan.readiness.ready, true);
  assert.equal(buildBrowserRealtimeSessionReadinessBlock(plan), null);
});

test("browser session readiness gate blocks unsupported realtime provider before token minting", () => {
  const plan = buildBrowserRealtimeSessionPlan({
    runtimeConfig: {
      realtime: {
        provider: "livekit",
        transport: "sip",
      },
    },
  });

  const block = buildBrowserRealtimeSessionReadinessBlock(plan);

  assert.equal(block.statusCode, 409);
  assert.equal(block.error, "browser_voice_session_not_ready");
  assert.equal(block.payload.blocked, true);
  assert.equal(block.payload.reasonCode, "unsupported_realtime_provider");
  assert.equal(block.payload.readiness.ready, false);
  assert.equal(block.payload.providerContract.provider, "livekit");
  assert.equal(block.payload.providerContract.supported, false);
  assert.equal(Object.hasOwn(block.payload, "clientSecret"), false);
  assert.equal(Object.hasOwn(block.payload, "session"), false);
});

test("browser session readiness gate blocks external speech before token minting", () => {
  const plan = buildBrowserRealtimeSessionPlan({
    runtimeConfig: {
      speech: {
        input: {
          provider: "external_stt",
        },
      },
    },
  });

  const block = buildBrowserRealtimeSessionReadinessBlock(plan);

  assert.equal(block.statusCode, 409);
  assert.equal(block.error, "browser_voice_session_not_ready");
  assert.equal(block.payload.blocked, true);
  assert.equal(
    block.payload.reasonCode,
    "asr_provider_requires_external_speech_adapter"
  );
  assert.equal(block.payload.readiness.ready, false);
  assert.equal(block.payload.speechPipeline.compatibility.browserRealtimeSupported, false);
  assert.equal(Object.hasOwn(block.payload, "clientSecret"), false);
  assert.equal(Object.hasOwn(block.payload, "session"), false);
});
