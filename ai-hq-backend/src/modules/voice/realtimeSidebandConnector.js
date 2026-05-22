import {
  buildOpenAIRealtimeSidebandConnectionPlan,
  buildOpenAIRealtimeSidebandTrace,
} from "./providers/openaiRealtimeSidebandAdapter.js";

export const VOICE_REALTIME_SIDEBAND_CONNECTOR_VERSION =
  "voice-realtime-sideband-connector-v1";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value = "") {
  return s(value).toLowerCase();
}

function truthy(value = "") {
  return ["1", "true", "yes", "y", "on"].includes(lower(value));
}

export function isRealtimeSidebandEnabled(env = process.env) {
  return truthy(
    env.VOICE_REALTIME_SIDEBAND_ENABLED ||
      env.AIHQ_VOICE_REALTIME_SIDEBAND_ENABLED
  );
}

export function buildRealtimeSidebandConnectionPlan({
  target = {},
  env = process.env,
} = {}) {
  return buildOpenAIRealtimeSidebandConnectionPlan({
    target,
    env,
  });
}

export function buildRealtimeSidebandTrace(plan = {}) {
  return buildOpenAIRealtimeSidebandTrace(plan);
}
