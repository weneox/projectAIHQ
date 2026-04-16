import { arr, obj, s } from "./draftShared.js";
import { formatSetupAssistantHoursForCanonical } from "./setupAssistantApp/canonical.js";
import {
  buildSetupDraftStateFromSignals,
  buildSetupKnownState,
  buildSetupSourceCoverage,
  buildSetupSourceLead,
  buildSetupSourceSignals,
} from "./setupAssistantApp/sourceSignals.js";

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

function listPreview(items = [], max = 4) {
  const safe = fallbackUniqueStrings(items, 24);
  if (!safe.length) return "";
  if (safe.length <= max) return safe.join(", ");
  return `${safe.slice(0, max).join(", ")} +${safe.length - max}`;
}

function sectionTone(status = "") {
  const key = s(status).toLowerCase();
  if (key === "ready") return "ready";
  if (key === "needs_review") return "needs_review";
  return "missing";
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
  const contradictions = [];

  if (sectionTone(sectionStatus.profile?.status) === "ready") {
    strong.push("Business identity is present and looks usable.");
  } else if (coverage.identity) {
    strong.push("Source evidence already covers the public business identity.");
  } else if (
    s(sourceSignals.primarySourceUrl) ||
    s(sourceSignals.primarySourceType)
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
    strong.push(
      `Source evidence already covers core services: ${listPreview(
        sourceSignals.serviceCandidates,
        4
      )}.`
    );
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
  } else if (s(obj(safeSetup.handoffRules).summary) || arr(obj(safeSetup.handoffRules).triggers).length) {
    strong.push("Escalation logic already exists in the draft.");
  } else if (sectionTone(sectionStatus.handoff?.status) === "needs_review") {
    unclear.push("Escalation logic exists, but still needs stronger boundaries.");
  } else {
    unclear.push("Operator handoff rules are still missing.");
  }

  if (!coverage.primarySourceExists && !draftState.websiteUrl) {
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
  const coverage = buildSetupSourceCoverage(sourceSignals);
  const notes = [];

  if (!blockers.length) {
    return {
      notes: [],
    };
  }

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
      if (!s(obj(setup).handoffRules?.summary) && !arr(obj(setup).handoffRules?.triggers).length) {
        notes.push(
          "Define exactly when AI should stop and escalate to a human."
        );
      }
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
  const coverage = buildSetupSourceCoverage(sourceSignals);
  const configuredState = buildSetupKnownState(
    buildSetupDraftStateFromSignals({
      draft: setup,
      review: null,
      sourceSignals,
    })
  );
  const sourceLead = buildSetupSourceLead(sourceSignals);

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
      "The setup draft is operationally complete enough to move into review and approval."
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