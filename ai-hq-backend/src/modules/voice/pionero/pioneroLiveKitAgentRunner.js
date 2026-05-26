import {
  buildPioneroLiveKitAgentPlan,
  createPioneroLiveKitAgentToken,
} from "./pioneroLiveKitAgent.js";
import {
  buildSonioxSpeechRuntimeConfig,
} from "../speech/providers/sonioxSpeechRuntimeConfig.js";
import {
  createSonioxSttSession,
} from "../speech/providers/sonioxSttSession.js";
import {
  createOpenAiTurnComposer,
} from "../llm/providers/openaiTurnComposer.js";
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
  "participantConnected",
  "participantDisconnected",
  "trackPublished",
  "trackUnpublished",
  "trackSubscribed",
  "trackUnsubscribed",
  "trackSubscriptionFailed",
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
const DEFAULT_STT_MAX_FRAMES = 120;
const DEFAULT_STT_FLUSH_MS = 2500;
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readBoundedInteger(value, fallback, { min = 1, max = 60_000 } = {}) {
  return clamp(n(value, fallback), min, max);
}

function isEnabled(value = "") {
  return ["1", "true"].includes(s(value).toLowerCase());
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
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

function compactDiagnosticLabel(value = "") {
  return s(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeTrackKindLabel(value = "") {
  const compact = compactDiagnosticLabel(value);

  if (compact.includes("audio")) return "audio";
  if (compact.includes("video")) return "video";

  return normalizePioneroTrackDiagnostic(value);
}

function normalizeTrackSourceLabel(value = "") {
  const compact = compactDiagnosticLabel(value);

  if (compact.includes("microphone") || compact === "mic") return "microphone";
  if (compact.includes("camera")) return "camera";
  if (compact.includes("screenshareaudio")) return "screen_share_audio";
  if (compact.includes("screenshare") || compact.includes("screen")) {
    return "screen_share";
  }
  if (compact === "audio") return "audio";

  return normalizePioneroTrackDiagnostic(value);
}

function readEnumDiagnostic(value, enumObject = null, normalizeLabel) {
  if (!enumObject || typeof enumObject !== "object") return "";

  const rawValue = s(value);

  for (const [key, enumValue] of Object.entries(enumObject)) {
    if (enumValue === value || s(enumValue) === rawValue) {
      const normalized = normalizeLabel(
        /^[0-9]+$/.test(key) ? enumValue : key
      );
      if (normalized) return normalized;
    }
  }

  return "";
}

function readDiagnosticOptions(options = {}) {
  return {
    TrackKind: options.TrackKind || options.trackKind || null,
    TrackSource: options.TrackSource || options.trackSource || null,
  };
}

function normalizeTrackKind(value = "", options = {}) {
  const diagnosticOptions = readDiagnosticOptions(options);
  const enumValue = readEnumDiagnostic(
    value,
    diagnosticOptions.TrackKind,
    normalizeTrackKindLabel
  );

  if (enumValue) return enumValue;

  if (typeof value === "number" || /^[0-9]+$/.test(s(value))) {
    const fallback = {
      1: "audio",
      2: "video",
    }[s(value)];

    return fallback || "";
  }

  return normalizeTrackKindLabel(value);
}

function normalizeTrackSource(value = "", options = {}) {
  const diagnosticOptions = readDiagnosticOptions(options);
  const enumValue = readEnumDiagnostic(
    value,
    diagnosticOptions.TrackSource,
    normalizeTrackSourceLabel
  );

  if (enumValue) return enumValue;

  if (typeof value === "number" || /^[0-9]+$/.test(s(value))) {
    const fallback = {
      1: "camera",
      2: "microphone",
      3: "screen_share",
      4: "screen_share_audio",
    }[s(value)];

    return fallback || "";
  }

  return normalizeTrackSourceLabel(value);
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

function isArrayBufferLike(value) {
  return value instanceof ArrayBuffer ||
    Object.prototype.toString.call(value) === "[object ArrayBuffer]";
}

function convertFloatSamplesToPcm16Buffer(samples) {
  const buffer = Buffer.alloc(samples.length * 2);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Number.isFinite(samples[index]) ? samples[index] : 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    const pcm = clamped < 0
      ? Math.round(clamped * 0x8000)
      : Math.round(clamped * 0x7fff);

    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, pcm)), index * 2);
  }

  return buffer;
}

