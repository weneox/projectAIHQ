import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, createLocalAudioTrack } from "livekit-client";

import { createPioneroLiveKitSession as defaultCreatePioneroLiveKitSession } from "../../api/voice.js";

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

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
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
} = {}) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [roomName, setRoomName] = useState("");
  const [identity, setIdentity] = useState("");
  const [participants, setParticipants] = useState([]);
  const [localMicEnabled, setLocalMicEnabled] = useState(false);

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
      setSafeStatus("idle");
    } else {
      statusRef.current = "idle";
    }
  }, [detachRoomListeners, setSafeStatus]);

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
        setError(readErrorMessage(err, "pionero_livekit_failed", [sensitiveToken]));
      }

      setSafeStatus("error");

      return {
        ok: false,
        status: "error",
      };
    }
  }, [
    createPioneroLiveKitSession,
    disconnect,
    setSafeParticipants,
    setSafeStatus,
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
  };
}
