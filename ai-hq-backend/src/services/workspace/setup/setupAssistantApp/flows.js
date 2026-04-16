import {
  getCurrentSetupReview,
  getOrCreateActiveSetupReviewSession,
  patchSetupReviewDraft,
  updateSetupReviewSession,
} from "../../../../db/helpers/tenantSetupReview.js";
import {
  arr,
  mergeDraftState,
  obj,
  s,
  safeUuidOrNull,
} from "../draftShared.js";
import { auditSetupAction } from "../auditApp.js";
import { runSetupAssistantOpenAIOrchestrator } from "../setupAssistantOpenAIOrchestrator.js";
import { buildCanonicalReviewDraftPatchFromSetupAssistant } from "./canonical.js";
import {
  buildSetupAssistantPatchFromOrchestrator,
  isMessageModeBody,
  isMessageSkip,
  mergeSetupAssistantDraft,
  normalizeSetupAssistantDraftPatchBody,
} from "./patching.js";
import { buildSetupAssistantSeedFromReview } from "./seed.js";
import {
  SETUP_ASSISTANT_CURRENT_STEP,
  SETUP_ASSISTANT_NAMESPACE,
  SETUP_ASSISTANT_SOURCE_TYPE,
  nowIso,
} from "./shared.js";
import {
  buildSetupAssistantResponseBody,
  buildSetupAssistantSessionPayload,
  normalizeStoredSetupAssistantPayload,
  readStoredSetupAssistantDraftPayload,
  stripLegacySetupAssistantPayloadKeys,
} from "./sessionPayload.js";
import { getNextQuestion } from "./questions.js";
import { buildSummary, buildReviewState } from "./summary.js";

function summaryContextFromReview(review = {}) {
  return {
    review,
    session: obj(review.session),
    sources: arr(review.sources),
  };
}

function stripAssistantNavigationPatch(patch = {}) {
  const safePatch = obj(patch);
  const { assistantState, progress, ...rest } = safePatch;
  return rest;
}

function resolveStartedBy(actor = {}) {
  return (
    safeUuidOrNull(actor?.user?.id) ||
    safeUuidOrNull(actor?.user?.userId) ||
    safeUuidOrNull(actor?.user?.user_id) ||
    null
  );
}

function isDatabaseNotInitializedError(error) {
  const message = s(error?.message).toLowerCase();
  return message.includes("database is not initialized");
}

function normalizeConversationRole(value = "") {
  const role = s(value).toLowerCase();
  return role === "user" ? "user" : "assistant";
}

function normalizeTimelineTurn(value = {}) {
  const source = obj(value);

  return {
    id: s(value.id) || `turn-${Date.now()}`,
    role: normalizeConversationRole(source.role),
    text: s(source.text || source.body || source.message),
    meta: s(source.meta),
    questionKey: s(source.questionKey || source.question_key).toLowerCase(),
    phase: s(source.phase).toLowerCase(),
    provider: s(source.provider),
    model: s(source.model),
    usedFallback: source.usedFallback === true,
    error: s(source.error),
    createdAt: source.createdAt || source.created_at || nowIso(),
  };
}

function readSetupAssistantTimeline(draftPayload = {}) {
  return arr(obj(draftPayload).setupAssistantTimeline)
    .map(normalizeTimelineTurn)
    .filter((item) => item.text)
    .slice(-40);
}

function appendSetupAssistantTimeline(existingDraftPayload = {}, entries = []) {
  const current = readSetupAssistantTimeline(existingDraftPayload);
  const next = [
    ...current,
    ...arr(entries).map(normalizeTimelineTurn).filter((item) => item.text),
  ];

  return next.slice(-40);
}

function buildReviewForBrain(review = {}) {
  const timeline = readSetupAssistantTimeline(obj(review?.draft?.draftPayload));

  return {
    ...review,
    events: timeline.map((turn) => ({
      role: turn.role,
      text: turn.text,
      createdAt: turn.createdAt,
      message: turn.text,
      type: `setup_assistant_${turn.role}`,
      payload: {
        meta: turn.meta,
        questionKey: turn.questionKey,
        phase: turn.phase,
        provider: turn.provider,
        model: turn.model,
        usedFallback: turn.usedFallback,
        error: turn.error,
      },
    })),
    timeline,
  };
}

