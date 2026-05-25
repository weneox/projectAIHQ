import test from "node:test";
import assert from "node:assert/strict";

import {
  PIONERO_LIVEKIT_AUDIO_MONITOR_VERSION,
  runPioneroLiveKitAudioMonitor,
} from "../scripts/monitor-pionero-livekit-audio.mjs";

const LIVEKIT_CREDENTIAL_ID_ENV = ["LIVEKIT", "API", "KEY"].join("_");
const LIVEKIT_CREDENTIAL_PROOF_ENV = ["LIVEKIT", "API", "SECRET"].join("_");

function unsafeEnv(overrides = {}) {
  return {
    LIVEKIT_URL: "wss://livekit.example.test",
    [LIVEKIT_CREDENTIAL_ID_ENV]: "credential-id-placeholder",
    [LIVEKIT_CREDENTIAL_PROOF_ENV]: "credential-proof-placeholder",
    TOKEN_TEST_VALUE: "token-secret",
    JWT_TEST_VALUE: "jwt-secret",
    RAW_AUDIO_TEST_VALUE: "rawAudio-secret",
    AUDIO_BASE64_TEST_VALUE: "audioBase64-secret",
    AUDIO_CHUNK_TEST_VALUE: "audioChunk-secret",
    ...overrides,
  };
}

function assertNoUnsafeOutputLeak(output = {}) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes("token"), false);
  assert.equal(serialized.includes("apiKey"), false);
  assert.equal(serialized.includes("apiSecret"), false);
  assert.equal(serialized.includes("jwt"), false);
  assert.equal(serialized.includes("rawAudio"), false);
  assert.equal(serialized.includes("audioBase64"), false);
  assert.equal(serialized.includes("audioChunk"), false);
  assert.equal(serialized.includes("token-secret"), false);
  assert.equal(serialized.includes("apiKey-secret"), false);
  assert.equal(serialized.includes("apiSecret-secret"), false);
  assert.equal(serialized.includes("jwt-secret"), false);
  assert.equal(serialized.includes("rawAudio-secret"), false);
  assert.equal(serialized.includes("audioBase64-secret"), false);
  assert.equal(serialized.includes("audioChunk-secret"), false);
}

function assertDefaultMonitorShape(result = {}, reasonCode = "") {
  assert.deepEqual(result, {
    ok: true,
    version: PIONERO_LIVEKIT_AUDIO_MONITOR_VERSION,
    skipped: true,
    networkIo: false,
    status: "",
    stopStatus: "",
    roomName: "pionero-browser-test",
    agentIdentity: "",
    reasonCode,
    monitorSeconds: 20,
    observedAudio: false,
    participantsObserved: 0,
    remoteParticipantsObserved: 0,
    trackPublicationsObserved: 0,
    audioPublicationsObserved: 0,
    subscribedAudioTracksObserved: 0,
    lastParticipantIdentity: "",
    lastPublicationKind: "",
    lastPublicationSource: "",
    lastPublicationSubscribed: false,
    tracksObserved: 0,
    framesObserved: 0,
    bytesObserved: 0,
    audioStreamsOpened: 0,
    audioStreamFramesObserved: 0,
    audioStreamReadErrors: 0,
    lastAudioStreamReasonCode: "",
    lastEventName: "",
    lastTrackKind: "",
    lastTrackSource: "",
    eventCounts: {},
    audioIngestStatus: "",
    sttStatus: "",
    llmStatus: "",
    ttsStatus: "",
  });
}

test("pionero live audio monitor skips when monitor flag is disabled", async () => {
  let factoryCalled = false;

  const result = await runPioneroLiveKitAudioMonitor({
    env: unsafeEnv({
      PIONERO_LIVEKIT_LIVE_MONITOR_ENABLED: "0",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
    }),
    roomClassFactory: async () => {
      factoryCalled = true;
      return null;
    },
  });

  assertDefaultMonitorShape(
    result,
    "pionero_livekit_live_monitor_disabled"
  );
  assert.equal(factoryCalled, false);
  assertNoUnsafeOutputLeak(result);
});

test("pionero live audio monitor skips when room client flag is disabled", async () => {
  let factoryCalled = false;

  const result = await runPioneroLiveKitAudioMonitor({
    env: unsafeEnv({
      PIONERO_LIVEKIT_LIVE_MONITOR_ENABLED: "1",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "0",
    }),
    roomClassFactory: async () => {
      factoryCalled = true;
      return null;
    },
  });

  assertDefaultMonitorShape(result, "pionero_livekit_room_client_disabled");
  assert.equal(factoryCalled, false);
  assertNoUnsafeOutputLeak(result);
});

