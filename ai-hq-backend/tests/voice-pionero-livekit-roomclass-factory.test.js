import test from "node:test";
import assert from "node:assert/strict";

import {
  PIONERO_LIVEKIT_ROOM_CLASS_FACTORY_VERSION,
  createPioneroLiveKitRoomClassFactory,
} from "../src/modules/voice/pionero/pioneroLiveKitRoomClassFactory.js";

function createTestLogger() {
  const warnings = [];

  return {
    warnings,
    warn(event, fields) {
      warnings.push({ event, fields });
    },
  };
}

function assertNoUnsafeLogLeak(warnings = []) {
  const serialized = JSON.stringify(warnings);

  assert.equal(serialized.includes("token-secret"), false);
  assert.equal(serialized.includes("api-secret"), false);
  assert.equal(serialized.includes("raw-audio-secret"), false);
  assert.equal(serialized.includes("audio-base64-secret"), false);
  assert.equal(serialized.includes("audio-chunk-secret"), false);
  assert.equal(serialized.includes("token"), false);
  assert.equal(serialized.includes("apiSecret"), false);
  assert.equal(serialized.includes("rawAudio"), false);
  assert.equal(serialized.includes("audioBase64"), false);
  assert.equal(serialized.includes("audioChunk"), false);
}

test("pionero LiveKit RoomClass factory is versioned", () => {
  assert.equal(
    PIONERO_LIVEKIT_ROOM_CLASS_FACTORY_VERSION,
    "pionero_livekit_room_class_factory.v1"
  );
});

test("pionero LiveKit RoomClass factory returns null when disabled", async () => {
  let importerCalled = false;
  const logger = createTestLogger();
  const factory = createPioneroLiveKitRoomClassFactory({
    env: {
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "0",
      PIONERO_LIVEKIT_ROOM_CLIENT_MODULE: "fake-livekit-room-client",
    },
    logger,
    importer: async () => {
      importerCalled = true;
      throw new Error("importer should not be called");
    },
  });

  const RoomClass = await factory({ roomName: "pionero safe room" });

  assert.equal(RoomClass, null);
  assert.equal(importerCalled, false);
  assert.deepEqual(logger.warnings, []);
});

test("pionero LiveKit RoomClass factory imports module Room shape", async () => {
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

  const imports = [];
  const factory = createPioneroLiveKitRoomClassFactory({
    env: {
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "true",
      PIONERO_LIVEKIT_ROOM_CLIENT_MODULE: "fake-livekit-room-client",
    },
    importer: async (moduleName) => {
      imports.push(moduleName);
      return {
        AudioStream: FakeAudioStream,
        Room: FakeRoom,
        RoomEvent: FakeRoomEvent,
        TrackKind: FakeTrackKind,
        TrackSource: FakeTrackSource,
      };
    },
  });

  const RoomClass = await factory({ roomName: "pionero safe room" });

  assert.equal(RoomClass, FakeRoom);
  assert.equal(RoomClass.RoomClass, FakeRoom);
  assert.equal(RoomClass.RoomEvent, FakeRoomEvent);
  assert.equal(RoomClass.AudioStream, FakeAudioStream);
  assert.equal(RoomClass.TrackKind, FakeTrackKind);
  assert.equal(RoomClass.TrackSource, FakeTrackSource);
  assert.deepEqual(imports, ["fake-livekit-room-client"]);
});

test("pionero LiveKit RoomClass factory supports default Room shape", async () => {
  class FakeRoom {}
  class FakeAudioStream {}
  const FakeRoomEvent = {
    TrackPublished: "trackPublished",
  };
  const FakeTrackKind = {
    KIND_AUDIO: 1,
  };
  const FakeTrackSource = {
    SOURCE_MICROPHONE: 2,
  };

  const factory = createPioneroLiveKitRoomClassFactory({
    env: {
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
    },
    importer: async (moduleName) => {
      assert.equal(moduleName, "@livekit/rtc-node");
      return {
        default: {
          AudioStream: FakeAudioStream,
          Room: FakeRoom,
          RoomEvent: FakeRoomEvent,
          TrackKind: FakeTrackKind,
          TrackSource: FakeTrackSource,
        },
      };
    },
  });

  const RoomClass = await factory({ roomName: "pionero safe room" });

  assert.equal(RoomClass, FakeRoom);
  assert.equal(RoomClass.RoomEvent, FakeRoomEvent);
  assert.equal(RoomClass.AudioStream, FakeAudioStream);
  assert.equal(RoomClass.TrackKind, FakeTrackKind);
  assert.equal(RoomClass.TrackSource, FakeTrackSource);
});

