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

function buildCoverage(sourceSignals = {}, setup = {}, summary = {}) {
  const businessProfile = obj(setup.businessProfile);
  const pricing = obj(setup.pricingPosture);
  const handoff = obj(setup.handoffRules);
  const sectionStatus = obj(summary.sectionStatus);

  const primarySourceExists =
    Boolean(s(sourceSignals.primarySourceType)) ||
    Boolean(s(sourceSignals.primarySourceUrl));

  const identity =
    sectionTone(sectionStatus.profile?.status) === "ready" ||
    Boolean(
      primarySourceExists &&
        s(firstNonEmpty(businessProfile.companyName, arr(sourceSignals.companyNameCandidates)[0])) &&
        s(firstNonEmpty(businessProfile.description, arr(sourceSignals.descriptionCandidates)[0]))
    );

  const services =
    sectionTone(sectionStatus.services?.status) === "ready" ||
    arr(sourceSignals.serviceCandidates).length >= 2 ||
    arr(setup.services).length >= 2;

  const contacts =
    sectionTone(sectionStatus.contacts?.status) === "ready" ||
    arr(sourceSignals.contactCandidates).length >= 1 ||
    arr(setup.contacts).length >= 1;

  const hours =
    sectionTone(sectionStatus.hours?.status) === "ready" ||
    arr(sourceSignals.hoursCandidates).length >= 1 ||
    countConfiguredHours(setup.hours) >= 1;

  const pricingCovered =
    sectionTone(sectionStatus.pricing?.status) === "ready" ||
    arr(sourceSignals.pricingCandidates).length >= 1 ||
    Boolean(s(pricing.publicSummary));

  const audience =
    Boolean(arr(sourceSignals.audienceCandidates).length) ||
    Boolean(s(businessProfile.targetAudience));

  const languages =
    Boolean(arr(sourceSignals.languagesCandidates).length) ||
    Boolean(arr(setup.languages).length);

  const handoffCovered =
    sectionTone(sectionStatus.handoff?.status) === "ready" ||
    Boolean(s(handoff.summary) || arr(handoff.triggers).length);

  return {
    primarySourceExists,
    identity,
    services,
    contacts,
    hours,
    pricing: pricingCovered,
    audience,
    languages,
    handoff: handoffCovered,
  };
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
  const pricing = obj(setup.pricingPosture);

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

  const sourceLabels = uniqueStringsSafe(
    [
      ...arr(sourceMetadata.sourceLabels),
      primarySourceType ? sourceTypeLabelSafe(primarySourceType) : "",
    ],
    12
  );

  const sourceTypes = uniqueStringsSafe(
    [
      primarySourceType,
      ...arr(sourceMetadata.sourceLabels).map((label) =>
        normalizeSourceTypeSafe(label)
      ),
    ].filter(Boolean),
    8
  );

  const strongestEvidence = uniqueStringsSafe(
    [
      ...arr(sourceMetadata.evidenceSummary),
      primarySourceUrl ? `Primary source: ${primarySourceUrl}` : "",
      firstNonEmpty(businessProfile.companyName)
        ? `Business name: ${s(businessProfile.companyName)}`
        : "",
      firstNonEmpty(businessProfile.description)
        ? `Description present`
        : "",
      arr(setup.services).length
        ? `Service signals: ${listPreview(
            arr(setup.services).map((item) => s(item.title || item.name || item.label)),
            4
          )}`
        : "",
      arr(setup.contacts).length
        ? `Contact signals: ${listPreview(
            arr(setup.contacts).map((item) => s(item.value || item.label || item.type)),
            3
          )}`
        : "",
      countConfiguredHours(setup.hours) > 0
        ? `Hours configured: ${countConfiguredHours(setup.hours)} days`
        : "",
      s(pricing.publicSummary)
        ? `Pricing posture: ${s(pricing.publicSummary)}`
        : "",
    ],
    12
  );

  const discoveredPublicClaims = uniqueStringsSafe(
    [
      ...arr(sourceMetadata.evidenceSummary),
      ...arr(setup.services).map((item) => s(item.title || item.name || item.label)),
      ...arr(setup.contacts).map((item) => s(item.value || item.label || item.type)),
      s(pricing.publicSummary),
    ],
    16
  );

  return {
    primarySourceType,
    primarySourceLabel:
      s(sourceLabels[0]) || sourceTypeLabelSafe(primarySourceType),
    primarySourceUrl,
    primarySourceAuthorityClass: "",
    pageCount: Number(sourceMetadata.pageCount || 0) || 0,
    sourceTypes,
    strongestEvidence,
    discoveredPublicClaims,
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
    hoursCandidates: buildAssistantDraftPreview(setup, {
      formatHours: (hours) =>
        arr(hours)
          .map((row) => {
            const item = obj(row);
            if (!s(item.day)) return "";
            if (item.appointmentOnly === true) return `${item.day} appointment only`;
            if (item.allDay === true) return `${item.day} 24/7`;
            if (item.closed === true) return `${item.day} closed`;
            if (s(item.openTime) && s(item.closeTime)) {
              return `${item.day} ${s(item.openTime)}-${s(item.closeTime)}`;
            }
            if (s(item.notes)) return `${item.day} ${s(item.notes)}`;
            return "";
          })
          .filter(Boolean),
    }).hours,
    pricingCandidates: s(pricing.publicSummary)
      ? [s(pricing.publicSummary)]
      : [],
    audienceCandidates: s(businessProfile.targetAudience)
      ? [s(businessProfile.targetAudience)]
      : [],
    languagesCandidates: arr(setup.languages)
      .map((item) => s(item))
      .filter(Boolean),
  };
}

