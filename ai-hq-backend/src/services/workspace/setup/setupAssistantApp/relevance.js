import { arr, obj, s } from "../draftShared.js";
import {
  parseHoursNote,
  parsePricingNote,
  parseServicesNote,
} from "../setupAssistantParser.js";
import { isBehaviorStepRelevant, normalizeQuestionKey } from "./questions.js";
import {
  buildRecognizedSourceCandidate,
  inferContactType,
  normalizeBookingBehaviorMode as importedNormalizeBookingBehaviorMode,
  normalizeClosingBehaviorMode as importedNormalizeClosingBehaviorMode,
  normalizeContactBehaviorMode as importedNormalizeContactBehaviorMode,
  normalizeEmpathyLevelMode as importedNormalizeEmpathyLevelMode,
  normalizeGreetingBehaviorMode as importedNormalizeGreetingBehaviorMode,
  normalizeHandoffBehaviorMode as importedNormalizeHandoffBehaviorMode,
  normalizeLocationBehaviorMode as importedNormalizeLocationBehaviorMode,
  normalizeMessageLengthMode as importedNormalizeMessageLengthMode,
  normalizePricingBehaviorMode as importedNormalizePricingBehaviorMode,
  normalizeToneBehaviorMode as importedNormalizeToneBehaviorMode,
} from "./shared.js";

const normalizePricingBehaviorMode =
  typeof importedNormalizePricingBehaviorMode === "function"
    ? importedNormalizePricingBehaviorMode
    : () => "";

const normalizeLocationBehaviorMode =
  typeof importedNormalizeLocationBehaviorMode === "function"
    ? importedNormalizeLocationBehaviorMode
    : () => "";

const normalizeBookingBehaviorMode =
  typeof importedNormalizeBookingBehaviorMode === "function"
    ? importedNormalizeBookingBehaviorMode
    : () => "";

const normalizeContactBehaviorMode =
  typeof importedNormalizeContactBehaviorMode === "function"
    ? importedNormalizeContactBehaviorMode
    : () => "";

const normalizeHandoffBehaviorMode =
  typeof importedNormalizeHandoffBehaviorMode === "function"
    ? importedNormalizeHandoffBehaviorMode
    : () => "";

const normalizeGreetingBehaviorMode =
  typeof importedNormalizeGreetingBehaviorMode === "function"
    ? importedNormalizeGreetingBehaviorMode
    : () => "";

const normalizeClosingBehaviorMode =
  typeof importedNormalizeClosingBehaviorMode === "function"
    ? importedNormalizeClosingBehaviorMode
    : () => "";

const normalizeToneBehaviorMode =
  typeof importedNormalizeToneBehaviorMode === "function"
    ? importedNormalizeToneBehaviorMode
    : () => "";

const normalizeMessageLengthMode =
  typeof importedNormalizeMessageLengthMode === "function"
    ? importedNormalizeMessageLengthMode
    : () => "";

const normalizeEmpathyLevelMode =
  typeof importedNormalizeEmpathyLevelMode === "function"
    ? importedNormalizeEmpathyLevelMode
    : () => "";

const GREETING_WORDS = new Set([
  "salam",
  "salamlar",
  "sağol",
  "sagol",
  "hello",
  "hi",
  "hey",
  "yo",
  "sup",
  "ok",
  "okay",
  "tamam",
  "oldu",
  "beli",
  "bəli",
  "he",
  "hə",
  "yes",
  "yeah",
  "yep",
  "hola",
  "bonjour",
  "hallo",
  "merhaba",
  "selam",
  "privet",
]);

