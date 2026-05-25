import { pathToFileURL } from "url";

import {
  createPioneroLiveKitAgentRunner,
  createPioneroLiveKitRoomClassFactory,
  readPioneroLiveKitAgentConfig,
} from "../src/modules/voice/index.js";

export const PIONERO_LIVEKIT_AUDIO_MONITOR_VERSION =
  "pionero_livekit_audio_monitor.v1";

const DEFAULT_ROOM_NAME = "pionero-browser-test";
const DEFAULT_MONITOR_SECONDS = 20;
const MIN_MONITOR_SECONDS = 1;
const MAX_MONITOR_SECONDS = 60;
const SENSITIVE_VALUE_PATTERNS = [
  "token",
  "secret",
  "rawaudio",
  "audiobase64",
  "audiochunk",
  "apikey",
  "apisecret",
  "jwt",
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function isEnabled(value = "") {
  return ["1", "true"].includes(s(value).toLowerCase());
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

function readMonitorSeconds(env = {}) {
  const numericValue = Number(env.PIONERO_LIVEKIT_LIVE_MONITOR_SECONDS);
  const parsedValue = Number.isFinite(numericValue)
    ? Math.floor(numericValue)
    : DEFAULT_MONITOR_SECONDS;

  return clamp(parsedValue, MIN_MONITOR_SECONDS, MAX_MONITOR_SECONDS);
}

function defaultWait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function safeText(value = "") {
  const normalized = s(value);
  const lowered = normalized.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (SENSITIVE_VALUE_PATTERNS.some((pattern) => lowered.includes(pattern))) {
    return "[redacted]";
  }

  return normalized;
}

function readSafeRoomName(env = {}) {
  return (
    s(env.PIONERO_LIVEKIT_LIVE_MONITOR_ROOM_NAME)
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || DEFAULT_ROOM_NAME
  );
}

function readMissingLiveKitConfig(env = {}) {
  const config = readPioneroLiveKitAgentConfig(env);

  return {
    livekitUrl: !config.url,
    livekitCredentialId: !config.apiKey,
    livekitCredentialProof: !config.apiSecret,
  };
}

function hasMissingConfig(missing = {}) {
  return Object.values(missing).some((value) => value === true);
}

function readRoomClient(value = null) {
  if (typeof value === "function") {
    return {
      RoomClass: value,
      RoomEvent: value.RoomEvent || null,
      AudioStream: value.AudioStream || null,
      TrackKind: value.TrackKind || null,
      TrackSource: value.TrackSource || null,
    };
  }

  if (value && typeof value === "object") {
    return {
      RoomClass: typeof value.RoomClass === "function"
        ? value.RoomClass
        : typeof value.Room === "function"
          ? value.Room
          : null,
      RoomEvent: value.RoomEvent || null,
      AudioStream: value.AudioStream || null,
      TrackKind: value.TrackKind || null,
      TrackSource: value.TrackSource || null,
    };
  }

  return {
    RoomClass: null,
    RoomEvent: null,
    AudioStream: null,
    TrackKind: null,
    TrackSource: null,
  };
}

function safeEventCounts(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([eventName, count]) => [safeText(eventName), n(count)])
      .filter(([eventName, count]) => eventName && count > 0)
  );
}

