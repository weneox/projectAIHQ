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
}