const META_CHAT_PATTERNS = [
  /\bhow are you\b/i,
  /\bhow r you\b/i,
  /\bwhat('?s| is) up\b/i,
  /\bnec[eə]s[eə]n\b/i,
  /\bn[eə] var n[eə] yox\b/i,
  /\bne var\b/i,
  /\bnecə gedir\b/i,
  /\bnecesen\b/i,
  /\bcan you hear me\b/i,
  /\bhello\?\b/i,
  /\bhey\?\b/i,
];

const PRICING_KEYWORDS = [
  "qiymət",
  "qiymeti",
  "qiymətlər",
  "price",
  "pricing",
  "cost",
  "costs",
  "quote",
  "quotation",
  "offer",
  "təklif",
  "manat",
  "azn",
  "usd",
  "eur",
  "from",
  "başlanğıc",
  "başlangic",
  "starting",
  "minimum",
  "free",
  "ödəniş",
  "odenis",
  "payment",
  "paid",
  "deposit",
  "paket",
  "package",
];

const PRICING_CONTEXT_PATTERNS = [
  /\bxidmətə görə\b/i,
  /\bxidmete gore\b/i,
  /\bservice-based\b/i,
  /\bdepends on the service\b/i,
  /\bdepends by service\b/i,
  /\bvaries by service\b/i,
  /\bdəyişir\b/i,
  /\bdeyisir\b/i,
  /\bvaries\b/i,
  /\bdepends\b/i,
  /\bsabit\b/i,
  /\bfixed\b/i,
  /\bbaşlanğıc qiymət\b/i,
  /\bstarts? from\b/i,
  /\bquote required\b/i,
  /\bəvvəlcə sorğu\b/i,
  /\bevvelce sorgu\b/i,
  /\brequest first\b/i,
  /\bdetails first\b/i,
  /\bpublic qiymət vermirik\b/i,
  /\bdo not share exact prices\b/i,
];

const HANDOFF_KEYWORDS = [
  "insan",
  "operator",
  "manager",
  "admin",
  "doctor",
  "həkim",
  "hekim",
  "owner",
  "human",
  "real person",
  "call me",
  "zəng",
  "zeng",
  "urgent",
  "təcili",
  "tecli",
  "refund",
  "şikayət",
  "sikayet",
  "complaint",
  "problem",
  "problemli",
  "ödəmə",
  "odeme",
  "payment issue",
  "medical",
  "risk",
  "escalate",
  "handoff",
  "handover",
  "yönləndir",
  "yonlendir",
];

const HANDOFF_CONDITION_WORDS = [
  "if",
  "when",
  "hallarda",
  "halda",
  "olanda",
  "əgər",
  "eger",
  "requested",
  "request",
  "wants",
  "deyirsə",
  "deyirse",
  "soruşsa",
  "sorussa",
  "cannot",
  "can't",
  "cant",
  "anlamır",
  "anlamir",
  "başa düşmür",
  "basa dusmur",
  "doesn't understand",
  "does not understand",
];

const DESCRIPTION_WEAK_WORDS = new Set([
  "test",
  "testing",
  "yox",
  "no",
  "none",
  "bilmirəm",
  "bilmirem",
  "idk",
  "unknown",
]);

function normalizeText(value = "") {
  return s(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function words(value = "") {
  return normalizeText(value)
    .split(/[\s,;|/]+/)
    .map((item) => s(item))
    .filter(Boolean);
}

function splitMeaningfulChunks(value = "") {
  return String(value || "")
    .split(/\n|,|;|\u2022|\/+/g)
    .map((item) => s(item))
    .filter(Boolean);
}

function hasDigits(value = "") {
  return /\d/.test(String(value || ""));
}

function hasPhoneLike(value = "") {
  return /(?:\+?\d[\d()\-\s]{6,}\d)/.test(String(value || ""));
}

function hasEmailLike(value = "") {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(String(value || ""));
}

function hasUrlLike(value = "") {
  return Boolean(buildRecognizedSourceCandidate(value));
}

function extractRecognizedUrl(value = "") {
  return s(buildRecognizedSourceCandidate(value)?.value).toLowerCase();
}

function containsAnyKeyword(value = "", keywords = []) {
  const text = normalizeText(value);
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function countKeywordMatches(value = "", keywords = []) {
  const text = normalizeText(value);
  const matched = new Set();

  for (const keyword of keywords) {
    const safeKeyword = normalizeText(keyword);
    if (safeKeyword && text.includes(safeKeyword)) {
      matched.add(safeKeyword);
    }
  }

  return matched.size;
}

function hasAnyPattern(value = "", patterns = []) {
  return patterns.some((pattern) => pattern.test(String(value || "")));
}

function isPureGreeting(value = "") {
  const text = normalizeText(value);
  if (!text) return true;
  if (META_CHAT_PATTERNS.some((pattern) => pattern.test(text))) return true;

  const tokenList = words(text);
  if (!tokenList.length) return true;

  return tokenList.every((token) => GREETING_WORDS.has(token));
}

function isMetaChat(value = "") {
  const text = normalizeText(value);
  if (!text) return true;
  return META_CHAT_PATTERNS.some((pattern) => pattern.test(text));
}

function isMeaningfulServiceTitle(value = "") {
  const text = normalizeText(value);
  if (!text) return false;
  if (isPureGreeting(text)) return false;
  if (isMetaChat(text)) return false;
  if (DESCRIPTION_WEAK_WORDS.has(text)) return false;
  if (hasPhoneLike(text) || hasEmailLike(text) || hasUrlLike(text)) return false;
  if (containsAnyKeyword(text, PRICING_KEYWORDS)) return false;

  const tokenList = words(text);
  if (!tokenList.length) return false;
  if (tokenList.length === 1 && GREETING_WORDS.has(tokenList[0])) return false;

  return true;
}

function parseMeaningfulServices(value = "") {
  const parsed = parseServicesNote(value, []);

  const titles = parsed
    .map((item) => s(item?.title || item?.name || item?.label))
    .filter((item) => isMeaningfulServiceTitle(item));

  if (titles.length) return titles;

  return value
    .split(/\n|,|;|\u2022/g)
    .map((item) => s(item))
    .filter((item) => isMeaningfulServiceTitle(item))
    .slice(0, 16);
}

function parseMeaningfulContacts(value = "") {
  const text = s(value);
  if (!text) return [];

  const candidates = [];

  const source = buildRecognizedSourceCandidate(text);
  if (source?.value) {
    candidates.push(source.value);
  }

  const phones = text.match(/(?:\+?\d[\d()\-\s]{6,}\d)/g) || [];
  candidates.push(...phones.map((item) => s(item)));

  const emails =
    text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  candidates.push(...emails.map((item) => s(item)));

  const listItems = text
    .split(/\n|,|;|\u2022/g)
    .map((item) => s(item))
    .filter(Boolean);

  for (const item of listItems) {
    const type = inferContactType(item);
    if (
      type === "phone" ||
      type === "email" ||
      type === "link" ||
      /whatsapp|wp|telegram|instagram|facebook|wa\.me/i.test(item)
    ) {
      candidates.push(item);
    }
  }

  return [...new Set(candidates.map((item) => s(item)).filter(Boolean))].slice(
    0,
    16
  );
}

function hasMeaningfulHoursText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isPureGreeting(text) || isMetaChat(text)) return false;

  const parsed = parseHoursNote(text, []);
  return arr(parsed).some((item) => {
    const row = obj(item);
    return Boolean(
      row.allDay === true ||
        row.appointmentOnly === true ||
        row.closed === true ||
        s(row.openTime) ||
        s(row.closeTime) ||
        s(row.notes)
    );
  });
}

function hasMeaningfulPricingText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isPureGreeting(text) || isMetaChat(text)) return false;

  const hasExplicitPricingSignal =
    containsAnyKeyword(text, PRICING_KEYWORDS) ||
    hasAnyPattern(text, PRICING_CONTEXT_PATTERNS) ||
    hasDigits(text);

  if (!hasExplicitPricingSignal) return false;

  const parsed = parsePricingNote(text, {}, []);
  return Boolean(
    s(parsed.publicSummary) ||
      s(parsed.pricingMode) ||
      s(parsed.pricingNotes) ||
      Number.isFinite(Number(parsed.startingAt)) ||
      Number.isFinite(Number(parsed.minPrice)) ||
      hasAnyPattern(text, PRICING_CONTEXT_PATTERNS)
  );
}

