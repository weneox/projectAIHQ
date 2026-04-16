import { arr, obj, s } from "../draftShared.js";
import { REVIEW_MESSAGE } from "./shared.js";
import { SECTION_META, SECTION_ORDER } from "./questions.js";
import {
  buildSetupDraftStateFromSignals,
  buildSetupSourceCoverage,
  buildSetupSourceSignals,
} from "./sourceSignals.js";

function normalizeSummaryContext(context = {}) {
  return {
    session: obj(context.session),
    review: obj(context.review),
    sources: arr(context.sources),
  };
}

function buildCoverageContext(draft = {}, context = {}) {
  const safeContext = normalizeSummaryContext(context);

  const sourceSignals = buildSetupSourceSignals({
    session: safeContext.session,
    draft: obj(draft),
    sources: safeContext.sources,
    review: safeContext.review,
  });

  const sourceCoverage = buildSetupSourceCoverage(sourceSignals);
  const draftState = buildSetupDraftStateFromSignals({
    draft: obj(draft),
    review: safeContext.review,
    sourceSignals,
  });

  return {
    sourceSignals,
    sourceCoverage,
    draftState,
  };
}

function buildProfileStatus(draft = {}, context = {}) {
  const businessProfile = obj(draft.businessProfile);
  const { sourceCoverage, draftState, sourceSignals } = context;

  const hasName = Boolean(
    s(businessProfile.companyName) || s(draftState.businessName)
  );
  const hasDescription = Boolean(
    s(businessProfile.description) || s(draftState.description)
  );
  const hasWebsite = Boolean(
    s(businessProfile.websiteUrl) ||
      s(draftState.websiteUrl) ||
      s(sourceSignals.primarySourceUrl)
  );

  const completed = hasName && hasDescription && hasWebsite;
  const partial =
    completed ||
    sourceCoverage.identity === true ||
    hasName ||
    hasDescription ||
    hasWebsite;

  return {
    completed,
    partial,
    sourceCovered: sourceCoverage.identity === true,
    reviewReady: completed || sourceCoverage.identity === true,
    metric: [
      hasName ? "name" : "",
      hasWebsite ? "source/website" : "",
      hasDescription ? "summary" : "",
    ]
      .filter(Boolean)
      .join(" / "),
  };
}

function buildServicesStatus(draft = {}, context = {}) {
  const { sourceCoverage, draftState, sourceSignals } = context;
  const explicitCount = arr(draft.services).length;
  const derivedCount = arr(draftState.services).length;
  const sourceCount = arr(sourceSignals.serviceCandidates).length;

  const completed = explicitCount > 0 || derivedCount > 0;
  const partial = completed || sourceCoverage.services === true;

  return {
    completed,
    partial,
    sourceCovered: sourceCoverage.services === true,
    reviewReady: completed || sourceCoverage.services === true,
    metric: completed
      ? `${Math.max(explicitCount, derivedCount)} drafted`
      : sourceCoverage.services === true
        ? `${sourceCount} source signals`
        : "not drafted",
  };
}

function buildHoursStatus(draft = {}, context = {}) {
  const { sourceCoverage, draftState, sourceSignals } = context;
  const explicitConfigured = arr(draft.hours).filter(
    (item) =>
      item?.enabled === true ||
      item?.allDay === true ||
      item?.appointmentOnly === true
  ).length;

  const derivedConfigured = arr(draftState.hours).length;
  const sourceCount = arr(sourceSignals.hoursCandidates).length;

  const completed = explicitConfigured > 0 || derivedConfigured > 0;
  const partial = completed || sourceCoverage.hours === true;

  return {
    completed,
    partial,
    sourceCovered: sourceCoverage.hours === true,
    reviewReady: completed || sourceCoverage.hours === true,
    metric: completed
      ? `${Math.max(explicitConfigured, derivedConfigured)} days scheduled`
      : sourceCoverage.hours === true
        ? `${sourceCount} source signals`
        : "not scheduled",
  };
}

function buildPricingStatus(draft = {}, context = {}) {
  const pricing = obj(draft.pricingPosture);
  const { sourceCoverage, draftState, sourceSignals } = context;

  const completed = Boolean(
    s(pricing.pricingMode) ||
      s(pricing.publicSummary) ||
      s(draftState.pricingPosture)
  );

  const partial = completed || sourceCoverage.pricing === true;

  return {
    completed,
    partial,
    sourceCovered: sourceCoverage.pricing === true,
    reviewReady: completed || sourceCoverage.pricing === true,
    metric: completed
      ? s(
          pricing.pricingMode ||
            pricing.publicSummary ||
            draftState.pricingPosture
        )
      : sourceCoverage.pricing === true
        ? `${arr(sourceSignals.pricingCandidates).length} source signals`
        : "not set",
  };
}

function buildContactsStatus(draft = {}, context = {}) {
  const { sourceCoverage, draftState, sourceSignals } = context;
  const explicitCount = arr(draft.contacts).length;
  const derivedCount = arr(draftState.contacts).length;
  const sourceCount = arr(sourceSignals.contactCandidates).length;

  const completed = explicitCount > 0 || derivedCount > 0;
  const partial = completed || sourceCoverage.contacts === true;

  return {
    completed,
    partial,
    sourceCovered: sourceCoverage.contacts === true,
    reviewReady: completed || sourceCoverage.contacts === true,
    metric: completed
      ? `${Math.max(explicitCount, derivedCount)} contact routes`
      : sourceCoverage.contacts === true
        ? `${sourceCount} source signals`
        : "no routing lane",
  };
}