export function normalizePioneroAudioFrameToPcmBuffer(frame, seen = new Set()) {
  if (frame === null || frame === undefined) return null;
  if (Buffer.isBuffer(frame)) return frame;
  if (typeof frame === "string") return null;

  if (isArrayBufferLike(frame)) {
    return Buffer.from(frame);
  }

  if (ArrayBuffer.isView(frame)) {
    if (frame instanceof Float32Array || frame instanceof Float64Array) {
      return convertFloatSamplesToPcm16Buffer(frame);
    }

    return Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength);
  }

  if (typeof frame !== "object") return null;
  if (seen.has(frame)) return null;
  seen.add(frame);

  for (const key of ["data", "audio", "audioFrame", "chunk", "frame"]) {
    const nested = frame[key];

    if (nested && nested !== frame) {
      const buffer = normalizePioneroAudioFrameToPcmBuffer(nested, seen);

      if (buffer) return buffer;
    }
  }

  return null;
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

  if (nested && nested !== frame) {
    return readFrameByteLength(nested);
  }

  const sampleCount = n(frame.samplesPerChannel) * n(
    frame.channels || frame.numChannels
  );

  if (sampleCount > 0) {
    return sampleCount * 2;
  }

  return 0;
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
    participantsObserved: n(input.participantsObserved),
    remoteParticipantsObserved: n(input.remoteParticipantsObserved),
    trackPublicationsObserved: n(input.trackPublicationsObserved),
    audioPublicationsObserved: n(input.audioPublicationsObserved),
    subscribedAudioTracksObserved: n(input.subscribedAudioTracksObserved),
    audioStreamsOpened: n(input.audioStreamsOpened),
    audioStreamFramesObserved: n(input.audioStreamFramesObserved),
    audioStreamReadErrors: n(input.audioStreamReadErrors),
    lastAudioStreamReasonCode: normalizePioneroAudioIngestEventName(
      input.lastAudioStreamReasonCode
    ) === "unknown_event"
      ? ""
      : normalizePioneroAudioIngestEventName(input.lastAudioStreamReasonCode),
    lastParticipantIdentity: normalizeSafeDiagnosticText(
      input.lastParticipantIdentity
    ),
    lastPublicationKind: normalizePioneroTrackDiagnostic(input.lastPublicationKind),
    lastPublicationSource: normalizePioneroTrackDiagnostic(input.lastPublicationSource),
    lastPublicationSubscribed: input.lastPublicationSubscribed === true,
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
    framesBuffered: n(input.framesBuffered),
    sttFramesDropped: n(input.sttFramesDropped),
    sttFrameNormalizeFailed: n(input.sttFrameNormalizeFailed),
    sttPcmBytesBuffered: n(input.sttPcmBytesBuffered),
    flushesAttempted: n(input.flushesAttempted),
    flushesSucceeded: n(input.flushesSucceeded),
    flushesFailed: n(input.flushesFailed),
    lastFlushReasonCode: normalizePioneroAudioIngestEventName(
      input.lastFlushReasonCode
    ) === "unknown_event"
      ? ""
      : normalizePioneroAudioIngestEventName(input.lastFlushReasonCode),
  };
}

