// ai-hq-backend/src/services/workspace/import/setupAssistantState.js

import {
  getCurrentSetupReview,
} from "../../../db/helpers/tenantSetupReview.js";

import { resolveTenantScope } from "./dbRows.js";
import { arr, obj, s, compactObject } from "./shared.js";
import {
  buildReasonedAssistantQuestionOnly,
  buildReasonedSetupAssistantPayload,
  buildReasonedSetupAssistantTurn,
} from "./reasonedSetupAssistant.js";

function cleanText(value = "", max = 320) {
  const text = s(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function assertReviewAvailable(review = null) {
  const x = obj(review);
  if (!s(x?.session?.id)) {
    const error = new Error("No active setup review session found");
    error.code = "SETUP_REVIEW_NOT_FOUND";
    throw error;
  }
  return x;
}

function assertRequestedSession(review = {}, reviewSessionId = "") {
  const safeRequested = s(reviewSessionId);
  if (!safeRequested) return obj(review);

  const safeCurrent = s(review?.session?.id);
  if (safeCurrent === safeRequested) return obj(review);

  const error = new Error("Requested setup review session is not the current active session");
  error.code = "SETUP_REVIEW_SESSION_MISMATCH";
  error.requestedReviewSessionId = safeRequested;
  error.currentReviewSessionId = safeCurrent;
  throw error;
}

function buildReviewMeta(review = {}) {
  const x = obj(review);
  const session = obj(x.session);
  const draft = obj(x.draft);
  const payload = obj(draft.draftPayload);

  return compactObject({
    reviewSessionId: s(session.id),
    status: s(session.status),
    mode: s(session.mode),
    currentStep: s(session.currentStep || session.current_step),
    version: Number(draft.version || 0),
    sourceCount: arr(x.sources).length,
    primarySourceType: s(session.primarySourceType || session.primary_source_type),
    lastQuestionKey: cleanText(
      payload?.setupAssistant?.lastQuestionKey ||
        payload?.reasonedSetupAssistant?.lastQuestionKey,
      80
    ),
  });
}

function attachAssistantStateToDraft(draft = {}, assistantPayload = {}) {
  const x = obj(draft);
  const payload = obj(x.draftPayload);

  return {
    ...x,
    draftPayload: {
      ...payload,
      reasonedSetupAssistant: compactObject({
        reviewSessionId: s(assistantPayload.reviewSessionId),
        questionEnvelope: obj(assistantPayload.questionEnvelope),
        primaryQuestion: obj(assistantPayload.primaryQuestion),
        followupQueue: arr(assistantPayload.followupQueue),
        unknowns: arr(assistantPayload.unknowns),
        conversationStatus: obj(assistantPayload.conversationStatus),
        reasoningSummary: cleanText(assistantPayload.reasoningSummary, 700),
        assistantHints: arr(assistantPayload.assistantHints),
      }),
    },
  };
}

export async function readReasonedSetupAssistantState({
  db,
  tenantId = "",
  tenantKey = "",
  reviewSessionId = "",
  currentQuestionKey = "",
} = {}) {
  const scope = await resolveTenantScope({ db, tenantId, tenantKey });
  const review = assertRequestedSession(
    assertReviewAvailable(await getCurrentSetupReview(scope.tenantId)),
    reviewSessionId
  );

  const assistantPayload = buildReasonedSetupAssistantPayload({
    review,
    currentQuestionKey,
  });

  const enrichedDraft = attachAssistantStateToDraft(
    obj(review.draft),
    assistantPayload
  );

  return {
    ok: true,
    schema: "reasoned_setup_assistant_state.v1",
    tenantId: scope.tenantId,
    tenantKey: scope.tenantKey,
    review: {
      ...review,
      draft: enrichedDraft,
    },
    meta: buildReviewMeta(review),
    assistant: assistantPayload,
  };
}

export async function readReasonedSetupAssistantTurn({
  db,
  tenantId = "",
  tenantKey = "",
  reviewSessionId = "",
  currentQuestionKey = "",
} = {}) {
  const state = await readReasonedSetupAssistantState({
    db,
    tenantId,
    tenantKey,
    reviewSessionId,
    currentQuestionKey,
  });

  const turn = buildReasonedSetupAssistantTurn({
    review: state.review,
    currentQuestionKey,
  });

  return {
    ok: true,
    schema: "reasoned_setup_assistant_turn_response.v1",
    tenantId: state.tenantId,
    tenantKey: state.tenantKey,
    meta: obj(state.meta),
    assistant: obj(state.assistant),
    turn,
  };
}

export async function readReasonedSetupAssistantQuestion({
  db,
  tenantId = "",
  tenantKey = "",
  reviewSessionId = "",
  currentQuestionKey = "",
} = {}) {
  const state = await readReasonedSetupAssistantState({
    db,
    tenantId,
    tenantKey,
    reviewSessionId,
    currentQuestionKey,
  });

  const question = buildReasonedAssistantQuestionOnly({
    review: state.review,
    currentQuestionKey,
  });

  return {
    ok: true,
    schema: "reasoned_setup_assistant_question_response.v1",
    tenantId: state.tenantId,
    tenantKey: state.tenantKey,
    meta: obj(state.meta),
    assistant: obj(state.assistant),
    question,
  };
}

export async function readReasonedSetupAssistantSnapshot({
  db,
  tenantId = "",
  tenantKey = "",
  reviewSessionId = "",
  currentQuestionKey = "",
} = {}) {
  const state = await readReasonedSetupAssistantState({
    db,
    tenantId,
    tenantKey,
    reviewSessionId,
    currentQuestionKey,
  });

  return {
    ok: true,
    schema: "reasoned_setup_assistant_snapshot.v1",
    tenantId: state.tenantId,
    tenantKey: state.tenantKey,
    meta: obj(state.meta),
    conversationStatus: obj(state.assistant?.conversationStatus),
    primaryQuestion: obj(state.assistant?.primaryQuestion),
    followupQueue: arr(state.assistant?.followupQueue),
    businessFacts: obj(state.assistant?.businessFacts),
    reasoningSummary: cleanText(state.assistant?.reasoningSummary, 700),
    unknowns: arr(state.assistant?.unknowns),
    assistantHints: arr(state.assistant?.assistantHints),
    guardrails: arr(state.assistant?.guardrails),
  };
}

export const __test__ = {
  attachAssistantStateToDraft,
  assertRequestedSession,
  assertReviewAvailable,
  buildReviewMeta,
};