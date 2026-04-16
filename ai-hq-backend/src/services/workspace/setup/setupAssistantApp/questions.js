import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import { hasNonManualSourceIdentity } from "./shared.js";

export const SECTION_ORDER = [
  "profile",
  "services",
  "hours",
  "pricing",
  "contacts",
  "handoff",
];

export const SECTION_META = {
  profile: {
    label: "Identity",
    title: "Confirm the business identity",
    missing:
      "The business identity is still not reliable enough. We need the exact public name and one clean description.",
    review:
      "There are identity signals, but they still need a final confirmation.",
    ready: "The business identity is reliable enough to use.",
    prompt:
      "Confirm the exact public business name and one clean sentence describing what the business does.",
    placeholder:
      "Example: Neox Studio — We build AI automation, websites, and premium digital presentation systems.",
  },
  company: {
    label: "Business name",
    title: "Confirm the business name",
    prompt: "Send the exact public business name.",
    placeholder: "Example: Neox Studio",
  },
  description: {
    label: "Business description",
    title: "Confirm what the business does",
    prompt: "Send one clean sentence describing what the business does.",
    placeholder:
      "Example: We build AI automation and premium digital systems for local businesses.",
  },
  website: {
    label: "Website",
    title: "Confirm the main website",
    prompt: "Send the main website if the business has one.",
    placeholder: "Example: yourbusiness.com",
  },
  services: {
    label: "Services",
    title: "Confirm the real services",
    missing:
      "The service layer is still weak. We need real customer-facing services, not vague categories or channels.",
    review:
      "There are service signals, but they need cleanup before approval.",
    ready: "The service layer is usable.",
    prompt: "List the real customer-facing services in plain language.",
    placeholder:
      "Example: website design, AI automation setup, social content production",
  },
  hours: {
    label: "Hours",
    title: "Confirm the public hours",
    missing: "Public hours are still missing or unreliable.",
    review: "There are hour signals, but they still need confirmation.",
    ready: "Public hours are usable.",
    prompt: "Send the public weekly hours in one clean message.",
    placeholder:
      "Example: Monday–Friday 10:00–19:00, Saturday 11:00–16:00, Sunday closed",
  },
  pricing: {
    label: "Pricing posture",
    title: "Confirm the public pricing posture",
    missing: "The public pricing posture is still missing.",
    review:
      "There are pricing signals, but the public rule is not clear enough yet.",
    ready: "The pricing posture is usable.",
    prompt: "Explain how AI should answer pricing questions publicly.",
    placeholder:
      "Example: Give a starting range publicly, but exact quotes require review.",
  },
  contacts: {
    label: "Contact route",
    title: "Confirm the main contact route",
    missing: "The main public contact route is still missing.",
    review:
      "There are contact signals, but the primary route is not clear enough yet.",
    ready: "The main contact route is usable.",
    prompt: "Send the main public contact route customers should use first.",
    placeholder: "Example: WhatsApp, phone, form, or email",
  },
  handoff: {
    label: "Human handoff",
    title: "Confirm human escalation rules",
    missing: "Human escalation rules are still missing.",
    review:
      "There are handoff signals, but the policy is not sharp enough yet.",
    ready: "Human escalation rules are usable.",
    prompt: "Explain when AI must stop and hand the case to a human.",
    placeholder:
      "Example: complaints, custom quotes, payment issues, urgent requests, unclear cases",
  },
};

export const INTENT_ONLY_RESPONSES = {};

function normalizeText(value = "") {
  return s(value).replace(/\s+/g, " ").trim();
}

function buildSourceLead(draft = {}) {
  const sourceMetadata = obj(draft.sourceMetadata);
  const primarySourceUrl = s(sourceMetadata.primarySourceUrl);
  const evidenceSummary = arr(sourceMetadata.evidenceSummary)
    .map((item) => s(item))
    .filter(Boolean);

  if (primarySourceUrl) {
    return `Existing source: ${primarySourceUrl}.`;
  }

  if (evidenceSummary.length) {
    return `Existing source signals: ${evidenceSummary.slice(0, 2).join(" · ")}.`;
  }

  return "";
}

export function buildAssistantQuestion(key = "", overrides = {}) {
  const questionKey = s(key).toLowerCase();
  const meta = obj(SECTION_META[questionKey]);

  return compactDraftObject({
    key: questionKey,
    step: s(overrides.step || questionKey).toLowerCase(),
    label: s(overrides.label || meta.label),
    title: s(overrides.title || meta.title || meta.label),
    prompt: normalizeText(s(overrides.prompt || meta.prompt)),
    placeholder: s(overrides.placeholder || meta.placeholder),
    group: s(overrides.group || "business_truth"),
    groupLabel: "Business truth",
    priority: Number(overrides.priority || 0) || undefined,
  });
}