function buildMonitorResult({
  ok,
  skipped = false,
  networkIo = false,
  status = "",
  stopStatus = "",
  roomName = "",
  agentIdentity = "",
  reasonCode = "",
  monitorSeconds = DEFAULT_MONITOR_SECONDS,
  participantsObserved = 0,
  remoteParticipantsObserved = 0,
  trackPublicationsObserved = 0,
  audioPublicationsObserved = 0,
  subscribedAudioTracksObserved = 0,
  lastParticipantIdentity = "",
  lastPublicationKind = "",
  lastPublicationSource = "",
  lastPublicationSubscribed = false,
  tracksObserved = 0,
  framesObserved = 0,
  bytesObserved = 0,
  audioStreamsOpened = 0,
  audioStreamFramesObserved = 0,
  audioStreamReadErrors = 0,
  lastAudioStreamReasonCode = "",
  lastEventName = "",
  lastTrackKind = "",
  lastTrackSource = "",
  eventCounts = {},
  audioIngestStatus = "",
  sttStatus = "",
  llmStatus = "",
  ttsStatus = "",
  missing = null,
} = {}) {
  const safeTracksObserved = n(tracksObserved);
  const safeFramesObserved = n(framesObserved);

  return {
    ok: ok === true,
    version: PIONERO_LIVEKIT_AUDIO_MONITOR_VERSION,
    skipped: skipped === true,
    networkIo: networkIo === true,
    status: safeText(status),
    stopStatus: safeText(stopStatus),
    roomName: safeText(roomName),
    agentIdentity: safeText(agentIdentity),
    reasonCode: safeText(reasonCode),
    monitorSeconds: n(monitorSeconds, DEFAULT_MONITOR_SECONDS),
    observedAudio: safeTracksObserved > 0 || safeFramesObserved > 0,
    participantsObserved: n(participantsObserved),
    remoteParticipantsObserved: n(remoteParticipantsObserved),
    trackPublicationsObserved: n(trackPublicationsObserved),
    audioPublicationsObserved: n(audioPublicationsObserved),
    subscribedAudioTracksObserved: n(subscribedAudioTracksObserved),
    lastParticipantIdentity: safeText(lastParticipantIdentity),
    lastPublicationKind: safeText(lastPublicationKind),
    lastPublicationSource: safeText(lastPublicationSource),
    lastPublicationSubscribed: lastPublicationSubscribed === true,
    tracksObserved: safeTracksObserved,
    framesObserved: safeFramesObserved,
    bytesObserved: n(bytesObserved),
    audioStreamsOpened: n(audioStreamsOpened),
    audioStreamFramesObserved: n(audioStreamFramesObserved),
    audioStreamReadErrors: n(audioStreamReadErrors),
    lastAudioStreamReasonCode: safeText(lastAudioStreamReasonCode),
    lastEventName: safeText(lastEventName),
    lastTrackKind: safeText(lastTrackKind),
    lastTrackSource: safeText(lastTrackSource),
    eventCounts: safeEventCounts(eventCounts),
    audioIngestStatus: safeText(audioIngestStatus),
    sttStatus: safeText(sttStatus),
    llmStatus: safeText(llmStatus),
    ttsStatus: safeText(ttsStatus),
    ...(missing ? { missing } : {}),
  };
}

function buildResultFromState({
  ok,
  roomName,
  monitorSeconds,
  startState = {},
  finalState = {},
  stopState = {},
} = {}) {
  const audioIngest = finalState?.audioIngest || startState?.audioIngest || {};

  return buildMonitorResult({
    ok,
    skipped: false,
    networkIo: startState?.networkIo === true || finalState?.networkIo === true,
    status: finalState?.status || startState?.status,
    stopStatus: stopState?.status,
    roomName: finalState?.roomName || startState?.roomName || roomName,
    agentIdentity: finalState?.agentIdentity || startState?.agentIdentity,
    reasonCode: finalState?.reasonCode || startState?.reasonCode,
    monitorSeconds,
    participantsObserved: audioIngest.participantsObserved,
    remoteParticipantsObserved: audioIngest.remoteParticipantsObserved,
    trackPublicationsObserved: audioIngest.trackPublicationsObserved,
    audioPublicationsObserved: audioIngest.audioPublicationsObserved,
    subscribedAudioTracksObserved: audioIngest.subscribedAudioTracksObserved,
    lastParticipantIdentity: audioIngest.lastParticipantIdentity,
    lastPublicationKind: audioIngest.lastPublicationKind,
    lastPublicationSource: audioIngest.lastPublicationSource,
    lastPublicationSubscribed: audioIngest.lastPublicationSubscribed,
    tracksObserved: audioIngest.tracksObserved,
    framesObserved: audioIngest.framesObserved,
    bytesObserved: audioIngest.bytesObserved,
    audioStreamsOpened: audioIngest.audioStreamsOpened,
    audioStreamFramesObserved: audioIngest.audioStreamFramesObserved,
    audioStreamReadErrors: audioIngest.audioStreamReadErrors,
    lastAudioStreamReasonCode: audioIngest.lastAudioStreamReasonCode,
    lastEventName: audioIngest.lastEventName,
    lastTrackKind: audioIngest.lastTrackKind,
    lastTrackSource: audioIngest.lastTrackSource,
    eventCounts: audioIngest.eventCounts,
    audioIngestStatus: audioIngest.status,
    sttStatus: finalState?.stt?.status || startState?.stt?.status,
    llmStatus: finalState?.llm?.status || startState?.llm?.status,
    ttsStatus: finalState?.tts?.status || startState?.tts?.status,
  });
}

