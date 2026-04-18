import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import { buildSetupAssistantServiceCatalog } from "../setupAssistantCatalog.js";
import { formatSetupAssistantHoursForCanonical } from "./canonical.js";
import {
  buildAssistantCompatBusinessFacts,
  buildAssistantCompatConversationStatus,
  buildAssistantCompatFollowupQueue,
  buildAssistantCompatQuestion,
} from "./compat.js";
import {
  buildAssistantQuestion,
  isBehaviorStepRelevant,
  normalizeSetupLocale,
} from "./questions.js";
import {
  buildApprovalBlockers,
  isDraftReadyForApproval,
} from "./relevance.js";
import { buildSetupAssistantSeedFromReview } from "./seed.js";
import {
  SETUP_ASSISTANT_CURRENT_STEP,
  SETUP_ASSISTANT_NAMESPACE,
  SETUP_ASSISTANT_SOURCE_TYPE,
  normalizeSourceType,
} from "./shared.js";
import { mergeSetupAssistantCore, sanitizeSilentSynthesis } from "./sanitize.js";
import { buildSummary } from "./summary.js";

const BEHAVIOR_SECTION_KEYS = [
  "pricing_behavior",
  "location_behavior",
  "booking_behavior",
  "contact_behavior",
  "handoff_behavior",
];

function uniqueStrings(items = [], max = 24) {
  return [...new Set(arr(items).map((item) => s(item)).filter(Boolean))].slice(
    0,
    max
  );
}

function compactText(value = "", max = 280) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function resolveSetupLocaleFromSetup(setup = {}) {
  return normalizeSetupLocale(s(arr(setup.languages)[0] || "az-AZ"));
}

function deriveWebsitePrefillDraft(core = {}) {
  const businessProfile = obj(core.businessProfile);
  const sourceMetadata = obj(core.sourceMetadata);
  const websiteUrl =
    s(businessProfile.websiteUrl) ||
    (normalizeSourceType(sourceMetadata.primarySourceType) === "website"
      ? s(sourceMetadata.primarySourceUrl)
      : "");

  return {
    supported: true,
    mode: "source_or_manual_url",
    status: websiteUrl ? "captured" : "awaiting_input",
    websiteUrl,
    scanSuggested: Boolean(websiteUrl),
  };
}

function normalizeTimelineTurn(value = {}) {
  const source = obj(value);

  return compactDraftObject({
    id: s(source.id),
    role: s(source.role).toLowerCase() === "user" ? "user" : "assistant",
    text: s(source.text || source.body || source.message),
    meta: s(source.meta),
    questionKey: s(source.questionKey || source.question_key).toLowerCase(),
    phase: s(source.phase).toLowerCase(),
    provider: s(source.provider),
    model: s(source.model),
    usedFallback: source.usedFallback === true,
    error: s(source.error),
    createdAt: source.createdAt || source.created_at || null,
  });
}

function readSetupAssistantTimeline(draftPayload = {}) {
  return arr(obj(draftPayload).setupAssistantTimeline)
    .map(normalizeTimelineTurn)
    .filter((item) => item.text)
    .slice(-40);
}

function sanitizeBrainQuestion(value = {}) {
  const source = obj(value);

  return compactDraftObject({
    key: s(source.key).toLowerCase(),
    step: s(source.step || source.key).toLowerCase(),
    title: s(source.title || source.label),
    label: s(source.label || source.title),
    prompt: s(source.prompt),
    group: s(source.group || "business_truth"),
    groupLabel: s(source.groupLabel || "Business truth"),
    priority: Number(source.priority || 0) || 0,
    examples: arr(source.examples).slice(0, 3),
  });
}

function sanitizeBrainConfidence(value = {}) {
  const source = obj(value);

  return {
    strong: uniqueStrings(source.strong, 12),
    unclear: uniqueStrings(source.unclear, 12),
    contradictions: uniqueStrings(source.contradictions, 12),
  };
}

function sanitizeBrainRecommendation(value = {}) {
  const source = obj(value);

  return {
    notes: uniqueStrings(source.notes, 12),
  };
}

function sanitizeBrainSourceSignals(value = {}) {
  const source = obj(value);

  return compactDraftObject({
    primarySourceType: s(source.primarySourceType),
    primarySourceLabel: s(source.primarySourceLabel),
    primarySourceUrl: s(source.primarySourceUrl),
    primarySourceAuthorityClass: s(source.primarySourceAuthorityClass),
    pageCount: Number(source.pageCount || 0) || 0,
    sourceTypes: uniqueStrings(source.sourceTypes, 8),
    strongestEvidence: uniqueStrings(source.strongestEvidence, 12),
    discoveredPublicClaims: uniqueStrings(source.discoveredPublicClaims, 12),
    companyNameCandidates: uniqueStrings(source.companyNameCandidates, 8),
    descriptionCandidates: uniqueStrings(source.descriptionCandidates, 8),
    serviceCandidates: uniqueStrings(source.serviceCandidates, 12),
    contactCandidates: uniqueStrings(source.contactCandidates, 12),
    hoursCandidates: uniqueStrings(source.hoursCandidates, 12),
    pricingCandidates: uniqueStrings(source.pricingCandidates, 12),
    audienceCandidates: uniqueStrings(source.audienceCandidates, 8),
    languagesCandidates: uniqueStrings(source.languagesCandidates, 8),
    pricingTargetCandidates: arr(source.pricingTargetCandidates).slice(0, 6),
    locationTargetCandidates: arr(source.locationTargetCandidates).slice(0, 6),
    bookingTargetCandidates: arr(source.bookingTargetCandidates).slice(0, 6),
    contactTargetCandidates: arr(source.contactTargetCandidates).slice(0, 6),
    suggestedAssistantBehaviorDraft: obj(source.suggestedAssistantBehaviorDraft),
  });
}

