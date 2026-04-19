import { getLatestOutbound, normalizeRecentMessages } from "./messages.js";
import { arr, lower, normalizeTextForCompare, obj, s, sanitizeReplyText } from "./shared.js";
import {
  getLocalizedGreeting,
  interpolateBrand,
} from "./prompts/reply.copy.js";

function resolveLanguage(result = {}, profile = {}) {
  const raw = lower(result?.language || profile?.languages?.[0] || "az");
  if (!raw) return "az";
  if (raw.startsWith("az")) return "az";
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("tr")) return "tr";
  if (raw.startsWith("ru")) return "ru";
  return "az";
}

function splitSentences(text = "") {
  return s(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => sanitizeReplyText(part))
    .filter(Boolean);
}

function clipSentences(text = "", maxSentences = 2) {
  const safeMax = Math.max(1, Math.min(4, Number(maxSentences || 2)));
  const parts = splitSentences(text);
  if (!parts.length) return "";
  return sanitizeReplyText(parts.slice(0, safeMax).join(" "));
}

function looksLikeGreetingLine(text = "") {
  const normalized = normalizeTextForCompare(text);
  if (!normalized) return false;

  return [
    "salam",
    "salam xos gorduk",
    "salam xosh gorduk",
    "hello",
    "hello welcome",
    "merhaba",
    "merhaba hos geldiniz",
    "zdravstvuyte",
  ].some((item) => normalized.startsWith(item));
}

function stripLeadingGreetingSentence(text = "") {
  const parts = splitSentences(text);
  if (!parts.length) return "";

  if (looksLikeGreetingLine(parts[0])) {
    return sanitizeReplyText(parts.slice(1).join(" "));
  }

  return sanitizeReplyText(parts.join(" "));
}

function hasPreviousOutbound(recentMessages = []) {
  return Boolean(getLatestOutbound(normalizeRecentMessages(recentMessages)));
}

function isGreetingIntent(result = {}) {
  const askCategory = lower(result?.askCategory || "");
  const stage = lower(result?.stage || "");
  const intent = lower(result?.intent || "");

  return askCategory === "greeting" || stage === "greeting" || intent === "greeting";
}

function hasSubstantiveBusinessNeed(result = {}, text = "") {
  if (lower(result?.askCategory || "") !== "greeting") return true;
  if (s(result?.customerGoal || "")) return true;
  if (arr(result?.knownFacts).length) return true;
  if (arr(result?.missingFacts).length) return true;

  const cleaned = s(text).trim();
  return cleaned.length >= 12;
}

function shouldApplyIntro({
  behavior = {},
  result = {},
  text = "",
  recentMessages = [],
}) {
  const greetingEnabled =
    typeof behavior.greetingEnabled === "boolean" ? behavior.greetingEnabled : true;
  if (!greetingEnabled) return false;

  const introMode = lower(behavior.introMode || "adaptive");
  if (introMode === "none") return false;

  const inboxBehavior = obj(behavior.channelBehavior?.inbox);
  const introOnFirstTurnOnly =
    typeof inboxBehavior.introOnFirstTurnOnly === "boolean"
      ? inboxBehavior.introOnFirstTurnOnly
      : true;

  const suppressRepeatedIntro =
    typeof inboxBehavior.suppressRepeatedIntro === "boolean"
      ? inboxBehavior.suppressRepeatedIntro
      : true;

  const firstTurn = !hasPreviousOutbound(recentMessages);

  if (introOnFirstTurnOnly && !firstTurn) return false;
  if (suppressRepeatedIntro && !firstTurn) return false;

  if (introMode === "always") return true;
  if (introMode === "minimal") return firstTurn && isGreetingIntent(result);
  if (introMode === "adaptive") {
    return firstTurn && (isGreetingIntent(result) || hasSubstantiveBusinessNeed(result, text));
  }

  return firstTurn;
}

function resolveGreetingMode(behavior = {}, brandName = "") {
  const brandedIntroMode = lower(behavior.brandedIntroMode || "auto");
  const explicitGreetingMode = lower(behavior.greetingMode || "neutral");

  if (s(behavior.customGreeting || "")) return "custom";

  if (explicitGreetingMode && explicitGreetingMode !== "auto") {
    if (explicitGreetingMode === "branded" && !brandName) return "neutral";
    return explicitGreetingMode;
  }

  if (brandedIntroMode === "always" && brandName) return "branded";
  if (brandedIntroMode === "never") return "neutral";

  return brandName ? "branded" : "neutral";
}

function buildGreetingText({ behavior = {}, result = {}, profile = {} }) {
  const language = resolveLanguage(result, profile);
  const brandName = s(profile?.displayName || "");
  const customGreeting = sanitizeReplyText(
    interpolateBrand(s(behavior.customGreeting || ""), brandName)
  );

  if (customGreeting) {
    return {
      greetingText: customGreeting,
      greetingMode: "custom",
      usedCustomGreeting: true,
      language,
    };
  }

  const greetingMode = resolveGreetingMode(behavior, brandName);
  const greetingText = sanitizeReplyText(
    getLocalizedGreeting({
      language,
      mode: greetingMode,
      brandName,
    })
  );

  return {
    greetingText,
    greetingMode,
    usedCustomGreeting: false,
    language,
  };
}

export function composeTenantAwareReply({
  result = {},
  profile = {},
  text = "",
  recentMessages = [],
}) {
  const behavior = obj(profile?.behavior);
  const baseBody = sanitizeReplyText(result?.replyText || result?.answerFirst || "");
  const bodyWithoutGreeting = stripLeadingGreetingSentence(baseBody);

  const applyIntro = shouldApplyIntro({
    behavior,
    result,
    text,
    recentMessages,
  });

  const greeting = applyIntro
    ? buildGreetingText({
        behavior,
        result,
        profile,
      })
    : {
        greetingText: "",
        greetingMode: "none",
        usedCustomGreeting: false,
        language: resolveLanguage(result, profile),
      };

  const combined = greeting.greetingText
    ? sanitizeReplyText(`${greeting.greetingText} ${bodyWithoutGreeting || ""}`)
    : sanitizeReplyText(bodyWithoutGreeting || baseBody);

  const maxSentences = Math.max(
    1,
    Math.min(
      4,
      Number(
        behavior.maxSentences ||
          profile?.maxSentences ||
          obj(behavior.channelBehavior?.inbox).maxSentences ||
          2
      )
    )
  );

  const replyText = clipSentences(combined, maxSentences) || combined || baseBody;

  return {
    replyText: sanitizeReplyText(replyText),
    replyBodyText: sanitizeReplyText(bodyWithoutGreeting || baseBody),
    greetingApplied: Boolean(greeting.greetingText),
    greetingText: greeting.greetingText,
    greetingMode: greeting.greetingMode,
    usedCustomGreeting: Boolean(greeting.usedCustomGreeting),
    introModeUsed: s(behavior.introMode || "adaptive"),
    behaviorSource: s(behavior.source || ""),
    language: greeting.language,
  };
}