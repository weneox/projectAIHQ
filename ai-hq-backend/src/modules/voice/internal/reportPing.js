import { buildVoiceInternalOkResult } from "./response.js";

export async function processVoiceReportPing() {
  return buildVoiceInternalOkResult({
    ok: true,
    accepted: true,
  });
}
