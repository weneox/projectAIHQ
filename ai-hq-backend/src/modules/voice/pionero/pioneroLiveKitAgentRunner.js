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
const PIONERO_STT_STATUSES = new Set([
  "idle",
  "waiting_for_audio",
  "streaming",
  "transcript_observed",
  "error",
]);
const PIONERO_LLM_STATUSES = new Set([
  "idle",
  "planned",
  "turn_plan_built",
  "error",
]);
const PIONERO_TTS_STATUSES = new Set([
  "idle",
  "planned",
  "speech_plan_built",
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
const SAFE_DIAGNOSTIC_TEXT_MAX_LENGTH = 96;
const UNSAFE_DIAGNOSTIC_TEXT_PATTERNS = [
  "token",
  "secret",
  "rawaudio",
  "audiobase64",
  "audiochunk",
  "apikey",
  "apisecret",
  "jwt",
];
const UNSAFE_RUNNER_STATE_KEYS = new Set([
  "api_secret",
  "api_key",
  "apikey",
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
  "secret",
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

function normalizeSafeDiagnosticText(
  value = "",
  {
    fallback = "",
    maxLength = SAFE_DIAGNOSTIC_TEXT_MAX_LENGTH,
    lower = false,
  } = {}
) {
  const cleaned = s(value, fallback)
    .replace(/[^a-zA-Z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLength);
  const normalized = lower ? cleaned.toLowerCase() : cleaned;
  const folded = normalized.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (
    UNSAFE_DIAGNOSTIC_TEXT_PATTERNS.some((pattern) =>
      folded.includes(pattern)
    )
  ) {
    return "[redacted]";
  }

  return normalized || fallback;
}

function normalizePioneroAudioIngestEventName(value = "") {
  return normalizeSafeDiagnosticText(value, {
    fallback: "unknown_event",
  });
}

function normalizePioneroTrackDiagnostic(value = "") {
  return normalizeSafeDiagnosticText(value, {
    fallback: "",
    maxLength: 48,
    lower: true,
  });
}

function buildPioneroAudioEventCounts(value = {}) {
  return Object.fromEntries(
    Object.entries(obj(value))
      .map(([eventName, count]) => [
        normalizePioneroAudioIngestEventName(eventName),
        n(count),
      ])
      .filter(([eventName, count]) => eventName && count > 0)
  );
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
    eventCounts: buildPioneroAudioEventCounts(input.eventCounts),
    lastEventName: normalizePioneroAudioIngestEventName(
      input.lastEventName
    ) === "unknown_event"
      ? ""
      : normalizePioneroAudioIngestEventName(input.lastEventName),
    lastTrackKind: normalizePioneroTrackDiagnostic(input.lastTrackKind),
    lastTrackSource: normalizePioneroTrackDiagnostic(input.lastTrackSource),
    tracksObserved: n(input.tracksObserved),
    framesObserved: n(input.framesObserved),
    bytesObserved: n(input.bytesObserved),
    lastObservedAt: s(input.lastObservedAt),
    reasonCode: s(input.reasonCode),
  };
}

function buildPioneroSttState(input = {}) {
  const status = s(input.status, "idle");

  return {
    provider: "soniox",
    enabled: input.enabled === true,
    status: PIONERO_STT_STATUSES.has(status) ? status : "idle",
    transcriptsObserved: n(input.transcriptsObserved),
    lastTranscript: s(input.lastTranscript).slice(0, 2_000),
    lastObservedAt: s(input.lastObservedAt),
    reasonCode: s(input.reasonCode),
    networkIo: input.networkIo === true,
  };
}

function buildPioneroLlmState(input = {}) {
  const status = s(input.status, "idle");

  return {
    provider: "fast_text_llm",
    enabled: input.enabled === true,
    status: PIONERO_LLM_STATUSES.has(status) ? status : "idle",
    turnsPlanned: n(input.turnsPlanned),
    lastInputTranscript: s(input.lastInputTranscript || input.transcript).slice(0, 2_000),
    lastPlannedResponse: s(input.lastPlannedResponse || input.plannedResponse).slice(0, 2_000),
    lastObservedAt: s(input.lastObservedAt),
    reasonCode: s(input.reasonCode),
    networkIo: false,
  };
}

function buildPioneroTtsState(input = {}) {
  const status = s(input.status, "idle");

  return {
    provider: "cartesia",
    enabled: input.enabled === true,
    status: PIONERO_TTS_STATUSES.has(status) ? status : "idle",
    speechPlansCreated: n(input.speechPlansCreated),
    lastInputText: s(input.lastInputText || input.inputText || input.text).slice(0, 2_000),
    lastAudioPlan: s(input.lastAudioPlan || input.audioPlan).slice(0, 2_000),
    lastObservedAt: s(input.lastObservedAt),
    reasonCode: s(input.reasonCode),
    networkIo: false,
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
      eventCounts: {},
      lastEventName: "",
      lastTrackKind: "",
      lastTrackSource: "",
      tracksObserved: 0,
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
      eventCounts: {},
      lastEventName: "",
      lastTrackKind: "",
      lastTrackSource: "",
      tracksObserved: 0,
      framesObserved: 0,
      bytesObserved: 0,
      lastObservedAt: "",
      reasonCode: s(reasonCode, "pionero_audio_ingest_error"),
    };
  }

  return {
    enabled: false,
    status: "idle",
    eventCounts: {},
    lastEventName: "",
    lastTrackKind: "",
    lastTrackSource: "",
    tracksObserved: 0,
    framesObserved: 0,
    bytesObserved: 0,
    lastObservedAt: "",
    reasonCode,
  };
}

function readInitialStt(input = {}) {
  if (input.stt) {
    return buildPioneroSttState(input.stt);
  }

  return {
    provider: "soniox",
    enabled: false,
    status: "idle",
    transcriptsObserved: 0,
    lastTranscript: "",
    lastObservedAt: "",
    reasonCode: "stt_session_not_started",
    networkIo: false,
  };
}

function readInitialLlm(input = {}, { status } = {}) {
  if (input.llm) {
    return buildPioneroLlmState(input.llm);
  }

  return {
    provider: "fast_text_llm",
    enabled: false,
    status: ["connected", "planned"].includes(status) ? "planned" : "idle",
    turnsPlanned: 0,
    lastInputTranscript: "",
    lastPlannedResponse: "",
    lastObservedAt: "",
    reasonCode: "llm_not_started",
    networkIo: false,
  };
}

function readInitialTts(input = {}, { status } = {}) {
  if (input.tts) return buildPioneroTtsState(input.tts);

  return {
    provider: "cartesia",
    enabled: false,
    status: ["connected", "planned"].includes(status) ? "planned" : "idle",
    speechPlansCreated: 0,
    lastInputText: "",
    lastAudioPlan: "",
    lastObservedAt: "",
    reasonCode: "tts_not_started",
    networkIo: false,
  };
}

function isAudioTrack(track = {}) {
  const kind = s(track.kind || track.mediaStreamTrack?.kind).toLowerCase();
  const source = s(track.source).toLowerCase();

  return kind === "audio" || source === "microphone" || source === "audio";
}

function readTrackDiagnosticCandidate(value = {}) {
  const candidate = obj(value);

  if (!candidate || Object.keys(candidate).length === 0) return {};

  const nestedTrack = obj(candidate.track);
  const mediaStreamTrack = obj(candidate.mediaStreamTrack);
  const kind = s(
    candidate.kind ||
      candidate.trackKind ||
      candidate.type ||
      mediaStreamTrack.kind ||
      nestedTrack.kind ||
      nestedTrack.mediaStreamTrack?.kind
  );
  const source = s(
    candidate.source ||
      candidate.trackSource ||
      mediaStreamTrack.source ||
      nestedTrack.source ||
      nestedTrack.mediaStreamTrack?.source
  );
  const looksLikeTrack = Boolean(
    kind ||
      source ||
      candidate.mediaStreamTrack ||
      candidate.track ||
      candidate.sid ||
      candidate.trackSid
  );

  return {
    looksLikeTrack,
    kind: normalizePioneroTrackDiagnostic(kind),
    source: normalizePioneroTrackDiagnostic(source),
  };
}

function readFrameCandidate(values = []) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") return value;
    if (readTrackDiagnosticCandidate(value).looksLikeTrack) continue;
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
      ...currentAudioIngest,
      enabled: true,
      status: "audio_observed",
      framesObserved: currentAudioIngest.framesObserved + 1,
      bytesObserved: currentAudioIngest.bytesObserved + bytesObserved,
      lastObservedAt: readNowISOString(options.now),
      reasonCode: "",
    },
  };
}

