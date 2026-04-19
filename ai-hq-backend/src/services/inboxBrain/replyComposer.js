import { getLatestOutbound, normalizeRecentMessages } from "./messages.js";
import {
  arr,
  lower,
  normalizeTextForCompare,
  obj,
  s,
  sanitizeReplyText,
} from "./shared.js";
import {
  getLocalizedGreeting,
  getLocalizedGreetingFollowup,
  interpolateBrand,
} from "./prompts/reply.copy.js";

function resolveLanguage(result = {}, profile = {}) {
  const raw = lower(
    result?.language ||
      profile?.languages?.[0] ||
      profile?.knowledgeEntries?.[0]?.language ||
      "en"
  );

  if (!raw) return "en";
  if (raw.startsWith("az")) return "az";
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("tr")) return "tr";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("it")) return "it";
  if (raw.startsWith("pt")) return "pt";
  if (raw.startsWith("ar")) return "ar";
  if (raw.startsWith("nl")) return "nl";
  if (raw.startsWith("pl")) return "pl";
  if (raw.startsWith("uk")) return "uk";
  if (raw.startsWith("zh")) return "zh";
  if (raw.startsWith("ja")) return "ja";
  if (raw.startsWith("ko")) return "ko";
  if (raw.startsWith("hi")) return "hi";

  return "en";
}

function splitSentences(text = "") {
  return s(text)
    .split(/(?<=[.!?؟])\s+/)
    .map((part) => sanitizeReplyText(part))
    .filter(Boolean);
}

function joinReplyParts(answerFirst = "", nextQuestion = "") {
  const first = sanitizeReplyText(answerFirst);
  const second = sanitizeReplyText(nextQuestion);

  if (!first && !second) return "";
  if (first && !second) return first;
  if (!first && second) return second;

  const firstBase = lower(first.replace(/[.?!؟]+$/g, ""));
  const secondBase = lower(second.replace(/[.?!؟]+$/g, ""));
  if (firstBase && firstBase === secondBase) return first;

  return sanitizeReplyText(`${first} ${second}`);
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

function countQuestions(text = "") {
  return (s(text).match(/[?؟]/g) || []).length;
}

function looksLikeGreetingSentence(text = "") {
  const normalized = normalizeTextForCompare(text);
  if (!normalized) return false;

  return [
    "hello",
    "hi",
    "hey",
    "greetings",
    "good morning",
    "good afternoon",
    "good evening",
    "salam",
    "merhaba",
    "selam",
    "zdravstvuyte",
    "hola",
    "bonjour",
    "hallo",
    "ciao",
    "ola",
    "olá",
    "namaste",
    "konnichiwa",
    "ni hao",
    "annyeonghaseyo",
    "marhaba",
  ].some((item) => normalized.startsWith(item));
}

function stripLeadingGreetingSentence(text = "") {
  const parts = splitSentences(text);
  if (!parts.length) return "";

  if (looksLikeGreetingSentence(parts[0])) {
    return sanitizeReplyText(parts.slice(1).join(" "));
  }

  return sanitizeReplyText(parts.join(" "));
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

function isGenericFollowupSentence(text = "") {
  const normalized = normalizeTextForCompare(text);

  return [
    "how can i help",
    "how may i help",
    "buyurun",
    "chem mogu pomoch",
    "como puedo ayudar",
  ].includes(normalized);
}

function dropDuplicateTrailingQuestionIfAnswerPresent(text = "") {
  const parts = splitSentences(text);
  if (parts.length < 2) return sanitizeReplyText(text);

  const last = parts[parts.length - 1];
  if (!/[?؟]$/.test(last)) return sanitizeReplyText(text);
  if (!isGenericFollowupSentence(last)) return sanitizeReplyText(text);

  return sanitizeReplyText(parts.slice(0, -1).join(" "));
}

function enforceSingleQuestion(text = "") {
  const parts = splitSentences(text);
  if (!parts.length) return "";

  const output = [];
  let seenQuestion = false;

  for (const part of parts) {
    const isQuestion = /[?؟]$/.test(part);
    if (!isQuestion) {
      output.push(part);
      continue;
    }

    if (seenQuestion) continue;
    seenQuestion = true;
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
        behavior?.maxSentences ||
          profile?.maxSentences ||
          obj(behavior?.channelBehavior?.inbox).maxSentences ||
          2
      )
    )
  );

  const parts = splitSentences(text);
  if (!parts.length) return "";

  return sanitizeReplyText(parts.slice(0, maxSentences).join(" "));
}

function getSafeGreeting(language = "en", mode = "neutral", brandName = "") {
  return sanitizeReplyText(
    getLocalizedGreeting({
      language,
      mode,
      brandName,
    })
  );
}