function hasMeaningfulHandoffText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isPureGreeting(text) || isMetaChat(text)) return false;

  const hasHandoffKeyword = containsAnyKeyword(text, HANDOFF_KEYWORDS);
  const hasConditionKeyword = containsAnyKeyword(text, HANDOFF_CONDITION_WORDS);

  if (hasHandoffKeyword && hasConditionKeyword) return true;

  const chunkMatches = splitMeaningfulChunks(text).filter((chunk) =>
    containsAnyKeyword(chunk, HANDOFF_KEYWORDS)
  ).length;

  if (chunkMatches >= 1) return true;

  if (countKeywordMatches(text, HANDOFF_KEYWORDS) >= 2) return true;

  return /if|when|əgər|eger|hallarda|olanda/i.test(text) &&
    /operator|insan|human|manager|admin|doctor|həkim|hekim/i.test(text);
}

function hasMeaningfulDescriptionText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isPureGreeting(text) || isMetaChat(text)) return false;
  if (DESCRIPTION_WEAK_WORDS.has(normalizeText(text))) return false;
  if (hasPhoneLike(text) || hasEmailLike(text)) return false;

  const tokenList = words(text);
  if (tokenList.length === 1 && GREETING_WORDS.has(tokenList[0])) return false;

  return tokenList.length >= 1;
}

