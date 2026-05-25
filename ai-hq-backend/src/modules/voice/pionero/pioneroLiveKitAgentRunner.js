import {
  buildPioneroLiveKitAgentPlan,
  createPioneroLiveKitAgentToken,
} from "./pioneroLiveKitAgent.js";
import { s } from "../shared.js";

export const PIONERO_LIVEKIT_AGENT_RUNNER_VERSION = "pionero_livekit_agent_runner.v1";
const PIONERO_AUDIO_INGEST_STATUSES = new Set([
  "idle",
  "waiting_for_audio",
  "audio_observed",
  "error",
]);
const DEFAULT_ROOM_AUDIO_EVENT_NAMES = [
  "trackSubscribed",
  "audioFrame",
  "audioChunk",
  "audioData",
];
const DEFAULT_TRACK_AUDIO_EVENT_NAMES = [
  "audioFrame",
  "audioChunk",
  "audioData",
  "data",
];
const UNSAFE_RUNNER_STATE_KEYS = new Set([
  "api_secret",
  "apisecret",
  "audio",
  "audiobase64",
  "audiochunk",
  "audioframe",
  "chunk",
  "data",
  "frame",
  "rawaudio",
  "rawaudiobytes",
  "token",
]);

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeStateObject(value = {}) {
  return Object.fromEntries(
    Object.entries(obj(value)).filter(
      ([key]) => !UNSAFE_RUNNER_STATE_KEYS.has(String(key).toLowerCase())
    )
  );
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function uniq(values = []) {
  return Array.from(new Set(values.map((value) => s(value)).filter(Boolean)));
}

function n(value, fallback = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }

  return Math.floor(numericValue);
}

function readNowISOString(now = null) {
  const value = typeof now === "function" ? now() : new Date();
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function readFrameByteLength(frame) {
  if (frame === null || frame === undefined) return 0;

  if (typeof frame === "string") {
    return Buffer.byteLength(frame);
  }

  if (typeof frame.byteLength === "number") {
    return n(frame.byteLength);
  }

  if (ArrayBuffer.isView(frame) && typeof frame.byteLength === "number") {
    return n(frame.byteLength);
  }

  if (frame instanceof ArrayBuffer) {
    return n(frame.byteLength);
  }

  if (typeof frame.length === "number") {
    return n(frame.length);
  }

  const nested = frame.data || frame.audio || frame.audioFrame || frame.chunk || frame.frame;

  return nested && nested !== frame ? readFrameByteLength(nested) : 0;
}

function buildPioneroAudioIngestState(input = {}) {
  const status = s(input.status, "idle");

  return {
    enabled: input.enabled === true,
    status: PIONERO_AUDIO_INGEST_STATUSES.has(status) ? status : "idle",
    framesObserved: n(input.framesObserved),
    bytesObserved: n(input.bytesObserved),
    lastObservedAt: s(input.lastObservedAt),
    reasonCode: s(input.reasonCode),
  };
}

function buildSafePlan(input = {}) {
  const plan = obj(input.plan);

  return plan.version
    ? plan
    : buildPioneroLiveKitAgentPlan({
        roomName: input.roomName,
        env: input.env,
      });
}

function readInitialAudioIngest(input = {}, { status, reasonCode } = {}) {
  const requested = buildPioneroAudioIngestState(input.audioIngest);

  if (input.audioIngest) {
    return requested;
  }

  if (status === "connected") {
    return {
      enabled: true,
      status: "waiting_for_audio",
      framesObserved: 0,
      bytesObserved: 0,
      lastObservedAt: "",
      reasonCode: "",
    };
  }

  if (status === "error") {
    return {
      enabled: false,
      status: "error",
      framesObserved: 0,
      bytesObserved: 0,
      lastObservedAt: "",
      reasonCode: s(reasonCode, "pionero_audio_ingest_error"),
    };
  }

  return {
    enabled: false,
    status: "idle",
    framesObserved: 0,
    bytesObserved: 0,
    lastObservedAt: "",
    reasonCode,
  };
}

function isAudioTrack(track = {}) {
  const kind = s(track.kind || track.mediaStreamTrack?.kind).toLowerCase();
  const source = s(track.source).toLowerCase();

  return kind === "audio" || source === "microphone" || source === "audio";
}

function readFrameCandidate(values = []) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") return value;
    if (typeof value?.byteLength === "number") return value;
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;

    const nested = value.data || value.audio || value.audioFrame || value.chunk || value.frame;
    if (nested) return nested;
  }

  return null;
}

