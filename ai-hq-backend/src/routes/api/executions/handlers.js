import crypto from "crypto";
import {
  validateDurableVoiceSyncRequest,
  validateRuntimeIncidentRequest,
} from "@aihq/shared-contracts/critical";

import {
  okJson,
  clamp,
  isDbReady,
  isUuid,
  serializeError,
  nowIso,
  serviceUnavailableJson,
} from "../../../utils/http.js";
import { deepFix, fixText } from "../../../utils/textFix.js";
import {
  getAuthTenantId,
  getAuthTenantKey,
  getCallbackTokenAuthResult,
  getAuthActor,
} from "../../../utils/auth.js";
import { createDurableExecutionHelpers } from "../../../db/helpers/durableExecutions.js";
import {
  buildDurableOperationalStatus,
  getMetricsSnapshot,
} from "../../../observability/runtimeSignals.js";

import { dbGetJobById, dbUpdateJob, dbCreateJob } from "../../../db/helpers/jobs.js";
import {
  dbGetProposalById,
  dbSetProposalStatus,
} from "../../../db/helpers/proposals.js";
import {
  dbUpsertDraftFromCallback,
  dbGetLatestContentByProposal,
  dbUpdateContentItem,
} from "../../../db/helpers/content.js";
import { dbCreateNotification } from "../../../db/helpers/notifications.js";
import { dbAudit } from "../../../db/helpers/audit.js";

import { pushBroadcastToCeo } from "../../../services/pushBroadcast.js";
import { notifyN8n } from "../../../services/n8nNotify.js";
import { runMediaJobNow } from "../../../services/media/mediaExecutionRunner.js";
import {
  enqueueVoiceSyncExecution,
  requeueMetaCommentReplyExecution,
} from "../../../services/durableExecutionService.js";
import { persistRuntimeIncident } from "../../../services/runtimeIncidentTrail.js";

import {
  clean,
  pickJobId,
  normalizeStatus,
  pickTenantIdFromResult,
  pickThreadId,
  pickContentId,
  jobTypeLc,
  isCompleted,
  pickAutomationMeta,
  pickAssetUrl,
  pickCaption,
  isDraftJobType,
  isAssetJobType,
  isPublishJobType,
  isVoiceJobType,
  isSceneJobType,
  isRenderJobType,
  isQaJobType,
  buildNextJobInput,
  pickNextJobTypeAfter,
  mergePackAssets,
  pickPublishInfo,
  pickVideoInfo,
  pickImageInfo,
  mergeContentPack,
  enrichContentPackForJobType,
} from "./utils.js";

import {
  dbFindContentItemById,
  resolveDbContentRowForUpdate,
} from "./repository.js";

import {
  patchStatusForJobType,
  queuedContentStatusForNextJobType,
  buildWorkflowEventByJobType,
} from "./status.js";

import { buildNotificationCopy, buildPushCopy } from "./notify.js";

