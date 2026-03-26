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

import { dbUpdateJob, dbCreateJob } from "../../../db/helpers/jobs.js";
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
import { enqueueVoiceSyncExecution } from "../../../services/durableExecutionService.js";
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
  return row && typeof row === "object"
    ? {
        ...row,
        payload_summary:
          row.payload_summary && typeof row.payload_summary === "object"
            ? row.payload_summary
            : {},
        safe_metadata:
          row.safe_metadata && typeof row.safe_metadata === "object"
            ? row.safe_metadata
            : {},
        correlation_ids:
          row.correlation_ids && typeof row.correlation_ids === "object"
            ? row.correlation_ids
            : {},
      }
    : null;
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

    const attempts = await helpers.listAttempts(id);
    const auditTrail = await helpers.listExecutionAuditTrail(id, {
      tenantId,
      tenantKey,
      limit: 20,
    });

    return okJson(res, {
      ok: true,
      execution: normalizeDurableExecutionRow(execution),
      attempts,
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

export async function retryDurableExecution(req, res, { db }) {
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

    const execution = await helpers.getExecutionById(id);
    if (!execution) return okJson(res, { ok: false, error: "not found" });

    if (
      (tenantId && String(execution.tenant_id || "") !== tenantId) ||
      (!tenantId && tenantKey && String(execution.tenant_key || "").toLowerCase() !== tenantKey.toLowerCase())
    ) {
      return okJson(res, { ok: false, error: "not found" });
    }

    const retried = await helpers.retryExecution({
      executionId: id,
      reason: "manual_retry",
    });

    if (!retried) {
      return okJson(res, {
        ok: false,
        error: "execution_not_retryable",
      });
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
    const patch = {
      status,
      output: deepFix({ result }),
      error: errorText,
      finished_at,
    };

    if (!isDbReady(db)) {
      return serviceUnavailableJson(
        res,
        "database unavailable; execution callbacks cannot mutate runtime state"
      );
    }

    return await handleExecutionCallbackDb({
      req,
      res,
      db,
      wsHub,
      jobId,
      status,
      result,
      errorText,
      finished_at,
      patch,
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
  res,
  db,
  wsHub,
  jobId,
  status,
  result,
  errorText,
  finished_at,
  patch,
}) {
  const jobRow = await dbUpdateJob(db, jobId, patch);
  if (!jobRow) return okJson(res, { ok: false, error: "job not found" });

  const jt = jobTypeLc(jobRow.type);
  const tenantId = pickTenantIdFromResult(result);
  const tenantKey =
    clean(jobRow.tenant_key || result?.tenantKey || result?.tenant_key || "") ||
    null;
  const jobInput = deepFix(jobRow.input || {});
  const proposalId =
    String(jobRow.proposal_id || result?.proposalId || result?.proposal_id || "").trim() ||
    null;
  const automation = pickAutomationMeta(result, jobInput);

  const incomingPack = mergePackAssets(result);
  const publishInfo = pickPublishInfo(result);

  let contentRow = null;
  let proposalRow = null;
  let nextJob = null;

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

          notifyN8n(buildWorkflowEventByJobType(nextJobType), proposalRow, {
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
          });

          if (
            nextJob &&
            ["voice.generate", "video.generate", "assembly.render", "qa.check"].includes(
              String(nextJob.type || "").trim().toLowerCase()
            )
          ) {
            runMediaJobNow({ db, jobId: nextJob.id }).catch((e) => {
              console.error("[media-runner] start failed:", String(e?.message || e));
            });
          }

          wsHub?.broadcast?.({
            type: "execution.updated",
            execution: nextJob,
          });
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

          notifyN8n("content.publish", proposalRow, {
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
          });

          wsHub?.broadcast?.({
            type: "execution.updated",
            execution: publishJob,
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

  wsHub?.broadcast?.({ type: "execution.updated", execution: jobRow });
  wsHub?.broadcast?.({
    type: "notification.created",
    notification: notif,
  });
  if (contentRow) {
    wsHub?.broadcast?.({ type: "content.updated", content: contentRow });
  }

  const pushCopy = buildPushCopy(status, jt, errorText);
  await pushBroadcastToCeo({
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
  });

  await dbAudit(db, "n8n", "execution.callback", "job", jobId, {
    status,
    jobType: jt,
    automationMode: automation.mode,
    nextJobType: nextJob?.type || null,
  });

  return okJson(res, {
    ok: true,
    jobId,
    status,
    jobType: jt,
    proposalId,
    contentId: contentRow?.id || null,
    nextJobId: nextJob?.id || null,
    nextJobType: nextJob?.type || null,
  });
}
