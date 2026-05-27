import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, createLocalAudioTrack } from "livekit-client";

import {
  createPioneroLiveKitSession as defaultCreatePioneroLiveKitSession,
  getPioneroLiveKitAgentAudio as defaultGetPioneroLiveKitAgentAudio,
  getPioneroLiveKitAgentStatus as defaultGetPioneroLiveKitAgentStatus,
  startPioneroLiveKitAgentPlan as defaultStartPioneroLiveKitAgentPlan,
  stopPioneroLiveKitAgentPlan as defaultStopPioneroLiveKitAgentPlan,
} from "../../api/voice.js";

const PIONERO_LIVEKIT_ROOM_NAME = "pionero-browser-test";
const PIONERO_LIVEKIT_SESSION_REQUEST = {
  roomName: PIONERO_LIVEKIT_ROOM_NAME,
  mode: "pionero_realtime_agent",
  transport: "livekit",
  sttProvider: "soniox",
  llmProvider: "fast_text_llm",
  ttsProvider: "cartesia",
};
const PIONERO_MICROPHONE_PUBLISH_OPTIONS = {
  source: "microphone",
};
const PIONERO_BROWSER_AUDIO_OPTIONS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};
const SESSION_SECRET_KEYS = new Set([
  "accesstoken",
  "api_key",
  "apikey",
  "api_secret",
  "apisecret",
  "audiobase64",
  "audio_base64",
  "audiochunk",
  "audio_chunk",
  "clientsecret",
  "client_secret",
  "jwt",
  "rawaudio",
  "raw_audio",
  "token",
]);
const AUDIO_INGEST_STATUSES = new Set([
  "idle",
  "waiting_for_audio",
  "audio_observed",
  "error",
]);
const STT_STATUSES = new Set([
  "idle",
  "waiting_for_audio",
  "streaming",
  "transcript_observed",
  "error",
]);
const LLM_STATUSES = new Set([
  "idle",
  "planned",
  "turn_plan_built",
  "error",
]);
const TTS_STATUSES = new Set([
  "idle",
  "planned",
  "speech_plan_built",
  "synthesizing",
  "speech_synthesized",
  "error",
]);
const PIONERO_TTS_DEFAULT_SAMPLE_RATE_HZ = 24000;
const PIONERO_AGENT_AUDIO_RETRY_ATTEMPTS = 5;
const PIONERO_AGENT_AUDIO_RETRY_DELAY_MS = 400;
const PIONERO_AGENT_AUDIO_NOT_READY_REASON_CODE =
  "pionero_agent_tts_audio_not_found";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function n(value, fallback = 0) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return fallback;
  }

  return Math.floor(numberValue);
}

function isEnabledFlag(value = "") {
  return ["1", "true"].includes(s(value).toLowerCase());
}

function decodeBase64Audio(audioBase64 = "") {
  const binary = window.atob(s(audioBase64));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function buildPcm16WavBlob(bytes, sampleRateHz = PIONERO_TTS_DEFAULT_SAMPLE_RATE_HZ) {
  const dataLength = bytes.byteLength;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  const sampleRate = n(sampleRateHz, PIONERO_TTS_DEFAULT_SAMPLE_RATE_HZ);
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  return new Blob([header, bytes], { type: "audio/wav" });
}

function buildAgentAudioBlob(payload = {}) {
  const bytes = decodeBase64Audio(payload.audioBase64);
  const contentType = s(payload.mimeType || payload.contentType);
  const audioFormat = s(payload.audioFormat).toLowerCase();
  const normalizedContentType = contentType.toLowerCase();

  if (
    normalizedContentType.includes("wav") ||
    normalizedContentType.includes("wave")
  ) {
    return new Blob([bytes], {
      type: "audio/wav",
    });
  }

  if (
    audioFormat.includes("pcm_s16le") ||
    normalizedContentType.includes("pcm")
  ) {
    return buildPcm16WavBlob(bytes, payload.sampleRateHz);
  }

  return new Blob([bytes], {
    type: contentType || "audio/mpeg",
  });
}

function createObjectUrl(blob) {
  return window.URL?.createObjectURL?.(blob) || "";
}

function revokeObjectUrl(url = "") {
  if (!url) return;
  window.URL?.revokeObjectURL?.(url);
}

function waitForAgentAudioRetryDelay(
  delayMs = PIONERO_AGENT_AUDIO_RETRY_DELAY_MS
) {
  return new Promise((resolve) => {
    const timeout =
      typeof window !== "undefined" ? window.setTimeout : globalThis.setTimeout;
    timeout(resolve, delayMs);
  });
}

function readAgentAudioErrorCode(err = {}) {
  return s(
    err?.payload?.reasonCode ||
      err?.payload?.code ||
      err?.payload?.error ||
      err?.payload?.reason ||
      err?.reasonCode ||
      err?.code ||
      err?.message
  ).toLowerCase();
}

function isAgentAudioNotReadyError(err = {}) {
  const code = readAgentAudioErrorCode(err);
  const message = s(err?.message).toLowerCase();
  const status = Number(err?.status);

  return (
    (!Number.isFinite(status) || status === 404) &&
    (code === PIONERO_AGENT_AUDIO_NOT_READY_REASON_CODE ||
      message.includes(PIONERO_AGENT_AUDIO_NOT_READY_REASON_CODE))
  );
}

export function readPioneroMonitorOnlyMode() {
  const targetWindow = typeof window === "undefined" ? null : window;

  if (!targetWindow) return false;

  try {
    const params = new URLSearchParams(targetWindow.location?.search || "");

    if (isEnabledFlag(params.get("pioneroMonitor"))) {
      return true;
    }
  } catch {
    // Browser diagnostics should stay optional if URL APIs are unavailable.
  }

  try {
    return isEnabledFlag(
      targetWindow.localStorage?.getItem("PIONERO_LIVEKIT_MONITOR_ONLY")
    );
  } catch {
    return false;
  }
}

function redactSessionSecrets(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactSessionSecrets(item));

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SESSION_SECRET_KEYS.has(String(key).toLowerCase()))
      .map(([key, item]) => [key, redactSessionSecrets(item)])
  );
}