function buildHandoffStatus(draft = {}, context = {}) {
  const handoff = obj(draft.handoffRules);
  const { draftState } = context;

  const completed = Boolean(
    handoff.enabled === true ||
      s(handoff.summary) ||
      arr(handoff.triggers).length ||
      s(draftState.humanHandoff)
  );

  const partial = completed;

  return {
    completed,
    partial,
    sourceCovered: false,
    reviewReady: completed,
    metric: arr(handoff.triggers).length
      ? `${arr(handoff.triggers).length} triggers`
      : s(handoff.summary || draftState.humanHandoff)
        ? "configured"
        : "recommended",
  };
}

export function buildSectionStatus(draft = {}, context = {}) {
  const coverageContext = buildCoverageContext(draft, context);

  const sections = {
    profile: buildProfileStatus(draft, coverageContext),
    services: buildServicesStatus(draft, coverageContext),
    hours: buildHoursStatus(draft, coverageContext),
    pricing: buildPricingStatus(draft, coverageContext),
    contacts: buildContactsStatus(draft, coverageContext),
    handoff: buildHandoffStatus(draft, coverageContext),
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

export function buildConfirmationBlockers(
  draft = {},
  sectionStatus = {},
  context = {}
) {
  const coverageContext = buildCoverageContext(draft, context);
  const { sourceSignals, sourceCoverage } = coverageContext;

  const sourceHint =
    s(sourceSignals.primarySourceLabel) && s(sourceSignals.primarySourceUrl)
      ? `${s(sourceSignals.primarySourceLabel)} source is already attached (${s(
          sourceSignals.primarySourceUrl
        )}).`
      : s(sourceSignals.primarySourceLabel)
        ? `${s(sourceSignals.primarySourceLabel)} source is already attached.`
        : "";

  return SECTION_ORDER.filter(
    (key) => obj(sectionStatus[key]).reviewReady !== true
  ).map((key) => {
    const meta = obj(SECTION_META[key]);
    const state = obj(sectionStatus[key]);

    let specificSourceHint = "";

    if (key === "profile") {
      specificSourceHint = sourceHint;
    } else if (key === "services" && sourceCoverage.services) {
      specificSourceHint = `Service signals already exist: ${arr(
        sourceSignals.serviceCandidates
      )
        .slice(0, 4)
        .join(", ")}.`;
    } else if (key === "contacts" && sourceCoverage.contacts) {
      specificSourceHint = `Contact signals already exist: ${arr(
        sourceSignals.contactCandidates
      )
        .slice(0, 3)
        .join(", ")}.`;
    } else if (key === "hours" && sourceCoverage.hours) {
      specificSourceHint = `Hour signals already exist: ${arr(
        sourceSignals.hoursCandidates
      )
        .slice(0, 2)
        .join(", ")}.`;
    } else if (key === "pricing" && sourceCoverage.pricing) {
      specificSourceHint = `Pricing signals already exist: ${arr(
        sourceSignals.pricingCandidates
      )
        .slice(0, 2)
        .join(", ")}.`;
    }

    return {
      key,
      label: meta.label,
      title: meta.title,
      severity: state.status === "missing" ? "high" : "medium",
      reason: state.status === "missing" ? s(meta.missing) : s(meta.review),
      metric: s(state.metric),
      sourceHint: specificSourceHint,
      sourceCovered: state.sourceCovered === true,
      reviewReady: state.reviewReady === true,
    };
  });
}

export function buildSummary(draft = {}, context = {}) {
  const coverageContext = buildCoverageContext(draft, context);
  const { draftState, sourceCoverage } = coverageContext;

  const sectionStatus = buildSectionStatus(draft, context);
  const completionCount = Object.values(sectionStatus).filter(
    (item) => item.status === "ready"
  ).length;
  const reviewReadyCount = Object.values(sectionStatus).filter(
    (item) => item.reviewReady === true
  ).length;
  const confirmationBlockers = buildConfirmationBlockers(
    draft,
    sectionStatus,
    context
  );

  const hasAnyDraft =
    completionCount > 0 ||
    Object.values(sectionStatus).some((item) => item.partial === true) ||
    Boolean(
      s(draftState.businessName) ||
        s(draftState.description) ||
        s(draftState.websiteUrl) ||
        arr(draftState.services).length ||
        arr(draftState.contacts).length ||
        arr(draftState.hours).length ||
        s(draftState.pricingPosture) ||
        s(draftState.humanHandoff) ||
        sourceCoverage.primarySourceExists
    );

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
    servicesCount: Math.max(
      arr(draft.services).length,
      arr(draftState.services).length
    ),
    contactsCount: Math.max(
      arr(draft.contacts).length,
      arr(draftState.contacts).length
    ),
    hoursConfiguredCount: Math.max(
      arr(draft.hours).filter(
        (item) =>
          item?.enabled === true ||
          item?.allDay === true ||
          item?.appointmentOnly === true
      ).length,
      arr(draftState.hours).length
    ),
  };
}

export function buildReviewState(draft = {}, summary = {}, _context = {}) {
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