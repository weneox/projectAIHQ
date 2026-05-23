import {
  buildOpenAIRealtimeSidebandConnectionPlan,
  buildOpenAIRealtimeSidebandToolOutputEvents,
  buildOpenAIRealtimeSidebandTrace,
  normalizeOpenAIRealtimeSidebandEvent,
} from "./providers/openaiRealtimeSidebandAdapter.js";

export const VOICE_REALTIME_PROVIDER_ADAPTERS_VERSION =
  "voice-realtime-provider-adapters-v1";

export const VOICE_REALTIME_PROVIDER_CONTRACT_VERSION =
  "voice-realtime-provider-contract-v1";

export const OPENAI_REALTIME_PROVIDER = "openai";
const VOICE_REALTIME_SIDEBAND_CONNECTOR_VERSION =
  "voice-realtime-sideband-connector-v1";

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

function unsupportedToolOutputResult(provider = "") {
  return {
    ok: false,
    provider: normalizeRealtimeProviderName(provider),
    status: "unsupported",
    reasonCode: "unsupported_realtime_provider",
    outboundEvents: [],
  };
}

function unsupportedSidebandTrace({ provider = "", target = {} } = {}) {
  return {
    version: VOICE_REALTIME_SIDEBAND_CONNECTOR_VERSION,
    enabled: false,
    status: "unsupported",
    reasonCode: "unsupported_realtime_provider",
    provider: normalizeRealtimeProviderName(provider),
    transport: s(target.transport),
    providerRealtimeCallId: s(target.providerRealtimeCallId),
    url: "",
    networkIo: false,
    authorizationConfigured: false,
  };
}

function buildProviderCapabilities({ supported = false } = {}) {
  return {
    realtimeSession: supported,
    sidebandConnector: supported,
    sidebandTrace: supported,
    eventNormalization: supported,
    toolOutputEvents: supported,
    browserRealtime: supported,
    externalSpeechAdapter: false,
    livekitGateway: false,
    twilioGateway: false,
  };
}

export function buildRealtimeProviderContract({ provider = "", transport = "" } = {}) {
  const normalizedProvider = normalizeRealtimeProviderName(provider);
  const supported = normalizedProvider === OPENAI_REALTIME_PROVIDER;

  return {
    version: VOICE_REALTIME_PROVIDER_CONTRACT_VERSION,
    provider: normalizedProvider,
    transport: s(transport),
    supported,
    status: supported ? "supported" : "unsupported",
    reasonCode: supported ? "" : "unsupported_realtime_provider",
    capabilities: buildProviderCapabilities({ supported }),
    requirements: supported
      ? {
          apiKeyEnv: "OPENAI_API_KEY",
          sidebandEnabledEnv: [
            "VOICE_REALTIME_SIDEBAND_ENABLED",
            "AIHQ_VOICE_REALTIME_SIDEBAND_ENABLED",
          ],
        }
      : {
          apiKeyEnv: "",
          sidebandEnabledEnv: [],
        },
  };
}

export function assertRealtimeProviderSupported({ provider = "", transport = "" } = {}) {
  const contract = buildRealtimeProviderContract({ provider, transport });

  return {
    ok: contract.supported === true,
    provider: contract.provider,
    status: contract.status,
    reasonCode: contract.reasonCode,
    contract,
  };
}

function buildUnsupportedAdapter(provider = "") {
  const normalizedProvider = normalizeRealtimeProviderName(provider);

  return {
    version: VOICE_REALTIME_PROVIDER_ADAPTERS_VERSION,
    provider: normalizedProvider,
    status: "unsupported",
    reasonCode: "unsupported_realtime_provider",
    contract: buildRealtimeProviderContract({ provider: normalizedProvider }),
    buildSidebandPlan: () => unsupportedResult({ provider: normalizedProvider }),
    buildSidebandTrace: ({ target = {} } = {}) => ({
      ...unsupportedResult({ provider: normalizedProvider }),
      sidebandTrace: unsupportedSidebandTrace({
        provider: normalizedProvider,
        target,
      }),
    }),
    normalizeEvent: () => unsupportedResult({ provider: normalizedProvider }),
    buildToolOutputEvents: () => unsupportedToolOutputResult(normalizedProvider),
  };
}

const OPENAI_ADAPTER = {
  version: VOICE_REALTIME_PROVIDER_ADAPTERS_VERSION,
  provider: OPENAI_REALTIME_PROVIDER,
  status: "supported",
  reasonCode: "",
  contract: buildRealtimeProviderContract({ provider: OPENAI_REALTIME_PROVIDER }),
  buildSidebandPlan({ target = {}, env = process.env } = {}) {
    const sidebandPlan = buildOpenAIRealtimeSidebandConnectionPlan({
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
  buildSidebandTrace({ plan = {} } = {}) {
    const sidebandTrace = buildOpenAIRealtimeSidebandTrace(plan);

    return {
      ok: true,
      provider: OPENAI_REALTIME_PROVIDER,
      status: s(sidebandTrace.status),
      reasonCode: s(sidebandTrace.reasonCode),
      sidebandPlan: null,
      sidebandTrace,
      normalized: null,
    };
  },
  normalizeEvent({ event = {}, target = {} } = {}) {
    const normalized = normalizeOpenAIRealtimeSidebandEvent(event, {
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
  buildToolOutputEvents({ toolCall = {}, result = {}, includeResponseCreate = true } = {}) {
    return {
      ok: true,
      provider: OPENAI_REALTIME_PROVIDER,
      status: "built",
      reasonCode: "",
      outboundEvents: buildOpenAIRealtimeSidebandToolOutputEvents({
        toolCall,
        result,
        includeResponseCreate,
      }),
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

export function buildRealtimeProviderSidebandTrace({
  provider = "",
  plan = {},
  target = {},
} = {}) {
  const adapter = getRealtimeProviderAdapter(provider || target.provider || plan.provider);

  return adapter.buildSidebandTrace({
    plan,
    target,
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

export function buildRealtimeProviderToolOutputEvents({
  provider = "",
  target = {},
  toolCall = {},
  result = {},
  includeResponseCreate = true,
} = {}) {
  const adapter = getRealtimeProviderAdapter(provider || target.provider);

  return adapter.buildToolOutputEvents({
    toolCall,
    result,
    includeResponseCreate,
  });
}
