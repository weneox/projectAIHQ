import { isUuid, assertDbReady } from "../../../utils/http.js";

import {
  dbGetLatestContentByProposal,
  dbUpdateContentItem,
} from "../../../db/helpers/content.js";
import { dbGetProposalById } from "../../../db/helpers/proposals.js";
import { dbCreateJob } from "../../../db/helpers/jobs.js";
import { dbCreateNotification } from "../../../db/helpers/notifications.js";
import { dbAudit } from "../../../db/helpers/audit.js";

export async function getLatestContentByProposal({ db, proposalId, dbReady }) {
  assertDbReady(dbReady ? db : null);
  return dbGetLatestContentByProposal(db, proposalId);
}

export async function getContentById({ db, id, dbReady }) {
  assertDbReady(dbReady ? db : null);
  if (!id) return null;

  if (!isUuid(id)) return null;

  const q = await db.query(
    `select id, proposal_id, thread_id, job_id, status, content_pack, publish, last_feedback, created_at, updated_at
     from content_items
     where id = $1::uuid
     limit 1`,
    [id]
  );

  return q.rows?.[0] || null;
}

export async function getProposalById({ db, proposalId, dbReady }) {
  assertDbReady(dbReady ? db : null);
  if (!proposalId) return null;
  return dbGetProposalById(db, String(proposalId));
}

export async function patchContentItem({ db, id, patch, dbReady }) {
  assertDbReady(dbReady ? db : null);
  return dbUpdateContentItem(db, id, patch);
}

export async function createJob({ db, input, dbReady }) {
  assertDbReady(dbReady ? db : null);
  return dbCreateJob(db, {
    proposalId: input.proposalId,
    type: input.type,
    status: input.status || "queued",
    input: input.input || {},
  });
}

export async function createNotification({ db, input, dbReady }) {
  assertDbReady(dbReady ? db : null);
  return dbCreateNotification(db, input);
}

export async function writeAudit({
  db,
  actor,
  action,
  entityType,
  entityId,
  meta,
  dbReady,
}) {
  assertDbReady(dbReady ? db : null);
  await dbAudit(db, actor, action, entityType, entityId, meta);
}
