import { arr, obj, s } from "../draftShared.js";
import {
  REVIEW_MESSAGE,
  hasNonManualSourceIdentity,
  sourceTypeLabel,
} from "./shared.js";
import { SECTION_META, SECTION_ORDER } from "./questions.js";

function normalizeEvidenceSummary(sourceMetadata = {}) {
  return arr(sourceMetadata.evidenceSummary)
    .map((item) => s(item).toLowerCase())
    .filter(Boolean);
}

function evidenceIncludesAny(evidence = [], patterns = []) {
  return arr(evidence).some((line) =>
    arr(patterns).some((pattern) =>
      pattern instanceof RegExp ? pattern.test(line) : line.includes(String(pattern))
    )
  );
}

function hasTimeLikeSignal(text = "") {
  return /\b\d{1,2}[:.]?\d{0,2}\s*(?:-|to|dan|den|dek|qeder)\s*\d{1,2}[:.]?\d{0,2}\b/.test(
    s(text).toLowerCase()
  );
}

function detectSourceCoverage(draft = {}) {
  const businessProfile = obj(draft.businessProfile);
  const sourceMetadata = obj(draft.sourceMetadata);
  const evidence = normalizeEvidenceSummary(sourceMetadata);
  const sourceIdentityPresent = hasNonManualSourceIdentity(sourceMetadata);

  const services =
    evidenceIncludesAny(evidence, [
      "service",
      "services",
      "offer",
      "offers",
      "menu",
      "xidmet",
      "xidmət",
      "solution",
      "solutions",
    ]) || arr(draft.services).length > 0;

  const contacts =
    evidenceIncludesAny(evidence, [
      "contact",
      "phone",
      "email",
      "whatsapp",
      "telegram",
      "call",
      "elaqe",
      "əlaqə",
      "dm",
      "wa.me",
      "@",
    ]) ||
    arr(draft.contacts).length > 0 ||
    Boolean(s(businessProfile.primaryPhone) || s(businessProfile.primaryEmail));

  const hours =
    evidenceIncludesAny(evidence, [
      "hours",
      "open",
      "closed",
      "working hours",
      "business hours",
      "24/7",
      "appointment only",
      "schedule",
      "saat",
      "bagli",
      "bağlı",
    ]) ||
    evidence.some((line) => hasTimeLikeSignal(line)) ||
    arr(draft.hours).some(
      (item) =>
        item?.enabled === true ||
        item?.allDay === true ||
        item?.appointmentOnly === true ||
        item?.closed === true ||
        s(item?.notes)
    );

  const pricing =
    evidenceIncludesAny(evidence, [
      "price",
      "pricing",
      "quote",
      "starting",
      "from",
      "discount",
      "promo",
      "qiymet",
      "qiymət",
      "azn",
      "usd",
      "eur",
      "gbp",
      "$",
      "₼",
      "€",
      "£",
    ]) ||
    Boolean(s(obj(draft.pricingPosture).publicSummary));

  const identity =
    sourceIdentityPresent &&
    Boolean(
      s(businessProfile.companyName) ||
        s(businessProfile.description) ||
        s(businessProfile.websiteUrl) ||
        evidence.length
    );

  return {
    sourceIdentityPresent,
    identity,
    services,
    contacts,
    hours,
    pricing,
  };
}

function buildProfileStatus(draft = {}, coverage = {}) {
  const businessProfile = obj(draft.businessProfile);
  const sourceIdentityPresent = coverage.sourceIdentityPresent === true;

  const hasName = Boolean(s(businessProfile.companyName));
  const hasDescription = Boolean(s(businessProfile.description));
  const hasWebsite = Boolean(s(businessProfile.websiteUrl) || sourceIdentityPresent);

  const completed = hasName && hasDescription && hasWebsite;
  const partial =
    hasName || hasDescription || hasWebsite || sourceIdentityPresent;

  return {
    completed,
    partial,
    sourceCovered: coverage.identity === true,
    reviewReady: completed,
    metric: [
      hasName ? "name" : "",
      hasWebsite ? (s(businessProfile.websiteUrl) ? "website" : "source") : "",
      hasDescription ? "summary" : "",
    ]
      .filter(Boolean)
      .join(" / "),
  };
}

function buildServicesStatus(draft = {}, coverage = {}) {
  const count = arr(draft.services).length;
  const completed = count > 0;
  const partial = completed || coverage.services === true;

  return {
    completed,
    partial,
    sourceCovered: coverage.services === true,
    reviewReady: completed || coverage.services === true,
    metric: completed
      ? `${count} drafted`
      : coverage.services === true
        ? "source-covered"
        : "not drafted",
  };
}

