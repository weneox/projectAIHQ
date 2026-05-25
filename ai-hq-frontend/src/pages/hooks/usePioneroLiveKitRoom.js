import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, createLocalAudioTrack } from "livekit-client";

import {
  createPioneroLiveKitSession as defaultCreatePioneroLiveKitSession,
  startPioneroLiveKitAgentPlan as defaultStartPioneroLiveKitAgentPlan,
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
const SESSION_SECRET_KEYS = new Set([
  "accesstoken",
  "clientsecret",
  "client_secret",
  "jwt",
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
  "error",
]);

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
  startPioneroLiveKitAgentPlan = defaultStartPioneroLiveKitAgentPlan,
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
  const [agentTtsLastInputText, setAgentTtsLastInputText] = useState("");
  const [agentTtsLastAudioPlan, setAgentTtsLastAudioPlan] = useState("");
  const [agentTtsLastObservedAt, setAgentTtsLastObservedAt] = useState("");
  const [agentTtsReasonCode, setAgentTtsReasonCode] = useState("");

  const localMicTrackRef = useRef(null);
  const mountedRef = useRef(false);
  const roomListenersRef = useRef(null);
  const roomRef = useRef(null);
  const statusRef = useRef("idle");

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
    setAgentTtsLastInputText(
      s(nextAgentState.agentTtsLastInputText).slice(0, 2_000)
    );
    setAgentTtsLastAudioPlan(
      s(nextAgentState.agentTtsLastAudioPlan).slice(0, 2_000)
    );
    setAgentTtsLastObservedAt(s(nextAgentState.agentTtsLastObservedAt));
    setAgentTtsReasonCode(s(nextAgentState.agentTtsReasonCode));
  }, []);

  const clearAgentState = useCallback(() => {
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
      agentTtsLastInputText: "",
      agentTtsLastAudioPlan: "",
      agentTtsLastObservedAt: "",
      agentTtsReasonCode: "",
    });
  }, [setSafeAgentState]);

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

    if (updateState && (room || localMicTrack)) {
      setSafeStatus("stopping");
    }

    detachRoomListeners();
    roomRef.current = null;
    localMicTrackRef.current = null;

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
  }, [clearAgentState, detachRoomListeners, setSafeStatus]);

  const connect = useCallback(async () => {
    if (!["idle", "error"].includes(statusRef.current)) {
      return {
        ok: statusRef.current === "live",
        status: statusRef.current,
      };
    }

    let sensitiveToken = "";

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
      const localMicTrack = await createLocalAudioTrack();
      localMicTrackRef.current = localMicTrack;
      await nextRoom.localParticipant.publishTrack(localMicTrack);

      if (mountedRef.current) {
        setLocalMicEnabled(true);
      }

      setSafeStatus("live");

      try {
        const agentPlan = await startPioneroLiveKitAgentPlan({
          roomName: nextRoomName,
        });
        setSafeAgentState(readAgentState(agentPlan));
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
    localMicEnabled,
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
    agentTtsLastInputText,
    agentTtsLastAudioPlan,
    agentTtsLastObservedAt,
    agentTtsReasonCode,
  };
}
