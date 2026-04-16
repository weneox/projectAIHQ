import { arr, obj, s } from "./draftShared.js";
import { formatSetupAssistantHoursForCanonical } from "./setupAssistantApp/canonical.js";
import {
  buildSetupDraftStateFromSignals,
  buildSetupSourceCoverage,
  buildSetupSourceSignals,
} from "./setupAssistantApp/sourceSignals.js";

function uniqueStrings(items = [], limit = 24) {
  return Array.from(
    new Set(
      arr(items)
        .map((item) => s(item))
        .filter(Boolean)
        .slice(0, limit)
    )
  ).slice(0, limit);
}

function metricValue(value) {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return s(value);
}

export function buildAssistantDraftPreview(
  setup = {},
  { formatHours = null } = {}
) {
  const businessProfile = obj(setup.businessProfile);
  const pricing = obj(setup.pricingPosture);
  const handoff = obj(setup.handoffRules);
  const formatHoursSafe =
    typeof formatHours === "function"
      ? formatHours
      : formatSetupAssistantHoursForCanonical;

  return {
    businessName: s(businessProfile.companyName),
    whatThisBusinessIs: s(businessProfile.description),
    websiteUrl: s(businessProfile.websiteUrl),
    coreServices: arr(setup.services)
      .map((item) => s(item.title || item.name || item.label))
      .filter(Boolean),
    pricingPosture: s(pricing.publicSummary),
    contactRoutes: arr(setup.contacts)
      .map((item) => s(item.value || item.label || item.type))
      .filter(Boolean),
    humanHandoff: s(handoff.summary || arr(handoff.triggers).join(", ")),
    hours: formatHoursSafe(setup.hours),
    languages: arr(setup.languages)
      .map((item) => s(item))
      .filter(Boolean),
    tone: s(setup.tone),
    greetingStyle: s(setup.greetingStyle),
    afterHoursBehavior: s(setup.afterHoursBehavior),
  };
}

export function buildAssistantSourceSignals(setup = {}, options = {}) {
  return buildSetupSourceSignals({
    session: obj(options.session),
    draft: obj(setup),
    sources: arr(options.sources),
    review: obj(options.review),
  });
}

export function buildAssistantConfidence(summary = {}, sourceSignals = {}, setup = {}) {
  const sectionStatus = obj(summary.sectionStatus);
  const safeSetup = obj(setup);
  const coverage = buildSetupSourceCoverage(sourceSignals);
  const draftState = buildSetupDraftStateFromSignals({
    draft: safeSetup,
    review: null,
    sourceSignals,
  });

  const strong = [];
  const unclear = [];
  const contradictions = uniqueStrings(
    arr(obj(summary).confirmationBlockers)
      .filter((item) => s(item.severity).toLowerCase() === "high")
      .map((item) => s(item.reasonCode || item.key)),
    12
  );

  if (obj(sectionStatus.profile).status === "ready") strong.push("profile_ready");
  else if (coverage.identity) strong.push("profile_source_covered");
  else unclear.push("profile_incomplete");

  if (obj(sectionStatus.services).status === "ready") strong.push("services_ready");
  else if (coverage.services) strong.push("services_source_covered");
  else unclear.push("services_incomplete");

  if (obj(sectionStatus.hours).status === "ready") strong.push("hours_ready");
  else if (coverage.hours) strong.push("hours_source_covered");
  else unclear.push("hours_incomplete");

  if (obj(sectionStatus.pricing).status === "ready") strong.push("pricing_ready");
  else if (coverage.pricing) strong.push("pricing_source_covered");
  else unclear.push("pricing_incomplete");

  if (obj(sectionStatus.contacts).status === "ready") strong.push("contacts_ready");
  else if (coverage.contacts) strong.push("contacts_source_covered");
  else unclear.push("contacts_incomplete");

  if (obj(sectionStatus.handoff).status === "ready") strong.push("handoff_ready");
  else if (
    s(obj(safeSetup.handoffRules).summary) ||
    arr(obj(safeSetup.handoffRules).triggers).length
  ) {
    strong.push("handoff_draft_present");
  } else {
    unclear.push("handoff_incomplete");
  }

  if (!coverage.primarySourceExists && !draftState.websiteUrl) {
    unclear.push("primary_source_missing");
  }

  return {
    strong: uniqueStrings(strong, 16),
    unclear: uniqueStrings(unclear, 16),
    contradictions,
  };
}

