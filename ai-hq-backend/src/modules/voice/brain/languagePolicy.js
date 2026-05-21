import {
  joinVoiceBrainList,
  normalizeVoiceBrainLanguage,
} from "./runtimeContext.js";

export function buildVoiceLanguagePolicy(context = {}) {
  const language = normalizeVoiceBrainLanguage(context.language || "az");
  const supportedLanguages = joinVoiceBrainList(context.supportedLanguages);

  return [
    "Language policy:",
    "- Start in the tenant default language.",
    "- If the caller clearly speaks another supported language, adapt to that language naturally.",
    "- If the caller mixes languages, answer in the language that best matches the caller's latest clear turn.",
    "- If the caller uses an unsupported language, continue politely in the tenant default language or the closest supported fallback.",
    supportedLanguages ? `- Supported languages for this tenant: ${supportedLanguages}.` : "",
    language === "az"
      ? "- Azerbaijani must sound local and natural, not Turkish-style, Russian-translated, or English-stressed."
      : "",
    "- Do not force language switching from a single accidental word or background noise.",
  ].filter(Boolean);
}
