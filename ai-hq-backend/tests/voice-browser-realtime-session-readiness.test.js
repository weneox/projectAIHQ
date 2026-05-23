import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBrowserRealtimeSessionPlan,
  buildBrowserRealtimeSessionReadiness,
  readBrowserRealtimeProvider,
  readBrowserRealtimeTransport,
} from "../src/modules/voice/engine/browserRealtimeSession.js";

test("browser realtime session readiness is ready for default OpenAI realtime speech", () => {
  const readiness = buildBrowserRealtimeSessionReadiness();

  assert.equal(readiness.version, "browser-realtime-session-readiness-v1");
  assert.equal(readiness.ready, true);
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.reasonCode, "");
  assert.equal(readiness.provider, "openai");
  assert.equal(readiness.transport, "webrtc");
  assert.equal(readiness.providerContract.supported, true);
  assert.deepEqual(readiness.blockingReasons, []);
});

test("browser realtime session readiness blocks unsupported realtime providers", () => {
  const readiness = buildBrowserRealtimeSessionReadiness({
    runtimeConfig: {
      realtime: {
        provider: "livekit",
        transport: "sip",
      },
    },
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.reasonCode, "unsupported_realtime_provider");
  assert.equal(readiness.provider, "livekit");
  assert.equal(readiness.transport, "sip");
  assert.equal(readiness.providerContract.supported, false);
  assert.equal(readiness.blockingReasons[0].scope, "provider");
});

test("browser realtime session readiness blocks external speech providers until an adapter exists", () => {
  const readiness = buildBrowserRealtimeSessionReadiness({
    runtimeConfig: {
      speech: {
        input: {
          provider: "external_stt",
        },
      },
    },
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.status, "blocked");
  assert.equal(
    readiness.reasonCode,
    "asr_provider_requires_external_speech_adapter"
  );
  assert.equal(readiness.providerContract.supported, true);
  assert.equal(readiness.speechCompatibility.browserRealtimeSupported, false);
  assert.equal(readiness.blockingReasons[0].scope, "speech");
});

test("browser realtime session plan exposes readiness and provider contract", () => {
  const plan = buildBrowserRealtimeSessionPlan({
    runtimeConfig: {
      realtime: {
        provider: "twilio",
      },
    },
  });

  assert.equal(plan.readiness.ready, false);
  assert.equal(plan.readiness.status, "blocked");
  assert.equal(plan.readiness.reasonCode, "unsupported_realtime_provider");
  assert.equal(plan.providerContract.provider, "twilio");
  assert.equal(plan.providerContract.supported, false);
  assert.equal(plan.speechPipeline.compatibility.browserRealtimeSupported, true);
});

test("browser realtime provider and transport readers use safe defaults", () => {
  assert.equal(readBrowserRealtimeProvider(), "openai");
  assert.equal(readBrowserRealtimeTransport(), "webrtc");

  assert.equal(
    readBrowserRealtimeProvider({
      voiceRealtime: {
        provider: "openai_realtime",
      },
    }),
    "openai_realtime"
  );

  assert.equal(
    readBrowserRealtimeTransport({
      realtime: {
        transport: "sip",
      },
    }),
    "sip"
  );
});