function buildHoursStatus(draft = {}, coverage = {}) {
  const enabledHours = arr(draft.hours).filter(
    (item) =>
      item?.enabled === true ||
      item?.allDay === true ||
      item?.appointmentOnly === true
  );
  const hasAnyHourState = arr(draft.hours).some(
    (item) =>
      item?.enabled === true ||
      item?.allDay === true ||
      item?.appointmentOnly === true ||
      item?.closed === true ||
      s(item?.notes)
  );

  const completed = enabledHours.length > 0;
  const partial = hasAnyHourState || coverage.hours === true;

  return {
    completed,
    partial,
    sourceCovered: coverage.hours === true,
    reviewReady: completed || coverage.hours === true,
    metric: completed
      ? `${enabledHours.length} days scheduled`
      : coverage.hours === true
        ? "source-covered"
        : "not scheduled",
  };
}

function buildPricingStatus(draft = {}, coverage = {}) {
  const pricing = obj(draft.pricingPosture);
  const completed = Boolean(s(pricing.pricingMode) && s(pricing.publicSummary));
  const partial =
    completed ||
    Boolean(
      s(pricing.pricingMode) ||
        s(pricing.publicSummary) ||
        pricing.minPrice != null ||
        pricing.startingAt != null
    ) ||
    coverage.pricing === true;

  return {
    completed,
    partial,
    sourceCovered: coverage.pricing === true,
    reviewReady: completed || coverage.pricing === true,
    metric: completed
      ? s(pricing.pricingMode)
      : coverage.pricing === true
        ? "source-covered"
        : "not set",
  };
}

function buildContactsStatus(draft = {}, coverage = {}) {
  const count = arr(draft.contacts).length;
  const completed = count > 0;
  const partial = completed || coverage.contacts === true;

  return {
    completed,
    partial,
    sourceCovered: coverage.contacts === true,
    reviewReady: completed || coverage.contacts === true,
    metric: completed
      ? `${count} contact routes`
      : coverage.contacts === true
        ? "source-covered"
        : "no routing lane",
  };
}

function buildHandoffStatus(draft = {}) {
  const handoff = obj(draft.handoffRules);
  const completed = Boolean(
    handoff.enabled === true ||
      s(handoff.summary) ||
      arr(handoff.triggers).length
  );
  const partial = Boolean(s(handoff.summary) || arr(handoff.triggers).length);

  return {
    completed,
    partial,
    sourceCovered: false,
    reviewReady: completed,
    metric: arr(handoff.triggers).length
      ? `${arr(handoff.triggers).length} triggers`
      : s(handoff.summary)
        ? "configured"
        : "recommended",
  };
}

export function buildSectionStatus(draft = {}) {
  const coverage = detectSourceCoverage(draft);

  const sections = {
    profile: buildProfileStatus(draft, coverage),
    services: buildServicesStatus(draft, coverage),
    hours: buildHoursStatus(draft, coverage),
    pricing: buildPricingStatus(draft, coverage),
    contacts: buildContactsStatus(draft, coverage),
    handoff: buildHandoffStatus(draft),
  };

  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [
      key,
      {
        ...value,
        status: value.completed
          ? "ready"
          : value.partial
            ? "needs_review"
            : "missing",
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

  return SECTION_ORDER.filter(
    (key) => obj(sectionStatus[key]).reviewReady !== true
  ).map((key) => {
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
      sourceCovered: state.sourceCovered === true,
      reviewReady: state.reviewReady === true,
    };
  });
}

export function buildSummary(draft = {}) {
  const sectionStatus = buildSectionStatus(draft);
  const completionCount = Object.values(sectionStatus).filter(
    (item) => item.status === "ready"
  ).length;
  const reviewReadyCount = Object.values(sectionStatus).filter(
    (item) => item.reviewReady === true
  ).length;
  const confirmationBlockers = buildConfirmationBlockers(draft, sectionStatus);
  const hasAnyDraft =
    completionCount > 0 ||
    Object.values(sectionStatus).some((item) => item.partial === true);

  const readyForReview = SECTION_ORDER.every(
    (key) => obj(sectionStatus[key]).reviewReady === true
  );

  return {
    hasAnyDraft,
    readyForReview,
    readyForApproval: false,
    completionCount,
    reviewReadyCount,
    totalSections: SECTION_ORDER.length,
    blockerCount: confirmationBlockers.length,
    sectionStatus,
    confirmationBlockers,
    servicesCount: arr(draft.services).length,
    contactsCount: arr(draft.contacts).length,
    hoursConfiguredCount: arr(draft.hours).filter(
      (item) =>
        item?.enabled === true ||
        item?.allDay === true ||
        item?.appointmentOnly === true
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
        ? "The setup draft is operationally complete enough to move into review and approval."
        : REVIEW_MESSAGE,
  };
}