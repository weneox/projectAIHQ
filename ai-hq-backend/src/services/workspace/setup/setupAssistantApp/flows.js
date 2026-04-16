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
import { shapeBrainTurnForClient } from "./challenge.js";
import {
  buildSetupAssistantPatchFromOrchestrator,
  extractIncomingMessage,
  extractIncomingStep,
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
import { buildSummary } from "./summary.js";

export async function readSetupAssistantView({ db, actor }, deps = {}) {
  const loadSession =
    deps.loadCurrentSetupAssistantSession || loadCurrentSetupAssistantSession;
  const getCurrentReviewHelper =
    deps.getCurrentSetupReview || getCurrentSetupReview;
  const runSetupBrain =
    deps.runSetupAssistantOpenAIOrchestrator || runSetupAssistantOpenAIOrchestrator;

  const sessionResult = await loadSession({ db, actor }, deps);

  if (
    !sessionResult ||
    Number(sessionResult.status || 500) !== 200 ||
    sessionResult.body?.ok === false
  ) {
    return sessionResult;
  }

  const review = await getCurrentReviewHelper(actor.tenantId);
  const baseBody = obj(sessionResult.body);
  const session = obj(baseBody.session);
  const setup = obj(baseBody.setup);
  const draft = obj(setup.draft);
  const sources = arr(review?.sources);

  const rawTurn = await runSetupBrain({
    session,
    draft,
    sources,
    review,
    latestStep: s(session.currentStep),
    latestMessage: "",
  });

  const clientTurn = shapeBrainTurnForClient(rawTurn, draft);

  return {
    status: 200,
    body: buildSetupAssistantResponseBody(baseBody, clientTurn),
  };
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
      title: "Setup assistant v2",
      notes: "",
      metadata: {
        setupAssistantShell: true,
        setupAssistantNamespace: "draftPayload.setupAssistant",
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
    deps.runSetupAssistantOpenAIOrchestrator || runSetupAssistantOpenAIOrchestrator;

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

  const existingDraftPayload = obj(review?.draft?.draftPayload);
  const seed = buildSetupAssistantSeedFromReview(review);
  const currentSetupAssistant = normalizeStoredSetupAssistantPayload(
    readStoredSetupAssistantDraftPayload(existingDraftPayload),
    seed
  );

  const latestStep = extractIncomingStep(body);
  const latestMessage = extractIncomingMessage(body);
  const messageMode = isMessageModeBody(body);

  let mergedSetupAssistant = currentSetupAssistant;
  let nextQuestion = null;
  let brainTurn = null;

  if (messageMode) {
    brainTurn = await runSetupBrain({
      session: obj(review.session),
      draft: currentSetupAssistant,
      sources: arr(review.sources),
      review,
      latestStep,
      latestMessage: latestMessage || (isMessageSkip(body) ? "Let's continue." : ""),
    });

    const clientTurn = shapeBrainTurnForClient(brainTurn, currentSetupAssistant);

    const orchestratorPatch = buildSetupAssistantPatchFromOrchestrator(
      brainTurn,
      currentSetupAssistant
    );

    if (brainTurn.usedFallback === true) {
      const fallbackAnswerPatch = normalizeSetupAssistantDraftPatchBody(
        body,
        currentSetupAssistant
      );

      mergedSetupAssistant = mergeSetupAssistantDraft(
        currentSetupAssistant,
        orchestratorPatch,
        seed
      );
      mergedSetupAssistant = mergeSetupAssistantDraft(
        mergedSetupAssistant,
        fallbackAnswerPatch,
        seed
      );

      const fallbackSummary = buildSummary(mergedSetupAssistant);
      nextQuestion = getNextQuestion(
        fallbackSummary,
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
                s(obj(fallbackAnswerPatch.assistantState).lastUpdatedSection) ||
                s(obj(orchestratorPatch.assistantState).lastUpdatedSection),
            },
            progress: {
              lastAnsweredStep:
                s(obj(fallbackAnswerPatch.progress).lastAnsweredStep) ||
                latestStep,
              currentQuestionKey: s(nextQuestion.key),
              updatedAt: nowIso(),
            },
          },
          seed
        );
      }
    } else {
      mergedSetupAssistant = mergeSetupAssistantDraft(
        currentSetupAssistant,
        orchestratorPatch,
        seed
      );

      nextQuestion = obj(brainTurn.nextQuestion);
    }
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

    const nextSummary = buildSummary(mergedSetupAssistant);
    nextQuestion = getNextQuestion(
      nextSummary,
      mergedSetupAssistant,
      obj(mergedSetupAssistant.progress)
    );
  }

  const nextDraftPayload = mergeDraftState(
    stripLegacySetupAssistantPayloadKeys(existingDraftPayload),
    {
      setupAssistant: {
        ...mergedSetupAssistant,
        updatedAt: nowIso(),
        namespace: SETUP_ASSISTANT_NAMESPACE,
        sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      },
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

  await maybeUpdateReviewSessionStep({
    reviewSessionId: review.session.id,
    nextQuestion,
    deps,
  });

  const refreshed = await getCurrentReview(actor.tenantId);

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
      updatedFields: messageMode
        ? [
            "businessProfile",
            "services",
            "contacts",
            "hours",
            "pricingPosture",
            "handoffRules",
          ]
        : Object.keys(
            normalizeSetupAssistantDraftPatchBody(body, currentSetupAssistant)
          ),
      source: "home_widget",
      sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      namespace: SETUP_ASSISTANT_NAMESPACE,
      draftOnly: true,
      messageMode,
      skipped: isMessageSkip(body),
      nextQuestion: s(nextQuestion?.key),
      canonicalBridge: true,
      brainProvider: s(brainTurn?.provider),
      brainModel: s(brainTurn?.model),
      brainUsedFallback: brainTurn?.usedFallback === true,
      brainError: s(brainTurn?.error),
    }
  );

  const baseResponsePayload = buildSetupAssistantSessionPayload(refreshed);

  return {
    status: 200,
    body: {
      ...buildSetupAssistantResponseBody(
        baseResponsePayload,
        messageMode ? shapeBrainTurnForClient(brainTurn, mergedSetupAssistant) : null
      ),
      message: "Setup assistant draft updated",
    },
  };
}
