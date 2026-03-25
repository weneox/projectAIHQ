import { assertDbReady, isUuid } from "../../../utils/http.js";
import { normalizeMessageRow } from "./utils.js";

export async function listThreadMessages({ db, threadId }) {
  assertDbReady(db);

  const q = await db.query(
    `select id, thread_id, role, agent_key, content, meta, created_at
     from messages
     where thread_id = $1::uuid
     order by created_at asc
     limit 500`,
    [threadId]
  );

  const rows = (q.rows || []).map(normalizeMessageRow);

  return {
    ok: true,
    messages: rows,
  };
}

export async function createThreadMessage({ db, threadId, role, agent, content }) {
  assertDbReady(db);

  if (!isUuid(threadId)) {
    return {
      ok: false,
      error: "threadId must be uuid",
    };
  }

  const q = await db.query(
    `insert into messages (thread_id, role, agent_key, content, meta)
     values ($1::uuid, $2::text, $3::text, $4::text, $5::jsonb)
     returning id, thread_id, role, agent_key, content, meta, created_at`,
    [threadId, role, agent, content, {}]
  );

  const row = q.rows?.[0] || null;
  if (!row) {
    return {
      ok: false,
      error: "insert failed",
    };
  }

  return {
    ok: true,
    message: normalizeMessageRow(row),
  };
}