export function hasSetupSignalForInterview(draft = {}) {
  const businessProfile = obj(draft.businessProfile);
  const sourceMetadata = obj(draft.sourceMetadata);

  return Boolean(
    s(businessProfile.companyName) ||
      s(businessProfile.description) ||
      s(businessProfile.websiteUrl) ||
      arr(draft.services).length ||
      arr(draft.contacts).length ||
      arr(draft.hours).length ||
      s(obj(draft.pricingPosture).publicSummary) ||
      s(obj(draft.handoffRules).summary) ||
      s(sourceMetadata.primarySourceType) ||
      s(sourceMetadata.primarySourceUrl) ||
      arr(sourceMetadata.sourceLabels).length ||
      arr(sourceMetadata.evidenceSummary).length
  );
}

export function buildProfileQuestionPrompt(draft = {}) {
  const safeDraft = obj(draft);
  const businessProfile = obj(safeDraft.businessProfile);
  const sourceMetadata = obj(safeDraft.sourceMetadata);
  const sourceIdentityPresent = hasNonManualSourceIdentity(sourceMetadata);

  if (sourceIdentityPresent) {
    return "Confirm the business name and a reliable short description first. Add the website if the business has one.";
  }

  const parts = [];

  const sourceLead = buildSourceLead(safeDraft);
  if (sourceLead) parts.push(sourceLead);

  if (s(businessProfile.companyName)) {
    parts.push(`Current name signal: ${s(businessProfile.companyName)}.`);
  }

  if (s(businessProfile.description)) {
    parts.push("There is already a partial business description.");
  }

  parts.push(
    "Send the exact public business name and one clean sentence describing what the business does. Add the website only if the business has one."
  );

  return normalizeText(parts.join(" "));
}

export function resolveProfileQuestion(
  draft = {},
  progress = {},
  profileStatus = {}
) {
  const safeProfileStatus = obj(profileStatus);
  const currentQuestionKey = s(progress.currentQuestionKey).toLowerCase();

  if (
    safeProfileStatus.hasName === true &&
    safeProfileStatus.hasDescription === true &&
    safeProfileStatus.hasWebsite !== true
  ) {
    return buildAssistantQuestion("website", {
      priority: currentQuestionKey === "website" ? 100 : 98,
    });
  }

  return buildAssistantQuestion("profile", {
    prompt: buildProfileQuestionPrompt(draft),
    priority:
      currentQuestionKey === "profile" ||
      currentQuestionKey === "company" ||
      currentQuestionKey === "description" ||
      currentQuestionKey === "website"
        ? 100
        : 96,
  });
}

function buildQuestionFromBlocker(key = "", blocker = {}, priority = 80) {
  const meta = obj(SECTION_META[key]);
  const parts = [];

  if (s(blocker.sourceHint)) parts.push(s(blocker.sourceHint));
  if (s(blocker.metric)) parts.push(`Current signal: ${s(blocker.metric)}.`);
  if (s(blocker.reason)) parts.push(s(blocker.reason));
  parts.push(s(meta.prompt));

  return buildAssistantQuestion(key, {
    prompt: normalizeText(parts.join(" ")),
    priority,
  });
}

export function getNextQuestion(summary = {}, draft = {}, progress = {}) {
  if (summary.readyForReview === true) return null;
  if (!hasSetupSignalForInterview(draft)) return null;

  const sectionStatus = obj(summary.sectionStatus);

  if (sectionStatus.profile?.status !== "ready") {
    return resolveProfileQuestion(draft, progress, sectionStatus.profile);
  }

  const blocker = obj(arr(summary.confirmationBlockers)[0]);
  if (!s(blocker.key)) return null;

  if (blocker.key === "services") {
    return buildQuestionFromBlocker("services", blocker, 88);
  }

  if (blocker.key === "contacts") {
    return buildQuestionFromBlocker("contacts", blocker, 86);
  }

  if (blocker.key === "hours") {
    return buildQuestionFromBlocker("hours", blocker, 84);
  }

  if (blocker.key === "pricing") {
    return buildQuestionFromBlocker("pricing", blocker, 82);
  }

  if (blocker.key === "handoff") {
    return buildQuestionFromBlocker("handoff", blocker, 80);
  }

  return buildAssistantQuestion(blocker.key, {
    prompt: normalizeText(
      s(blocker.reason) || s(obj(SECTION_META[blocker.key]).prompt)
    ),
    priority: 78,
  });
}
