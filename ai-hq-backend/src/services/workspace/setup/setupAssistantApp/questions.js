import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import { hasNonManualSourceIdentity, sourceTypeLabel } from "./shared.js";

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
    label: "Business identity",
    title: "Confirm the business identity",
    missing:
      "The business identity is still too weak. Lock the exact public name and one clean sentence describing what the business does.",
    review:
      "There are identity signals, but the public business identity still needs a cleaner confirmation.",
    ready:
      "The public business identity is already captured in a usable form.",
    prompt:
      "Send the exact public business name and one clean public sentence describing what the business does. Add the website too if the business has one.",
    placeholder:
      "Məsələn: Neox Studio — AI avtomasiya, website və rəqəmsal təqdimat həlləri qururuq.",
  },
  company: {
    label: "Business name",
    title: "Confirm the business name",
    prompt: "Send the exact public business name.",
    placeholder: "Məsələn: Neox Studio",
  },
  description: {
    label: "Business description",
    title: "Describe what the business does",
    prompt: "Send one clean public sentence describing what the business does.",
    placeholder:
      "Məsələn: Lokal bizneslər üçün AI avtomasiya və rəqəmsal təqdimat həlləri qururuq.",
  },
  website: {
    label: "Website",
    title: "Add the main website",
    prompt: "Send the main website URL if the business has one.",
    placeholder: "Məsələn: yourbusiness.com",
  },
  services: {
    label: "Services",
    title: "Curate the service menu",
    missing:
      "Core services are still missing. Keep only the real customer-facing services AI should confidently talk about.",
    review:
      "Service signals exist, but they still need cleanup before approval.",
    ready: "Core services are already drafted in a usable form.",
    prompt:
      "Send only the real customer-facing services you want AI to talk about.",
    placeholder:
      "Məsələn: website hazırlanması, reklam idarəetməsi, branding",
  },
  hours: {
    label: "Business hours",
    title: "Lock the public hours",
    missing:
      "Public business hours are still missing. AI should not promise the wrong availability.",
    review: "Hour signals exist, but they still need confirmation.",
    ready: "Public business hours are already structured.",
    prompt: "Send the public weekly hours in one line.",
    placeholder:
      "Məsələn: B.e.–Cümə 10:00–19:00, Şənbə 11:00–16:00, Bazar bağlı",
  },
  pricing: {
    label: "Pricing posture",
    title: "Define the pricing posture",
    missing:
      "Pricing posture is still missing. AI needs a safe public rule for answering price questions.",
    review:
      "Pricing signals exist, but the public reply policy still needs refinement.",
    ready: "Pricing posture is already defined.",
    prompt: "How should AI speak publicly about pricing?",
    placeholder:
      "Məsələn: starting price deyilə bilər, dəqiq quote üçün müraciət istənməlidir",
  },
  contacts: {
    label: "Contacts",
    title: "Set the main customer contact lane",
    missing: "A real public customer contact lane is still missing.",
    review:
      "Contact details exist, but the main routing lane still needs confirmation.",
    ready: "A customer contact route is already present.",
    prompt:
      "Send the main public contact route customers should be sent to first.",
    placeholder:
      "Məsələn: WhatsApp, telefon zəngi, form və ya email",
  },
  handoff: {
    label: "Operator handoff",
    title: "Define when AI should escalate",
    missing: "Operator handoff rules are still missing.",
    review:
      "Escalation logic exists, but it still needs stronger boundaries.",
    ready: "Operator escalation rules are already present.",
    prompt: "Describe when AI should stop and escalate to a human.",
    placeholder:
      "Məsələn: şikayət, fərdi quote, ödəniş problemi, təcili iş, anlaşılmaz sorğu",
  },
};

export const INTENT_ONLY_RESPONSES = {
  "i'll share the business identity now.": "profile",
  "i'll share the business name now.": "profile",
  "let's start from the website.": "website",
  "let's use instagram as a source.": "profile",
  "i want to write the business details manually.": "profile",
  "i'll list the services now.": "services",
  "i want to paste a rough services note.": "services",
  "let's define pricing posture first.": "pricing",
  "let's skip services for now and continue.": "__skip__",
  "i'll share the working hours now.": "hours",
  "the business is appointment only.": "__appointment_only__",
  "the business is open 24/7.": "__always_open__",
  "pricing starts from a visible base amount.": "pricing",
  "exact pricing requires a quote.": "__quote_required__",
  "i want to define what ai can say publicly about pricing.": "pricing",
  "let's continue.": "__continue__",
  "i want to add more detail here.": "__continue__",
};

function normalizeQuestionPrompt(value = "") {
  return s(value).replace(/\s+/g, " ").trim();
}

function buildSourceContext(draft = {}) {
  const safeDraft = obj(draft);
  const businessProfile = obj(safeDraft.businessProfile);
  const sourceMetadata = obj(safeDraft.sourceMetadata);

  const sourceType = s(sourceMetadata.primarySourceType);
  const sourceUrl = s(sourceMetadata.primarySourceUrl);
  const sourceLabel = sourceType ? sourceTypeLabel(sourceType) : "";
  const evidenceSummary = arr(sourceMetadata.evidenceSummary)
    .map((item) => s(item))
    .filter(Boolean);
  const sourceIdentityPresent = hasNonManualSourceIdentity(sourceMetadata);

  return {
    sourceType,
    sourceUrl,
    sourceLabel,
    sourceIdentityPresent,
    evidenceSummary,
    companyName: s(businessProfile.companyName),
    description: s(businessProfile.description),
    websiteUrl: s(businessProfile.websiteUrl),
  };
}

function buildMetricLead(metric = "") {
  const safeMetric = s(metric);
  if (!safeMetric) return "";
  return `Current signal: ${safeMetric}.`;
}

