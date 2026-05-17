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
  const existingWebsitePrefill = obj(core.websitePrefill);
  const existingStatus = s(existingWebsitePrefill.status).toLowerCase();
  const websiteUrl =
    s(existingWebsitePrefill.websiteUrl) ||
    s(businessProfile.websiteUrl) ||
    (normalizeSourceType(sourceMetadata.primarySourceType) === "website"
      ? s(sourceMetadata.primarySourceUrl)
      : "");

  const skipped = existingStatus === "skipped" && !websiteUrl;

  return {
    supported: true,
    mode: "source_or_manual_url",
    status: websiteUrl ? "captured" : skipped ? "skipped" : "awaiting_input",
    websiteUrl,
    scanSuggested: Boolean(websiteUrl),
  };
}

function buildSetupSourceStrategy(setup = {}) {
  const businessProfile = obj(setup.businessProfile);
  const sourceMetadata = obj(setup.sourceMetadata);
  const websitePrefill = obj(setup.websitePrefill);
  const websiteUrl =
    s(websitePrefill.websiteUrl) ||
    s(businessProfile.websiteUrl) ||
    (normalizeSourceType(sourceMetadata.primarySourceType) === "website"
      ? s(sourceMetadata.primarySourceUrl)
      : "");

  const websiteStatus =
    websiteUrl
      ? "captured"
      : s(websitePrefill.status) === "skipped"
        ? "skipped"
        : "awaiting_input";

  const primaryMode = websiteUrl ? "website" : "manual_brief";

  return {
    version: 1,
    productMode: "ai_business_brain_builder",
    sourceOrder: ["website", "manual_brief"],
    disabledSources: ["google_maps"],
    primaryMode,
    nextAction:
      primaryMode === "website"
        ? "analyze_website_then_review_gaps"
        : "collect_manual_brief",
    website: {
      enabled: true,
      required: false,
      status: websiteStatus,
      url: websiteUrl,
      helperText:
        "Website varsa link verin, sistem biznes məlumatlarını avtomatik çıxarsın.",
    },
    manualBrief: {
      enabled: true,
      required: !websiteUrl,
      status: websiteUrl ? "available_as_fallback" : "recommended",
      prompt:
        "Website yoxdursa, biznesinizi 2-3 cümlə ilə yazın. Sistem AI resepsionist draftını özü hazırlayacaq.",
      maxSuggestedQuestions: 5,
    },
    googleMaps: {
      enabled: false,
      status: "disabled_for_v1",
      helperText:
        "Google Maps V1 setup-da əsas mənbə deyil; website və manual brief kifayət etməsə sonra fallback kimi əlavə olunacaq.",
    },
  };
}

