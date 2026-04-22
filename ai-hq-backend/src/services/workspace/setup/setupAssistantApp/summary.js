import { arr, obj, s } from "../draftShared.js";
import {
  buildSetupDraftStateFromSignals,
  buildSetupSourceCoverage,
  buildSetupSourceSignals,
} from "./sourceSignals.js";
import {
  buildDefaultAssistantBehaviorDraft,
  normalizeClosingBehaviorMode,
  normalizeGreetingBehaviorMode,
  normalizeToneBehaviorMode,
} from "./shared.js";
import { isBehaviorStepRelevant } from "./questions.js";

export const SETUP_SUMMARY_SECTION_ORDER = [
  "profile",
  "services",
  "hours",
  "pricing",
  "contacts",
  "handoff",
  "greeting_behavior",
  "closing_behavior",
  "tone_behavior",
  "pricing_behavior",
  "location_behavior",
  "booking_behavior",
  "contact_behavior",
  "handoff_behavior",
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

  const completed = hasName && hasDescription;
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
    reportReady: completed || sourceCoverage.identity === true,
    sourceCovered: sourceCoverage.identity === true,
    phase: "business_truth",
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
  const partial = completed || sourceCoverage.services === true || sourceCount > 0;

  return {
    completed,
    partial,
    status: completed ? "ready" : partial ? "needs_review" : "missing",
    reportReady: completed || sourceCoverage.services === true,
    sourceCovered: sourceCoverage.services === true,
    phase: "business_truth",
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
  const partial = completed || sourceCoverage.hours === true || sourceCount > 0;

  return {
    completed,
    partial,
    status: completed ? "ready" : partial ? "needs_review" : "missing",
    reportReady: completed || sourceCoverage.hours === true,
    sourceCovered: sourceCoverage.hours === true,
    phase: "business_truth",
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

  const partial =
    completed ||
    sourceCoverage.pricing === true ||
    arr(sourceSignals.pricingCandidates).length > 0;

  return {
    completed,
    partial,
    status: completed ? "ready" : partial ? "needs_review" : "missing",
    reportReady: completed || sourceCoverage.pricing === true,
    sourceCovered: sourceCoverage.pricing === true,
    phase: "business_truth",
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
  const partial = completed || sourceCoverage.contacts === true || sourceCount > 0;

  return {
    completed,
    partial,
    status: completed ? "ready" : partial ? "needs_review" : "missing",
    reportReady: completed || sourceCoverage.contacts === true,
    sourceCovered: sourceCoverage.contacts === true,
    phase: "business_truth",
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
    reportReady: completed,
    sourceCovered: false,
    phase: "business_truth",
    missingFields: completed ? [] : ["handoff_rules"],
    metric: {
      enabled: handoff.enabled === true,
      hasSummary: Boolean(s(handoff.summary)),
      triggerCount: arr(handoff.triggers).length,
      hasDerivedRule: Boolean(s(draftState.humanHandoff)),
    },
  };
}

function buildGreetingBehaviorStatus(draft = {}) {
  const behavior = obj(draft.assistantBehaviorDraft);
  const policy = obj(behavior.greetingPolicy);
  const overrides = obj(behavior.tenantOverrides);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().greetingPolicy);

  const completed = Boolean(
    s(policy.openingLine) ||
      s(policy.followupLeadIn) ||
      s(policy.note) ||
      normalizeGreetingBehaviorMode(policy.mode || defaults.mode) !==
        normalizeGreetingBehaviorMode(defaults.mode) ||
      overrides.greetingOverrideActive === true
  );

  return {
    completed,
    partial: completed,
    status: completed ? "ready" : "missing",
    reportReady: completed,
    sourceCovered: false,
    phase: "conversation_policy",
    missingFields: completed ? [] : ["greeting_behavior"],
    metric: {
      hasOpeningLine: Boolean(s(policy.openingLine)),
      hasFollowupLeadIn: Boolean(s(policy.followupLeadIn)),
      overrideActive: overrides.greetingOverrideActive === true,
      mode: s(policy.mode || defaults.mode),
    },
  };
}

function buildClosingBehaviorStatus(draft = {}) {
  const behavior = obj(draft.assistantBehaviorDraft);
  const policy = obj(behavior.closingPolicy);
  const overrides = obj(behavior.tenantOverrides);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().closingPolicy);

  const completed = Boolean(
    s(policy.closingLine) ||
      s(policy.note) ||
      normalizeClosingBehaviorMode(policy.mode || defaults.mode) !==
        normalizeClosingBehaviorMode(defaults.mode) ||
      policy.includeHumanOfferWhenRelevant === false ||
      policy.includeNextStepPrompt === false ||
      overrides.closingOverrideActive === true
  );

  return {
    completed,
    partial: completed,
    status: completed ? "ready" : "missing",
    reportReady: completed,
    sourceCovered: false,
    phase: "conversation_policy",
    missingFields: completed ? [] : ["closing_behavior"],
    metric: {
      hasClosingLine: Boolean(s(policy.closingLine)),
      includeNextStepPrompt:
        policy.includeNextStepPrompt !== false,
      includeHumanOfferWhenRelevant:
        policy.includeHumanOfferWhenRelevant !== false,
      overrideActive: overrides.closingOverrideActive === true,
      mode: s(policy.mode || defaults.mode),
    },
  };
}

function buildToneBehaviorStatus(draft = {}) {
  const behavior = obj(draft.assistantBehaviorDraft);
  const policy = obj(behavior.tonePolicy);
  const platformDefaults = obj(behavior.platformDefaults);
  const overrides = obj(behavior.tenantOverrides);
  const defaults = buildDefaultAssistantBehaviorDraft();
  const defaultTone = obj(defaults.tonePolicy);
  const defaultPlatform = obj(defaults.platformDefaults);

  const completed = Boolean(
    s(policy.note) ||
      s(policy.mode) ||
      s(policy.messageLength) ||
      s(policy.empathyLevel) ||
      normalizeToneBehaviorMode(policy.mode || defaultTone.mode) !==
        normalizeToneBehaviorMode(defaultTone.mode) ||
      s(policy.messageLength || platformDefaults.messageLength) !==
        s(defaultTone.messageLength || defaultPlatform.messageLength) ||
      s(policy.empathyLevel || platformDefaults.empathyLevel) !==
        s(defaultTone.empathyLevel || defaultPlatform.empathyLevel) ||
      policy.shouldSoundPremium === true ||
      policy.shouldSoundLocalFriendly === true ||
      policy.shouldAvoidOverexplaining === false ||
      policy.shouldStayConcise === false ||
      overrides.toneOverrideActive === true
  );

  return {
    completed,
    partial: completed,
    status: completed ? "ready" : "missing",
    reportReady: completed,
    sourceCovered: false,
    phase: "conversation_policy",
    missingFields: completed ? [] : ["tone_behavior"],
    metric: {
      mode: s(policy.mode || defaultTone.mode),
      messageLength: s(
        policy.messageLength || platformDefaults.messageLength || defaultTone.messageLength
      ),
      empathyLevel: s(
        policy.empathyLevel || platformDefaults.empathyLevel || defaultTone.empathyLevel
      ),
      overrideActive: overrides.toneOverrideActive === true,
    },
  };
}

function buildGenericBehaviorStatus({
  questionKey = "",
  policy = {},
  defaults = {},
  metricBuilder = null,
  isConfigured = false,
  relevant = false,
}) {
  if (!relevant) {
    return {
      completed: true,
      partial: false,
      status: "not_applicable",
      reportReady: true,
      sourceCovered: false,
      phase: "conversation_policy",
      missingFields: [],
      metric:
        typeof metricBuilder === "function"
          ? metricBuilder({ policy, defaults, relevant })
          : {},
    };
  }

  return {
    completed: isConfigured,
    partial: isConfigured,
    status: isConfigured ? "ready" : "missing",
    reportReady: isConfigured,
    sourceCovered: false,
    phase: "conversation_policy",
    missingFields: isConfigured ? [] : [questionKey],
    metric:
      typeof metricBuilder === "function"
        ? metricBuilder({ policy, defaults, relevant })
        : {},
  };
}

function buildPricingBehaviorStatus(draft = {}) {
  const behavior = obj(draft.assistantBehaviorDraft);
  const policy = obj(behavior.pricingPolicy);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().pricingPolicy);
  const relevant = isBehaviorStepRelevant("pricing_behavior", draft);

  const isConfigured = Boolean(
    s(policy.preferredTargetUrl) ||
      s(policy.fallbackTargetUrl) ||
      s(policy.note) ||
      s(policy.mode) ||
      policy.askServiceFirst === true
  );

  return buildGenericBehaviorStatus({
    questionKey: "pricing_behavior",
    policy,
    defaults,
    relevant,
    isConfigured,
    metricBuilder: ({ policy: row, defaults: rowDefaults }) => ({
      mode: s(row.mode || rowDefaults.mode),
      hasPreferredTarget: Boolean(s(row.preferredTargetUrl)),
      askServiceFirst: row.askServiceFirst === true,
      notePresent: Boolean(s(row.note)),
    }),
  });
}

