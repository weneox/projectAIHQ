export function buildSemanticRepairSystemPrompt() {
  return [
    "You repair malformed semantic inbox model output.",
    "Convert the prior model output into valid JSON that matches the required schema exactly.",
    "Do not add markdown.",
    "Do not add explanations.",
    "Return only valid JSON.",
    "Preserve the original meaning if it is present.",
    "If the raw model output is empty or unusable, produce the safest useful JSON using the provided fallback reference.",
  ].join(" ");
}