function buildMinimalClientTurn(turn = {}, mergedSetupAssistant = {}, review = {}) {
  const safeTurn = obj(turn);
  const summary = buildSummary(
    mergedSetupAssistant,
    summaryContextFromReview(review)
  );
  const reviewState = buildReviewState(
    mergedSetupAssistant,
    summary,
    summaryContextFromReview(review)
  );
  const nextQuestion = getNextQuestion(
    summary,
    mergedSetupAssistant,
    obj(mergedSetupAssistant.progress)
  );

  const readyForApproval =
    safeTurn.readyForApproval === true || reviewState.finalizeAvailable === true;

  const phase = s(
    safeTurn.phase,
    readyForApproval
      ? "ready"
      : summary.hasAnyDraft
        ? "interview"
        : "source_capture"
  );

  const assistantMessage = s(
    safeTurn.assistantMessage,
    readyForApproval
      ? "The setup draft is complete enough to move into review and approval."
      : s(obj(nextQuestion).prompt) ||
          "Continue with the next most important business detail."
  );

  return {
    ok: true,
    provider: s(safeTurn.provider),
    model: s(safeTurn.model),
    usedFallback: safeTurn.usedFallback === true,
    error: s(safeTurn.error),
    latestUserInput: obj(safeTurn.latestUserInput),
    phase,
    assistantMessage,
    nextQuestion:
      obj(safeTurn.nextQuestion).key || obj(safeTurn.nextQuestion).prompt
        ? obj(safeTurn.nextQuestion)
        : nextQuestion
          ? {
              ...obj(nextQuestion),
              key: s(nextQuestion.key),
              step: s(nextQuestion.step || nextQuestion.key),
              title: s(nextQuestion.title),
              prompt: s(nextQuestion.prompt),
              group: s(nextQuestion.group || "business_truth"),
              groupLabel: s(
                nextQuestion.groupLabel || "Business truth"
              ),
            }
          : null,
    draft: obj(safeTurn.draft),
    acceptedPatch: obj(safeTurn.acceptedPatch),
    rejectedInputs: arr(safeTurn.rejectedInputs),
    confidence: obj(safeTurn.confidence),
    recommendation: obj(safeTurn.recommendation),
    sourceSignals: obj(safeTurn.sourceSignals),
    interviewPlan: obj(safeTurn.interviewPlan),
    aiBehavior: obj(safeTurn.aiBehavior),
    readyForApproval,
  };
}

export async function readSetupAssistantView({ db, actor }, deps = {}) {
  const loadSession =
    deps.loadCurrentSetupAssistantSession || loadCurrentSetupAssistantSession;
  const getCurrentReviewHelper =
    deps.getCurrentSetupReview || getCurrentSetupReview;
  const runSetupBrain =
    deps.runSetupAssistantOpenAIOrchestrator ||
    runSetupAssistantOpenAIOrchestrator;

  const sessionResult = await loadSession({ db, actor }, deps);

  if (
    !sessionResult ||
    Number(sessionResult.status || 500) !== 200 ||
    sessionResult.body?.ok === false
  ) {
    return sessionResult;
  }

  const review = await getCurrentReviewHelper(actor.tenantId);
  const reviewForBrain = buildReviewForBrain(review);
  const baseBody = obj(sessionResult.body);
  const session = obj(baseBody.session);
  const setup = obj(baseBody.setup);
  const draft = obj(setup.draft);
  const sources = arr(reviewForBrain?.sources);

  const rawTurn = await runSetupBrain({
    session,
    draft,
    sources,
    review: reviewForBrain,
    latestStep: s(session.currentStep),
    latestMessage: "",
  });

  const clientTurn = buildMinimalClientTurn(rawTurn, draft, reviewForBrain);

  return {
    status: 200,
    body: buildSetupAssistantResponseBody(baseBody, clientTurn),
  };
}

