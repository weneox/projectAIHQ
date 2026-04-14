import { arr, obj, s } from "./draftShared.js";

function fallbackUniqueStrings(value = [], limit = 24) {
  return Array.from(
    new Set(
      arr(value)
        .map((item) => s(item))
        .filter(Boolean)
        .slice(0, limit)
    )
  ).slice(0, limit);
}

function uniqueStringsWithHelper(value = [], limit = 24, uniqueStrings = null) {
  if (typeof uniqueStrings === "function") {
    return uniqueStrings(value, limit);
  }

  return fallbackUniqueStrings(value, limit);
}

export function buildAssistantDraftPreview(
  setup = {},
  { formatHours = null } = {}
) {
  const businessProfile = obj(setup.businessProfile);
  const pricing = obj(setup.pricingPosture);
  const handoff = obj(setup.handoffRules);
  const formatHoursSafe =
    typeof formatHours === "function" ? formatHours : () => [];

  return {
    businessName: s(businessProfile.companyName),
    whatThisBusinessIs: s(businessProfile.description),
    coreServices: arr(setup.services)
      .map((item) => s(item.title || item.name || item.label))
      .filter(Boolean),
    pricingPosture: s(pricing.publicSummary),
    contactRoutes: arr(setup.contacts)
      .map((item) => s(item.value || item.label || item.type))
      .filter(Boolean),
    humanHandoff: s(handoff.summary || arr(handoff.triggers).join(", ")),
    hours: formatHoursSafe(setup.hours),
  };
}

export function buildAssistantSourceSignals(
  setup = {},
  {
    normalizeWebsiteUrl = null,
    normalizeSourceType = null,
    sourceTypeLabel = null,
    uniqueStrings = null,
  } = {}
) {
  const businessProfile = obj(setup.businessProfile);
  const sourceMetadata = obj(setup.sourceMetadata);
  const normalizeWebsiteUrlSafe =
    typeof normalizeWebsiteUrl === "function"
      ? normalizeWebsiteUrl
      : (value = "") => s(value);
  const normalizeSourceTypeSafe =
    typeof normalizeSourceType === "function"
      ? normalizeSourceType
      : (value = "") => s(value).toLowerCase();
  const sourceTypeLabelSafe =
    typeof sourceTypeLabel === "function" ? sourceTypeLabel : () => "Source";
  const uniqueStringsSafe = (value = [], limit = 24) =>
    uniqueStringsWithHelper(value, limit, uniqueStrings);

  const websiteUrl = normalizeWebsiteUrlSafe(s(businessProfile.websiteUrl));
  const primarySourceType = websiteUrl
    ? "website"
    : normalizeSourceTypeSafe(sourceMetadata.primarySourceType);
  const primarySourceUrl = websiteUrl || s(sourceMetadata.primarySourceUrl);
  const sourceTypes = uniqueStringsSafe(
    [
      primarySourceType,
      ...arr(sourceMetadata.sourceLabels)
        .map((label) => normalizeSourceTypeSafe(label))
        .filter(Boolean),
    ],
    8
  );

  return {
    primarySourceType,
    primarySourceLabel:
      s(arr(sourceMetadata.sourceLabels)[0]) || sourceTypeLabelSafe(primarySourceType),
    primarySourceUrl,
    primarySourceAuthorityClass: "",
    pageCount: 0,
    sourceTypes,
    strongestEvidence: uniqueStringsSafe(
      [
        ...arr(sourceMetadata.evidenceSummary),
        primarySourceUrl ? `Primary source: ${primarySourceUrl}` : "",
      ],
      12
    ),
    discoveredPublicClaims: [],
  };
}

