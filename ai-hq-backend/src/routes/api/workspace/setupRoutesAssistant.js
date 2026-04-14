import {
  readReasonedSetupAssistantQuestion,
  readReasonedSetupAssistantSnapshot,
  readReasonedSetupAssistantState,
  readReasonedSetupAssistantTurn,
} from "../../../services/workspace/import/setupAssistantState.js";

export function registerSetupAssistantRoutes(
  router,
  {
    db,
    requireSetupActor,
    startSetupAssistantSession,
    loadCurrentSetupAssistantSession,
    updateSetupAssistantDraft,
    s,
  }
) {
  function cleanMode(value = "") {
    const mode = s(value || "turn").toLowerCase();
    if (["turn", "question", "snapshot", "state"].includes(mode)) return mode;
    return "turn";
  }

  function cleanQuestionKey(req = {}) {
    return s(
      req?.query?.currentQuestionKey ||
        req?.query?.questionKey ||
        req?.params?.currentQuestionKey ||
        req?.body?.currentQuestionKey ||
        req?.body?.questionKey
    );
  }

  function cleanReviewSessionId(req = {}) {
    return s(
      req?.query?.reviewSessionId ||
        req?.params?.reviewSessionId ||
        req?.body?.reviewSessionId
    );
  }

  async function runUpdateDraft(req, res, actor) {
    try {
      const result = await updateSetupAssistantDraft({
        db,
        actor,
        body: req.body || {},
      });
      return res.status(result.status).json(result.body);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: "SetupAssistantDraftUpdateFailed",
        reason: s(error?.message || "failed to update setup assistant draft"),
      });
    }
  }

  async function runReasonedAssistantRead(req, res, actor, mode = "turn") {
    const reviewSessionId = cleanReviewSessionId(req);
    const currentQuestionKey = cleanQuestionKey(req);

    try {
      if (mode === "question") {
        const result = await readReasonedSetupAssistantQuestion({
          db,
          tenantId: actor.tenantId,
          tenantKey: actor.tenantKey,
          reviewSessionId,
          currentQuestionKey,
        });

        return res.status(200).json(result);
      }

      if (mode === "snapshot") {
        const result = await readReasonedSetupAssistantSnapshot({
          db,
          tenantId: actor.tenantId,
          tenantKey: actor.tenantKey,
          reviewSessionId,
          currentQuestionKey,
        });

        return res.status(200).json(result);
      }

      if (mode === "state") {
        const result = await readReasonedSetupAssistantState({
          db,
          tenantId: actor.tenantId,
          tenantKey: actor.tenantKey,
          reviewSessionId,
          currentQuestionKey,
        });

        return res.status(200).json(result);
      }

      const result = await readReasonedSetupAssistantTurn({
        db,
        tenantId: actor.tenantId,
        tenantKey: actor.tenantKey,
        reviewSessionId,
        currentQuestionKey,
      });

      return res.status(200).json(result);
    } catch (error) {
      const code = s(error?.code);

      if (code === "SETUP_REVIEW_NOT_FOUND") {
        return res.status(404).json({
          ok: false,
          error: "SetupAssistantReviewNotFound",
          reason: "No active setup review session found",
          reasonCode: code,
        });
      }

      if (code === "SETUP_REVIEW_SESSION_MISMATCH") {
        return res.status(409).json({
          ok: false,
          error: "SetupAssistantReviewSessionMismatch",
          reason: "Requested setup review session does not match the active session",
          reasonCode: code,
          requestedReviewSessionId: s(error?.requestedReviewSessionId),
          currentReviewSessionId: s(error?.currentReviewSessionId),
        });
      }

      return res.status(500).json({
        ok: false,
        error: "SetupAssistantStateReadFailed",
        reason: s(error?.message || "failed to read reasoned setup assistant state"),
        reasonCode: code || "setup_assistant_state_read_failed",
      });
    }
  }

  router.post("/setup/assistant/session/start", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const result = await startSetupAssistantSession({
        db,
        actor,
      });
      return res.status(result.status).json(result.body);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: "SetupAssistantSessionStartFailed",
        reason: s(error?.message || "failed to start setup assistant session"),
      });
    }
  });

  router.get("/setup/assistant/session/current", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const result = await loadCurrentSetupAssistantSession({
        db,
        actor,
      });
      return res.status(result.status).json(result.body);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: "SetupAssistantSessionLoadFailed",
        reason: s(error?.message || "failed to load setup assistant session"),
      });
    }
  });

  router.patch("/setup/assistant/session/current", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;
    return runUpdateDraft(req, res, actor);
  });

  router.post("/setup/assistant/session/current/message", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;
    return runUpdateDraft(req, res, actor);
  });

  router.get("/setup/assistant", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;
    return runReasonedAssistantRead(req, res, actor, cleanMode(req?.query?.mode));
  });

  router.get("/setup/assistant/turn", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;
    return runReasonedAssistantRead(req, res, actor, "turn");
  });

  router.get("/setup/assistant/question", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;
    return runReasonedAssistantRead(req, res, actor, "question");
  });

  router.get("/setup/assistant/snapshot", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;
    return runReasonedAssistantRead(req, res, actor, "snapshot");
  });

  router.get("/setup/assistant/state", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;
    return runReasonedAssistantRead(req, res, actor, "state");
  });
}