function buildLocationBehaviorStatus(draft = {}) {
  const behavior = obj(draft.assistantBehaviorDraft);
  const policy = obj(behavior.locationPolicy);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().locationPolicy);
  const relevant = isBehaviorStepRelevant("location_behavior", draft);

  const isConfigured = Boolean(
    s(policy.preferredTargetUrl) ||
      s(policy.fallbackTargetUrl) ||
      s(policy.note) ||
      s(policy.mode)
  );

  return buildGenericBehaviorStatus({
    questionKey: "location_behavior",
    policy,
    defaults,
    relevant,
    isConfigured,
    metricBuilder: ({ policy: row, defaults: rowDefaults }) => ({
      mode: s(row.mode || rowDefaults.mode),
      hasPreferredTarget: Boolean(s(row.preferredTargetUrl)),
      notePresent: Boolean(s(row.note)),
    }),
  });
}

function buildBookingBehaviorStatus(draft = {}) {
  const behavior = obj(draft.assistantBehaviorDraft);
  const policy = obj(behavior.bookingPolicy);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().bookingPolicy);
  const relevant = isBehaviorStepRelevant("booking_behavior", draft);

  const isConfigured = Boolean(
    s(policy.preferredTargetUrl) ||
      s(policy.fallbackTargetUrl) ||
      s(policy.note) ||
      s(policy.mode) ||
      policy.collectLeadFirst === true
  );

  return buildGenericBehaviorStatus({
    questionKey: "booking_behavior",
    policy,
    defaults,
    relevant,
    isConfigured,
    metricBuilder: ({ policy: row, defaults: rowDefaults }) => ({
      mode: s(row.mode || rowDefaults.mode),
      hasPreferredTarget: Boolean(s(row.preferredTargetUrl)),
      collectLeadFirst: row.collectLeadFirst === true,
      notePresent: Boolean(s(row.note)),
    }),
  });
}

