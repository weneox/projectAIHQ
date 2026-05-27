import test from "node:test";
import assert from "node:assert/strict";

import {
  PIONERO_OPENAI_DEVELOPER_MESSAGE,
  buildOpenAiTurnComposerRequest,
  createOpenAiTurnComposer,
  extractOpenAiResponseText,
} from "../src/modules/voice/llm/providers/openaiTurnComposer.js";
import {
  readOpenAiLlmRuntimeConfig,
} from "../src/modules/voice/llm/providers/openaiLlmRuntimeConfig.js";

function assertNoUnsafeLeak(payload = {}, secret = "test-openai-key") {
  const serialized = JSON.stringify(payload);

  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("OPENAI_API_KEY"), false);
  assert.equal(serialized.includes("apiKey"), false);
  assert.equal(serialized.includes("apiSecret"), false);
  assert.equal(serialized.includes("token"), false);
  assert.equal(serialized.includes("jwt"), false);
  assert.equal(serialized.includes("rawAudio"), false);
  assert.equal(serialized.includes("audioBase64"), false);
  assert.equal(serialized.includes("audioChunk"), false);
}

test("OpenAI LLM runtime config is disabled safely without env", async () => {
  let fetchCalls = 0;
  const config = readOpenAiLlmRuntimeConfig({ env: {} });
  const composer = createOpenAiTurnComposer({
    env: {},
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        ok: true,
        async json() {
          return {
            output_text: "Should not be called.",
          };
        },
      };
    },
  });
  const result = await composer.composeTurn({
    transcript: "Salam",
  });

  assert.equal(config.provider, "openai");
  assert.equal(config.enabled, false);
  assert.equal(config.configured, false);
  assert.equal(config.model, "gpt-5.5");
  assert.equal(config.maxOutputTokens, 120);
  assert.equal(config.reasonCode, "pionero_llm_disabled");
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "pionero_llm_disabled");
  assert.equal(result.networkIo, false);
  assert.equal(fetchCalls, 0);
  assertNoUnsafeLeak(result);
});

test("OpenAI LLM runtime config reports missing API key when enabled", async () => {
  let fetchCalls = 0;
  const env = {
    PIONERO_LIVEKIT_LLM_ENABLED: "1",
  };
  const config = readOpenAiLlmRuntimeConfig({ env });
  const composer = createOpenAiTurnComposer({
    env,
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        ok: true,
        async json() {
          return {};
        },
      };
    },
  });
  const result = await composer.composeTurn({
    transcript: "Salam",
  });

  assert.equal(config.enabled, true);
  assert.equal(config.configured, false);
  assert.equal(config.reasonCode, "openai_api_key_missing");
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "openai_api_key_missing");
  assert.equal(result.networkIo, false);
  assert.equal(fetchCalls, 0);
  assertNoUnsafeLeak(result);
});

test("OpenAI turn composer builds Responses API request with developer and user messages", async () => {
  let captured = null;
  const env = {
    OPENAI_API_KEY: "test-openai-key",
    PIONERO_LIVEKIT_LLM_ENABLED: "true",
    PIONERO_OPENAI_MODEL: "gpt-test",
    PIONERO_OPENAI_MAX_OUTPUT_TOKENS: "77",
    PIONERO_OPENAI_TEMPERATURE: "0.2",
  };
  const composer = createOpenAiTurnComposer({
    env,
    fetchImpl: async (url, init) => {
      captured = {
        url,
        init,
        body: JSON.parse(init.body),
      };
      return {
        ok: true,
        async json() {
          return {
            output_text: "Buyurun.",
          };
        },
      };
    },
    now: () => "2026-01-02T03:04:05.000Z",
  });
  const result = await composer.composeTurn({
    transcript: "Salam Pionero",
  });

  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers.Authorization, "Bearer test-openai-key");
  assert.equal(captured.init.headers["Content-Type"], "application/json");
  assert.deepEqual(captured.body, {
    model: "gpt-test",
    input: [
      {
        role: "developer",
        content: PIONERO_OPENAI_DEVELOPER_MESSAGE,
      },
      {
        role: "user",
        content: "Salam Pionero",
      },
    ],
    max_output_tokens: 77,
    temperature: 0.2,
  });
  assert.deepEqual(result, {
    ok: true,
    status: "composed",
    provider: "openai",
    model: "gpt-test",
    networkIo: true,
    inputTranscript: "Salam Pionero",
    responseText: "Buyurun.",
    reasonCode: "",
    composedAt: "2026-01-02T03:04:05.000Z",
  });
  assertNoUnsafeLeak(result);
});