function sanitizeBrainInterviewPlan(value = {}) {
  const source = obj(value);

  const activeQuestions = arr(source.activeQuestions)
    .map((item) =>
      compactDraftObject({
        key: s(item?.key).toLowerCase(),
        step: s(item?.step || item?.key).toLowerCase(),
        title: s(item?.title || item?.label),
        group: s(item?.group || "business_truth"),
        groupLabel: s(item?.groupLabel || "Business truth"),
        priority: Number(item?.priority || 0) || 0,
      })
    )
    .filter((item) => item.key);

  return compactDraftObject({
    activeQuestionKeys: uniqueStrings(
      source.activeQuestionKeys || activeQuestions.map((item) => item.key),
      12
    ),
    activeQuestions,
    remainingQuestionKeys: uniqueStrings(source.remainingQuestionKeys, 12),
    nextGroup: s(source.nextGroup || "business_truth"),
    nextGroupLabel: s(source.nextGroupLabel || "Business truth"),
  });
}

function sanitizeBrainSnapshot(value = {}) {
  const source = obj(value);

  return compactDraftObject({
    phase: s(source.phase).toLowerCase(),
    assistantMessage: compactText(
      s(source.assistantMessage || source.message),
      420
    ),
    message: compactText(s(source.message || source.assistantMessage), 420),
    nextQuestion: sanitizeBrainQuestion(source.nextQuestion),
    draft: obj(source.draft),
    acceptedPatch: obj(source.acceptedPatch),
    rejectedInputs: arr(source.rejectedInputs),
    confidence: sanitizeBrainConfidence(source.confidence),
    recommendation: sanitizeBrainRecommendation(source.recommendation),
    sourceSignals: sanitizeBrainSourceSignals(source.sourceSignals),
    interviewPlan: sanitizeBrainInterviewPlan(source.interviewPlan),
    aiBehavior: compactDraftObject({
      languages: uniqueStrings(obj(source.aiBehavior).languages, 8),
      tone: s(obj(source.aiBehavior).tone),
      greetingStyle: s(obj(source.aiBehavior).greetingStyle),
      afterHoursBehavior: s(obj(source.aiBehavior).afterHoursBehavior),
    }),
    readyForApproval: source.readyForApproval === true,
    provider: s(source.provider),
    model: s(source.model),
    usedFallback: source.usedFallback === true,
    error: s(source.error),
  });
}

function summarizeBehaviorPolicy(policyKey = "", policy = {}) {
  const safePolicy = obj(policy);

  if (policyKey === "pricing") {
    return compactText(
      [
        s(safePolicy.mode),
        safePolicy.preferredTargetUrl
          ? `target: ${safePolicy.preferredTargetUrl}`
          : "",
      ]
        .filter(Boolean)
        .join(" • "),
      220
    );
  }

  if (policyKey === "location") {
    return compactText(
      [
        s(safePolicy.mode),
        safePolicy.preferredTargetUrl
          ? `map: ${safePolicy.preferredTargetUrl}`
          : "",
      ]
        .filter(Boolean)
        .join(" • "),
      220
    );
  }

  if (policyKey === "booking") {
    return compactText(
      [
        s(safePolicy.mode),
        safePolicy.preferredTargetUrl
          ? `target: ${safePolicy.preferredTargetUrl}`
          : "",
      ]
        .filter(Boolean)
        .join(" • "),
      220
    );
  }

  if (policyKey === "contact") {
    return compactText(
      [
        s(safePolicy.mode),
        s(safePolicy.preferredChannel),
        safePolicy.preferredTargetUrl
          ? `target: ${safePolicy.preferredTargetUrl}`
          : "",
      ]
        .filter(Boolean)
        .join(" • "),
      220
    );
  }

  if (policyKey === "handoff") {
    return compactText(
      [
        s(safePolicy.mode),
        safePolicy.requiresReason === true ? "requires reason" : "",
      ]
        .filter(Boolean)
        .join(" • "),
      220
    );
  }

  return "";
}

function buildBehaviorPreview(setup = {}) {
  const behavior = obj(setup.assistantBehaviorDraft);

  return {
    pricingBehavior: summarizeBehaviorPolicy(
      "pricing",
      obj(behavior.pricingPolicy)
    ),
    locationBehavior: summarizeBehaviorPolicy(
      "location",
      obj(behavior.locationPolicy)
    ),
    bookingBehavior: summarizeBehaviorPolicy(
      "booking",
      obj(behavior.bookingPolicy)
    ),
    contactBehavior: summarizeBehaviorPolicy(
      "contact",
      obj(behavior.contactPolicy)
    ),
    handoffBehavior: summarizeBehaviorPolicy(
      "handoff",
      obj(behavior.handoffPolicy)
    ),
  };
}

