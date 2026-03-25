import crypto from "crypto";
import { cfg } from "../../../config.js";
import { okJson, clamp, isDbReady } from "../../../utils/http.js";
import { getAuthTenantId, getAuthTenantKey } from "../../../utils/auth.js";
import { deepFix, fixText } from "../../../utils/textFix.js";
import { runDebate } from "../../../kernel/debateEngine.js";
import {
  buildCronMessage,
  normalizeDebateRequestBody,
} from "./utils.js";
import {
  buildTenantRuntimeFromRequest,
  buildDebateExtra,
} from "./runtime.js";
import {
  persistUserDebateMessage,
  persistAssistantDebateMessage,
  persistDebateProposalAndContent,
} from "./persistence.js";

export function createDebateHandlers({ db, wsHub }) {
  async function postDebate(req, res) {
    const input = normalizeDebateRequestBody(
      req.body
    );

    const tenantId = getAuthTenantId(req);
    const tenantKey = getAuthTenantKey(req);
    const mode = input.mode;
    const rounds = clamp(input.rounds ?? 1, 1, 5);
    const agents = input.agents;
    const formatHint = input.formatHint;

    let message = input.message;
    let threadId = input.threadId;

    if (!threadId) threadId = crypto.randomUUID();

    if (!tenantId || !tenantKey) {
      return okJson(res, { ok: false, error: "missing authenticated tenant context" });
    }

    const tenant = buildTenantRuntimeFromRequest(req, { tenantId, tenantKey });
    const debateExtra = buildDebateExtra(req, { tenantId, formatHint, mode });

    if (!message) {
      message = buildCronMessage({ mode, tenantId, formatHint });
      if (!message) {
        return okJson(res, { ok: false, error: "message required" });
      }
    }

    try {
      await persistUserDebateMessage({
        db,
        threadId,
        message,
        mode,
        tenantId,
        formatHint,
      });

      const out = await runDebate({
        message,
        mode,
        rounds,
        agents,
        tenantId,
        tenant,
        threadId,
        formatHint: formatHint || null,
        extra: debateExtra,
      });

      const finalAnswer = fixText(String(out?.finalAnswer || "").trim());
      const agentNotes = deepFix(out?.agentNotes || []);
      const debug = deepFix({
        promptBundle: out?.promptBundle || null,
        normalizedPromptInput: out?.normalizedPromptInput || null,
      });

      await persistAssistantDebateMessage({
        db,
        wsHub,
        threadId,
        finalAnswer,
        agentNotes,
        mode,
        tenantId,
        formatHint,
      });

      const { proposal, content } = await persistDebateProposalAndContent({
        db,
        wsHub,
        threadId,
        mode,
        proposalPayload: out?.proposal,
      });

      return okJson(res, {
        ok: true,
        tenantId,
        threadId,
        mode,
        formatHint: formatHint || null,
        finalAnswer,
        agentNotes,
        proposal,
        content,
        dbDisabled: !isDbReady(db),
        debug,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  return { postDebate };
}