function normalizeDurableExecutionRow(row = {}) {
  if (!row || typeof row !== "object") return null;

  const payloadSummary =
    row.payload_summary && typeof row.payload_summary === "object"
      ? row.payload_summary
      : {};
  const safeMetadata =
    row.safe_metadata && typeof row.safe_metadata === "object"
      ? row.safe_metadata
      : {};
  const correlationIds =
    row.correlation_ids && typeof row.correlation_ids === "object"
      ? row.correlation_ids
      : {};

  const actionType = fixText(String(row.action_type || ""));
  const status = fixText(String(row.status || ""));
  const commentReply =
    actionType === "meta.comment.reply"
      ? {
          commentId: fixText(
            String(
              safeMetadata.commentId ||
                correlationIds.commentId ||
                row.target_id ||
                ""
            )
          ),
          externalCommentId: fixText(
            String(
              safeMetadata.externalCommentId ||
                correlationIds.externalCommentId ||
                ""
            )
          ),
          externalPostId: fixText(
            String(
              safeMetadata.externalPostId ||
                correlationIds.externalPostId ||
                row.conversation_id ||
                ""
            )
          ),
          externalUserId: fixText(String(safeMetadata.externalUserId || "")),
          actor: fixText(String(safeMetadata.actor || "")),
          approved: safeMetadata.approved !== false,
          replyText: fixText(String(safeMetadata.replyText || "")),
        }
      : null;

  const lastError =
    row.last_error_code || row.last_error_message || row.last_error_classification
      ? {
          code: fixText(String(row.last_error_code || "")),
          message: fixText(String(row.last_error_message || "")),
          classification: fixText(String(row.last_error_classification || "")),
        }
      : null;

  return {
    ...row,
    payload_summary: payloadSummary,
    safe_metadata: safeMetadata,
    correlation_ids: correlationIds,
    execution_type: actionType,
    durable_status: status,
    target: {
      type: fixText(String(row.target_type || "")),
      targetId: fixText(String(row.target_id || "")),
      threadId: fixText(String(row.thread_id || "")),
      conversationId: fixText(String(row.conversation_id || "")),
      messageId: fixText(String(row.message_id || "")),
    },
    retry_state: {
      isRetryable: status === "retryable",
      isDeadLettered: status === "dead_lettered",
      isTerminal: status === "terminal",
      nextRetryAt: row.next_retry_at || null,
      deadLetteredAt: row.dead_lettered_at || null,
      attemptCount: Number(row.attempt_count || 0),
      maxAttempts: Number(row.max_attempts || 0),
    },
    last_error: lastError,
    comment_reply: commentReply,
  };
}

function normalizeDurableExecutionAttempt(attempt = {}) {
  if (!attempt || typeof attempt !== "object") return null;

  const resultSummary =
    attempt.result_summary && typeof attempt.result_summary === "object"
      ? attempt.result_summary
      : {};
  const correlationIds =
    attempt.correlation_ids && typeof attempt.correlation_ids === "object"
      ? attempt.correlation_ids
      : {};

  return {
    ...attempt,
    result_summary: resultSummary,
    correlation_ids: correlationIds,
    result: {
      providerMessageId: fixText(String(resultSummary.providerMessageId || "")),
      gatewayStatus:
        Number.isFinite(Number(resultSummary.gatewayStatus))
          ? Number(resultSummary.gatewayStatus)
          : null,
      commentId: fixText(String(resultSummary.commentId || "")),
    },
  };
}

const TERMINAL_EXECUTION_STATUSES = new Set([
  "completed",
  "failed",
  "error",
  "canceled",
  "cancelled",
]);

function lower(v) {
  return clean(v).toLowerCase();
}

function isTerminalExecutionStatus(status = "") {
  return TERMINAL_EXECUTION_STATUSES.has(lower(status));
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function buildExecutionCallbackFingerprint({ status = "", result = {}, errorText = null } = {}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        deepFix({
          status: lower(status),
          result: deepFix(result || {}),
          error: errorText ? fixText(String(errorText)) : null,
        })
      )
    )
    .digest("hex");
}

function readExecutionCallbackControl(job = {}) {
  return obj(job?.output?.callbackControl);
}

function buildExecutionCallbackConflict({
  currentStatus = "",
  requestedStatus = "",
  reasonCode = "terminal_callback_conflict",
  fingerprint = "",
  currentFingerprint = "",
  jobType = "",
} = {}) {
  return {
    ok: false,
    statusCode: 409,
    error: "execution_callback_conflict",
    mutationOutcome: "rejected",
    details: {
      reasonCode,
      currentStatus: lower(currentStatus),
      requestedStatus: lower(requestedStatus),
      jobType: clean(jobType),
      fingerprint: clean(fingerprint),
      currentFingerprint: clean(currentFingerprint),
    },
  };
}

async function runExecutionCallbackTransaction(db, work) {
  if (!db?.query) {
    throw new Error("execution_db_unavailable");
  }

  const client = typeof db.connect === "function" ? await db.connect() : db;
  let began = false;

  try {
    await client.query("begin");
    began = true;
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    if (began) {
      try {
        await client.query("rollback");
      } catch {}
    }
    throw error;
  } finally {
    if (client !== db && typeof client?.release === "function") {
      client.release();
    }
  }
}