async function pollRunnerDiagnostics({
  runner = null,
  monitorSeconds = DEFAULT_MONITOR_SECONDS,
  wait = defaultWait,
} = {}) {
  let finalState = typeof runner?.getState === "function"
    ? runner.getState()
    : null;

  for (let elapsedSeconds = 0; elapsedSeconds < monitorSeconds; elapsedSeconds += 1) {
    await wait(1000);
    finalState = typeof runner?.snapshotDiagnostics === "function"
      ? runner.snapshotDiagnostics()
      : typeof runner?.getState === "function"
        ? runner.getState()
        : finalState;
  }

  return finalState;
}

export async function runPioneroLiveKitAudioMonitor({
  env = process.env,
  roomClassFactory = null,
  createRunner = createPioneroLiveKitAgentRunner,
  now = null,
  wait = defaultWait,
} = {}) {
  const roomName = readSafeRoomName(env);
  const monitorSeconds = readMonitorSeconds(env);

  try {
    if (!isEnabled(env.PIONERO_LIVEKIT_LIVE_MONITOR_ENABLED)) {
      return buildMonitorResult({
        ok: true,
        skipped: true,
        networkIo: false,
        roomName,
        monitorSeconds,
        reasonCode: "pionero_livekit_live_monitor_disabled",
      });
    }

    if (!isEnabled(env.PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED)) {
      return buildMonitorResult({
        ok: true,
        skipped: true,
        networkIo: false,
        roomName,
        monitorSeconds,
        reasonCode: "pionero_livekit_room_client_disabled",
      });
    }

    const missing = readMissingLiveKitConfig(env);

    if (hasMissingConfig(missing)) {
      return buildMonitorResult({
        ok: false,
        skipped: true,
        networkIo: false,
        roomName,
        monitorSeconds,
        reasonCode: "livekit_config_missing",
        missing,
      });
    }

    const resolveRoomClass =
      typeof roomClassFactory === "function"
        ? roomClassFactory
        : createPioneroLiveKitRoomClassFactory({
            env,
            logger: null,
          });
    const roomClient = readRoomClient(await resolveRoomClass({ roomName }));
    const {
      RoomClass,
      RoomEvent,
      AudioStream,
      TrackKind,
      TrackSource,
    } = roomClient;

    if (typeof RoomClass !== "function") {
      return buildMonitorResult({
        ok: false,
        skipped: true,
        networkIo: false,
        roomName,
        monitorSeconds,
        reasonCode: "pionero_livekit_room_client_unavailable",
      });
    }

    const runner = createRunner({
      RoomClass,
      ...(RoomEvent ? { RoomEvent } : {}),
      ...(AudioStream ? { AudioStream } : {}),
      ...(TrackKind ? { TrackKind } : {}),
      ...(TrackSource ? { TrackSource } : {}),
      env,
      logger: null,
      now,
      roomName,
    });
    let startState = null;
    let finalState = null;
    let stopState = null;

    try {
      startState = await runner.start();
      finalState = await pollRunnerDiagnostics({
        runner,
        monitorSeconds,
        wait,
      });
    } finally {
      stopState = await runner.stop?.();
    }

    if (!finalState) {
      finalState = startState;
    }

    return buildResultFromState({
      ok: startState?.status === "connected" && stopState?.status === "stopped",
      roomName,
      monitorSeconds,
      startState,
      finalState,
      stopState,
    });
  } catch {
    return buildMonitorResult({
      ok: false,
      skipped: false,
      networkIo: false,
      roomName,
      monitorSeconds,
      reasonCode: "pionero_livekit_audio_monitor_failed",
    });
  }
}

async function main() {
  const result = await runPioneroLiveKitAudioMonitor();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
