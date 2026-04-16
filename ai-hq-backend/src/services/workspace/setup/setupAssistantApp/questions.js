import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import { hasNonManualSourceIdentity, normalizeSourceType } from "./shared.js";

export const SECTION_ORDER = [
  "profile",
  "services",
  "hours",
  "pricing",
  "contacts",
  "handoff",
];

export const SECTION_META = {
  source_capture: {
    key: "source_capture",
    label: "Public source",
    group: "business_truth",
    groupLabel: "Business truth",
  },
  profile: {
    key: "profile",
    label: "Identity",
    group: "business_truth",
    groupLabel: "Business truth",
  },
  company: {
    key: "company",
    label: "Business name",
    group: "business_truth",
    groupLabel: "Business truth",
  },
  description: {
    key: "description",
    label: "Business description",
    group: "business_truth",
    groupLabel: "Business truth",
  },
  website: {
    key: "website",
    label: "Website",
    group: "business_truth",
    groupLabel: "Business truth",
  },
  services: {
    key: "services",
    label: "Services",
    group: "business_truth",
    groupLabel: "Business truth",
  },
  hours: {
    key: "hours",
    label: "Hours",
    group: "business_truth",
    groupLabel: "Business truth",
  },
  pricing: {
    key: "pricing",
    label: "Pricing posture",
    group: "business_truth",
    groupLabel: "Business truth",
  },
  contacts: {
    key: "contacts",
    label: "Contact route",
    group: "business_truth",
    groupLabel: "Business truth",
  },
  handoff: {
    key: "handoff",
    label: "Human handoff",
    group: "business_truth",
    groupLabel: "Business truth",
  },
};

export const INTENT_ONLY_RESPONSES = {
  ok: "__continue__",
  okay: "__continue__",
  davam: "__continue__",
  continue: "__continue__",
  next: "__continue__",
  beli: "__continue__",
  hə: "__continue__",
  he: "__continue__",
  oldu: "__continue__",
  tamam: "__continue__",
  skip: "__skip__",
  keç: "__skip__",
  kec: "__skip__",
  "24/7": "__always_open__",
  "24 7": "__always_open__",
  "always open": "__always_open__",
  "appointment only": "__appointment_only__",
  "exact pricing requires a quote": "__quote_required__",
  "quote required": "__quote_required__",
};

function normalizeText(value = "") {
  return s(value).replace(/\s+/g, " ").trim();
}

function normalizeQuestionKey(value = "") {
  const key = s(value).toLowerCase();
  if (!key) return "";

  if (key === "contact") return "contacts";
  if (key === "price") return "pricing";
  if (key === "pricing_posture") return "pricing";
  if (key === "business_name") return "company";
  if (key === "business_description") return "description";

  return key;
}

export function buildAssistantQuestion(key = "", overrides = {}) {
  const questionKey = normalizeQuestionKey(key);
  const meta = obj(SECTION_META[questionKey] || SECTION_META.profile);
  const source = obj(overrides);

  return compactDraftObject({
    key: questionKey || s(meta.key).toLowerCase(),
    step: s(source.step || questionKey || meta.key).toLowerCase(),
    label: s(source.label || meta.label),
    title: s(source.title),
    prompt: normalizeText(source.prompt),
    placeholder: s(source.placeholder),
    group: s(source.group || meta.group || "business_truth"),
    groupLabel: s(source.groupLabel || meta.groupLabel || "Business truth"),
    priority: Number(source.priority || 0) || undefined,
  });
}

export function hasSetupSignalForInterview(draft = {}) {
  const safeDraft = obj(draft);
  const businessProfile = obj(safeDraft.businessProfile);
  const sourceMetadata = obj(safeDraft.sourceMetadata);

  return Boolean(
    s(businessProfile.companyName) ||
      s(businessProfile.description) ||
      s(businessProfile.websiteUrl) ||
      arr(safeDraft.services).length ||
      arr(safeDraft.contacts).length ||
      arr(safeDraft.hours).length ||
      s(obj(safeDraft.pricingPosture).publicSummary) ||
      s(obj(safeDraft.handoffRules).summary) ||
      s(sourceMetadata.primarySourceType) ||
      s(sourceMetadata.primarySourceUrl) ||
      arr(sourceMetadata.sourceLabels).length ||
      arr(sourceMetadata.evidenceSummary).length
  );
}

const SOURCE_CAPTURE_PROMPT =
  "Send the best public source you have first. A website, Google Maps, or Instagram link is enough to start.";

const PROFILE_COMBINED_PROMPT =
  "Confirm the business name and a reliable short description first. Add the website if the business has one.";

const PROFILE_NAME_PROMPT =
  "What is the exact public business name?";

const PROFILE_DESCRIPTION_PROMPT =
  "Write one reliable sentence describing what the business does.";

const WEBSITE_PROMPT =
  "Add the main website if the business has one. If there is no website, send the strongest public source instead.";

const SERVICES_PROMPT =
  "List the real customer-facing services you want AI to talk about.";

const HOURS_PROMPT =
  "What public hours should AI use, or should it treat the business as appointment-only?";