function hasMeaningfulCompanyText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isPureGreeting(text) || isMetaChat(text)) return false;

  const source = buildRecognizedSourceCandidate(text);
  const stripped = source?.raw
    ? normalizeText(text.replace(source.raw, " "))
    : normalizeText(text);

  if (!stripped && source?.type === "website") return true;
  if (!stripped) return false;

  const tokenList = words(stripped);
  if (!tokenList.length) return false;
  if (tokenList.every((token) => GREETING_WORDS.has(token))) return false;

  return tokenList.length <= 8 || /^[\p{L}\p{N} .&'-]+$/u.test(stripped);
}

function pricingBehaviorUrlLooksValid(value = "") {
  const url = extractRecognizedUrl(value);
  if (!url) return false;
  return /pricing|price|menu|qiymet|qiymət/.test(url);
}

function locationBehaviorUrlLooksValid(value = "") {
  const url = extractRecognizedUrl(value);
  if (!url) return false;
  return /maps|map|directions|location|contact|g\.page|maps\.app|google\..*\/maps/.test(
    url
  );
}

function bookingBehaviorUrlLooksValid(value = "") {
  const url = extractRecognizedUrl(value);
  if (!url) return false;
  return /book|booking|reserve|reservation|appointment|wa\.me|instagram/.test(
    url
  );
}

function contactBehaviorUrlLooksValid(value = "") {
  const url = extractRecognizedUrl(value);
  if (!url) return false;
  return /contact|wa\.me|whatsapp|telegram|instagram|facebook|mailto:/.test(url);
}

function hasMeaningfulGreetingBehaviorText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isMetaChat(text)) return false;

  const mode = normalizeGreetingBehaviorMode(text);
  if (mode) return true;

  return Boolean(
    /(greet|greeting|salam|hello|hi|opening|açılış|ilk mesaj)/i.test(text) ||
      text.length >= 8
  );
}

function hasMeaningfulClosingBehaviorText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isMetaChat(text)) return false;

  const mode = normalizeClosingBehaviorMode(text);
  if (mode) return true;

  return Boolean(
    /(closing|close|sağollaş|sagollas|ending|sonluq|növbəti addım|next step)/i.test(
      text
    ) || text.length >= 8
  );
}

function hasMeaningfulToneBehaviorText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isMetaChat(text)) return false;

  const toneMode = normalizeToneBehaviorMode(text);
  const lengthMode = normalizeMessageLengthMode(text);
  const empathyLevel = normalizeEmpathyLevelMode(text);

  if (toneMode || lengthMode || empathyLevel) return true;

  return Boolean(
    /(tone|rəftar|davranış|behavior|style|professional|warm|premium|human|direct|concise|empat)/i.test(
      text
    )
  );
}

