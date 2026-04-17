import { arr, obj, s } from "../draftShared.js";
import {
  parseHoursNote,
  parsePricingNote,
  parseServicesNote,
} from "../setupAssistantParser.js";
import { normalizeQuestionKey } from "./questions.js";
import {
  buildRecognizedSourceCandidate,
  inferContactType,
} from "./shared.js";

const GREETING_WORDS = new Set([
  "salam",
  "salamlar",
  "sagol",
  "sağol",
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

function containsAnyKeyword(value = "", keywords = []) {
  const text = normalizeText(value);
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
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

  const hasKeyword =
    containsAnyKeyword(text, PRICING_KEYWORDS) || hasDigits(text);

  if (!hasKeyword) return false;

  const parsed = parsePricingNote(text, {}, []);
  return Boolean(
    s(parsed.publicSummary) ||
      s(parsed.pricingMode) ||
      s(parsed.pricingNotes) ||
      Number.isFinite(Number(parsed.startingAt)) ||
      Number.isFinite(Number(parsed.minPrice))
  );
}

function hasMeaningfulHandoffText(value = "") {
  const text = s(value);
  if (!text) return false;
  if (isPureGreeting(text) || isMetaChat(text)) return false;

  const hasHandoffKeyword = containsAnyKeyword(text, HANDOFF_KEYWORDS);
  const hasConditionKeyword = containsAnyKeyword(text, HANDOFF_CONDITION_WORDS);

  if (hasHandoffKeyword && hasConditionKeyword) return true;

  return /if|when|əgər|eger|hallarda|olanda/i.test(text) &&
    /operator|insan|human|manager|doctor|admin/i.test(text);
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

function validateCompanyAnswer(answer = "") {
  const source = buildRecognizedSourceCandidate(answer);
  const accepted =
    hasMeaningfulCompanyText(answer) ||
    Boolean(source?.type === "website");

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
    reason: accepted
      ? ""
      : "The message does not look like working hours.",
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

  return {
    accepted: false,
    reasonCode: "unsupported_step",
    reason: "Unsupported setup step.",
  };
}

function extractDraftFieldValue(step = "", draft = {}) {
  const normalizedStep = normalizeQuestionKey(step);
  const safeDraft = obj(draft);

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

  return "";
}

export function buildApprovalBlockers(draft = {}) {
  const steps = [
    "company",
    "description",
    "services",
    "contacts",
    "hours",
    "pricing",
    "handoff",
  ];

  return steps
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
  extractDraftFieldValue,
};