const PRICING_PROMPT =
  "What is the safe public pricing rule AI can say without overpromising?";

const CONTACTS_PROMPT =
  "What is the main public contact route customers should use?";

const HANDOFF_PROMPT =
  "When should AI hand the conversation to a human operator?";

function hasRealSourceIdentity(draft = {}, summary = {}) {
  const businessProfile = obj(draft.businessProfile);
  const sourceMetadata = obj(draft.sourceMetadata);
  const profileMetric = obj(obj(summary.sectionStatus).profile).metric;

  return Boolean(
    s(businessProfile.websiteUrl) ||
      (hasNonManualSourceIdentity(sourceMetadata) &&
        (profileMetric.hasWebsite === true ||
          normalizeSourceType(sourceMetadata.primarySourceType)))
  );
}

function resolveProfileQuestion(summary = {}, draft = {}, progress = {}) {
  const profileState = obj(obj(summary.sectionStatus).profile);
  const metric = obj(profileState.metric);
  const businessProfile = obj(draft.businessProfile);
  const sourceMetadata = obj(draft.sourceMetadata);
  const currentQuestionKey = normalizeQuestionKey(progress.currentQuestionKey);

  const hasName = metric.hasName === true || Boolean(s(businessProfile.companyName));
  const hasDescription =
    metric.hasDescription === true || Boolean(s(businessProfile.description));
  const hasSourceIdentity = hasRealSourceIdentity(draft, summary);
  const strongPublicSource = hasNonManualSourceIdentity(sourceMetadata);

  if (!hasName && !hasDescription && strongPublicSource) {
    return buildAssistantQuestion("profile", {
      step: "profile",
      title: "Confirm the public identity",
      prompt: PROFILE_COMBINED_PROMPT,
      priority: 6,
    });
  }

  if (hasName && hasDescription && !hasSourceIdentity) {
    return buildAssistantQuestion("website", {
      step: "website",
      title: "Confirm the main public source",
      prompt: WEBSITE_PROMPT,
      priority: 6,
    });
  }

  if (!hasName && currentQuestionKey !== "description") {
    return buildAssistantQuestion("company", {
      step: "company",
      title: "Confirm the business name",
      prompt: PROFILE_NAME_PROMPT,
      priority: 6,
    });
  }

  if (!hasDescription && currentQuestionKey !== "company") {
    return buildAssistantQuestion("description", {
      step: "description",
      title: "Confirm the short description",
      prompt: PROFILE_DESCRIPTION_PROMPT,
      priority: 5,
    });
  }

  if (!hasSourceIdentity) {
    return buildAssistantQuestion("website", {
      step: "website",
      title: "Confirm the main public source",
      prompt: WEBSITE_PROMPT,
      priority: 5,
    });
  }

  return buildAssistantQuestion("profile", {
    step: "profile",
    title: "Confirm the public identity",
    prompt: PROFILE_COMBINED_PROMPT,
    priority: 5,
  });
}

export function getNextQuestion(summary = {}, draft = {}, progress = {}) {
  const safeSummary = obj(summary);
  const safeDraft = obj(draft);
  const safeProgress = obj(progress);
  const sectionStatus = obj(safeSummary.sectionStatus);

  if (
    safeSummary.readyForReview === true ||
    safeSummary.readyForApproval === true
  ) {
    return null;
  }

  if (!hasSetupSignalForInterview(safeDraft) && safeSummary.hasAnyDraft !== true) {
    return buildAssistantQuestion("source_capture", {
      step: "source_capture",
      label: "Public source",
      title: "Attach the first source",
      prompt: SOURCE_CAPTURE_PROMPT,
      priority: 7,
    });
  }

  if (obj(sectionStatus.profile).reviewReady !== true) {
    return resolveProfileQuestion(safeSummary, safeDraft, safeProgress);
  }

  if (obj(sectionStatus.services).reviewReady !== true) {
    return buildAssistantQuestion("services", {
      step: "services",
      title: "Curate the service menu",
      prompt: SERVICES_PROMPT,
      priority: 4,
    });
  }

  if (obj(sectionStatus.hours).reviewReady !== true) {
    return buildAssistantQuestion("hours", {
      step: "hours",
      title: "Confirm the working hours",
      prompt: HOURS_PROMPT,
      priority: 3,
    });
  }

  if (obj(sectionStatus.pricing).reviewReady !== true) {
    return buildAssistantQuestion("pricing", {
      step: "pricing",
      title: "Choose the pricing rule",
      prompt: PRICING_PROMPT,
      priority: 3,
    });
  }

  if (obj(sectionStatus.contacts).reviewReady !== true) {
    return buildAssistantQuestion("contacts", {
      step: "contacts",
      title: "Confirm the contact route",
      prompt: CONTACTS_PROMPT,
      priority: 2,
    });
  }

  if (obj(sectionStatus.handoff).reviewReady !== true) {
    return buildAssistantQuestion("handoff", {
      step: "handoff",
      title: "Define the human handoff",
      prompt: HANDOFF_PROMPT,
      priority: 1,
    });
  }

  return null;
}