function readRoomAudioEventNames(input = {}) {
  const roomEvent = obj(input.RoomEvent || input.roomEvent);

  return uniq([
    roomEvent.TrackSubscribed,
    roomEvent.AudioFrame,
    ...DEFAULT_ROOM_AUDIO_EVENT_NAMES,
    ...array(input.audioIngestEventNames),
  ]);
}

function readTrackAudioEventNames(input = {}) {
  return uniq([
    ...DEFAULT_TRACK_AUDIO_EVENT_NAMES,
    ...array(input.trackAudioEventNames),
  ]);
}

export function recordPioneroAudioIngestFrame(state = {}, frame = null, options = {}) {
  const safeState = safeStateObject(state);
  const currentAudioIngest = buildPioneroAudioIngestState(safeState.audioIngest);
  const bytesObserved = readFrameByteLength(frame);

  return {
    ...safeState,
    audioIngest: {
      enabled: true,
      status: "audio_observed",
      framesObserved: currentAudioIngest.framesObserved + 1,
      bytesObserved: currentAudioIngest.bytesObserved + bytesObserved,
      lastObservedAt: readNowISOString(options.now),
      reasonCode: "",
    },
  };
}

export function buildPioneroLiveKitAgentRunnerState(input = {}) {
  const plan = buildSafePlan(input);
  const tokenResult = obj(input.tokenResult);
  const status = s(input.status, "idle") || "idle";
  const reasonCode = s(input.reasonCode);

  return {
    version: PIONERO_LIVEKIT_AGENT_RUNNER_VERSION,
    provider: "livekit",
    configured: input.configured === false
      ? false
      : tokenResult.token
        ? true
        : plan.configured === true,
    status,
    networkIo: input.networkIo === true,
    reasonCode,
    url: s(tokenResult.url || plan.url),
    roomName: s(tokenResult.roomName || plan.roomName),
    agentIdentity: s(tokenResult.agentIdentity || plan.agentIdentity),
    agentName: s(tokenResult.agentName || plan.agentName),
    pipeline: obj(plan.pipeline),
    audioIngest: readInitialAudioIngest(input, { status, reasonCode }),
    readiness: {
      ...obj(plan.readiness),
      agentParticipantReady: status === "connected",
      reasonCode: status === "connected"
        ? ""
        : s(
            input.readinessReasonCode ||
              plan.readiness?.reasonCode ||
              reasonCode
          ),
    },
  };
}

