import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import { buildSetupAssistantServiceCatalog } from "../setupAssistantCatalog.js";
import { formatSetupAssistantHoursForCanonical } from "./canonical.js";
import {
  buildAssistantCompatBusinessFacts,
  buildAssistantCompatConversationStatus,
  buildAssistantCompatFollowupQueue,
  buildAssistantCompatQuestion,
} from "./compat.js";
import { buildSetupAssistantSeedFromReview } from "./seed.js";
import {
  SETUP_ASSISTANT_CURRENT_STEP,
  SETUP_ASSISTANT_NAMESPACE,
  SETUP_ASSISTANT_SOURCE_TYPE,
  normalizeSourceType,
} from "./shared.js";
import { mergeSetupAssistantCore } from "./sanitize.js";
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
    title: s(source.title),
    prompt: s(source.prompt),
    group: s(source.group || "business_truth"),
    groupLabel: s(source.groupLabel || "Business truth"),
    priority: Number(source.priority || 0) || 0,
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

  return {
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
  };
}

function sanitizeBrainInterviewPlan(value = {}) {
  const source = obj(value);

  const activeQuestions = arr(source.activeQuestions)
    .map((item) =>
      compactDraftObject({
        key: s(item?.key).toLowerCase(),
        step: s(item?.step || item?.key).toLowerCase(),
        title: s(item?.title),
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

function buildAssistantDraftPreview(
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

function buildMinimalSourceSignals(setup = {}) {
  const businessProfile = obj(setup.businessProfile);
  const sourceMetadata = obj(setup.sourceMetadata);
  const pricing = obj(setup.pricingPosture);

  const services = arr(setup.services)
    .map((item) => s(item.title || item.name || item.label))
    .filter(Boolean);

  const contacts = arr(setup.contacts)
    .map((item) => s(item.value || item.label || item.type))
    .filter(Boolean);

  const hours = formatSetupAssistantHoursForCanonical(setup.hours);

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
    discoveredPublicClaims: uniqueStrings(arr(sourceMetadata.evidenceSummary), 12),
    companyNameCandidates: uniqueStrings([businessProfile.companyName], 8),
    descriptionCandidates: uniqueStrings([businessProfile.description], 8),
    serviceCandidates: uniqueStrings(services, 12),
    contactCandidates: uniqueStrings(contacts, 12),
    hoursCandidates: uniqueStrings(hours, 12),
    pricingCandidates: uniqueStrings([pricing.publicSummary], 12),
    audienceCandidates: [],
    languagesCandidates: uniqueStrings(arr(setup.languages), 8),
  };
}

function buildMinimalConfidenceFromSetup(setup = {}) {
  const draftPreview = buildAssistantDraftPreview(setup, {
    formatHours: formatSetupAssistantHoursForCanonical,
  });

  const strong = [];
  const unclear = [];

  if (s(draftPreview.businessName)) strong.push("business_name_present");
  else unclear.push("business_name_missing");

  if (s(draftPreview.whatThisBusinessIs)) strong.push("business_description_present");
  else unclear.push("business_description_missing");

  if (arr(draftPreview.coreServices).length) strong.push("services_present");
  else unclear.push("services_missing");

  if (arr(draftPreview.contactRoutes).length) strong.push("contact_route_present");
  else unclear.push("contact_route_missing");

  if (arr(draftPreview.hours).length) strong.push("hours_present");
  else unclear.push("hours_missing");

  if (s(draftPreview.pricingPosture)) strong.push("pricing_posture_present");
  else unclear.push("pricing_posture_missing");

  if (s(draftPreview.humanHandoff)) strong.push("handoff_present");
  else unclear.push("handoff_missing");

  return {
    strong,
    unclear,
    contradictions: [],
  };
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
    [...arr(timeline)].reverse().find((item) => s(item.role) === "assistant") || {};
  const sourceSignals = sanitizeBrainSourceSignals(
    Object.keys(obj(brain.sourceSignals)).length
      ? brain.sourceSignals
      : buildMinimalSourceSignals(setup)
  );

  const draftPreview =
    Object.keys(obj(brain.draft)).length > 0
      ? obj(brain.draft)
      : buildAssistantDraftPreview(setup, {
          formatHours: formatSetupAssistantHoursForCanonical,
        });

  const readyForApproval =
    brain.readyForApproval === true || summary.readyForReview === true;

  const phase = s(
    brain.phase ||
      lastAssistantTurn.phase ||
      (readyForApproval
        ? "ready"
        : summary.hasAnyDraft
          ? "interview"
          : "source_capture")
  ).toLowerCase();

  const nextQuestion = sanitizeBrainQuestion(brain.nextQuestion);

  const completionMessage =
    readyForApproval === true
      ? compactText(
          s(
            brain.assistantMessage ||
              brain.message ||
              lastAssistantTurn.text
          ),
          420
        )
      : "";

  return {
    mode: "brain_v3",
    nextQuestion: nextQuestion.key && nextQuestion.prompt ? nextQuestion : null,
    confirmationBlockers: [],
    sections: [],
    completion: {
      ready: readyForApproval,
      action: readyForApproval
        ? {
            id: "finalize_setup",
            label: "Finish setup",
            intent: "finalize_review",
          }
        : null,
      message: completionMessage,
    },
    quickCapture: {},
    servicesCatalog,
    sourceInsights: uniqueStrings(
      arr(sourceSignals.strongestEvidence),
      12
    ),
    phase,
    message: compactText(
      s(brain.assistantMessage || brain.message || lastAssistantTurn.text),
      420
    ),
    assistantMessage: compactText(
      s(brain.assistantMessage || brain.message || lastAssistantTurn.text),
      420
    ),
    timeline: arr(timeline).map(normalizeTimelineTurn),
    draft: obj(draftPreview),
    confidence:
      Object.keys(obj(brain.confidence)).length > 0
        ? sanitizeBrainConfidence(brain.confidence)
        : buildMinimalConfidenceFromSetup(setup),
    recommendation: sanitizeBrainRecommendation(brain.recommendation),
    sourceSignals,
    interviewPlan: sanitizeBrainInterviewPlan(brain.interviewPlan),
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
      review: {
        status: summary.hasAnyDraft ? "draft_in_progress" : "awaiting_input",
        draftOnly: true,
        sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
        namespace: SETUP_ASSISTANT_NAMESPACE,
        readyForReview: summary.readyForReview === true,
        readyForApproval,
        finalizeAvailable: summary.readyForReview === true,
        finalized: false,
        message: "",
      },
      assistant,
      timeline,
      draft: {
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

  if (!turn) {
    return {
      ok: true,
      ...baseBody,
      timeline: arr(setup.timeline || assistant.timeline),
    };
  }

  const safeTurn = sanitizeBrainSnapshot(turn);

  const mergedAssistant = compactDraftObject({
    ...assistant,
    mode: "brain_v3",
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
    nextQuestion:
      obj(safeTurn.nextQuestion).key && obj(safeTurn.nextQuestion).prompt
        ? obj(safeTurn.nextQuestion)
        : null,
    confidence: sanitizeBrainConfidence(safeTurn.confidence),
    recommendation: sanitizeBrainRecommendation(safeTurn.recommendation),
    sourceSignals: sanitizeBrainSourceSignals(safeTurn.sourceSignals),
    interviewPlan: sanitizeBrainInterviewPlan(safeTurn.interviewPlan),
    aiBehavior: compactDraftObject(safeTurn.aiBehavior),
    readyForApproval: safeTurn.readyForApproval === true,
    finalizeAvailable: safeTurn.readyForApproval === true,
    draft: obj(safeTurn.draft),
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
      ready: safeTurn.readyForApproval === true,
      action:
        safeTurn.readyForApproval === true
          ? {
              id: "finalize_setup",
              label: "Finish setup",
              intent: "finalize_review",
            }
          : null,
      message:
        safeTurn.readyForApproval === true
          ? compactText(s(safeTurn.assistantMessage || safeTurn.message), 420)
          : "",
    },
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
    readyForApproval: safeTurn.readyForApproval === true,
    finalizeAvailable:
      safeTurn.readyForApproval === true || obj(setup.review).finalizeAvailable === true,
    message: "",
  };

  const mergedSession = {
    ...session,
    currentStep:
      s(obj(safeTurn.nextQuestion).step) ||
      s(obj(safeTurn.nextQuestion).key) ||
      s(session.currentStep),
  };

  const timeline = arr(setup.timeline || assistant.timeline).map(
    normalizeTimelineTurn
  );

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
      questionKey: s(obj(safeTurn.nextQuestion).key),
      questionCategory: s(obj(safeTurn.nextQuestion).group),
      payload: compactDraftObject({
        mode: mergedAssistant.mode,
        phase: mergedAssistant.phase,
        nextQuestion: obj(safeTurn.nextQuestion),
        confidence: sanitizeBrainConfidence(safeTurn.confidence),
        recommendation: sanitizeBrainRecommendation(safeTurn.recommendation),
        sourceSignals: sanitizeBrainSourceSignals(safeTurn.sourceSignals),
        interviewPlan: sanitizeBrainInterviewPlan(safeTurn.interviewPlan),
        aiBehavior: obj(safeTurn.aiBehavior),
        readyForApproval: safeTurn.readyForApproval === true,
        draft: obj(safeTurn.draft),
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
    guardrails: [],
    review: mergedReview,
  };
}