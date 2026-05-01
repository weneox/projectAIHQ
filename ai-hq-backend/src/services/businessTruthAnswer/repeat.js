import { arr, s, uniqStrings } from "./normalize.js";

const REPEAT_ELIGIBLE_INTENTS = new Set([
  "contact.general",
  "contact.phone",
  "contact.email",
  "contact.website",
  "contact.address",
  "identity.name",
  "business.summary",
  "business.services",
  "business.products",
  "business.pricing",
  "business.booking",
  "business.social",
  "business.language",
]);

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function lower(value = "") {
  return s(value).toLowerCase();
}

function normalizeComparable(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhoneComparable(value = "") {
  return s(value).replace(/[^\d+]/g, "");
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

function classificationIntents(classification = {}) {
  return uniqStrings([
    ...arr(classification?.intents),
    classification?.primaryIntent,
  ]);
}

function isRepeatEligible(classification = {}) {
  const intents = classificationIntents(classification);
  return intents.some((intent) => REPEAT_ELIGIBLE_INTENTS.has(intent));
}

function addFact(out, seen, key, value, kind = "text") {
  const safeValue = s(value);
  if (!safeValue) return;

  const dedupeKey = `${kind}:${normalizeComparable(safeValue)}`;
  if (seen.has(dedupeKey)) return;

  seen.add(dedupeKey);
  out.push({
    key,
    value: safeValue,
    kind,
  });
}

function buildRequestedFacts({ classification = {}, facts = {} } = {}) {
  const intents = classificationIntents(classification);

  const out = [];
  const seen = new Set();

  if (intents.includes("contact.general") || intents.includes("contact.phone")) {
    addFact(out, seen, "phone", facts.phone, "phone");
  }

  if (intents.includes("contact.general") || intents.includes("contact.email")) {
    addFact(out, seen, "email", facts.email, "email");
  }

  if (intents.includes("contact.general") || intents.includes("contact.website")) {
    addFact(out, seen, "website", facts.website, "url");
  }

  if (intents.includes("contact.general") || intents.includes("contact.address")) {
    addFact(out, seen, "address", facts.address, "text");
  }

  if (intents.includes("identity.name")) {
    addFact(out, seen, "business_name", facts.displayName, "text");
  }

  if (intents.includes("business.summary")) {
    addFact(
      out,
      seen,
      "business_summary",
      s(facts.summary) || s(facts.industry) || s(facts.displayName),
      "text"
    );
  }

  if (intents.includes("business.pricing")) {
    addFact(out, seen, "pricing", facts.pricing, "text");
  }

  if (intents.includes("business.booking")) {
    addFact(out, seen, "booking", facts.booking, "text");
  }

  if (intents.includes("business.services")) {
    for (const item of arr(facts.services)) {
      addFact(out, seen, "service", item, "text");
    }
  }

  if (intents.includes("business.products")) {
    for (const item of arr(facts.products)) {
      addFact(out, seen, "product", item, "text");
    }
  }

  if (intents.includes("business.social")) {
    for (const item of arr(facts.socialLinks)) {
      addFact(out, seen, "social", item, "url");
    }
  }

  if (intents.includes("business.language")) {
    for (const item of arr(facts.languages)) {
      addFact(out, seen, "language", item, "text");
    }
  }

  return out.slice(0, 24);
}

function containsFact(text = "", fact = {}) {
  const source = s(text);
  const value = s(fact?.value);
  const kind = s(fact?.kind);

  if (!source || !value) return false;

  if (kind === "phone") {
    const phone = normalizePhoneComparable(value);
    return Boolean(phone) && normalizePhoneComparable(source).includes(phone);
  }

  return normalizeComparable(source).includes(normalizeComparable(value));
}

function factCoverageScore(text = "", facts = []) {
  const requestedFacts = arr(facts);
  if (!requestedFacts.length) return 0;

  const hits = requestedFacts.filter((fact) => containsFact(text, fact)).length;
  return hits / requestedFacts.length;
}

function findPreviousBusinessReplyWithFacts({
  recentMessages = [],
  requestedFacts = [],
} = {}) {
  const messages = arr(recentMessages)
    .filter((message) => message && typeof message === "object")
    .slice()
    .sort((a, b) => messageTime(a) - messageTime(b))
    .reverse();

  for (const message of messages) {
    const role = messageRole(message);
    if (!["assistant", "operator", "business"].includes(role)) continue;

    const text = messageText(message);
    if (!text) continue;

    const score = factCoverageScore(text, requestedFacts);

    if (
      (requestedFacts.length <= 2 && score >= 1) ||
      (requestedFacts.length > 2 && score >= 0.7)
    ) {
      return {
        text,
        score,
        messageId: s(message?.id),
      };
    }
  }

  return null;
}

export function detectRepeatedApprovedTruthRequest({
  classification = {},
  facts = {},
  recentMessages = [],
} = {}) {
  if (!isRepeatEligible(classification)) {
    return {
      isRepeat: false,
      reason: "not_repeat_eligible",
      requestedFacts: [],
      previousBusinessReply: "",
      previousMessageId: "",
      coverageScore: 0,
    };
  }

  const requestedFacts = buildRequestedFacts({
    classification,
    facts,
  });

  if (!requestedFacts.length) {
    return {
      isRepeat: false,
      reason: "no_requested_facts",
      requestedFacts: [],
      previousBusinessReply: "",
      previousMessageId: "",
      coverageScore: 0,
    };
  }

  const previous = findPreviousBusinessReplyWithFacts({
    recentMessages,
    requestedFacts,
  });

  if (!previous) {
    return {
      isRepeat: false,
      reason: "no_previous_answer_with_same_facts",
      requestedFacts,
      previousBusinessReply: "",
      previousMessageId: "",
      coverageScore: 0,
    };
  }

  return {
    isRepeat: true,
    reason: "previous_business_reply_already_contained_requested_facts",
    requestedFacts,
    previousBusinessReply: previous.text,
    previousMessageId: previous.messageId,
    coverageScore: previous.score,
  };
}