function hasMeaningfulPricingBehaviorText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isPureGreeting(text) || isMetaChat(text)) return false;

  const mode = normalizePricingBehaviorMode(text);
  if (mode) return true;

  return Boolean(
    /(link|page|səhifə|pricing page|price list|menu)/i.test(text) ||
      /(cavab|answer|reply)/i.test(text) ||
      /(service|xidmət).*(soruş|ask)/i.test(text) ||
      /(quote|sorğu|detal|details)/i.test(text) ||
      pricingBehaviorUrlLooksValid(text)
  );
}

function hasMeaningfulLocationBehaviorText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isPureGreeting(text) || isMetaChat(text)) return false;

  const mode = normalizeLocationBehaviorMode(text);
  if (mode) return true;

  return Boolean(
    /(xəritə|map|google maps|directions|address|ünvan)/i.test(text) ||
      locationBehaviorUrlLooksValid(text)
  );
}

function hasMeaningfulBookingBehaviorText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isPureGreeting(text) || isMetaChat(text)) return false;

  const mode = normalizeBookingBehaviorMode(text);
  if (mode) return true;

  return Boolean(
    /(booking|book|reserve|reservation|appointment)/i.test(text) ||
      /(whatsapp|instagram|website|site|wa\.me|dm)/i.test(text) ||
      /(collect|topla|məlumat|details)/i.test(text) ||
      bookingBehaviorUrlLooksValid(text)
  );
}

function hasMeaningfulContactBehaviorText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isPureGreeting(text) || isMetaChat(text)) return false;

  const mode = normalizeContactBehaviorMode(text);
  if (mode) return true;

  return Boolean(
    /(whatsapp|phone|call|email|link|telegram|instagram|facebook)/i.test(text) ||
      contactBehaviorUrlLooksValid(text)
  );
}

function hasMeaningfulHandoffBehaviorText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isPureGreeting(text) || isMetaChat(text)) return false;

  const mode = normalizeHandoffBehaviorMode(text);
  if (mode) return true;

  return Boolean(
    /(context|kontekst|case by case|uyğun halda)/i.test(text) ||
      /(reason|səbəb|niyə|why|clarify|izah)/i.test(text) ||
      /(direct|birbaşa|dərhal)/i.test(text)
  );
}

function validateCompanyAnswer(answer = "") {
  const source = buildRecognizedSourceCandidate(answer);
  const accepted =
    hasMeaningfulCompanyText(answer) || Boolean(source?.type === "website");

  return {
    accepted,
    reasonCode: accepted ? "accepted_company" : "rejected_company",
    reason: accepted
      ? ""
      : "The message does not look like a business name or website.",
  };
}

function validateDescriptionAnswer(answer = "") {
  const accepted = hasMeaningfulDescriptionText(answer);

  return {
    accepted,
    reasonCode: accepted ? "accepted_description" : "rejected_description",
    reason: accepted
      ? ""
      : "The message does not look like a business description.",
  };
}

function validateServicesAnswer(answer = "") {
  const services = parseMeaningfulServices(answer);
  const accepted = services.length > 0;

  return {
    accepted,
    reasonCode: accepted ? "accepted_services" : "rejected_services",
    reason: accepted
      ? ""
      : "The message does not contain recognizable service names.",
    extractedValues: services,
  };
}

function validateContactsAnswer(answer = "") {
  const contacts = parseMeaningfulContacts(answer);
  const accepted = contacts.length > 0;

  return {
    accepted,
    reasonCode: accepted ? "accepted_contacts" : "rejected_contacts",
    reason: accepted
      ? ""
      : "The message does not contain a usable contact route.",
    extractedValues: contacts,
  };
}

