import { pathToFileURL } from "url";

import {
  buildSonioxSpeechRuntimeConfig,
  createOpenAiTurnComposer,
  createSonioxSttSession,
  createSonioxTtsSession,
  readOpenAiApiKey,
  readOpenAiLlmRuntimeConfig,
} from "../src/modules/voice/index.js";

const DEFAULT_SEED_PHRASE = "Salam, Pionero s\u0259s yoxlamas\u0131d\u0131r.";
const PREVIEW_LIMIT = 160;
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
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
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

function includesSensitiveText(value = "") {
  const folded = s(value).toLowerCase().replace(/[^a-z0-9]/g, "");

  return SENSITIVE_VALUE_PATTERNS.some((pattern) => folded.includes(pattern));
}

function safeText(value = "") {
  const normalized = s(value);

  if (!normalized) return "";
  if (includesSensitiveText(normalized)) return "[redacted]";

  return normalized.replace(/[\u0000-\u001f\u007f]+/g, " ").slice(0, PREVIEW_LIMIT);
}

function safeCode(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, PREVIEW_LIMIT);
}

function readAudioBuffer(result = {}) {
  const audio = result?.audio;

  if (Buffer.isBuffer(audio)) return audio;
  if (audio instanceof ArrayBuffer) return Buffer.from(audio);
  if (ArrayBuffer.isView(audio)) {
    return Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
  }

  return null;
}

function buildSmokeResult({
  ok = false,
  status = "",
  ttsSeedStatus = "",
  ttsSeedAudioByteLength = 0,
  sttStatus = "",
  transcriptObserved = false,
  transcriptPreview = "",
  llmStatus = "",
  llmNetworkIo = false,
  responsePreview = "",
  ttsFinalStatus = "",
  ttsFinalAudioByteLength = 0,
  reasonCode = "",
} = {}) {
  return {
    ok: ok === true,
    status: safeText(status),
    ttsSeedStatus: safeText(ttsSeedStatus),
    ttsSeedAudioByteLength: n(ttsSeedAudioByteLength),
    sttStatus: safeText(sttStatus),
    transcriptObserved: transcriptObserved === true,
    transcriptPreview: safeText(transcriptPreview),
    llmStatus: safeText(llmStatus),
    llmNetworkIo: llmNetworkIo === true,
    responsePreview: safeText(responsePreview),
    ttsFinalStatus: safeText(ttsFinalStatus),
    ttsFinalAudioByteLength: n(ttsFinalAudioByteLength),
    reasonCode: safeCode(reasonCode),
  };
}

function readSeedPhrase(env = {}) {
  return s(env.PIONERO_SPEECH_LOOP_SMOKE_TEXT, DEFAULT_SEED_PHRASE).slice(0, 500);
}

async function makeSession(factory, input = {}) {
  return typeof factory === "function" ? await factory(input) : null;
}

