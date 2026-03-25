import { okJson } from "../../../utils/http.js";
import {
  normalizeThreadId,
  normalizeRole,
  normalizeAgent,
  normalizeContent,
} from "./utils.js";
import {
  listThreadMessages,
  createThreadMessage,
} from "./service.js";

export function createThreadsHandlers({ db }) {
  async function getThreadMessages(req, res) {
    const threadId = normalizeThreadId(req.params.id);

    if (!threadId) {
      return okJson(res, { ok: false, error: "threadId required" });
    }

    try {
      const out = await listThreadMessages({ db, threadId });

      return okJson(res, {
        ok: true,
        threadId,
        messages: out.messages,
        ...(out.dbDisabled ? { dbDisabled: true } : {}),
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function postThreadMessage(req, res) {
    const threadId = normalizeThreadId(req.params.id);
    const role = normalizeRole(req.body?.role);
    const agent = normalizeAgent(req.body?.agent);
    const content = normalizeContent(req.body?.content);

    if (!threadId) {
      return okJson(res, { ok: false, error: "threadId required" });
    }

    if (!content) {
      return okJson(res, { ok: false, error: "content required" });
    }

    try {
      const out = await createThreadMessage({
        db,
        threadId,
        role,
        agent,
        content,
      });

      if (!out.ok) {
        return okJson(res, {
          ok: false,
          error: out.error,
        });
      }

      return okJson(res, {
        ok: true,
        message: out.message,
        ...(out.dbDisabled ? { dbDisabled: true } : {}),
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  return {
    getThreadMessages,
    postThreadMessage,
  };
}