function buildPioneroLlmState(input = {}) {
  const status = s(input.status, "idle");
  const provider = s(input.provider, "fast_text_llm") === "openai"
    ? "openai"
    : "fast_text_llm";

  return {
    provider,
    enabled: input.enabled === true,
    status: PIONERO_LLM_STATUSES.has(status) ? status : "idle",
    turnsPlanned: n(input.turnsPlanned),
    lastInputTranscript: s(input.lastInputTranscript || input.transcript).slice(0, 2_000),
    lastPlannedResponse: s(input.lastPlannedResponse || input.plannedResponse).slice(0, 2_000),
    lastObservedAt: s(input.lastObservedAt),
    reasonCode: s(input.reasonCode),
    networkIo: provider === "openai" && input.networkIo === true,
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
      participantsObserved: 0,
      remoteParticipantsObserved: 0,
      trackPublicationsObserved: 0,
      audioPublicationsObserved: 0,
      subscribedAudioTracksObserved: 0,
      audioStreamsOpened: 0,
      audioStreamFramesObserved: 0,
      audioStreamReadErrors: 0,
      lastAudioStreamReasonCode: "",
      lastParticipantIdentity: "",
      lastPublicationKind: "",
      lastPublicationSource: "",
      lastPublicationSubscribed: false,
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
      participantsObserved: 0,
      remoteParticipantsObserved: 0,
      trackPublicationsObserved: 0,
      audioPublicationsObserved: 0,
      subscribedAudioTracksObserved: 0,
      audioStreamsOpened: 0,
      audioStreamFramesObserved: 0,
      audioStreamReadErrors: 0,
      lastAudioStreamReasonCode: "",
      lastParticipantIdentity: "",
      lastPublicationKind: "",
      lastPublicationSource: "",
      lastPublicationSubscribed: false,
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
    participantsObserved: 0,
    remoteParticipantsObserved: 0,
    trackPublicationsObserved: 0,
    audioPublicationsObserved: 0,
    subscribedAudioTracksObserved: 0,
    audioStreamsOpened: 0,
    audioStreamFramesObserved: 0,
    audioStreamReadErrors: 0,
    lastAudioStreamReasonCode: "",
    lastParticipantIdentity: "",
    lastPublicationKind: "",
    lastPublicationSource: "",
    lastPublicationSubscribed: false,
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
    framesBuffered: 0,
    sttFramesDropped: 0,
    sttFrameNormalizeFailed: 0,
    sttPcmBytesBuffered: 0,
    flushesAttempted: 0,
    flushesSucceeded: 0,
    flushesFailed: 0,
    lastFlushReasonCode: "",
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

function isAudioTrack(track = {}, options = {}) {
  const kind = normalizeTrackKind(
    firstDefined(track.kind, track.mediaStreamTrack?.kind),
    options
  );
  const source = normalizeTrackSource(
    firstDefined(track.source, track.mediaStreamTrack?.source),
    options
  );

  return (
    kind === "audio" ||
    source === "microphone" ||
    source === "audio" ||
    source === "screen_share_audio"
  );
}

function readTrackDiagnosticCandidate(value = {}, options = {}) {
  const candidate = obj(value);

  if (!candidate || Object.keys(candidate).length === 0) return {};

  const nestedTrack = obj(candidate.track);
  const mediaStreamTrack = obj(candidate.mediaStreamTrack);
  const kind = normalizeTrackKind(
    firstDefined(
      candidate.kind,
      candidate.trackKind,
      candidate.type,
      mediaStreamTrack.kind,
      nestedTrack.kind,
      nestedTrack.mediaStreamTrack?.kind
    ),
    options
  );
  const source = normalizeTrackSource(
    firstDefined(
      candidate.source,
      candidate.trackSource,
      mediaStreamTrack.source,
      nestedTrack.source,
      nestedTrack.mediaStreamTrack?.source
    ),
    options
  );
  const looksLikeTrack = Boolean(
    kind ||
      source ||
      candidate.mediaStreamTrack ||
      candidate.track ||
      candidate.trackSid
  );

  return {
    looksLikeTrack,
    kind,
    source,
  };
}

function collectionValues(collection = null) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;

  if (typeof collection.values === "function") {
    try {
      return Array.from(collection.values());
    } catch {
      return [];
    }
  }

  if (typeof collection === "object") {
    return Object.values(collection);
  }

  return [];
}

function readParticipantDiagnosticCandidate(value = {}) {
  const candidate = obj(value);
  const identity = normalizeSafeDiagnosticText(
    candidate.identity ||
      candidate.name ||
      candidate.sid
  );

  return {
    looksLikeParticipant: Boolean(identity || candidate.trackPublications),
    identity,
  };
}

function readPublicationDiagnosticCandidate(value = {}, options = {}) {
  const candidate = obj(value);
  const nestedTrack = obj(candidate.track);
  const mediaStreamTrack = obj(candidate.mediaStreamTrack || nestedTrack.mediaStreamTrack);
  const kind = normalizeTrackKind(
    firstDefined(
      candidate.kind,
      candidate.trackKind,
      candidate.type,
      nestedTrack.kind,
      mediaStreamTrack.kind
    ),
    options
  );
  const source = normalizeTrackSource(
    firstDefined(
      candidate.source,
      candidate.trackSource,
      nestedTrack.source,
      mediaStreamTrack.source
    ),
    options
  );
  const subscribed = Boolean(
    candidate.subscribed === true ||
      candidate.isSubscribed === true ||
      candidate.trackSubscribed === true ||
      nestedTrack.subscribed === true ||
      nestedTrack.isSubscribed === true ||
      candidate.track
  );
  const looksLikePublication = Boolean(
    kind ||
      source ||
      candidate.track ||
      candidate.trackSid ||
      candidate.trackName ||
      candidate.isSubscribed !== undefined ||
      candidate.subscribed !== undefined
  );

  return {
    looksLikePublication,
    kind,
    source,
    subscribed,
  };
}

function isAudioPublicationDiagnostic(diagnostic = {}) {
  return (
    diagnostic.kind === "audio" ||
    diagnostic.source === "microphone" ||
    diagnostic.source === "audio" ||
    diagnostic.source === "screen_share_audio"
  );
}

function participantPublications(participant = {}) {
  const seen = new Set();
  const publications = [];

  [
    participant.trackPublications,
    participant.audioTrackPublications,
    participant.videoTrackPublications,
  ].forEach((collection) => {
    collectionValues(collection).forEach((publication) => {
      if (!publication || seen.has(publication)) return;
      seen.add(publication);
      publications.push(publication);
    });
  });

  return publications;
}

function readFrameCandidate(values = [], options = {}) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") return value;
    if (readTrackDiagnosticCandidate(value, options).looksLikeTrack) continue;
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
    roomEvent.ParticipantConnected,
    roomEvent.ParticipantDisconnected,
    roomEvent.TrackPublished,
    roomEvent.TrackUnpublished,
    roomEvent.TrackSubscribed,
    roomEvent.TrackUnsubscribed,
    roomEvent.TrackSubscriptionFailed,
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
      audioStreamFramesObserved: currentAudioIngest.audioStreamFramesObserved +
        (options.audioStreamFrame === true ? 1 : 0),
      lastAudioStreamReasonCode: options.audioStreamFrame === true
        ? "audio_stream_frame_observed"
        : currentAudioIngest.lastAudioStreamReasonCode,
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
  const eventNameKey = eventName.toLowerCase();
  const trackDiagnostics = readTrackDiagnosticCandidate(
    payload.track ||
      payload.publication ||
      payload.trackPublication ||
      payload.firstArg,
    options
  );
  const publicationDiagnostics = readPublicationDiagnosticCandidate(
    payload.publication ||
      payload.track ||
      payload.trackPublication ||
      payload.firstArg ||
      payload.secondArg,
    options
  );
  const participantCandidate = payload.participant ||
    payload.thirdArg ||
    payload.secondArg ||
    (
      eventNameKey.includes("participant")
        ? payload.firstArg
        : null
    );
  const participantDiagnostics = readParticipantDiagnosticCandidate(
    participantCandidate
  );
  const subscribedAudioPublication = Boolean(
    isAudioPublicationDiagnostic(publicationDiagnostics) &&
      (
        publicationDiagnostics.subscribed ||
        eventNameKey.includes("tracksubscribed")
      )
  );
  const nextTrackPublicationsObserved = currentAudioIngest.trackPublicationsObserved +
    (publicationDiagnostics.looksLikePublication ? 1 : 0);
  const nextAudioPublicationsObserved = currentAudioIngest.audioPublicationsObserved +
    (
      publicationDiagnostics.looksLikePublication &&
      isAudioPublicationDiagnostic(publicationDiagnostics)
        ? 1
        : 0
    );
  const nextSubscribedAudioTracksObserved =
    currentAudioIngest.subscribedAudioTracksObserved +
    (subscribedAudioPublication ? 1 : 0);

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
      trackPublicationsObserved: nextTrackPublicationsObserved,
      audioPublicationsObserved: nextAudioPublicationsObserved,
      subscribedAudioTracksObserved: nextSubscribedAudioTracksObserved,
      lastParticipantIdentity:
        participantDiagnostics.identity ||
        currentAudioIngest.lastParticipantIdentity,
      lastPublicationKind:
        publicationDiagnostics.kind ||
        currentAudioIngest.lastPublicationKind,
      lastPublicationSource:
        publicationDiagnostics.source ||
        currentAudioIngest.lastPublicationSource,
      lastPublicationSubscribed: publicationDiagnostics.looksLikePublication
        ? publicationDiagnostics.subscribed || eventNameKey.includes("tracksubscribed")
        : currentAudioIngest.lastPublicationSubscribed,
    },
  };
}

