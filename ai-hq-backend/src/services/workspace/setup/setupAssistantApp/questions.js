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
      "Confirm the business name and a reliable short description first. Add the website if the business has one.",
    placeholder:
      "MÉ™sÉ™lÉ™n: Neox Studio â€” AI avtomasiya, website vÉ™ rÉ™qÉ™msal tÉ™qdimat hÉ™llÉ™ri qururuq.",
  },
  company: {
    label: "Business name",
    title: "Confirm the business name",
    prompt: "Send the exact public business name.",
    placeholder: "MÉ™sÉ™lÉ™n: Neox Studio",
  },
  description: {
    label: "Business description",
    title: "Describe what the business does",
    prompt: "Send one clean public sentence describing what the business does.",
    placeholder:
      "MÉ™sÉ™lÉ™n: Lokal bizneslÉ™r Ã¼Ã§Ã¼n AI avtomasiya vÉ™ rÉ™qÉ™msal tÉ™qdimat hÉ™llÉ™ri qururuq.",
  },
  website: {
    label: "Website",
    title: "Add the main website",
    prompt: "Send the main website URL if the business has one.",
    placeholder: "MÉ™sÉ™lÉ™n: yourbusiness.com",
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
      "MÉ™sÉ™lÉ™n: website hazÄ±rlanmasÄ±, reklam idarÉ™etmÉ™si, branding",
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
      "MÉ™sÉ™lÉ™n: B.e.â€“CÃ¼mÉ™ 10:00â€“19:00, ÅžÉ™nbÉ™ 11:00â€“16:00, Bazar baÄŸlÄ±",
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
      "MÉ™sÉ™lÉ™n: starting price deyilÉ™ bilÉ™r, dÉ™qiq quote Ã¼Ã§Ã¼n mÃ¼raciÉ™t istÉ™nmÉ™lidir",
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
      "MÉ™sÉ™lÉ™n: WhatsApp, telefon zÉ™ngi, form vÉ™ ya email",
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
      "MÉ™sÉ™lÉ™n: ÅŸikayÉ™t, fÉ™rdi quote, Ã¶dÉ™niÅŸ problemi, tÉ™cili iÅŸ, anlaÅŸÄ±lmaz sorÄŸu",
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

export function buildAssistantQuestion(key = "", overrides = {}) {
  const questionKey = s(key).toLowerCase();
  const meta = obj(SECTION_META[questionKey]);

  return compactDraftObject({
    key: questionKey,
    step: s(overrides.step || questionKey).toLowerCase(),
    label: s(overrides.label || meta.label),
    title: s(overrides.title || meta.title || meta.label),
    prompt: s(overrides.prompt || meta.prompt),
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
      arr(sourceMetadata.sourceLabels).length
  );
}

export function buildProfileQuestionPrompt(draft = {}) {
  return s(obj(SECTION_META.profile).prompt);

  const businessProfile = obj(draft.businessProfile);
  const sourceMetadata = obj(draft.sourceMetadata);

  const sourceLabel = sourceTypeLabel(sourceMetadata.primarySourceType);
  const parts = [];

  if (s(sourceMetadata.primarySourceType) && s(sourceMetadata.primarySourceUrl)) {
    parts.push(
      `${sourceLabel} source is already attached (${s(
        sourceMetadata.primarySourceUrl
      )})`
    );
  } else if (s(sourceMetadata.primarySourceType)) {
    parts.push(`${sourceLabel} source is already attached`);
  }

  if (s(businessProfile.companyName)) {
    parts.push(`current name signal: ${s(businessProfile.companyName)}`);
  }

  if (s(businessProfile.description)) {
    parts.push("description signal already exists");
  }

  const contextLine = parts.length ? `${parts.join(" â€¢ ")}.` : "";

  return `${contextLine ? `${contextLine} ` : ""}Send the exact public business name and one clean sentence describing what the business does.${!s(businessProfile.websiteUrl) && !s(sourceMetadata.primarySourceUrl) ? " Include the main website if the business has one." : ""}`.trim();
}

export function resolveProfileQuestion(draft = {}, progress = {}) {
  const currentQuestionKey = s(progress.currentQuestionKey).toLowerCase();
  const safeDraft = obj(draft);
  const safeProfile = obj(safeDraft.businessProfile);
  const safeSourceMetadata = obj(safeDraft.sourceMetadata);
  const sourceIdentityPresent = hasNonManualSourceIdentity(safeSourceMetadata);
  const canUseCombinedProfileQuestion =
    sourceIdentityPresent &&
    (Boolean(s(safeSourceMetadata.primarySourceUrl)) ||
      arr(safeSourceMetadata.evidenceSummary).length > 0);

  if (
    canUseCombinedProfileQuestion &&
    (!s(safeProfile.companyName) || !s(safeProfile.description))
  ) {
    return buildAssistantQuestion("profile", {
      prompt: buildProfileQuestionPrompt(safeDraft),
      priority: 100,
    });
  }

  if (currentQuestionKey === "company" && !s(safeProfile.companyName)) {
    return buildAssistantQuestion("company");
  }

  if (currentQuestionKey === "description" && !s(safeProfile.description)) {
    return buildAssistantQuestion("description");
  }

  if (
    currentQuestionKey === "website" &&
    !s(safeProfile.websiteUrl) &&
    !sourceIdentityPresent
  ) {
    return buildAssistantQuestion("website");
  }

  if (!s(safeProfile.companyName)) {
    return buildAssistantQuestion("company");
  }

  if (!s(safeProfile.description)) {
    return buildAssistantQuestion("description");
  }

  if (!s(safeProfile.websiteUrl) && !sourceIdentityPresent) {
    return buildAssistantQuestion("website");
  }

  return buildAssistantQuestion("profile", {
    prompt: buildProfileQuestionPrompt(safeDraft),
    priority: 100,
  });
}

export function getNextQuestion(summary = {}, draft = {}, progress = {}) {
  if (summary.readyForReview === true) {
    return null;
  }

  if (!hasSetupSignalForInterview(draft)) {
    return null;
  }

  const sectionStatus = obj(summary.sectionStatus);

  if (sectionStatus.profile?.status !== "ready") {
    return resolveProfileQuestion(draft, progress);
  }

  const blocker = arr(summary.confirmationBlockers)[0];
  if (!blocker?.key) return null;

  if (blocker.key === "services") {
    return buildAssistantQuestion("services", {
      prompt:
        s(blocker.sourceHint) || s(blocker.metric)
          ? `${[s(blocker.sourceHint), s(blocker.metric)].filter(Boolean).join(" ")} Send only the real customer-facing services you want AI to talk about.`
          : SECTION_META.services.prompt,
      priority: 88,
    });
  }

  if (blocker.key === "contacts") {
    return buildAssistantQuestion("contacts", {
      prompt:
        s(blocker.metric)
          ? `Current signal: ${s(blocker.metric)}. Send the main public contact route customers should be sent to first.`
          : SECTION_META.contacts.prompt,
      priority: 86,
    });
  }

  if (blocker.key === "hours") {
    return buildAssistantQuestion("hours", {
      prompt:
        s(blocker.metric)
          ? `Current signal: ${s(blocker.metric)}. Send the public weekly hours in one line.`
          : SECTION_META.hours.prompt,
      priority: 84,
    });
  }

  if (blocker.key === "pricing") {
    return buildAssistantQuestion("pricing", {
      prompt:
        s(blocker.metric)
          ? `Current signal: ${s(blocker.metric)}. How should AI speak publicly about pricing?`
          : SECTION_META.pricing.prompt,
      priority: 82,
    });
  }

  if (blocker.key === "handoff") {
    return buildAssistantQuestion("handoff", {
      prompt: SECTION_META.handoff.prompt,
      priority: 80,
    });
  }

  return buildAssistantQuestion(blocker.key, {
    prompt: s(blocker.reason) || SECTION_META[blocker.key]?.prompt,
  });
}