function validateHoursAnswer(answer = "") {
  const accepted = hasMeaningfulHoursText(answer);

  return {
    accepted,
    reasonCode: accepted ? "accepted_hours" : "rejected_hours",
    reason: accepted ? "" : "The message does not look like working hours.",
  };
}

function validatePricingAnswer(answer = "") {
  const accepted = hasMeaningfulPricingText(answer);

  return {
    accepted,
    reasonCode: accepted ? "accepted_pricing" : "rejected_pricing",
    reason: accepted
      ? ""
      : "The message does not look like a pricing instruction or pricing rule.",
  };
}

function validateHandoffAnswer(answer = "") {
  const accepted = hasMeaningfulHandoffText(answer);

  return {
    accepted,
    reasonCode: accepted ? "accepted_handoff" : "rejected_handoff",
    reason: accepted
      ? ""
      : "The message does not look like a handoff rule or escalation condition.",
  };
}

function validateGreetingBehaviorAnswer(answer = "") {
  const accepted = hasMeaningfulGreetingBehaviorText(answer);

  return {
    accepted,
    reasonCode: accepted
      ? "accepted_greeting_behavior"
      : "rejected_greeting_behavior",
    reason: accepted
      ? ""
      : "The message does not look like a greeting behavior preference.",
  };
}

function validateClosingBehaviorAnswer(answer = "") {
  const accepted = hasMeaningfulClosingBehaviorText(answer);

  return {
    accepted,
    reasonCode: accepted
      ? "accepted_closing_behavior"
      : "rejected_closing_behavior",
    reason: accepted
      ? ""
      : "The message does not look like a closing behavior preference.",
  };
}

function validateToneBehaviorAnswer(answer = "") {
  const accepted = hasMeaningfulToneBehaviorText(answer);

  return {
    accepted,
    reasonCode: accepted
      ? "accepted_tone_behavior"
      : "rejected_tone_behavior",
    reason: accepted
      ? ""
      : "The message does not look like a tone or manner preference.",
  };
}

function validatePricingBehaviorAnswer(answer = "") {
  const accepted = hasMeaningfulPricingBehaviorText(answer);

  return {
    accepted,
    reasonCode: accepted
      ? "accepted_pricing_behavior"
      : "rejected_pricing_behavior",
    reason: accepted
      ? ""
      : "The message does not look like a pricing response preference.",
  };
}

function validateLocationBehaviorAnswer(answer = "") {
  const accepted = hasMeaningfulLocationBehaviorText(answer);

  return {
    accepted,
    reasonCode: accepted
      ? "accepted_location_behavior"
      : "rejected_location_behavior",
    reason: accepted
      ? ""
      : "The message does not look like a location response preference.",
  };
}

function validateBookingBehaviorAnswer(answer = "") {
  const accepted = hasMeaningfulBookingBehaviorText(answer);

  return {
    accepted,
    reasonCode: accepted
      ? "accepted_booking_behavior"
      : "rejected_booking_behavior",
    reason: accepted
      ? ""
      : "The message does not look like a booking routing preference.",
  };
}

function validateContactBehaviorAnswer(answer = "") {
  const accepted = hasMeaningfulContactBehaviorText(answer);

  return {
    accepted,
    reasonCode: accepted
      ? "accepted_contact_behavior"
      : "rejected_contact_behavior",
    reason: accepted
      ? ""
      : "The message does not look like a contact channel preference.",
  };
}

function validateHandoffBehaviorAnswer(answer = "") {
  const accepted = hasMeaningfulHandoffBehaviorText(answer);

  return {
    accepted,
    reasonCode: accepted
      ? "accepted_handoff_behavior"
      : "rejected_handoff_behavior",
    reason: accepted
      ? ""
      : "The message does not look like a handoff behavior preference.",
  };
}

