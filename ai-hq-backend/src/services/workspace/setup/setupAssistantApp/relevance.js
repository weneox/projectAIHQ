import { arr, obj, s } from "../draftShared.js";
import { normalizeQuestionKey } from "./questions.js";

const REQUIRED_BUSINESS_STEPS = [
  "company",
  "description",
  "services",
  "contacts",
  "pricing",
];

function normalizeText(value = "") {
  return s(value).replace(/\s+/g, " ").trim();
}

function hasValue(value = "") {
  return Boolean(normalizeText(value));
}

function hasMeaningfulServices(value = []) {
  return arr(value).some((item) =>
    Boolean(s(item?.title || item?.name || item?.label || item))
  );
}

function hasMeaningfulContacts(value = []) {
  return arr(value).some((item) =>
    Boolean(s(item?.value || item?.label || item?.channel || item?.type || item))
  );
}

function hasMeaningfulHours(value = []) {
  return arr(value).some((item) => {
    const row = obj(item);
    return Boolean(
      row.enabled === true ||
        row.allDay === true ||
        row.appointmentOnly === true ||
        row.closed === true ||
        s(row.openTime) ||
        s(row.closeTime) ||
        s(row.notes) ||
        s(item)
    );
  });
}

function hasMeaningfulPricing(value = {}) {
  const pricing = obj(value);

  return Boolean(
    s(pricing.publicSummary) ||
      s(pricing.pricingMode) ||
      s(pricing.pricingNotes) ||
      Number.isFinite(Number(pricing.startingAt)) ||
      Number.isFinite(Number(pricing.minPrice)) ||
      s(value)
  );
}

function hasMeaningfulHandoff(value = {}) {
  const handoff = obj(value);
  return Boolean(
    handoff.enabled === true ||
      s(handoff.summary) ||
      arr(handoff.triggers).length > 0 ||
      s(value)
  );
}

function extractDraftFieldValue(step = "", draft = {}) {
  const normalizedStep = normalizeQuestionKey(step);
  const safeDraft = obj(draft);
  const businessProfile = obj(safeDraft.businessProfile);

  if (normalizedStep === "company") {
    return s(businessProfile.companyName);
  }

  if (normalizedStep === "description") {
    return s(businessProfile.description);
  }

  if (normalizedStep === "services") {
    return arr(safeDraft.services)
      .map((item) => s(item?.title || item?.name || item?.label || item))
      .filter(Boolean)
      .join(", ");
  }

  if (normalizedStep === "contacts") {
    return arr(safeDraft.contacts)
      .map((item) => s(item?.value || item?.label || item?.channel || item?.type || item))
      .filter(Boolean)
      .join(", ");
  }

  if (normalizedStep === "hours") {
    return arr(safeDraft.hours)
      .map((item) => {
        const row = obj(item);
        if (row.allDay === true) return [s(row.day), "24/7"].filter(Boolean).join(" ");
        if (row.appointmentOnly === true) {
          return [s(row.day), "appointment only"].filter(Boolean).join(" ");
        }
        if (row.closed === true) return [s(row.day), "closed"].filter(Boolean).join(" ");
        if (s(row.openTime) || s(row.closeTime)) {
          return [s(row.day), `${s(row.openTime)}-${s(row.closeTime)}`]
            .filter(Boolean)
            .join(" ");
        }
        return s(row.notes || item);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (normalizedStep === "pricing") {
    const pricing = obj(safeDraft.pricingPosture);
    return s(
      pricing.publicSummary ||
        pricing.pricingMode ||
        pricing.pricingNotes ||
        pricing.startingAt ||
        pricing.minPrice
    );
  }

  if (normalizedStep === "handoff") {
    const handoff = obj(safeDraft.handoffRules);
    return s(handoff.summary || arr(handoff.triggers).join(", "));
  }

  return "";
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

  if (REQUIRED_BUSINESS_STEPS.includes(normalizedStep)) {
    return {
      accepted: true,
      reasonCode: `accepted_${normalizedStep}`,
      reason: "",
    };
  }

  if (normalizedStep === "hours" || normalizedStep === "handoff") {
    return {
      accepted: true,
      reasonCode: `accepted_optional_${normalizedStep}`,
      reason: "",
    };
  }

  if (/_behavior$/.test(normalizedStep)) {
    return {
      accepted: true,
      reasonCode: "accepted_legacy_behavior_step",
      reason: "",
    };
  }

  return {
    accepted: false,
    reasonCode: "unsupported_step",
    reason: "Unsupported setup step.",
  };
}

export function buildApprovalBlockers(draft = {}) {
  return REQUIRED_BUSINESS_STEPS.map((step) => {
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
  }).filter(Boolean);
}

export function isDraftReadyForApproval(draft = {}) {
  return buildApprovalBlockers(draft).length === 0;
}

export const __test__ = {
  normalizeText,
  hasMeaningfulServices,
  hasMeaningfulContacts,
  hasMeaningfulHours,
  hasMeaningfulPricing,
  hasMeaningfulHandoff,
  hasMeaningfulDescriptionText: hasValue,
  hasMeaningfulCompanyText: hasValue,
  hasMeaningfulGreetingBehaviorText: hasValue,
  hasMeaningfulClosingBehaviorText: hasValue,
  hasMeaningfulToneBehaviorText: hasValue,
  hasMeaningfulPricingBehaviorText: hasValue,
  hasMeaningfulLocationBehaviorText: hasValue,
  hasMeaningfulBookingBehaviorText: hasValue,
  hasMeaningfulContactBehaviorText: hasValue,
  hasMeaningfulHandoffBehaviorText: hasValue,
  isPureGreeting: () => false,
  isMetaChat: () => false,
  parseMeaningfulServices: (value = "") =>
    String(value || "")
      .split(/\n|,|;|\u2022/g)
      .map((item) => s(item))
      .filter(Boolean),
  parseMeaningfulContacts: (value = "") =>
    String(value || "")
      .split(/\n|,|;|\u2022/g)
      .map((item) => s(item))
      .filter(Boolean),
  extractDraftFieldValue,
};