function buildFallbackDraftPreview(setup = {}, { formatHours = null } = {}) {
  const businessProfile = obj(setup.businessProfile);
  const pricing = obj(setup.pricingPosture);
  const handoff = obj(setup.handoffRules);
  const behaviorPreview = buildBehaviorPreview(setup);
  const formatHoursSafe =
    typeof formatHours === "function"
      ? formatHours
      : formatSetupAssistantHoursForCanonical;

  return {
    businessName: s(businessProfile.companyName),
    businessDescription: s(businessProfile.description),
    websiteUrl: s(businessProfile.websiteUrl),
    coreServices: arr(setup.services)
      .map((item) => s(item.title || item.name || item.label))
      .filter(Boolean),
    pricingSummary: s(pricing.publicSummary),
    contactRoutes: arr(setup.contacts)
      .map((item) => s(item.value || item.label || item.type))
      .filter(Boolean),
    handoffSummary: s(handoff.summary || arr(handoff.triggers).join(", ")),
    workingHoursLines: formatHoursSafe(setup.hours),
    languages: arr(setup.languages)
      .map((item) => s(item))
      .filter(Boolean),
    tone: s(setup.tone),
    greetingStyle: s(setup.greetingStyle),
    afterHoursBehavior: s(setup.afterHoursBehavior),

    pricingBehaviorSummary: s(behaviorPreview.pricingBehavior),
    locationBehaviorSummary: s(behaviorPreview.locationBehavior),
    bookingBehaviorSummary: s(behaviorPreview.bookingBehavior),
    contactBehaviorSummary: s(behaviorPreview.contactBehavior),
    handoffBehaviorSummary: s(behaviorPreview.handoffBehavior),
  };
}

function buildInternalDraftPreview(setup = {}) {
  const silent = sanitizeSilentSynthesis(obj(setup.silentSynthesis));
  const polished = obj(silent.polishedDraft);

  if (Object.keys(polished).length) {
    return {
      businessName: s(polished.businessName),
      businessDescription: s(polished.businessDescription),
      websiteUrl: s(polished.websiteUrl),
      coreServices: uniqueStrings(polished.coreServices, 24),
      pricingSummary: s(polished.pricingSummary),
      contactRoutes: uniqueStrings(polished.contactRoutes, 24),
      handoffSummary: s(polished.handoffSummary),
      workingHoursLines: uniqueStrings(polished.workingHoursLines, 16),
      languages: uniqueStrings(polished.languages, 8),
      tone: s(polished.tone),
      greetingStyle: s(polished.greetingStyle),
      afterHoursBehavior: s(polished.afterHoursBehavior),
      pricingBehaviorSummary: s(polished.pricingBehaviorSummary),
      locationBehaviorSummary: s(polished.locationBehaviorSummary),
      bookingBehaviorSummary: s(polished.bookingBehaviorSummary),
      contactBehaviorSummary: s(polished.contactBehaviorSummary),
      handoffBehaviorSummary: s(polished.handoffBehaviorSummary),
      professionalizedAt: polished.professionalizedAt || null,
    };
  }

  return buildFallbackDraftPreview(setup, {
    formatHours: formatSetupAssistantHoursForCanonical,
  });
}

function shouldHideDraftPreview(setup = {}, readyForApproval = false) {
  const silent = sanitizeSilentSynthesis(obj(setup.silentSynthesis));
  const mode = s(silent.visibilityMode || "hidden_until_review").toLowerCase();

  if (readyForApproval === true) return false;
  return mode === "hidden_until_review";
}

function buildUserFacingDraftPreview(setup = {}, readyForApproval = false) {
  if (shouldHideDraftPreview(setup, readyForApproval)) {
    return {};
  }

  return buildInternalDraftPreview(setup);
}