function readParticipantSnapshot(participant = {}) {
  return {
    identity: s(participant.identity),
    name: s(participant.name),
    sid: s(participant.sid),
  };
}

function readRoomParticipants(room) {
  const remoteParticipants = room?.remoteParticipants;

  if (!remoteParticipants || typeof remoteParticipants.values !== "function") {
    return [];
  }

  return Array.from(remoteParticipants.values()).map(readParticipantSnapshot);
}

async function publishPioneroMicrophone(targetRoom) {
  const localParticipant = targetRoom?.localParticipant;

  if (!localParticipant) {
    throw new Error("pionero_livekit_local_participant_missing");
  }

  if (typeof localParticipant.setMicrophoneEnabled === "function") {
    await localParticipant.setMicrophoneEnabled(true);
    return null;
  }

  const localMicTrack = await createLocalAudioTrack(PIONERO_BROWSER_AUDIO_OPTIONS);
  await localParticipant.publishTrack(
    localMicTrack,
    PIONERO_MICROPHONE_PUBLISH_OPTIONS
  );

  return localMicTrack;
}

function readAgentAudioIngestState(audioIngest = {}) {
  const payload = audioIngest && typeof audioIngest === "object" && !Array.isArray(audioIngest)
    ? audioIngest
    : {};
  const status = s(payload.status, "idle");

  return {
    agentAudioIngestStatus: AUDIO_INGEST_STATUSES.has(status) ? status : "idle",
    agentAudioFramesObserved: n(payload.framesObserved),
    agentAudioBytesObserved: n(payload.bytesObserved),
    agentAudioLastObservedAt: s(payload.lastObservedAt),
    agentAudioReasonCode: s(payload.reasonCode),
  };
}

function readAgentSttState(stt = {}) {
  const payload = stt && typeof stt === "object" && !Array.isArray(stt)
    ? stt
    : {};
  const status = s(payload.status, "idle");

  return {
    agentSttProvider: s(payload.provider, "soniox"),
    agentSttStatus: STT_STATUSES.has(status) ? status : "idle",
    agentSttEnabled: payload.enabled === true,
    agentSttNetworkIo: payload.networkIo === true,
    agentSttTranscriptsObserved: n(payload.transcriptsObserved),
    agentSttLastTranscript: s(payload.lastTranscript).slice(0, 2_000),
    agentSttLastObservedAt: s(payload.lastObservedAt),
    agentSttReasonCode: s(payload.reasonCode),
  };
}

function readAgentLlmState(llm = {}) {
  const payload = llm && typeof llm === "object" && !Array.isArray(llm)
    ? llm
    : {};
  const status = s(payload.status, "idle");

  return {
    agentLlmProvider: s(payload.provider, "fast_text_llm"),
    agentLlmStatus: LLM_STATUSES.has(status) ? status : "idle",
    agentLlmEnabled: payload.enabled === true,
    agentLlmNetworkIo: payload.networkIo === true,
    agentLlmTurnsPlanned: n(payload.turnsPlanned),
    agentLlmLastInputTranscript: s(payload.lastInputTranscript).slice(0, 2_000),
    agentLlmLastPlannedResponse: s(payload.lastPlannedResponse).slice(0, 2_000),
    agentLlmLastObservedAt: s(payload.lastObservedAt),
    agentLlmReasonCode: s(payload.reasonCode),
  };
}

function readAgentTtsState(tts = {}) {
  const payload = tts && typeof tts === "object" && !Array.isArray(tts)
    ? tts
    : {};
  const status = s(payload.status, "idle");

  return {
    agentTtsProvider: s(payload.provider, "cartesia"),
    agentTtsStatus: TTS_STATUSES.has(status) ? status : "idle",
    agentTtsEnabled: payload.enabled === true,
    agentTtsNetworkIo: payload.networkIo === true,
    agentTtsSpeechPlansCreated: n(payload.speechPlansCreated),
    agentTtsSynthesesAttempted: n(payload.synthesesAttempted),
    agentTtsSynthesesSucceeded: n(payload.synthesesSucceeded),
    agentTtsSynthesesFailed: n(payload.synthesesFailed),
    agentTtsAudioByteLength: n(payload.audioByteLength),
    agentTtsAudioChunkCount: n(payload.audioChunkCount),
    agentTtsLastInputText: s(payload.lastInputText).slice(0, 2_000),
    agentTtsLastAudioPlan: s(payload.lastAudioPlan).slice(0, 2_000),
    agentTtsLastObservedAt: s(payload.lastObservedAt),
    agentTtsReasonCode: s(payload.reasonCode),
  };
}

function readAgentState(result = {}) {
  const readiness = result?.readiness || {};
  const agentStatus = s(result?.status, "unknown");
  const agentReasonCode = s(
    result?.reasonCode || readiness?.reasonCode,
    agentStatus === "unknown" ? "pionero_agent_start_plan_unknown" : ""
  );

  return {
    agentStatus,
    agentReasonCode,
    agentNetworkIo: result?.networkIo === true,
    agentReady:
      result?.agentReady === true ||
      result?.agentParticipantReady === true ||
      readiness?.agentParticipantReady === true ||
      agentStatus === "connected",
    ...readAgentAudioIngestState(result?.audioIngest),
    ...readAgentSttState(result?.stt),
    ...readAgentLlmState(result?.llm),
    ...readAgentTtsState(result?.tts),
  };
}

