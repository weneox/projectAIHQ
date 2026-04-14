import express from "express";

import {
  ok,
  bad,
  serverErr,
  requireDb,
  requireTenant,
  cleanString,
} from "../../settings/utils.js";

import {
  readReasonedSetupAssistantQuestion,
  readReasonedSetupAssistantSnapshot,
  readReasonedSetupAssistantState,
  readReasonedSetupAssistantTurn,
} from "../../../../services/workspace/import/setupAssistantState.js";

function cleanMode(value = "") {
  const mode = cleanString(value || "turn", "turn").toLowerCase();
  if (["turn", "question", "snapshot", "state"].includes(mode)) return mode;
  return "turn";
}

function cleanQuestionKey(value = "") {
  return cleanString(value || "", "");
}

function cleanReviewSessionId(value = "") {
  return cleanString(value || "", "");
}

function pickTenantId(req) {
  return (
    cleanString(req?.tenant?.id || "", "") ||
    cleanString(req?.tenantId || "", "") ||
    cleanString(req?.auth?.tenantId || "", "") ||
    cleanString(req?.user?.tenantId || "", "") ||
    ""
  );
}

function buildRequestInput(req) {
  return {
    tenantId: pickTenantId(req),
    tenantKey: requireTenant(req, { status() { return this; }, json() {} }) || "",
    reviewSessionId: cleanReviewSessionId(
      req?.query?.reviewSessionId ||
        req?.params?.reviewSessionId ||
        req?.body?.reviewSessionId
    ),
    currentQuestionKey: cleanQuestionKey(
      req?.query?.currentQuestionKey ||
        req?.query?.questionKey ||
        req?.params?.currentQuestionKey ||
        req?.body?.currentQuestionKey ||
        req?.body?.questionKey
    ),
  };
}

function extractSafePayload(data = {}) {
  return {
    meta: data?.meta || {},
    assistant: data?.assistant || {},
    turn: data?.turn || null,
    question: data?.question || null,
    conversationStatus: data?.conversationStatus || null,
    primaryQuestion: data?.primaryQuestion || null,
    followupQueue: data?.followupQueue || [],
    businessFacts: data?.businessFacts || {},
    reasoningSummary: data?.reasoningSummary || "",
    unknowns: data?.unknowns || [],
    assistantHints: data?.assistantHints || [],
    guardrails: data?.guardrails || [],
    review: data?.review || undefined,
  };
}

async function handleMode({ db, req, res, mode = "turn" }) {
  if (!requireDb(res, db)) return;
  const tenantKey = requireTenant(req, res);
  if (!tenantKey) return;

  const input = buildRequestInput(req);
  input.tenantKey = tenantKey;

  try {
    if (mode === "question") {
      const data = await readReasonedSetupAssistantQuestion({
        db,
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
        reviewSessionId: input.reviewSessionId,
        currentQuestionKey: input.currentQuestionKey,
      });

      return ok(res, {
        schema: data?.schema || "reasoned_setup_assistant_question_response.v1",
        ...extractSafePayload(data),
      });
    }

    if (mode === "snapshot") {
      const data = await readReasonedSetupAssistantSnapshot({
        db,
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
        reviewSessionId: input.reviewSessionId,
        currentQuestionKey: input.currentQuestionKey,
      });

      return ok(res, {
        schema: data?.schema || "reasoned_setup_assistant_snapshot.v1",
        ...extractSafePayload(data),
      });
    }

    if (mode === "state") {
      const data = await readReasonedSetupAssistantState({
        db,
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
        reviewSessionId: input.reviewSessionId,
        currentQuestionKey: input.currentQuestionKey,
      });

      return ok(res, {
        schema: data?.schema || "reasoned_setup_assistant_state.v1",
        ...extractSafePayload(data),
      });
    }

    const data = await readReasonedSetupAssistantTurn({
      db,
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      reviewSessionId: input.reviewSessionId,
      currentQuestionKey: input.currentQuestionKey,
    });

    return ok(res, {
      schema: data?.schema || "reasoned_setup_assistant_turn_response.v1",
      ...extractSafePayload(data),
    });
  } catch (error) {
    const code = cleanString(error?.code || "", "");
    const message = cleanString(error?.message || "Failed to read setup assistant state");

    if (code === "SETUP_REVIEW_NOT_FOUND") {
      return bad(res, "No active setup review session found", {
        reasonCode: code,
      });
    }

    if (code === "SETUP_REVIEW_SESSION_MISMATCH") {
      return bad(res, "Requested setup review session does not match the active session", {
        reasonCode: code,
        requestedReviewSessionId: cleanString(error?.requestedReviewSessionId || "", ""),
        currentReviewSessionId: cleanString(error?.currentReviewSessionId || "", ""),
      });
    }

    return serverErr(res, message, {
      reasonCode: code || "setup_assistant_read_failed",
    });
  }
}

export function setupAssistantRoutes({ db } = {}) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const mode = cleanMode(req?.query?.mode);
    return handleMode({ db, req, res, mode });
  });

  router.get("/turn", async (req, res) => {
    return handleMode({ db, req, res, mode: "turn" });
  });

  router.get("/question", async (req, res) => {
    return handleMode({ db, req, res, mode: "question" });
  });

  router.get("/snapshot", async (req, res) => {
    return handleMode({ db, req, res, mode: "snapshot" });
  });

  router.get("/state", async (req, res) => {
    return handleMode({ db, req, res, mode: "state" });
  });

  return router;
}

export const __test__ = {
  buildRequestInput,
  cleanMode,
  cleanQuestionKey,
  cleanReviewSessionId,
  extractSafePayload,
  pickTenantId,
};