export async function runPioneroSpeechLoopSmoke({
  env = process.env,
  createTtsSession = createSonioxTtsSession,
  createSttSession = createSonioxSttSession,
  createLlmTurnComposer = createOpenAiTurnComposer,
  now = () => new Date().toISOString(),
} = {}) {
  if (!isEnabled(env.PIONERO_SPEECH_LOOP_SMOKE_ENABLED)) {
    return buildSmokeResult({
      ok: true,
      status: "skipped",
      reasonCode: "pionero_speech_loop_smoke_disabled",
    });
  }

  const sonioxConfig = buildSonioxSpeechRuntimeConfig({ env });

  if (sonioxConfig.configured !== true) {
    return buildSmokeResult({
      ok: false,
      status: "blocked",
      reasonCode: "soniox_api_key_missing",
    });
  }

  const openAiConfig = readOpenAiLlmRuntimeConfig({
    env,
    overrides: { enabled: true },
  });

  if (!readOpenAiApiKey({ env }) || openAiConfig.configured !== true) {
    return buildSmokeResult({
      ok: false,
      status: "blocked",
      reasonCode: "openai_api_key_missing",
    });
  }

  try {
    const ttsSession = await makeSession(createTtsSession, {
      env,
      runtimeConfig: sonioxConfig,
      now,
    });

    if (!ttsSession || typeof ttsSession.synthesize !== "function") {
      return buildSmokeResult({
        ok: false,
        status: "failed",
        reasonCode: "soniox_tts_session_unavailable",
      });
    }

    const seedTtsResult = await ttsSession.synthesize({
      text: readSeedPhrase(env),
      streamId: "pionero-speech-loop-seed",
    });
    const seedAudio = readAudioBuffer(seedTtsResult);
    const seedAudioByteLength = n(
      seedTtsResult?.audioByteLength,
      seedAudio?.byteLength || 0
    );

    if (seedTtsResult?.ok !== true || !seedAudio || seedAudioByteLength <= 0) {
      return buildSmokeResult({
        ok: false,
        status: "failed",
        ttsSeedStatus: seedTtsResult?.status,
        ttsSeedAudioByteLength: seedAudioByteLength,
        reasonCode: seedTtsResult?.reasonCode || "soniox_tts_seed_audio_missing",
      });
    }

    const sttSession = await makeSession(createSttSession, {
      env,
      runtimeConfig: sonioxConfig,
      now,
    });

    if (!sttSession || typeof sttSession.transcribe !== "function") {
      return buildSmokeResult({
        ok: false,
        status: "failed",
        ttsSeedStatus: seedTtsResult?.status,
        ttsSeedAudioByteLength: seedAudioByteLength,
        reasonCode: "soniox_stt_session_unavailable",
      });
    }

    const sttResult = await sttSession.transcribe({
      audioChunks: [seedAudio],
      finalize: true,
    });
    const transcript = s(sttResult?.text).slice(0, 2_000);

    if (sttResult?.ok !== true || !transcript) {
      return buildSmokeResult({
        ok: false,
        status: "failed",
        ttsSeedStatus: seedTtsResult?.status,
        ttsSeedAudioByteLength: seedAudioByteLength,
        sttStatus: sttResult?.status,
        transcriptObserved: false,
        reasonCode: sttResult?.reasonCode || "pionero_speech_loop_transcript_missing",
      });
    }

    const llmComposer = await makeSession(createLlmTurnComposer, {
      env,
      runtimeConfig: openAiConfig,
      now,
    });

    if (!llmComposer || typeof llmComposer.composeTurn !== "function") {
      return buildSmokeResult({
        ok: false,
        status: "failed",
        ttsSeedStatus: seedTtsResult?.status,
        ttsSeedAudioByteLength: seedAudioByteLength,
        sttStatus: sttResult?.status,
        transcriptObserved: true,
        transcriptPreview: transcript,
        reasonCode: "openai_llm_composer_unavailable",
      });
    }

    const llmResult = await llmComposer.composeTurn({ transcript });
    const responseText = s(llmResult?.responseText).slice(0, 2_000);

    if (llmResult?.ok !== true || !responseText) {
      return buildSmokeResult({
        ok: false,
        status: "failed",
        ttsSeedStatus: seedTtsResult?.status,
        ttsSeedAudioByteLength: seedAudioByteLength,
        sttStatus: sttResult?.status,
        transcriptObserved: true,
        transcriptPreview: transcript,
        llmStatus: llmResult?.status,
        llmNetworkIo: llmResult?.networkIo,
        reasonCode: llmResult?.reasonCode || "openai_llm_response_missing",
      });
    }

    const finalTtsResult = await ttsSession.synthesize({
      text: responseText,
      streamId: "pionero-speech-loop-final",
    });
    const finalAudio = readAudioBuffer(finalTtsResult);
    const finalAudioByteLength = n(
      finalTtsResult?.audioByteLength,
      finalAudio?.byteLength || 0
    );

    if (
      finalTtsResult?.ok !== true ||
      !finalAudio ||
      finalAudioByteLength <= 0
    ) {
      return buildSmokeResult({
        ok: false,
        status: "failed",
        ttsSeedStatus: seedTtsResult?.status,
        ttsSeedAudioByteLength: seedAudioByteLength,
        sttStatus: sttResult?.status,
        transcriptObserved: true,
        transcriptPreview: transcript,
        llmStatus: llmResult?.status,
        llmNetworkIo: llmResult?.networkIo,
        responsePreview: responseText,
        ttsFinalStatus: finalTtsResult?.status,
        ttsFinalAudioByteLength: finalAudioByteLength,
        reasonCode: finalTtsResult?.reasonCode || "soniox_tts_final_audio_missing",
      });
    }

    return buildSmokeResult({
      ok: true,
      status: "passed",
      ttsSeedStatus: seedTtsResult?.status,
      ttsSeedAudioByteLength: seedAudioByteLength,
      sttStatus: sttResult?.status,
      transcriptObserved: true,
      transcriptPreview: transcript,
      llmStatus: llmResult?.status,
      llmNetworkIo: llmResult?.networkIo,
      responsePreview: responseText,
      ttsFinalStatus: finalTtsResult?.status,
      ttsFinalAudioByteLength: finalAudioByteLength,
      reasonCode: "",
    });
  } catch {
    return buildSmokeResult({
      ok: false,
      status: "failed",
      reasonCode: "pionero_speech_loop_smoke_failed",
    });
  }
}

async function main() {
  const result = await runPioneroSpeechLoopSmoke();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