export async function maybeUpdateReviewSessionStep({
  reviewSessionId,
  nextQuestion,
  deps = {},
}) {
  const injectedUpdateSession = deps.updateSetupReviewSession;
  const updateSession =
    typeof injectedUpdateSession === "function"
      ? injectedUpdateSession
      : updateSetupReviewSession;

  if (typeof updateSession !== "function" || !s(reviewSessionId)) return;

  try {
    await updateSession(reviewSessionId, {
      currentStep: s(
        nextQuestion?.step || nextQuestion?.key || SETUP_ASSISTANT_CURRENT_STEP
      ).toLowerCase(),
    });
  } catch (error) {
    if (
      typeof injectedUpdateSession !== "function" &&
      isDatabaseNotInitializedError(error)
    ) {
      return;
    }
    throw error;
  }
}

export async function startSetupAssistantSession({ db, actor }, deps = {}) {
  const getCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const getOrCreateSession =
    deps.getOrCreateActiveSetupReviewSession ||
    getOrCreateActiveSetupReviewSession;
  const audit = deps.auditSetupAction || auditSetupAction;

  let review = await getCurrentReview(actor.tenantId);
  let created = false;

  if (!review?.session?.id) {
    await getOrCreateSession({
      tenantId: actor.tenantId,
      mode: "setup",
      currentStep: SETUP_ASSISTANT_CURRENT_STEP,
      startedBy: resolveStartedBy(actor),
      title: "Setup assistant v3",
      notes: "",
      metadata: {
        setupAssistantShell: true,
        setupAssistantNamespace: "draftPayload.setupAssistant",
        setupAssistantTimelineNamespace: "draftPayload.setupAssistantTimeline",
        setupAssistantDraftOnly: true,
        runtimeActivationDeferred: true,
        truthApprovalDeferred: true,
        sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
        namespace: SETUP_ASSISTANT_NAMESPACE,
      },
      ensureDraft: true,
    });
    review = await getCurrentReview(actor.tenantId);
    created = true;
  }

  const payload = buildSetupAssistantSessionPayload(review);

  await audit(
    db,
    actor,
    created
      ? "setup_assistant.session.started"
      : "setup_assistant.session.reused",
    "tenant_setup_review_session",
    s(review?.session?.id),
    {
      reviewSessionId: s(review?.session?.id),
      currentStep: s(
        payload?.session?.currentStep || SETUP_ASSISTANT_CURRENT_STEP
      ),
      source: "home_widget",
      sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      namespace: SETUP_ASSISTANT_NAMESPACE,
      timelineNamespace: "setupAssistantTimeline",
      draftOnly: true,
    }
  );

  return {
    status: 200,
    body: {
      ok: true,
      created,
      message: created
        ? "Setup assistant session started"
        : "Setup assistant session loaded",
      ...payload,
    },
  };
}

export async function loadCurrentSetupAssistantSession(
  { db, actor },
  deps = {}
) {
  const getCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const review = await getCurrentReview(actor.tenantId);

  if (!review?.session?.id) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "SetupAssistantSessionNotFound",
        reason: "no active setup assistant session was found",
        session: null,
        setup: null,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      ...buildSetupAssistantSessionPayload(review),
    },
  };
}

