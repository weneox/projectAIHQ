function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function isEnabled(value) {
  return ["1", "true"].includes(s(value).toLowerCase());
}

function readPositiveInteger(value, fallback, { min = 1, max = 4_000 } = {}) {
  const parsed = Number.parseInt(s(value), 10);
  const next = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, next));
}

function readFiniteNumber(value, fallback) {
  const parsed = Number(s(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const OPENAI_LLM_RUNTIME_CONFIG_VERSION =
  "openai_llm_runtime_config.v1";

export function readOpenAiLlmRuntimeConfig({
  env = process.env,
  overrides = {},
} = {}) {
  const enabled = isEnabled(
    overrides.enabled ?? env.PIONERO_LIVEKIT_LLM_ENABLED
  );
  const apiKey = s(overrides.apiKey || env.OPENAI_API_KEY);
  const model = s(overrides.model || env.PIONERO_OPENAI_MODEL, "gpt-5.5");
  const maxOutputTokens = readPositiveInteger(
    overrides.maxOutputTokens || env.PIONERO_OPENAI_MAX_OUTPUT_TOKENS,
    120,
    { min: 1, max: 2_000 }
  );
  const temperature = readFiniteNumber(
    overrides.temperature ?? env.PIONERO_OPENAI_TEMPERATURE,
    0.4
  );

  return {
    version: OPENAI_LLM_RUNTIME_CONFIG_VERSION,
    provider: "openai",
    configured: !!apiKey,
    enabled,
    model,
    maxOutputTokens,
    temperature,
    reasonCode: enabled
      ? (apiKey ? "" : "openai_api_key_missing")
      : "pionero_llm_disabled",
  };
}

export function readOpenAiApiKey({ env = process.env, overrides = {} } = {}) {
  return s(overrides.apiKey || env.OPENAI_API_KEY);
}