test("pionero LiveKit RoomClass factory supports default function shape", async () => {
  class FakeRoom {}

  const factory = createPioneroLiveKitRoomClassFactory({
    env: {
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "TRUE",
      PIONERO_LIVEKIT_ROOM_CLIENT_MODULE: "fake-livekit-default-client",
    },
    importer: async () => ({ default: FakeRoom }),
  });

  const RoomClass = await factory({ roomName: "pionero safe room" });

  assert.equal(RoomClass, FakeRoom);
});

test("pionero LiveKit RoomClass factory import failure logs safe warning", async () => {
  const logger = createTestLogger();
  const factory = createPioneroLiveKitRoomClassFactory({
    env: {
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "true",
      PIONERO_LIVEKIT_ROOM_CLIENT_MODULE: "fake-livekit-room-client",
    },
    logger,
    importer: async () => {
      throw new Error(
        "token-secret api-secret raw-audio-secret audio-base64-secret audio-chunk-secret"
      );
    },
  });

  const RoomClass = await factory({
    roomName: "pionero safe room",
    token: "token-secret",
    apiSecret: "api-secret",
    rawAudio: "raw-audio-secret",
    audioBase64: "audio-base64-secret",
    audioChunk: "audio-chunk-secret",
  });

  assert.equal(RoomClass, null);
  assert.equal(logger.warnings.length, 1);
  assert.deepEqual(logger.warnings[0], {
    event: "pionero.livekit.room_class_factory.import_failed",
    fields: {
      enabled: true,
      moduleName: "fake-livekit-room-client",
      roomName: "pionero safe room",
      reasonCode: "pionero_livekit_room_class_import_failed",
    },
  });
  assertNoUnsafeLogLeak(logger.warnings);
});

test("pionero LiveKit RoomClass factory invalid module shape logs safe warning", async () => {
  const logger = createTestLogger();
  const factory = createPioneroLiveKitRoomClassFactory({
    env: {
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
      PIONERO_LIVEKIT_ROOM_CLIENT_MODULE: "fake-livekit-invalid-client",
    },
    logger,
    importer: async () => ({
      default: {
        notRoom: true,
        token: "token-secret",
        apiSecret: "api-secret",
        rawAudio: "raw-audio-secret",
        audioBase64: "audio-base64-secret",
        audioChunk: "audio-chunk-secret",
      },
    }),
  });

  const RoomClass = await factory({
    roomName: "pionero safe room",
    token: "token-secret",
    apiSecret: "api-secret",
    rawAudio: "raw-audio-secret",
    audioBase64: "audio-base64-secret",
    audioChunk: "audio-chunk-secret",
  });

  assert.equal(RoomClass, null);
  assert.equal(logger.warnings.length, 1);
  assert.deepEqual(logger.warnings[0], {
    event: "pionero.livekit.room_class_factory.invalid_module",
    fields: {
      enabled: true,
      moduleName: "fake-livekit-invalid-client",
      roomName: "pionero safe room",
      reasonCode: "pionero_livekit_room_class_missing",
    },
  });
  assertNoUnsafeLogLeak(logger.warnings);
});

test("pionero LiveKit RoomClass factory redacts unsafe module and room names", async () => {
  const logger = createTestLogger();
  const factory = createPioneroLiveKitRoomClassFactory({
    env: {
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
      PIONERO_LIVEKIT_ROOM_CLIENT_MODULE:
        "token-apiKey-apiSecret-jwt-rawAudio-audioBase64-audioChunk",
    },
    logger,
    importer: async () => {
      throw new Error("token-secret api-secret raw-audio-secret");
    },
  });

  const RoomClass = await factory({
    roomName: "token-apiKey-apiSecret-jwt-rawAudio-audioBase64-audioChunk",
  });

  assert.equal(RoomClass, null);
  assert.equal(logger.warnings.length, 1);
  assert.deepEqual(logger.warnings[0], {
    event: "pionero.livekit.room_class_factory.import_failed",
    fields: {
      enabled: true,
      moduleName: "[redacted]",
      roomName: "[redacted]",
      reasonCode: "pionero_livekit_room_class_import_failed",
    },
  });
  assertNoUnsafeLogLeak(logger.warnings);
});