export async function updateSetupAssistantDraft(
  { db, actor, body = {} },
  deps = {}
) {
  const getCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const patchReviewDraft =
    deps.patchSetupReviewDraft ||
    deps.patchReview ||
    patchSetupReviewDraft;
  const audit = deps.auditSetupAction || auditSetupAction;
  const runSetupBrain =
    deps.runSetupAssistantOpenAIOrchestrator ||
    runSetupAssistantOpenAIOrchestrator;

  const review = await getCurrentReview(actor.tenantId);

  if (!review?.session?.id) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "SetupAssistantSessionNotFound",
        reason: "start a setup assistant session before updating the draft",
      },
    };
  }

  const reviewForBrain = buildReviewForBrain(review);
  const existingDraftPayload = obj(review?.draft?.draftPayload);
  const seed = buildSetupAssistantSeedFromReview(reviewForBrain);
  const currentSetupAssistant = normalizeStoredSetupAssistantPayload(
    readStoredSetupAssistantDraftPayload(existingDraftPayload),
    seed
  );

  const latestStep =
    s(body.hintStep || body.step || body.questionKey || body.field).toLowerCase();
  const latestMessage = s(
    body.message || body.text || body.value || body.answer
  );
  const messageMode =
    body.mode === "message" || isMessageModeBody(body) || Boolean(latestMessage);

  let mergedSetupAssistant = currentSetupAssistant;
  let nextQuestion = null;
  let rawTurn = null;
  let clientTurn = null;
  let orchestratorPatch = {};
  let supplementalPatch = {};
  let supplementalDataPatch = {};

  if (messageMode) {
    rawTurn = await runSetupBrain({
      session: obj(review.session),
      draft: currentSetupAssistant,
      sources: arr(reviewForBrain.sources),
      review: reviewForBrain,
      latestStep,
      latestMessage: latestMessage || (isMessageSkip(body) ? "continue" : ""),
    });

    orchestratorPatch = buildSetupAssistantPatchFromOrchestrator(
      rawTurn,
      currentSetupAssistant
    );

    supplementalPatch = normalizeSetupAssistantDraftPatchBody(
      {
        step: latestStep,
        message: latestMessage,
        text: latestMessage,
        value: latestMessage,
      },
      currentSetupAssistant
    );

    supplementalDataPatch = stripAssistantNavigationPatch(supplementalPatch);

    mergedSetupAssistant = mergeSetupAssistantDraft(
      currentSetupAssistant,
      orchestratorPatch,
      seed
    );

    mergedSetupAssistant = mergeSetupAssistantDraft(
      mergedSetupAssistant,
      supplementalDataPatch,
      seed
    );

    const postMergeSummary = buildSummary(
      mergedSetupAssistant,
      summaryContextFromReview(reviewForBrain)
    );

    nextQuestion = getNextQuestion(
      postMergeSummary,
      mergedSetupAssistant,
      obj(mergedSetupAssistant.progress)
    );

    if (nextQuestion) {
      mergedSetupAssistant = mergeSetupAssistantDraft(
        mergedSetupAssistant,
        {
          assistantState: {
            activeSection: s(nextQuestion.key),
            lastUpdatedSection:
              s(obj(supplementalPatch.assistantState).lastUpdatedSection) ||
              s(obj(orchestratorPatch.assistantState).lastUpdatedSection) ||
              s(obj(mergedSetupAssistant.assistantState).lastUpdatedSection),
          },
          progress: {
            lastAnsweredStep:
              s(obj(supplementalPatch.progress).lastAnsweredStep) ||
              s(obj(orchestratorPatch.progress).lastAnsweredStep) ||
              latestStep,
            currentQuestionKey: s(nextQuestion.key),
            updatedAt: nowIso(),
          },
        },
        seed
      );
    }

    clientTurn = buildMinimalClientTurn(
      rawTurn,
      mergedSetupAssistant,
      reviewForBrain
    );
  } else {
    const patch = normalizeSetupAssistantDraftPatchBody(
      body,
      currentSetupAssistant
    );

    if (!Object.keys(patch).length) {
      return {
        status: 400,
        body: {
          ok: false,
          error: "SetupAssistantDraftInvalid",
          reason: "no valid setup assistant draft fields were provided",
        },
      };
    }

    mergedSetupAssistant = mergeSetupAssistantDraft(
      currentSetupAssistant,
      patch,
      seed
    );

    const nextSummary = buildSummary(
      mergedSetupAssistant,
      summaryContextFromReview(reviewForBrain)
    );

    nextQuestion = getNextQuestion(
      nextSummary,
      mergedSetupAssistant,
      obj(mergedSetupAssistant.progress)
    );

    clientTurn = buildMinimalClientTurn(
      {
        phase: nextSummary.readyForReview === true ? "ready" : "interview",
        nextQuestion,
        readyForApproval: nextSummary.readyForReview === true,
      },
      mergedSetupAssistant,
      reviewForBrain
    );
  }

  const nextTimeline = messageMode
    ? appendSetupAssistantTimeline(existingDraftPayload, [
        {
          role: "user",
          text: latestMessage || (isMessageSkip(body) ? "continue" : ""),
          questionKey: s(body.questionKey),
          phase: s(clientTurn?.phase || "interview"),
          createdAt: nowIso(),
        },
        {
          role: "assistant",
          text: s(clientTurn?.assistantMessage),
          meta: s(obj(clientTurn?.sourceSignals).primarySourceUrl),
          questionKey: s(obj(clientTurn?.nextQuestion).key),
          phase: s(clientTurn?.phase),
          provider: s(clientTurn?.provider),
          model: s(clientTurn?.model),
          usedFallback: clientTurn?.usedFallback === true,
          error: s(clientTurn?.error),
          createdAt: nowIso(),
        },
      ])
    : readSetupAssistantTimeline(existingDraftPayload);

  const nextDraftPayload = mergeDraftState(
    stripLegacySetupAssistantPayloadKeys(existingDraftPayload),
    {
      setupAssistant: {
        ...mergedSetupAssistant,
        updatedAt: nowIso(),
        namespace: SETUP_ASSISTANT_NAMESPACE,
        sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      },
      setupAssistantTimeline: nextTimeline,
    }
  );

  const canonicalReviewDraftPatch =
    buildCanonicalReviewDraftPatchFromSetupAssistant(mergedSetupAssistant);

  await patchReviewDraft({
    sessionId: review.session.id,
    tenantId: actor.tenantId,
    patch: {
      draftPayload: nextDraftPayload,
      ...canonicalReviewDraftPatch,
    },
    bumpVersion: true,
  });

  const effectiveNextQuestion =
    obj(clientTurn?.nextQuestion).key || obj(clientTurn?.nextQuestion).prompt
      ? obj(clientTurn?.nextQuestion)
      : obj(nextQuestion);

  await maybeUpdateReviewSessionStep({
    reviewSessionId: review.session.id,
    nextQuestion: effectiveNextQuestion,
    deps,
  });

  const refreshed = await getCurrentReview(actor.tenantId);
  const refreshedForBrain = buildReviewForBrain(refreshed);
  const baseResponsePayload = buildSetupAssistantSessionPayload(refreshed);

  const responseTurn = buildMinimalClientTurn(
    clientTurn,
    normalizeStoredSetupAssistantPayload(
      readStoredSetupAssistantDraftPayload(obj(refreshed?.draft?.draftPayload)),
      buildSetupAssistantSeedFromReview(refreshedForBrain)
    ),
    refreshedForBrain
  );

  const updatedFields = messageMode
    ? [
        ...Object.keys(obj(orchestratorPatch)),
        ...Object.keys(obj(supplementalPatch)),
      ]
    : Object.keys(
        normalizeSetupAssistantDraftPatchBody(body, currentSetupAssistant)
      );

  await audit(
    db,
    actor,
    "setup_assistant.draft.updated",
    "tenant_setup_review_session",
    s(refreshed?.session?.id || review.session.id),
    {
      reviewSessionId: s(refreshed?.session?.id || review.session.id),
      draftVersion: Number(
        refreshed?.draft?.version || review?.draft?.version || 0
      ),
      updatedFields: [...new Set(updatedFields)].filter(Boolean),
      source: "home_widget",
      sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      namespace: SETUP_ASSISTANT_NAMESPACE,
      timelineNamespace: "setupAssistantTimeline",
      timelineLength: nextTimeline.length,
      draftOnly: true,
      messageMode,
      skipped: isMessageSkip(body),
      nextQuestion: s(effectiveNextQuestion?.key),
      canonicalBridge: true,
      brainProvider: s(responseTurn?.provider),
      brainModel: s(responseTurn?.model),
      brainUsedFallback: responseTurn?.usedFallback === true,
      brainError: s(responseTurn?.error),
      latestMessagePreview: s(latestMessage).slice(0, 160),
    }
  );

  return {
    status: 200,
    body: {
      ...buildSetupAssistantResponseBody(baseResponsePayload, responseTurn),
      message: "Setup assistant draft updated",
    },
  };
}