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

function lower(value = "") {
  return s(value).toLowerCase();
}

function compactText(value = "", max = 220) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function listPreview(items = [], max = 4) {
  const safe = [...new Set(arr(items).map((item) => s(item)).filter(Boolean))];
  if (!safe.length) return "";
  if (safe.length <= max) return safe.join(", ");
  return `${safe.slice(0, max).join(", ")} +${safe.length - max}`;
}

function detectConversationIntent(message = "") {
  const text = lower(message);

  if (!text) return "unknown";

  if (
    /^(bitdi|bitti|hazirdir|hazırdır|qurtardi|qurtardı|tamamdir|tamamdır|done|finished|that's all|thats all)$/i.test(
      text
    )
  ) {
    return "complete";
  }

  if (
    /^(davam|oldu|tamam|ok|okay|next|continue|beli|bəli|he|hə)$/i.test(text)
  ) {
    return "continue";
  }

  if (
    /(duz deyil|düz deyil|yanlis|yanlış|no|yox|beledir yox|belə deyil|wrong|not correct)/i.test(
      text
    )
  ) {
    return "correction";
  }

  if (/(salam|salamlar|hi|hello|hey)$/i.test(text)) {
    return "greeting";
  }

  return "unknown";
}

function isWeakAnswer(message = "") {
  const text = lower(message);

  if (!text) return true;

  if (
    /^(ok|okay|tamam|oldu|davam|next|continue|beli|bəli|he|hə|bitdi|bitti)$/i.test(
      text
    )
  ) {
    return true;
  }

  if (text.length <= 2) return true;

  return false;
}

function looksLikeUrlOrDomain(value = "") {
  const text = s(value);
  if (!text) return false;

  return (
    /^https?:\/\//i.test(text) ||
    /^(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/.*)?$/i.test(text)
  );
}

function looksLikePhone(value = "") {
  return /(?:\+?\d[\d()\-\s]{6,}\d)/.test(s(value));
}

function looksLikeEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(s(value));
}

function looksLikeHoursText(value = "") {
  const text = lower(value);
  if (!text) return false;

  return (
    /(mon|tue|wed|thu|fri|sat|sun|b\.e|be|cümə|şənbə|bazar)/.test(text) ||
    /\b\d{1,2}[:.]?\d{0,2}\s*(?:-|to|dan|den|dek|qeder)\s*\d{1,2}[:.]?\d{0,2}\b/.test(
      text
    ) ||
    /\b24\/7\b/.test(text) ||
    /\bappointment\b/.test(text) ||
    /\bbağlı\b/.test(text) ||
    /\bclosed\b/.test(text)
  );
}

function looksLikePricingText(value = "") {
  const text = lower(value);
  if (!text) return false;

  return (
    /(azn|usd|eur|gbp|\$|€|₼|£)/.test(text) ||
    /\bprice\b/.test(text) ||
    /\bpricing\b/.test(text) ||
    /\bquote\b/.test(text) ||
    /\bqiymət\b/.test(text) ||
    /\bstarting\b/.test(text) ||
    /\bxidmətə görə\b/.test(text)
  );
}

function looksLikeServiceList(value = "") {
  const text = s(value);
  if (!text) return false;

  const parts = text
    .split(/[,;\n]/)
    .map((item) => s(item))
    .filter(Boolean);

  return parts.length >= 2;
}

function detectPatchStepsFromMessage(message = "", fallbackStep = "profile") {
  const text = s(message);
  const lowerText = lower(text);
  const out = new Set();

  if (looksLikeUrlOrDomain(text)) out.add("website");
  if (looksLikePhone(text) || looksLikeEmail(text) || /whatsapp|telegram|əlaqə|contact|email|telefon|phone/i.test(lowerText)) {
    out.add("contacts");
  }
  if (looksLikeHoursText(text)) out.add("hours");
  if (looksLikePricingText(text)) out.add("pricing");
  if (/şikayət|complaint|refund|payment|operator|manager|handoff|ötür|escalat/i.test(lowerText)) {
    out.add("handoff");
  }
  if (looksLikeServiceList(text)) out.add("services");

  if (!out.size) {
    out.add(s(fallbackStep, "profile"));
  } else if (
    !out.has("profile") &&
    !out.has("website") &&
    text.split(/\s+/).filter(Boolean).length <= 6
  ) {
    out.add("profile");
  }

  return Array.from(out);
}

