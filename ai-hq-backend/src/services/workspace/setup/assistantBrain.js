import { arr, compactObject, obj, s } from "./utils.js";
import {
  buildSetupDraftStateFromSignals,
  buildSetupSourceCoverage,
  buildSetupSourceSignals,
  detectSetupSignalContradictions,
} from "./setupAssistantApp/sourceSignals.js";

function uniqueStrings(items = [], max = 24) {
  return [...new Set(arr(items).map((item) => s(item)).filter(Boolean))].slice(
    0,
    max
  );
}

function buildDraftPreview(draftState = {}) {
  const safeDraftState = obj(draftState);

  return compactObject({
    businessName: s(safeDraftState.businessName),
    whatThisBusinessIs: s(safeDraftState.description),
    websiteUrl: s(safeDraftState.websiteUrl),
    coreServices: uniqueStrings(arr(safeDraftState.services), 16),
    audience: s(safeDraftState.audience),
    pricingPosture: s(safeDraftState.pricingPosture),
    contactRoutes: uniqueStrings(arr(safeDraftState.contacts), 12),
    humanHandoff: s(safeDraftState.humanHandoff),
    languages: uniqueStrings(arr(safeDraftState.languages), 8),
    tone: s(safeDraftState.tone),
    hours: uniqueStrings(arr(safeDraftState.hours), 12),
    greetingStyle: s(safeDraftState.greetingStyle),
    afterHoursBehavior: s(safeDraftState.afterHoursBehavior),
  });
}

function buildAiBehavior(draftState = {}) {
  const safeDraftState = obj(draftState);

  return compactObject({
    languages: uniqueStrings(arr(safeDraftState.languages), 8),
    tone: s(safeDraftState.tone),
    greetingStyle: s(safeDraftState.greetingStyle),
    afterHoursBehavior: s(safeDraftState.afterHoursBehavior),
  });
}

function buildConfidence({
  draftState = {},
  sourceCoverage = {},
  contradictions = [],
}) {
  const strong = [];
  const unclear = [];

  if (s(draftState.businessName)) strong.push("business_name_present");
  else unclear.push("business_name_missing");

  if (s(draftState.description)) strong.push("business_description_present");
  else unclear.push("business_description_missing");

  if (s(draftState.websiteUrl) || sourceCoverage.primarySourceExists === true) {
    strong.push("primary_source_present");
  } else {
    unclear.push("primary_source_missing");
  }

  if (arr(draftState.services).length) strong.push("services_present");
  else unclear.push("services_missing");

  if (arr(draftState.contacts).length) strong.push("contacts_present");
  else unclear.push("contacts_missing");

  if (arr(draftState.hours).length) strong.push("hours_present");
  else unclear.push("hours_missing");

  if (s(draftState.pricingPosture)) strong.push("pricing_posture_present");
  else unclear.push("pricing_posture_missing");

  if (s(draftState.humanHandoff)) strong.push("handoff_rules_present");
  else unclear.push("handoff_rules_missing");

  return {
    strong: uniqueStrings(strong, 16),
    unclear: uniqueStrings(unclear, 16),
    contradictions: uniqueStrings(
      arr(contradictions).map((item) => s(item.message)),
      12
    ),
  };
}

function buildRecommendation({
  draftState = {},
  sourceCoverage = {},
  contradictions = [],
}) {
  const notes = [];

  if (
    !s(draftState.businessName) ||
    !s(draftState.description) ||
    (!s(draftState.websiteUrl) && sourceCoverage.primarySourceExists !== true)
  ) {
    notes.push("identity_not_fully_grounded");
  }

  if (!arr(draftState.services).length) {
    notes.push("services_not_fully_grounded");
  }

  if (!arr(draftState.contacts).length) {
    notes.push("contacts_not_fully_grounded");
  }

  if (!arr(draftState.hours).length) {
    notes.push("hours_not_fully_grounded");
  }

  if (!s(draftState.pricingPosture)) {
    notes.push("pricing_not_fully_grounded");
  }

  if (!s(draftState.humanHandoff)) {
    notes.push("handoff_not_fully_grounded");
  }

  if (arr(contradictions).length) {
    notes.push("contradictions_present");
  }

  return {
    notes: uniqueStrings(notes, 12),
  };
}

function buildInterviewPlan() {
  return {
    activeQuestionKeys: [],
    activeQuestions: [],
    remainingQuestionKeys: [],
    nextGroup: "",
    nextGroupLabel: "",
  };
}