export function buildAssistantConfidence(summary = {}, sourceSignals = {}, setup = {}) {
  const sectionStatus = obj(summary.sectionStatus);
  const safeSourceSignals = obj(sourceSignals);
  const safeSetup = obj(setup);
  const coverage = buildCoverage(safeSourceSignals, safeSetup, summary);

  const strong = [];
  const unclear = [];
  const contradictions = [];

  if (sectionTone(sectionStatus.profile?.status) === "ready") {
    strong.push("Business identity is present and looks usable.");
  } else if (coverage.identity) {
    strong.push("Source evidence already covers the public business identity.");
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
  } else if (coverage.services) {
    strong.push("Source evidence already covers core services.");
  } else if (sectionTone(sectionStatus.services?.status) === "needs_review") {
    unclear.push("Service signals exist, but they still need cleanup.");
  } else {
    unclear.push("Core services are still missing.");
  }

  if (sectionTone(sectionStatus.hours?.status) === "ready") {
    strong.push("Business hours are already structured.");
  } else if (coverage.hours) {
    strong.push("Source evidence already covers public working hours.");
  } else if (sectionTone(sectionStatus.hours?.status) === "needs_review") {
    unclear.push("Hour signals exist, but they still need confirmation.");
  } else {
    unclear.push("Public business hours are still missing.");
  }

  if (sectionTone(sectionStatus.pricing?.status) === "ready") {
    strong.push("Pricing posture is already defined.");
  } else if (coverage.pricing) {
    strong.push("Source evidence already covers pricing posture.");
  } else if (sectionTone(sectionStatus.pricing?.status) === "needs_review") {
    unclear.push("Pricing signals exist, but public reply policy still needs refinement.");
  } else {
    unclear.push("Pricing posture is still undefined.");
  }

  if (sectionTone(sectionStatus.contacts?.status) === "ready") {
    strong.push("A customer contact route is present.");
  } else if (coverage.contacts) {
    strong.push("Source evidence already covers a public contact route.");
  } else if (sectionTone(sectionStatus.contacts?.status) === "needs_review") {
    unclear.push("Contact details exist, but the main routing lane still needs confirmation.");
  } else {
    unclear.push("A public customer contact route is still missing.");
  }

  if (sectionTone(sectionStatus.handoff?.status) === "ready") {
    strong.push("Operator escalation rules are present.");
  } else if (coverage.handoff) {
    strong.push("Escalation logic already exists in the draft.");
  } else if (sectionTone(sectionStatus.handoff?.status) === "needs_review") {
    unclear.push("Escalation logic exists, but still needs stronger boundaries.");
  } else {
    unclear.push("Operator handoff rules are still missing.");
  }

  if (!coverage.primarySourceExists) {
    unclear.push("A reliable public source is still missing.");
  }

  return {
    strong,
    unclear,
    contradictions,
  };
}

