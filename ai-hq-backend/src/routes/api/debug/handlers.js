import { okJson } from "../../../utils/http.js";
import { getDebugTokenAuthResult } from "../../../utils/auth.js";
import { debugOpenAI } from "../../../kernel/agentKernel.js";
import { shouldEnableDebugRoutes } from "../../../utils/securitySurface.js";

export function createDebugHandlers() {
  async function postDebugOpenAI(req, res) {
    if (!shouldEnableDebugRoutes()) {
      return res.status(404).json({
        ok: false,
        error: "Not found",
      });
    }

    const debugAuth = getDebugTokenAuthResult(req);
    if (!debugAuth.ok) {
      const status =
        debugAuth.code === "debug_token_not_configured" ? 500 : 401;

      return res.status(status).json({
        ok: false,
        error:
          debugAuth.code === "debug_token_not_configured"
            ? "DebugAuthMisconfigured"
            : "Unauthorized",
        reason: debugAuth.reason || "invalid debug token",
      });
    }

    try {
      const out = await debugOpenAI();
      return okJson(res, { ok: true, out });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  return { postDebugOpenAI };
}