test("pionero live audio monitor reports missing config with booleans only", async () => {
  let factoryCalled = false;

  const result = await runPioneroLiveKitAudioMonitor({
    env: {
      PIONERO_LIVEKIT_LIVE_MONITOR_ENABLED: "true",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
      TOKEN_TEST_VALUE: "token-secret",
      JWT_TEST_VALUE: "jwt-secret",
      RAW_AUDIO_TEST_VALUE: "rawAudio-secret",
      AUDIO_BASE64_TEST_VALUE: "audioBase64-secret",
      AUDIO_CHUNK_TEST_VALUE: "audioChunk-secret",
    },
    roomClassFactory: async () => {
      factoryCalled = true;
      return null;
    },
  });

  assert.deepEqual(result, {
    ok: false,
    version: PIONERO_LIVEKIT_AUDIO_MONITOR_VERSION,
    skipped: true,
    networkIo: false,
    status: "",
    stopStatus: "",
    roomName: "pionero-browser-test",
    agentIdentity: "",
    reasonCode: "livekit_config_missing",
    monitorSeconds: 20,
    observedAudio: false,
    participantsObserved: 0,
    remoteParticipantsObserved: 0,
    trackPublicationsObserved: 0,
    audioPublicationsObserved: 0,
    subscribedAudioTracksObserved: 0,
    lastParticipantIdentity: "",
    lastPublicationKind: "",
    lastPublicationSource: "",
    lastPublicationSubscribed: false,
    tracksObserved: 0,
    framesObserved: 0,
    bytesObserved: 0,
    audioStreamsOpened: 0,
    audioStreamFramesObserved: 0,
    audioStreamReadErrors: 0,
    lastAudioStreamReasonCode: "",
    lastEventName: "",
    lastTrackKind: "",
    lastTrackSource: "",
    eventCounts: {},
    audioIngestStatus: "",
    sttStatus: "",
    llmStatus: "",
    ttsStatus: "",
    missing: {
      livekitUrl: true,
      livekitCredentialId: true,
      livekitCredentialProof: true,
    },
  });
  assert.equal(factoryCalled, false);
  assertNoUnsafeOutputLeak(result);
});

