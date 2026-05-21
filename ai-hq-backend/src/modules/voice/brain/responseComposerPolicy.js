import {
  buildVoiceLanguageProsodyGuide,
  buildVoiceSpeechPolicy,
} from "../speechPolicy.js";

export function buildVoiceResponseComposerPolicy(context = {}) {
  return [
    "Response composer policy:",
    "- Compose for phone audio, not chat text.",
    "- Most turns should be one or two short sentences.",
    "- Answer first when the answer is known, then ask one needed question if any.",
    "- Do not use long paragraphs, bullet-like spoken lists, policy wording, or robotic apologies.",
    "- Do not repeat the same thanks, closing phrase, or offer.",
    "- Sound like a premium receptionist: calm, local, concise, and useful.",
    "",
    ...buildVoiceSpeechPolicy(context),
    "",
    ...buildVoiceLanguageProsodyGuide(context.language),
  ];
}
