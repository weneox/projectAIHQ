import { deepFix, fixText } from "../../utils/textFix.js";

function clean(v) {
  return String(v || "").trim();
}

function normalizeJobRow(row) {
  const normalized = row || null;
  if (!normalized) return null;

  normalized.input = deepFix(normalized.input);
  normalized.output = deepFix(normalized.output);
  normalized.error = normalized.error ? fixText(String(normalized.error)) : normalized.error;
  return normalized;
}

export async function dbGetJobById(db, id, { forUpdate = false } = {}) {
  const q = await db.query(
    `select id, tenant_id, tenant_key, proposal_id, type, status, input, output, error, created_at, started_at, finished_at
     from jobs
     where id = $1::uuid
     limit 1${forUpdate ? " for update" : ""}`,
    [id]
  );

  return normalizeJobRow(q.rows?.[0] || null);
}

export async function dbGetLatestJobByProposalAndType(
  db,
  proposalId,
  type,
  { forUpdate = false } = {}
) {
  const q = await db.query(
    `select id, tenant_id, tenant_key, proposal_id, type, status, input, output, error, created_at, started_at, finished_at
     from jobs
     where proposal_id = $1::uuid
       and type = $2::text
     order by created_at desc
     limit 1${forUpdate ? " for update" : ""}`,
    [proposalId, type]
  );

  return normalizeJobRow(q.rows?.[0] || null);
}

export async function dbCreateJob(db, {
  tenantId = null,
  tenantKey = null,
  proposalId = null,
  type = "generic",
  status = "queued",
  input = {},
}) {
  const q = await db.query(
    `insert into jobs (tenant_id, tenant_key, proposal_id, type, status, input)
     values ($1::uuid, $2::text, $3::uuid, $4::text, $5::text, $6::jsonb)
     returning id, tenant_id, tenant_key, proposal_id, type, status, input, output, error, created_at, started_at, finished_at`,
    [
      tenantId || null,
      clean(tenantKey) || null,
      proposalId || null,
      type,
      status,
      deepFix(input),
    ]
  );

  return normalizeJobRow(q.rows?.[0] || null);
}

export async function dbUpdateJob(db, id, patch) {
  const status = patch?.status ?? null;
  const output = patch?.output ?? null;
  const error = patch?.error ?? null;
  const started = patch?.started_at ?? null;
  const finished = patch?.finished_at ?? null;

  const q = await db.query(
    `update jobs
     set status = coalesce($2::text, status),
         output = case when $3::jsonb is null then output else (coalesce(output,'{}'::jsonb) || $3::jsonb) end,
         error = coalesce($4::text, error),
         started_at = case when $5::timestamptz is null then started_at else $5::timestamptz end,
         finished_at = case when $6::timestamptz is null then finished_at else $6::timestamptz end
     where id = $1::uuid
     returning id, tenant_id, tenant_key, proposal_id, type, status, input, output, error, created_at, started_at, finished_at`,
    [
      id,
      status,
      output ? deepFix(output) : output,
      error ? fixText(String(error)) : error,
      started,
      finished,
    ]
  );

  return normalizeJobRow(q.rows?.[0] || null);
}