export function recordPioneroAudioIngestEvent(state = {}, input = {}, options = {}) {
  const safeState = safeStateObject(state);
  const currentAudioIngest = buildPioneroAudioIngestState(safeState.audioIngest);
  const payload = typeof input === "string" ? { eventName: input } : obj(input);
  const eventName = normalizePioneroAudioIngestEventName(
    payload.eventName || payload.name || options.eventName
  );
  const trackDiagnostics = readTrackDiagnosticCandidate(
    payload.track ||
      payload.publication ||
      payload.trackPublication ||
      payload.firstArg
  );

  return {
    ...safeState,
    audioIngest: {
      ...currentAudioIngest,
      eventCounts: {
        ...currentAudioIngest.eventCounts,
        [eventName]: n(currentAudioIngest.eventCounts[eventName]) + 1,
      },
      lastEventName: eventName,
      lastTrackKind: trackDiagnostics.kind || currentAudioIngest.lastTrackKind,
      lastTrackSource:
        trackDiagnostics.source || currentAudioIngest.lastTrackSource,
      tracksObserved: currentAudioIngest.tracksObserved +
        (trackDiagnostics.looksLikeTrack ? 1 : 0),
    },
  };
}

function readTranscriptText(transcriptResult = {}) {
  if (typeof transcriptResult === "string") {
    return s(transcriptResult).slice(0, 2_000);
  }

  const result = obj(transcriptResult);

  return s(
    result.text ||
      result.transcript ||
      result.finalTranscript ||
      result.interimText
  ).slice(0, 2_000);
}

