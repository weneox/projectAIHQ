import { readSetupAssistantView } from "../../../services/workspace/setup/setupAssistantApp.js";
import {
  attachBuildHeaders,
  buildInfo,
  withBuildMeta,
} from "../../../utils/buildInfo.js";

function hasRenderableAssistantView(body = {}) {
  const root = body && typeof body === "object" ? body : {};
  const session =
    root.session && typeof root.session === "object" ? root.session : {};
  const setup = root.setup && typeof root.setup === "object" ? root.setup : {};
  const assistant =
    setup.assistant && typeof setup.assistant === "object"
      ? setup.assistant
      : root.assistant && typeof root.assistant === "object"
        ? root.assistant
        : {};

  return Boolean(
    root.ok !== false &&
      (String(session.id || "").trim() ||
        Object.keys(setup).length > 0 ||
        Object.keys(assistant).length > 0)
  );
}

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

  function sendJson(res, status, body, extra = {}) {
    attachBuildHeaders(res);
    return res.status(status).json(
      withBuildMeta(body, {
        route: "setup_assistant",
        responseStatus: Number(status || 0),
        ...extra,
      })
    );
  }

  async function runReadView(req, res, actor) {
    try {
      const result = await readSetupAssistantView(
        {
          db,
          actor,
        },
        {
          loadCurrentSetupAssistantSession,
        }
      );

      return sendJson(res, result.status, result.body, {
        action: "read_current",
      });
    } catch (error) {
      return sendJson(
        res,
        500,
        {
          ok: false,
          error: "SetupAssistantReadFailed",
          reason: s(error?.message || "failed to read setup assistant view"),
        },
        {
          action: "read_current",
          failure: "exception",
          errorName: s(error?.name),
        }
      );
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
        return sendJson(res, updated.status, updated.body, {
          action: "update_current",
          responseKind: "service_error",
        });
      }

      if (hasRenderableAssistantView(updated?.body)) {
        return sendJson(
          res,
          updated.status,
          {
            ...updated.body,
            message: s(updated?.body?.message || "Setup assistant draft updated"),
          },
          {
            action: "update_current",
            responseKind: "fast_path",
          }
        );
      }

      try {
        const view = await readSetupAssistantView(
          {
            db,
            actor,
          },
          {
            loadCurrentSetupAssistantSession,
          }
        );

        if (responseOk(view)) {
          return sendJson(
            res,
            view.status,
            {
              ...view.body,
              message: s(updated?.body?.message || "Setup assistant draft updated"),
            },
            {
              action: "update_current",
              responseKind: "fallback_reread",
            }
          );
        }
      } catch {}

      return sendJson(
        res,
        updated.status,
        {
          ...updated.body,
          message: s(updated?.body?.message || "Setup assistant draft updated"),
        },
        {
          action: "update_current",
          responseKind: "service_payload",
        }
      );
    } catch (error) {
      return sendJson(
        res,
        500,
        {
          ok: false,
          error: "SetupAssistantDraftUpdateFailed",
          reason: s(error?.message || "failed to update setup assistant draft"),
        },
        {
          action: "update_current",
          failure: "exception",
          errorName: s(error?.name),
        }
      );
    }
  }

  router.get("/setup/assistant/__build", (_req, res) => {
    return sendJson(
      res,
      200,
      {
        ok: true,
        service: "ai-hq-backend",
        feature: "setup_assistant",
        summary: buildInfo.summary,
      },
      {
        action: "build_probe",
        buildSummary: buildInfo.summary,
      }
    );
  });

  router.post("/setup/assistant/session/start", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const started = await startSetupAssistantSession({
        db,
        actor,
      });

      if (!responseOk(started)) {
        return sendJson(res, started.status, started.body, {
          action: "start_session",
          responseKind: "service_error",
        });
      }

      if (hasRenderableAssistantView(started?.body)) {
        return sendJson(
          res,
          started.status,
          {
            ...started.body,
            created: started?.body?.created === true,
            message: s(
              started?.body?.message || "Setup assistant session started"
            ),
          },
          {
            action: "start_session",
            responseKind: "fast_path",
          }
        );
      }

      try {
        const view = await readSetupAssistantView(
          {
            db,
            actor,
          },
          {
            loadCurrentSetupAssistantSession,
          }
        );

        if (responseOk(view)) {
          return sendJson(
            res,
            view.status,
            {
              ...view.body,
              created: started?.body?.created === true,
              message: s(
                started?.body?.message || "Setup assistant session started"
              ),
            },
            {
              action: "start_session",
              responseKind: "fallback_reread",
            }
          );
        }
      } catch {}

      return sendJson(
        res,
        started.status,
        {
          ...started.body,
          created: started?.body?.created === true,
          message: s(started?.body?.message || "Setup assistant session started"),
        },
        {
          action: "start_session",
          responseKind: "service_payload",
        }
      );
    } catch (error) {
      return sendJson(
        res,
        500,
        {
          ok: false,
          error: "SetupAssistantSessionStartFailed",
          reason: s(error?.message || "failed to start setup assistant session"),
        },
        {
          action: "start_session",
          failure: "exception",
          errorName: s(error?.name),
        }
      );
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