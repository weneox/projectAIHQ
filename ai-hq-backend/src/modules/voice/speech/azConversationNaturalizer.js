function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

export const AZ_CONVERSATION_NATURALIZER_VERSION =
  "az_conversation_naturalizer.v1";

export function normalizeAzeriSpeechText(value = "") {
  return s(value)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,.!?;:])([^\s])/g, "$1 $2")
    .trim();
}

export function chunkAzeriSpeechText(value = "", { maxChunkLength = 180 } = {}) {
  const text = normalizeAzeriSpeechText(value);
  if (!text) return [];

  const sentences = text
    .split(/(?<=[.!?])\s+/u)
    .map((item) => item.trim())
    .filter(Boolean);

  const chunks = [];

  for (const sentence of sentences.length ? sentences : [text]) {
    if (sentence.length <= maxChunkLength) {
      chunks.push(sentence);
      continue;
    }

    const parts = sentence
      .split(/,\s+/u)
      .map((item) => item.trim())
      .filter(Boolean);

    let current = "";
    for (const part of parts) {
      const next = current ? `${current}, ${part}` : part;
      if (next.length > maxChunkLength && current) {
        chunks.push(current);
        current = part;
      } else {
        current = next;
      }
    }
    if (current) chunks.push(current);
  }

  return chunks;
}

export function buildAzeriPausePlan(chunks = []) {
  return chunks.map((chunk, index) => {
    const text = s(chunk);
    let pauseAfterMs = 260;

    if (/[!?]$/.test(text)) pauseAfterMs = 420;
    else if (/[.]$/.test(text)) pauseAfterMs = 360;
    else if (/[,]$/.test(text)) pauseAfterMs = 220;

    return {
      index,
      text,
      pauseAfterMs,
    };
  });
}

export function buildAzeriConversationOutput({
  text = "",
  mood = "neutral",
  maxChunkLength = 180,
} = {}) {
  const normalized = normalizeAzeriSpeechText(text);
  const chunks = buildAzeriPausePlan(
    chunkAzeriSpeechText(normalized, { maxChunkLength })
  );

  return {
    version: AZ_CONVERSATION_NATURALIZER_VERSION,
    language: "az",
    mood: s(mood, "neutral"),
    text: normalized,
    chunks,
  };
}