export function validateStepAnswer(step = "", answer = "", currentDraft = {}) {
  void currentDraft;

  const normalizedStep = normalizeQuestionKey(step);

  if (!normalizedStep) {
    return {
      accepted: false,
      reasonCode: "unknown_step",
      reason: "Unknown setup step.",
    };
  }

  if (!s(answer)) {
    return {
      accepted: false,
      reasonCode: "empty_answer",
      reason: "Empty answer.",
    };
  }

  if (normalizedStep === "company") return validateCompanyAnswer(answer);
  if (normalizedStep === "description") return validateDescriptionAnswer(answer);
  if (normalizedStep === "services") return validateServicesAnswer(answer);
  if (normalizedStep === "contacts") return validateContactsAnswer(answer);
  if (normalizedStep === "hours") return validateHoursAnswer(answer);
  if (normalizedStep === "pricing") return validatePricingAnswer(answer);
  if (normalizedStep === "handoff") return validateHandoffAnswer(answer);

  if (normalizedStep === "greeting_behavior") {
    return validateGreetingBehaviorAnswer(answer);
  }
  if (normalizedStep === "closing_behavior") {
    return validateClosingBehaviorAnswer(answer);
  }
  if (normalizedStep === "tone_behavior") {
    return validateToneBehaviorAnswer(answer);
  }
  if (normalizedStep === "pricing_behavior") {
    return validatePricingBehaviorAnswer(answer);
  }
  if (normalizedStep === "location_behavior") {
    return validateLocationBehaviorAnswer(answer);
  }
  if (normalizedStep === "booking_behavior") {
    return validateBookingBehaviorAnswer(answer);
  }
  if (normalizedStep === "contact_behavior") {
    return validateContactBehaviorAnswer(answer);
  }
  if (normalizedStep === "handoff_behavior") {
    return validateHandoffBehaviorAnswer(answer);
  }

  return {
    accepted: false,
    reasonCode: "unsupported_step",
    reason: "Unsupported setup step.",
  };
}