export async function enqueueVoiceSyncExecutionRequest(req, res, { db }) {
  try {
    if (!isDbReady(db)) {
      return serviceUnavailableJson(
        res,
        "database unavailable; durable voice sync requires persistent storage"
      );
    }

    const checked = validateDurableVoiceSyncRequest(req.body || {});
    if (!checked.ok) {
      return res.status(400).json({
        ok: false,
        error: checked.error,
      });
    }

    const execution = await enqueueVoiceSyncExecution({
      db,
      actionType: checked.value.actionType,
      tenantId: checked.value.tenantId,
      tenantKey: checked.value.tenantKey,
      providerCallSid:
        checked.value.payload?.providerCallSid || checked.value.payload?.callSid || "",
      payload: checked.value.payload,
      idempotencyKey: checked.value.idempotencyKey,
      correlationIds: checked.value.correlationIds,
    });

    return res.status(202).json({
      ok: true,
      accepted: true,
      execution: normalizeDurableExecutionRow(execution),
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "durable_voice_sync_enqueue_failed",
      details: serializeError(e),
    });
  }
}

export async function recordRuntimeIncidentRequest(req, res, { db }) {
  try {
    if (!isDbReady(db)) {
      return serviceUnavailableJson(
        res,
        "database unavailable; durable runtime incident trail requires persistent storage"
      );
    }

    const checked = validateRuntimeIncidentRequest(req.body || {});
    if (!checked.ok) {
      return res.status(400).json({
        ok: false,
        error: checked.error,
      });
    }

    const incident = await persistRuntimeIncident({
      db,
      incident: checked.value,
    });

    return res.status(202).json({
      ok: true,
      accepted: true,
      incident,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "runtime_incident_record_failed",
      details: serializeError(e),
    });
  }
}

