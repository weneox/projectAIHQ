import { s } from "../shared.js";

export const PIONERO_REALTIME_READINESS_GUARD_VERSION =
  "pionero_realtime_readiness_guard.v1";

const DEFAULT_MAX_FIRST_AUDIO_LATENCY_MS = 1200;

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

function readMaxFirstAudioLatencyMs(value = undefined) {
  const next = n(value, DEFAULT_MAX_FIRST_AUDIO_LATENCY_MS);
  return next > 0 ? next : DEFAULT_MAX_FIRST_AUDIO_LATENCY_MS;
}

function buildBlocker(reasonCode, details = {}) {
  return {
    reasonCode: s(reasonCode),
    severity: "blocker",
    ...details,
  };
}

export function evaluatePioneroRealtimeReadinessGuard(
  status = {},
  {
    allowPendingFirstAudio = false,
    maxFirstAudioLatencyMs = DEFAULT_MAX_FIRST_AUDIO_LATENCY_MS,
  } = {}
) {
  const safeMaxFirstAudioLatencyMs = readMaxFirstAudioLatencyMs(
    maxFirstAudioLatencyMs
  );
  const safeStatus = s(status.status);
  const firstAudioLatencyMs = n(status.firstAudioLatencyMs);
  const firstAudioObserved = Boolean(s(status.firstAudioAt)) ||
    firstAudioLatencyMs > 0;

  const blockers = [];

  if (status.enabled !== true) {
    blockers.push(buildBlocker("pionero_realtime_lane_not_enabled"));
  }

  if (safeStatus !== "live") {
    blockers.push(
      buildBlocker("pionero_realtime_lane_not_live", {
        observedStatus: safeStatus,
      })
    );
  }

  if (status.realtimeConnected !== true) {
    blockers.push(buildBlocker("pionero_realtime_transport_not_connected"));
  }

  if (status.livekitAudioTrackPublished !== true) {
    blockers.push(buildBlocker("pionero_livekit_audio_track_not_published"));
  }

  if (!allowPendingFirstAudio && !firstAudioObserved) {
    blockers.push(buildBlocker("pionero_realtime_first_audio_not_observed"));
  }

  if (
    firstAudioObserved &&
    firstAudioLatencyMs > safeMaxFirstAudioLatencyMs
  ) {
    blockers.push(
      buildBlocker("pionero_realtime_first_audio_latency_exceeded", {
        firstAudioLatencyMs,
        maxFirstAudioLatencyMs: safeMaxFirstAudioLatencyMs,
      })
    );
  }

  return {
    version: PIONERO_REALTIME_READINESS_GUARD_VERSION,
    ok: blockers.length === 0,
    status: blockers.length === 0 ? "ready" : "blocked",
    roomName: s(status.roomName),
    mode: s(status.mode),
    provider: s(status.provider),
    maxFirstAudioLatencyMs: safeMaxFirstAudioLatencyMs,
    observed: {
      realtimeStatus: safeStatus,
      realtimeConnected: status.realtimeConnected === true,
      livekitAudioTrackPublished: status.livekitAudioTrackPublished === true,
      firstAudioObserved,
      firstAudioLatencyMs,
      interruptionsObserved: n(status.interruptionsObserved),
    },
    blockers,
  };
}
