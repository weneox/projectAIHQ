import { arr, compactDraftObject, obj, s } from "../draftShared.js";

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

export function getNextQuestion(summary = {}, draft = {}, progress = {}) {
  void summary;
  void draft;
  void progress;
  return null;
}