test("OpenAI turn composer uses supplied Pionero brain instructions", async () => {
  let captured = null;
  const env = {
    OPENAI_API_KEY: "test-openai-key",
    PIONERO_LIVEKIT_LLM_ENABLED: "1",
  };
  const instructions = [
    "Voice assistant brain:",
    "You are the live voice receptionist for Acme Baku Clinic.",
    "Always reply in Azerbaijani unless the caller explicitly requests another language.",
  ].join("\n");
  const composer = createOpenAiTurnComposer({
    env,
    instructions,
    brainMode: "canonical",
    fetchImpl: async (_url, init) => {
      captured = JSON.parse(init.body);
      return {
        ok: true,
        async json() {
          return {
            output_text: "Buyurun.",
          };
        },
      };
    },
  });

  const result = await composer.composeTurn({
    transcript: "Salam",
  });

  assert.equal(composer.brainMode, "canonical");
  assert.equal(captured.input[0].role, "developer");
  assert.equal(captured.input[0].content, instructions);
  assert.match(
    captured.input[0].content,
    /Always reply in Azerbaijani unless the caller explicitly requests another language/
  );
  assert.equal(captured.input[1].content, "Salam");
  assert.equal(result.ok, true);
  assertNoUnsafeLeak(result);
});

test("OpenAI turn composer extracts output_text", () => {
  assert.equal(
    extractOpenAiResponseText({
      output_text: "Short composed response.",
    }),
    "Short composed response."
  );
});

test("OpenAI turn composer extracts output content text fallback", () => {
  assert.equal(
    extractOpenAiResponseText({
      output: [
        {
          content: [
            {
              type: "output_text",
              text: "Fallback ",
            },
            {
              type: "output_text",
              text: "response.",
            },
          ],
        },
      ],
    }),
    "Fallback response."
  );
});

test("OpenAI turn composer returns safe failure without leaking key", async () => {
  const env = {
    OPENAI_API_KEY: "test-openai-key",
    PIONERO_LIVEKIT_LLM_ENABLED: "1",
  };
  const composer = createOpenAiTurnComposer({
    env,
    fetchImpl: async () => ({
      ok: false,
      statusText: "Bad OPENAI_API_KEY=test-openai-key",
      async json() {
        return {
          error: {
            message: "bad apiKey test-openai-key token rawAudio",
          },
        };
      },
    }),
  });
  const result = await composer.composeTurn({
    transcript: "Salam",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "failed");
  assert.equal(result.provider, "openai");
  assert.equal(result.networkIo, true);
  assert.equal(result.reasonCode, "openai_llm_response_failed");
  assert.equal(result.errorMessage, "[redacted]");
  assertNoUnsafeLeak(result);
});

test("OpenAI request builder uses safe defaults", () => {
  assert.deepEqual(
    buildOpenAiTurnComposerRequest({
      transcript: "Hello",
    }),
    {
      model: "gpt-5.5",
      input: [
        {
          role: "developer",
          content: PIONERO_OPENAI_DEVELOPER_MESSAGE,
        },
        {
          role: "user",
          content: "Hello",
        },
      ],
      max_output_tokens: 120,
    }
  );
});
