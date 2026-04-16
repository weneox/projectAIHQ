import { arr, obj, s } from "../draftShared.js";
import {
  buildSetupDraftStateFromSignals,
  buildSetupSourceCoverage,
  buildSetupSourceSignals,
} from "./sourceSignals.js";

export const SETUP_SUMMARY_SECTION_ORDER = [
  "profile",
  "services",
  "hours",
  "pricing",
  "contacts",
  "handoff",
];

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

function buildProfileStatus(draft = {}, coverageContext = {}) {
  const businessProfile = obj(draft.businessProfile);
  const { sourceCoverage, draftState, sourceSignals } = coverageContext;

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
    status: completed ? "ready" : partial ? "needs_review" : "missing",
    reviewReady: completed || sourceCoverage.identity === true,
    sourceCovered: sourceCoverage.identity === true,
    missingFields: [
      hasName ? "" : "business_name",
      hasDescription ? "" : "business_description",
      hasWebsite ? "" : "website_or_primary_source",
    ].filter(Boolean),
    metric: {
      hasName,
      hasDescription,
      hasWebsite,
    },
  };
}

function buildServicesStatus(draft = {}, coverageContext = {}) {
  const { sourceCoverage, draftState, sourceSignals } = coverageContext;

  const explicitCount = arr(draft.services).length;
  const derivedCount = arr(draftState.services).length;
  const sourceCount = arr(sourceSignals.serviceCandidates).length;

  const completed = explicitCount > 0 || derivedCount > 0;
  const partial = completed || sourceCoverage.services === true;

  return {
    completed,
    partial,
    status: completed ? "ready" : partial ? "needs_review" : "missing",
    reviewReady: completed || sourceCoverage.services === true,
    sourceCovered: sourceCoverage.services === true,
    missingFields: completed ? [] : ["services"],
    metric: {
      explicitCount,
      derivedCount,
      sourceCount,
    },
  };
}

function buildHoursStatus(draft = {}, coverageContext = {}) {
  const { sourceCoverage, draftState, sourceSignals } = coverageContext;

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
    status: completed ? "ready" : partial ? "needs_review" : "missing",
    reviewReady: completed || sourceCoverage.hours === true,
    sourceCovered: sourceCoverage.hours === true,
    missingFields: completed ? [] : ["hours"],
    metric: {
      explicitConfigured,
      derivedConfigured,
      sourceCount,
    },
  };
}

function buildPricingStatus(draft = {}, coverageContext = {}) {
  const pricing = obj(draft.pricingPosture);
  const { sourceCoverage, draftState, sourceSignals } = coverageContext;

  const completed = Boolean(
    s(pricing.pricingMode) ||
      s(pricing.publicSummary) ||
      s(draftState.pricingPosture)
  );

  const partial = completed || sourceCoverage.pricing === true;

  return {
    completed,
    partial,
    status: completed ? "ready" : partial ? "needs_review" : "missing",
    reviewReady: completed || sourceCoverage.pricing === true,
    sourceCovered: sourceCoverage.pricing === true,
    missingFields: completed ? [] : ["pricing_posture"],
    metric: {
      hasPricingMode: Boolean(s(pricing.pricingMode)),
      hasPublicSummary: Boolean(s(pricing.publicSummary)),
      sourceCount: arr(sourceSignals.pricingCandidates).length,
    },
  };
}

function buildContactsStatus(draft = {}, coverageContext = {}) {
  const { sourceCoverage, draftState, sourceSignals } = coverageContext;

  const explicitCount = arr(draft.contacts).length;
  const derivedCount = arr(draftState.contacts).length;
  const sourceCount = arr(sourceSignals.contactCandidates).length;

  const completed = explicitCount > 0 || derivedCount > 0;
  const partial = completed || sourceCoverage.contacts === true;

  return {
    completed,
    partial,
    status: completed ? "ready" : partial ? "needs_review" : "missing",
    reviewReady: completed || sourceCoverage.contacts === true,
    sourceCovered: sourceCoverage.contacts === true,
    missingFields: completed ? [] : ["contact_route"],
    metric: {
      explicitCount,
      derivedCount,
      sourceCount,
    },
  };
}