function isFailedTranscriptResult(transcriptResult = {}) {
  const result = obj(transcriptResult);

  return (
    result.ok === false ||
    ["blocked", "failed", "error"].includes(s(result.status).toLowerCase())
  );
}

export function recordPioneroSttTranscript(state = {}, transcriptResult = {}, options = {}) {
  const safeState = safeStateObject(state);
  const currentStt = buildPioneroSttState(safeState.stt);
  const result = obj(transcriptResult);
  const transcript = readTranscriptText(transcriptResult);
  const reasonCode = s(result.reasonCode);

  if (isFailedTranscriptResult(transcriptResult)) {
    return {
      ...safeState,
      stt: {
        ...currentStt,
        enabled: currentStt.enabled,
        status: "error",
        reasonCode: s(reasonCode, "stt_transcript_failed"),
        networkIo: currentStt.networkIo || result.networkIo === true,
      },
    };
  }

  if (!transcript) {
    return {
      ...safeState,
      stt: {
        ...currentStt,
        enabled: true,
        status: "streaming",
        reasonCode: s(reasonCode),
        networkIo: currentStt.networkIo || result.networkIo === true,
      },
    };
  }

  return {
    ...safeState,
    stt: {
      provider: "soniox",
      enabled: true,
      status: "transcript_observed",
      transcriptsObserved: currentStt.transcriptsObserved + 1,
      lastTranscript: transcript,
      lastObservedAt: s(result.transcribedAt, readNowISOString(options.now)),
      reasonCode: "",
      networkIo: currentStt.networkIo || result.networkIo === true,
    },
  };
}