export function buildAssistantRecommendation(summary = {}, sourceSignals = {}, setup = {}) {
  const blockers = arr(summary.confirmationBlockers);
  const coverage = buildSetupSourceCoverage(sourceSignals);
  const safeSetup = obj(setup);
  const notes = [];

  if (!blockers.length) {
    return { notes: [] };
  }

  for (const blocker of blockers.slice(0, 6)) {
    const key = s(blocker.key);

    if (key === "profile" && !coverage.identity) {
      notes.push("identity_requires_confirmation");
      continue;
    }

    if (key === "services" && !coverage.services) {
      notes.push("services_require_curated_customer_facing_list");
      continue;
    }

    if (key === "hours" && !coverage.hours) {
      notes.push("hours_require_operator_confirmation");
      continue;
    }

    if (key === "pricing" && !coverage.pricing) {
      notes.push("pricing_requires_safe_public_rule");
      continue;
    }

    if (key === "contacts" && !coverage.contacts) {
      notes.push("contacts_require_primary_public_route");
      continue;
    }

    if (
      key === "handoff" &&
      !s(obj(safeSetup.handoffRules).summary) &&
      !arr(obj(safeSetup.handoffRules).triggers).length
    ) {
      notes.push("handoff_requires_escalation_rules");
    }
  }

  return {
    notes: uniqueStrings(notes, 12),
  };
}

export function buildAssistantInterviewPlan(
  summary = {},
  nextQuestion = null,
  { buildAssistantQuestion = null } = {}
) {
  const currentQuestion = obj(nextQuestion);

  const buildQuestionSafe =
    typeof buildAssistantQuestion === "function"
      ? buildAssistantQuestion
      : (key = "", overrides = {}) => ({
          key: s(key).toLowerCase(),
          step: s(overrides.step || key).toLowerCase(),
          title: s(overrides.title || key),
          group: s(overrides.group || "business_truth"),
          groupLabel: s(overrides.groupLabel || "Business truth"),
        });

  const blockerQuestions = arr(summary.confirmationBlockers)
    .filter((item) => s(item.key))
    .map((item) =>
      buildQuestionSafe(item.key, {
        step: item.key,
        title: item.key,
        group: "business_truth",
        groupLabel: "Business truth",
      })
    );

  const activeQuestions = [
    currentQuestion.key ? currentQuestion : null,
    ...blockerQuestions.filter(
      (item) => s(item.key) && s(item.key) !== s(currentQuestion.key)
    ),
  ].filter(Boolean);

  return {
    activeQuestionKeys: activeQuestions.map((item) => s(item.key).toLowerCase()),
    activeQuestions: activeQuestions.map((item, index) => ({
      key: s(item.key).toLowerCase(),
      step: s(item.step || item.key).toLowerCase(),
      title: s(item.title),
      group: s(item.group || "business_truth"),
      groupLabel: s(item.groupLabel || "Business truth"),
      priority: Number(item.priority || Math.max(1, activeQuestions.length - index)),
    })),
    remainingQuestionKeys: activeQuestions
      .filter((item) => s(item.key) !== s(currentQuestion.key))
      .map((item) => s(item.key).toLowerCase()),
    nextGroup: s(currentQuestion.group || "business_truth"),
    nextGroupLabel: s(currentQuestion.groupLabel || "Business truth"),
  };
}

export function buildAssistantMessage(
  _summary = {},
  nextQuestion = null,
  _reviewMessage = "",
  _sourceSignals = {},
  _setup = {}
) {
  const question = obj(nextQuestion);
  return s(question.prompt || "");
}

export function buildAssistantSections(
  summary = {},
  servicesCatalog = {},
  sectionOrder = [],
  sectionMeta = {}
) {
  return arr(sectionOrder).map((key) => {
    const meta = obj(sectionMeta[key]);
    const state = obj(obj(summary.sectionStatus)[key]);
    const status = s(state.status || "missing");

    return {
      key,
      label: s(meta.label),
      title: s(meta.title || meta.label || key),
      status,
      summary: "",
      metric: metricValue(state.metric),
      sourceCovered: state.sourceCovered === true,
      reviewReady: state.reviewReady === true,
      missingFields: arr(state.missingFields),
      suggestedCount:
        key === "services" ? arr(servicesCatalog.suggestedServices).length : 0,
    };
  });
}