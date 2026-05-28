import {
  readOpenAiApiKey,
  readOpenAiLlmRuntimeConfig,
} from "./openaiLlmRuntimeConfig.js";

export const OPENAI_TURN_COMPOSER_VERSION = "openai_turn_composer.v1";
export const PIONERO_OPENAI_DEVELOPER_MESSAGE =
  "You are Pionero, a concise professional voice receptionist. Reply naturally in the same language as the caller. Keep answers short, helpful, and speakable. Do not mention internal systems.";
const UNSAFE_ERROR_TEXT_PATTERNS = [
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
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function textPart(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return "";
  return String(value);
}

function nowIso(now = null) {
  const value = typeof now === "function" ? now() : new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function sanitizeErrorMessage(value, secrets = []) {
  let text = s(value, "openai_llm_response_failed").slice(0, 500);

  for (const secret of secrets) {
    const safeSecret = s(secret);
    if (safeSecret) {
      text = text.split(safeSecret).join("[redacted]");
    }
  }

  const folded = text.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (UNSAFE_ERROR_TEXT_PATTERNS.some((pattern) => folded.includes(pattern))) {
    return "[redacted]";
  }

  return text
    .replace(/Bearer\s+[^\s"]+/gi, "Bearer [redacted]")
    .replace(/OPENAI_API_KEY=[^\s"]+/gi, "OPENAI_API_KEY=[redacted]");
}

export function buildOpenAiTurnComposerRequest({
  model,
  transcript,
  maxOutputTokens = 120,
  temperature = null,
} = {}) {
  const request = {
    model: s(model, "gpt-5.5"),
    input: [
      {
        role: "developer",
        content: PIONERO_OPENAI_DEVELOPER_MESSAGE,
      },
      {
        role: "user",
        content: s(transcript).slice(0, 2_000),
      },
    ],
    max_output_tokens: maxOutputTokens,
  };

  if (Number.isFinite(temperature)) {
    request.temperature = temperature;
  }

  return request;
}

export function extractOpenAiResponseText(response = {}) {
  const payload = obj(response);
  const outputText = s(payload.output_text);

  if (outputText) return outputText.slice(0, 2_000);

  const parts = [];

  for (const output of array(payload.output)) {
    const outputObject = obj(output);

    for (const content of array(outputObject.content)) {
      const contentObject = obj(content);
      const text = textPart(
        contentObject.text ||
          contentObject.output_text ||
          contentObject.value
      );

      if (text) parts.push(text);
    }

    const text = textPart(outputObject.text || outputObject.output_text);
    if (text) parts.push(text);
  }

  return parts.join("").trim().slice(0, 2_000);
}

export function createOpenAiTurnComposer({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  runtimeConfig = null,
} = {}) {
  const config = runtimeConfig || readOpenAiLlmRuntimeConfig({ env });
  const apiKey = readOpenAiApiKey({ env });

  return {
    version: OPENAI_TURN_COMPOSER_VERSION,
    provider: "openai",
    configured: config.configured === true,
    enabled: config.enabled === true,
    config,

    async composeTurn({ transcript } = {}) {
      const inputTranscript = s(transcript).slice(0, 2_000);

      if (!config.enabled) {
        return {
          ok: false,
          status: "blocked",
          provider: "openai",
          networkIo: false,
          inputTranscript,
          reasonCode: "pionero_llm_disabled",
        };
      }

      if (!apiKey) {
        return {
          ok: false,
          status: "blocked",
          provider: "openai",
          networkIo: false,
          inputTranscript,
          reasonCode: "openai_api_key_missing",
        };
      }

      if (!inputTranscript) {
        return {
          ok: false,
          status: "blocked",
          provider: "openai",
          networkIo: false,
          inputTranscript,
          reasonCode: "openai_llm_input_missing",
        };
      }

      if (typeof fetchImpl !== "function") {
        return {
          ok: false,
          status: "failed",
          provider: "openai",
          networkIo: false,
          inputTranscript,
          reasonCode: "openai_fetch_unavailable",
        };
      }

      const requestBody = buildOpenAiTurnComposerRequest({
        model: config.model,
        transcript: inputTranscript,
        maxOutputTokens: config.maxOutputTokens,
        temperature: config.temperature,
      });

      try {
        const response = await fetchImpl("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        let responsePayload = {};

        try {
          responsePayload = await response?.json?.();
        } catch {
          responsePayload = {};
        }

        if (!response?.ok) {
          return {
            ok: false,
            status: "failed",
            provider: "openai",
            networkIo: true,
            inputTranscript,
            model: config.model,
            httpStatus: Number(response?.status || 0) || 0,
            reasonCode: "openai_llm_response_failed",
            errorMessage: sanitizeErrorMessage(
              responsePayload?.error?.message ||
                responsePayload?.message ||
                response?.statusText,
              [apiKey]
            ),
          };
        }

        const responseText = extractOpenAiResponseText(responsePayload);

        if (!responseText) {
          return {
            ok: false,
            status: "failed",
            provider: "openai",
            networkIo: true,
            inputTranscript,
            model: config.model,
            httpStatus: Number(response?.status || 0) || 0,
            reasonCode: "openai_llm_response_failed",
            errorMessage: "openai_response_text_missing",
          };
        }

        return {
          ok: true,
          status: "composed",
          provider: "openai",
          model: config.model,
          networkIo: true,
          inputTranscript,
          responseText,
          reasonCode: "",
          composedAt: nowIso(now),
        };
      } catch (err) {
        return {
          ok: false,
          status: "failed",
          provider: "openai",
          networkIo: true,
          inputTranscript,
          model: config.model,
          httpStatus: 0,
          reasonCode: "openai_llm_response_failed",
          errorMessage: sanitizeErrorMessage(err?.message || err, [apiKey]),
        };
      }
    },
  };
}