function buildSourceHintLead(sourceHint = "") {
  const safeSourceHint = s(sourceHint);
  if (!safeSourceHint) return "";
  return `${safeSourceHint}`;
}

export function buildAssistantQuestion(key = "", overrides = {}) {
  const questionKey = s(key).toLowerCase();
  const meta = obj(SECTION_META[questionKey]);

  return compactDraftObject({
    key: questionKey,
    step: s(overrides.step || questionKey).toLowerCase(),
    label: s(overrides.label || meta.label),
    title: s(overrides.title || meta.title || meta.label),
    prompt: normalizeQuestionPrompt(s(overrides.prompt || meta.prompt)),
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
  const context = buildSourceContext(draft);
  const parts = [];

  if (context.sourceIdentityPresent && context.sourceLabel && context.sourceUrl) {
    parts.push(
      `${context.sourceLabel} source is already attached (${context.sourceUrl}).`
    );
  } else if (context.sourceIdentityPresent && context.sourceLabel) {
    parts.push(`${context.sourceLabel} source is already attached.`);
  }

  if (context.companyName) {
    parts.push(`Current name signal: ${context.companyName}.`);
  }

  if (context.description) {
    parts.push("A business description signal already exists.");
  }

  if (!context.companyName && !context.description && context.evidenceSummary.length) {
    parts.push(
      `I already have partial source signals: ${context.evidenceSummary
        .slice(0, 2)
        .join(" · ")}.`
    );
  }

  const request = context.sourceIdentityPresent
    ? "Confirm the exact public business name and one clean public sentence describing what the business does."
    : "Send the exact public business name and one clean public sentence describing what the business does. Add the website too if the business has one.";

  return normalizeQuestionPrompt(`${parts.join(" ")} ${request}`);
}

export function resolveProfileQuestion(draft = {}, progress = {}) {
  const safeDraft = obj(draft);
  const safeProfile = obj(safeDraft.businessProfile);
  const safeProgress = obj(progress);
  const currentQuestionKey = s(safeProgress.currentQuestionKey).toLowerCase();
  const sourceContext = buildSourceContext(safeDraft);

  const title =
    sourceContext.sourceIdentityPresent || sourceContext.companyName || sourceContext.description
      ? "Confirm the business identity"
      : "Set the business identity";

  const prompt = buildProfileQuestionPrompt(safeDraft);

  const priority =
    currentQuestionKey === "profile" ||
    currentQuestionKey === "company" ||
    currentQuestionKey === "description" ||
    currentQuestionKey === "website"
      ? 100
      : 96;

  return buildAssistantQuestion("profile", {
    title,
    prompt,
    priority,
    placeholder: s(SECTION_META.profile.placeholder),
    step: "profile",
  });
}

function buildServicesQuestion(blocker = {}) {
  const sourceHintLead = buildSourceHintLead(blocker.sourceHint);
  const metricLead = buildMetricLead(blocker.metric);

  return buildAssistantQuestion("services", {
    prompt: normalizeQuestionPrompt(
      `${sourceHintLead} ${metricLead} Send only the real customer-facing services you want AI to talk about. Ignore channels, vague capabilities, and generic words unless they are true customer-facing offers.`
    ),
    priority: 88,
  });
}

function buildContactsQuestion(blocker = {}) {
  const metricLead = buildMetricLead(blocker.metric);

  return buildAssistantQuestion("contacts", {
    prompt: normalizeQuestionPrompt(
      `${metricLead} Send the main public contact route customers should be sent to first.`
    ),
    priority: 86,
  });
}

function buildHoursQuestion(blocker = {}) {
  const metricLead = buildMetricLead(blocker.metric);

  return buildAssistantQuestion("hours", {
    prompt: normalizeQuestionPrompt(
      `${metricLead} Send the public weekly hours in one line. You can write naturally and I will normalize it.`
    ),
    priority: 84,
  });
}

function buildPricingQuestion(blocker = {}) {
  const metricLead = buildMetricLead(blocker.metric);

  return buildAssistantQuestion("pricing", {
    prompt: normalizeQuestionPrompt(
      `${metricLead} How should AI speak publicly about pricing? If exact pricing depends on the job, say that naturally and I will turn it into a safe pricing posture.`
    ),
    priority: 82,
  });
}

function buildHandoffQuestion() {
  return buildAssistantQuestion("handoff", {
    prompt:
      "Describe when AI should stop and escalate to a human. You can explain it naturally.",
    priority: 80,
  });
}

export function getNextQuestion(summary = {}, draft = {}, progress = {}) {
  const safeSummary = obj(summary);
  const safeDraft = obj(draft);

  if (safeSummary.readyForReview === true) {
    return null;
  }

  if (!hasSetupSignalForInterview(safeDraft)) {
    return null;
  }

  const sectionStatus = obj(safeSummary.sectionStatus);

  if (sectionStatus.profile?.status !== "ready") {
    return resolveProfileQuestion(safeDraft, progress);
  }

  const blocker = obj(arr(safeSummary.confirmationBlockers)[0]);
  if (!s(blocker.key)) return null;

  if (blocker.key === "services") {
    return buildServicesQuestion(blocker);
  }

  if (blocker.key === "contacts") {
    return buildContactsQuestion(blocker);
  }

  if (blocker.key === "hours") {
    return buildHoursQuestion(blocker);
  }

  if (blocker.key === "pricing") {
    return buildPricingQuestion(blocker);
  }

  if (blocker.key === "handoff") {
    return buildHandoffQuestion();
  }

  return buildAssistantQuestion(blocker.key, {
    prompt: normalizeQuestionPrompt(
      s(blocker.reason) || s(obj(SECTION_META[blocker.key]).prompt)
    ),
  });
}