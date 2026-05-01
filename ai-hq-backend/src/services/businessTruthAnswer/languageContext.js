import { arr, normalizeIsoLanguage, s } from "./normalize.js";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function lower(value = "") {
  return s(value).toLowerCase();
}

function pickMetaLanguage(message = {}) {
  const meta = obj(message?.meta);
  const decision = obj(meta?.decision);
  const result = obj(meta?.result);
  const replay = obj(meta?.replayTrace || meta?.replay_trace);
  const replayResult = obj(replay?.result || replay?.decision);

  return s(
    message?.language ||
      message?.lang ||
      message?.detected_language ||
      message?.detectedLanguage ||
      meta?.language ||
      meta?.lang ||
      meta?.detected_language ||
      meta?.detectedLanguage ||
      decision?.language ||
      result?.language ||
      replayResult?.language
  );
}

function inferScriptLanguage(text = "") {
  const value = s(text);
  if (!value) return "";

  if (/[А-Яа-яЁё]/u.test(value)) return "ru";
  if (/[\u0600-\u06FF]/u.test(value)) return "ar";
  if (/[\u3040-\u30ff]/u.test(value)) return "ja";
  if (/[\uac00-\ud7af]/u.test(value)) return "ko";
  if (/[\u4e00-\u9fff]/u.test(value)) return "zh";
  if (/[\u0590-\u05FF]/u.test(value)) return "he";
  if (/[\u0900-\u097F]/u.test(value)) return "hi";

  return "";
}

function messageText(message = {}) {
  return s(
    message?.text ||
      message?.body ||
      message?.message ||
      message?.content ||
      message?.caption ||
      ""
  );
}

function messageRole(message = {}) {
  const direction = lower(message?.direction || message?.message_direction);
  const senderType = lower(message?.sender_type || message?.senderType);

  if (direction === "inbound") return "customer";
  if (direction === "outbound") {
    if (senderType === "ai") return "assistant";
    if (senderType === "agent" || senderType === "operator") return "operator";
    return "business";
  }

  if (senderType === "customer" || senderType === "user") return "customer";
  if (senderType === "ai") return "assistant";
  if (senderType === "agent" || senderType === "operator") return "operator";

  return "message";
}

function toTimestamp(value = "") {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function messageTime(message = {}) {
  return toTimestamp(
    message?.sent_at ||
      message?.sentAt ||
      message?.created_at ||
      message?.createdAt ||
      message?.updated_at ||
      message?.updatedAt
  );
}

export function buildRecentLanguageSample(recentMessages = [], limit = 8) {
  return arr(recentMessages)
    .filter((message) => message && typeof message === "object")
    .slice()
    .sort((a, b) => messageTime(a) - messageTime(b))
    .slice(-Math.max(1, Number(limit || 8)))
    .map((message) => {
      const text = messageText(message);
      if (!text) return null;

      return {
        role: messageRole(message),
        text: text.length > 220 ? `${text.slice(0, 220)}…` : text,
        language: normalizeIsoLanguage(
          pickMetaLanguage(message) || inferScriptLanguage(text),
          ""
        ),
      };
    })
    .filter(Boolean);
}

export function resolveConversationLanguageHint({
  text = "",
  recentMessages = [],
  profile = {},
  fallbackLanguage = "az",
} = {}) {
  const latestScriptLanguage = inferScriptLanguage(text);
  if (latestScriptLanguage) {
    return normalizeIsoLanguage(latestScriptLanguage, fallbackLanguage);
  }

  const sample = buildRecentLanguageSample(recentMessages, 10).slice().reverse();

  for (const item of sample) {
    const explicit = normalizeIsoLanguage(item.language, "");
    if (explicit) return explicit;

    const script = inferScriptLanguage(item.text);
    if (script) return normalizeIsoLanguage(script, fallbackLanguage);
  }

  const profileLanguage =
    arr(profile?.languages)[0] ||
    arr(profile?.supportedLanguages)[0] ||
    arr(profile?.knowledgeEntries)[0]?.language ||
    profile?.language ||
    profile?.defaultLanguage ||
    "";

  return normalizeIsoLanguage(profileLanguage || fallbackLanguage, fallbackLanguage);
}