function buildSupplementalMessagePatch(
  currentSetupAssistant = {},
  latestMessage = "",
  latestStep = ""
) {
  const steps = detectPatchStepsFromMessage(
    latestMessage,
    latestStep || "profile"
  );

  return steps.reduce((acc, step) => {
    const patch = normalizeSetupAssistantDraftPatchBody(
      {
        step,
        message: latestMessage,
        text: latestMessage,
        value: latestMessage,
      },
      currentSetupAssistant
    );

    return mergeDraftState(acc, patch);
  }, {});
}

function buildKnownStateSummary(setup = {}) {
  const businessProfile = obj(setup.businessProfile);
  const pricingPosture = obj(setup.pricingPosture);
  const handoffRules = obj(setup.handoffRules);

  const bits = [];

  if (s(businessProfile.companyName)) bits.push(`ad: ${businessProfile.companyName}`);
  if (s(businessProfile.description)) bits.push("təsvir var");
  if (arr(setup.services).length) bits.push(`${arr(setup.services).length} xidmət`);
  if (arr(setup.contacts).length) bits.push("əlaqə var");
  if (arr(setup.hours).length) bits.push("saat var");
  if (s(pricingPosture.publicSummary)) bits.push("pricing var");
  if (s(handoffRules.summary) || arr(handoffRules.triggers).length) {
    bits.push("ötürmə qaydası var");
  }

  return bits.slice(0, 6);
}

function buildAcceptedFactsSummary(orchestratorPatch = {}, supplementalPatch = {}) {
  const facts = [];
  const merged = mergeDraftState(orchestratorPatch, supplementalPatch);

  const identity = obj(merged.businessProfile);
  if (s(identity.companyName)) facts.push(`ad: ${identity.companyName}`);
  if (s(identity.description)) facts.push("təsvir qəbul edildi");
  if (s(identity.websiteUrl)) facts.push(`website: ${identity.websiteUrl}`);

  if (arr(merged.services).length) {
    facts.push(`xidmətlər: ${listPreview(arr(merged.services).map((item) => s(item.title || item.name || item.label)), 3)}`);
  }

  if (arr(merged.contacts).length) {
    facts.push("əlaqə yolu qəbul edildi");
  }

  if (arr(merged.hours).length) {
    facts.push("iş saatı qəbul edildi");
  }

  if (s(obj(merged.pricingPosture).publicSummary)) {
    facts.push("pricing posture qəbul edildi");
  }

  if (s(obj(merged.handoffRules).summary) || arr(obj(merged.handoffRules).triggers).length) {
    facts.push("ötürmə qaydası qəbul edildi");
  }

  return facts.slice(0, 4);
}

function buildQuestionPrompt(nextQuestion = null) {
  const question = obj(nextQuestion);
  return compactText(
    s(question.prompt) || s(question.title) || "Bir detalı dəqiqləşdirək."
  );
}

