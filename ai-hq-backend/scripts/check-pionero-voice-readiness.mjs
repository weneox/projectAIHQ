import { pathToFileURL } from "url";

import { buildPioneroVoiceReadinessSnapshot } from "../src/modules/voice/index.js";
import { runPioneroSpeechLoopSmoke } from "./smoke-pionero-speech-loop.mjs";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function isEnabled(value = "") {
  return ["1", "true"].includes(s(value).toLowerCase());
}

export async function runPioneroVoiceReadinessCheck({
  env = process.env,
  runSpeechLoopSmoke = runPioneroSpeechLoopSmoke,
  now = () => new Date().toISOString(),
} = {}) {
  const speechLoopSmokeResult = await runSpeechLoopSmoke({
    env,
    now,
  });

  const snapshot = buildPioneroVoiceReadinessSnapshot({
    env,
    speechLoopSmokeResult,
    now,
  });

  const requireReady = isEnabled(env.PIONERO_VOICE_READINESS_REQUIRE_READY);

  return {
    ok: snapshot.ok,
    status: snapshot.status,
    reasonCode: snapshot.reasonCode,
    requireReady,
    snapshot,
  };
}

async function main() {
  const result = await runPioneroVoiceReadinessCheck();
  process.stdout.write(`${JSON.stringify(result)}\n`);

  if (result.requireReady && !result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}