test("pionero live audio monitor connected runner output includes diagnostics", async () => {
  class FakeRoom {}
  class FakeAudioStream {}
  const FakeRoomEvent = {
    TrackSubscribed: "trackSubscribed",
  };
  const FakeTrackKind = {
    KIND_AUDIO: 1,
  };
  const FakeTrackSource = {
    SOURCE_MICROPHONE: 2,
  };
  FakeRoom.RoomEvent = FakeRoomEvent;
  FakeRoom.AudioStream = FakeAudioStream;
  FakeRoom.TrackKind = FakeTrackKind;
  FakeRoom.TrackSource = FakeTrackSource;

  const waitCalls = [];
  let snapshotCalls = 0;
  let stopCalled = false;

  const result = await runPioneroLiveKitAudioMonitor({
    env: unsafeEnv({
      [LIVEKIT_CREDENTIAL_ID_ENV]: "credential-id-livekit",
      [LIVEKIT_CREDENTIAL_PROOF_ENV]: "credential-proof-livekit",
      PIONERO_LIVEKIT_LIVE_MONITOR_ENABLED: "1",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "true",
      PIONERO_LIVEKIT_LIVE_MONITOR_SECONDS: "3",
      PIONERO_LIVEKIT_LIVE_MONITOR_ROOM_NAME: "pionero-browser-test",
    }),
    roomClassFactory: async ({ roomName }) => {
      assert.equal(roomName, "pionero-browser-test");
      return FakeRoom;
    },
    createRunner: ({
      AudioStream,
      RoomClass,
      RoomEvent,
      TrackKind,
      TrackSource,
      roomName,
    }) => {
      assert.equal(RoomClass, FakeRoom);
      assert.equal(RoomEvent, FakeRoomEvent);
      assert.equal(AudioStream, FakeAudioStream);
      assert.equal(TrackKind, FakeTrackKind);
      assert.equal(TrackSource, FakeTrackSource);
      assert.equal(roomName, "pionero-browser-test");

      return {
        async start() {
          return {
            status: "connected",
            networkIo: true,
            roomName,
            agentIdentity: "aihq-pionero-agent",
            reasonCode: "",
            audioIngest: {
              status: "waiting_for_audio",
            },
            stt: {
              status: "idle",
            },
            llm: {
              status: "planned",
            },
            tts: {
              status: "planned",
            },
          };
        },
        snapshotDiagnostics() {
          snapshotCalls += 1;
          return {
            status: "connected",
            networkIo: true,
            roomName,
            agentIdentity: "aihq-pionero-agent",
            reasonCode: "",
            audioIngest: {
              status: "audio_observed",
              participantsObserved: 2,
              remoteParticipantsObserved: 1,
              trackPublicationsObserved: 1,
              audioPublicationsObserved: 1,
              subscribedAudioTracksObserved: 1,
              lastParticipantIdentity: "browser-1",
              lastPublicationKind: "audio",
              lastPublicationSource: "microphone",
              lastPublicationSubscribed: true,
              tracksObserved: 1,
              framesObserved: 2,
              bytesObserved: 9,
              audioStreamsOpened: 1,
              audioStreamFramesObserved: 2,
              audioStreamReadErrors: 0,
              lastAudioStreamReasonCode: "audio_stream_frame_observed",
              lastEventName: "audioFrame",
              lastTrackKind: "audio",
              lastTrackSource: "microphone",
              eventCounts: {
                trackSubscribed: 1,
                audioFrame: 2,
              },
              rawAudio: "rawAudio-secret",
              audioChunk: "audioChunk-secret",
              token: "token-secret",
            },
            stt: {
              status: "idle",
            },
            llm: {
              status: "planned",
            },
            tts: {
              status: "planned",
            },
          };
        },
        async stop() {
          stopCalled = true;
          return {
            status: "stopped",
          };
        },
      };
    },
    wait: async (ms) => {
      waitCalls.push(ms);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, false);
  assert.equal(result.networkIo, true);
  assert.equal(result.status, "connected");
  assert.equal(result.stopStatus, "stopped");
  assert.equal(result.roomName, "pionero-browser-test");
  assert.equal(result.agentIdentity, "aihq-pionero-agent");
  assert.equal(result.reasonCode, "");
  assert.equal(result.monitorSeconds, 3);
  assert.equal(result.observedAudio, true);
  assert.equal(result.participantsObserved, 2);
  assert.equal(result.remoteParticipantsObserved, 1);
  assert.equal(result.trackPublicationsObserved, 1);
  assert.equal(result.audioPublicationsObserved, 1);
  assert.equal(result.subscribedAudioTracksObserved, 1);
  assert.equal(result.lastParticipantIdentity, "browser-1");
  assert.equal(result.lastPublicationKind, "audio");
  assert.equal(result.lastPublicationSource, "microphone");
  assert.equal(result.lastPublicationSubscribed, true);
  assert.equal(result.tracksObserved, 1);
  assert.equal(result.framesObserved, 2);
  assert.equal(result.bytesObserved, 9);
  assert.equal(result.audioStreamsOpened, 1);
  assert.equal(result.audioStreamFramesObserved, 2);
  assert.equal(result.audioStreamReadErrors, 0);
  assert.equal(result.lastAudioStreamReasonCode, "audio_stream_frame_observed");
  assert.equal(result.lastEventName, "audioFrame");
  assert.equal(result.lastTrackKind, "audio");
  assert.equal(result.lastTrackSource, "microphone");
  assert.deepEqual(result.eventCounts, {
    trackSubscribed: 1,
    audioFrame: 2,
  });
  assert.equal(result.audioIngestStatus, "audio_observed");
  assert.equal(result.sttStatus, "idle");
  assert.equal(result.llmStatus, "planned");
  assert.equal(result.ttsStatus, "planned");
  assert.deepEqual(waitCalls, [1000, 1000, 1000]);
  assert.equal(snapshotCalls, 3);
  assert.equal(stopCalled, true);
  assertNoUnsafeOutputLeak(result);
});

test("pionero live audio monitor clamps monitor duration", async () => {
  const maxResult = await runPioneroLiveKitAudioMonitor({
    env: unsafeEnv({
      PIONERO_LIVEKIT_LIVE_MONITOR_ENABLED: "0",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
      PIONERO_LIVEKIT_LIVE_MONITOR_SECONDS: "500",
    }),
  });
  const minResult = await runPioneroLiveKitAudioMonitor({
    env: unsafeEnv({
      PIONERO_LIVEKIT_LIVE_MONITOR_ENABLED: "0",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
      PIONERO_LIVEKIT_LIVE_MONITOR_SECONDS: "-5",
    }),
  });

  assert.equal(maxResult.monitorSeconds, 60);
  assert.equal(minResult.monitorSeconds, 1);
  assertNoUnsafeOutputLeak(maxResult);
  assertNoUnsafeOutputLeak(minResult);
});

test("pionero live audio monitor redacts unsafe output strings", async () => {
  const result = await runPioneroLiveKitAudioMonitor({
    env: unsafeEnv({
      PIONERO_LIVEKIT_LIVE_MONITOR_ENABLED: "0",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
      PIONERO_LIVEKIT_LIVE_MONITOR_ROOM_NAME:
        "token-apiKey-apiSecret-jwt-rawAudio-audioBase64-audioChunk",
      PIONERO_LIVEKIT_LIVE_MONITOR_SECONDS: "1",
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.networkIo, false);
  assert.equal(result.roomName, "[redacted]");
  assert.equal(result.monitorSeconds, 1);
  assertNoUnsafeOutputLeak(result);
});
