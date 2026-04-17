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

function uniqueStrings(items = [], max = 24) {
  return [...new Set(arr(items).map((item) => s(item)).filter(Boolean))].slice(
    0,
    max
  );
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

function normalizeNextQuestionStep(
  nextQuestion = {},
  fallback = SETUP_ASSISTANT_CURRENT_STEP
) {
  return (
    s(nextQuestion?.step || nextQuestion?.key || fallback).toLowerCase() ||
    fallback
  );
}

function buildNextSetupAssistantDraftPayload({
  review = {},
  mergedSetupAssistant = {},
  brainSnapshot = {},
  nextTimeline = [],
} = {}) {
  return mergeDraftState(
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
}

function buildOptimisticSetupAssistantReview({
  review = {},
  nextDraftPayload = {},
  nextQuestion = null,
  persisted = true,
} = {}) {
  const currentDraft = obj(review?.draft);
  const currentSession = obj(review?.session);
  const currentVersion = Number(currentDraft.version || 1) || 1;
  const timestamp = nowIso();

  return {
    ...review,
    session: {
      ...currentSession,
      currentStep: normalizeNextQuestionStep(
        nextQuestion,
        s(currentSession.currentStep || SETUP_ASSISTANT_CURRENT_STEP)
      ),
      updatedAt: timestamp,
      updated_at: timestamp,
    },
    draft: {
      ...currentDraft,
      draftPayload: obj(nextDraftPayload),
      version: persisted ? currentVersion + 1 : currentVersion,
      updatedAt: timestamp,
      updated_at: timestamp,
    },
  };
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

function buildHoursLines(hours = []) {
  return arr(hours)
    .map((item) => {
      const row = obj(item);
      const day = s(row.day);

      if (row.allDay === true) return [day, "24/7"].filter(Boolean).join(" ");
      if (row.appointmentOnly === true) {
        return [day, "appointment only"].filter(Boolean).join(" ");
      }
      if (row.closed === true) {
        return [day, "closed"].filter(Boolean).join(" ");
      }
      if (s(row.openTime) && s(row.closeTime)) {
        return [day, `${s(row.openTime)}-${s(row.closeTime)}`]
          .filter(Boolean)
          .join(" ");
      }

      return s(row.notes);
    })
    .filter(Boolean)
    .slice(0, 16);
}

function summarizeBehaviorPolicy(policyKey = "", policy = {}) {
  const safePolicy = obj(policy);

  if (policyKey === "pricing") {
    return [s(safePolicy.mode), s(safePolicy.preferredTargetUrl)]
      .filter(Boolean)
      .join(" • ");
  }

  if (policyKey === "location") {
    return [s(safePolicy.mode), s(safePolicy.preferredTargetUrl)]
      .filter(Boolean)
      .join(" • ");
  }

  if (policyKey === "booking") {
    return [s(safePolicy.mode), s(safePolicy.preferredTargetUrl)]
      .filter(Boolean)
      .join(" • ");
  }

  if (policyKey === "contact") {
    return [
      s(safePolicy.mode),
      s(safePolicy.preferredChannel),
      s(safePolicy.preferredTargetUrl),
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (policyKey === "handoff") {
    return [
      s(safePolicy.mode),
      safePolicy.requiresReason === true ? "requires reason" : "",
    ]
      .filter(Boolean)
      .join(" • ");
  }

  return "";
}

function buildStructuredDraftFromSetupAssistant(setup = {}) {
  const safeSetup = obj(setup);

  return {
    businessProfile: obj(safeSetup.businessProfile),
    services: arr(safeSetup.services),
    contacts: arr(safeSetup.contacts),
    hours: arr(safeSetup.hours),
    pricingPosture: obj(safeSetup.pricingPosture),
    handoffRules: obj(safeSetup.handoffRules),
    assistantBehaviorDraft: obj(safeSetup.assistantBehaviorDraft),
    languages: arr(safeSetup.languages),
    tone: s(safeSetup.tone),
    greetingStyle: s(safeSetup.greetingStyle),
    afterHoursBehavior: s(safeSetup.afterHoursBehavior),
  };
}

function buildPolishedDraftFromSetupAssistant(setup = {}, responseTurn = {}) {
  const safeSetup = obj(setup);
  const turn = obj(responseTurn);
  const draftFromBrain = obj(turn.draft);
  const businessProfile = obj(safeSetup.businessProfile);
  const pricing = obj(safeSetup.pricingPosture);
  const handoff = obj(safeSetup.handoffRules);
  const behavior = obj(safeSetup.assistantBehaviorDraft);

  const services = uniqueStrings(
    [
      ...arr(draftFromBrain.coreServices),
      ...arr(safeSetup.services).map((item) =>
        s(item?.title || item?.name || item?.label)
      ),
    ],
    24
  );

  const contactRoutes = uniqueStrings(
    [
      ...arr(draftFromBrain.contactRoutes),
      ...arr(safeSetup.contacts).map((item) =>
        s(item?.value || item?.label || item?.type)
      ),
    ],
    24
  );

  const workingHoursLines = uniqueStrings(
    [...arr(draftFromBrain.hours), ...buildHoursLines(safeSetup.hours)],
    16
  );

  return {
    businessName: s(
      draftFromBrain.businessName || businessProfile.companyName
    ),
    businessDescription: s(
      draftFromBrain.whatThisBusinessIs || businessProfile.description
    ),
    websiteUrl: s(draftFromBrain.websiteUrl || businessProfile.websiteUrl),
    coreServices: services,
    contactRoutes,
    workingHoursLines,
    pricingSummary: s(
      draftFromBrain.pricingPosture || pricing.publicSummary
    ),
    handoffSummary: s(
      draftFromBrain.humanHandoff ||
        handoff.summary ||
        arr(handoff.triggers).join(", ")
    ),
    pricingBehaviorSummary: s(
      draftFromBrain.pricingBehavior ||
        summarizeBehaviorPolicy("pricing", behavior.pricingPolicy)
    ),
    locationBehaviorSummary: s(
      draftFromBrain.locationBehavior ||
        summarizeBehaviorPolicy("location", behavior.locationPolicy)
    ),
    bookingBehaviorSummary: s(
      draftFromBrain.bookingBehavior ||
        summarizeBehaviorPolicy("booking", behavior.bookingPolicy)
    ),
    contactBehaviorSummary: s(
      draftFromBrain.contactBehavior ||
        summarizeBehaviorPolicy("contact", behavior.contactPolicy)
    ),
    handoffBehaviorSummary: s(
      draftFromBrain.handoffBehavior ||
        summarizeBehaviorPolicy("handoff", behavior.handoffPolicy)
    ),
    languages: uniqueStrings(
      [...arr(draftFromBrain.languages), ...arr(safeSetup.languages)],
      8
    ),
    tone: s(draftFromBrain.tone || safeSetup.tone),
    greetingStyle: s(
      draftFromBrain.greetingStyle || safeSetup.greetingStyle
    ),
    afterHoursBehavior: s(
      draftFromBrain.afterHoursBehavior || safeSetup.afterHoursBehavior
    ),
    professionalizedAt: nowIso(),
  };
}

function buildRawEvidenceEntry({
  latestMessage = "",
  latestStep = "",
  responseTurn = {},
  kind = "user_answer",
} = {}) {
  const text = s(latestMessage);
  const step = s(latestStep).toLowerCase();
  if (!text && !step) return null;

  return {
    id: `evidence-${Date.now()}`,
    kind,
    step,
    text,
    normalizedText: text.replace(/\s+/g, " ").trim(),
    fieldKey: step,
    confidence:
      arr(obj(responseTurn).rejectedInputs).length > 0 ? "low" : "high",
    hidden: true,
    createdAt: nowIso(),
  };
}

function humanizeSetupStep(step = "") {
  return s(step).replace(/_/g, " ").trim();
}

function buildRiskNotesFromTurn({
  latestStep = "",
  responseTurn = {},
} = {}) {
  const safeTurn = obj(responseTurn);
  const rejectedInputs = arr(safeTurn.rejectedInputs);
  const unclear = arr(obj(safeTurn.confidence).unclear).map((item) =>
    s(item).toLowerCase()
  );
  const stepLabel = humanizeSetupStep(latestStep || "this step");

  const notes = [];

  if (rejectedInputs.length > 0) {
    notes.push(
      `High risk: ${stepLabel} answer did not clearly answer the question and should be corrected before approval.`
    );
  }

  if (!rejectedInputs.length && unclear.includes(s(latestStep).toLowerCase())) {
    notes.push(
      `Review ${stepLabel} again before approval because the answer is still unclear.`
    );
  }

  for (const item of rejectedInputs) {
    const reason = s(item?.reason);
    if (!reason) continue;
    notes.push(`${stepLabel}: ${reason}`);
  }

  return uniqueStrings(notes, 12);
}

function buildSilentSynthesisPatch({
  currentSetupAssistant = {},
  mergedSetupAssistant = {},
  latestMessage = "",
  latestStep = "",
  responseTurn = {},
  includeRawEvidence = true,
} = {}) {
  const currentSilent = obj(obj(currentSetupAssistant).silentSynthesis);
  const rawEntry = includeRawEvidence
    ? buildRawEvidenceEntry({
        latestMessage,
        latestStep,
        responseTurn,
      })
    : null;

  const riskNotes = buildRiskNotesFromTurn({
    latestStep,
    responseTurn,
  });

  const unresolvedNotes = uniqueStrings(
    [
      ...arr(currentSilent.unresolvedNotes),
      ...arr(obj(responseTurn).rejectedInputs).map((item) => s(item.reason)),
      ...arr(obj(responseTurn).confidence?.unclear),
      ...riskNotes,
    ],
    24
  );

  const recommendationNotes = uniqueStrings(
    [
      ...arr(currentSilent.recommendationNotes),
      ...arr(obj(responseTurn).recommendation?.notes),
      ...riskNotes,
    ],
    24
  );

  return {
    silentSynthesis: {
      visibilityMode: "hidden_until_review",
      synthesisStatus:
        arr(obj(responseTurn).rejectedInputs).length > 0
          ? "partial"
          : "synthesized",
      lastSynthesizedAt: nowIso(),
      rawEvidenceLog: rawEntry ? [rawEntry] : [],
      structuredDraft: buildStructuredDraftFromSetupAssistant(
        mergedSetupAssistant
      ),
      polishedDraft: buildPolishedDraftFromSetupAssistant(
        mergedSetupAssistant,
        responseTurn
      ),
      unresolvedNotes,
      recommendationNotes,
    },
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
      currentStep: normalizeNextQuestionStep(
        nextQuestion,
        SETUP_ASSISTANT_CURRENT_STEP
      ),
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
  nextDraftPayload = null,
  deps = {},
}) {
  const patchReviewDraft =
    deps.patchSetupReviewDraft ||
    deps.patchReview ||
    patchSetupReviewDraft;

  const draftPayload =
    obj(nextDraftPayload) && Object.keys(obj(nextDraftPayload)).length
      ? obj(nextDraftPayload)
      : buildNextSetupAssistantDraftPayload({
          review,
          mergedSetupAssistant,
          brainSnapshot,
          nextTimeline,
        });

  const canonicalReviewDraftPatch =
    buildCanonicalReviewDraftPatchFromSetupAssistant(mergedSetupAssistant);

  try {
    await patchReviewDraft({
      sessionId: review.session.id,
      tenantId: actor.tenantId,
      patch: {
        draftPayload,
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
        hiddenSynthesisEnabled: true,
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
      hiddenSynthesisEnabled: true,
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

    const hiddenSynthesisPatch = buildSilentSynthesisPatch({
      currentSetupAssistant: draftForBrain,
      mergedSetupAssistant,
      latestMessage: latestMessage || (isMessageSkip(body) ? "continue" : ""),
      latestStep,
      responseTurn,
      includeRawEvidence: true,
    });

    mergedSetupAssistant = mergeSetupAssistantDraft(
      mergedSetupAssistant,
      hiddenSynthesisPatch,
      seed
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
      "silentSynthesis",
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

    const hiddenSynthesisPatch = buildSilentSynthesisPatch({
      currentSetupAssistant,
      mergedSetupAssistant,
      latestMessage: "",
      latestStep,
      responseTurn,
      includeRawEvidence: false,
    });

    mergedSetupAssistant = mergeSetupAssistantDraft(
      mergedSetupAssistant,
      hiddenSynthesisPatch,
      seed
    );

    updatedFields = [
      ...Object.keys(obj(directPatch)),
      ...Object.keys(obj(brainDerivedPatch)),
      "silentSynthesis",
      "setupAssistantBrain",
    ];
  }

  const nextDraftPayload = buildNextSetupAssistantDraftPayload({
    review,
    mergedSetupAssistant,
    brainSnapshot: responseTurn,
    nextTimeline,
  });

  const persisted = await persistSetupAssistantState({
    review,
    actor,
    mergedSetupAssistant,
    brainSnapshot: responseTurn,
    nextTimeline,
    nextDraftPayload,
    deps,
  });

  await maybeUpdateReviewSessionStep({
    reviewSessionId: review.session.id,
    nextQuestion: obj(responseTurn.nextQuestion),
    deps,
  });

  const optimisticReview = buildOptimisticSetupAssistantReview({
    review,
    nextDraftPayload,
    nextQuestion: obj(responseTurn.nextQuestion),
    persisted,
  });

  const baseResponsePayload = buildSetupAssistantSessionPayload(optimisticReview);
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
    s(optimisticReview?.session?.id || review.session.id),
    {
      reviewSessionId: s(optimisticReview?.session?.id || review.session.id),
      draftVersion: Number(
        optimisticReview?.draft?.version || review?.draft?.version || 0
      ),
      updatedFields: [...new Set(updatedFields)].filter(Boolean),
      source: "home_widget",
      sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      namespace: SETUP_ASSISTANT_NAMESPACE,
      brainNamespace: "setupAssistantBrain",
      timelineNamespace: "setupAssistantTimeline",
      timelineLength: nextTimeline.length,
      draftOnly: true,
      hiddenSynthesisEnabled: true,
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