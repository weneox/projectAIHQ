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
  const fastLaneReason = lower(result?.fastLaneReason || "");

  return (
    askCategory === "greeting" ||
    stage === "greeting" ||
    intent === "greeting" ||
    fastLaneReason === "start_command"
  );
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
    "salam necesiz",
    "salam necəsiz",
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

function isWeakLeadSentence(text = "") {
  const normalized = normalizeTextForCompare(text);

  return [
    "yes",
    "beli",
    "bəli",
    "ok",
    "okay",
    "ela",
    "əla",
    "super",
    "basa dusdum",
    "başa düşdüm",
    "anladim",
    "anladım",
    "understood",
  ].includes(normalized);
}

function stripLeadingWeakLeadSentence(text = "") {
  const parts = splitSentences(text);
  if (parts.length <= 1) return sanitizeReplyText(text);

  if (isWeakLeadSentence(parts[0])) {
    return sanitizeReplyText(parts.slice(1).join(" "));
  }

  return sanitizeReplyText(text);
}

function containsInternalStrategyLeak(text = "") {
  const normalized = s(text);
  if (!normalized) return false;

  return /(?:^|[\s(])(?:qiym[eə]t[_-]?range|price[_-]?range|scope[_-]?clarify[_-]?single|qualify[_-]?single|sales[_-]?stage|lead[_-]?capture|contact[_-]?capture|cta[_-]?next|reply[_-]?style|ask[_-]?category|intent[_-]?key|crm[_-]?capture|discovery[_-]?mode)(?:$|[\s):,.!?])/iu.test(
    normalized
  );
}

function stripInternalStrategyTokens(text = "") {
  let out = sanitizeReplyText(text);
  if (!out) return "";

  out = out
    .replace(
      /\b(?:qiym[eə]t[_-]?range|price[_-]?range|scope[_-]?clarify[_-]?single|qualify[_-]?single|sales[_-]?stage|lead[_-]?capture|contact[_-]?capture|cta[_-]?next|reply[_-]?style|ask[_-]?category|intent[_-]?key|crm[_-]?capture|discovery[_-]?mode)\b/giu,
      " "
    )
    .replace(/\b[a-z]+(?:_[a-z0-9]+){1,}\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitizeReplyText(out);
}

function dedupeSentences(text = "") {
  const parts = splitSentences(text);
  if (!parts.length) return "";

  const out = [];
  const seen = new Set();

  for (const part of parts) {
    const key = normalizeTextForCompare(part);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }

  return sanitizeReplyText(out.join(" "));
}

function buildBodyCandidate(result = {}) {
  const structured = joinReplyParts(
    s(result?.answerFirst || ""),
    s(result?.recommendedNextQuestion || "")
  );

  const raw = sanitizeReplyText(result?.replyText || "");
  const rawHasLeak = containsInternalStrategyLeak(raw);
  const structuredHasLeak = containsInternalStrategyLeak(structured);

  let candidate = "";

  if (structured && !structuredHasLeak) {
    candidate = structured;
  } else if (raw && !rawHasLeak) {
    candidate = raw;
  } else if (structured) {
    candidate = stripInternalStrategyTokens(structured);
  } else {
    candidate = stripInternalStrategyTokens(raw);
  }

  candidate = stripLeadingGreetingSentence(candidate);
  candidate = stripLeadingWeakLeadSentence(candidate);
  candidate = stripInternalStrategyTokens(candidate);
  candidate = dedupeSentences(candidate);

  return sanitizeReplyText(candidate);
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
    "nece komek ede bilerem",
    "necə kömək edə bilərəm",
    "nasil yardimci olabilirim",
    "nasıl yardımcı olabilirim",
    "what do you need",
    "nə lazımdır",
    "nə lazım olduğunu yazın",
  ].includes(normalized);
}

function dropWeakTrailingSentence(text = "") {
  const parts = splitSentences(text);
  if (parts.length < 2) return sanitizeReplyText(text);

  const last = parts[parts.length - 1];
  if (isGenericFollowupSentence(last) || isWeakLeadSentence(last)) {
    return sanitizeReplyText(parts.slice(0, -1).join(" "));
  }

  return sanitizeReplyText(text);
}

function selectSingleQuestion(text = "") {
  const parts = splitSentences(text);
  if (!parts.length) return "";

  const questionIndexes = parts
    .map((part, index) => ({ index, isQuestion: /[?؟]$/.test(part), part }))
    .filter((item) => item.isQuestion)
    .map((item) => item.index);

  if (questionIndexes.length <= 1) {
    return sanitizeReplyText(parts.join(" "));
  }

  const keepQuestionIndex = questionIndexes[questionIndexes.length - 1];
  const output = [];

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const isQuestion = /[?؟]$/.test(part);

    if (!isQuestion) {
      output.push(part);
      continue;
    }

    if (i === keepQuestionIndex) {
      output.push(part);
    }
  }

  return sanitizeReplyText(output.join(" "));
}

function resolveMaxSentences(result = {}, behavior = {}, profile = {}) {
  const stage = lower(result?.stage || "");
  const askCategory = lower(result?.askCategory || "");

  const configured = Number(
    behavior?.maxSentences ||
      profile?.maxSentences ||
      obj(behavior?.channelBehavior?.inbox).maxSentences ||
      0
  );

  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(2, Math.min(5, configured));
  }

  if (
    ["pricing", "recommendation", "qualification"].includes(stage) ||
    ["pricing", "recommendation", "service_interest", "quote"].includes(askCategory)
  ) {
    return 3;
  }

  return 2;
}