function buildSourceSignalsSnapshot(sourceSignals = {}) {
  const safe = obj(sourceSignals);
  const coverage = buildSetupSourceCoverage(safe);

  return {
    primarySourceType: s(safe.primarySourceType),
    primarySourceLabel: s(safe.primarySourceLabel),
    primarySourceUrl: s(safe.primarySourceUrl),
    primarySourceAuthorityClass: s(safe.primarySourceAuthorityClass),
    pageCount: Number(safe.pageCount || 0) || 0,
    sourceTypes: uniqueStrings(arr(safe.sourceTypes), 8),
    strongestEvidence: uniqueStrings(arr(safe.strongestEvidence), 12),
    discoveredPublicClaims: uniqueStrings(arr(safe.discoveredPublicClaims), 12),
    companyNameCandidates: uniqueStrings(arr(safe.companyNameCandidates), 8),
    descriptionCandidates: uniqueStrings(arr(safe.descriptionCandidates), 8),
    serviceCandidates: uniqueStrings(arr(safe.serviceCandidates), 12),
    contactCandidates: uniqueStrings(arr(safe.contactCandidates), 12),
    hoursCandidates: uniqueStrings(arr(safe.hoursCandidates), 12),
    pricingCandidates: uniqueStrings(arr(safe.pricingCandidates), 12),
    audienceCandidates: uniqueStrings(arr(safe.audienceCandidates), 8),
    languagesCandidates: uniqueStrings(arr(safe.languagesCandidates), 8),
    coverage,
  };
}

function buildReadiness({
  draftState = {},
  sourceCoverage = {},
  contradictions = [],
}) {
  const identityReady = Boolean(
    s(draftState.businessName) &&
      s(draftState.description) &&
      (s(draftState.websiteUrl) || sourceCoverage.primarySourceExists === true)
  );

  const servicesReady = arr(draftState.services).length > 0;
  const contactsReady = arr(draftState.contacts).length > 0;
  const hoursReady = arr(draftState.hours).length > 0;
  const pricingReady = Boolean(s(draftState.pricingPosture));
  const handoffReady = Boolean(s(draftState.humanHandoff));

  const readyForApproval =
    arr(contradictions).length === 0 &&
    identityReady &&
    servicesReady &&
    contactsReady &&
    hoursReady &&
    pricingReady &&
    handoffReady;

  return {
    identityReady,
    servicesReady,
    contactsReady,
    hoursReady,
    pricingReady,
    handoffReady,
    readyForApproval,
  };
}

export function buildSetupAssistantBrainState({
  session = {},
  draft = {},
  sources = [],
  review = null,
} = {}) {
  const sourceSignals = buildSetupSourceSignals({
    session,
    draft,
    sources,
    review,
  });

  const sourceCoverage = buildSetupSourceCoverage(sourceSignals);

  const draftState = buildSetupDraftStateFromSignals({
    draft,
    review,
    sourceSignals,
  });

  const contradictions = detectSetupSignalContradictions({
    draftState,
    sourceSignals,
  });

  const readiness = buildReadiness({
    draftState,
    sourceCoverage,
    contradictions,
  });

  const hasAnySignal = Boolean(
    s(draftState.businessName) ||
      s(draftState.description) ||
      s(draftState.websiteUrl) ||
      arr(draftState.services).length ||
      arr(draftState.contacts).length ||
      arr(draftState.hours).length ||
      s(draftState.pricingPosture) ||
      s(draftState.humanHandoff) ||
      s(sourceSignals.primarySourceUrl) ||
      arr(sourceSignals.sourceTypes).length
  );

  const phase = !hasAnySignal
    ? "source_capture"
    : readiness.readyForApproval
      ? "ready"
      : "interview";

  return {
    phase,
    nextQuestion: null,
    draft: buildDraftPreview(draftState),
    aiBehavior: buildAiBehavior(draftState),
    interviewPlan: buildInterviewPlan(),
    confidence: buildConfidence({
      draftState,
      sourceCoverage,
      contradictions,
    }),
    recommendation: buildRecommendation({
      draftState,
      sourceCoverage,
      contradictions,
    }),
    sourceSignals: buildSourceSignalsSnapshot(sourceSignals),
    readyForApproval: readiness.readyForApproval,
    assistantMessage: "",
  };
}

export function buildSetupAssistantFirstPrompt() {
  return {
    phase: "source_capture",
    assistantMessage: "",
    nextQuestion: null,
    interviewPlan: {
      activeQuestionKeys: [],
      activeQuestions: [],
      remainingQuestionKeys: [],
      nextGroup: "",
      nextGroupLabel: "",
    },
    aiBehavior: {},
    readyForApproval: false,
  };
}