export function createPioneroLiveKitAgentRunner(input = {}) {
  const {
    RoomEvent = null,
    RoomClass = null,
    audioIngestEventNames = [],
    createAgentToken = createPioneroLiveKitAgentToken,
    env = process.env,
    logger = null,
    now = null,
    roomName = "",
    trackAudioEventNames = [],
  } = input;

  let room = null;
  let connected = false;
  let currentState = buildPioneroLiveKitAgentRunnerState({
    env,
    roomName,
  });
  let cleanupAudioIngestListeners = [];

  function updateAudioIngestFrame(frame) {
    currentState = recordPioneroAudioIngestFrame(currentState, frame, { now });
    return currentState;
  }

  function addEventListener(target, eventName, handler) {
    if (!target || !eventName || typeof target.on !== "function") return;

    target.on(eventName, handler);
    cleanupAudioIngestListeners.push(() => {
      target.off?.(eventName, handler);
    });
  }

  function attachTrackAudioListeners(track) {
    if (!isAudioTrack(track)) return;

    readTrackAudioEventNames({ trackAudioEventNames }).forEach((eventName) => {
      addEventListener(track, eventName, (...args) => {
        const frame = readFrameCandidate(args);

        if (frame) {
          updateAudioIngestFrame(frame);
        }
      });
    });
  }

  function attachRoomAudioIngestListeners(targetRoom) {
    readRoomAudioEventNames({
      RoomEvent,
      audioIngestEventNames,
    }).forEach((eventName) => {
      addEventListener(targetRoom, eventName, (...args) => {
        attachTrackAudioListeners(args[0]);

        const frame = readFrameCandidate(args);

        if (frame) {
          updateAudioIngestFrame(frame);
        }
      });
    });
  }

  function detachAudioIngestListeners() {
    cleanupAudioIngestListeners.forEach((cleanup) => {
      try {
        cleanup();
      } catch {
        // Listener cleanup should not block runner teardown.
      }
    });
    cleanupAudioIngestListeners = [];
  }

  async function start() {
    let tokenResult = null;

    try {
      tokenResult = await createAgentToken({
        roomName,
        env,
      });
    } catch (err) {
      const plan = obj(err?.plan).version
        ? err.plan
        : buildPioneroLiveKitAgentPlan({ roomName, env });

      logger?.warn?.("pionero.livekit.agent_runner.token_unavailable", {
        reasonCode: s(err?.code || err?.message, "livekit_config_missing"),
      });

      currentState = buildPioneroLiveKitAgentRunnerState({
        plan,
        status: "blocked",
        configured: false,
        networkIo: false,
        reasonCode: s(err?.code || err?.message, "livekit_config_missing"),
      });

      return currentState;
    }

    if (!RoomClass) {
      currentState = buildPioneroLiveKitAgentRunnerState({
        env,
        roomName,
        tokenResult,
        status: "planned",
        networkIo: false,
        reasonCode: "livekit_room_client_not_configured",
      });

      return currentState;
    }

    try {
      room = new RoomClass();
      await room.connect(tokenResult.url, tokenResult.token);
      connected = true;

      currentState = buildPioneroLiveKitAgentRunnerState({
        env,
        roomName,
        tokenResult,
        status: "connected",
        networkIo: true,
        reasonCode: "",
      });
      attachRoomAudioIngestListeners(room);

      return currentState;
    } catch (err) {
      logger?.error?.("pionero.livekit.agent_runner.connect_failed", {
        reasonCode: "livekit_room_connect_failed",
        error: s(err?.message || err),
      });

      currentState = buildPioneroLiveKitAgentRunnerState({
        env,
        roomName,
        tokenResult,
        status: "error",
        networkIo: true,
        reasonCode: "livekit_room_connect_failed",
        audioIngest: {
          enabled: false,
          status: "error",
          reasonCode: "livekit_room_connect_failed",
        },
      });

      return currentState;
    }
  }

  async function stop() {
    detachAudioIngestListeners();

    if (room && connected) {
      try {
        await room.disconnect?.();
      } catch (err) {
        logger?.warn?.("pionero.livekit.agent_runner.disconnect_failed", {
          reasonCode: "livekit_room_disconnect_failed",
          error: s(err?.message || err),
        });
      }
    }

    room = null;
    connected = false;
    currentState = buildPioneroLiveKitAgentRunnerState({
      plan: currentState,
      status: "stopped",
      networkIo: false,
      reasonCode: "",
      audioIngest: {
        ...currentState.audioIngest,
        enabled: false,
        status: "idle",
        reasonCode: "pionero_agent_runner_stopped",
      },
    });

    return currentState;
  }

  function getState() {
    return currentState;
  }

  return {
    getState,
    start,
    stop,
  };
}