function readMonitorOnlyAgentState() {
  return {
    agentStatus: "monitor_only",
    agentReasonCode: "pionero_monitor_only_browser_publish",
    agentNetworkIo: false,
    agentReady: false,
    agentAudioIngestStatus: "idle",
    agentAudioFramesObserved: 0,
    agentAudioBytesObserved: 0,
    agentAudioLastObservedAt: "",
    agentAudioReasonCode: "pionero_monitor_only_browser_publish",
    agentSttProvider: "soniox",
    agentSttStatus: "idle",
    agentSttEnabled: false,
    agentSttNetworkIo: false,
    agentSttTranscriptsObserved: 0,
    agentSttLastTranscript: "",
    agentSttLastObservedAt: "",
    agentSttReasonCode: "stt_session_not_started",
    agentLlmProvider: "fast_text_llm",
    agentLlmStatus: "planned",
    agentLlmEnabled: false,
    agentLlmNetworkIo: false,
    agentLlmTurnsPlanned: 0,
    agentLlmLastInputTranscript: "",
    agentLlmLastPlannedResponse: "",
    agentLlmLastObservedAt: "",
    agentLlmReasonCode: "llm_not_started",
    agentTtsProvider: "cartesia",
    agentTtsStatus: "planned",
    agentTtsEnabled: false,
    agentTtsNetworkIo: false,
    agentTtsSpeechPlansCreated: 0,
    agentTtsSynthesesAttempted: 0,
    agentTtsSynthesesSucceeded: 0,
    agentTtsSynthesesFailed: 0,
    agentTtsAudioByteLength: 0,
    agentTtsAudioChunkCount: 0,
    agentTtsLastInputText: "",
    agentTtsLastAudioPlan: "",
    agentTtsLastObservedAt: "",
    agentTtsReasonCode: "tts_not_started",
  };
}

function readErrorMessage(err, fallback = "pionero_livekit_failed", sensitiveValues = []) {
  let message = s(err?.message || err, fallback);

  sensitiveValues
    .map((value) => s(value))
    .filter(Boolean)
    .forEach((value) => {
      message = message.split(value).join("[redacted]");
    });

  return message;
}

