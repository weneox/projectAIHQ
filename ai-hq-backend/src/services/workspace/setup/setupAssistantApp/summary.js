import { arr, obj, s } from "../draftShared.js";
import {
  REVIEW_MESSAGE,
  hasNonManualSourceIdentity,
  sourceTypeLabel,
} from "./shared.js";
import { SECTION_META, SECTION_ORDER } from "./questions.js";

export function buildSectionStatus(draft = {}) {
  const businessProfile = obj(draft.businessProfile);
  const sourceMetadata = obj(draft.sourceMetadata);
  const pricing = obj(draft.pricingPosture);
  const handoff = obj(draft.handoffRules);
  const enabledHours = arr(draft.hours).filter(
    (item) =>
      item.enabled === true || item.allDay === true || item.appointmentOnly === true
  );
  const sourceIdentityPresent = hasNonManualSourceIdentity(sourceMetadata);

  const sections = {
    profile: {
      completed: Boolean(
        s(businessProfile.companyName) &&
          s(businessProfile.description) &&
          (s(businessProfile.websiteUrl) || sourceIdentityPresent)
      ),
      partial: Boolean(
        s(businessProfile.companyName) ||
          s(businessProfile.description) ||
          s(businessProfile.websiteUrl) ||
          sourceIdentityPresent
      ),
      metric: [
        s(businessProfile.companyName) ? "name" : "",
        s(businessProfile.websiteUrl) ? "website" : "",
        !s(businessProfile.websiteUrl) && sourceIdentityPresent ? "source" : "",
        s(businessProfile.description) ? "summary" : "",
      ]
        .filter(Boolean)
        .join(" / "),
    },
    services: {
      completed: arr(draft.services).length > 0,
      partial: arr(draft.services).length > 0,
      metric: `${arr(draft.services).length} drafted`,
    },
    hours: {
      completed: enabledHours.length > 0,
      partial: arr(draft.hours).some(
        (item) => item.enabled === true || item.closed === true || s(item.notes)
      ),
      metric: enabledHours.length
        ? `${enabledHours.length} days scheduled`
        : "not scheduled",
    },
    pricing: {
      completed: Boolean(s(pricing.pricingMode) && s(pricing.publicSummary)),
      partial: Boolean(
        s(pricing.pricingMode) ||
          s(pricing.publicSummary) ||
          pricing.minPrice != null ||
          pricing.startingAt != null
      ),
      metric: s(pricing.pricingMode) || "not set",
    },
    contacts: {
      completed: arr(draft.contacts).length > 0,
      partial: arr(draft.contacts).length > 0,
      metric: `${arr(draft.contacts).length} contact routes`,
    },
    handoff: {
      completed: Boolean(
        handoff.enabled === true ||
          s(handoff.summary) ||
          arr(handoff.triggers).length
      ),
      partial: Boolean(s(handoff.summary) || arr(handoff.triggers).length),
      metric: arr(handoff.triggers).length
        ? `${arr(handoff.triggers).length} triggers`
        : s(handoff.summary)
          ? "configured"
          : "recommended",
    },
  };

  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [
      key,
      {
        ...value,
        status: value.completed ? "ready" : value.partial ? "needs_review" : "missing",
      },
    ])
  );
}

export function buildConfirmationBlockers(draft = {}, sectionStatus = {}) {
  const sourceMetadata = obj(draft.sourceMetadata);
  const sourceLabel = sourceTypeLabel(sourceMetadata.primarySourceType);
  const sourceHint =
    s(sourceMetadata.primarySourceType) && s(sourceMetadata.primarySourceUrl)
      ? `${sourceLabel} source is already attached (${s(
          sourceMetadata.primarySourceUrl
        )}).`
      : s(sourceMetadata.primarySourceType)
        ? `${sourceLabel} source is already attached.`
        : "";

  return SECTION_ORDER.filter((key) => sectionStatus[key]?.status !== "ready").map(
    (key) => {
      const meta = obj(SECTION_META[key]);
      const state = obj(sectionStatus[key]);

      return {
        key,
        label: meta.label,
        title: meta.title,
        severity: state.status === "missing" ? "high" : "medium",
        reason: state.status === "missing" ? s(meta.missing) : s(meta.review),
        metric: s(state.metric),
        sourceHint:
          key === "profile"
            ? sourceHint
            : key === "services" && arr(sourceMetadata.evidenceSummary).length
              ? s(arr(sourceMetadata.evidenceSummary)[0])
              : "",
      };
    }
  );
}

export function buildSummary(draft = {}) {
  const sectionStatus = buildSectionStatus(draft);
  const completionCount = Object.values(sectionStatus).filter(
    (item) => item.status === "ready"
  ).length;
  const confirmationBlockers = buildConfirmationBlockers(draft, sectionStatus);
  const hasAnyDraft =
    completionCount > 0 ||
    Object.values(sectionStatus).some((item) => item.partial === true);
  const readyForReview = [
    "profile",
    "services",
    "hours",
    "pricing",
    "contacts",
    "handoff",
  ].every((key) => sectionStatus[key]?.status === "ready");

  return {
    hasAnyDraft,
    readyForReview,
    readyForApproval: false,
    completionCount,
    totalSections: SECTION_ORDER.length,
    blockerCount: confirmationBlockers.length,
    sectionStatus,
    confirmationBlockers,
    servicesCount: arr(draft.services).length,
    contactsCount: arr(draft.contacts).length,
    hoursConfiguredCount: arr(draft.hours).filter(
      (item) =>
        item.enabled === true || item.allDay === true || item.appointmentOnly === true
    ).length,
  };
}

export function buildReviewState(draft = {}, summary = {}) {
  return {
    status: summary.hasAnyDraft ? "draft_in_progress" : "awaiting_input",
    readyForReview: summary.readyForReview === true,
    readyForApproval: false,
    finalizeAvailable: summary.readyForReview === true,
    message:
      summary.readyForReview === true
        ? "The setup draft is structurally complete enough to move into review and approval."
        : REVIEW_MESSAGE,
  };
}
