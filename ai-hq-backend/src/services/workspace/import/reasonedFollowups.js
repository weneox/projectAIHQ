// ai-hq-backend/src/services/workspace/import/reasonedFollowups.js

import { arr, obj, s, lower, compactObject, uniqStrings } from "./shared.js";

function cleanText(value = "", max = 240) {
  const text = s(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function stableKey(value = "") {
  return lower(cleanText(value, 400))
    .replace(/[^\p{L}\p{N}\s/_-]+/gu, " ")
    .replace(/\s+/g, "_")
    .trim();
}

function uniqueBy(list = [], getKey = (item) => item) {
  const seen = new Set();
  const out = [];

  for (const item of arr(list)) {
    const rawKey =
      typeof getKey === "function" ? getKey(item) : obj(item)?.[getKey];
    const key =
      typeof rawKey === "string"
        ? rawKey
        : rawKey == null
          ? ""
          : JSON.stringify(rawKey);

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function hasValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return s(value) !== "";
}

function buildGapMap(draft = {}) {
  const x = obj(draft);
  const profile = obj(x.businessProfile);
  const draftPayload = obj(x.draftPayload);

  const unknowns = uniqStrings([
    ...arr(x.unknowns),
    ...arr(draftPayload.unknowns),
  ]);

  const services = arr(x.services);
  const knowledgeItems = arr(x.knowledgeItems);

  return {
    servicesUnclear:
      unknowns.includes("services_unclear") ||
      (!services.length && !arr(profile.services).length),

    pricingUnclear:
      unknowns.includes("pricing_unclear") ||
      !hasValue(profile.pricingPolicy) &&
        !hasValue(profile.pricingText) &&
        !arr(profile.pricingHints).length,

    hoursUnclear:
      unknowns.includes("hours_unclear") ||
      !arr(profile.hours).length,

    contactUnclear:
      unknowns.includes("contact_route_unclear") ||
      !hasValue(profile.primaryPhone) &&
        !hasValue(profile.primaryEmail) &&
        !arr(profile.whatsappLinks).length &&
        !arr(profile.bookingLinks).length &&
        !arr(profile.socialLinks).length,

    handoffUnclear:
      unknowns.includes("handoff_policy_unclear") ||
      !knowledgeItems.some((item) =>
        /\b(handoff|operator|human|escalat|şikayət|complaint|support route)\b/i.test(
          `${item?.title || ""} ${item?.valueText || ""}`
        )
      ),

    summaryWeak:
      !hasValue(profile.companySummaryShort) &&
      !hasValue(profile.companySummaryLong),

    faqWeak:
      !knowledgeItems.some((item) => lower(item?.category).includes("faq")) &&
      !arr(profile.faqItems).length,
  };
}

function buildBusinessSnapshot(draft = {}) {
  const x = obj(draft);
  const profile = obj(x.businessProfile);
  const payload = obj(x.draftPayload);

  const companyName = cleanText(
    profile.companyName || profile.displayName || profile.companyTitle,
    160
  );

  const services = uniqStrings([
    ...arr(profile.services).map((item) => cleanText(item, 120)),
    ...arr(x.services).map((item) => cleanText(item?.title || item, 120)),
  ]).slice(0, 6);

  const pricingHints = uniqStrings([
    ...arr(profile.pricingHints).map((item) => cleanText(item, 160)),
  ]).slice(0, 4);

  return compactObject({
    companyName,
    summary: cleanText(
      profile.companySummaryShort ||
        profile.summaryShort ||
        profile.shortDescription ||
        payload.reasoningSummary,
      320
    ),
    services,
    pricingPolicy: cleanText(profile.pricingPolicy || profile.pricingText, 220),
    pricingHints,
    contact: compactObject({
      phone: cleanText(profile.primaryPhone || profile.phone, 80),
      email: cleanText(profile.primaryEmail || profile.email, 120),
      address: cleanText(profile.primaryAddress || profile.address, 180),
      whatsappLinks: arr(profile.whatsappLinks).slice(0, 3),
      bookingLinks: arr(profile.bookingLinks).slice(0, 3),
      socialLinks: arr(profile.socialLinks).slice(0, 4),
    }),
    hours: arr(profile.hours).map((item) => cleanText(item, 120)).slice(0, 6),
    unknowns: uniqStrings([
      ...arr(x.unknowns),
      ...arr(payload.unknowns),
    ]),
    reasoningSummary: cleanText(
      x.reasoningSummary || payload.reasoningSummary,
      600
    ),
  });
}

function normalizeFollowupItem(item = {}) {
  const x = obj(item);
  const key = cleanText(x.key, 80) || stableKey(x.question || x.prompt || "");
  const question = cleanText(x.question || x.prompt || x.text, 240);

  if (!key || !question) return null;

  return compactObject({
    key,
    question,
    source: cleanText(x.source || "reasoned_followup", 60),
    reason: cleanText(x.reason, 120),
    priority:
      Number.isFinite(Number(x.priority)) ? Number(x.priority) : null,
    category: cleanText(x.category, 80),
  });
}

function buildUnknownDrivenFollowups(draft = {}) {
  const gapMap = buildGapMap(draft);
  const snapshot = buildBusinessSnapshot(draft);
  const profile = obj(draft.businessProfile);

  const out = [];

  if (gapMap.servicesUnclear) {
    out.push({
      key: "services_clarification",
      category: "services",
      priority: 100,
      reason: "services_unclear",
      question:
        snapshot.services.length > 0
          ? `These services were detected: ${snapshot.services.join(", ")}. Which ones are truly your core services and should the assistant mention first?`
          : "What are your core services that the assistant should present first?",
    });
  }

  if (gapMap.pricingUnclear) {
    out.push({
      key: "pricing_clarification",
      category: "pricing",
      priority: 95,
      reason: "pricing_unclear",
      question:
        snapshot.pricingHints.length > 0
          ? `Some pricing hints were detected: ${snapshot.pricingHints.join(" | ")}. Should the assistant mention exact prices, ranges, or only invite users to request a quote?`
          : "Should the assistant mention exact prices, price ranges, or only invite users to request a quote?",
    });
  }

  if (gapMap.contactUnclear) {
    out.push({
      key: "contact_route_clarification",
      category: "contact",
      priority: 92,
      reason: "contact_route_unclear",
      question:
        "What is the main contact route the assistant should offer first: phone, WhatsApp, Instagram DM, email, or booking link?",
    });
  }

  if (gapMap.hoursUnclear) {
    out.push({
      key: "hours_clarification",
      category: "availability",
      priority: 88,
      reason: "hours_unclear",
      question:
        "What working hours or availability should the assistant rely on?",
    });
  }

  if (gapMap.handoffUnclear) {
    out.push({
      key: "handoff_policy_clarification",
      category: "handoff",
      priority: 86,
      reason: "handoff_policy_unclear",
      question:
        "In which situations should the assistant hand the conversation to a human instead of continuing by itself?",
    });
  }

  if (gapMap.summaryWeak && !snapshot.companyName) {
    out.push({
      key: "business_identity_clarification",
      category: "identity",
      priority: 82,
      reason: "business_identity_weak",
      question:
        "In one clear sentence, how would you describe what your business actually does?",
    });
  }

  if (gapMap.faqWeak && snapshot.services.length > 0) {
    out.push({
      key: "faq_seed_clarification",
      category: "faq",
      priority: 78,
      reason: "faq_coverage_weak",
      question:
        `What are the most common customer questions about ${snapshot.services.slice(0, 3).join(", ")} that the assistant should be ready to answer?`,
    });
  }

  if (!hasValue(profile.mainLanguage) && !hasValue(profile.primaryLanguage)) {
    out.push({
      key: "language_clarification",
      category: "language",
      priority: 70,
      reason: "language_unclear",
      question:
        "Which language should the assistant primarily use when talking to customers?",
    });
  }

  return out;
}

function buildReasonedFollowupQueue(draft = {}) {
  const x = obj(draft);
  const payload = obj(x.draftPayload);

  const explicitFollowups = arr(payload.followupQuestions)
    .map((item) => normalizeFollowupItem(item))
    .filter(Boolean)
    .map((item) => ({
      ...item,
      source: item.source || "reasoned_draft_payload",
      priority:
        Number.isFinite(Number(item.priority)) ? Number(item.priority) : 90,
    }));

  const unknownDriven = buildUnknownDrivenFollowups(draft).map((item) =>
    normalizeFollowupItem({
      ...item,
      source: "unknown_gap_analysis",
    })
  ).filter(Boolean);

  const merged = uniqueBy(
    [...explicitFollowups, ...unknownDriven],
    (item) => item.key || stableKey(item.question)
  )
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
    .map((item, index) =>
      compactObject({
        rank: index + 1,
        key: item.key,
        question: item.question,
        category: item.category,
        reason: item.reason,
        source: item.source,
        priority: Number(item.priority || 0),
      })
    );

  return merged;
}

function buildAssistantContextHints(draft = {}) {
  const snapshot = buildBusinessSnapshot(draft);
  const payload = obj(draft.draftPayload);
  const gapMap = buildGapMap(draft);

  const hints = [];

  if (snapshot.companyName) {
    hints.push(`Business: ${snapshot.companyName}`);
  }

  if (snapshot.summary) {
    hints.push(`Current understanding: ${snapshot.summary}`);
  }

  if (snapshot.services.length) {
    hints.push(`Detected services: ${snapshot.services.join(", ")}`);
  }

  if (snapshot.pricingPolicy) {
    hints.push(`Pricing policy found: ${snapshot.pricingPolicy}`);
  }

  if (snapshot.contact.phone || snapshot.contact.email) {
    hints.push(
      `Known direct contact: ${[
        snapshot.contact.phone,
        snapshot.contact.email,
      ]
        .filter(Boolean)
        .join(" / ")}`
    );
  }

  if (payload.reasoningSummary) {
    hints.push(`Reasoning summary: ${cleanText(payload.reasoningSummary, 360)}`);
  }

  if (gapMap.servicesUnclear) hints.push("Do not assume services that were not clearly confirmed.");
  if (gapMap.pricingUnclear) hints.push("Do not invent fixed pricing.");
  if (gapMap.handoffUnclear) hints.push("Do not promise a handoff policy that has not been confirmed.");

  return hints;
}

export function buildReasonedOnboardingState(draft = {}) {
  const x = obj(draft);
  const payload = obj(x.draftPayload);

  const followupQueue = buildReasonedFollowupQueue(draft);
  const snapshot = buildBusinessSnapshot(draft);
  const gapMap = buildGapMap(draft);

  return compactObject({
    schema: "reasoned_onboarding_state.v1",
    businessSnapshot: snapshot,
    assistantContextHints: buildAssistantContextHints(draft),
    followupQueue,
    primaryFollowup: followupQueue[0] || null,
    unknowns: uniqStrings([
      ...arr(x.unknowns),
      ...arr(payload.unknowns),
    ]),
    gapMap,
    reasoningSummary: cleanText(
      x.reasoningSummary || payload.reasoningSummary,
      600
    ),
  });
}

export function buildAssistantQuestionEnvelope(draft = {}, currentQuestionKey = "") {
  const state = buildReasonedOnboardingState(draft);
  const queue = arr(state.followupQueue);

  const chosen =
    queue.find((item) => item.key === s(currentQuestionKey)) ||
    queue[0] ||
    null;

  return compactObject({
    schema: "setup_assistant_question_envelope.v1",
    questionKey: s(chosen?.key),
    question: cleanText(chosen?.question, 240),
    category: cleanText(chosen?.category, 80),
    reason: cleanText(chosen?.reason, 120),
    rank: Number(chosen?.rank || 0),
    totalRemainingQuestions: queue.length,
    businessSnapshot: obj(state.businessSnapshot),
    assistantContextHints: arr(state.assistantContextHints).slice(0, 8),
    reasoningSummary: cleanText(state.reasoningSummary, 600),
    unknowns: arr(state.unknowns),
  });
}

export const __test__ = {
  buildAssistantContextHints,
  buildAssistantQuestionEnvelope,
  buildBusinessSnapshot,
  buildGapMap,
  buildReasonedFollowupQueue,
  buildReasonedOnboardingState,
  buildUnknownDrivenFollowups,
  normalizeFollowupItem,
};