export function snapshotPioneroRoomParticipants(state = {}, room = null, options = {}) {
  const safeState = safeStateObject(state);
  const currentAudioIngest = buildPioneroAudioIngestState(safeState.audioIngest);
  const remoteParticipants = collectionValues(room?.remoteParticipants);
  const hasLocalParticipant = Boolean(room?.localParticipant);
  let trackPublicationsObserved = 0;
  let audioPublicationsObserved = 0;
  let subscribedAudioTracksObserved = 0;
  let lastParticipantIdentity = currentAudioIngest.lastParticipantIdentity;
  let lastPublicationKind = currentAudioIngest.lastPublicationKind;
  let lastPublicationSource = currentAudioIngest.lastPublicationSource;
  let lastPublicationSubscribed = currentAudioIngest.lastPublicationSubscribed;

  remoteParticipants.forEach((participant) => {
    const participantDiagnostics = readParticipantDiagnosticCandidate(participant);

    if (participantDiagnostics.identity) {
      lastParticipantIdentity = participantDiagnostics.identity;
    }

    participantPublications(participant).forEach((publication) => {
      const publicationDiagnostics = readPublicationDiagnosticCandidate(publication, options);

      if (!publicationDiagnostics.looksLikePublication) return;

      trackPublicationsObserved += 1;
      lastPublicationKind = publicationDiagnostics.kind || lastPublicationKind;
      lastPublicationSource = publicationDiagnostics.source || lastPublicationSource;
      lastPublicationSubscribed = publicationDiagnostics.subscribed;

      if (isAudioPublicationDiagnostic(publicationDiagnostics)) {
        audioPublicationsObserved += 1;

        if (publicationDiagnostics.subscribed) {
          subscribedAudioTracksObserved += 1;
        }
      }
    });
  });

  return {
    ...safeState,
    audioIngest: {
      ...currentAudioIngest,
      participantsObserved: Math.max(
        currentAudioIngest.participantsObserved,
        remoteParticipants.length + (hasLocalParticipant ? 1 : 0)
      ),
      remoteParticipantsObserved: Math.max(
        currentAudioIngest.remoteParticipantsObserved,
        remoteParticipants.length
      ),
      trackPublicationsObserved: Math.max(
        currentAudioIngest.trackPublicationsObserved,
        trackPublicationsObserved
      ),
      audioPublicationsObserved: Math.max(
        currentAudioIngest.audioPublicationsObserved,
        audioPublicationsObserved
      ),
      subscribedAudioTracksObserved: Math.max(
        currentAudioIngest.subscribedAudioTracksObserved,
        subscribedAudioTracksObserved
      ),
      lastParticipantIdentity,
      lastPublicationKind,
      lastPublicationSource,
      lastPublicationSubscribed,
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
      ...currentStt,
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
  const provider = s(payload.provider || currentLlm.provider, "fast_text_llm") === "openai"
    ? "openai"
    : "fast_text_llm";
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
      provider,
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
      networkIo: provider === "openai" && payload.networkIo === true,
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

export function createPioneroSonioxSttSessionFactory({
  env = process.env,
  now = null,
} = {}) {
  return async function pioneroSonioxSttSessionFactory(input = {}) {
    const sessionEnv = input.env || env;
    const runtimeConfig = buildSonioxSpeechRuntimeConfig({
      env: sessionEnv,
    });

    if (runtimeConfig.configured !== true) {
      return {
        ok: false,
        provider: "soniox",
        stage: "stt",
        configured: false,
        networkIo: false,
        reasonCode: "soniox_api_key_missing",
      };
    }

    return createSonioxSttSession({
      env: sessionEnv,
      runtimeConfig,
      now: input.now || now || undefined,
    });
  };
}

export function createPioneroLiveKitAgentRunner(input = {}) {
  const {
    AudioStream = null,
    AudioStreamClass = null,
    RoomEvent = null,
    RoomClass = null,
    TrackKind = null,
    TrackSource = null,
    audioIngestEventNames = [],
    createAgentToken = createPioneroLiveKitAgentToken,
    createLlmTurnComposer = null,
    createSttSession = null,
    env = process.env,
    logger = null,
    now = null,
    roomName = "",
    speechGatewayFactory = null,
    trackAudioEventNames = [],
  } = input;
  const AudioStreamCtor = AudioStreamClass || AudioStream;
  const diagnosticOptions = {
    TrackKind,
    TrackSource,
  };
  const llmEnabled = isEnabled(env.PIONERO_LIVEKIT_LLM_ENABLED);
  const sttEnabled = isEnabled(env.PIONERO_LIVEKIT_STT_ENABLED);
  const sttMaxFrames = readBoundedInteger(
    env.PIONERO_LIVEKIT_STT_MAX_FRAMES,
    DEFAULT_STT_MAX_FRAMES,
    { min: 1, max: 1_000 }
  );
  const sttFlushMs = readBoundedInteger(
    env.PIONERO_LIVEKIT_STT_FLUSH_MS,
    DEFAULT_STT_FLUSH_MS,
    { min: 1, max: 60_000 }
  );

  let room = null;
  let connected = false;
  let sttSession = null;
  let sttFrameBuffer = [];
  let sttFlushTimer = null;
  let sttFlushPromise = null;
  let llmTurnComposer = null;
  let llmTurnComposerResolved = false;
  let currentState = buildPioneroLiveKitAgentRunnerState({
    env,
    roomName,
    });
  let cleanupAudioIngestListeners = [];
  let audioStreamReaders = [];
  const audioStreamTrackRefs = new WeakSet();
  const audioStreamTrackKeys = new Set();

  function updateAudioIngestFrame(frame, options = {}) {
    currentState = recordPioneroAudioIngestFrame(currentState, frame, {
      now,
      ...options,
    });
    return currentState;
  }

  function updateAudioStreamCounters({
    openedDelta = 0,
    readErrorsDelta = 0,
    reasonCode = "",
  } = {}) {
    const currentAudioIngest = buildPioneroAudioIngestState(currentState.audioIngest);

    currentState = {
      ...safeStateObject(currentState),
      audioIngest: {
        ...currentAudioIngest,
        audioStreamsOpened: currentAudioIngest.audioStreamsOpened + n(openedDelta),
        audioStreamReadErrors:
          currentAudioIngest.audioStreamReadErrors + n(readErrorsDelta),
        lastAudioStreamReasonCode: reasonCode ||
          currentAudioIngest.lastAudioStreamReasonCode,
      },
    };

    return currentState;
  }

  function setSttState(nextStt = {}) {
    currentState = {
      ...safeStateObject(currentState),
      stt: buildPioneroSttState(nextStt),
    };

    return currentState;
  }

  function setLlmState(nextLlm = {}) {
    currentState = {
      ...safeStateObject(currentState),
      llm: buildPioneroLlmState(nextLlm),
    };

    return currentState;
  }

  function clearSttFlushTimer() {
    if (!sttFlushTimer) return;

    clearTimeout(sttFlushTimer);
    sttFlushTimer = null;
  }

  function readSttPcmBytesBuffered() {
    return sttFrameBuffer.reduce(
      (total, chunk) => total + n(chunk?.byteLength),
      0
    );
  }

  function updateBufferedSttState({
    status = "streaming",
    reasonCode = "stt_frames_buffered",
  } = {}) {
    const currentStt = buildPioneroSttState(currentState.stt);

    return setSttState({
      ...currentStt,
      enabled: true,
      status,
      reasonCode,
      framesBuffered: sttFrameBuffer.length,
      sttPcmBytesBuffered: readSttPcmBytesBuffered(),
    });
  }

  async function createOptionalSttSession() {
    if (!sttEnabled) return null;

    try {
      const session = createSttSession
        ? await createSttSession({
            env,
            logger,
            now,
            roomName,
          })
        : speechGatewayFactory
          ? await speechGatewayFactory({
            env,
            logger,
            now,
            roomName,
          })
          : await createPioneroSonioxSttSessionFactory({
            env,
            now,
          })({
            env,
            now,
            roomName,
          });

      if (!session || session.ok === false || session.configured === false) {
        setSttState({
          provider: "soniox",
          enabled: false,
          status: "error",
          reasonCode: s(session?.reasonCode, "stt_session_create_failed"),
          networkIo: session?.networkIo === true,
        });

        return null;
      }

      return session;
    } catch (err) {
      logger?.warn?.("pionero.livekit.agent_runner.stt_session_unavailable", {
        reasonCode: "stt_session_create_failed",
        error: null,
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

  async function callBufferedSttSession(audioChunks = []) {
    if (!sttSession) return null;

    if (typeof sttSession.transcribe === "function") {
      return sttSession.transcribe({
        audioChunks,
        finalize: true,
      });
    }

    if (typeof sttSession.transcribeAudioChunk === "function") {
      return sttSession.transcribeAudioChunk({
        audioChunks,
        finalize: true,
      });
    }

    return {
      ok: false,
      status: "failed",
      provider: "soniox",
      stage: "stt",
      networkIo: false,
      reasonCode: "stt_session_transcribe_not_supported",
    };
  }

  async function getLlmTurnComposer() {
    if (!llmEnabled) return null;
    if (llmTurnComposerResolved) return llmTurnComposer;

    llmTurnComposerResolved = true;

    try {
      const composer = createLlmTurnComposer
        ? await createLlmTurnComposer({
            env,
            logger,
            now,
            roomName,
          })
        : createOpenAiTurnComposer({
            env,
            now,
          });
      const reasonCode = s(
        composer?.reasonCode || composer?.config?.reasonCode,
        composer?.enabled === false
          ? "pionero_llm_disabled"
          : "openai_api_key_missing"
      );

      if (
        !composer ||
        composer.ok === false ||
        composer.configured === false ||
        composer.enabled === false
      ) {
        setLlmState({
          ...currentState.llm,
          provider: "openai",
          enabled: false,
          status: "error",
          reasonCode,
          networkIo: composer?.networkIo === true,
        });

        return null;
      }

      llmTurnComposer = composer;
      return llmTurnComposer;
    } catch {
      logger?.warn?.("pionero.livekit.agent_runner.llm_composer_unavailable", {
        reasonCode: "openai_llm_composer_unavailable",
        error: null,
      });
      setLlmState({
        ...currentState.llm,
        provider: "openai",
        enabled: false,
        status: "error",
        reasonCode: "openai_llm_composer_unavailable",
        networkIo: false,
      });

      return null;
    }
  }

  async function recordTranscriptTurnPlans(transcriptResult = {}) {
    if (isFailedTranscriptResult(transcriptResult)) return;

    const transcript = readTranscriptText(transcriptResult);

    if (!transcript) return;

    if (!llmEnabled) {
      currentState = recordPioneroLlmTurnPlan(currentState, {
        transcript,
        plannedResponse: obj(transcriptResult).plannedResponse,
      }, { now });

      currentState = recordPioneroTtsPlan(currentState, {
        text: currentState.llm?.lastPlannedResponse,
      }, { now });

      return;
    }

    const composer = await getLlmTurnComposer();

    if (!composer || typeof composer.composeTurn !== "function") return;

    let composeResult = null;

    try {
      composeResult = await composer.composeTurn({
        transcript,
        roomName,
      });
    } catch {
      composeResult = {
        ok: false,
        provider: "openai",
        networkIo: true,
        reasonCode: "openai_llm_response_failed",
      };
    }

    const responseText = s(
      composeResult?.responseText ||
        composeResult?.text ||
        composeResult?.plannedResponse
    ).slice(0, 2_000);

    if (composeResult?.ok === true && responseText) {
      currentState = recordPioneroLlmTurnPlan(currentState, {
        provider: "openai",
        transcript,
        responseText,
        plannedAt: composeResult.composedAt,
        networkIo: composeResult.networkIo === true,
      }, { now });

      currentState = recordPioneroTtsPlan(currentState, {
        text: currentState.llm?.lastPlannedResponse,
      }, { now });

      return;
    }

    setLlmState({
      ...currentState.llm,
      provider: "openai",
      enabled: true,
      status: "error",
      lastInputTranscript: transcript,
      reasonCode: s(composeResult?.reasonCode, "openai_llm_response_failed"),
      networkIo: composeResult?.networkIo === true,
    });
  }

  async function flushSttFrameBuffer(reasonCode = "stt_flush_interval") {
    if (sttFlushPromise) return sttFlushPromise;
    if (!sttSession || sttFrameBuffer.length === 0) return currentState;

    clearSttFlushTimer();

    sttFlushPromise = (async () => {
      const audioChunks = sttFrameBuffer;
      sttFrameBuffer = [];
      const startingStt = buildPioneroSttState(currentState.stt);

      setSttState({
        ...startingStt,
        enabled: true,
        status: "streaming",
        reasonCode: "",
        framesBuffered: 0,
        sttPcmBytesBuffered: 0,
        flushesAttempted: startingStt.flushesAttempted + 1,
        lastFlushReasonCode: reasonCode,
      });

      let transcriptResult = null;

      try {
        transcriptResult = await callBufferedSttSession(audioChunks);
        const failed = isFailedTranscriptResult(transcriptResult);

        currentState = recordPioneroSttTranscript(currentState, transcriptResult, {
          now,
        });

        const currentStt = buildPioneroSttState(currentState.stt);
        setSttState({
          ...currentStt,
          framesBuffered: sttFrameBuffer.length,
          sttPcmBytesBuffered: readSttPcmBytesBuffered(),
          flushesSucceeded: currentStt.flushesSucceeded + (failed ? 0 : 1),
          flushesFailed: currentStt.flushesFailed + (failed ? 1 : 0),
          lastFlushReasonCode: failed
            ? s(obj(transcriptResult).reasonCode, "stt_flush_failed")
            : reasonCode,
          reasonCode: failed
            ? s(obj(transcriptResult).reasonCode, "stt_flush_failed")
            : currentStt.reasonCode,
        });

        await recordTranscriptTurnPlans(transcriptResult);
      } catch (err) {
        logger?.warn?.("pionero.livekit.agent_runner.stt_flush_failed", {
          reasonCode: "stt_flush_failed",
          error: null,
        });
        const currentStt = buildPioneroSttState(currentState.stt);

        setSttState({
          ...currentStt,
          enabled: true,
          status: "error",
          framesBuffered: sttFrameBuffer.length,
          sttPcmBytesBuffered: readSttPcmBytesBuffered(),
          flushesFailed: currentStt.flushesFailed + 1,
          lastFlushReasonCode: "stt_flush_failed",
          reasonCode: "stt_flush_failed",
        });
      } finally {
        audioChunks.length = 0;
      }

      return currentState;
    })();

    try {
      return await sttFlushPromise;
    } finally {
      sttFlushPromise = null;

      if (connected && sttFrameBuffer.length > 0) {
        scheduleSttFlush();
      }
    }
  }

  function scheduleSttFlush() {
    if (!sttSession || sttFrameBuffer.length === 0 || sttFlushTimer) return;

    sttFlushTimer = setTimeout(() => {
      sttFlushTimer = null;
      void flushSttFrameBuffer("stt_flush_interval");
    }, sttFlushMs);
    sttFlushTimer?.unref?.();
  }

  function bufferSttFrame(frame) {
    if (!sttSession) return currentState;

    const pcmBuffer = normalizePioneroAudioFrameToPcmBuffer(frame);

    if (!pcmBuffer || pcmBuffer.byteLength <= 0) {
      const currentStt = buildPioneroSttState(currentState.stt);

      return setSttState({
        ...currentStt,
        enabled: true,
        status: currentStt.status === "idle" ? "waiting_for_audio" : currentStt.status,
        reasonCode: "stt_frame_pcm_normalize_failed",
        framesBuffered: sttFrameBuffer.length,
        sttFramesDropped: currentStt.sttFramesDropped + 1,
        sttFrameNormalizeFailed: currentStt.sttFrameNormalizeFailed + 1,
        sttPcmBytesBuffered: readSttPcmBytesBuffered(),
        lastFlushReasonCode: "stt_frame_pcm_normalize_failed",
      });
    }

    sttFrameBuffer.push(pcmBuffer);

    if (sttFrameBuffer.length > sttMaxFrames) {
      sttFrameBuffer.splice(0, sttFrameBuffer.length - sttMaxFrames);
    }

    updateBufferedSttState();
    scheduleSttFlush();

    return currentState;
  }

  async function observeAudioFrame(frame, options = {}) {
    updateAudioIngestFrame(frame, options);
    bufferSttFrame(frame);

    return currentState;
  }

  function addEventListener(target, eventName, handler) {
    if (!target || !eventName || typeof target.on !== "function") return;

    target.on(eventName, handler);
    cleanupAudioIngestListeners.push(() => {
      target.off?.(eventName, handler);
    });
  }

  function readAudioStreamTrackKey(track = {}) {
    return s(
      track.sid ||
        track.trackSid ||
        track.id ||
        track.name ||
        track.mediaStreamTrack?.id
    );
  }

  function hasAudioStreamForTrack(track = {}) {
    if (track && typeof track === "object") {
      if (audioStreamTrackRefs.has(track)) return true;

      const key = readAudioStreamTrackKey(track);
      return key ? audioStreamTrackKeys.has(key) : false;
    }

    const key = s(track);
    return key ? audioStreamTrackKeys.has(key) : true;
  }

  function markAudioStreamForTrack(track = {}) {
    if (track && typeof track === "object") {
      audioStreamTrackRefs.add(track);
      const key = readAudioStreamTrackKey(track);

      if (key) {
        audioStreamTrackKeys.add(key);
      }

      return;
    }

    const key = s(track);

    if (key) {
      audioStreamTrackKeys.add(key);
    }
  }

  async function readAudioStreamFrames(entry) {
    try {
      while (!entry.cancelled) {
        const result = await entry.reader.read();

        if (entry.cancelled) break;
        if (!result || result.done) break;

        const frame = result.value ?? result;

        if (frame !== undefined && frame !== null) {
          await observeAudioFrame(frame, { audioStreamFrame: true });
        }
      }
    } catch {
      if (!entry.cancelled) {
        updateAudioStreamCounters({
          readErrorsDelta: 1,
          reasonCode: "audio_stream_read_failed",
        });
        logger?.warn?.("pionero.livekit.agent_runner.audio_stream_read_failed", {
          reasonCode: "audio_stream_read_failed",
          error: null,
        });
      }
    }
  }

  function startAudioStreamForTrack(track = {}) {
    if (typeof AudioStreamCtor !== "function") return;
    if (!isAudioTrack(track, diagnosticOptions)) return;
    if (hasAudioStreamForTrack(track)) return;

    markAudioStreamForTrack(track);

    try {
      const stream = new AudioStreamCtor(track, {
        sampleRate: 16000,
        numChannels: 1,
        frameSizeMs: 20,
      });
      const reader = stream?.getReader?.();

      if (!reader || typeof reader.read !== "function") {
        updateAudioStreamCounters({
          readErrorsDelta: 1,
          reasonCode: "audio_stream_reader_unavailable",
        });
        stream?.cancel?.();
        return;
      }

      const entry = {
        cancelled: false,
        reader,
        stream,
      };

      audioStreamReaders.push(entry);
      updateAudioStreamCounters({
        openedDelta: 1,
        reasonCode: "audio_stream_opened",
      });
      entry.promise = readAudioStreamFrames(entry);
    } catch {
      updateAudioStreamCounters({
        readErrorsDelta: 1,
        reasonCode: "audio_stream_open_failed",
      });
      logger?.warn?.("pionero.livekit.agent_runner.audio_stream_open_failed", {
        reasonCode: "audio_stream_open_failed",
        error: null,
      });
    }
  }

  async function detachAudioStreamReaders() {
    const readers = audioStreamReaders;
    audioStreamReaders = [];

    await Promise.all(readers.map(async (entry) => {
      entry.cancelled = true;

      try {
        await entry.reader?.cancel?.();
      } catch {
        // Audio stream cleanup should not block runner teardown.
      }

      try {
        await entry.stream?.cancel?.();
      } catch {
        // Audio stream cleanup should not block runner teardown.
      }
    }));
  }

  function attachTrackAudioListeners(track) {
    if (!isAudioTrack(track, diagnosticOptions)) return;

    readTrackAudioEventNames({ trackAudioEventNames }).forEach((eventName) => {
      addEventListener(track, eventName, (...args) => {
        currentState = recordPioneroAudioIngestEvent(currentState, {
          eventName,
        }, diagnosticOptions);
        const frame = readFrameCandidate(args, diagnosticOptions);

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
          secondArg: args[1],
          thirdArg: args[2],
        }, diagnosticOptions);
        currentState = snapshotPioneroRoomParticipants(
          currentState,
          targetRoom,
          diagnosticOptions
        );
        attachTrackAudioListeners(args[0]);
        if (s(eventName).toLowerCase().includes("tracksubscribed")) {
          startAudioStreamForTrack(args[0]);
        }

        const frame = readFrameCandidate(args, diagnosticOptions);

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

        const tokenReasonCode = s(err?.code, "livekit_config_missing");

        logger?.warn?.("pionero.livekit.agent_runner.token_unavailable", {
          reasonCode: tokenReasonCode,
        });

        currentState = buildPioneroLiveKitAgentRunnerState({
          plan,
          status: "blocked",
          configured: false,
          networkIo: false,
          reasonCode: tokenReasonCode,
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
        const currentStt = buildPioneroSttState(currentState.stt);

        currentState = buildPioneroLiveKitAgentRunnerState({
          plan: currentState,
          status: "connected",
          networkIo: true,
          reasonCode: "",
          audioIngest: currentState.audioIngest,
          stt: {
            ...currentStt,
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
        error: null,
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
    await detachAudioStreamReaders();
    clearSttFlushTimer();
    await flushSttFrameBuffer("stt_final_flush");

    if (sttFrameBuffer.length > 0) {
      await flushSttFrameBuffer("stt_final_flush");
    }

    if (room && connected) {
      try {
        await room.disconnect?.();
      } catch (err) {
        logger?.warn?.("pionero.livekit.agent_runner.disconnect_failed", {
          reasonCode: "livekit_room_disconnect_failed",
          error: null,
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

  function snapshotDiagnostics() {
    currentState = snapshotPioneroRoomParticipants(
      currentState,
      room,
      diagnosticOptions
    );
    return currentState;
  }

  return {
    getState,
    snapshotDiagnostics,
    start,
    stop,
  };
}
