import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import { buildSetupAssistantServiceCatalog } from "../setupAssistantCatalog.js";
import {
  buildAssistantConfidence,
  buildAssistantDraftPreview,
  buildAssistantInterviewPlan,
  buildAssistantMessage,
  buildAssistantRecommendation,
  buildAssistantSections,
  buildAssistantSourceSignals,
} from "../setupAssistantAuthorityView.js";
import { formatSetupAssistantHoursForCanonical } from "./canonical.js";
import {
  buildAssistantCompatBusinessFacts,
  buildAssistantCompatConversationStatus,
  buildAssistantCompatFollowupQueue,
  buildAssistantCompatQuestion,
} from "./compat.js";
import { buildSetupAssistantSeedFromReview } from "./seed.js";
import {
  REVIEW_MESSAGE,
  SETUP_ASSISTANT_CURRENT_STEP,
  SETUP_ASSISTANT_NAMESPACE,
  SETUP_ASSISTANT_SOURCE_TYPE,
  normalizeSourceType,
  normalizeWebsiteUrl,
  sourceTypeLabel,
  uniqueStrings,
} from "./shared.js";
import { mergeSetupAssistantCore } from "./sanitize.js";
import {
  buildAssistantQuestion,
  SECTION_META,
  SECTION_ORDER,
  getNextQuestion,
} from "./questions.js";
import { buildReviewState, buildSummary } from "./summary.js";

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
        nextQuestion?.key ||
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
  const summary = buildSummary(mergedCore);
  const review = buildReviewState(mergedCore, summary);

  return {
    ...mergedCore,
    websitePrefill: deriveWebsitePrefillDraft(mergedCore),
    review,
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

export function buildSetupAssistantAuthorityState({
  session = {},
  draftRow = {},
  setup = {},
  summary = {},
  servicesCatalog = {},
  reviewState = {},
} = {}) {
  const nextQuestion = getNextQuestion(summary, setup, obj(setup.progress));
  const question = nextQuestion
    ? buildAssistantQuestion(nextQuestion.key, nextQuestion)
    : null;

  const readyForApproval = obj(reviewState).finalizeAvailable === true;

  const sourceSignals = buildAssistantSourceSignals(setup, {
    normalizeWebsiteUrl,
    normalizeSourceType,
    sourceTypeLabel,
    uniqueStrings,
  });

  const confidence = buildAssistantConfidence(summary, sourceSignals, setup);
  const recommendation = buildAssistantRecommendation(
    summary,
    sourceSignals,
    setup
  );
  const assistantMessage = buildAssistantMessage(
    summary,
    question,
    REVIEW_MESSAGE,
    sourceSignals,
    setup
  );

  return {
    mode: "structured_v2",
    nextQuestion: question,
    confirmationBlockers: arr(summary.confirmationBlockers),
    sections: buildAssistantSections(
      summary,
      servicesCatalog,
      SECTION_ORDER,
      SECTION_META
    ),
    completion: {
      ready: readyForApproval,
      action: readyForApproval
        ? {
            id: "finalize_setup",
            label: "Finish setup",
            intent: "finalize_review",
          }
        : null,
      message: readyForApproval
        ? "The draft is complete enough to move into review and approval."
        : REVIEW_MESSAGE,
    },
    quickCapture: Object.fromEntries(
      SECTION_ORDER.map((key) => [
        key,
        {
          step: key,
          label: SECTION_META[key].label,
          placeholder: SECTION_META[key].placeholder,
        },
      ])
    ),
    servicesCatalog,
    sourceInsights: arr(sourceSignals.strongestEvidence),
    phase: summary.hasAnyDraft
      ? readyForApproval
        ? "ready"
        : "interview"
      : "source_capture",
    message: assistantMessage,
    assistantMessage,
    draft: buildAssistantDraftPreview(setup, {
      formatHours: formatSetupAssistantHoursForCanonical,
    }),
    confidence,
    recommendation,
    sourceSignals,
    interviewPlan: buildAssistantInterviewPlan(summary, question, {
      buildAssistantQuestion,
    }),
    aiBehavior: compactDraftObject({
      languages: arr(setup.languages),
      tone: s(setup.tone),
      greetingStyle: s(setup.greetingStyle),
      afterHoursBehavior: s(setup.afterHoursBehavior),
      escalationPolicy: s(obj(setup.handoffRules).summary),
      pricingDisclosurePolicy: s(obj(setup.pricingPosture).publicSummary),
    }),
    readyForApproval,
    finalizeAvailable: readyForApproval,
    reviewSessionId: s(session.id),
    draftVersion: safeDraftVersion(draftRow),
  };
}

export function buildSetupAssistantSessionPayload(review = {}) {
  const session = obj(review.session);
  const draftRow = obj(review.draft);
  const draftPayload = obj(draftRow.draftPayload);
  const seed = buildSetupAssistantSeedFromReview(review);

  const setup = normalizeStoredSetupAssistantPayload(
    readStoredSetupAssistantDraftPayload(draftPayload),
    seed
  );

  const summary = buildSummary(setup);
  const reviewState = buildReviewState(setup, summary);

  const servicesCatalog = buildSetupAssistantServiceCatalog({
    businessProfile: setup.businessProfile,
    currentServices: setup.services,
    sourceServices: seed.services,
  });

  const assistant = buildSetupAssistantAuthorityState({
    session,
    draftRow,
    setup,
    summary,
    servicesCatalog,
    reviewState,
  });

  const nextQuestion = obj(assistant.nextQuestion);

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
      review: reviewState,
      assistant,
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
    };
  }

  const safeTurn = obj(turn);

  const mergedAssistant = compactDraftObject({
    ...assistant,
    mode: "brain_v2",
    phase: s(safeTurn.phase || assistant.phase),
    message: s(
      safeTurn.assistantMessage ||
        assistant.message ||
        assistant.assistantMessage
    ),
    assistantMessage: s(
      safeTurn.assistantMessage ||
        assistant.assistantMessage ||
        assistant.message
    ),
    nextQuestion: obj(safeTurn.nextQuestion),
    confidence: obj(safeTurn.confidence),
    recommendation: obj(safeTurn.recommendation),
    sourceSignals: obj(safeTurn.sourceSignals),
    interviewPlan: obj(safeTurn.interviewPlan),
    aiBehavior: obj(safeTurn.aiBehavior),
    readyForApproval: safeTurn.readyForApproval === true,
    finalizeAvailable: safeTurn.readyForApproval === true,
    draft: obj(safeTurn.draft),
    currentQuestionKey: s(obj(safeTurn.nextQuestion).key),
    rejectedInputs: arr(safeTurn.rejectedInputs),
    provider: s(safeTurn.provider),
    model: s(safeTurn.model),
    usedFallback: safeTurn.usedFallback === true,
    error: s(safeTurn.error),
    sourceInsights: arr(obj(safeTurn.sourceSignals).strongestEvidence),
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
          ? "The draft is complete enough to move into review and approval."
          : s(safeTurn.assistantMessage || REVIEW_MESSAGE),
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
    finalizeAvailable: safeTurn.readyForApproval === true,
    message:
      safeTurn.readyForApproval === true
        ? "The setup draft is complete enough to move into review and approval."
        : s(obj(setup.review).message || REVIEW_MESSAGE),
  };

  const mergedSession = {
    ...session,
    currentStep:
      s(obj(safeTurn.nextQuestion).step) ||
      s(obj(safeTurn.nextQuestion).key) ||
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
    },
    assistant: mergedAssistant,
    turn: {
      role: "assistant",
      text: s(safeTurn.assistantMessage),
      questionKey: s(obj(safeTurn.nextQuestion).key),
      questionCategory: s(obj(safeTurn.nextQuestion).group),
      payload: compactDraftObject({
        mode: mergedAssistant.mode,
        phase: mergedAssistant.phase,
        nextQuestion: obj(safeTurn.nextQuestion),
        confidence: obj(safeTurn.confidence),
        recommendation: obj(safeTurn.recommendation),
        sourceSignals: obj(safeTurn.sourceSignals),
        interviewPlan: obj(safeTurn.interviewPlan),
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
