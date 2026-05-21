import {
  buildRealtimeSidebandConnectionPlan,
} from "./realtimeSidebandConnector.js";
import {
  normalizeRealtimeSidebandEvent,
} from "./realtimeSidebandEvents.js";

export const VOICE_REALTIME_PROVIDER_ADAPTERS_VERSION =
  "voice-realtime-provider-adapters-v1";

export const OPENAI_REALTIME_PROVIDER = "openai";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function cleanProviderName(value = "") {
  return s(value || OPENAI_REALTIME_PROVIDER)
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\w.]/g, "")
    .slice(0, 80);
}

function canonicalTarget(target = {}) {
  return {
    ...target,
    provider: OPENAI_REALTIME_PROVIDER,
  };
}

function unsupportedResult({ provider = "", sidebandPlan = null, normalized = null } = {}) {
  return {
    ok: false,
    provider: normalizeRealtimeProviderName(provider),
    status: "unsupported",
    reasonCode: "unsupported_realtime_provider",
    sidebandPlan,
    normalized,
  };
}

function buildUnsupportedAdapter(provider = "") {
  const normalizedProvider = normalizeRealtimeProviderName(provider);

  return {
    version: VOICE_REALTIME_PROVIDER_ADAPTERS_VERSION,
    provider: normalizedProvider,
    status: "unsupported",
    reasonCode: "unsupported_realtime_provider",
    buildSidebandPlan: () => unsupportedResult({ provider: normalizedProvider }),
    normalizeEvent: () => unsupportedResult({ provider: normalizedProvider }),
  };
}

const OPENAI_ADAPTER = {
  version: VOICE_REALTIME_PROVIDER_ADAPTERS_VERSION,
  provider: OPENAI_REALTIME_PROVIDER,
  status: "supported",
  reasonCode: "",
  buildSidebandPlan({ target = {}, env = process.env } = {}) {
    const sidebandPlan = buildRealtimeSidebandConnectionPlan({
      target: canonicalTarget(target),
      env,
    });

    return {
      ok: true,
      provider: OPENAI_REALTIME_PROVIDER,
      status: s(sidebandPlan.status),
      reasonCode: s(sidebandPlan.reasonCode),
      sidebandPlan,
      normalized: null,
    };
  },
  normalizeEvent({ event = {}, target = {} } = {}) {
    const normalized = normalizeRealtimeSidebandEvent(event, {
      target: canonicalTarget(target),
    });

    return {
      ok: true,
      provider: OPENAI_REALTIME_PROVIDER,
      status: "normalized",
      reasonCode: "",
      sidebandPlan: null,
      normalized,
    };
  },
};

export function normalizeRealtimeProviderName(value = "") {
  const provider = cleanProviderName(value);

  if (
    [
      "openai",
      "openai_realtime",
      "gpt",
      "gpt_realtime",
      "realtime",
    ].includes(provider)
  ) {
    return OPENAI_REALTIME_PROVIDER;
  }

  return provider;
}

export function getRealtimeProviderAdapter(provider = "") {
  const normalizedProvider = normalizeRealtimeProviderName(provider);

  if (normalizedProvider === OPENAI_REALTIME_PROVIDER) {
    return OPENAI_ADAPTER;
  }

  return buildUnsupportedAdapter(normalizedProvider);
}

export function buildRealtimeProviderSidebandPlan({
  provider = "",
  target = {},
  env = process.env,
} = {}) {
  const adapter = getRealtimeProviderAdapter(provider || target.provider);

  return adapter.buildSidebandPlan({
    target,
    env,
  });
}

export function normalizeRealtimeProviderEvent({
  provider = "",
  event = {},
  target = {},
} = {}) {
  const adapter = getRealtimeProviderAdapter(provider || target.provider);

  return adapter.normalizeEvent({
    event,
    target,
  });
}
