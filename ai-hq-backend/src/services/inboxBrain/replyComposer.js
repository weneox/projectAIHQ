import { getLatestOutbound, normalizeRecentMessages } from "./messages.js";
import {
  arr,
  lower,
  normalizeTextForCompare,
  obj,
  s,
  sanitizeReplyText,
} from "./shared.js";
import { pickBehaviorLeadPrompt } from "./runtime.js";
import {
  getLocalizedGreeting,
  getLocalizedGreetingFollowup,
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

function joinReplyParts(answerFirst = "", nextQuestion = "") {
  const first = sanitizeReplyText(answerFirst);
  const second = sanitizeReplyText(nextQuestion);

  if (!first && !second) return "";
  if (first && !second) return first;
  if (!first && second) return second;

  const firstBase = lower(first.replace(/[.?!]+$/g, ""));
  const secondBase = lower(second.replace(/[.?!]+$/g, ""));
  if (firstBase && firstBase === secondBase) return first;

  return sanitizeReplyText(`${first} ${second}`);
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

function countWordLikeTokens(text = "") {
  const cleaned = s(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(" ").filter(Boolean).length;
}

function isGreetingIntent(result = {}) {
  const askCategory = lower(result?.askCategory || "");
  const stage = lower(result?.stage || "");
  const intent = lower(result?.intent || "");

  return askCategory === "greeting" || stage === "greeting" || intent === "greeting";
}

function hasConcreteReplyContent(result = {}) {
  const answerFirst = stripLeadingGreetingSentence(s(result?.answerFirst || ""));
  const replyText = stripLeadingGreetingSentence(s(result?.replyText || ""));
  const recommendedNextQuestion = sanitizeReplyText(
    s(result?.recommendedNextQuestion || "")
  );

  return Boolean(answerFirst || replyText || recommendedNextQuestion);
}

function hasSubstantiveBusinessNeed(result = {}, text = "") {
  if (lower(result?.askCategory || "") !== "greeting") return true;
  if (s(result?.customerGoal || "")) return true;
  if (arr(result?.knownFacts).length) return true;
  if (arr(result?.missingFacts).length) return true;
  if (hasConcreteReplyContent(result)) return true;

  const cleaned = s(text).trim();
  if (cleaned.length >= 18) return true;
  if (countWordLikeTokens(cleaned) >= 4) return true;

  return false;
}

function isGreetingOnlyTurn(result = {}, text = "") {
  return isGreetingIntent(result) && !hasSubstantiveBusinessNeed(result, text);
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
  const greetingOnly = isGreetingOnlyTurn(result, text);
  const substantiveBusinessNeed = hasSubstantiveBusinessNeed(result, text);

  if (substantiveBusinessNeed) return false;
  if (!greetingOnly) return false;

  if (introOnFirstTurnOnly) return firstTurn;
  if (suppressRepeatedIntro && !firstTurn) return false;

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

  return "neutral";
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

function buildGreetingOnlyBody({ profile = {}, behavior = {}, language = "az" }) {
  const tenantSpecificPrompt =
    arr(behavior?.leadPrompts).length || arr(profile?.qualificationQuestions).length
      ? sanitizeReplyText(pickBehaviorLeadPrompt(profile))
      : "";

  if (tenantSpecificPrompt) return tenantSpecificPrompt;
  return sanitizeReplyText(getLocalizedGreetingFollowup(language));
}

function buildBodyCandidate(result = {}) {
  const structured = joinReplyParts(
    s(result?.answerFirst || ""),
    s(result?.recommendedNextQuestion || "")
  );

  const raw = sanitizeReplyText(result?.replyText || "");
  const candidate = structured || raw;
  return stripLeadingGreetingSentence(candidate);
}

function escapeRegExp(value = "") {
  return s(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyForbiddenPhraseRules(text = "", behavior = {}) {
  let out = sanitizeReplyText(text);
  if (!out) return "";

  const forbidden = [
    ...arr(behavior?.forbiddenPhrases),
    ...arr(behavior?.doNotSay),
  ]
    .map((item) => s(item))
    .filter(Boolean);

  for (const phrase of forbidden) {
    const escaped = escapeRegExp(phrase);
    if (!escaped) continue;
    out = out.replace(new RegExp(escaped, "gi"), " ");
  }

  return sanitizeReplyText(out);
}

function isGenericHelperSentence(text = "") {
  const normalized = normalizeTextForCompare(text);

  return [
    "ne ile komek ede bilerik",
    "size nece komek ede bilerik",
    "buyurun nece komek ede bilerik",
    "hazirda size en vacib olan ehtiyaci bir cumle ile yazin",
    "esas ehtiyacinizi bir cumle ile yazin",
    "sizin ucun en vacib netice nedir",
    "ehtiyacinizi bir cumle ile yazin",
    "qisa olaraq size hansi xidmet ve ya mehsul lazim oldugunu yazin",
    "ne qurmaq almaq ve ya hell etmek istediyinizi bir cumle ile yazin",
  ].some((item) => normalized === item);
}

function dropGenericTrailingQuestionIfAnswerPresent(text = "") {
  const parts = splitSentences(text);
  if (parts.length < 2) return sanitizeReplyText(text);

  const last = parts[parts.length - 1];
  if (!/[?؟]$/.test(last)) return sanitizeReplyText(text);
  if (!isGenericHelperSentence(last)) return sanitizeReplyText(text);

  return sanitizeReplyText(parts.slice(0, -1).join(" "));
}

function enforceSingleQuestion(text = "") {
  const parts = splitSentences(text);
  if (!parts.length) return "";

  const output = [];
  let seenQuestion = false;

  for (const part of parts) {
    const isQuestion = /[?؟]$/.test(part);
    if (isQuestion) {
      if (seenQuestion) continue;
      seenQuestion = true;
      output.push(part);
      continue;
    }
    output.push(part);
  }

  return sanitizeReplyText(output.join(" "));
}

function clipReplyByBehavior(text = "", behavior = {}, profile = {}) {
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

  const parts = splitSentences(text);
  if (!parts.length) return "";

  return sanitizeReplyText(parts.slice(0, maxSentences).join(" "));
}

export function composeTenantAwareReply({
  result = {},
  profile = {},
  text = "",
  recentMessages = [],
}) {
  const behavior = obj(profile?.behavior);
  const greetingOnly = isGreetingOnlyTurn(result, text);

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

  let bodyText = greetingOnly
    ? buildGreetingOnlyBody({
        profile,
        behavior,
        language: greeting.language,
      })
    : buildBodyCandidate(result);

  bodyText = applyForbiddenPhraseRules(bodyText, behavior);

  if (!greetingOnly) {
    bodyText = dropGenericTrailingQuestionIfAnswerPresent(bodyText);
  }

  bodyText = enforceSingleQuestion(bodyText);
  bodyText = clipReplyByBehavior(bodyText, behavior, profile);

  const combined = greeting.greetingText
    ? sanitizeReplyText(`${greeting.greetingText} ${bodyText || ""}`)
    : sanitizeReplyText(bodyText || "");

  const finalReply = enforceSingleQuestion(
    clipReplyByBehavior(combined, behavior, profile)
  );

  return {
    replyText: sanitizeReplyText(finalReply),
    replyBodyText: sanitizeReplyText(bodyText),
    greetingApplied: Boolean(greeting.greetingText),
    greetingText: greeting.greetingText,
    greetingMode: greeting.greetingMode,
    usedCustomGreeting: Boolean(greeting.usedCustomGreeting),
    introModeUsed: s(behavior.introMode || "adaptive"),
    behaviorSource: s(behavior.source || ""),
    language: greeting.language,
    greetingOnly,
  };
}