function buildSummarySections(summary = {}, servicesCatalog = {}, setup = {}) {
  const sectionStatus = obj(summary.sectionStatus);
  const approvalBlockers = buildApprovalBlockers(setup);
  const blockerSteps = new Set(
    approvalBlockers.map((item) => s(item.step).toLowerCase()).filter(Boolean)
  );
  const visibleDraft = buildInternalDraftPreview(setup);

  const summaryMap = {
    identity: [s(visibleDraft.businessName), s(visibleDraft.businessDescription)]
      .filter(Boolean)
      .join(" • "),
    services: uniqueStrings(visibleDraft.coreServices, 4).join(", "),
    contacts: uniqueStrings(visibleDraft.contactRoutes, 3).join(", "),
    hours: uniqueStrings(visibleDraft.workingHoursLines, 2).join(" • "),
    pricing: s(visibleDraft.pricingSummary),
    handoff: s(visibleDraft.handoffSummary),
  };

  const baseSections = Object.keys(sectionStatus).map((key) => {
    const state = obj(sectionStatus[key]);

    return {
      key,
      label: key,
      title: key,
      status: s(state.status || "missing"),
      summary: s(summaryMap[key]),
      metric: obj(state.metric),
      sourceCovered: state.sourceCovered === true,
      reviewReady: state.reviewReady === true,
      missingFields: arr(state.missingFields),
      suggestedCount:
        key === "services" ? arr(servicesCatalog.suggestedServices).length : 0,
    };
  });

  const behaviorDraft = obj(setup.assistantBehaviorDraft);

  const behaviorSections = BEHAVIOR_SECTION_KEYS.map((key) => {
    const relevant = isBehaviorStepRelevant(key, setup);
    const blocked = blockerSteps.has(key);

    const policyKey =
      key === "pricing_behavior"
        ? "pricingPolicy"
        : key === "location_behavior"
          ? "locationPolicy"
          : key === "booking_behavior"
            ? "bookingPolicy"
            : key === "contact_behavior"
              ? "contactPolicy"
              : "handoffPolicy";

    const previewKey =
      key === "pricing_behavior"
        ? "pricingBehaviorSummary"
        : key === "location_behavior"
          ? "locationBehaviorSummary"
          : key === "booking_behavior"
            ? "bookingBehaviorSummary"
            : key === "contact_behavior"
              ? "contactBehaviorSummary"
              : "handoffBehaviorSummary";

    return {
      key,
      label: key,
      title: key,
      status: relevant ? (blocked ? "missing" : "ready") : "not_applicable",
      summary: s(visibleDraft[previewKey]),
      metric: {
        relevant,
        configured: relevant ? !blocked : true,
        hasPreferredTarget: Boolean(
          s(obj(behaviorDraft[policyKey]).preferredTargetUrl)
        ),
      },
      sourceCovered: false,
      reviewReady: relevant ? !blocked : true,
      missingFields: relevant && blocked ? [key] : [],
      suggestedCount: 0,
    };
  });

  return [...baseSections, ...behaviorSections];
}

function buildMinimalSourceSignals(setup = {}) {
  const businessProfile = obj(setup.businessProfile);
  const sourceMetadata = obj(setup.sourceMetadata);
  const pricing = obj(setup.pricingPosture);
  const silent = sanitizeSilentSynthesis(obj(setup.silentSynthesis));
  const polished = obj(silent.polishedDraft);

  const services = uniqueStrings(
    [
      ...arr(polished.coreServices),
      ...arr(setup.services).map((item) => s(item.title || item.name || item.label)),
    ],
    12
  );

  const contacts = uniqueStrings(
    [
      ...arr(polished.contactRoutes),
      ...arr(setup.contacts).map((item) => s(item.value || item.label || item.type)),
    ],
    12
  );

  const hours = uniqueStrings(
    [
      ...arr(polished.workingHoursLines),
      ...formatSetupAssistantHoursForCanonical(setup.hours),
    ],
    12
  );

  const behavior = obj(setup.assistantBehaviorDraft);

  return {
    primarySourceType: s(sourceMetadata.primarySourceType),
    primarySourceLabel:
      s(arr(sourceMetadata.sourceLabels)[0]) ||
      (s(sourceMetadata.primarySourceType)
        ? s(sourceMetadata.primarySourceType)
        : ""),
    primarySourceUrl: s(sourceMetadata.primarySourceUrl),
    primarySourceAuthorityClass: "",
    pageCount: 0,
    sourceTypes: uniqueStrings(
      s(sourceMetadata.primarySourceType)
        ? [sourceMetadata.primarySourceType]
        : [],
      8
    ),
    strongestEvidence: uniqueStrings(arr(sourceMetadata.evidenceSummary), 12),
    discoveredPublicClaims: uniqueStrings(
      arr(sourceMetadata.evidenceSummary),
      12
    ),
    companyNameCandidates: uniqueStrings(
      [polished.businessName, businessProfile.companyName],
      8
    ),
    descriptionCandidates: uniqueStrings(
      [polished.businessDescription, businessProfile.description],
      8
    ),
    serviceCandidates: services,
    contactCandidates: contacts,
    hoursCandidates: hours,
    pricingCandidates: uniqueStrings(
      [polished.pricingSummary, pricing.publicSummary],
      12
    ),
    audienceCandidates: [],
    languagesCandidates: uniqueStrings(
      [...arr(polished.languages), ...arr(setup.languages)],
      8
    ),
    pricingTargetCandidates: arr(
      s(obj(behavior.pricingPolicy).preferredTargetUrl)
        ? [{ url: s(obj(behavior.pricingPolicy).preferredTargetUrl) }]
        : []
    ),
    locationTargetCandidates: arr(
      s(obj(behavior.locationPolicy).preferredTargetUrl)
        ? [{ url: s(obj(behavior.locationPolicy).preferredTargetUrl) }]
        : []
    ),
    bookingTargetCandidates: arr(
      s(obj(behavior.bookingPolicy).preferredTargetUrl)
        ? [{ url: s(obj(behavior.bookingPolicy).preferredTargetUrl) }]
        : []
    ),
    contactTargetCandidates: arr(
      s(obj(behavior.contactPolicy).preferredTargetUrl)
        ? [{ url: s(obj(behavior.contactPolicy).preferredTargetUrl) }]
        : []
    ),
    suggestedAssistantBehaviorDraft: obj(setup.assistantBehaviorDraft),
  };
}