export function recordPioneroLlmTurnPlan(state = {}, input = {}, options = {}) {
  const safeState = safeStateObject(state);
  const currentLlm = buildPioneroLlmState(safeState.llm);
  const payload = typeof input === "string" ? { transcript: input } : obj(input);
  const transcript = s(
    payload.transcript ||
      payload.inputTranscript ||
      payload.lastInputTranscript
  ).slice(0, 2_000);

  if (!transcript) {
    return {
      ...safeState,
      llm: currentLlm,
    };
  }

  const plannedResponse = s(
    payload.plannedResponse ||
      payload.responseText ||
      payload.response ||
      "Turn plan pending real LLM."
  ).slice(0, 2_000);

  return {
    ...safeState,
    llm: {
      provider: "fast_text_llm",
      enabled: true,
      status: "turn_plan_built",
      turnsPlanned: currentLlm.turnsPlanned + 1,
      lastInputTranscript: transcript,
      lastPlannedResponse: plannedResponse || "Turn plan pending real LLM.",
      lastObservedAt: s(
        payload.plannedAt ||
          payload.observedAt ||
          payload.createdAt,
        readNowISOString(options.now)
      ),
      reasonCode: "",
      networkIo: false,
    },
  };
}

export function recordPioneroTtsPlan(state = {}, input = {}, options = {}) {
  const safeState = safeStateObject(state);
  const currentTts = buildPioneroTtsState(safeState.tts);
  const payload = typeof input === "string" ? { text: input } : obj(input);
  const inputText = s(
    payload.text ||
      payload.responseText ||
      payload.plannedResponse ||
      payload.lastPlannedResponse ||
      payload.inputText
  ).slice(0, 2_000);

  if (!inputText) {
    return {
      ...safeState,
      tts: currentTts,
    };
  }

  return {
    ...safeState,
    tts: {
      provider: "cartesia",
      enabled: true,
      status: "speech_plan_built",
      speechPlansCreated: currentTts.speechPlansCreated + 1,
      lastInputText: inputText,
      lastAudioPlan: s(
        payload.audioPlan || payload.plan || "TTS plan pending real synthesis."
      ).slice(0, 2_000),
      lastObservedAt: s(
        payload.plannedAt || payload.observedAt || payload.createdAt,
        readNowISOString(options.now)
      ),
      reasonCode: "",
      networkIo: false,
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
    stt: readInitialStt(input),
    llm: readInitialLlm(input, { status }),
    tts: readInitialTts(input, { status }),
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
    createSttSession = null,
    env = process.env,
    logger = null,
    now = null,
    roomName = "",
    speechGatewayFactory = null,
    trackAudioEventNames = [],
  } = input;

  let room = null;
  let connected = false;
  let sttSession = null;
  let currentState = buildPioneroLiveKitAgentRunnerState({
    env,
    roomName,
  });
  let cleanupAudioIngestListeners = [];

  function updateAudioIngestFrame(frame) {
    currentState = recordPioneroAudioIngestFrame(currentState, frame, { now });
    return currentState;
  }

  function setSttState(nextStt = {}) {
    currentState = {
      ...safeStateObject(currentState),
      stt: buildPioneroSttState(nextStt),
    };

    return currentState;
  }

  async function createOptionalSttSession() {
    if (!createSttSession && !speechGatewayFactory) return null;

    try {
      return createSttSession
        ? await createSttSession({
            env,
            logger,
            now,
            roomName,
          })
        : await speechGatewayFactory({
            env,
            logger,
            now,
            roomName,
          });
    } catch (err) {
      logger?.warn?.("pionero.livekit.agent_runner.stt_session_unavailable", {
        reasonCode: "stt_session_create_failed",
        error: s(err?.message || err),
      });
      setSttState({
        provider: "soniox",
        enabled: false,
        status: "error",
        reasonCode: "stt_session_create_failed",
        networkIo: false,
      });

      return null;
    }
  }

  async function callSttSession(frame) {
    if (!sttSession) return null;

    if (typeof sttSession.pushAudioFrame === "function") {
      return sttSession.pushAudioFrame(frame);
    }

    if (typeof sttSession.pushFrame === "function") {
      return sttSession.pushFrame(frame);
    }

    if (typeof sttSession.push === "function") {
      return sttSession.push(frame);
    }

    if (typeof sttSession.transcribeAudioChunk === "function") {
      return sttSession.transcribeAudioChunk({
        audioChunk: frame,
        finalize: false,
      });
    }

    if (typeof sttSession.transcribe === "function") {
      return sttSession.transcribe({
        audioChunks: [frame],
        finalize: false,
      });
    }

    return {
      ok: false,
      status: "failed",
      provider: "soniox",
      stage: "stt",
      networkIo: false,
      reasonCode: "stt_session_push_not_supported",
    };
  }

  async function observeAudioFrame(frame) {
    updateAudioIngestFrame(frame);

    if (!sttSession) {
      return currentState;
    }

    const currentStt = buildPioneroSttState(currentState.stt);
    setSttState({
      ...currentStt,
      enabled: true,
      status: "streaming",
      reasonCode: "",
    });

    try {
      const transcriptResult = await callSttSession(frame);
      currentState = recordPioneroSttTranscript(currentState, transcriptResult, { now });

      if (!isFailedTranscriptResult(transcriptResult)) {
        const transcript = readTranscriptText(transcriptResult);

        if (transcript) {
          currentState = recordPioneroLlmTurnPlan(currentState, {
            transcript,
            plannedResponse: obj(transcriptResult).plannedResponse,
          }, { now });

          currentState = recordPioneroTtsPlan(currentState, {
            text: currentState.llm?.lastPlannedResponse,
          }, { now });
        }
      }
    } catch (err) {
      logger?.warn?.("pionero.livekit.agent_runner.stt_frame_failed", {
        reasonCode: "stt_session_frame_failed",
        error: s(err?.message || err),
      });
      setSttState({
        ...currentStt,
        enabled: true,
        status: "error",
        reasonCode: "stt_session_frame_failed",
      });
    }

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
        currentState = recordPioneroAudioIngestEvent(currentState, {
          eventName,
        });
        const frame = readFrameCandidate(args);

        if (frame) {
          return observeAudioFrame(frame);
        }

        return undefined;
      });
    });
  }

  function attachRoomAudioIngestListeners(targetRoom) {
    readRoomAudioEventNames({
      RoomEvent,
      audioIngestEventNames,
    }).forEach((eventName) => {
      addEventListener(targetRoom, eventName, (...args) => {
        currentState = recordPioneroAudioIngestEvent(currentState, {
          eventName,
          firstArg: args[0],
        });
        attachTrackAudioListeners(args[0]);

        const frame = readFrameCandidate(args);

        if (frame) {
          return observeAudioFrame(frame);
        }

        return undefined;
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
      sttSession = await createOptionalSttSession();

      if (sttSession) {
        currentState = buildPioneroLiveKitAgentRunnerState({
          plan: currentState,
          status: "connected",
          networkIo: true,
          reasonCode: "",
          audioIngest: currentState.audioIngest,
          stt: {
            provider: "soniox",
            enabled: true,
            status: "waiting_for_audio",
            reasonCode: "",
            networkIo: false,
          },
          llm: currentState.llm,
          tts: currentState.tts,
        });
      }

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
        stt: {
          provider: "soniox",
          enabled: false,
          status: "idle",
          reasonCode: "stt_session_not_started",
          networkIo: false,
        },
        llm: {
          provider: "fast_text_llm",
          enabled: false,
          status: "idle",
          reasonCode: "llm_not_started",
          networkIo: false,
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
      stt: {
        ...currentState.stt,
        enabled: false,
        status: "idle",
        reasonCode: "pionero_agent_runner_stopped",
      },
      llm: {
        ...currentState.llm,
        enabled: false,
        status: "idle",
        reasonCode: "pionero_agent_runner_stopped",
        networkIo: false,
      },
      tts: {
        ...currentState.tts,
        enabled: false,
        status: "idle",
        reasonCode: "pionero_agent_runner_stopped",
        networkIo: false,
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
