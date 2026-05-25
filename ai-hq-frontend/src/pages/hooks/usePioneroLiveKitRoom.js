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
  };
}