function extractDraftFieldValue(step = "", draft = {}) {
  const normalizedStep = normalizeQuestionKey(step);
  const safeDraft = obj(draft);
  const behaviorDraft = obj(safeDraft.assistantBehaviorDraft);

  if (normalizedStep === "company") {
    return s(obj(safeDraft.businessProfile).companyName);
  }

  if (normalizedStep === "description") {
    return s(obj(safeDraft.businessProfile).description);
  }

  if (normalizedStep === "services") {
    return arr(safeDraft.services)
      .map((item) => s(item?.title || item?.name || item?.label))
      .filter(Boolean)
      .join(", ");
  }

  if (normalizedStep === "contacts") {
    return arr(safeDraft.contacts)
      .map((item) => s(item?.value || item?.label || item?.type))
      .filter(Boolean)
      .join(", ");
  }

  if (normalizedStep === "hours") {
    return arr(safeDraft.hours)
      .map((row) => {
        const item = obj(row);
        if (item.allDay === true) return `${s(item.day)} 24/7`;
        if (item.appointmentOnly === true) return `${s(item.day)} appointment only`;
        if (item.closed === true) return `${s(item.day)} closed`;
        if (s(item.openTime) || s(item.closeTime)) {
          return `${s(item.day)} ${s(item.openTime)}-${s(item.closeTime)}`.trim();
        }
        return s(item.notes);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (normalizedStep === "pricing") {
    return s(obj(safeDraft.pricingPosture).publicSummary);
  }

  if (normalizedStep === "handoff") {
    return s(
      obj(safeDraft.handoffRules).summary ||
        arr(obj(safeDraft.handoffRules).triggers).join(", ")
    );
  }

  if (normalizedStep === "greeting_behavior") {
    const policy = obj(behaviorDraft.greetingPolicy);
    const overrides = obj(behaviorDraft.tenantOverrides);
    const platformDefaults = obj(behaviorDraft.platformDefaults);

    return [
      s(policy.mode || platformDefaults.greetingMode),
      s(policy.openingLine),
      s(policy.followupLeadIn),
      policy.mentionBusinessName === false ? "no business name" : "",
      overrides.greetingOverrideActive === true ? "override active" : "",
      s(policy.note),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (normalizedStep === "closing_behavior") {
    const policy = obj(behaviorDraft.closingPolicy);
    const overrides = obj(behaviorDraft.tenantOverrides);
    const platformDefaults = obj(behaviorDraft.platformDefaults);

    return [
      s(policy.mode || platformDefaults.closingMode),
      s(policy.closingLine),
      policy.includeNextStepPrompt === false ? "no next step prompt" : "",
      policy.includeHumanOfferWhenRelevant === false ? "no human offer" : "",
      overrides.closingOverrideActive === true ? "override active" : "",
      s(policy.note),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (normalizedStep === "tone_behavior") {
    const policy = obj(behaviorDraft.tonePolicy);
    const overrides = obj(behaviorDraft.tenantOverrides);
    const platformDefaults = obj(behaviorDraft.platformDefaults);

    return [
      s(policy.mode || platformDefaults.toneMode),
      s(policy.messageLength || platformDefaults.messageLength),
      s(policy.empathyLevel || platformDefaults.empathyLevel),
      policy.shouldSoundPremium === true ? "premium" : "",
      policy.shouldSoundLocalFriendly === true ? "local friendly" : "",
      policy.shouldStayConcise === true ? "concise" : "",
      overrides.toneOverrideActive === true ? "override active" : "",
      s(policy.note),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (normalizedStep === "pricing_behavior") {
    const policy = obj(behaviorDraft.pricingPolicy);
    return [
      s(policy.mode),
      s(policy.preferredTargetUrl),
      s(policy.fallbackTargetUrl),
      s(policy.note),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (normalizedStep === "location_behavior") {
    const policy = obj(behaviorDraft.locationPolicy);
    return [
      s(policy.mode),
      s(policy.preferredTargetUrl),
      s(policy.fallbackTargetUrl),
      s(policy.note),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (normalizedStep === "booking_behavior") {
    const policy = obj(behaviorDraft.bookingPolicy);
    return [
      s(policy.mode),
      s(policy.preferredTargetUrl),
      s(policy.fallbackTargetUrl),
      s(policy.note),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (normalizedStep === "contact_behavior") {
    const policy = obj(behaviorDraft.contactPolicy);
    return [
      s(policy.mode),
      s(policy.preferredChannel),
      s(policy.preferredTargetUrl),
      s(policy.fallbackTargetUrl),
      s(policy.note),
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (normalizedStep === "handoff_behavior") {
    const policy = obj(behaviorDraft.handoffPolicy);
    return [
      s(policy.mode),
      policy.requiresReason === true ? "requires reason" : "",
      s(policy.note),
    ]
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

export function buildApprovalBlockers(draft = {}) {
  const requiredBusinessSteps = [
    "company",
    "description",
    "services",
    "contacts",
    "pricing",
  ];

  return requiredBusinessSteps
    .map((step) => {
      const value = extractDraftFieldValue(step, draft);
      const validation = validateStepAnswer(step, value, draft);

      return validation.accepted
        ? null
        : {
            step,
            reasonCode: s(validation.reasonCode),
            reason: s(validation.reason),
            currentValue: s(value),
          };
    })
    .filter(Boolean);
}

export function isDraftReadyForApproval(draft = {}) {
  return buildApprovalBlockers(draft).length === 0;
}

export const __test__ = {
  normalizeText,
  isPureGreeting,
  isMetaChat,
  parseMeaningfulServices,
  parseMeaningfulContacts,
  hasMeaningfulHoursText,
  hasMeaningfulPricingText,
  hasMeaningfulHandoffText,
  hasMeaningfulDescriptionText,
  hasMeaningfulCompanyText,
  hasMeaningfulGreetingBehaviorText,
  hasMeaningfulClosingBehaviorText,
  hasMeaningfulToneBehaviorText,
  hasMeaningfulPricingBehaviorText,
  hasMeaningfulLocationBehaviorText,
  hasMeaningfulBookingBehaviorText,
  hasMeaningfulContactBehaviorText,
  hasMeaningfulHandoffBehaviorText,
  extractDraftFieldValue,
};