function buildMinimalConfidenceFromSetup(setup = {}) {
  const draftPreview = buildInternalDraftPreview(setup);

  const strong = [];
  const unclear = [];

  if (s(draftPreview.businessName)) strong.push("business_name_present");
  else unclear.push("business_name_missing");

  if (s(draftPreview.businessDescription)) {
    strong.push("business_description_present");
  } else {
    unclear.push("business_description_missing");
  }

  if (arr(draftPreview.coreServices).length) strong.push("services_present");
  else unclear.push("services_missing");

  if (arr(draftPreview.contactRoutes).length) {
    strong.push("contact_route_present");
  } else {
    unclear.push("contact_route_missing");
  }

  if (arr(draftPreview.workingHoursLines).length) strong.push("hours_present");
  else unclear.push("hours_missing");

  if (s(draftPreview.pricingSummary)) strong.push("pricing_posture_present");
  else unclear.push("pricing_posture_missing");

  if (s(draftPreview.handoffSummary)) strong.push("handoff_present");
  else unclear.push("handoff_missing");

  if (isBehaviorStepRelevant("pricing_behavior", setup)) {
    if (s(draftPreview.pricingBehaviorSummary)) {
      strong.push("pricing_behavior_present");
    } else {
      unclear.push("pricing_behavior_missing");
    }
  }

  if (isBehaviorStepRelevant("location_behavior", setup)) {
    if (s(draftPreview.locationBehaviorSummary)) {
      strong.push("location_behavior_present");
    } else {
      unclear.push("location_behavior_missing");
    }
  }

  if (isBehaviorStepRelevant("booking_behavior", setup)) {
    if (s(draftPreview.bookingBehaviorSummary)) {
      strong.push("booking_behavior_present");
    } else {
      unclear.push("booking_behavior_missing");
    }
  }

  if (isBehaviorStepRelevant("contact_behavior", setup)) {
    if (s(draftPreview.contactBehaviorSummary)) {
      strong.push("contact_behavior_present");
    } else {
      unclear.push("contact_behavior_missing");
    }
  }

  if (isBehaviorStepRelevant("handoff_behavior", setup)) {
    if (s(draftPreview.handoffBehaviorSummary)) {
      strong.push("handoff_behavior_present");
    } else {
      unclear.push("handoff_behavior_missing");
    }
  }

  return {
    strong,
    unclear,
    contradictions: [],
  };
}

function buildFallbackQuestion({ setup = {}, session = {} } = {}) {
  const locale = resolveSetupLocaleFromSetup(setup);
  const blockers = buildApprovalBlockers(setup);

  if (blockers.length) {
    return sanitizeBrainQuestion(
      buildAssistantQuestion(s(blockers[0].step || "company"), {}, { locale })
    );
  }

  const currentStep =
    s(obj(setup.progress).currentQuestionKey) ||
    s(obj(session).currentStep) ||
    SETUP_ASSISTANT_CURRENT_STEP ||
    "company";

  return sanitizeBrainQuestion(buildAssistantQuestion(currentStep, {}, { locale }));
}

export function readStoredSetupAssistantBrainPayload(draftPayload = {}) {
  const payload = obj(draftPayload);
  return sanitizeBrainSnapshot(obj(payload.setupAssistantBrain));
}

export function buildStoredSetupAssistantBrainPayload(value = {}) {
  return sanitizeBrainSnapshot(value);
}

export function normalizeStoredSetupAssistantBrainPayload(value = {}) {
  return buildStoredSetupAssistantBrainPayload(value);
}

export function resolveSessionCurrentStep(
  review = {},
  setup = {},
  nextQuestion = null
) {
  const storedSession = obj(review.session);
  const assistantState = obj(setup.assistantState);

  return (
    s(
      storedSession.currentStep ||
        assistantState.activeSection ||
        obj(setup.progress).currentQuestionKey ||
        obj(nextQuestion).key ||
        SETUP_ASSISTANT_CURRENT_STEP
    ) || SETUP_ASSISTANT_CURRENT_STEP
  );
}

