export const VOICE_ASSISTANT_BRAIN_POLICY_VERSION = "voice_assistant_brain.v1";

export function buildVoiceTracePolicy({ runtimeApplied = false } = {}) {
  return [
    "Observability policy:",
    `- Assistant policy version: ${VOICE_ASSISTANT_BRAIN_POLICY_VERSION}.`,
    runtimeApplied
      ? "- Runtime trace: tenant runtime was applied for this call."
      : "- Runtime trace: fallback mode is active for this call.",
    "- Tool calls and tool results must be explainable from caller intent, collected details, runtime truth, and tool contract.",
    "- Do not expose trace, runtime, policy, or internal routing details to the caller.",
  ];
}
