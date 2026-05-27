import {
  AudioStream,
  Room,
  RoomEvent,
} from "@livekit/rtc-node";

import {
  buildPioneroVoiceBrainInstructions,
} from "../../brain/index.js";
import { s } from "../../shared.js";
import {
  createPioneroLiveKitAgentToken,
} from "../pioneroLiveKitAgent.js";
import {
  createLiveKitAudioTrackPublisher,
} from "./liveKitAudioTrackPublisher.js";
import {
  createOpenAIRealtimeTransport,
} from "./openaiRealtimeTransport.js";

export const PIONERO_OPENAI_REALTIME_LIVEKIT_BRIDGE_VERSION =
  "pionero_openai_realtime_livekit_bridge.v1";
export const PIONERO_OPENAI_REALTIME_LIVEKIT_BRIDGE_MODE =
  "openai_realtime_livekit_track";

const DEFAULT_SAMPLE_RATE_HZ = 24000;
const DEFAULT_CHANNELS = 1;
const DEFAULT_AUDIO_FRAME_EVENT_NAMES = [
  "audioFrame",
  "audioChunk",
  "audioData",
  "data",
];

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

function truthy(value = "") {
  return ["1", "true", "yes", "y", "on"].includes(s(value).toLowerCase());
}

function nowMs(now = Date.now) {
  const value = typeof now === "function" ? now() : Date.now();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.now();
}

function nowIso(now = Date.now) {
  return new Date(nowMs(now)).toISOString();
}

function safeStatusText(value = "", fallback = "") {
  const raw = s(value, fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, 500);
  const folded = raw.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (
    [
      "apikey",
      "apisecret",
      "authorization",
      "audiobase64",
      "rawaudio",
      "secret",
      "token",
    ].some((pattern) => folded.includes(pattern))
  ) {
    return "[redacted]";
  }

  return raw;
}

export function readPioneroRealtimeBridgeConfig(env = process.env) {
  return {
    enabled: truthy(env.PIONERO_REALTIME_LANE_ENABLED),
    provider: s(env.PIONERO_REALTIME_PROVIDER, "fallback").toLowerCase(),
    model: s(env.PIONERO_OPENAI_REALTIME_MODEL || env.OPENAI_REALTIME_MODEL),
    voice: s(env.PIONERO_OPENAI_REALTIME_VOICE || env.OPENAI_REALTIME_VOICE),
  };
}

export function normalizeRealtimeBridgeAudioFrameToPcmBuffer(frame, seen = new Set()) {
  if (frame === null || frame === undefined) return Buffer.alloc(0);
  if (Buffer.isBuffer(frame)) return Buffer.from(frame);
  if (typeof frame === "string") return Buffer.alloc(0);

  if (frame instanceof ArrayBuffer) return Buffer.from(frame);

  if (ArrayBuffer.isView(frame)) {
    return Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength);
  }

  if (typeof frame !== "object") return Buffer.alloc(0);
  if (seen.has(frame)) return Buffer.alloc(0);
  seen.add(frame);

  if (ArrayBuffer.isView(frame.data)) {
    return Buffer.from(
      frame.data.buffer,
      frame.data.byteOffset,
      frame.data.byteLength
    );
  }

  for (const key of ["data", "audio", "audioFrame", "chunk", "frame"]) {
    const nested = frame[key];

    if (nested && nested !== frame) {
      const normalized = normalizeRealtimeBridgeAudioFrameToPcmBuffer(
        nested,
        seen
      );

      if (normalized.byteLength) return normalized;
    }
  }

  return Buffer.alloc(0);
}

function buildInitialStatus({ env = process.env, roomName = "" } = {}) {
  const config = readPioneroRealtimeBridgeConfig(env);
  const enabled = config.enabled && config.provider === "openai_realtime";

  return {
    version: PIONERO_OPENAI_REALTIME_LIVEKIT_BRIDGE_VERSION,
    mode: PIONERO_OPENAI_REALTIME_LIVEKIT_BRIDGE_MODE,
    enabled,
    status: enabled ? "idle" : "disabled",
    roomName: s(roomName),
    provider: config.provider,
    realtimeConnected: false,
    livekitAudioTrackPublished: false,
    firstAudioAt: "",
    firstAudioLatencyMs: 0,
    interruptionsObserved: 0,
    lastReasonCode: enabled
      ? ""
      : config.enabled
        ? "unsupported_realtime_provider"
        : "pionero_realtime_lane_disabled",
    errorMessage: "",
  };
}

function buildRealtimeInstructions({
  baseInstructions = "",
  runtimeConfig = {},
  runtimeApplied = false,
} = {}) {
  return buildPioneroVoiceBrainInstructions({
    baseInstructions,
    runtimeConfig,
    runtimeApplied,
  }).instructions;
}

