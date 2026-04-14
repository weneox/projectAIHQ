import { readSetupAssistantView } from "../../../services/workspace/setup/setupAssistantApp.js";

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
  function responseOk(result) {
    return Number(result?.status || 500) === 200 && result?.body?.ok !== false;
  }

  async function runReadView(req, res, actor) {
    try {
      const result = await readSetupAssistantView({
        db,
        actor,
      }, {
        loadCurrentSetupAssistantSession,
      });

      return res.status(result.status).json(result.body);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: "SetupAssistantReadFailed",
        reason: s(error?.message || "failed to read setup assistant view"),
      });
    }
  }

  async function runUpdateDraft(req, res, actor) {
    try {
      const updated = await updateSetupAssistantDraft({
        db,
        actor,
        body: req.body || {},
      });

      if (!responseOk(updated)) {
        return res.status(updated.status).json(updated.body);
      }

      try {
        const view = await readSetupAssistantView({
          db,
          actor,
          loadCurrentSetupAssistantSession,
        });

        if (responseOk(view)) {
          return res.status(view.status).json({
            ...view.body,
            message: s(updated?.body?.message || "Setup assistant draft updated"),
          });
        }
      } catch {}

      return res.status(updated.status).json({
        ...updated.body,
        message: s(updated?.body?.message || "Setup assistant draft updated"),
      });
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
      const started = await startSetupAssistantSession({
        db,
        actor,
      });

      if (!responseOk(started)) {
        return res.status(started.status).json(started.body);
      }

      try {
        const view = await readSetupAssistantView({
          db,
          actor,
          loadCurrentSetupAssistantSession,
        });

        if (responseOk(view)) {
          return res.status(view.status).json({
            ...view.body,
            created: started?.body?.created === true,
            message: s(started?.body?.message || "Setup assistant session started"),
          });
        }
      } catch {}

      return res.status(started.status).json({
        ...started.body,
        created: started?.body?.created === true,
        message: s(started?.body?.message || "Setup assistant session started"),
      });
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
    return runReadView(req, res, actor);
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