function buildConversationalLocalTurn({
  currentSetupAssistant = {},
  mergedSetupAssistant = {},
  review = {},
  latestStep = "",
  latestMessage = "",
  summary = {},
  orchestratorTurn = {},
  orchestratorPatch = {},
  supplementalPatch = {},
}) {
  const currentDraft = obj(currentSetupAssistant);
  const mergedDraft = obj(mergedSetupAssistant);
  const reviewState = buildReviewState(
    mergedDraft,
    summary,
    summaryContextFromReview(review)
  );

  const nextQuestion = getNextQuestion(
    summary,
    mergedDraft,
    obj(mergedDraft.progress)
  );

  const intent = detectConversationIntent(latestMessage);
  const knownState = buildKnownStateSummary(mergedDraft);
  const acceptedFacts = buildAcceptedFactsSummary(
    orchestratorPatch,
    supplementalPatch
  );
  const contradictions = arr(obj(orchestratorTurn.confidence).contradictions)
    .map((item) => s(item))
    .filter(Boolean);
  const rejectedInputs = arr(orchestratorTurn.rejectedInputs)
    .map((item) => ({
      input: s(item.input),
      reason: s(item.reason),
      suggestedField: s(item.suggestedField),
    }))
    .filter((item) => item.input || item.reason);

  const weakAnswer = isWeakAnswer(latestMessage);
  const sameQuestion =
    s(obj(currentDraft.progress).currentQuestionKey).toLowerCase() ===
    s(obj(nextQuestion).key).toLowerCase();

  let assistantMessage = "";
  let phase = summary.readyForReview === true ? "ready" : "interview";

  if (!s(latestMessage)) {
    assistantMessage = s(orchestratorTurn.assistantMessage);
  } else if (intent === "greeting") {
    assistantMessage =
      "Salam. Mən bunu səninlə rahat şəkildə qura bilərəm. Sərbəst yaz, mən nəyin artıq aydın olduğunu çıxarıb yalnız həqiqətən lazım olan növbəti şeyi soruşacağam.";
  } else if (intent === "complete") {
    if (summary.readyForReview === true) {
      assistantMessage =
        "Bəli, bu draft indi review üçün kifayət qədər doludur. İstəsən bir son baxış edib təsdiqə keçirə bilərik.";
    } else {
      assistantMessage = knownState.length
        ? `Hələ tam bitməyib. Məndə artıq ${knownState.join(
            ", "
          )} var, amma review üçün bir neçə vacib boşluq qalır. ${buildQuestionPrompt(
            nextQuestion
          )}`
        : `Hələ setup tam deyil. ${buildQuestionPrompt(nextQuestion)}`;
    }
  } else if (rejectedInputs.length > 0) {
    const firstRejected = obj(rejectedInputs[0]);
    assistantMessage = s(firstRejected.input)
      ? `“${firstRejected.input}” cavabını olduğu kimi qəbul etmədim. ${s(
          firstRejected.reason
        )} ${buildQuestionPrompt(nextQuestion)}`
      : `${s(firstRejected.reason)} ${buildQuestionPrompt(nextQuestion)}`;
  } else if (contradictions.length > 0) {
    assistantMessage = `Burada bir ziddiyyət görünür: ${contradictions[0]} ${buildQuestionPrompt(
      nextQuestion
    )}`;
  } else if (acceptedFacts.length > 0 && summary.readyForReview === true) {
    assistantMessage = `Qəbul etdiyim hissələr: ${acceptedFacts.join(
      ", "
    )}. İndi draft review üçün kifayət qədər doludur. İstəsən təsdiqə keçirə bilərik.`;
  } else if (acceptedFacts.length > 0) {
    assistantMessage = `Qəbul etdiyim hissələr: ${acceptedFacts.join(
      ", "
    )}. İndi ən vacib növbəti detal budur: ${buildQuestionPrompt(nextQuestion)}`;
  } else if (weakAnswer && nextQuestion && sameQuestion) {
    assistantMessage = `Bu hələ fakt kimi kifayət qədər aydın deyil. ${buildQuestionPrompt(
      nextQuestion
    )}`;
  } else if (nextQuestion) {
    assistantMessage = `Bunu qeyd etdim. İndi ən vacib növbəti detal budur: ${buildQuestionPrompt(
      nextQuestion
    )}`;
  } else {
    assistantMessage =
      "Bunu qeyd etdim. İstəsən əlavə detal və ya düzəliş yaza bilərsən.";
  }

  if (!s(assistantMessage)) {
    assistantMessage =
      s(orchestratorTurn.assistantMessage) ||
      "Bunu qeyd etdim. İndi növbəti vacib detalı dəqiqləşdirək.";
  }

  return {
    ok: true,
    provider: s(orchestratorTurn.provider, "local_conversation"),
    model: s(orchestratorTurn.model),
    usedFallback: true,
    error: s(orchestratorTurn.error),
    latestUserInput: {
      step: s(latestStep),
      text: s(latestMessage),
    },
    phase,
    assistantMessage,
    nextQuestion: nextQuestion
      ? {
          ...obj(nextQuestion),
          key: s(nextQuestion.key),
          step: s(nextQuestion.step || nextQuestion.key),
          title: s(nextQuestion.title),
          prompt: s(nextQuestion.prompt),
          group: s(nextQuestion.group || "business_truth"),
          groupLabel: s(nextQuestion.groupLabel || "Business truth"),
        }
      : null,
    draft: obj(orchestratorTurn.draft),
    acceptedPatch: obj(orchestratorTurn.acceptedPatch),
    rejectedInputs,
    confidence: obj(orchestratorTurn.confidence),
    recommendation: obj(orchestratorTurn.recommendation),
    sourceSignals: obj(orchestratorTurn.sourceSignals),
    interviewPlan: obj(orchestratorTurn.interviewPlan),
    aiBehavior: obj(orchestratorTurn.aiBehavior),
    readyForApproval: reviewState.finalizeAvailable === true,
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

  const existingDraftPayload = obj(review?.draft?.draftPayload);
  const seed = buildSetupAssistantSeedFromReview(review);
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
      sources: arr(review.sources),
      review,
      latestStep,
      latestMessage: latestMessage || (isMessageSkip(body) ? "continue" : ""),
    });

    orchestratorPatch = buildSetupAssistantPatchFromOrchestrator(
      rawTurn,
      currentSetupAssistant
    );

    supplementalPatch = buildSupplementalMessagePatch(
      currentSetupAssistant,
      latestMessage,
      latestStep
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
      summaryContextFromReview(review)
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

    const localTurn = buildConversationalLocalTurn({
      currentSetupAssistant,
      mergedSetupAssistant,
      review,
      latestStep,
      latestMessage,
      summary: postMergeSummary,
      orchestratorTurn: rawTurn,
      orchestratorPatch,
      supplementalPatch,
    });

    clientTurn =
      rawTurn.usedFallback === true
        ? localTurn
        : shapeBrainTurnForClient(rawTurn, mergedSetupAssistant);

    if (!s(obj(clientTurn).assistantMessage)) {
      clientTurn = localTurn;
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

    const nextSummary = buildSummary(
      mergedSetupAssistant,
      summaryContextFromReview(review)
    );
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

  const effectiveNextQuestion = messageMode
    ? obj(clientTurn?.nextQuestion || nextQuestion)
    : obj(nextQuestion);

  await maybeUpdateReviewSessionStep({
    reviewSessionId: review.session.id,
    nextQuestion: effectiveNextQuestion,
    deps,
  });

  const refreshed = await getCurrentReview(actor.tenantId);

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
      draftOnly: true,
      messageMode,
      skipped: isMessageSkip(body),
      nextQuestion: s(effectiveNextQuestion?.key),
      canonicalBridge: true,
      brainProvider: s(rawTurn?.provider),
      brainModel: s(rawTurn?.model),
      brainUsedFallback: rawTurn?.usedFallback === true,
      brainError: s(rawTurn?.error),
      conversationalIntent: detectConversationIntent(latestMessage),
    }
  );

  const baseResponsePayload = buildSetupAssistantSessionPayload(refreshed);

  return {
    status: 200,
    body: {
      ...buildSetupAssistantResponseBody(baseResponsePayload, clientTurn),
      message: "Setup assistant draft updated",
    },
  };
}