export function safeDraftVersion(draftRow = {}) {
  const version = Number(draftRow.version || 1);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

export function buildStoredSetupAssistantPayload(value = {}, seed = {}) {
  const mergedCore = mergeSetupAssistantCore(seed, value);

  return {
    ...mergedCore,
    websitePrefill: deriveWebsitePrefillDraft(mergedCore),
    namespace: SETUP_ASSISTANT_NAMESPACE,
    sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
  };
}

export function normalizeStoredSetupAssistantPayload(value = {}, seed = {}) {
  return buildStoredSetupAssistantPayload(obj(value), seed);
}

export function readStoredSetupAssistantDraftPayload(draftPayload = {}) {
  const payload = obj(draftPayload);
  return obj(payload.setupAssistant || payload.onboarding);
}

export function stripLegacySetupAssistantPayloadKeys(draftPayload = {}) {
  const payload = obj(draftPayload);
  const { onboarding, ...rest } = payload;
  return rest;
}

function buildAssistantFromStoredBrain({
  session = {},
  draftRow = {},
  setup = {},
  summary = {},
  servicesCatalog = {},
  timeline = [],
  storedBrain = {},
} = {}) {
  const brain = sanitizeBrainSnapshot(storedBrain);
  const lastAssistantTurn =
    [...arr(timeline)].reverse().find((item) => s(item.role) === "assistant") ||
    {};

  const approvalBlockers = buildApprovalBlockers(setup);
  const readyForApproval =
    approvalBlockers.length === 0 &&
    isDraftReadyForApproval(setup) &&
    brain.readyForApproval === true;

  const nextQuestion =
    readyForApproval === true
      ? null
      : obj(brain.nextQuestion).key
        ? obj(brain.nextQuestion)
        : buildFallbackQuestion({ setup, session });

  const sourceSignals =
    Object.keys(obj(brain.sourceSignals)).length > 0
      ? sanitizeBrainSourceSignals(brain.sourceSignals)
      : buildMinimalSourceSignals(setup);

  const internalDraftPreview = buildInternalDraftPreview(setup);
  const userFacingDraftPreview = buildUserFacingDraftPreview(
    setup,
    readyForApproval
  );

  const confidence =
    arr(obj(brain.confidence).strong).length ||
    arr(obj(brain.confidence).unclear).length ||
    arr(obj(brain.confidence).contradictions).length
      ? sanitizeBrainConfidence(brain.confidence)
      : buildMinimalConfidenceFromSetup(setup);

  const recommendation =
    arr(obj(brain.recommendation).notes).length
      ? sanitizeBrainRecommendation(brain.recommendation)
      : {
          notes: approvalBlockers.length
            ? approvalBlockers.map((item) => s(item.reason)).filter(Boolean)
            : [],
        };

  const phase = s(
    brain.phase ||
      lastAssistantTurn.phase ||
      (readyForApproval
        ? "ready"
        : summary.hasAnyDraft
          ? "interview"
          : "source_capture")
  ).toLowerCase();

  const resolvedAssistantMessage = compactText(
    s(
      brain.assistantMessage ||
        brain.message ||
        lastAssistantTurn.text ||
        (readyForApproval ? "" : obj(nextQuestion).prompt)
    ),
    420
  );

  const interviewPlan =
    Object.keys(obj(brain.interviewPlan)).length > 0
      ? sanitizeBrainInterviewPlan(brain.interviewPlan)
      : sanitizeBrainInterviewPlan({
          activeQuestionKeys:
            obj(nextQuestion).key && !readyForApproval ? [obj(nextQuestion).key] : [],
          activeQuestions:
            obj(nextQuestion).key && !readyForApproval
              ? [
                  {
                    key: obj(nextQuestion).key,
                    step: obj(nextQuestion).step,
                    title: obj(nextQuestion).title,
                    group: obj(nextQuestion).group || "business_truth",
                    groupLabel: obj(nextQuestion).groupLabel || "Business truth",
                    priority: 1,
                  },
                ]
              : [],
          remainingQuestionKeys:
            obj(nextQuestion).key && !readyForApproval ? [obj(nextQuestion).key] : [],
          nextGroup: obj(nextQuestion).group || "business_truth",
          nextGroupLabel: obj(nextQuestion).groupLabel || "Business truth",
        });

  return {
    mode: "brain_v4",
    nextQuestion: obj(nextQuestion).key && !readyForApproval ? obj(nextQuestion) : null,
    approvalBlockers,
    confirmationBlockers: approvalBlockers,
    sections: buildSummarySections(summary, servicesCatalog, setup),
    completion: {
      ready: readyForApproval,
      action: readyForApproval
        ? {
            id: "finalize_setup",
            label: "Finish setup",
            intent: "finalize_review",
          }
        : null,
      message: readyForApproval ? resolvedAssistantMessage : "",
    },
    quickCapture: {},
    servicesCatalog,
    sourceInsights: uniqueStrings(arr(sourceSignals.strongestEvidence), 12),
    phase,
    message: resolvedAssistantMessage,
    assistantMessage: resolvedAssistantMessage,
    timeline: arr(timeline).map(normalizeTimelineTurn),
    draft: obj(userFacingDraftPreview),
    reviewDraft: obj(internalDraftPreview),
    draftPreviewHidden: shouldHideDraftPreview(setup, readyForApproval),
    draftVisibilityMode: s(
      sanitizeSilentSynthesis(obj(setup.silentSynthesis)).visibilityMode ||
        "hidden_until_review"
    ),
    confidence,
    recommendation,
    sourceSignals,
    interviewPlan,
    aiBehavior: compactDraftObject({
      languages: uniqueStrings(
        arr(obj(brain.aiBehavior).languages || setup.languages),
        8
      ),
      tone: s(obj(brain.aiBehavior).tone || setup.tone),
      greetingStyle: s(
        obj(brain.aiBehavior).greetingStyle || setup.greetingStyle
      ),
      afterHoursBehavior: s(
        obj(brain.aiBehavior).afterHoursBehavior || setup.afterHoursBehavior
      ),
    }),
    readyForApproval,
    finalizeAvailable: readyForApproval,
    reviewSessionId: s(session.id),
    draftVersion: safeDraftVersion(draftRow),
    rejectedInputs: arr(brain.rejectedInputs),
    provider: s(brain.provider || lastAssistantTurn.provider),
    model: s(brain.model || lastAssistantTurn.model),
    usedFallback:
      brain.usedFallback === true || lastAssistantTurn.usedFallback === true,
    error: s(brain.error || lastAssistantTurn.error),
  };
}

export function buildSetupAssistantSessionPayload(review = {}) {
  const session = obj(review.session);
  const draftRow = obj(review.draft);
  const draftPayload = obj(draftRow.draftPayload);
  const seed = buildSetupAssistantSeedFromReview(review);
  const timeline = readSetupAssistantTimeline(draftPayload);

  const setup = normalizeStoredSetupAssistantPayload(
    readStoredSetupAssistantDraftPayload(draftPayload),
    seed
  );

  const summaryContext = {
    review,
    session,
    sources: arr(review.sources),
  };

  const summary = buildSummary(setup, summaryContext);
  const servicesCatalog = buildSetupAssistantServiceCatalog({
    businessProfile: setup.businessProfile,
    currentServices: setup.services,
    sourceServices: seed.services,
  });

  const storedBrain = readStoredSetupAssistantBrainPayload(draftPayload);

  const assistant = buildAssistantFromStoredBrain({
    session,
    draftRow,
    setup,
    summary,
    servicesCatalog,
    timeline,
    storedBrain,
  });

  const nextQuestion = obj(assistant.nextQuestion);
  const readyForApproval = assistant.readyForApproval === true;
  const approvalBlockers = arr(assistant.approvalBlockers);
  const silent = sanitizeSilentSynthesis(obj(setup.silentSynthesis));
  const userFacingDraft = buildUserFacingDraftPreview(setup, readyForApproval);
  const internalDraft = buildInternalDraftPreview(setup);

  return {
    session: {
      id: s(session.id),
      status: s(session.status || "draft").toLowerCase(),
      mode: s(session.mode || "setup").toLowerCase(),
      currentStep: resolveSessionCurrentStep(review, setup, nextQuestion),
      startedAt: session.startedAt || session.started_at || null,
      updatedAt:
        session.updatedAt ||
        session.updated_at ||
        draftRow.updatedAt ||
        draftRow.updated_at ||
        null,
      draftVersion: safeDraftVersion(draftRow),
      reviewSessionId: s(session.id),
      draftOnly: true,
      storageModel: "tenant_setup_review",
      sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      namespace: SETUP_ASSISTANT_NAMESPACE,
    },
    setup: {
      status: summary.hasAnyDraft ? "draft_in_progress" : "awaiting_input",
      draftOnly: true,
      sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      namespace: SETUP_ASSISTANT_NAMESPACE,
      summary,
      websitePrefill: obj(setup.websitePrefill),
      draftVisibilityMode: s(silent.visibilityMode || "hidden_until_review"),
      draftPreviewHidden: shouldHideDraftPreview(setup, readyForApproval),
      hiddenSynthesis: {
        synthesisStatus: s(silent.synthesisStatus),
        lastSynthesizedAt: silent.lastSynthesizedAt || null,
        hasPolishedDraft: Object.keys(obj(silent.polishedDraft)).length > 0,
        unresolvedNotes: arr(silent.unresolvedNotes),
        recommendationNotes: arr(silent.recommendationNotes),
      },
      review: {
        status: summary.hasAnyDraft ? "draft_in_progress" : "awaiting_input",
        draftOnly: true,
        sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
        namespace: SETUP_ASSISTANT_NAMESPACE,
        readyForReview: readyForApproval,
        readyForApproval,
        finalizeAvailable: readyForApproval,
        finalized: false,
        approvalBlockers,
        message: "",
      },
      assistant,
      timeline,
      draft: obj(userFacingDraft),
      reviewDraft: obj(internalDraft),
      rawDraft: {
        businessProfile: obj(setup.businessProfile),
        services: arr(setup.services),
        contacts: arr(setup.contacts),
        hours: arr(setup.hours),
        pricingPosture: obj(setup.pricingPosture),
        handoffRules: obj(setup.handoffRules),
        assistantBehaviorDraft: obj(setup.assistantBehaviorDraft),
        sourceMetadata: obj(setup.sourceMetadata),
        assistantState: obj(setup.assistantState),
        progress: obj(setup.progress),
        languages: arr(setup.languages),
        tone: s(setup.tone),
        greetingStyle: s(setup.greetingStyle),
        afterHoursBehavior: s(setup.afterHoursBehavior),
        version: safeDraftVersion(draftRow),
        updatedAt: draftRow.updatedAt || draftRow.updated_at || null,
      },
    },
    timeline,
  };
}

export function buildSetupAssistantResponseBody(basePayload = {}, turn = null) {
  const baseBody = obj(basePayload);
  const session = obj(baseBody.session);
  const setup = obj(baseBody.setup);
  const assistant = obj(setup.assistant);

  const timeline = arr(setup.timeline || assistant.timeline).map(
    normalizeTimelineTurn
  );

  if (!turn) {
    const baseAssistant = compactDraftObject({
      ...assistant,
      timeline,
    });

    return {
      ok: true,
      ...baseBody,
      setup: {
        ...setup,
        assistant: baseAssistant,
        timeline,
      },
      assistant: baseAssistant,
      timeline,
    };
  }

  const safeTurn = sanitizeBrainSnapshot(turn);
  const guardedReadyForApproval =
    obj(assistant).readyForApproval === true && safeTurn.readyForApproval === true;

  const resolvedNextQuestion =
    guardedReadyForApproval === true
      ? null
      : obj(safeTurn.nextQuestion).key
        ? obj(safeTurn.nextQuestion)
        : obj(assistant.nextQuestion);

  const mergedAssistant = compactDraftObject({
    ...assistant,
    mode: "brain_v4",
    phase: s(safeTurn.phase || assistant.phase),
    message: compactText(
      s(safeTurn.assistantMessage || safeTurn.message || assistant.message),
      420
    ),
    assistantMessage: compactText(
      s(
        safeTurn.assistantMessage ||
          safeTurn.message ||
          assistant.assistantMessage ||
          assistant.message
      ),
      420
    ),
    nextQuestion: obj(resolvedNextQuestion).key
      ? obj(resolvedNextQuestion)
      : null,
    approvalBlockers: arr(assistant.approvalBlockers),
    confidence: sanitizeBrainConfidence(safeTurn.confidence),
    recommendation: sanitizeBrainRecommendation(safeTurn.recommendation),
    sourceSignals: sanitizeBrainSourceSignals(safeTurn.sourceSignals),
    interviewPlan: sanitizeBrainInterviewPlan(safeTurn.interviewPlan),
    aiBehavior: compactDraftObject(safeTurn.aiBehavior),
    readyForApproval: guardedReadyForApproval,
    finalizeAvailable: guardedReadyForApproval,
    rejectedInputs: arr(safeTurn.rejectedInputs),
    provider: s(safeTurn.provider),
    model: s(safeTurn.model),
    usedFallback: safeTurn.usedFallback === true,
    error: s(safeTurn.error),
    sourceInsights: uniqueStrings(
      arr(obj(safeTurn.sourceSignals).strongestEvidence),
      12
    ),
    completion: {
      ready: guardedReadyForApproval,
      action:
        guardedReadyForApproval
          ? {
              id: "finalize_setup",
              label: "Finish setup",
              intent: "finalize_review",
            }
          : null,
      message:
        guardedReadyForApproval
          ? compactText(s(safeTurn.assistantMessage || safeTurn.message), 420)
          : "",
    },
    timeline,
  });

  const compatQuestion = buildAssistantCompatQuestion(mergedAssistant);
  const compatFollowupQueue =
    buildAssistantCompatFollowupQueue(mergedAssistant);
  const compatBusinessFacts =
    buildAssistantCompatBusinessFacts(mergedAssistant);
  const compatConversationStatus =
    buildAssistantCompatConversationStatus(mergedAssistant);

  const mergedReview = {
    ...obj(setup.review),
    readyForReview: guardedReadyForApproval,
    readyForApproval: guardedReadyForApproval,
    finalizeAvailable: guardedReadyForApproval,
    approvalBlockers: arr(assistant.approvalBlockers),
    message: "",
  };

  const mergedSession = {
    ...session,
    currentStep:
      s(obj(resolvedNextQuestion).step) ||
      s(obj(resolvedNextQuestion).key) ||
      s(session.currentStep),
  };

  return {
    ok: true,
    ...baseBody,
    session: mergedSession,
    setup: {
      ...setup,
      assistant: mergedAssistant,
      review: mergedReview,
      timeline,
    },
    timeline,
    assistant: mergedAssistant,
    turn: {
      role: "assistant",
      text: s(safeTurn.assistantMessage || safeTurn.message),
      questionKey: s(obj(resolvedNextQuestion).key),
      questionCategory: s(obj(resolvedNextQuestion).group),
      payload: compactDraftObject({
        mode: mergedAssistant.mode,
        phase: mergedAssistant.phase,
        nextQuestion: obj(resolvedNextQuestion),
        approvalBlockers: arr(assistant.approvalBlockers),
        confidence: sanitizeBrainConfidence(safeTurn.confidence),
        recommendation: sanitizeBrainRecommendation(safeTurn.recommendation),
        sourceSignals: sanitizeBrainSourceSignals(safeTurn.sourceSignals),
        interviewPlan: sanitizeBrainInterviewPlan(safeTurn.interviewPlan),
        aiBehavior: obj(safeTurn.aiBehavior),
        readyForApproval: guardedReadyForApproval,
        rejectedInputs: arr(safeTurn.rejectedInputs),
        provider: s(safeTurn.provider),
        model: s(safeTurn.model),
        usedFallback: safeTurn.usedFallback === true,
        error: s(safeTurn.error),
      }),
    },
    question: compatQuestion,
    primaryQuestion: compatQuestion,
    conversationStatus: compatConversationStatus,
    followupQueue: compatFollowupQueue,
    businessFacts: compatBusinessFacts,
    reasoningSummary: arr(obj(safeTurn.recommendation).notes).join(" "),
    unknowns: arr(obj(safeTurn.confidence).unclear),
    assistantHints: arr(obj(safeTurn.sourceSignals).strongestEvidence),
    guardrails: arr(assistant.approvalBlockers),
    review: mergedReview,
  };
}