function buildAiProfilePreview({ setup = {}, assistant = {}, approvalBlockers = [] } = {}) {
  const draft = buildInternalDraftPreview(setup);
  const confidence = buildMinimalConfidenceFromSetup(setup);
  const blockers = arr(approvalBlockers).slice(0, 5);

  const knows = [
    s(draft.businessName)
      ? {
          key: "business_identity",
          label: "Biznes kimliyi",
          summary: [s(draft.businessName), s(draft.businessDescription)]
            .filter(Boolean)
            .join(" — "),
        }
      : null,
    arr(draft.coreServices).length
      ? {
          key: "services",
          label: "Xidmətlər",
          summary: uniqueStrings(draft.coreServices, 8).join(", "),
        }
      : null,
    arr(draft.contactRoutes).length
      ? {
          key: "contacts",
          label: "Əlaqə",
          summary: uniqueStrings(draft.contactRoutes, 6).join(", "),
        }
      : null,
    arr(draft.workingHoursLines).length
      ? {
          key: "hours",
          label: "İş saatları",
          summary: uniqueStrings(draft.workingHoursLines, 4).join(" • "),
        }
      : null,
    s(draft.pricingSummary)
      ? {
          key: "pricing",
          label: "Qiymət məntiqi",
          summary: s(draft.pricingSummary),
        }
      : null,
    s(draft.handoffSummary)
      ? {
          key: "handoff",
          label: "İnsana ötürmə",
          summary: s(draft.handoffSummary),
        }
      : null,
  ].filter(Boolean);

  return {
    version: 1,
    title: "AI biznes profili",
    summary:
      knows.length > 0
        ? "Sistem biznes məlumatlarından ilkin business brain draftı hazırlayıb."
        : "Business brain üçün hələ kifayət qədər biznes məlumatı yoxdur.",
    sourceStrategy: buildSetupSourceStrategy(setup),
    knows,
    willNotInvent: [
      "Təsdiqlənməmiş qiymət, availability və xüsusi şərtləri uydurmayacaq.",
      "Business Truth-da olmayan xidməti varmış kimi deməyəcək.",
      "Tibbi, hüquqi və yüksək riskli mövzuda qəti zəmanət verməyəcək.",
      "Əmin olmadığı yerdə qısa şəkildə insana yönləndirmə təklif edəcək.",
    ],
    missingQuestions: blockers.map((item) => ({
      key: s(item.step || item.key),
      label: s(item.label || item.step || item.key),
      reason: s(item.reason || item.message),
    })),
    confidence: {
      strong: uniqueStrings(confidence.strong, 12),
      unclear: uniqueStrings(confidence.unclear, 12),
      contradictions: uniqueStrings(confidence.contradictions, 12),
    },
    readyForReview:
      obj(assistant).readyForApproval === true || blockers.length === 0,
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
    aiBehavior: {},
    readyForApproval: source.readyForApproval === true,
    provider: s(source.provider),
    model: s(source.model),
    usedFallback: source.usedFallback === true,
    error: s(source.error),
  });
}

