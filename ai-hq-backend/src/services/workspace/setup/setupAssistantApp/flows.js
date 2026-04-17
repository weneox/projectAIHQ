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
  buildStoredSetupAssistantBrainPayload,
  normalizeStoredSetupAssistantPayload,
  readStoredSetupAssistantDraftPayload,
  stripLegacySetupAssistantPayloadKeys,
} from "./sessionPayload.js";

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
    id: s(source.id) || `turn-${Date.now()}`,
    role: normalizeConversationRole(source.role),
    text: s(source.text || source.body || source.message),
    meta: "",
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
        meta: "",
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

function resolveAssistantTurnPayload(turn = {}) {
  const safeTurn = obj(turn);
  const fallbackText = s(
    safeTurn.assistantMessage ||
      safeTurn.message ||
      obj(safeTurn.nextQuestion).prompt
  );

  return {
    ...safeTurn,
    assistantMessage: fallbackText,
    message: s(safeTurn.message || fallbackText),
  };
}

function shouldUseDeterministicMessagePrelude(step = "", message = "") {
  const safeStep = s(step).toLowerCase();
  const text = s(message);

  if (!text) return false;

  return (
    safeStep === "hours" ||
    /(?:24\/7|7\/24|appointment|closed|bağlı|bagli|\d{1,2}[:.]\d{2}|\d{1,2}\s*(?:-|to|dan|den|dek)\s*\d{1,2})/i.test(
      text
    )
  );
}

function buildSafeSupplementalMessagePatch(
  currentSetupAssistant = {},
  latestMessage = "",
  latestStep = ""
) {
  if (!shouldUseDeterministicMessagePrelude(latestStep, latestMessage)) {
    return {};
  }

  const parsed = normalizeSetupAssistantDraftPatchBody(
    {
      step: latestStep,
      answer: latestMessage,
    },
    currentSetupAssistant
  );

  return {
    hours: arr(parsed.hours),
    assistantState: obj(parsed.assistantState),
    progress: obj(parsed.progress),
  };
}