export function createOpenAIRealtimeLiveKitBridge({
  env = process.env,
  logger = null,
  roomName = "",
  baseInstructions = "",
  runtimeConfig = {},
  runtimeApplied = false,
  sampleRateHz = DEFAULT_SAMPLE_RATE_HZ,
  channels = DEFAULT_CHANNELS,
  now = Date.now,
  RoomClass = Room,
  RoomEventEnum = RoomEvent,
  AudioStreamCtor = AudioStream,
  createAgentToken = createPioneroLiveKitAgentToken,
  createTransport = createOpenAIRealtimeTransport,
  createPublisher = createLiveKitAudioTrackPublisher,
  audioFrameEventNames = DEFAULT_AUDIO_FRAME_EVENT_NAMES,
} = {}) {
  const safeRoomName = s(roomName, "pionero-browser-test");
  const config = readPioneroRealtimeBridgeConfig(env);
  const safeSampleRateHz = n(sampleRateHz, DEFAULT_SAMPLE_RATE_HZ);
  const safeChannels = n(channels, DEFAULT_CHANNELS);
  let status = buildInitialStatus({
    env,
    roomName: safeRoomName,
  });
  let room = null;
  let transport = null;
  let publisher = null;
  let startedAtMs = 0;
  let assistantSpeaking = false;
  let currentResponseId = "";
  let currentItemId = "";
  let cleanupListeners = [];
  let audioStreamReaders = [];

  function setStatus(patch = {}) {
    status = {
      ...status,
      ...patch,
    };
    return status;
  }

  function getStatus() {
    return { ...status };
  }

  function addListener(target, eventName, handler) {
    if (!target || !eventName || typeof target.on !== "function") return;

    target.on(eventName, handler);
    cleanupListeners.push(() => {
      target.off?.(eventName, handler);
    });
  }

  async function interruptAssistantOutput(reasonCode = "user_barge_in") {
    if (!assistantSpeaking) return getStatus();

    assistantSpeaking = false;
    setStatus({
      interruptionsObserved: status.interruptionsObserved + 1,
      lastReasonCode: reasonCode,
    });

    try {
      await publisher?.interrupt?.();
    } catch {
      // Interruption should still cancel the model even if local queue clear fails.
    }

    transport?.interrupt?.({
      responseId: currentResponseId,
      itemId: currentItemId,
    });

    return getStatus();
  }

  async function observeUserAudioFrame(frame) {
    const pcm = normalizeRealtimeBridgeAudioFrameToPcmBuffer(frame);

    if (!pcm.byteLength) return false;

    if (assistantSpeaking) {
      await interruptAssistantOutput("user_barge_in");
    }

    return transport?.sendUserAudioFrame?.(pcm) === true;
  }

  async function handleAssistantAudioDelta(event = {}) {
    const audio = normalizeRealtimeBridgeAudioFrameToPcmBuffer(event.audio);

    if (!audio.byteLength) return getStatus();

    assistantSpeaking = true;
    currentResponseId = s(event.responseId || event.response_id, currentResponseId);
    currentItemId = s(event.itemId || event.item_id, currentItemId);

    if (!status.firstAudioAt) {
      const firstAudioMs = nowMs(now);
      setStatus({
        firstAudioAt: nowIso(() => firstAudioMs),
        firstAudioLatencyMs: Math.max(0, firstAudioMs - startedAtMs),
      });
    }

    await publisher?.publishAudioDelta?.(audio);

    return getStatus();
  }

  function attachTransportHandlers() {
    transport?.on?.("connected", () => {
      setStatus({
        realtimeConnected: true,
        lastReasonCode: "",
      });
    });

    transport?.on?.("audioDelta", (event) => {
      void handleAssistantAudioDelta(event);
    });

    transport?.on?.("assistantResponseStarted", (event = {}) => {
      assistantSpeaking = true;
      currentResponseId = s(event.responseId, currentResponseId);
    });

    transport?.on?.("assistantResponseDone", () => {
      assistantSpeaking = false;
      currentResponseId = "";
      currentItemId = "";
    });

    transport?.on?.("userSpeechStarted", () => {
      void interruptAssistantOutput("openai_input_audio_speech_started");
    });

    transport?.on?.("error", (event = {}) => {
      setStatus({
        status: "error",
        lastReasonCode: safeStatusText(event.reasonCode, "openai_realtime_error"),
        errorMessage: safeStatusText(event.errorMessage, "OpenAI realtime error"),
      });
    });

    transport?.on?.("closed", () => {
      setStatus({
        realtimeConnected: false,
      });
    });
  }

  async function readAudioStreamFrames(entry) {
    try {
      while (!entry.cancelled) {
        const result = await entry.reader.read();

        if (entry.cancelled || !result || result.done) break;
        await observeUserAudioFrame(result.value ?? result);
      }
    } catch {
      if (!entry.cancelled) {
        setStatus({
          lastReasonCode: "livekit_audio_stream_read_failed",
        });
      }
    }
  }

  function startAudioStreamForTrack(track) {
    if (!track || typeof AudioStreamCtor !== "function") return;

    try {
      const stream = new AudioStreamCtor(track, {
        sampleRate: safeSampleRateHz,
        numChannels: safeChannels,
        frameSizeMs: 20,
      });
      const reader = stream?.getReader?.();

      if (!reader || typeof reader.read !== "function") return;

      const entry = {
        cancelled: false,
        reader,
        stream,
      };
      audioStreamReaders.push(entry);
      entry.promise = readAudioStreamFrames(entry);
    } catch {
      setStatus({
        lastReasonCode: "livekit_audio_stream_open_failed",
      });
    }
  }

  function attachTrackAudioListeners(track) {
    if (!track) return;

    for (const eventName of audioFrameEventNames) {
      addListener(track, eventName, (frame) => {
        void observeUserAudioFrame(frame);
      });
    }

    startAudioStreamForTrack(track);
  }

  function attachRoomListeners(targetRoom) {
    addListener(
      targetRoom,
      RoomEventEnum?.TrackSubscribed || "trackSubscribed",
      (track) => {
        attachTrackAudioListeners(track);
      }
    );

    for (const eventName of audioFrameEventNames) {
      addListener(targetRoom, eventName, (frame) => {
        void observeUserAudioFrame(frame);
      });
    }
  }

  async function detachAudioStreams() {
    const readers = audioStreamReaders;
    audioStreamReaders = [];

    await Promise.all(readers.map(async (entry) => {
      entry.cancelled = true;

      try {
        await entry.reader?.cancel?.();
      } catch {
        // Stream cleanup should not block bridge teardown.
      }

      try {
        await entry.stream?.cancel?.();
      } catch {
        // Stream cleanup should not block bridge teardown.
      }
    }));
  }

  async function start() {
    if (!config.enabled) {
      return setStatus({
        status: "disabled",
        lastReasonCode: "pionero_realtime_lane_disabled",
      });
    }

    if (config.provider !== "openai_realtime") {
      return setStatus({
        status: "blocked",
        lastReasonCode: "unsupported_realtime_provider",
      });
    }

    startedAtMs = nowMs(now);
    setStatus({
      enabled: true,
      status: "starting",
      lastReasonCode: "",
      errorMessage: "",
    });

    try {
      const token = await createAgentToken({
        env,
        roomName: safeRoomName,
      });

      room = new RoomClass();
      attachRoomListeners(room);
      await room.connect(token.url, token.token, {
        autoSubscribe: true,
      });

      publisher = createPublisher({
        channels: safeChannels,
        room,
        sampleRateHz: safeSampleRateHz,
      });
      await publisher.start();
      setStatus({
        livekitAudioTrackPublished: publisher.getStatus?.().published === true,
      });

      transport = createTransport({
        env,
        logger,
        model: config.model,
        sampleRateHz: safeSampleRateHz,
        voice: config.voice,
      });
      attachTransportHandlers();
      await transport.connect({
        instructions: buildRealtimeInstructions({
          baseInstructions,
          runtimeConfig,
          runtimeApplied,
        }),
      });

      setStatus({
        status: "live",
        realtimeConnected: true,
        livekitAudioTrackPublished: publisher.getStatus?.().published === true,
      });

      return getStatus();
    } catch (err) {
      logger?.error?.("pionero.openai_realtime_livekit_bridge.start_failed", {
        reasonCode: safeStatusText(err?.code, "pionero_realtime_bridge_start_failed"),
      });

      setStatus({
        status: "error",
        lastReasonCode: safeStatusText(
          err?.code,
          "pionero_realtime_bridge_start_failed"
        ),
        errorMessage: safeStatusText(err?.message || err, "Realtime bridge failed"),
      });

      return getStatus();
    }
  }

  async function stop() {
    cleanupListeners.forEach((cleanup) => {
      try {
        cleanup();
      } catch {
        // Listener cleanup should not block bridge teardown.
      }
    });
    cleanupListeners = [];

    await detachAudioStreams();
    await transport?.close?.();
    await publisher?.close?.();
    await room?.disconnect?.();
    room = null;
    transport = null;
    publisher = null;
    assistantSpeaking = false;
    currentResponseId = "";
    currentItemId = "";

    return setStatus({
      status: "stopped",
      realtimeConnected: false,
      livekitAudioTrackPublished: false,
      lastReasonCode: "pionero_realtime_bridge_stopped",
    });
  }

  return {
    getStatus,
    interruptAssistantOutput,
    observeUserAudioFrame,
    start,
    stop,
  };
}