export function buildAssistantRecommendation(summary = {}, sourceSignals = {}, setup = {}) {
  const blockers = arr(summary.confirmationBlockers);
  const coverage = buildCoverage(obj(sourceSignals), obj(setup), summary);

  if (!blockers.length) {
    return {
      notes: [],
    };
  }

  const notes = [];

  for (const blocker of blockers.slice(0, 4)) {
    const key = s(blocker.key);

    if (key === "profile") {
      if (!coverage.identity) {
        notes.push(
          "Lock the exact public business name and one clean description before approval."
        );
      }
      continue;
    }

    if (key === "services") {
      if (!coverage.services) {
        notes.push(
          "Keep only the real customer-facing services AI should confidently talk about."
        );
      }
      continue;
    }

    if (key === "hours") {
      if (!coverage.hours) {
        notes.push(
          "Capture the real public hours so AI does not promise the wrong availability."
        );
      }
      continue;
    }

    if (key === "pricing") {
      if (!coverage.pricing) {
        notes.push(
          "Define a safe public pricing posture before AI answers price questions."
        );
      }
      continue;
    }

    if (key === "contacts") {
      if (!coverage.contacts) {
        notes.push(
          "Choose one primary customer contact lane so AI can hand people somewhere real."
        );
      }
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
  reviewMessage = "",
  sourceSignals = {},
  setup = {}
) {
  const question = obj(nextQuestion);
  const blockers = arr(summary.confirmationBlockers);
  const blocker = obj(blockers[0]);
  const sourceHint = s(blocker.sourceHint);
  const metric = s(blocker.metric);
  const coverage = buildCoverage(obj(sourceSignals), obj(setup), summary);
  const configuredState = buildConfiguredStateSummary(setup, sourceSignals);
  const sourceLead = buildSourceLead(sourceSignals);

  const coveredParts = [];
  if (coverage.identity) coveredParts.push("identity");
  if (coverage.services) coveredParts.push("services");
  if (coverage.contacts) coveredParts.push("contact route");
  if (coverage.hours) coveredParts.push("hours");
  if (coverage.pricing) coveredParts.push("pricing posture");

  if (s(question.key)) {
    const parts = [];

    if (sourceLead) parts.push(sourceLead);
    if (configuredState.length) {
      parts.push(`Current setup already has ${configuredState.join(", ")}`);
    }
    if (coveredParts.length) {
      parts.push(
        `I will not re-ask what already looks covered by source evidence: ${coveredParts.join(
          ", "
        )}`
      );
    }
    if (sourceHint) parts.push(sourceHint);
    if (metric) parts.push(`Current signal: ${metric}`);
    if (s(question.prompt)) {
      parts.push(`Next most important gap: ${s(question.prompt)}`);
    }
    if (s(blocker.reason) && !s(question.prompt).includes(s(blocker.reason))) {
      parts.push(s(blocker.reason));
    }

    return parts.filter(Boolean).join(". ");
  }

  if (summary.readyForReview === true) {
    const parts = [];
    if (sourceLead) parts.push(sourceLead);
    if (configuredState.length) {
      parts.push(`Current setup looks solid across ${configuredState.join(", ")}`);
    }
    parts.push(
      "The setup draft is structurally complete enough to move into review and approval."
    );
    return parts.join(". ");
  }

  if (sourceLead && !s(blocker.reason)) {
    return `${sourceLead}. ${s(reviewMessage)}`;
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