function clipReplyByBehavior(text = "", result = {}, behavior = {}, profile = {}) {
  const maxSentences = resolveMaxSentences(result, behavior, profile);
  const parts = splitSentences(text);
  if (!parts.length) return "";

  const questionIndexes = parts
    .map((part, index) => ({ index, isQuestion: /[?؟]$/.test(part) }))
    .filter((item) => item.isQuestion)
    .map((item) => item.index);

  if (parts.length <= maxSentences) {
    return sanitizeReplyText(parts.join(" "));
  }

  const keepLastQuestion =
    questionIndexes.length > 0 ? questionIndexes[questionIndexes.length - 1] : -1;

  const output = [];
  for (let i = 0; i < parts.length; i += 1) {
    if (output.length >= maxSentences) break;

    if (i === keepLastQuestion) {
      continue;
    }

    output.push(parts[i]);
  }

  if (
    keepLastQuestion >= 0 &&
    !output.some((part) => normalizeTextForCompare(part) === normalizeTextForCompare(parts[keepLastQuestion]))
  ) {
    output[output.length - 1] = parts[keepLastQuestion];
  }

  return sanitizeReplyText(output.join(" "));
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

function resolveGreetingMode(behavior = {}, brandName = "") {
  const explicitGreetingMode = lower(behavior?.greetingMode || "");
  const brandedIntroMode = lower(behavior?.brandedIntroMode || "auto");

  if (s(behavior?.customGreeting || "")) return "custom";

  if (explicitGreetingMode) {
    if (explicitGreetingMode === "none") return "none";
    if (explicitGreetingMode === "branded" && !brandName) return "neutral";
    return explicitGreetingMode;
  }

  if (brandedIntroMode === "always" && brandName) return "branded";

  return "neutral";
}

function shouldApplyIntro({
  behavior = {},
  result = {},
  recentMessages = [],
  bodyText = "",
}) {
  const greetingEnabled =
    typeof behavior?.greetingEnabled === "boolean" ? behavior.greetingEnabled : true;
  if (!greetingEnabled) return false;

  const introMode = lower(behavior?.introMode || "adaptive");
  if (introMode === "none") return false;

  const firstTurn = !hasPreviousOutbound(recentMessages);
  const greetingIntent = isGreetingIntent(result);

  if (introMode === "always") {
    return firstTurn;
  }

  if (!firstTurn) return false;
  if (greetingIntent) return true;

  return false;
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
  if (greetingMode === "none") {
    return {
      greetingText: "",
      greetingMode: "none",
      usedCustomGreeting: false,
      language,
    };
  }

  const greetingText = getSafeGreeting(language, greetingMode, brandName);

  return {
    greetingText,
    greetingMode,
    usedCustomGreeting: false,
    language,
  };
}

function ensureMinimumSalesBody({
  bodyText = "",
  result = {},
  profile = {},
}) {
  let out = sanitizeReplyText(bodyText);
  if (!out) return "";

  const stage = lower(result?.stage || "");
  const askCategory = lower(result?.askCategory || "");
  const leadPrompt = sanitizeReplyText(
    pickFirstMeaningfulPrompt(
      profile?.conversationAssets?.qualificationQuestions,
      profile?.qualificationQuestions,
      profile?.conversationAssets?.leadPrompts,
      profile?.leadPrompts
    )
  );

  if (
    countQuestions(out) === 0 &&
    ["pricing", "recommendation", "qualification", "service_interest", "quote"].includes(
      stage || askCategory
    ) &&
    leadPrompt
  ) {
    out = sanitizeReplyText(`${out} ${leadPrompt}`);
  }

  return out;
}

function pickFirstMeaningfulPrompt(...sources) {
  for (const source of sources) {
    for (const item of arr(source)) {
      const text = sanitizeReplyText(item);
      if (text) return text;
    }
  }
  return "";
}

function normalizePunctuation(text = "") {
  return sanitizeReplyText(
    s(text)
      .replace(/\s+([,.!?؟:;])/g, "$1")
      .replace(/([,.!?؟:;])([^\s])/g, "$1 $2")
      .replace(/\s+/g, " ")
  );
}

export function composeTenantAwareReply({
  result = {},
  profile = {},
  text = "",
  recentMessages = [],
}) {
  const behavior = obj(profile?.behavior);
  let bodyText = buildBodyCandidate(result);

  bodyText = applyForbiddenPhraseRules(bodyText, behavior);
  bodyText = stripInternalStrategyTokens(bodyText);
  bodyText = dropWeakTrailingSentence(bodyText);
  bodyText = selectSingleQuestion(bodyText);
  bodyText = ensureMinimumSalesBody({
    bodyText,
    result,
    profile,
  });
  bodyText = clipReplyByBehavior(bodyText, result, behavior, profile);
  bodyText = normalizePunctuation(bodyText);

  const applyIntro = shouldApplyIntro({
    behavior,
    result,
    recentMessages,
    bodyText,
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

  let finalReply = greeting.greetingText
    ? sanitizeReplyText(`${greeting.greetingText} ${bodyText || ""}`)
    : sanitizeReplyText(bodyText || "");

  finalReply = stripInternalStrategyTokens(finalReply);
  finalReply = dropWeakTrailingSentence(finalReply);
  finalReply = selectSingleQuestion(finalReply);
  finalReply = clipReplyByBehavior(finalReply, result, behavior, profile);
  finalReply = normalizePunctuation(finalReply);

  if (!finalReply && greeting.greetingText) {
    finalReply = greeting.greetingText;
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
    greetingOnly: Boolean(greeting.greetingText) && !bodyText,
    originalInputText: s(text),
    questionCount: countQuestions(finalReply),
  };
}