function buildHandoffStatus(draft = {}, coverageContext = {}) {
  const handoff = obj(draft.handoffRules);
  const { draftState } = coverageContext;

  const completed = Boolean(
    handoff.enabled === true ||
      s(handoff.summary) ||
      arr(handoff.triggers).length ||
      s(draftState.humanHandoff)
  );

  return {
    completed,
    partial: completed,
    status: completed ? "ready" : "missing",
    reviewReady: completed,
    sourceCovered: false,
    missingFields: completed ? [] : ["handoff_rules"],
    metric: {
      enabled: handoff.enabled === true,
      hasSummary: Boolean(s(handoff.summary)),
      triggerCount: arr(handoff.triggers).length,
      hasDerivedRule: Boolean(s(draftState.humanHandoff)),
    },
  };
}

export function buildSectionStatus(draft = {}, context = {}) {
  const coverageContext = buildCoverageContext(draft, context);

  return {
    profile: buildProfileStatus(draft, coverageContext),
    services: buildServicesStatus(draft, coverageContext),
    hours: buildHoursStatus(draft, coverageContext),
    pricing: buildPricingStatus(draft, coverageContext),
    contacts: buildContactsStatus(draft, coverageContext),
    handoff: buildHandoffStatus(draft, coverageContext),
  };
}

function normalizeBlockerSeverity(key = "", state = {}) {
  const safeState = obj(state);

  if (safeState.status === "missing") {
    if (key === "profile") return "high";
    if (key === "services") return "high";
    if (key === "contacts") return "high";
    return "medium";
  }

  return "medium";
}

export function buildConfirmationBlockers(
  draft = {},
  sectionStatus = {},
  context = {}
) {
  const coverageContext = buildCoverageContext(draft, context);

  return SETUP_SUMMARY_SECTION_ORDER.filter(
    (key) => obj(sectionStatus[key]).reviewReady !== true
  ).map((key) => {
    const state = obj(sectionStatus[key]);

    return {
      key,
      severity: normalizeBlockerSeverity(key, state),
      reasonCode: `${key}_${state.status || "missing"}`,
      sourceCovered: state.sourceCovered === true,
      reviewReady: state.reviewReady === true,
      missingFields: arr(state.missingFields),
      metric: obj(state.metric),
      sourceSignalsPreview:
        key === "profile"
          ? {
              companyNameCandidates: arr(
                coverageContext.sourceSignals.companyNameCandidates
              ).slice(0, 4),
              descriptionCandidates: arr(
                coverageContext.sourceSignals.descriptionCandidates
              ).slice(0, 4),
            }
          : key === "services"
            ? {
                serviceCandidates: arr(
                  coverageContext.sourceSignals.serviceCandidates
                ).slice(0, 6),
              }
            : key === "contacts"
              ? {
                  contactCandidates: arr(
                    coverageContext.sourceSignals.contactCandidates
                  ).slice(0, 4),
                }
              : key === "hours"
                ? {
                    hoursCandidates: arr(
                      coverageContext.sourceSignals.hoursCandidates
                    ).slice(0, 4),
                  }
                : key === "pricing"
                  ? {
                      pricingCandidates: arr(
                        coverageContext.sourceSignals.pricingCandidates
                      ).slice(0, 4),
                    }
                  : {},
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

  const readyForReview = SETUP_SUMMARY_SECTION_ORDER.every(
    (key) => obj(sectionStatus[key]).reviewReady === true
  );

  return {
    hasAnyDraft,
    readyForReview,
    readyForApproval: false,
    completionCount,
    reviewReadyCount,
    totalSections: SETUP_SUMMARY_SECTION_ORDER.length,
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

export function buildReviewState(_draft = {}, summary = {}, _context = {}) {
  const readyForReview = summary.readyForReview === true;

  return {
    status: summary.hasAnyDraft ? "draft_in_progress" : "awaiting_input",
    readyForReview,
    readyForApproval: false,
    finalizeAvailable: readyForReview,
    message: "",
  };
}