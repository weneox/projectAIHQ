import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runtimePath = new URL("../src/services/voiceInternalRuntime.js", import.meta.url);
const internalIndexPath = new URL("../src/modules/voice/internal/index.js", import.meta.url);

test("voiceInternalRuntime remains a facade over the voice internal module", async () => {
  const source = await readFile(runtimePath, "utf8");

  assert.match(
    source,
    /from "\.\.\/modules\/voice\/internal\/index\.js";/,
    "voiceInternalRuntime should re-export from the internal voice module facade"
  );

  assert.doesNotMatch(
    source,
    /\bfunction\s+\w+\s*\(/,
    "voiceInternalRuntime should not define local function declarations"
  );

  assert.doesNotMatch(
    source,
    /\basync\s+function\s+\w+\s*\(/,
    "voiceInternalRuntime should not define local async function declarations"
  );

  assert.match(source, /processVoiceTenantConfig/);
  assert.match(source, /processVoiceSessionUpsert/);
  assert.match(source, /processVoiceTranscript/);
  assert.match(source, /processVoiceSessionState/);
  assert.match(source, /processVoiceOperatorJoin/);
  assert.match(source, /processVoiceReportPing/);
});

test("voice internal facade exports runtime flow modules", async () => {
  const source = await readFile(internalIndexPath, "utf8");

  for (const moduleName of [
    "tenantConfig",
    "sessionUpsert",
    "transcriptFlow",
    "sessionStateFlow",
    "operatorJoinFlow",
    "reportPing",
  ]) {
    assert.match(
      source,
      new RegExp(`export \\* from "\\./${moduleName}\\.js";`),
      `voice internal facade should export ${moduleName}`
    );
  }
});