export default function usePioneroLiveKitRoom({
  createPioneroLiveKitSession = defaultCreatePioneroLiveKitSession,
  getPioneroLiveKitAgentAudio = defaultGetPioneroLiveKitAgentAudio,
  getPioneroLiveKitAgentStatus = defaultGetPioneroLiveKitAgentStatus,
  startPioneroLiveKitAgentPlan = defaultStartPioneroLiveKitAgentPlan,
  stopPioneroLiveKitAgentPlan = defaultStopPioneroLiveKitAgentPlan,
} = {}) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [roomName, setRoomName] = useState("");
  const [identity, setIdentity] = useState("");
  const [participants, setParticipants] = useState([]);
  const [localMicEnabled, setLocalMicEnabled] = useState(false);
  const [agentStatus, setAgentStatus] = useState("idle");
  const [agentReasonCode, setAgentReasonCode] = useState("");
  const [agentNetworkIo, setAgentNetworkIo] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [agentAudioIngestStatus, setAgentAudioIngestStatus] = useState("idle");
  const [agentAudioFramesObserved, setAgentAudioFramesObserved] = useState(0);
  const [agentAudioBytesObserved, setAgentAudioBytesObserved] = useState(0);
  const [agentAudioLastObservedAt, setAgentAudioLastObservedAt] = useState("");
  const [agentAudioReasonCode, setAgentAudioReasonCode] = useState("");
  const [agentSttProvider, setAgentSttProvider] = useState("soniox");
  const [agentSttStatus, setAgentSttStatus] = useState("idle");
  const [agentSttEnabled, setAgentSttEnabled] = useState(false);
  const [agentSttNetworkIo, setAgentSttNetworkIo] = useState(false);
  const [agentSttTranscriptsObserved, setAgentSttTranscriptsObserved] = useState(0);
  const [agentSttLastTranscript, setAgentSttLastTranscript] = useState("");
  const [agentSttLastObservedAt, setAgentSttLastObservedAt] = useState("");
  const [agentSttReasonCode, setAgentSttReasonCode] = useState("");
  const [agentLlmProvider, setAgentLlmProvider] = useState("fast_text_llm");
  const [agentLlmStatus, setAgentLlmStatus] = useState("idle");
  const [agentLlmEnabled, setAgentLlmEnabled] = useState(false);
  const [agentLlmNetworkIo, setAgentLlmNetworkIo] = useState(false);
  const [agentLlmTurnsPlanned, setAgentLlmTurnsPlanned] = useState(0);
  const [agentLlmLastInputTranscript, setAgentLlmLastInputTranscript] = useState("");
  const [agentLlmLastPlannedResponse, setAgentLlmLastPlannedResponse] = useState("");
  const [agentLlmLastObservedAt, setAgentLlmLastObservedAt] = useState("");
  const [agentLlmReasonCode, setAgentLlmReasonCode] = useState("");
  const [agentTtsProvider, setAgentTtsProvider] = useState("cartesia");
  const [agentTtsStatus, setAgentTtsStatus] = useState("idle");
  const [agentTtsEnabled, setAgentTtsEnabled] = useState(false);
  const [agentTtsNetworkIo, setAgentTtsNetworkIo] = useState(false);
  const [agentTtsSpeechPlansCreated, setAgentTtsSpeechPlansCreated] = useState(0);
  const [agentTtsSynthesesAttempted, setAgentTtsSynthesesAttempted] = useState(0);
  const [agentTtsSynthesesSucceeded, setAgentTtsSynthesesSucceeded] = useState(0);
  const [agentTtsSynthesesFailed, setAgentTtsSynthesesFailed] = useState(0);
  const [agentTtsAudioByteLength, setAgentTtsAudioByteLength] = useState(0);
  const [agentTtsAudioChunkCount, setAgentTtsAudioChunkCount] = useState(0);
  const [agentTtsLastInputText, setAgentTtsLastInputText] = useState("");
  const [agentTtsLastAudioPlan, setAgentTtsLastAudioPlan] = useState("");
  const [agentTtsLastObservedAt, setAgentTtsLastObservedAt] = useState("");
  const [agentTtsReasonCode, setAgentTtsReasonCode] = useState("");
  const [agentAudioPlaybackStatus, setAgentAudioPlaybackStatus] = useState("idle");
  const [agentAudioPlaybackReasonCode, setAgentAudioPlaybackReasonCode] = useState("");
  const [agentAudioPlaybackAudioId, setAgentAudioPlaybackAudioId] = useState("");
  const [agentAudioPlaybackByteLength, setAgentAudioPlaybackByteLength] = useState(0);
  const [agentAudioPlaybackSynthesizedAt, setAgentAudioPlaybackSynthesizedAt] = useState("");
  const [monitorOnlyMode, setMonitorOnlyMode] = useState(() =>
    readPioneroMonitorOnlyMode()
  );

  const localMicTrackRef = useRef(null);
  const runtimeRoomNameRef = useRef("");
  const shouldStopAgentRuntimeRef = useRef(false);
  const mountedRef = useRef(false);
  const roomListenersRef = useRef(null);
  const roomRef = useRef(null);
  const statusRef = useRef("idle");
  const agentAudioElementRef = useRef(null);
  const agentAudioObjectUrlRef = useRef("");
  const agentAudioRetryGenerationRef = useRef(0);
  const activeAgentAudioSynthesesSucceededRef = useRef(0);
  const lastAutoplayTtsSynthesesSucceededRef = useRef(0);
  const lastPlayedAgentAudioIdRef = useRef("");
  const lastPlayedTtsSynthesesSucceededRef = useRef(0);
  const pendingAgentAudioPayloadRef = useRef(null);

  const setSafeStatus = useCallback((nextStatus) => {
    statusRef.current = nextStatus;

    if (mountedRef.current) {
      setStatus(nextStatus);
    }
  }, []);

  const setSafeParticipants = useCallback((targetRoom = roomRef.current) => {
    const nextParticipants = readRoomParticipants(targetRoom);

    if (mountedRef.current) {
      setParticipants(nextParticipants);
    }

    return nextParticipants;
  }, []);

  const isAgentAudioRetryActive = useCallback((request = {}) => {
    const targetRoomName = s(request.roomName);
    const generation = Number(request.generation);
    const currentRoomName = s(runtimeRoomNameRef.current || roomName);

    return (
      mountedRef.current &&
      targetRoomName &&
      targetRoomName === currentRoomName &&
      generation === agentAudioRetryGenerationRef.current &&
      !["idle", "stopping"].includes(statusRef.current)
    );
  }, [roomName]);

  const setSafeAgentState = useCallback((nextAgentState = {}) => {
    if (!mountedRef.current) return;

    setAgentStatus(s(nextAgentState.agentStatus, "idle"));
    setAgentReasonCode(s(nextAgentState.agentReasonCode));
    setAgentNetworkIo(nextAgentState.agentNetworkIo === true);
    setAgentReady(nextAgentState.agentReady === true);
    setAgentAudioIngestStatus(s(nextAgentState.agentAudioIngestStatus, "idle"));
    setAgentAudioFramesObserved(n(nextAgentState.agentAudioFramesObserved));
    setAgentAudioBytesObserved(n(nextAgentState.agentAudioBytesObserved));
    setAgentAudioLastObservedAt(s(nextAgentState.agentAudioLastObservedAt));
    setAgentAudioReasonCode(s(nextAgentState.agentAudioReasonCode));
    setAgentSttProvider(s(nextAgentState.agentSttProvider, "soniox"));
    setAgentSttStatus(s(nextAgentState.agentSttStatus, "idle"));
    setAgentSttEnabled(nextAgentState.agentSttEnabled === true);
    setAgentSttNetworkIo(nextAgentState.agentSttNetworkIo === true);
    setAgentSttTranscriptsObserved(n(nextAgentState.agentSttTranscriptsObserved));
    setAgentSttLastTranscript(s(nextAgentState.agentSttLastTranscript).slice(0, 2_000));
    setAgentSttLastObservedAt(s(nextAgentState.agentSttLastObservedAt));
    setAgentSttReasonCode(s(nextAgentState.agentSttReasonCode));
    setAgentLlmProvider(s(nextAgentState.agentLlmProvider, "fast_text_llm"));
    setAgentLlmStatus(s(nextAgentState.agentLlmStatus, "idle"));
    setAgentLlmEnabled(nextAgentState.agentLlmEnabled === true);
    setAgentLlmNetworkIo(nextAgentState.agentLlmNetworkIo === true);
    setAgentLlmTurnsPlanned(n(nextAgentState.agentLlmTurnsPlanned));
    setAgentLlmLastInputTranscript(
      s(nextAgentState.agentLlmLastInputTranscript).slice(0, 2_000)
    );
    setAgentLlmLastPlannedResponse(
      s(nextAgentState.agentLlmLastPlannedResponse).slice(0, 2_000)
    );
    setAgentLlmLastObservedAt(s(nextAgentState.agentLlmLastObservedAt));
    setAgentLlmReasonCode(s(nextAgentState.agentLlmReasonCode));
    setAgentTtsProvider(s(nextAgentState.agentTtsProvider, "cartesia"));
    setAgentTtsStatus(s(nextAgentState.agentTtsStatus, "idle"));
    setAgentTtsEnabled(nextAgentState.agentTtsEnabled === true);
    setAgentTtsNetworkIo(nextAgentState.agentTtsNetworkIo === true);
    setAgentTtsSpeechPlansCreated(n(nextAgentState.agentTtsSpeechPlansCreated));
    setAgentTtsSynthesesAttempted(n(nextAgentState.agentTtsSynthesesAttempted));
    setAgentTtsSynthesesSucceeded(n(nextAgentState.agentTtsSynthesesSucceeded));
    setAgentTtsSynthesesFailed(n(nextAgentState.agentTtsSynthesesFailed));
    setAgentTtsAudioByteLength(n(nextAgentState.agentTtsAudioByteLength));
    setAgentTtsAudioChunkCount(n(nextAgentState.agentTtsAudioChunkCount));
    setAgentTtsLastInputText(
      s(nextAgentState.agentTtsLastInputText).slice(0, 2_000)
    );
    setAgentTtsLastAudioPlan(
      s(nextAgentState.agentTtsLastAudioPlan).slice(0, 2_000)
    );
    setAgentTtsLastObservedAt(s(nextAgentState.agentTtsLastObservedAt));
    setAgentTtsReasonCode(s(nextAgentState.agentTtsReasonCode));
  }, []);

  const clearAgentAudioPlayback = useCallback(() => {
    agentAudioRetryGenerationRef.current += 1;
    activeAgentAudioSynthesesSucceededRef.current = 0;
    pendingAgentAudioPayloadRef.current = null;
    lastAutoplayTtsSynthesesSucceededRef.current = 0;
    lastPlayedAgentAudioIdRef.current = "";
    lastPlayedTtsSynthesesSucceededRef.current = 0;
    agentAudioElementRef.current?.pause?.();
    revokeObjectUrl(agentAudioObjectUrlRef.current);
    agentAudioObjectUrlRef.current = "";

    if (agentAudioElementRef.current) {
      agentAudioElementRef.current.src = "";
    }

    if (mountedRef.current) {
      setAgentAudioPlaybackStatus("idle");
      setAgentAudioPlaybackReasonCode("");
      setAgentAudioPlaybackAudioId("");
      setAgentAudioPlaybackByteLength(0);
      setAgentAudioPlaybackSynthesizedAt("");
    }
  }, []);

  const playAgentAudioPayload = useCallback(async (
    payload = {},
    { synthesesSucceeded = 0 } = {}
  ) => {
    const audioId = s(payload.audioId);
    const normalizedSynthesesSucceeded = n(synthesesSucceeded);

    if (
      (audioId && audioId === lastPlayedAgentAudioIdRef.current) ||
      (
        normalizedSynthesesSucceeded > 0 &&
        normalizedSynthesesSucceeded <= lastPlayedTtsSynthesesSucceededRef.current
      )
    ) {
      return {
        ok: true,
        status: "played",
        skipped: true,
      };
    }

    const audioBase64 = s(payload.audioBase64);

    if (!audioBase64) {
      if (mountedRef.current) {
        setAgentAudioPlaybackStatus("error");
        setAgentAudioPlaybackReasonCode("pionero_agent_audio_missing");
      }

      return {
        ok: false,
        status: "error",
      };
    }

    if (mountedRef.current) {
      setAgentAudioPlaybackStatus("loading");
      setAgentAudioPlaybackReasonCode("");
      setAgentAudioPlaybackAudioId(audioId);
      setAgentAudioPlaybackByteLength(n(payload.audioByteLength));
      setAgentAudioPlaybackSynthesizedAt(s(payload.synthesizedAt));
    }

    try {
      const blob = buildAgentAudioBlob(payload);
      const objectUrl = createObjectUrl(blob);

      if (!objectUrl) {
        throw new Error("pionero_agent_audio_url_failed");
      }

      let audio = agentAudioElementRef.current;

      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        audio.onended = () => {
          if (mountedRef.current) {
            setAgentAudioPlaybackStatus("played");
          }
        };
        audio.onerror = () => {
          if (mountedRef.current) {
            setAgentAudioPlaybackStatus("error");
            setAgentAudioPlaybackReasonCode("pionero_agent_audio_playback_failed");
          }
        };
        agentAudioElementRef.current = audio;
      }

      revokeObjectUrl(agentAudioObjectUrlRef.current);
      agentAudioObjectUrlRef.current = objectUrl;
      audio.src = objectUrl;
      pendingAgentAudioPayloadRef.current = payload;

      await audio.play();
      pendingAgentAudioPayloadRef.current = null;
      lastPlayedAgentAudioIdRef.current = audioId;
      lastPlayedTtsSynthesesSucceededRef.current = Math.max(
        lastPlayedTtsSynthesesSucceededRef.current,
        normalizedSynthesesSucceeded
      );

      if (mountedRef.current) {
        setAgentAudioPlaybackStatus("played");
        setAgentAudioPlaybackReasonCode("");
      }

      return {
        ok: true,
        status: "played",
      };
    } catch (err) {
      pendingAgentAudioPayloadRef.current = payload;

      if (mountedRef.current) {
        setAgentAudioPlaybackStatus("blocked");
        setAgentAudioPlaybackReasonCode(
          readErrorMessage(err, "pionero_agent_audio_autoplay_blocked")
        );
      }

      return {
        ok: false,
        status: "blocked",
      };
    }
  }, []);

  const fetchAndPlayAgentAudio = useCallback(async (
    targetRoomName = "",
    {
      generation = agentAudioRetryGenerationRef.current,
      retryAttempts = PIONERO_AGENT_AUDIO_RETRY_ATTEMPTS,
      retryDelayMs = PIONERO_AGENT_AUDIO_RETRY_DELAY_MS,
      synthesesSucceeded = 0,
    } = {}
  ) => {
    const nextRoomName = s(targetRoomName || runtimeRoomNameRef.current || roomName);
    const normalizedRetryAttempts = Math.max(1, n(retryAttempts, 1));
    const normalizedRetryDelayMs = Math.max(0, n(retryDelayMs, 0));
    const normalizedSynthesesSucceeded = n(synthesesSucceeded);

    if (!nextRoomName) {
      return {
        ok: false,
        status: "idle",
      };
    }

    if (mountedRef.current) {
      setAgentAudioPlaybackStatus("loading");
      setAgentAudioPlaybackReasonCode("");
    }

    for (let attempt = 1; attempt <= normalizedRetryAttempts; attempt += 1) {
      if (!isAgentAudioRetryActive({ roomName: nextRoomName, generation })) {
        return {
          ok: false,
          status: "cancelled",
        };
      }

      try {
        const audioPayload = await getPioneroLiveKitAgentAudio({
          roomName: nextRoomName,
        });

        if (!isAgentAudioRetryActive({ roomName: nextRoomName, generation })) {
          return {
            ok: false,
            status: "cancelled",
          };
        }

        return playAgentAudioPayload(audioPayload, {
          synthesesSucceeded: normalizedSynthesesSucceeded,
        });
      } catch (err) {
        if (!isAgentAudioRetryActive({ roomName: nextRoomName, generation })) {
          return {
            ok: false,
            status: "cancelled",
          };
        }

        const audioNotReady = isAgentAudioNotReadyError(err);

        if (audioNotReady && attempt < normalizedRetryAttempts) {
          if (mountedRef.current) {
            setAgentAudioPlaybackStatus("loading");
            setAgentAudioPlaybackReasonCode(
              PIONERO_AGENT_AUDIO_NOT_READY_REASON_CODE
            );
          }

          await waitForAgentAudioRetryDelay(normalizedRetryDelayMs);
          continue;
        }

        if (mountedRef.current) {
          setAgentAudioPlaybackStatus("error");
          setAgentAudioPlaybackReasonCode(
            readErrorMessage(
              err,
              audioNotReady
                ? PIONERO_AGENT_AUDIO_NOT_READY_REASON_CODE
                : "pionero_agent_audio_fetch_failed"
            )
          );
        }

        return {
          ok: false,
          status: "error",
        };
      }
    }

    return {
      ok: false,
      status: "error",
    };
  }, [
    getPioneroLiveKitAgentAudio,
    isAgentAudioRetryActive,
    playAgentAudioPayload,
    roomName,
  ]);

  const maybeFetchAndPlayAgentAudio = useCallback(async (
    nextRoomName = "",
    nextAgentState = {}
  ) => {
    const synthesesSucceeded = n(nextAgentState.agentTtsSynthesesSucceeded);

    if (
      !s(nextRoomName) ||
      synthesesSucceeded <= 0 ||
      synthesesSucceeded <= lastAutoplayTtsSynthesesSucceededRef.current
    ) {
      return {
        ok: false,
        status: "idle",
      };
    }

    agentAudioRetryGenerationRef.current += 1;
    activeAgentAudioSynthesesSucceededRef.current = synthesesSucceeded;
    lastAutoplayTtsSynthesesSucceededRef.current = synthesesSucceeded;

    try {
      return await fetchAndPlayAgentAudio(nextRoomName, {
        generation: agentAudioRetryGenerationRef.current,
        synthesesSucceeded,
      });
    } finally {
      if (activeAgentAudioSynthesesSucceededRef.current === synthesesSucceeded) {
        activeAgentAudioSynthesesSucceededRef.current = 0;
      }
    }
  }, [fetchAndPlayAgentAudio]);

  const playLatestAgentAudio = useCallback(async () => {
    if (pendingAgentAudioPayloadRef.current) {
      return playAgentAudioPayload(pendingAgentAudioPayloadRef.current);
    }

    agentAudioRetryGenerationRef.current += 1;

    return fetchAndPlayAgentAudio(runtimeRoomNameRef.current || roomName, {
      generation: agentAudioRetryGenerationRef.current,
    });
  }, [fetchAndPlayAgentAudio, playAgentAudioPayload, roomName]);

  const clearAgentState = useCallback(() => {
    clearAgentAudioPlayback();
    setSafeAgentState({
      agentStatus: "idle",
      agentReasonCode: "",
      agentNetworkIo: false,
      agentReady: false,
      agentAudioIngestStatus: "idle",
      agentAudioFramesObserved: 0,
      agentAudioBytesObserved: 0,
      agentAudioLastObservedAt: "",
      agentAudioReasonCode: "",
      agentSttProvider: "soniox",
      agentSttStatus: "idle",
      agentSttEnabled: false,
      agentSttNetworkIo: false,
      agentSttTranscriptsObserved: 0,
      agentSttLastTranscript: "",
      agentSttLastObservedAt: "",
      agentSttReasonCode: "",
      agentLlmProvider: "fast_text_llm",
      agentLlmStatus: "idle",
      agentLlmEnabled: false,
      agentLlmNetworkIo: false,
      agentLlmTurnsPlanned: 0,
      agentLlmLastInputTranscript: "",
      agentLlmLastPlannedResponse: "",
      agentLlmLastObservedAt: "",
      agentLlmReasonCode: "",
      agentTtsProvider: "cartesia",
      agentTtsStatus: "idle",
      agentTtsEnabled: false,
      agentTtsNetworkIo: false,
      agentTtsSpeechPlansCreated: 0,
      agentTtsSynthesesAttempted: 0,
      agentTtsSynthesesSucceeded: 0,
      agentTtsSynthesesFailed: 0,
      agentTtsAudioByteLength: 0,
      agentTtsAudioChunkCount: 0,
      agentTtsLastInputText: "",
      agentTtsLastAudioPlan: "",
      agentTtsLastObservedAt: "",
      agentTtsReasonCode: "",
    });
  }, [clearAgentAudioPlayback, setSafeAgentState]);

  const refreshAgentStatus = useCallback(async () => {
    const nextRoomName = s(runtimeRoomNameRef.current || roomName);

    if (!nextRoomName) {
      return {
        ok: false,
        status: "idle",
      };
    }

    try {
      const agentState = await getPioneroLiveKitAgentStatus({
        roomName: nextRoomName,
      });
      const nextAgentState = readAgentState(agentState);
      setSafeAgentState(nextAgentState);
      void maybeFetchAndPlayAgentAudio(nextRoomName, nextAgentState);

      return {
        ok: true,
        status: s(agentState?.status, "unknown"),
      };
    } catch (err) {
      setSafeAgentState({
        agentStatus: "warning",
        agentReasonCode: readErrorMessage(err, "pionero_agent_status_failed"),
        agentNetworkIo: false,
        agentReady: false,
      });

      return {
        ok: false,
        status: "warning",
      };
    }
  }, [
    getPioneroLiveKitAgentStatus,
    maybeFetchAndPlayAgentAudio,
    roomName,
    setSafeAgentState,
  ]);

  const detachRoomListeners = useCallback(() => {
    const listeners = roomListenersRef.current;

    if (!listeners?.room) {
      roomListenersRef.current = null;
      return;
    }

    listeners.room.off?.(
      RoomEvent.ParticipantConnected,
      listeners.handleParticipantChanged
    );
    listeners.room.off?.(
      RoomEvent.ParticipantDisconnected,
      listeners.handleParticipantChanged
    );
    roomListenersRef.current = null;
  }, []);

  const disconnect = useCallback(async ({ updateState = true } = {}) => {
    const room = roomRef.current;
    const localMicTrack = localMicTrackRef.current;
    const runtimeRoomName = s(runtimeRoomNameRef.current);

    if (updateState && (room || localMicTrack)) {
      setSafeStatus("stopping");
    }

    detachRoomListeners();
    roomRef.current = null;
    localMicTrackRef.current = null;

    try {
      await room?.localParticipant?.setMicrophoneEnabled?.(false);
    } catch {
      // Ignore microphone disable failures during teardown.
    }

    try {
      await room?.disconnect?.();
    } catch {
      // Cleanup should continue even if the SDK is already disconnected.
    }

    try {
      localMicTrack?.stop?.();
    } catch {
      // Ignore local track stop failures during teardown.
    }

    clearAgentAudioPlayback();

    if (
      updateState &&
      runtimeRoomName &&
      shouldStopAgentRuntimeRef.current
    ) {
      try {
        await stopPioneroLiveKitAgentPlan({
          roomName: runtimeRoomName,
        });
      } catch {
        // Runtime stop is best-effort; local teardown must still finish.
      }
    }

    runtimeRoomNameRef.current = "";
    shouldStopAgentRuntimeRef.current = false;

    if (updateState && mountedRef.current) {
      setError("");
      setSession(null);
      setRoomName("");
      setIdentity("");
      setParticipants([]);
      setLocalMicEnabled(false);
      clearAgentState();
      setSafeStatus("idle");
    } else {
      statusRef.current = "idle";
    }
  }, [
    clearAgentAudioPlayback,
    clearAgentState,
    detachRoomListeners,
    setSafeStatus,
    stopPioneroLiveKitAgentPlan,
  ]);

  const connect = useCallback(async () => {
    if (!["idle", "error"].includes(statusRef.current)) {
      return {
        ok: statusRef.current === "live",
        status: statusRef.current,
      };
    }

    let sensitiveToken = "";

    shouldStopAgentRuntimeRef.current = false;
    setSafeStatus("creating");

    if (mountedRef.current) {
      setError("");
      setSession(null);
      setRoomName("");
      setIdentity("");
      setParticipants([]);
      setLocalMicEnabled(false);
      clearAgentState();
    }

    try {
      const result = await createPioneroLiveKitSession(PIONERO_LIVEKIT_SESSION_REQUEST);
      const url = s(result?.url);
      const token = s(result?.token);
      sensitiveToken = token;

      if (!url || !token) {
        throw new Error("pionero_livekit_token_missing");
      }

      const safeSession = redactSessionSecrets(result);
      const nextRoomName = s(safeSession?.roomName || PIONERO_LIVEKIT_ROOM_NAME);
      const nextIdentity = s(safeSession?.identity);
      runtimeRoomNameRef.current = nextRoomName;

      const preStartMonitorOnlyMode = readPioneroMonitorOnlyMode();

      if (mountedRef.current) {
        setMonitorOnlyMode(preStartMonitorOnlyMode);
      }

      if (!preStartMonitorOnlyMode) {
        try {
          shouldStopAgentRuntimeRef.current = true;
          const agentPlan = await startPioneroLiveKitAgentPlan({
            roomName: nextRoomName,
          });
          const nextAgentState = readAgentState(agentPlan);
          setSafeAgentState(nextAgentState);
          void maybeFetchAndPlayAgentAudio(nextRoomName, nextAgentState);
        } catch (agentErr) {
          setSafeAgentState({
            agentStatus: "warning",
            agentReasonCode: readErrorMessage(
              agentErr,
              "pionero_agent_prestart_failed",
              [sensitiveToken]
            ),
            agentNetworkIo: false,
            agentReady: false,
            agentAudioIngestStatus: "error",
            agentAudioReasonCode: "pionero_agent_prestart_failed",
          });
        }
      }

      const nextRoom = new Room();
      const handleParticipantChanged = () => setSafeParticipants(nextRoom);

      nextRoom.on(RoomEvent.ParticipantConnected, handleParticipantChanged);
      nextRoom.on(RoomEvent.ParticipantDisconnected, handleParticipantChanged);
      roomListenersRef.current = {
        room: nextRoom,
        handleParticipantChanged,
      };
      roomRef.current = nextRoom;

      if (mountedRef.current) {
        setSession(safeSession);
        setRoomName(nextRoomName);
        setIdentity(nextIdentity);
      }

      setSafeStatus("connecting");
      await nextRoom.connect(url, token);
      setSafeParticipants(nextRoom);

      setSafeStatus("publishing_microphone");
      const localMicTrack = await publishPioneroMicrophone(nextRoom);
      localMicTrackRef.current = localMicTrack;

      if (mountedRef.current) {
        setLocalMicEnabled(true);
      }

      setSafeStatus("live");

      const nextMonitorOnlyMode = readPioneroMonitorOnlyMode();

      if (mountedRef.current) {
        setMonitorOnlyMode(nextMonitorOnlyMode);
      }

      if (nextMonitorOnlyMode) {
        setSafeAgentState(readMonitorOnlyAgentState());

        return {
          ok: true,
          status: "live",
        };
      }

      try {
        shouldStopAgentRuntimeRef.current = true;
        const agentPlan = await startPioneroLiveKitAgentPlan({
          roomName: nextRoomName,
        });
        const nextAgentState = readAgentState(agentPlan);
        setSafeAgentState(nextAgentState);
        void maybeFetchAndPlayAgentAudio(nextRoomName, nextAgentState);
      } catch (agentErr) {
        setSafeAgentState({
          agentStatus: "warning",
          agentReasonCode: readErrorMessage(
            agentErr,
            "pionero_agent_start_plan_failed",
            [sensitiveToken]
          ),
          agentNetworkIo: false,
          agentReady: false,
          agentAudioIngestStatus: "error",
          agentAudioFramesObserved: 0,
          agentAudioBytesObserved: 0,
          agentAudioLastObservedAt: "",
          agentAudioReasonCode: "pionero_agent_start_plan_failed",
          agentSttProvider: "soniox",
          agentSttStatus: "error",
          agentSttEnabled: false,
          agentSttNetworkIo: false,
          agentSttTranscriptsObserved: 0,
          agentSttLastTranscript: "",
          agentSttLastObservedAt: "",
          agentSttReasonCode: "pionero_agent_start_plan_failed",
          agentLlmProvider: "fast_text_llm",
          agentLlmStatus: "error",
          agentLlmEnabled: false,
          agentLlmNetworkIo: false,
          agentLlmTurnsPlanned: 0,
          agentLlmLastInputTranscript: "",
          agentLlmLastPlannedResponse: "",
          agentLlmLastObservedAt: "",
          agentLlmReasonCode: "pionero_agent_start_plan_failed",
          agentTtsProvider: "cartesia",
          agentTtsStatus: "error",
          agentTtsEnabled: false,
          agentTtsNetworkIo: false,
          agentTtsSpeechPlansCreated: 0,
          agentTtsLastInputText: "",
          agentTtsLastAudioPlan: "",
          agentTtsLastObservedAt: "",
          agentTtsReasonCode: "pionero_agent_start_plan_failed",
        });
      }

      return {
        ok: true,
        status: "live",
      };
    } catch (err) {
      await disconnect({ updateState: false });

      if (mountedRef.current) {
        setSession(null);
        setRoomName("");
        setIdentity("");
        setParticipants([]);
        setLocalMicEnabled(false);
        clearAgentState();
        setError(readErrorMessage(err, "pionero_livekit_failed", [sensitiveToken]));
      }

      setSafeStatus("error");

      return {
        ok: false,
        status: "error",
      };
    }
  }, [
    clearAgentState,
    createPioneroLiveKitSession,
    disconnect,
    maybeFetchAndPlayAgentAudio,
    setSafeParticipants,
    setSafeAgentState,
    setSafeStatus,
    startPioneroLiveKitAgentPlan,
  ]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      void disconnect({ updateState: false });
    };
  }, [disconnect]);

  return {
    status,
    error,
    session,
    roomName,
    identity,
    participants,
    connect,
    disconnect,
    playLatestAgentAudio,
    refreshAgentStatus,
    localMicEnabled,
    monitorOnlyMode,
    agentStatus,
    agentReasonCode,
    agentNetworkIo,
    agentReady,
    agentAudioIngestStatus,
    agentAudioFramesObserved,
    agentAudioBytesObserved,
    agentAudioLastObservedAt,
    agentAudioReasonCode,
    agentSttProvider,
    agentSttStatus,
    agentSttEnabled,
    agentSttNetworkIo,
    agentSttTranscriptsObserved,
    agentSttLastTranscript,
    agentSttLastObservedAt,
    agentSttReasonCode,
    agentLlmProvider,
    agentLlmStatus,
    agentLlmEnabled,
    agentLlmNetworkIo,
    agentLlmTurnsPlanned,
    agentLlmLastInputTranscript,
    agentLlmLastPlannedResponse,
    agentLlmLastObservedAt,
    agentLlmReasonCode,
    agentTtsProvider,
    agentTtsStatus,
    agentTtsEnabled,
    agentTtsNetworkIo,
    agentTtsSpeechPlansCreated,
    agentTtsSynthesesAttempted,
    agentTtsSynthesesSucceeded,
    agentTtsSynthesesFailed,
    agentTtsAudioByteLength,
    agentTtsAudioChunkCount,
    agentTtsLastInputText,
    agentTtsLastAudioPlan,
    agentTtsLastObservedAt,
    agentTtsReasonCode,
    agentAudioPlaybackStatus,
    agentAudioPlaybackReasonCode,
    agentAudioPlaybackAudioId,
    agentAudioPlaybackByteLength,
    agentAudioPlaybackSynthesizedAt,
  };
}