function getSafeGreetingFollowup(language = "en") {
  return sanitizeReplyText(getLocalizedGreetingFollowup(language));
}

function resolveGreetingMode(behavior = {}, brandName = "") {
  const explicitGreetingMode = lower(behavior?.greetingMode || "warm");
  const brandedIntroMode = lower(behavior?.brandedIntroMode || "auto");

  if (s(behavior?.customGreeting || "")) return "custom";

  if (explicitGreetingMode && explicitGreetingMode !== "auto") {
    if (explicitGreetingMode === "branded" && !brandName) return "warm";
    return explicitGreetingMode;
  }

  if (brandedIntroMode === "always" && brandName) return "branded";
  if (brandedIntroMode === "never") return "warm";

  return "warm";
}

function shouldApplyIntro({
  behavior = {},
  result = {},
  recentMessages = [],
  greetingOnly = false,
  bodyText = "",
}) {
  const greetingEnabled =
    typeof behavior?.greetingEnabled === "boolean" ? behavior.greetingEnabled : true;
  if (!greetingEnabled) return false;

  const introMode = lower(behavior?.introMode || "adaptive");
  if (introMode === "none") return false;

  const inboxBehavior = obj(behavior?.channelBehavior?.inbox);
  const introOnFirstTurnOnly =
    typeof inboxBehavior?.introOnFirstTurnOnly === "boolean"
      ? inboxBehavior.introOnFirstTurnOnly
      : true;

  const firstTurn = !hasPreviousOutbound(recentMessages);
  const fastLaneReason = lower(result?.fastLaneReason || "");
  const greetingIntent = isGreetingIntent(result);

  if (introOnFirstTurnOnly && !firstTurn) {
    return false;
  }

  if (fastLaneReason === "start_command") {
    return true;
  }

  if (!greetingIntent) {
    return false;
  }

  if (greetingOnly) {
    return true;
  }

  return firstTurn && Boolean(bodyText);
}

function buildGreetingText({ behavior = {}, result = {}, profile = {} }) {
  const language = resolveLanguage(result, profile);
  const brandName = s(profile?.displayName || "");
  const customGreeting = sanitizeReplyText(
    interpolateBrand(
      s(
        behavior?.customGreeting ||
          profile?.conversationAssets?.customGreeting ||
          ""
      ),
      brandName
    )
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
  const greetingText = getSafeGreeting(language, greetingMode, brandName);

  return {
    greetingText,
    greetingMode,
    usedCustomGreeting: false,
    language,
  };
}

function buildGreetingOnlyBody({ result = {}, profile = {} }) {
  const language = resolveLanguage(result, profile);
  return getSafeGreetingFollowup(language);
}

export function composeTenantAwareReply({
  result = {},
  profile = {},
  text = "",
  recentMessages = [],
}) {
  const behavior = obj(profile?.behavior);
  const bodyCandidate = buildBodyCandidate(result);
  const greetingOnly = isGreetingIntent(result) && !bodyCandidate;

  const applyIntro = shouldApplyIntro({
    behavior,
    result,
    recentMessages,
    greetingOnly,
    bodyText: bodyCandidate,
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
        result,
        profile,
      })
    : bodyCandidate;

  bodyText = applyForbiddenPhraseRules(bodyText, behavior);

  if (!greetingOnly) {
    bodyText = dropDuplicateTrailingQuestionIfAnswerPresent(bodyText);
  }

  bodyText = enforceSingleQuestion(bodyText);
  bodyText = clipReplyByBehavior(bodyText, behavior, profile);

  const combined = greeting.greetingText
    ? sanitizeReplyText(`${greeting.greetingText} ${bodyText || ""}`)
    : sanitizeReplyText(bodyText || "");

  let finalReply = enforceSingleQuestion(
    clipReplyByBehavior(combined, behavior, profile)
  );

  if (!finalReply && greeting.greetingText) {
    finalReply = greeting.greetingText;
  }

  if (!finalReply && greetingOnly) {
    finalReply = `${greeting.greetingText ? `${greeting.greetingText} ` : ""}${getSafeGreetingFollowup(
      greeting.language
    )}`.trim();
  }

  return {
    replyText: sanitizeReplyText(finalReply),
    replyBodyText: sanitizeReplyText(bodyText),
    greetingApplied: Boolean(greeting.greetingText),
    greetingText: greeting.greetingText,
    greetingMode: greeting.greetingMode,
    usedCustomGreeting: Boolean(greeting.usedCustomGreeting),
    introModeUsed: s(behavior?.introMode || "adaptive"),
    behaviorSource: s(behavior?.source || ""),
    language: greeting.language,
    greetingOnly,
    originalInputText: s(text),
    questionCount: countQuestions(finalReply),
  };
}