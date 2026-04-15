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

function listPreview(items = [], max = 4) {
  const safe = fallbackUniqueStrings(items, 24);
  if (!safe.length) return "";
  if (safe.length <= max) return safe.join(", ");
  return `${safe.slice(0, max).join(", ")} +${safe.length - max}`;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function countConfiguredHours(hours = []) {
  return arr(hours).filter(
    (item) =>
      item?.enabled === true ||
      item?.allDay === true ||
      item?.appointmentOnly === true
  ).length;
}

function sourceTypeDisplay(type = "") {
  const key = s(type).toLowerCase();

  if (key === "website") return "Website";
  if (key === "google_maps") return "Google Maps";
  if (key === "instagram") return "Instagram";
  if (key === "facebook" || key === "facebook_page") return "Facebook";
  if (key === "manual") return "Manual note";
  return "Source";
}

function sectionTone(status = "") {
  const key = s(status).toLowerCase();
  if (key === "ready") return "ready";
  if (key === "needs_review") return "needs_review";
  return "missing";
}

function buildConfiguredStateSummary(setup = {}, sourceSignals = {}) {
  const businessProfile = obj(setup.businessProfile);
  const pricing = obj(setup.pricingPosture);
  const handoff = obj(setup.handoffRules);

  const bits = [];

  if (s(businessProfile.companyName)) bits.push("business name");
  if (s(businessProfile.description)) bits.push("business description");
  if (arr(setup.services).length) bits.push(`${arr(setup.services).length} services`);
  if (arr(setup.contacts).length) bits.push("contact route");
  if (countConfiguredHours(setup.hours) > 0) bits.push("hours");
  if (s(pricing.publicSummary)) bits.push("pricing posture");
  if (s(handoff.summary) || arr(handoff.triggers).length) {
    bits.push("handoff rules");
  }

  if (!bits.length && s(sourceSignals.primarySourceUrl)) {
    bits.push("source context");
  }

  return bits.slice(0, 5);
}

function buildSourceLead(sourceSignals = {}) {
  const label = s(sourceSignals.primarySourceLabel);
  const url = s(sourceSignals.primarySourceUrl);

  if (label && url) return `${label} source is already attached (${url})`;
  if (label) return `${label} source is already attached`;
  if (url) return `A public source is already attached (${url})`;
  return "";
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
    typeof sourceTypeLabel === "function"
      ? sourceTypeLabel
      : (value = "") => sourceTypeDisplay(value);

  const uniqueStringsSafe = (value = [], limit = 24) =>
    uniqueStringsWithHelper(value, limit, uniqueStrings);

  const websiteUrl = normalizeWebsiteUrlSafe(s(businessProfile.websiteUrl));
  const primarySourceType = websiteUrl
    ? "website"
    : normalizeSourceTypeSafe(sourceMetadata.primarySourceType);

  const primarySourceUrl = websiteUrl || s(sourceMetadata.primarySourceUrl);

  const sourceLabels = uniqueStringsSafe(arr(sourceMetadata.sourceLabels), 12);

  const sourceTypes = uniqueStringsSafe(
    [
      primarySourceType,
      ...sourceLabels.map((label) => normalizeSourceTypeSafe(label)),
    ].filter(Boolean),
    8
  );

  const strongestEvidence = uniqueStringsSafe(
    [
      ...arr(sourceMetadata.evidenceSummary),
      primarySourceUrl ? `Primary source: ${primarySourceUrl}` : "",
      primarySourceType
        ? `Primary source type: ${sourceTypeLabelSafe(primarySourceType)}`
        : "",
    ],
    12
  );

  return {
    primarySourceType,
    primarySourceLabel:
      s(sourceLabels[0]) || sourceTypeLabelSafe(primarySourceType),
    primarySourceUrl,
    primarySourceAuthorityClass: "",
    pageCount: 0,
    sourceTypes,
    strongestEvidence,
    discoveredPublicClaims: [],
    companyNameCandidates: s(businessProfile.companyName)
      ? [s(businessProfile.companyName)]
      : [],
    descriptionCandidates: s(businessProfile.description)
      ? [s(businessProfile.description)]
      : [],
    serviceCandidates: arr(setup.services)
      .map((item) => s(item.title || item.name || item.label))
      .filter(Boolean),
    contactCandidates: arr(setup.contacts)
      .map((item) => s(item.value || item.label || item.type))
      .filter(Boolean),
    hoursCandidates: [],
    pricingCandidates: s(obj(setup.pricingPosture).publicSummary)
      ? [s(obj(setup.pricingPosture).publicSummary)]
      : [],
    audienceCandidates: [],
    languagesCandidates: [],
  };
}

export function buildAssistantConfidence(summary = {}, sourceSignals = {}) {
  const sectionStatus = obj(summary.sectionStatus);
  const safeSourceSignals = obj(sourceSignals);

  const strong = [];
  const unclear = [];
  const contradictions = [];

  if (sectionTone(sectionStatus.profile?.status) === "ready") {
    strong.push("Business identity is present and looks usable.");
  } else if (
    s(safeSourceSignals.primarySourceUrl) ||
    s(safeSourceSignals.primarySourceType)
  ) {
    unclear.push(
      "A source exists, but the public business identity still needs a clean confirmation."
    );
  } else {
    unclear.push("The business identity still needs to be established.");
  }

  if (sectionTone(sectionStatus.services?.status) === "ready") {
    strong.push("Core services are already structured.");
  } else if (sectionTone(sectionStatus.services?.status) === "needs_review") {
    unclear.push("Service signals exist, but they still need cleanup.");
  } else {
    unclear.push("Core services are still missing.");
  }

  if (sectionTone(sectionStatus.hours?.status) === "ready") {
    strong.push("Business hours are already structured.");
  } else if (sectionTone(sectionStatus.hours?.status) === "needs_review") {
    unclear.push("Hour signals exist, but they still need confirmation.");
  } else {
    unclear.push("Public business hours are still missing.");
  }

  if (sectionTone(sectionStatus.pricing?.status) === "ready") {
    strong.push("Pricing posture is already defined.");
  } else if (sectionTone(sectionStatus.pricing?.status) === "needs_review") {
    unclear.push("Pricing signals exist, but public reply policy still needs refinement.");
  } else {
    unclear.push("Pricing posture is still undefined.");
  }

  if (sectionTone(sectionStatus.contacts?.status) === "ready") {
    strong.push("A customer contact route is present.");
  } else if (sectionTone(sectionStatus.contacts?.status) === "needs_review") {
    unclear.push("Contact details exist, but the main routing lane still needs confirmation.");
  } else {
    unclear.push("A public customer contact route is still missing.");
  }

  if (sectionTone(sectionStatus.handoff?.status) === "ready") {
    strong.push("Operator escalation rules are present.");
  } else if (sectionTone(sectionStatus.handoff?.status) === "needs_review") {
    unclear.push("Escalation logic exists, but still needs stronger boundaries.");
  } else {
    unclear.push("Operator handoff rules are still missing.");
  }

  if (
    !s(safeSourceSignals.primarySourceType) ||
    safeSourceSignals.primarySourceType === "manual"
  ) {
    unclear.push("A reliable public source is still missing.");
  }

  return {
    strong,
    unclear,
    contradictions,
  };
}

export function buildAssistantRecommendation(summary = {}) {
  const blockers = arr(summary.confirmationBlockers);

  if (!blockers.length) {
    return {
      notes: [],
    };
  }

  const notes = [];

  for (const blocker of blockers.slice(0, 3)) {
    const key = s(blocker.key);

    if (key === "profile") {
      notes.push(
        "Lock the exact public business name and one clean description before approval."
      );
      continue;
    }

    if (key === "services") {
      notes.push(
        "Keep only the real customer-facing services AI should confidently talk about."
      );
      continue;
    }

    if (key === "hours") {
      notes.push(
        "Capture the real public hours so AI does not promise the wrong availability."
      );
      continue;
    }

    if (key === "pricing") {
      notes.push(
        "Define a safe public pricing posture before AI answers price questions."
      );
      continue;
    }

    if (key === "contacts") {
      notes.push(
        "Choose one primary customer contact lane so AI can hand people somewhere real."
      );
      continue;
    }

    if (key === "handoff") {
      notes.push(
        "Define exactly when AI should stop and escalate to a human."
      );
    }
  }

  return {
    notes: fallbackUniqueStrings(notes, 6),
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

  const blockerQuestions = arr(summary.confirmationBlockers)
    .filter((item) => s(item.key))
    .map((item) => buildQuestionSafe(item.key));

  const activeQuestions = [
    currentQuestion.key ? currentQuestion : null,
    ...blockerQuestions.filter(
      (item) => s(item.key) && s(item.key) !== s(currentQuestion.key)
    ),
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
  const blockers = arr(summary.confirmationBlockers);
  const blocker = obj(blockers[0]);
  const sourceHint = s(blocker.sourceHint);
  const metric = s(blocker.metric);

  if (s(question.key)) {
    const parts = [];

    if (sourceHint) parts.push(sourceHint);
    if (metric) parts.push(`Current signal: ${metric}`);

    if (s(question.prompt)) {
      parts.push(`Next most important gap: ${s(question.prompt)}`);
    }

    if (s(blocker.reason)) {
      parts.push(s(blocker.reason));
    }

    return parts.filter(Boolean).join(". ");
  }

  if (summary.readyForReview === true) {
    return "The setup draft is structurally complete enough to move into review and approval.";
  }

  if (s(blocker.reason)) {
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
    const state = obj(summary.sectionStatus)[key];
    const status = s(state.status || "missing");
    const metric = s(state.metric);

    let sectionSummary = "";

    if (status === "ready") {
      sectionSummary =
        s(meta.ready) ||
        "This part is already structured well enough for the current draft.";
    } else if (status === "needs_review") {
      sectionSummary =
        s(meta.review) ||
        "Signals exist here, but they still need a cleaner confirmation.";
    } else {
      sectionSummary =
        s(meta.missing) ||
        "This part is still missing and should be captured before approval.";
    }

    return {
      key,
      label: meta.label,
      title: meta.title,
      status,
      summary: sectionSummary,
      metric,
      suggestedCount:
        key === "services" ? arr(servicesCatalog.suggestedServices).length : 0,
    };
  });
}