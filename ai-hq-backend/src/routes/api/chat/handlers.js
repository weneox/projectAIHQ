import crypto from "crypto";
import { okJson, isDbReady, serviceUnavailableJson } from "../../../utils/http.js";
import { deepFix, fixText } from "../../../utils/textFix.js";
import { kernelHandle } from "../../../kernel/agentKernel.js";
import { normalizeChatBody } from "./utils.js";

export function createChatHandlers({ db, wsHub }) {
  async function postChat(req, res) {
    const input = normalizeChatBody(req.body);

    let {
      agentId,
      message,
      usecase,
      tenant,
      today,
      format,
      extra,
      threadId,
    } = input;

    if (!message) {
      return okJson(res, { ok: false, error: "message required" });
    }

    try {
      if (!threadId) threadId = crypto.randomUUID?.() || String(Date.now());

      if (!isDbReady(db)) {
        return serviceUnavailableJson(
          res,
          "database unavailable; chat runtime requires persistent storage"
        );
      }

      await db.query(
        `insert into threads (id, title) values ($1::uuid, $2::text)
         on conflict (id) do nothing`,
        [threadId, "Chat"]
      );

      await db.query(
        `insert into messages (thread_id, role, agent_key, content, meta)
         values ($1::uuid, 'user', null, $2::text, '{}'::jsonb)`,
        [threadId, message]
      );

      const out = await kernelHandle({
        message,
        agentHint: agentId,
        usecase,
        tenant,
        today,
        format,
        extra,
      });

      const answer = fixText(String(out?.replyText || "").trim());
      const meta = deepFix(out?.meta || {});

      const q = await db.query(
        `insert into messages (thread_id, role, agent_key, content, meta)
         values ($1::uuid, 'assistant', $2::text, $3::text, $4::jsonb)
         returning id, thread_id, role, agent_key, content, meta, created_at`,
        [threadId, agentId, answer, meta]
      );

      const row = q.rows?.[0] || null;
      if (row) {
        row.content = fixText(row.content);
        row.meta = deepFix(row.meta);

        wsHub?.broadcast?.({
          type: "thread.message",
          threadId,
          message: row,
        });
      }

      return okJson(res, {
        ok: Boolean(out?.ok),
        threadId,
        agentId,
        answer,
        meta,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  return { postChat };
}