function buildContactBehaviorStatus(draft = {}) {
  const behavior = obj(draft.assistantBehaviorDraft);
  const policy = obj(behavior.contactPolicy);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().contactPolicy);
  const relevant = isBehaviorStepRelevant("contact_behavior", draft);

  const isConfigured = Boolean(
    s(policy.preferredTargetUrl) ||
      s(policy.fallbackTargetUrl) ||
      s(policy.note) ||
      s(policy.mode) ||
      s(policy.preferredChannel)
  );

  return buildGenericBehaviorStatus({
    questionKey: "contact_behavior",
    policy,
    defaults,
    relevant,
    isConfigured,
    metricBuilder: ({ policy: row, defaults: rowDefaults }) => ({
      mode: s(row.mode || rowDefaults.mode),
      preferredChannel: s(row.preferredChannel),
      hasPreferredTarget: Boolean(s(row.preferredTargetUrl)),
      notePresent: Boolean(s(row.note)),
    }),
  });
}

function buildHandoffBehaviorStatus(draft = {}) {
  const behavior = obj(draft.assistantBehaviorDraft);
  const policy = obj(behavior.handoffPolicy);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().handoffPolicy);
  const relevant = isBehaviorStepRelevant("handoff_behavior", draft);

  const isConfigured = Boolean(
    s(policy.note) ||
      s(policy.mode) ||
      policy.requiresReason === false
  );

  return buildGenericBehaviorStatus({
    questionKey: "handoff_behavior",
    policy,
    defaults,
    relevant,
    isConfigured,
    metricBuilder: ({ policy: row, defaults: rowDefaults }) => ({
      mode: s(row.mode || rowDefaults.mode),
      requiresReason:
        typeof row.requiresReason === "boolean"
          ? row.requiresReason
          : rowDefaults.requiresReason === true,
      notePresent: Boolean(s(row.note)),
    }),
  });
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

    greeting_behavior: buildGreetingBehaviorStatus(draft),
    closing_behavior: buildClosingBehaviorStatus(draft),
    tone_behavior: buildToneBehaviorStatus(draft),
    pricing_behavior: buildPricingBehaviorStatus(draft),
    location_behavior: buildLocationBehaviorStatus(draft),
    booking_behavior: buildBookingBehaviorStatus(draft),
    contact_behavior: buildContactBehaviorStatus(draft),
    handoff_behavior: buildHandoffBehaviorStatus(draft),
  };
}

