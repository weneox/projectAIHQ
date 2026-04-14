// ai-hq-backend/src/services/workspace/import/reasonedSetupAssistant.js

import { arr, obj, s, lower, compactObject, uniqStrings } from "./shared.js";
import {
  buildAssistantQuestionEnvelope,
  buildReasonedOnboardingState,
} from "./reasonedFollowups.js";

function cleanText(value = "", max = 320) {
  const text = s(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function hasValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return s(value) !== "";
}

function buildKnownFacts(draft = {}) {
  const x = obj(draft);
  const profile = obj(x.businessProfile);
  const payload = obj(x.draftPayload);

  const services = uniqStrings([
    ...arr(profile.services).map((item) => cleanText(item, 120)),
    ...arr(x.services).map((item) => cleanText(item?.title || item, 120)),
  ]).slice(0, 8);

  const faqQuestions = uniqStrings([
    ...arr(profile.faqItems).map((item) => cleanText(item?.question, 160)),
    ...arr(x.knowledgeItems)
      .filter((item) => lower(item?.category).includes("faq"))
      .map((item) => cleanText(item?.title, 160)),
  ]).slice(0, 8);

  return compactObject({
    companyName: cleanText(
      profile.companyName || profile.displayName || profile.companyTitle,
      160
    ),
    summaryShort: cleanText(
      profile.companySummaryShort ||
        profile.summaryShort ||
        profile.shortDescription,
      320
    ),
    summaryLong: cleanText(
      profile.companySummaryLong ||
        profile.summaryLong ||
        profile.description,
      700
    ),
    services,
    pricingPolicy: cleanText(profile.pricingPolicy || profile.pricingText, 220),
    pricingHints: arr(profile.pricingHints).map((item) => cleanText(item, 160)).slice(0, 6),
    primaryPhone: cleanText(profile.primaryPhone || profile.phone, 80),
    primaryEmail: cleanText(profile.primaryEmail || profile.email, 140),
    primaryAddress: cleanText(profile.primaryAddress || profile.address, 220),
    hours: arr(profile.hours).map((item) => cleanText(item, 120)).slice(0, 8),
    languages: uniqStrings([
      cleanText(profile.mainLanguage, 24),
      cleanText(profile.primaryLanguage, 24),
      ...arr(profile.supportedLanguages).map((item) => cleanText(item, 24)),
    ]).filter(Boolean),
    faqQuestions,
    reasoningSummary: cleanText(
      x.reasoningSummary || payload.reasoningSummary,
      700
    ),
  });
}

function buildAssistantGuardrails(draft = {}) {
  const x = obj(draft);
  const payload = obj(x.draftPayload);
  const unknowns = uniqStrings([
    ...arr(x.unknowns),
    ...arr(payload.unknowns),
  ]);

  const out = [
    "Do not invent services, prices, hours, or handoff rules.",
    "Prefer asking a focused clarification question instead of filling unknown gaps.",
    "Use only grounded business facts already extracted or explicitly confirmed by the user.",
    "Do not repeat questions if the answer is already clearly present in the draft.",
  ];

  if (unknowns.includes("services_unclear")) {
    out.push("Treat services as unresolved unless they are clearly confirmed.");
  }

  if (unknowns.includes("pricing_unclear")) {
    out.push("Do not state exact pricing unless explicitly confirmed.");
  }

  if (unknowns.includes("handoff_policy_unclear")) {
    out.push("Do not promise operator handoff behavior until it is confirmed.");
  }

  return uniqStrings(out);
}

function buildAnsweredQuestionKeys(draft = {}) {
  const x = obj(draft);
  const payload = obj(x.draftPayload);
  const answered = new Set();

  const profile = obj(x.businessProfile);

  if (arr(profile.services).length || arr(x.services).length) {
    answered.add("services_clarification");
  }

  if (
    hasValue(profile.pricingPolicy) ||
    hasValue(profile.pricingText) ||
    arr(profile.pricingHints).length
  ) {
    answered.add("pricing_clarification");
  }

  if (
    hasValue(profile.primaryPhone) ||
    hasValue(profile.primaryEmail) ||
    arr(profile.whatsappLinks).length ||
    arr(profile.bookingLinks).length ||
    arr(profile.socialLinks).length
  ) {
    answered.add("contact_clarification");
    answered.add("contact_route_clarification");
  }

  if (arr(profile.hours).length) {
    answered.add("hours_clarification");
  }

  if (hasValue(profile.mainLanguage) || hasValue(profile.primaryLanguage)) {
    answered.add("language_clarification");
  }

  const existingFollowups = arr(payload.followupQuestions).map((item) =>
    cleanText(item?.key, 80)
  );
  for (const key of existingFollowups) {
    if (!key) continue;
    if (
      arr(payload.unknowns).length === 0 &&
      arr(x.unknowns).length === 0
    ) {
      answered.add(key);
    }
  }

  return [...answered];
}

function buildQuestionQueue(draft = {}) {
  const onboardingState = buildReasonedOnboardingState(draft);
  const answeredKeys = new Set(buildAnsweredQuestionKeys(draft));

  return arr(onboardingState.followupQueue).filter(
    (item) => !answeredKeys.has(s(item?.key))
  );
}

function buildConversationStatus(draft = {}) {
  const x = obj(draft);
  const payload = obj(x.draftPayload);
  const queue = buildQuestionQueue(draft);

  return compactObject({
    phase: queue.length ? "clarification_needed" : "ready_for_review",
    unresolvedCount: uniqStrings([
      ...arr(x.unknowns),
      ...arr(payload.unknowns),
    ]).length,
    followupCount: queue.length,
    hasReasoningSummary: !!cleanText(
      x.reasoningSummary || payload.reasoningSummary,
      320
    ),
  });
}

export function buildReasonedSetupAssistantPayload({
  review = {},
  currentQuestionKey = "",
} = {}) {
  const reviewObj = obj(review);
  const draft = obj(reviewObj.draft);
  const payload = obj(draft.draftPayload);

  const questionEnvelope = buildAssistantQuestionEnvelope(
    draft,
    currentQuestionKey
  );
  const onboardingState = buildReasonedOnboardingState(draft);
  const queue = buildQuestionQueue(draft);

  return compactObject({
    schema: "reasoned_setup_assistant_payload.v1",
    reviewSessionId: s(reviewObj.session?.id || payload.reviewSessionId),
    reviewStatus: s(reviewObj.session?.status),
    conversationStatus: buildConversationStatus(draft),
    businessFacts: buildKnownFacts(draft),
    guardrails: buildAssistantGuardrails(draft),
    reasoningSummary: cleanText(
      draft.reasoningSummary || payload.reasoningSummary,
      700
    ),
    unknowns: uniqStrings([
      ...arr(draft.unknowns),
      ...arr(payload.unknowns),
    ]),
    primaryQuestion: queue[0] || obj(questionEnvelope),
    questionEnvelope,
    followupQueue: queue,
    assistantHints: arr(onboardingState.assistantContextHints).slice(0, 10),
  });
}

export function buildReasonedSetupAssistantTurn({
  review = {},
  currentQuestionKey = "",
} = {}) {
  const assistantPayload = buildReasonedSetupAssistantPayload({
    review,
    currentQuestionKey,
  });

  const primaryQuestion = obj(
    assistantPayload.primaryQuestion || assistantPayload.questionEnvelope
  );
  const businessFacts = obj(assistantPayload.businessFacts);

  const opening =
    businessFacts.companyName
      ? `I’m refining ${businessFacts.companyName} so the assistant stops guessing and starts responding from real business understanding.`
      : "I’m refining the business draft so the assistant stops guessing and starts responding from real business understanding.";

  const knownFacts = [];
  if (businessFacts.summaryShort) {
    knownFacts.push(`Current summary: ${businessFacts.summaryShort}`);
  }
  if (arr(businessFacts.services).length) {
    knownFacts.push(`Detected services: ${arr(businessFacts.services).join(", ")}`);
  }
  if (businessFacts.pricingPolicy) {
    knownFacts.push(`Pricing policy found: ${businessFacts.pricingPolicy}`);
  }
  if (businessFacts.primaryPhone || businessFacts.primaryEmail) {
    knownFacts.push(
      `Known contact: ${[businessFacts.primaryPhone, businessFacts.primaryEmail]
        .filter(Boolean)
        .join(" / ")}`
    );
  }

  const messageParts = [opening];

  if (knownFacts.length) {
    messageParts.push(knownFacts.join(" "));
  }

  if (primaryQuestion.question) {
    messageParts.push(primaryQuestion.question);
  } else {
    messageParts.push(
      "The current draft looks strong enough to move into review without asking another clarification question."
    );
  }

  return compactObject({
    schema: "reasoned_setup_assistant_turn.v1",
    role: "assistant",
    text: messageParts.join(" "),
    questionKey: cleanText(primaryQuestion.key, 80),
    questionCategory: cleanText(primaryQuestion.category, 80),
    reasoningSummary: cleanText(assistantPayload.reasoningSummary, 700),
    guardrails: arr(assistantPayload.guardrails),
    payload: assistantPayload,
  });
}

export function buildReasonedAssistantQuestionOnly({
  review = {},
  currentQuestionKey = "",
} = {}) {
  const payload = buildReasonedSetupAssistantPayload({
    review,
    currentQuestionKey,
  });

  const envelope = obj(payload.questionEnvelope);
  return compactObject({
    schema: "reasoned_setup_assistant_question.v1",
    questionKey: cleanText(envelope.questionKey || envelope.key, 80),
    question: cleanText(envelope.question, 240),
    category: cleanText(envelope.category, 80),
    reason: cleanText(envelope.reason, 120),
    totalRemainingQuestions: Number(envelope.totalRemainingQuestions || 0),
  });
}

export const __test__ = {
  buildAnsweredQuestionKeys,
  buildAssistantGuardrails,
  buildConversationStatus,
  buildKnownFacts,
  buildQuestionQueue,
  buildReasonedAssistantQuestionOnly,
  buildReasonedSetupAssistantPayload,
  buildReasonedSetupAssistantTurn,
};