function buildFallbackDraftPreview(setup = {}, { formatHours = null } = {}) {
  const businessProfile = obj(setup.businessProfile);
  const pricing = obj(setup.pricingPosture);
  const handoff = obj(setup.handoffRules);
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

  return Object.keys(sectionStatus).map((key) => {
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
  const sourceWebsitePrefill =
    obj(value).websitePrefill ||
    obj(value).website_prefill ||
    obj(seed).websitePrefill ||
    obj(seed).website_prefill ||
    {};

  return {
    ...mergedCore,
    websitePrefill: deriveWebsitePrefillDraft({
      ...mergedCore,
      websitePrefill: sourceWebsitePrefill,
    }),
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
    aiBehavior: {},
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

export function buildDefaultAssistantStyleProfile() {
  return {
    profileKey: "default_professional",
    setupBlocking: false,
    truthAuthority: false,
    purpose: "style_only",
    toneProfile: "professional",
    replyLength: "concise",
    emojiPolicy: "off",
    openingPolicy: "polite_not_repetitive",
    languagePolicy: "follow_customer_when_possible",
    handoffPolicy: "offer_human_help_for_risk_exact_quote_complaint_unclear",
    customizationState: "optional",
    safeToUseWithoutUserCustomization: true,
  };
}

function resolveSetupLifecycleAction(status = "") {
  const safeStatus = s(status).toLowerCase();

  if (safeStatus === "not_started") return "add_business_input";
  if (safeStatus === "collecting_inputs") return "continue_collecting_inputs";
  if (safeStatus === "extracting") return "wait_for_extraction";
  if (safeStatus === "draft_ready") return "review_business_draft";
  if (safeStatus === "missing_required_facts") return "answer_missing_required_facts";
  if (safeStatus === "conflict_needs_review") return "resolve_conflicts";
  if (safeStatus === "ready_for_approval") return "approve_and_publish_truth";
  if (safeStatus === "approved_live") return "monitor_live_truth";
  if (safeStatus === "stale_needs_review") return "review_stale_truth";

  return "add_business_input";
}

export function buildSetupLifecycleState({
  session = {},
  setup = {},
  summary = {},
  assistant = {},
  silentSynthesis = {},
  approvalBlockers = [],
} = {}) {
  const sessionStatus = s(session.status || session.status_key).toLowerCase();
  const phase = s(assistant.phase).toLowerCase();
  const synthesisStatus = s(silentSynthesis.synthesisStatus).toLowerCase();
  const sourceMetadata = obj(setup.sourceMetadata);
  const confidence = obj(assistant.confidence);
  const blockers = arr(approvalBlockers).map((item) => s(item)).filter(Boolean);
  const conflictCount = arr(confidence.contradictions).length;

  const hasBusinessProfile = Object.keys(obj(setup.businessProfile)).length > 0;
  const hasDraft =
    obj(summary).hasAnyDraft === true ||
    hasBusinessProfile ||
    arr(setup.services).length > 0 ||
    arr(setup.contacts).length > 0 ||
    Object.keys(obj(silentSynthesis.polishedDraft)).length > 0;

  const hasInputEvidence =
    s(sourceMetadata.primarySourceUrl) ||
    arr(sourceMetadata.evidenceSummary).length > 0 ||
    arr(sourceMetadata.sourceLabels).length > 0;

  const readyForApproval = assistant.readyForApproval === true;
  const approvedLive = ["approved", "finalized", "live", "completed"].includes(
    sessionStatus
  );

  let status = "not_started";

  if (approvedLive) {
    status = "approved_live";
  } else if (readyForApproval) {
    status = "ready_for_approval";
  } else if (conflictCount > 0) {
    status = "conflict_needs_review";
  } else if (blockers.length > 0) {
    status = "missing_required_facts";
  } else if (phase === "extracting" || synthesisStatus === "extracting") {
    status = "extracting";
  } else if (hasDraft || ["synthesized", "partial"].includes(synthesisStatus)) {
    status = "draft_ready";
  } else if (hasInputEvidence) {
    status = "collecting_inputs";
  }

  return compactDraftObject({
    version: 1,
    status,
    primaryExperience: "review_room",
    businessTruthRequired: true,
    runtimeAuthority: "approved_truth",
    draftAuthority: "not_runtime_authority",
    assistantStyleBlocking: false,
    hasDraft,
    hasInputEvidence: Boolean(hasInputEvidence),
    readyForApproval,
    canApprove: readyForApproval && !approvedLive,
    needsReview: [
      "draft_ready",
      "missing_required_facts",
      "conflict_needs_review",
      "ready_for_approval",
      "stale_needs_review",
    ].includes(status),
    needsUserInput: [
      "not_started",
      "collecting_inputs",
      "missing_required_facts",
      "conflict_needs_review",
    ].includes(status),
    approvedLive,
    approvalBlockers: blockers,
    conflictCount,
    recommendedNextAction: resolveSetupLifecycleAction(status),
  });
}

export function buildSetupProductModel() {
  return {
    primaryExperience: "review_room",
    setupPurpose: "business_truth_preparation",
    businessTruthSetup: {
      required: true,
      runtimeAuthority: "approved_truth",
      draftAuthority: "not_runtime_authority",
    },
    assistantBehaviour: {
      required: false,
      defaulted: true,
      authority: "style_only_not_truth",
      setupBlocking: false,
      defaultProfile: buildDefaultAssistantStyleProfile(),
    },
    inputMethods: [
      "website_source",
      "manual_brief",
      "document_upload",
      "pasted_text",
      "chat_answers",
      "existing_truth",
      "channel_metadata",
    ],
    reviewSections: [
      "profile",
      "services",
      "contacts",
      "hours",
      "pricing",
      "handoff",
      "languages",
      "sources",
    ],
    productRules: [
      "website_is_input_not_setup_model",
      "chat_is_input_not_main_experience",
      "review_room_is_main_experience",
      "draft_is_not_runtime_authority",
      "approved_truth_is_runtime_authority",
      "assistant_behaviour_never_mutates_truth",
    ],
  };
}

function buildReviewRoomSection({
  key = "",
  label = "",
  status = "missing",
  itemCount = 0,
  sourceBacked = false,
  required = true,
  action = "review",
} = {}) {
  return compactDraftObject({
    key,
    label,
    status,
    required,
    itemCount,
    sourceBacked,
    action,
  });
}

function buildReviewRoomFact({
  key = "",
  label = "",
  value = "",
  kind = "text",
} = {}) {
  const safeValue = s(value);
  if (!safeValue) return null;

  return compactDraftObject({
    key,
    label,
    value: safeValue,
    kind,
  });
}

function buildSetupReviewRoomSectionDetails({
  setup = {},
  sections = [],
  hasSourceEvidence = false,
} = {}) {
  const profile = obj(setup.businessProfile);
  const pricing = obj(setup.pricingPosture);
  const handoff = obj(setup.handoffRules);
  const sourceMetadata = obj(setup.sourceMetadata);
  const sectionByKey = Object.fromEntries(
    arr(sections).map((section) => [s(section.key), section])
  );

  const detail = ({
    key = "",
    title = "",
    facts = [],
    items = [],
    emptyState = "",
  } = {}) => {
    const section = obj(sectionByKey[key]);

    return compactDraftObject({
      key,
      title,
      status: s(section.status || "missing"),
      action: s(section.action || "review"),
      sourceBacked: section.sourceBacked === true,
      facts: arr(facts).filter(Boolean),
      items: arr(items).map((item) => s(item)).filter(Boolean).slice(0, 40),
      emptyState,
    });
  };

  return [
    detail({
      key: "profile",
      title: "Business profile",
      facts: [
        buildReviewRoomFact({
          key: "companyName",
          label: "Business name",
          value: profile.companyName,
        }),
        buildReviewRoomFact({
          key: "description",
          label: "Description",
          value: profile.description,
        }),
        buildReviewRoomFact({
          key: "websiteUrl",
          label: "Website",
          value: profile.websiteUrl,
          kind: "url",
        }),
      ],
      emptyState: "Add the business name and a short description.",
    }),
    detail({
      key: "services",
      title: "Services",
      items: arr(setup.services).map((item) =>
        s(item?.title || item?.name || item?.label)
      ),
      emptyState: "Add the services this business offers.",
    }),
    detail({
      key: "contacts",
      title: "Contacts",
      items: arr(setup.contacts).map((item) =>
        [s(item?.label), s(item?.value || item?.type)]
          .filter(Boolean)
          .join(": ")
      ),
      emptyState: "Add public contact routes such as phone, WhatsApp, email, or address.",
    }),
    detail({
      key: "hours",
      title: "Hours and availability",
      items: formatSetupAssistantHoursForCanonical(setup.hours),
      emptyState: "Add working hours or availability posture.",
    }),
    detail({
      key: "pricing",
      title: "Pricing posture",
      facts: [
        buildReviewRoomFact({
          key: "publicSummary",
          label: "Public summary",
          value: pricing.publicSummary || pricing.pricingNotes,
        }),
        buildReviewRoomFact({
          key: "currency",
          label: "Currency",
          value: pricing.currency,
        }),
      ],
      emptyState: "Add what AI may safely say about pricing.",
    }),
    detail({
      key: "handoff",
      title: "Human handoff",
      facts: [
        buildReviewRoomFact({
          key: "summary",
          label: "Summary",
          value: handoff.summary,
        }),
      ],
      items: arr(handoff.triggers),
      emptyState: "Add when AI should route the customer to a human.",
    }),
    detail({
      key: "languages",
      title: "Languages",
      items: arr(setup.languages),
      emptyState: "Add the languages the assistant should support.",
    }),
    detail({
      key: "sources",
      title: "Sources",
      facts: [
        buildReviewRoomFact({
          key: "primarySourceType",
          label: "Primary source type",
          value: sourceMetadata.primarySourceType,
        }),
        buildReviewRoomFact({
          key: "primarySourceUrl",
          label: "Primary source URL",
          value: sourceMetadata.primarySourceUrl,
          kind: "url",
        }),
      ],
      items: [
        ...arr(sourceMetadata.sourceLabels),
        ...arr(sourceMetadata.evidenceSummary),
      ],
      emptyState: hasSourceEvidence
        ? ""
        : "Add a website, document, or manual brief as evidence.",
    }),
  ];
}

function buildSetupReviewRoomActions({
  lifecycleState = {},
  missingSections = [],
} = {}) {
  const status = s(lifecycleState.status);
  const recommendedNextAction = s(lifecycleState.recommendedNextAction);
  const canApprove = lifecycleState.canApprove === true;
  const missing = arr(missingSections).map((item) => s(item)).filter(Boolean);

  const primary = canApprove
    ? {
        id: "approve_and_publish_truth",
        label: "Approve and make live",
        intent: "finalize_review",
        enabled: true,
      }
    : {
        id: recommendedNextAction || "add_business_input",
        label:
          status === "not_started"
            ? "Add business information"
            : status === "collecting_inputs"
              ? "Continue adding information"
              : status === "missing_required_facts"
                ? "Complete missing facts"
                : status === "conflict_needs_review"
                  ? "Resolve conflicts"
                  : "Review business draft",
        intent:
          status === "conflict_needs_review"
            ? "resolve_conflicts"
            : status === "missing_required_facts"
              ? "answer_missing_facts"
              : "continue_setup",
        enabled: true,
      };

  return {
    version: 1,
    primary,
    secondary: [
      {
        id: "add_more_input",
        label: "Add more business information",
        intent: "add_input",
        enabled: true,
      },
      {
        id: "edit_review_sections",
        label: "Edit review sections",
        intent: "edit_sections",
        enabled: true,
      },
      {
        id: "customize_assistant_style",
        label: "Customize assistant style",
        intent: "customize_style",
        enabled: true,
        setupBlocking: false,
      },
    ],
    approval: {
      id: "approve_and_publish_truth",
      label: "Approve and make live",
      enabled: canApprove,
      blockedReason: canApprove
        ? ""
        : missing.length
          ? "missing_required_sections"
          : "not_ready_for_approval",
      missingSections: missing,
      runtimeAuthorityAfterApproval: "approved_truth",
    },
  };
}

export function buildSetupReviewRoom({ setup = {}, lifecycleState = {} } = {}) {
  const profile = obj(setup.businessProfile);
  const pricing = obj(setup.pricingPosture);
  const handoff = obj(setup.handoffRules);
  const sourceMetadata = obj(setup.sourceMetadata);
  const stateStatus = s(lifecycleState.status);

  const hasSourceEvidence =
    s(sourceMetadata.primarySourceUrl) ||
    arr(sourceMetadata.evidenceSummary).length > 0 ||
    arr(sourceMetadata.sourceLabels).length > 0;

  const sectionStatus = (complete) => {
    if (stateStatus === "conflict_needs_review") return "needs_review";
    return complete ? "complete" : "missing";
  };

  const sections = [
    buildReviewRoomSection({
      key: "profile",
      label: "Business profile",
      status: sectionStatus(Boolean(s(profile.companyName) && s(profile.description))),
      itemCount: [profile.companyName, profile.description, profile.websiteUrl]
        .map((item) => s(item))
        .filter(Boolean).length,
      sourceBacked: Boolean(hasSourceEvidence),
      action: "review_profile",
    }),
    buildReviewRoomSection({
      key: "services",
      label: "Services",
      status: sectionStatus(arr(setup.services).length > 0),
      itemCount: arr(setup.services).length,
      sourceBacked: Boolean(hasSourceEvidence),
      action: "review_services",
    }),
    buildReviewRoomSection({
      key: "contacts",
      label: "Contacts",
      status: sectionStatus(arr(setup.contacts).length > 0),
      itemCount: arr(setup.contacts).length,
      sourceBacked: Boolean(hasSourceEvidence),
      action: "review_contacts",
    }),
    buildReviewRoomSection({
      key: "hours",
      label: "Hours and availability",
      status: sectionStatus(arr(setup.hours).length > 0),
      itemCount: arr(setup.hours).length,
      sourceBacked: Boolean(hasSourceEvidence),
      action: "review_hours",
    }),
    buildReviewRoomSection({
      key: "pricing",
      label: "Pricing posture",
      status: sectionStatus(Boolean(s(pricing.publicSummary || pricing.pricingNotes))),
      itemCount: s(pricing.publicSummary || pricing.pricingNotes) ? 1 : 0,
      sourceBacked: Boolean(hasSourceEvidence),
      action: "review_pricing",
    }),
    buildReviewRoomSection({
      key: "handoff",
      label: "Human handoff",
      status: sectionStatus(Boolean(s(handoff.summary) || arr(handoff.triggers).length > 0)),
      itemCount: [handoff.summary, ...arr(handoff.triggers)]
        .map((item) => s(item))
        .filter(Boolean).length,
      sourceBacked: Boolean(hasSourceEvidence),
      action: "review_handoff",
    }),
    buildReviewRoomSection({
      key: "languages",
      label: "Languages",
      status: sectionStatus(arr(setup.languages).length > 0),
      itemCount: arr(setup.languages).length,
      sourceBacked: false,
      action: "review_languages",
    }),
    buildReviewRoomSection({
      key: "sources",
      label: "Sources",
      status: hasSourceEvidence ? "complete" : "missing",
      required: false,
      itemCount: [
        sourceMetadata.primarySourceUrl,
        ...arr(sourceMetadata.evidenceSummary),
        ...arr(sourceMetadata.sourceLabels),
      ]
        .map((item) => s(item))
        .filter(Boolean).length,
      sourceBacked: Boolean(hasSourceEvidence),
      action: "review_sources",
    }),
  ];

  const requiredSections = sections
    .filter((section) => section.required !== false)
    .map((section) => section.key);
  const missingSections = sections
    .filter((section) => section.required !== false && section.status === "missing")
    .map((section) => section.key);

  return {
    version: 1,
    primaryExperience: "review_room",
    mainSurface: "business_truth_review",
    chatRole: "input_method",
    draftAuthority: "not_runtime_authority",
    runtimeAuthority: "approved_truth",
    sections,
    sectionDetails: buildSetupReviewRoomSectionDetails({
      setup,
      sections,
      hasSourceEvidence: Boolean(hasSourceEvidence),
    }),
    requiredSections,
    missingSections,
    actions: buildSetupReviewRoomActions({
      lifecycleState,
      missingSections,
    }),
    readyForApproval: lifecycleState.readyForApproval === true,
    recommendedNextAction: s(lifecycleState.recommendedNextAction),
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
  const lifecycleState = buildSetupLifecycleState({
    session,
    setup,
    summary,
    assistant,
    silentSynthesis: silent,
    approvalBlockers,
  });
  const reviewRoom = buildSetupReviewRoom({ setup, lifecycleState });
  const userFacingDraft = buildUserFacingDraftPreview(setup, readyForApproval);
  const internalDraft = buildInternalDraftPreview(setup);
  const sourceStrategy = buildSetupSourceStrategy(setup);
  const aiProfilePreview = buildAiProfilePreview({
    setup,
    assistant,
    approvalBlockers,
  });

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
      productModel: buildSetupProductModel(),
      lifecycleState,
      reviewRoom,
      status: lifecycleState.status,
      draftOnly: true,
      sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      namespace: SETUP_ASSISTANT_NAMESPACE,
      summary,
      websitePrefill: obj(setup.websitePrefill),
      sourceStrategy,
      aiProfilePreview,
      assistantStyleProfile: buildDefaultAssistantStyleProfile(),
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
        status: lifecycleState.status,
        lifecycleState,
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
        sourceMetadata: obj(setup.sourceMetadata),
        assistantState: obj(setup.assistantState),
        progress: obj(setup.progress),
        languages: arr(setup.languages),
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
    aiBehavior: {},
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
        aiBehavior: {},
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