export function buildAssistantConfidence(summary = {}, sourceSignals = {}) {
  const sectionStatus = obj(summary.sectionStatus);
  const safeSourceSignals = obj(sourceSignals);
  const strong = [];
  const unclear = [];

  if (sectionStatus.profile?.status === "ready") {
    strong.push("Business identity is anchored on a confirmed public source.");
  } else {
    unclear.push("Business identity still needs a confirmed name, description, and source.");
  }

  if (sectionStatus.services?.status === "ready") {
    strong.push("Core services are drafted.");
  } else {
    unclear.push("Core services still need confirmation.");
  }

  if (sectionStatus.hours?.status === "ready") {
    strong.push("Business hours are structured.");
  } else {
    unclear.push("Business hours still need confirmation.");
  }

  if (sectionStatus.pricing?.status === "ready") {
    strong.push("Pricing posture is defined.");
  } else {
    unclear.push("Pricing posture still needs a safe public reply policy.");
  }

  if (sectionStatus.contacts?.status === "ready") {
    strong.push("A primary customer contact route is present.");
  } else {
    unclear.push("A primary customer contact route is still missing.");
  }

  if (sectionStatus.handoff?.status === "ready") {
    strong.push("Operator handoff rules are present.");
  } else {
    unclear.push("Operator handoff rules still need confirmation.");
  }

  if (
    !s(safeSourceSignals.primarySourceType) ||
    safeSourceSignals.primarySourceType === "manual"
  ) {
    unclear.push("A reliable public source identity is still missing.");
  }

  return {
    strong,
    unclear,
    contradictions: [],
  };
}

export function buildAssistantRecommendation(summary = {}) {
  const blocker = arr(summary.confirmationBlockers)[0];
  if (!blocker?.key) {
    return {
      notes: [],
    };
  }

  const notesByKey = {
    profile: "Use the main website or best public source so setup anchors on real business identity.",
    services: "Keep only the launch-critical services AI should confidently talk about.",
    hours: "Capture the real public hours so AI does not promise the wrong availability.",
    pricing: "Define a safe public pricing posture before AI answers price questions.",
    contacts: "Choose one primary contact route so AI can hand customers somewhere real.",
    handoff: "Set the human escalation cases before treating the setup draft as launch-ready.",
  };

  return {
    notes: notesByKey[blocker.key] ? [notesByKey[blocker.key]] : [],
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
      : (key = "") => ({
          key: s(key).toLowerCase(),
          step: s(key).toLowerCase(),
          title: s(key),
          group: "business_truth",
          groupLabel: "Business truth",
        });

  const activeQuestions = [
    currentQuestion.key ? currentQuestion : null,
    ...arr(summary.confirmationBlockers)
      .filter((item) => s(item.key) && s(item.key) !== s(currentQuestion.key))
      .map((item) => buildQuestionSafe(item.key)),
  ].filter(Boolean);

  return {
    activeQuestionKeys: activeQuestions.map((item) => item.key),
    activeQuestions: activeQuestions.map((item, index) => ({
      key: item.key,
      step: item.step,
      title: item.title,
      group: item.group || "business_truth",
      groupLabel: item.groupLabel || "Business truth",
      priority: Math.max(1, activeQuestions.length - index),
    })),
    remainingQuestionKeys: activeQuestions
      .filter((item) => item.key !== s(currentQuestion.key))
      .map((item) => item.key),
    nextGroup: s(currentQuestion.group || "business_truth"),
    nextGroupLabel: currentQuestion.key ? "Business truth" : "",
  };
}

export function buildAssistantMessage(
  summary = {},
  nextQuestion = null,
  reviewMessage = ""
) {
  const question = obj(nextQuestion);
  if (s(question.prompt)) {
    return s(question.prompt);
  }

  if (summary.readyForReview === true) {
    return "The setup draft is structurally complete enough to finalize into approved truth and strict runtime.";
  }

  const blocker = arr(summary.confirmationBlockers)[0];
  if (s(blocker?.reason)) {
    return s(blocker.reason);
  }

  return s(reviewMessage);
}

export function buildAssistantSections(
  summary = {},
  servicesCatalog = {},
  sectionOrder = [],
  sectionMeta = {}
) {
  return arr(sectionOrder).map((key) => {
    const meta = obj(sectionMeta[key]);
    const status = obj(summary.sectionStatus)[key]?.status || "missing";

    return {
      key,
      label: meta.label,
      title: meta.title,
      status,
      summary:
        status === "ready"
          ? meta.ready
          : status === "needs_review"
            ? meta.review
            : meta.missing,
      metric: s(obj(summary.sectionStatus)[key]?.metric),
      suggestedCount:
        key === "services" ? arr(servicesCatalog.suggestedServices).length : 0,
    };
  });
}
