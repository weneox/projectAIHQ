import { assertDbReady } from "../../../utils/http.js";
import { deepFix, fixText } from "../../../utils/textFix.js";
import {
  unwrapContentPackFromProposalPayload,
  statusForMode,
} from "./utils.js";

export async function persistUserDebateMessage({ db, threadId, message, mode, tenantId, formatHint }) {
  assertDbReady(db);

  await db.query(
    `insert into threads (id, title) values ($1::uuid, $2::text)
     on conflict (id) do nothing`,
    [threadId, "Debate"]
  );

  await db.query(
    `insert into messages (thread_id, role, agent_key, content, meta)
     values ($1::uuid, 'user', null, $2::text, $3::jsonb)`,
    [threadId, message, { mode, tenantId, formatHint: formatHint || null }]
  );
}

export async function persistAssistantDebateMessage({
  db,
  wsHub,
  threadId,
  finalAnswer,
  agentNotes,
  mode,
  tenantId,
  formatHint,
}) {
  const messageMeta = { agentNotes, mode, tenantId, formatHint: formatHint || null };
  assertDbReady(db);

  const q = await db.query(
    `insert into messages (thread_id, role, agent_key, content, meta)
     values ($1::uuid, 'assistant', 'debate', $2::text, $3::jsonb)
     returning id, thread_id, role, agent_key, content, meta, created_at`,
    [threadId, finalAnswer, messageMeta]
  );

  const row = q.rows?.[0] || null;
  if (row) {
    row.content = fixText(row.content);
    row.meta = deepFix(row.meta);
    wsHub?.broadcast?.({ type: "thread.message", threadId, message: row });
  }

  return row;
}

export async function persistDebateProposalAndContent({
  db,
  wsHub,
  threadId,
  mode,
  proposalPayload,
}) {
  let proposal = null;
  let content = null;

  if (!proposalPayload || typeof proposalPayload !== "object") {
    return { proposal, content };
  }

  const payload = deepFix(proposalPayload);
  const title =
    fixText(payload.title || payload.name || payload.summary || payload.goal || payload.topic || "") ||
    `Draft ${new Date().toISOString()}`;
  const status = statusForMode(mode);
  const type = String(payload.type || mode || "draft");
  assertDbReady(db);

  const q2 = await db.query(
    `insert into proposals (thread_id, agent, type, status, title, payload)
     values ($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::jsonb)
     returning id, thread_id, agent, type, status, title, payload, created_at, decided_at, decision_by`,
    [threadId, "debate", type, status, title, payload]
  );

  proposal = q2.rows?.[0] || null;
  if (proposal) {
    proposal.title = fixText(proposal.title);
    proposal.payload = deepFix(proposal.payload);
    wsHub?.broadcast?.({ type: "proposal.created", proposal });
  }

  if (proposal && mode === "draft") {
    const contentPack = unwrapContentPackFromProposalPayload(payload);

    const q3 = await db.query(
      `insert into content_items (proposal_id, status, content_pack, last_feedback)
       values ($1::uuid, $2::text, $3::jsonb, null)
       returning id, proposal_id, status, content_pack, last_feedback, job_id, created_at, updated_at`,
      [proposal.id, "draft.ready", contentPack]
    );

    content = q3.rows?.[0] || null;
    if (content) {
      content.content_pack = deepFix(content.content_pack);
      wsHub?.broadcast?.({ type: "content.updated", content });
    }
  }

  return { proposal, content };
}