function normalizeBlockerSeverity(key = "", state = {}) {
  const safeState = obj(state);

  if (safeState.status === "missing") {
    if (key === "profile") return "high";
    if (key === "services") return "high";
    if (key === "contacts") return "high";
    if (key === "greeting_behavior") return "medium";
    if (key === "closing_behavior") return "medium";
    if (key === "tone_behavior") return "medium";
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

  return SETUP_SUMMARY_SECTION_ORDER.filter((key) => {
    const state = obj(sectionStatus[key]);
    return state.completed !== true && s(state.status) !== "not_applicable";
  }).map((key) => {
    const state = obj(sectionStatus[key]);

    return {
      key,
      step: key,
      severity: normalizeBlockerSeverity(key, state),
      reason: `${key} still needs confirmation.`,
      reasonCode: `${key}_${state.status || "missing"}`,
      sourceCovered: state.sourceCovered === true,
      reportReady: state.reportReady === true,
      phase: s(state.phase || "business_truth"),
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
  const partialCount = Object.values(sectionStatus).filter(
    (item) => item.partial === true
  ).length;
  const reportReadyCount = Object.values(sectionStatus).filter(
    (item) => item.reportReady === true
  ).length;

  const confirmationBlockers = buildConfirmationBlockers(
    draft,
    sectionStatus,
    context
  );

  const businessTruthReady = [
    "profile",
    "services",
    "hours",
    "pricing",
    "contacts",
    "handoff",
  ].every((key) => obj(sectionStatus[key]).completed === true);

  const conversationPolicyReady = [
    "greeting_behavior",
    "closing_behavior",
    "tone_behavior",
    "pricing_behavior",
    "location_behavior",
    "booking_behavior",
    "contact_behavior",
    "handoff_behavior",
  ]
    .filter((key) => s(obj(sectionStatus[key]).status) !== "not_applicable")
    .every((key) => obj(sectionStatus[key]).completed === true);

  const hasAnyDraft =
    completionCount > 0 ||
    partialCount > 0 ||
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

  return {
    hasAnyDraft,
    completionCount,
    partialCount,
    reportReadyCount,
    totalSections: SETUP_SUMMARY_SECTION_ORDER.length,
    blockerCount: confirmationBlockers.length,
    businessTruthReady,
    conversationPolicyReady,
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
  const blockerCount = Number(summary.blockerCount || 0) || 0;
  const hasAnyDraft = summary.hasAnyDraft === true;
  const businessTruthReady = summary.businessTruthReady === true;
  const conversationPolicyReady = summary.conversationPolicyReady === true;
  const readyForApproval =
    hasAnyDraft && blockerCount === 0 && businessTruthReady && conversationPolicyReady;

  return {
    status: hasAnyDraft
      ? readyForApproval
        ? "ready_for_review"
        : "draft_in_progress"
      : "awaiting_input",
    readyForReview: hasAnyDraft,
    readyForApproval,
    finalizeAvailable: readyForApproval,
    message: readyForApproval
      ? "Business truth and conversation policy are ready for final review."
      : hasAnyDraft
        ? "Setup draft is still being completed."
        : "",
  };
}