export async function listExecutions(req, res, { db }) {
  const status = String(req.query.status || "").trim();
  const limit = clamp(req.query.limit ?? 50, 1, 200);
  const executionId = String(req.query.executionId || "").trim();
  const tenantId = String(getAuthTenantId(req) || "").trim();
  const tenantKey = String(getAuthTenantKey(req) || "").trim();

  try {
    if (!isDbReady(db)) {
      return serviceUnavailableJson(
        res,
        "database unavailable; execution state requires persistent storage"
      );
    }

    const where = [];
    const args = [];

    if (tenantId) {
      args.push(tenantId);
      where.push(`tenant_id = $${args.length}::uuid`);
    } else if (tenantKey) {
      args.push(tenantKey);
      where.push(`lower(tenant_key) = lower($${args.length}::text)`);
    } else {
      return okJson(res, { ok: false, error: "missing authenticated tenant context" });
    }

    if (executionId) {
      args.push(executionId);
      where.push(`id = $${args.length}::uuid`);
    }
    if (status) {
      args.push(status);
      where.push(`status = $${args.length}::text`);
    }

    const sqlWhere = where.length ? `where ${where.join(" and ")}` : "";
    const q = await db.query(
      `select id, tenant_id, tenant_key, proposal_id, type, status, input, output, error, created_at, started_at, finished_at
       from jobs
       ${sqlWhere}
       order by created_at desc
       limit ${limit}`,
      args
    );

    const rows = (q.rows || []).map((x) => ({
      ...x,
      input: deepFix(x.input),
      output: deepFix(x.output),
      error: x.error ? fixText(String(x.error)) : null,
    }));

    return okJson(res, { ok: true, executions: rows });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}

export async function getExecutionById(req, res, { db }) {
  const id = String(req.params.id || "").trim();
  const tenantId = String(getAuthTenantId(req) || "").trim();
  const tenantKey = String(getAuthTenantKey(req) || "").trim();
  if (!id) return okJson(res, { ok: false, error: "executionId required" });

  try {
    if (!isDbReady(db)) {
      return serviceUnavailableJson(
        res,
        "database unavailable; execution state requires persistent storage"
      );
    }

    const q = await db.query(
      `select id, tenant_id, tenant_key, proposal_id, type, status, input, output, error, created_at, started_at, finished_at
       from jobs
       where id = $1::uuid
         and (
           ($2::uuid is not null and tenant_id = $2::uuid)
           or ($2::uuid is null and lower(tenant_key) = lower($3::text))
         )
       limit 1`,
      [id, tenantId || null, tenantKey || ""]
    );

    const row = q.rows?.[0] || null;
    if (!row) return okJson(res, { ok: false, error: "not found" });

    row.input = deepFix(row.input);
    row.output = deepFix(row.output);
    row.error = row.error ? fixText(String(row.error)) : null;

    return okJson(res, { ok: true, execution: row });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}

export async function listDurableExecutions(req, res, { db }) {
  const helpers = createDurableExecutionHelpers({ db });
  const status = String(req.query.status || req.query.queue || "").trim();
  const actionType = String(req.query.actionType || req.query.type || "").trim();
  const limit = clamp(req.query.limit ?? 50, 1, 200);
  const tenantId = String(getAuthTenantId(req) || "").trim();
  const tenantKey = String(getAuthTenantKey(req) || "").trim();

  try {
    if (!isDbReady(db)) {
      return serviceUnavailableJson(
        res,
        "database unavailable; durable execution state requires persistent storage"
      );
    }

    const executions = await helpers.listExecutions({
      status,
      actionType,
      limit,
      tenantId,
      tenantKey,
    });

    return okJson(res, {
      ok: true,
      executions: executions.map(normalizeDurableExecutionRow),
    });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}

export async function getDurableExecutionSummary(req, res, { db }) {
  const helpers = createDurableExecutionHelpers({ db });
  const tenantId = String(getAuthTenantId(req) || "").trim();
  const tenantKey = String(getAuthTenantKey(req) || "").trim();
  const workerState = req.app?.locals?.durableExecutionWorker?.getState?.() || null;
  const sourceSyncWorkerState = req.app?.locals?.sourceSyncWorker?.getState?.() || null;

  try {
    if (!isDbReady(db)) {
      return serviceUnavailableJson(
        res,
        "database unavailable; durable execution state requires persistent storage"
      );
    }

    const summary = await helpers.getExecutionSummary({
      tenantId,
      tenantKey,
    });
    const operational = buildDurableOperationalStatus({
      summary,
      durableWorker: workerState,
      sourceSyncWorker: sourceSyncWorkerState,
    });

    return okJson(res, {
      ok: true,
      summary: {
        ...summary,
        worker: workerState,
        sourceSyncWorker: sourceSyncWorkerState,
        operational,
        metrics: getMetricsSnapshot(),
      },
    });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}

export async function getDurableExecutionById(req, res, { db }) {
  const helpers = createDurableExecutionHelpers({ db });
  const id = String(req.params.id || "").trim();
  const tenantId = String(getAuthTenantId(req) || "").trim();
  const tenantKey = String(getAuthTenantKey(req) || "").trim();

  if (!id) return okJson(res, { ok: false, error: "executionId required" });

  try {
    if (!isDbReady(db)) {
      return serviceUnavailableJson(
        res,
        "database unavailable; durable execution state requires persistent storage"
      );
    }

    const execution = await helpers.getExecutionById(id);
    if (!execution) return okJson(res, { ok: false, error: "not found" });

    if (
      (tenantId && String(execution.tenant_id || "") !== tenantId) ||
      (!tenantId && tenantKey && String(execution.tenant_key || "").toLowerCase() !== tenantKey.toLowerCase())
    ) {
      return okJson(res, { ok: false, error: "not found" });
    }

    const attempts = (await helpers.listAttempts(id)).map(normalizeDurableExecutionAttempt);
    const auditTrail = await helpers.listExecutionAuditTrail(id, {
      tenantId,
      tenantKey,
      limit: 20,
    });

    return okJson(res, {
      ok: true,
      execution: normalizeDurableExecutionRow(execution),
      attempts,
      latestAttempt: attempts[0] || null,
      auditTrail,
    });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}

export async function retryDurableExecution(req, res, { db, wsHub }) {
  const helpers = createDurableExecutionHelpers({ db });
  const id = String(req.params.id || "").trim();
  const tenantId = String(getAuthTenantId(req) || "").trim();
  const tenantKey = String(getAuthTenantKey(req) || "").trim();
  const actor = String(getAuthActor(req) || "system").trim();

  if (!id) return okJson(res, { ok: false, error: "executionId required" });

  try {
    if (!isDbReady(db)) {
      return serviceUnavailableJson(
        res,
        "database unavailable; durable execution retry requires persistent storage"
      );
    }

    await db.query("begin");
    const execution = await helpers.getExecutionById(id);
    if (!execution) {
      await db.query("rollback");
      return okJson(res, { ok: false, error: "not found" });
    }

    if (
      (tenantId && String(execution.tenant_id || "") !== tenantId) ||
      (!tenantId && tenantKey && String(execution.tenant_key || "").toLowerCase() !== tenantKey.toLowerCase())
    ) {
      await db.query("rollback");
      return okJson(res, { ok: false, error: "not found" });
    }

    const retried = await helpers.retryExecution({
      executionId: id,
      reason: "manual_retry",
    });

    if (!retried) {
      await db.query("rollback");
      return okJson(res, {
        ok: false,
        error: "execution_not_retryable",
      });
    }

    let comment = null;
    if (String(retried.action_type || "").trim().toLowerCase() === "meta.comment.reply") {
      const recovered = await requeueMetaCommentReplyExecution({
        db,
        wsHub,
        execution: retried,
        requestedBy: actor,
      });

      if (!recovered.ok) {
        await db.query("rollback");
        return okJson(res, {
          ok: false,
          error: "execution_retry_sync_failed",
          details: {
            code: recovered.errorCode,
            message: recovered.errorMessage,
          },
        });
      }

      comment = recovered.comment || null;
    }

    await dbAudit(db, actor, "durable_execution.manual_retry", "durable_execution", id, {
      tenantId: retried.tenant_id || tenantId || null,
      tenantKey: retried.tenant_key || tenantKey || null,
      executionId: id,
      previousStatus: execution.status,
      nextStatus: retried.status,
      requestedBy: actor,
      requestedAt: new Date().toISOString(),
    });

    await db.query("commit");

    req.log?.info?.("durable_execution.manual_retry", {
      executionId: id,
      tenantKey: retried.tenant_key || tenantKey,
      actor,
      previousStatus: execution.status,
      nextStatus: retried.status,
    });

    const auditTrail = await helpers.listExecutionAuditTrail(id, {
      tenantId,
      tenantKey,
      limit: 20,
    });

    return okJson(res, {
      ok: true,
      execution: normalizeDurableExecutionRow(retried),
      comment,
      auditTrail,
    });
  } catch (e) {
    try {
      await db.query("rollback");
    } catch {}
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}

export async function executionCallback(req, res, { db, wsHub }) {
  const callbackAuth = getCallbackTokenAuthResult(req);
  if (!callbackAuth.ok) {
    const status =
      callbackAuth.code === "callback_token_not_configured" ? 500 : 401;

    return res.status(status).json({
      ok: false,
      error:
        callbackAuth.code === "callback_token_not_configured"
          ? "CallbackAuthMisconfigured"
          : "Unauthorized",
      reason: callbackAuth.reason || "invalid callback token",
    });
  }

  const jobId = pickJobId(req);
  const status = normalizeStatus(req.body?.status);
  const result = deepFix(req.body?.result || req.body?.output || {});
  const errorText = req.body?.error ? fixText(String(req.body.error)) : null;

  if (!jobId) return okJson(res, { ok: false, error: "jobId required" });
  if (!isUuid(jobId)) {
    return okJson(res, { ok: false, error: "jobId must be uuid" });
  }
  if (!status) return okJson(res, { ok: false, error: "status required" });

  try {
    const finished_at = nowIso();

    if (!isDbReady(db)) {
      return serviceUnavailableJson(
        res,
        "database unavailable; execution callbacks cannot mutate runtime state"
      );
    }

    const callbackFingerprint = buildExecutionCallbackFingerprint({
      status,
      result,
      errorText,
    });

    const committed = await runExecutionCallbackTransaction(db, async (tx) =>
      handleExecutionCallbackDb({
        db: tx,
        jobId,
        status,
        result,
        errorText,
        finished_at,
        callbackFingerprint,
      })
    );

    for (const event of committed?.postCommit?.realtimeEvents || []) {
      wsHub?.broadcast?.(event);
    }

    for (const dispatch of committed?.postCommit?.n8nDispatches || []) {
      try {
        notifyN8n(dispatch.event, dispatch.proposal, dispatch.extra);
      } catch {}
    }

    for (const mediaJobId of committed?.postCommit?.mediaJobIds || []) {
      runMediaJobNow({ db, jobId: mediaJobId }).catch((e) => {
        console.error("[media-runner] start failed:", String(e?.message || e));
      });
    }

    if (committed?.postCommit?.push) {
      await pushBroadcastToCeo(committed.postCommit.push);
    }

    if (!committed?.ok) {
      return res.status(committed.statusCode || 500).json({
        ok: false,
        error: committed.error || "execution_callback_failed",
        mutationOutcome: clean(committed.mutationOutcome || "rejected"),
        details: committed.details || null,
      });
    }

    return okJson(res, {
      ok: true,
      mutationOutcome: clean(committed.mutationOutcome || "applied"),
      duplicate: committed.mutationOutcome === "ignored",
      ignored: committed.mutationOutcome === "ignored",
      jobId,
      status,
      jobType: committed.jobType,
      proposalId: committed.proposalId,
      contentId: committed.contentId,
      nextJobId: committed.nextJobId,
      nextJobType: committed.nextJobType,
    });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: serializeError(e),
    });
  }
}

async function handleExecutionCallbackDb({
  db,
  jobId,
  status,
  result,
  errorText,
  finished_at,
  callbackFingerprint,
}) {
  const existingJob = await dbGetJobById(db, jobId, { forUpdate: true });
  if (!existingJob) {
    return {
      ok: false,
      statusCode: 404,
      error: "job not found",
    };
  }

  const existingControl = readExecutionCallbackControl(existingJob);
  if (isTerminalExecutionStatus(existingJob.status)) {
    if (
      existingControl?.finalized === true &&
      lower(existingControl.finalStatus) === lower(status) &&
      clean(existingControl.fingerprint) === clean(callbackFingerprint)
    ) {
      await dbAudit(db, "n8n", "execution.callback.ignored", "job", jobId, {
        status,
        jobType: jobTypeLc(existingJob.type),
        reasonCode: "duplicate_terminal_callback",
      });

      return {
        ok: true,
        mutationOutcome: "ignored",
        jobType: jobTypeLc(existingJob.type),
        proposalId:
          clean(existingJob.proposal_id || result?.proposalId || result?.proposal_id || "") ||
          null,
        contentId:
          clean(
            existingControl?.contentId ||
              result?.contentId ||
              result?.content_id ||
              existingJob.input?.contentId ||
              existingJob.input?.content_id
          ) || null,
        nextJobId: clean(existingControl?.nextJobId) || null,
        nextJobType: clean(existingControl?.nextJobType) || null,
        postCommit: {},
      };
    }

    const conflict = buildExecutionCallbackConflict({
      currentStatus: existingJob.status,
      requestedStatus: status,
      reasonCode:
        existingControl?.finalized === true
          ? "terminal_callback_conflict"
          : "terminal_callback_unrecoverable",
      fingerprint: callbackFingerprint,
      currentFingerprint: existingControl?.fingerprint || "",
      jobType: existingJob.type,
    });

    await dbAudit(db, "n8n", "execution.callback.rejected", "job", jobId, {
      status,
      jobType: jobTypeLc(existingJob.type),
      reasonCode: conflict.details.reasonCode,
      currentStatus: conflict.details.currentStatus,
      requestedStatus: conflict.details.requestedStatus,
    });

    return conflict;
  }

  const jt = jobTypeLc(existingJob.type);
  const tenantId = pickTenantIdFromResult(result);
  const tenantKey =
    clean(existingJob.tenant_key || result?.tenantKey || result?.tenant_key || "") ||
    null;
  const jobInput = deepFix(existingJob.input || {});
  const proposalId =
    String(existingJob.proposal_id || result?.proposalId || result?.proposal_id || "").trim() ||
    null;
  const automation = pickAutomationMeta(result, jobInput);

  const incomingPack = mergePackAssets(result);
  const publishInfo = pickPublishInfo(result);

  let contentRow = null;
  let proposalRow = null;
  let nextJob = null;
  const postCommit = {
    realtimeEvents: [],
    n8nDispatches: [],
    mediaJobIds: [],
    push: null,
  };

  if (proposalId && incomingPack && isDraftJobType(jt)) {
    contentRow = await dbUpsertDraftFromCallback(db, {
      proposalId,
      threadId: pickThreadId(result, jobInput),
      jobId,
      status: patchStatusForJobType(jt, status),
      contentPack: enrichContentPackForJobType(incomingPack, jt, result),
    });
  }

  if (proposalId && isAssetJobType(jt) && !isPublishJobType(jt)) {
    const contentId = pickContentId(result, jobInput);
    const rowToUpdate = await resolveDbContentRowForUpdate(
      db,
      proposalId,
      contentId
    );

    if (rowToUpdate) {
      const merged = enrichContentPackForJobType(
        mergeContentPack(rowToUpdate.content_pack, incomingPack, result, jt),
        jt,
        result
      );

      contentRow = await dbUpdateContentItem(db, rowToUpdate.id, {
        status: patchStatusForJobType(jt, status),
        content_pack: merged,
      });

      if (status === "completed" && !isQaJobType(jt)) {
        await dbSetProposalStatus(
          db,
          String(proposalId),
          "approved",
          deepFix({
            assets: merged.assets || [],
            video: merged.video || null,
            imageUrl: merged.imageUrl || null,
            videoUrl: merged.videoUrl || null,
            thumbnailUrl: merged.thumbnailUrl || null,
            coverUrl: merged.coverUrl || null,
            voiceover: merged.voiceover || null,
            voiceoverUrl: merged.voiceoverUrl || null,
            renderUrl: merged.renderUrl || null,
            qa: merged.qa || null,
          })
        );
      }

      proposalRow = await dbGetProposalById(db, String(proposalId));

      if (proposalRow && contentRow && isCompleted(status)) {
        const nextJobType = pickNextJobTypeAfter(jt, merged, automation);

        if (nextJobType && !isPublishJobType(jt)) {
          nextJob = await dbCreateJob(db, {
            tenantId: tenantId || null,
            tenantKey: tenantKey || null,
            proposalId: proposalRow.id,
            type: nextJobType,
            status: "queued",
            input: buildNextJobInput({
              proposalId,
              threadId: contentRow.thread_id || proposalRow.thread_id || null,
              tenantId: tenantId || null,
              contentId: contentRow.id,
              contentPack: merged,
              currentResult: result,
              nextJobType,
              automation,
            }),
          });

          await dbUpdateContentItem(db, contentRow.id, {
            status: queuedContentStatusForNextJobType(nextJobType),
            job_id: nextJob?.id || contentRow.job_id,
          });

          contentRow = await dbFindContentItemById(db, contentRow.id);

          postCommit.n8nDispatches.push({
            event: buildWorkflowEventByJobType(nextJobType),
            proposal: proposalRow,
            extra: {
              tenantId: tenantId || null,
              tenantKey: tenantKey || null,
              proposalId: String(proposalId),
              threadId: String(proposalRow.thread_id || ""),
              contentId: String(contentRow?.id || rowToUpdate.id),
              jobId: nextJob?.id || null,
              contentPack: merged,
              automationMode: automation.mode,
              autoPublish: automation.autoPublish,
              callback: {
                url: "/api/executions/callback",
                tokenHeader: "x-webhook-token",
              },
            },
          });

          if (
            nextJob &&
            ["voice.generate", "video.generate", "assembly.render", "qa.check"].includes(
              String(nextJob.type || "").trim().toLowerCase()
            )
          ) {
            postCommit.mediaJobIds.push(nextJob.id);
          }
        } else if (
          proposalRow &&
          contentRow &&
          automation.mode === "full_auto" &&
          automation.autoPublish
        ) {
          const assetUrl = pickAssetUrl(result, merged);
          const caption = pickCaption(merged, result);

          const publishJob = await dbCreateJob(db, {
            tenantId: tenantId || null,
            tenantKey: tenantKey || null,
            proposalId: proposalRow.id,
            type: "publish",
            status: "queued",
            input: {
              contentId: contentRow.id,
              contentPack: merged,
              assetUrl,
              caption,
              format: merged?.format || result?.format || null,
              aspectRatio: merged?.aspectRatio || result?.aspectRatio || null,
              tenantId: tenantId || null,
              automationMode: "full_auto",
              autoPublish: true,
            },
          });

          nextJob = publishJob;

          await dbUpdateContentItem(db, contentRow.id, {
            status: "publish.requested",
            job_id: publishJob?.id || contentRow.job_id,
          });

          contentRow = await dbFindContentItemById(db, contentRow.id);

          postCommit.n8nDispatches.push({
            event: "content.publish",
            proposal: proposalRow,
            extra: {
              tenantId: tenantId || null,
              tenantKey: tenantKey || null,
              proposalId: String(proposalId),
              threadId: String(proposalRow.thread_id || ""),
              contentId: String(contentRow?.id || rowToUpdate.id),
              jobId: publishJob?.id || null,
              contentPack: merged,
              assetUrl,
              caption,
              automationMode: "full_auto",
              autoPublish: true,
              callback: {
                url: "/api/executions/callback",
                tokenHeader: "x-webhook-token",
              },
            },
          });
        }
      }
    }
  }

  if (proposalId && isPublishJobType(jt)) {
    const contentId = pickContentId(result, jobInput);
    const rowToUpdate =
      (contentId && isUuid(contentId)
        ? await dbFindContentItemById(db, contentId)
        : null) || (await dbGetLatestContentByProposal(db, proposalId));

    if (rowToUpdate) {
      const nextStatus = status === "completed" ? "published" : "publish.failed";

      contentRow = await dbUpdateContentItem(db, rowToUpdate.id, {
        status: nextStatus,
        publish: deepFix({ ...publishInfo, status, finished_at }),
      });

      if (status === "completed") {
        await dbSetProposalStatus(
          db,
          String(proposalId),
          "published",
          deepFix({ publish: publishInfo })
        );
      }
    }
  }

  const jobRow = await dbUpdateJob(db, jobId, {
    status,
    output: deepFix({
      result,
      callbackControl: {
        finalized: true,
        finalStatus: status,
        fingerprint: callbackFingerprint,
        appliedAt: finished_at,
        contentId: contentRow?.id || null,
        nextJobId: nextJob?.id || null,
        nextJobType: nextJob?.type || null,
      },
    }),
    error: errorText,
    finished_at,
  });
  if (!jobRow) {
    return {
      ok: false,
      statusCode: 404,
      error: "job not found",
    };
  }

  const notifCopy = buildNotificationCopy(status, jt, errorText);
  const notif = await dbCreateNotification(db, {
    recipient: "ceo",
    type: notifCopy.type,
    title: notifCopy.title,
    body: notifCopy.body,
    payload: deepFix({
      jobId,
      status,
      proposalId,
      contentId: contentRow?.id || null,
      publish: publishInfo,
      video: pickVideoInfo(result),
      image: pickImageInfo(result),
      automationMode: automation.mode,
      nextJobId: nextJob?.id || null,
      nextJobType: nextJob?.type || null,
    }),
  });

  postCommit.realtimeEvents.push({ type: "execution.updated", execution: jobRow });
  if (nextJob) {
    postCommit.realtimeEvents.push({
      type: "execution.updated",
      execution: nextJob,
    });
  }
  if (notif) {
    postCommit.realtimeEvents.push({
      type: "notification.created",
      notification: notif,
    });
  }
  if (contentRow) {
    postCommit.realtimeEvents.push({ type: "content.updated", content: contentRow });
  }

  const pushCopy = buildPushCopy(status, jt, errorText);
  postCommit.push = {
    db,
    title: pushCopy.title,
    body: pushCopy.body,
    data: {
      type: "execution",
      jobId,
      proposalId,
      jobType: jt,
      nextJobId: nextJob?.id || null,
      nextJobType: nextJob?.type || null,
    },
  };

  await dbAudit(db, "n8n", "execution.callback", "job", jobId, {
    status,
    jobType: jt,
    automationMode: automation.mode,
    nextJobType: nextJob?.type || null,
    mutationOutcome: "applied",
  });

  return {
    ok: true,
    mutationOutcome: "applied",
    jobId,
    status,
    jobType: jt,
    proposalId,
    contentId: contentRow?.id || null,
    nextJobId: nextJob?.id || null,
    nextJobType: nextJob?.type || null,
    postCommit,
  };
}
