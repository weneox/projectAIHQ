import {
  buildRealtimeProviderSidebandPlan,
  normalizeRealtimeProviderName,
} from "./realtimeProviderAdapters.js";
import {
  normalizeProviderRealtimeCallId,
} from "./realtimeControlPlane.js";

export const VOICE_REALTIME_SIDEBAND_CONNECTION_LIFECYCLE_VERSION =
  "voice-realtime-sideband-connection-lifecycle-v1";

export const SIDEBAND_CONNECTION_STATES = Object.freeze({
  DISABLED: "disabled",
  BLOCKED: "blocked",
  READY: "ready",
  CONNECTING: "connecting",
  OPEN: "open",
  CLOSING: "closing",
  CLOSED: "closed",
  FAILED: "failed",
});

export const SIDE_BAND_CONNECTION_STATES = SIDEBAND_CONNECTION_STATES;

const ALLOWED_EVENTS = new Set([
  "prepare",
  "connect_requested",
  "connected",
  "close_requested",
  "closed",
  "failed",
]);

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function resolveSidebandPlanBuilder(adapterRegistry) {
  if (typeof adapterRegistry === "function") return adapterRegistry;
  if (typeof adapterRegistry?.buildRealtimeProviderSidebandPlan === "function") {
    return adapterRegistry.buildRealtimeProviderSidebandPlan;
  }
  if (typeof adapterRegistry?.buildSidebandPlan === "function") {
    return adapterRegistry.buildSidebandPlan;
  }
  return buildRealtimeProviderSidebandPlan;
}

function stateForSidebandPlanResult(result = {}) {
  const sidebandPlan = obj(result.sidebandPlan);
  const status = s(sidebandPlan.status || result.status);
  const reasonCode = s(result.reasonCode || sidebandPlan.reasonCode);

  if (reasonCode === "unsupported_realtime_provider" || status === "unsupported") {
    return SIDEBAND_CONNECTION_STATES.BLOCKED;
  }

  if (status === "ready") {
    return SIDEBAND_CONNECTION_STATES.READY;
  }

  if (status === "blocked") {
    return SIDEBAND_CONNECTION_STATES.BLOCKED;
  }

  if (status === "disabled") {
    return SIDEBAND_CONNECTION_STATES.DISABLED;
  }

  return result.ok === false
    ? SIDEBAND_CONNECTION_STATES.BLOCKED
    : SIDEBAND_CONNECTION_STATES.DISABLED;
}

function withLifecycleFields(current = {}, patch = {}) {
  return {
    ...current,
    ...patch,
    version:
      s(patch.version || current.version) ||
      VOICE_REALTIME_SIDEBAND_CONNECTION_LIFECYCLE_VERSION,
    networkIo: false,
  };
}

export function buildRealtimeSidebandConnectionState({
  provider = "",
  target = {},
  env = process.env,
  adapterRegistry = null,
} = {}) {
  const buildSidebandPlan = resolveSidebandPlanBuilder(adapterRegistry);
  const planned = buildSidebandPlan({
    provider: provider || target.provider,
    target,
    env,
  });
  const sidebandPlan = planned?.sidebandPlan || null;
  const sideband = obj(sidebandPlan);
  const normalizedProvider = normalizeRealtimeProviderName(
    planned?.provider || sideband.provider || provider || target.provider
  );
  const state = stateForSidebandPlanResult(planned);
  const status = s(planned?.status || sideband.status || state);
  const reasonCode = s(planned?.reasonCode || sideband.reasonCode);

  return {
    version: VOICE_REALTIME_SIDEBAND_CONNECTION_LIFECYCLE_VERSION,
    provider: normalizedProvider,
    status,
    state,
    reasonCode:
      state === SIDEBAND_CONNECTION_STATES.BLOCKED && !reasonCode
        ? "unsupported_realtime_provider"
        : reasonCode,
    target: obj(target),
    sidebandPlan,
    networkIo: false,
  };
}

export function transitionRealtimeSidebandConnectionState({
  current = {},
  eventType = "",
  reasonCode = "",
  error = "",
} = {}) {
  const event = s(eventType);
  const state = s(current.state || current.status);

  if (!ALLOWED_EVENTS.has(event)) {
    return withLifecycleFields(current, {
      reasonCode: "invalid_lifecycle_transition",
      ...(error ? { error: s(error) } : {}),
    });
  }

  if (event === "prepare") {
    return withLifecycleFields(current);
  }

  if (event === "failed") {
    return withLifecycleFields(current, {
      state: SIDEBAND_CONNECTION_STATES.FAILED,
      status: SIDEBAND_CONNECTION_STATES.FAILED,
      reasonCode: s(reasonCode || "sideband_connection_failed"),
      ...(error ? { error: s(error) } : {}),
    });
  }

  const transitions = {
    [`${SIDEBAND_CONNECTION_STATES.READY}:connect_requested`]:
      SIDEBAND_CONNECTION_STATES.CONNECTING,
    [`${SIDEBAND_CONNECTION_STATES.CONNECTING}:connected`]:
      SIDEBAND_CONNECTION_STATES.OPEN,
    [`${SIDEBAND_CONNECTION_STATES.OPEN}:close_requested`]:
      SIDEBAND_CONNECTION_STATES.CLOSING,
    [`${SIDEBAND_CONNECTION_STATES.CLOSING}:closed`]:
      SIDEBAND_CONNECTION_STATES.CLOSED,
  };
  const nextState = transitions[`${state}:${event}`];

  if (!nextState) {
    return withLifecycleFields(current, {
      reasonCode: "invalid_lifecycle_transition",
      ...(error ? { error: s(error) } : {}),
    });
  }

  return withLifecycleFields(current, {
    state: nextState,
    status: nextState,
    reasonCode: s(reasonCode),
    ...(error ? { error: s(error) } : {}),
  });
}

export function buildRealtimeSidebandLifecycleTrace({
  state = {},
  target = {},
} = {}) {
  const sidebandPlan = obj(state.sidebandPlan);

  return {
    version: VOICE_REALTIME_SIDEBAND_CONNECTION_LIFECYCLE_VERSION,
    provider: normalizeRealtimeProviderName(
      state.provider || sidebandPlan.provider || target.provider
    ),
    state: s(state.state || state.status),
    status: s(state.status || state.state),
    reasonCode: s(state.reasonCode),
    providerRealtimeCallId: normalizeProviderRealtimeCallId(
      sidebandPlan.providerRealtimeCallId || target.providerRealtimeCallId
    ),
    networkIo: false,
  };
}