async function maybeUpdateReviewSessionStep({
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

async function persistSetupAssistantState({
  review = {},
  actor,
  mergedSetupAssistant = {},
  brainSnapshot = {},
  nextTimeline = [],
  deps = {},
}) {
  const patchReviewDraft =
    deps.patchSetupReviewDraft ||
    deps.patchReview ||
    patchSetupReviewDraft;

  const nextDraftPayload = mergeDraftState(
    stripLegacySetupAssistantPayloadKeys(obj(review?.draft?.draftPayload)),
    {
      setupAssistant: {
        ...mergedSetupAssistant,
        updatedAt: nowIso(),
        namespace: SETUP_ASSISTANT_NAMESPACE,
        sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      },
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload(brainSnapshot),
      setupAssistantTimeline: arr(nextTimeline),
    }
  );

  const canonicalReviewDraftPatch =
    buildCanonicalReviewDraftPatchFromSetupAssistant(mergedSetupAssistant);

  try {
    await patchReviewDraft({
      sessionId: review.session.id,
      tenantId: actor.tenantId,
      patch: {
        draftPayload: nextDraftPayload,
        ...canonicalReviewDraftPatch,
      },
      bumpVersion: true,
    });
  } catch (error) {
    if (
      deps.patchSetupReviewDraft == null &&
      deps.patchReview == null &&
      isDatabaseNotInitializedError(error)
    ) {
      return false;
    }
    throw error;
  }

  return true;
}

function extractApprovalBlockersFromPayload(payload = {}) {
  return arr(
    obj(payload?.setup?.assistant).approvalBlockers ||
      obj(payload?.setup?.review).approvalBlockers ||
      []
  )
    .map((item) => ({
      step: s(item?.step),
      reasonCode: s(item?.reasonCode),
      reason: s(item?.reason),
      currentValue: s(item?.currentValue),
    }))
    .filter((item) => item.step || item.reasonCode || item.reason);
}

export async function readSetupAssistantView({ db, actor }, deps = {}) {
  void db;

  const loadSession =
    deps.loadCurrentSetupAssistantSession || loadCurrentSetupAssistantSession;

  return loadSession({ db, actor }, deps);
}

export async function startSetupAssistantSession({ db, actor }, deps = {}) {
  const getCurrentReviewHelper =
    deps.getCurrentSetupReview || getCurrentSetupReview;
  const getOrCreateSession =
    deps.getOrCreateActiveSetupReviewSession ||
    getOrCreateActiveSetupReviewSession;
  const audit = deps.auditSetupAction || auditSetupAction;

  let review = await getCurrentReviewHelper(actor.tenantId);
  let created = false;

  if (!review?.session?.id) {
    await getOrCreateSession({
      tenantId: actor.tenantId,
      mode: "setup",
      currentStep: SETUP_ASSISTANT_CURRENT_STEP,
      startedBy: resolveStartedBy(actor),
      title: "Setup assistant v4",
      notes: "",
      metadata: {
        setupAssistantShell: true,
        setupAssistantNamespace: "draftPayload.setupAssistant",
        setupAssistantBrainNamespace: "draftPayload.setupAssistantBrain",
        setupAssistantTimelineNamespace: "draftPayload.setupAssistantTimeline",
        setupAssistantDraftOnly: true,
        runtimeActivationDeferred: true,
        truthApprovalDeferred: true,
        sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
        namespace: SETUP_ASSISTANT_NAMESPACE,
        orchestrationModel: "ask_ai_setup_brain_v4",
        deterministicFirst: true,
        semanticApprovalGuard: true,
      },
      ensureDraft: true,
    });

    review = await getCurrentReviewHelper(actor.tenantId);
    created = true;
  }

  const payload = buildSetupAssistantSessionPayload(review);
  const approvalBlockers = extractApprovalBlockersFromPayload(payload);

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
      brainNamespace: "setupAssistantBrain",
      timelineNamespace: "setupAssistantTimeline",
      draftOnly: true,
      fastStart: true,
      orchestrationModel: "ask_ai_setup_brain_v4",
      readyForApproval: payload?.setup?.assistant?.readyForApproval === true,
      finalizeAvailable: payload?.setup?.assistant?.finalizeAvailable === true,
      approvalBlockerCount: approvalBlockers.length,
      approvalBlockerSteps: approvalBlockers.map((item) => item.step).filter(Boolean),
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
  void db;
  void deps;

  const getCurrentReviewHelper =
    deps.getCurrentSetupReview || getCurrentSetupReview;
  const review = await getCurrentReviewHelper(actor.tenantId);

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
  const getCurrentReviewHelper =
    deps.getCurrentSetupReview || getCurrentSetupReview;
  const audit = deps.auditSetupAction || auditSetupAction;
  const runSetupBrain =
    deps.runSetupAssistantOpenAIOrchestrator ||
    runSetupAssistantOpenAIOrchestrator;

  const review = await getCurrentReviewHelper(actor.tenantId);

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

  const latestMessage = s(
    body.message || body.text || body.value || body.answer
  );

  const latestStep = s(
    body.step ||
      body.questionKey ||
      obj(currentSetupAssistant.progress).currentQuestionKey ||
      obj(review.session).currentStep ||
      SETUP_ASSISTANT_CURRENT_STEP
  ).toLowerCase();

  const messageMode =
    body.mode === "message" || isMessageModeBody(body) || Boolean(latestMessage);

  let mergedSetupAssistant = currentSetupAssistant;
  let rawTurn = null;
  let responseTurn = null;
  let updatedFields = [];
  let nextTimeline = readSetupAssistantTimeline(existingDraftPayload);

  if (messageMode) {
    const supplementalPatch = buildSafeSupplementalMessagePatch(
      currentSetupAssistant,
      latestMessage || (isMessageSkip(body) ? "continue" : ""),
      latestStep
    );

    const draftForBrain = Object.keys(supplementalPatch).length
      ? mergeSetupAssistantDraft(currentSetupAssistant, supplementalPatch, seed)
      : currentSetupAssistant;

    rawTurn = await runSetupBrain({
      session: obj(review.session),
      draft: draftForBrain,
      sources: arr(reviewForBrain.sources),
      review: reviewForBrain,
      latestStep,
      latestMessage: latestMessage || (isMessageSkip(body) ? "continue" : ""),
    });

    const orchestratorPatch = buildSetupAssistantPatchFromOrchestrator(
      rawTurn,
      draftForBrain
    );

    mergedSetupAssistant = mergeSetupAssistantDraft(
      draftForBrain,
      orchestratorPatch,
      seed
    );

    responseTurn = buildStoredSetupAssistantBrainPayload(
      resolveAssistantTurnPayload(rawTurn)
    );

    nextTimeline = appendSetupAssistantTimeline(existingDraftPayload, [
      {
        role: "user",
        text: latestMessage || (isMessageSkip(body) ? "continue" : ""),
        questionKey: latestStep,
        phase: s(rawTurn.phase || "interview"),
        createdAt: nowIso(),
      },
      {
        role: "assistant",
        text: s(
          obj(responseTurn).assistantMessage ||
            obj(responseTurn).message ||
            obj(responseTurn).nextQuestion?.prompt
        ),
        meta: "",
        questionKey: s(obj(responseTurn).nextQuestion?.key),
        phase: s(responseTurn.phase || rawTurn.phase),
        provider: s(responseTurn.provider || rawTurn.provider),
        model: s(responseTurn.model || rawTurn.model),
        usedFallback: responseTurn.usedFallback === true,
        error: s(responseTurn.error || rawTurn.error),
        createdAt: nowIso(),
      },
    ]);

    updatedFields = [
      ...Object.keys(obj(supplementalPatch)),
      ...Object.keys(obj(orchestratorPatch)),
      "setupAssistantBrain",
      "setupAssistantTimeline",
    ];
  } else {
    const directPatch = normalizeSetupAssistantDraftPatchBody(
      body,
      currentSetupAssistant
    );

    if (!Object.keys(directPatch).length) {
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
      directPatch,
      seed
    );

    rawTurn = await runSetupBrain({
      session: obj(review.session),
      draft: mergedSetupAssistant,
      sources: arr(reviewForBrain.sources),
      review: reviewForBrain,
      latestStep,
      latestMessage: "",
    });

    const brainDerivedPatch = buildSetupAssistantPatchFromOrchestrator(
      rawTurn,
      mergedSetupAssistant
    );

    mergedSetupAssistant = mergeSetupAssistantDraft(
      mergedSetupAssistant,
      brainDerivedPatch,
      seed
    );

    responseTurn = buildStoredSetupAssistantBrainPayload(
      resolveAssistantTurnPayload(rawTurn)
    );

    updatedFields = [
      ...Object.keys(obj(directPatch)),
      ...Object.keys(obj(brainDerivedPatch)),
      "setupAssistantBrain",
    ];
  }

  await persistSetupAssistantState({
    review,
    actor,
    mergedSetupAssistant,
    brainSnapshot: responseTurn,
    nextTimeline,
    deps,
  });

  await maybeUpdateReviewSessionStep({
    reviewSessionId: review.session.id,
    nextQuestion: obj(responseTurn.nextQuestion),
    deps,
  });

  const refreshed = await getCurrentReviewHelper(actor.tenantId);
  const baseResponsePayload = buildSetupAssistantSessionPayload(refreshed);
  const finalResponseBody = buildSetupAssistantResponseBody(
    baseResponsePayload,
    responseTurn
  );
  const approvalBlockers = extractApprovalBlockersFromPayload(finalResponseBody);

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
      brainNamespace: "setupAssistantBrain",
      timelineNamespace: "setupAssistantTimeline",
      timelineLength: nextTimeline.length,
      draftOnly: true,
      messageMode,
      skipped: isMessageSkip(body),
      nextQuestion: s(obj(responseTurn).nextQuestion?.key),
      canonicalBridge: true,
      brainProvider: s(responseTurn?.provider),
      brainModel: s(responseTurn?.model),
      brainUsedFallback: responseTurn?.usedFallback === true,
      brainError: s(responseTurn?.error),
      latestMessagePreview: s(latestMessage).slice(0, 160),
      orchestrationModel: "ask_ai_setup_brain_v4",
      readyForApproval:
        finalResponseBody?.setup?.assistant?.readyForApproval === true,
      finalizeAvailable:
        finalResponseBody?.setup?.assistant?.finalizeAvailable === true,
      approvalBlockerCount: approvalBlockers.length,
      approvalBlockerSteps: approvalBlockers.map((item) => item.step).filter(Boolean),
      approvalBlockerReasonCodes: approvalBlockers
        .map((item) => item.reasonCode)
        .filter(Boolean),
    }
  );

  return {
    status: 200,
    body: {
      ...finalResponseBody,
      message: "Setup assistant draft updated",
    },
  };
}