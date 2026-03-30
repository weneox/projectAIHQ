import { okJson, isDbReady, isUuid, nowIso } from "../../../utils/http.js";

import { pushBroadcastToCeo } from "../../../services/pushBroadcast.js";
import { notifyN8n } from "../../../services/n8nNotify.js";
import { dbGetJobById, dbUpdateJob } from "../../../db/helpers/jobs.js";
import {
  buildRuntimeAuthorityFailurePayload,
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { buildContentBehaviorProfile } from "../../../services/contentBehaviorRuntime.js";
import { kernelHandle } from "../../../kernel/agentKernel.js";

import {
  cleanLower,
  getAuthTenantKey,
  pickTenantId,
  pickRuntimeTenantId,
  pickActionActor,
  pickAutomationMeta,
  normalizeContentPack,
  packType,
  pickAspectRatio,
  pickVisualPreset,
  pickImagePrompt,
  pickVideoPrompt,
  pickVoiceoverText,
  pickNeededAssets,
  pickReelMeta,
  statusLc,
  isDraftReadyStatus,
  isAssetReadyStatus,
  isPublishRequestedStatus,
  isReelPack,
  pickAssetGenerationEvent,
  pickAssetGenerationJobType,
} from "./utils.js";

import {
  pickFirstAssetUrl,
  pickThumbnailUrl,
  buildCaption,
  canPublishRow,
  collectAssetUrls,
} from "./assets.js";

import {
  buildAssetNotifyExtra,
  buildPublishNotifyExtra,
} from "./notify.js";

import {
  getLatestContentByProposal,
  getContentById,
  getProposalById,
  patchContentItem,
  createJob,
  createNotification,
  writeAudit,
} from "./repository.js";

import {
  canAnalyzeRow,
  buildAnalyzeTenant,
  buildAnalyzeExtra,
  buildAnalyzeBody,
  buildAnalyzeTitle,
} from "./analysis.js";

async function resolveContentRuntimeBehavior({
  db,
  tenantKey,
  tenantId,
  service,
  getRuntime = getTenantBrainRuntime,
}) {
  try {
    const runtime = await getRuntime({
      db,
      tenantId,
      tenantKey,
      authorityMode: "strict",
    });

    return {
      ok: true,
      runtime,
      runtimeBehavior: buildContentBehaviorProfile(runtime),
    };
  } catch (error) {
    if (isRuntimeAuthorityError(error)) {
      return {
        ok: false,
        response: buildRuntimeAuthorityFailurePayload(error, {
          service,
          tenantKey,
          tenantId,
        }),
      };
    }
    throw error;
  }
}

function cleanText(v, fallback = "") {
  const value = String(v ?? fallback).trim();
  return value || String(fallback ?? "").trim();
}

function buildDispatchControl(job, dispatch, { event = "", actor = "" } = {}) {
  const ts = new Date().toISOString();
  return {
    localQueuedAt: job?.created_at || null,
    localStatus: "queued",
    dispatchState: dispatch?.dispatchOutcome || "failed",
    dispatchAttempted: dispatch?.attempted === true,
    externalAccepted: dispatch?.accepted === true,
    dispatchAttemptedAt: ts,
    dispatchFinishedAt: ts,
    event: cleanText(dispatch?.mappedEvent || event),
    action: cleanText(dispatch?.action || event),
    workflowHint: cleanText(dispatch?.workflowHint),
    webhookUrl: cleanText(dispatch?.webhookUrl),
    statusCode:
      Number.isFinite(Number(dispatch?.statusCode)) ? Number(dispatch.statusCode) : null,
    reasonCode: cleanText(dispatch?.reasonCode),
    error: cleanText(dispatch?.error),
    correlationId: cleanText(dispatch?.correlationId),
    requestActor: cleanText(actor),
  };
}

function getJobStatusForDispatch(dispatch = {}) {
  if (dispatch?.accepted === true) return "queued";
  if (dispatch?.dispatchOutcome === "skipped") return "dispatch_skipped";
  return "dispatch_failed";
}

async function persistDispatchTruth({
  db,
  job,
  dispatch,
  event,
  actor,
}) {
  return dbUpdateJob(db, job?.id, {
    status: getJobStatusForDispatch(dispatch),
    output: {
      dispatchControl: buildDispatchControl(job, dispatch, {
        event,
        actor,
      }),
    },
    error:
      dispatch?.accepted === true
        ? null
        : cleanText(dispatch?.error || dispatch?.reasonCode || "external dispatch failed"),
  });
}

function buildDispatchNotification({
  acceptedTitle,
  acceptedBody,
  skippedTitle,
  skippedBody,
  failedTitle,
  failedBody,
  payload,
  dispatch,
}) {
  if (dispatch?.accepted === true) {
    return {
      recipient: "ceo",
      type: "info",
      title: acceptedTitle,
      body: acceptedBody,
      payload: { ...payload, dispatch },
    };
  }

  if (dispatch?.dispatchOutcome === "skipped") {
    return {
      recipient: "ceo",
      type: "error",
      title: skippedTitle,
      body: skippedBody,
      payload: { ...payload, dispatch },
    };
  }

  return {
    recipient: "ceo",
    type: "error",
    title: failedTitle,
    body: failedBody,
    payload: { ...payload, dispatch },
  };
}

function normalizeAttemptMode(mode = "initial") {
  return cleanText(mode || "initial").toLowerCase() === "retry" ? "retry" : "initial";
}

function buildAttemptAwareDispatchCopy({
  attemptMode = "initial",
  acceptedTitle,
  acceptedBody,
  skippedTitle,
  skippedBody,
  failedTitle,
  failedBody,
  retryAcceptedTitle,
  retryAcceptedBody,
  retrySkippedTitle,
  retrySkippedBody,
  retryFailedTitle,
  retryFailedBody,
}) {
  const normalizedAttemptMode = normalizeAttemptMode(attemptMode);
  const isRetry = normalizedAttemptMode === "retry";
  return {
    attemptMode: normalizedAttemptMode,
    acceptedTitle: isRetry ? retryAcceptedTitle : acceptedTitle,
    acceptedBody: isRetry ? retryAcceptedBody : acceptedBody,
    skippedTitle: isRetry ? retrySkippedTitle : skippedTitle,
    skippedBody: isRetry ? retrySkippedBody : skippedBody,
    failedTitle: isRetry ? retryFailedTitle : failedTitle,
    failedBody: isRetry ? retryFailedBody : failedBody,
  };
}

function lowerText(v) {
  return cleanText(v).toLowerCase();
}

function buildTenantTruthFailure({
  service = "",
  requestTenantId = null,
  requestTenantKey = "",
  authorityTenantId = null,
  authorityTenantKey = "",
  proposalId = null,
  contentId = null,
  reasonCode = "tenant_truth_unavailable",
  message = "",
} = {}) {
  return {
    ok: false,
    error:
      reasonCode === "tenant_truth_mismatch"
        ? "tenant_truth_mismatch"
        : "tenant_truth_unavailable",
    details: {
      service,
      message:
        message ||
        (reasonCode === "tenant_truth_mismatch"
          ? "Request tenant context does not match authoritative content/proposal tenant truth."
          : "Authoritative content/proposal tenant truth is unavailable for orchestration."),
      reasonCode,
      proposalId: proposalId || null,
      contentId: contentId || null,
      requestTenantId: requestTenantId || null,
      requestTenantKey: cleanText(requestTenantKey),
      authorityTenantId: authorityTenantId || null,
      authorityTenantKey: cleanText(authorityTenantKey),
    },
  };
}

function resolveAuthoritativeContentTenantContext({
  service = "",
  requestTenantId = null,
  requestTenantKey = "",
  proposal = null,
  content = null,
}) {
  const authorityTenantId = cleanText(proposal?.tenant_id || proposal?.tenantId, "");
  const authorityTenantKey = lowerText(proposal?.tenant_key || proposal?.tenantKey);
  const normalizedRequestTenantId = cleanText(requestTenantId, "");
  const normalizedRequestTenantKey = lowerText(requestTenantKey);

  if (!authorityTenantId || !authorityTenantKey) {
    return {
      ok: false,
      statusCode: 409,
      payload: buildTenantTruthFailure({
        service,
        requestTenantId: normalizedRequestTenantId || null,
        requestTenantKey: normalizedRequestTenantKey,
        authorityTenantId: authorityTenantId || null,
        authorityTenantKey,
        proposalId: proposal?.id || content?.proposal_id || null,
        contentId: content?.id || null,
        reasonCode: "tenant_truth_unavailable",
      }),
    };
  }

  const idMismatch =
    normalizedRequestTenantId && normalizedRequestTenantId !== authorityTenantId;
  const keyMismatch =
    normalizedRequestTenantKey && normalizedRequestTenantKey !== authorityTenantKey;

  if (idMismatch || keyMismatch) {
    return {
      ok: false,
      statusCode: 409,
      payload: buildTenantTruthFailure({
        service,
        requestTenantId: normalizedRequestTenantId || null,
        requestTenantKey: normalizedRequestTenantKey,
        authorityTenantId,
        authorityTenantKey,
        proposalId: proposal?.id || content?.proposal_id || null,
        contentId: content?.id || null,
        reasonCode: "tenant_truth_mismatch",
      }),
    };
  }

  return {
    ok: true,
    tenantId: authorityTenantId,
    tenantKey: authorityTenantKey,
  };
}

const RETRYABLE_DISPATCH_JOB_STATUSES = new Set([
  "dispatch_failed",
  "dispatch_skipped",
  "failed",
  "error",
  "canceled",
]);

const COMPLETED_DISPATCH_JOB_STATUSES = new Set(["completed"]);

function readDispatchReplayControl(job = {}) {
  return job?.output?.dispatchReplayControl && typeof job.output.dispatchReplayControl === "object"
    ? { ...job.output.dispatchReplayControl }
    : {};
}

function buildDispatchReplayControl({
  action = "",
  actor = "",
  attemptMode = "initial",
  previousJob = null,
  replayGroup = "",
} = {}) {
  return {
    action: cleanText(action),
    replayGroup: cleanText(replayGroup),
    attemptMode,
    previousJobId: previousJob?.id || null,
    previousJobStatus: cleanText(previousJob?.status),
    replayRequestedAt: new Date().toISOString(),
    replayRequestedBy: cleanText(actor),
  };
}

async function rejectContentReplayAttempt({
  db,
  existingJob,
  actor,
  action,
  reasonCode,
}) {
  const replayControl = {
    ...readDispatchReplayControl(existingJob),
    replayPrevented: true,
    replayRejectedAt: new Date().toISOString(),
    replayRejectedBy: cleanText(actor),
    replayRejectReasonCode: cleanText(reasonCode),
    replayAction: cleanText(action),
  };

  return dbUpdateJob(db, existingJob?.id, {
    output: {
      dispatchReplayControl: replayControl,
    },
  });
}

async function getJobIfPresent(db, id) {
  if (!id) return null;
  return dbGetJobById(db, id);
}

async function evaluateReplayAttempt({
  db,
  linkedJobId,
  actor,
  action,
  replayGroup,
}) {
  const existingJob = await getJobIfPresent(db, linkedJobId);
  if (!existingJob) {
    return { ok: true, previousJob: null, attemptMode: "initial" };
  }

  const status = cleanText(existingJob.status).toLowerCase();
  if (RETRYABLE_DISPATCH_JOB_STATUSES.has(status)) {
    return { ok: true, previousJob: existingJob, attemptMode: "retry" };
  }

  const reasonCode = COMPLETED_DISPATCH_JOB_STATUSES.has(status)
    ? "dispatch_attempt_already_completed"
    : "dispatch_attempt_already_open";
  const persistedJob = await rejectContentReplayAttempt({
    db,
    existingJob,
    actor,
    action,
    reasonCode,
  });

  return {
    ok: false,
    statusCode: 409,
    payload: {
      ok: false,
      error: "dispatch_attempt_conflict",
      mutationOutcome: "rejected",
      execution: persistedJob || existingJob,
      details: {
        action: cleanText(action),
        reasonCode,
        replayGroup: cleanText(replayGroup),
        existingJobId: existingJob.id,
        existingJobStatus: existingJob.status,
      },
    },
  };
}

export async function getContentHandler(req, res, { db }) {
  const proposalId = String(req.query.proposalId || "").trim();

  if (!proposalId) {
    return okJson(res, { ok: false, error: "proposalId required" });
  }
  if (!isUuid(proposalId)) {
    return okJson(res, { ok: false, error: "proposalId must be uuid" });
  }

  try {
    const dbReady = isDbReady(db);
    const row = await getLatestContentByProposal({ db, proposalId, dbReady });

    return okJson(res, {
      ok: true,
      proposalId,
      content: row,
      ...(dbReady ? {} : { dbDisabled: true }),
    });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}

export async function feedbackHandler(
  req,
  res,
  {
    db,
    wsHub,
    dispatchWorkflow = notifyN8n,
    resolveRuntimeBehavior = resolveContentRuntimeBehavior,
  } = {}
) {
  const id = String(req.params.id || "").trim();
  const requestTenantKey = getAuthTenantKey(req) || cleanLower(pickTenantId(req));
  const requestTenantId = cleanText(req.auth?.tenantId || req.auth?.tenant_id, "");
  const feedbackText = String(req.body?.feedbackText || req.body?.feedback || "").trim();
  const actor = pickActionActor(req, "ceo");
  const automation = pickAutomationMeta(req);
  const dbReady = isDbReady(db);

  if (!id) return okJson(res, { ok: false, error: "contentId required" });
  if (!feedbackText) return okJson(res, { ok: false, error: "feedbackText required" });
  if (dbReady && !isUuid(id)) {
    return okJson(res, { ok: false, error: "contentId must be uuid" });
  }

  try {
    const current = await getContentById({ db, id, dbReady });
    if (!current) {
      return okJson(res, {
        ok: false,
        error: "content not found",
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    const proposal = await getProposalById({
      db,
      proposalId: current.proposal_id,
      dbReady,
    });

    const tenantContext = resolveAuthoritativeContentTenantContext({
      service: "content.revise",
      requestTenantId,
      requestTenantKey,
      proposal,
      content: current,
    });
    if (!tenantContext.ok) {
      return res.status(tenantContext.statusCode).json(tenantContext.payload);
    }

    const replayAttempt = await evaluateReplayAttempt({
      db,
      linkedJobId: current.job_id,
      actor,
      action: "content.revise",
      replayGroup: `content.revise:${current.id}`,
    });
    if (!replayAttempt.ok) {
      return res.status(replayAttempt.statusCode).json(replayAttempt.payload);
    }

    const updated = await patchContentItem({
      db,
      id,
      patch: {
        status: "draft.regenerating",
        last_feedback: feedbackText,
      },
      dbReady,
    });

    const runtimeResolved = await resolveRuntimeBehavior({
      db,
      tenantKey: tenantContext.tenantKey,
      tenantId: tenantContext.tenantId,
      service: "content.revise",
    });
    if (!runtimeResolved.ok) {
      return okJson(res, runtimeResolved.response);
    }

    const job = await createJob({
      db,
      dbReady,
      input: {
        tenantId: tenantContext.tenantId,
        tenantKey: tenantContext.tenantKey,
        proposalId: current.proposal_id,
        type: "draft.regen",
        status: "queued",
        createdAt: nowIso(),
        input: {
          contentId: updated?.id || current.id,
          proposalId: current.proposal_id,
          feedbackText,
          tenantKey: tenantContext.tenantKey,
          tenantId: tenantContext.tenantId,
          automationMode: automation.mode,
          autoPublish: automation.autoPublish,
        },
      },
    });

    const replayTaggedJob = await dbUpdateJob(db, job?.id, {
      output: {
        dispatchReplayControl: buildDispatchReplayControl({
          action: "content.revise",
          actor,
          attemptMode: replayAttempt.attemptMode,
          previousJob: replayAttempt.previousJob,
          replayGroup: `content.revise:${current.id}`,
        }),
      },
    });
    const attemptMode = replayAttempt.attemptMode;
    const dispatchCopy = buildAttemptAwareDispatchCopy({
      attemptMode,
      acceptedTitle: "Draft dispatch accepted",
      acceptedBody: "Local draft revision job queued and external revise workflow accepted.",
      skippedTitle: "Draft queued locally",
      skippedBody: "Local draft revision job was queued, but external dispatch was skipped.",
      failedTitle: "Draft dispatch failed",
      failedBody: "Local draft revision job was queued, but external dispatch failed.",
      retryAcceptedTitle: "Draft retry dispatch accepted",
      retryAcceptedBody: "Local draft retry job queued and external revise workflow accepted.",
      retrySkippedTitle: "Draft retry queued locally",
      retrySkippedBody: "Local draft retry job was queued, but external dispatch was skipped.",
      retryFailedTitle: "Draft retry dispatch failed",
      retryFailedBody: "Local draft retry job was queued, but external dispatch failed.",
    });

    await patchContentItem({
      db,
      id: updated?.id || current.id,
      patch: {
        job_id: job?.id || current.job_id,
      },
      dbReady,
    });

    const dispatch = proposal
      ? await dispatchWorkflow("content.revise", proposal, {
          tenantKey: tenantContext.tenantKey,
          tenantId: tenantContext.tenantId,
          proposalId: String(proposal.id),
          threadId: String(proposal.thread_id || proposal.threadId || ""),
          jobId: job?.id || null,
          contentId: String(updated?.id || current.id),
          feedbackText,
          automationMode: automation.mode,
          autoPublish: automation.autoPublish,
          contentPack: normalizeContentPack(updated?.content_pack || current.content_pack) || {},
          runtimeBehavior: runtimeResolved.runtimeBehavior,
          callback: { url: "/api/executions/callback", tokenHeader: "x-webhook-token" },
        })
      : {
          attempted: false,
          accepted: false,
          dispatchOutcome: "skipped",
          reasonCode: "proposal_not_found",
          error: "proposal not found for dispatch",
        };

    const dispatchedJob = await persistDispatchTruth({
      db,
      job,
      dispatch,
      event: "content.revise",
      actor,
    });

    const notif = await createNotification({
      db,
      dbReady,
      input: buildDispatchNotification({
        acceptedTitle: dispatchCopy.acceptedTitle,
        acceptedBody: dispatchCopy.acceptedBody,
        skippedTitle: dispatchCopy.skippedTitle,
        skippedBody: dispatchCopy.skippedBody,
        failedTitle: dispatchCopy.failedTitle,
        failedBody: dispatchCopy.failedBody,
        payload: {
          contentId: id,
          proposalId: current.proposal_id,
          jobId: job?.id || null,
          automationMode: automation.mode,
          attemptMode,
          retryOfJobId: replayAttempt.previousJob?.id || null,
        },
        dispatch,
      }),
    });

    const refreshed = await getContentById({ db, id, dbReady });

    wsHub?.broadcast?.({ type: "content.updated", content: refreshed || updated || current });
    if (job) wsHub?.broadcast?.({ type: "execution.updated", execution: dispatchedJob || job });
    if (notif) wsHub?.broadcast?.({ type: "notification.created", notification: notif });

    if (dbReady) {
      await pushBroadcastToCeo({
        db,
        title:
          dispatch?.accepted === true
            ? dispatchCopy.acceptedTitle
            : dispatch?.dispatchOutcome === "skipped"
              ? dispatchCopy.skippedTitle
              : dispatchCopy.failedTitle,
        body:
          dispatch?.accepted === true
            ? dispatchCopy.acceptedBody
            : dispatch?.dispatchOutcome === "skipped"
              ? dispatchCopy.skippedBody
              : dispatchCopy.failedBody,
        data: {
          type: "draft.regen",
          contentId: id,
          proposalId: current.proposal_id,
          jobId: job?.id || null,
          automationMode: automation.mode,
          attemptMode,
          retryOfJobId: replayAttempt.previousJob?.id || null,
          dispatch,
        },
      });
    }

    await writeAudit({
      db,
      dbReady,
      actor,
      action: "content.feedback",
      entityType: "content",
      entityId: id,
      meta: {
        proposalId: current.proposal_id,
        jobId: job?.id || null,
        automationMode: automation.mode,
        dispatchAttemptMode: attemptMode,
        retryOfJobId: replayAttempt.previousJob?.id || null,
        dispatchOutcome: dispatch?.dispatchOutcome || "failed",
        dispatchAccepted: dispatch?.accepted === true,
        dispatchReasonCode: dispatch?.reasonCode || null,
      },
    });

    return okJson(res, {
      ok: true,
      content: refreshed || updated || current,
      jobId: job?.id || null,
      dispatch: dispatch || null,
      execution: dispatchedJob || replayTaggedJob || job,
      ...(dbReady ? {} : { dbDisabled: true }),
    });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}
export async function approveHandler(
  req,
  res,
  {
    db,
    wsHub,
    dispatchWorkflow = notifyN8n,
    resolveRuntimeBehavior = resolveContentRuntimeBehavior,
  } = {}
) {
  const id = String(req.params.id || "").trim();
  const requestTenantKey = getAuthTenantKey(req) || cleanLower(pickTenantId(req));
  const requestTenantId = cleanText(req.auth?.tenantId || req.auth?.tenant_id, "");
  const actor = pickActionActor(req, "ceo");
  const automation = pickAutomationMeta(req);
  const dbReady = isDbReady(db);

  if (!id) return okJson(res, { ok: false, error: "contentId required" });
  if (dbReady && !isUuid(id)) {
    return okJson(res, { ok: false, error: "contentId must be uuid" });
  }

  try {
    const row = await getContentById({ db, id, dbReady });
    if (!row) {
      return okJson(res, {
        ok: false,
        error: "content not found",
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    const st = statusLc(row.status);

    if (isPublishRequestedStatus(st)) {
      return okJson(res, {
        ok: false,
        error: "publish already requested",
        status: row.status,
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    if (
      isAssetReadyStatus(st) &&
      pickFirstAssetUrl(normalizeContentPack(row.content_pack) || {}, row)
    ) {
      return okJson(res, {
        ok: true,
        content: row,
        note: "asset already ready",
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    const proposal = await getProposalById({
      db,
      proposalId: row.proposal_id,
      dbReady,
    });

    if (dbReady && !proposal) {
      return okJson(res, { ok: false, error: "proposal not found for content" });
    }

    const tenantContext = resolveAuthoritativeContentTenantContext({
      service: "content.asset_generate",
      requestTenantId,
      requestTenantKey,
      proposal,
      content: row,
    });
    if (!tenantContext.ok) {
      return res.status(tenantContext.statusCode).json(tenantContext.payload);
    }

    if (cleanText(row.status).toLowerCase() === "asset.requested") {
      const replayAttempt = await evaluateReplayAttempt({
        db,
        linkedJobId: row.job_id,
        actor,
        action: "content.asset_generate",
        replayGroup: `content.asset_generate:${row.id}`,
      });
      if (!replayAttempt.ok) {
        return res.status(replayAttempt.statusCode).json(replayAttempt.payload);
      }

      const contentPack = normalizeContentPack(row.content_pack) || {};
      const eventName = pickAssetGenerationEvent(contentPack);
      const jobType = pickAssetGenerationJobType(contentPack);
      const runtimeResolved = await resolveRuntimeBehavior({
        db,
        tenantKey: tenantContext.tenantKey,
        tenantId: tenantContext.tenantId,
        service: "content.asset_generate",
      });
      if (!runtimeResolved.ok) {
        return okJson(res, runtimeResolved.response);
      }

      const job = await createJob({
        db,
        dbReady,
        input: {
          tenantId: tenantContext.tenantId,
          tenantKey: tenantContext.tenantKey,
          proposalId: row.proposal_id,
          type: jobType,
          status: "queued",
          createdAt: nowIso(),
          input: {
            contentId: row.id,
            contentPack,
            postType: packType(contentPack),
            format: packType(contentPack),
            aspectRatio: pickAspectRatio(contentPack),
            visualPreset: pickVisualPreset(contentPack),
            imagePrompt: pickImagePrompt(contentPack),
            videoPrompt: pickVideoPrompt(contentPack),
            voiceoverText: pickVoiceoverText(contentPack),
            neededAssets: pickNeededAssets(contentPack),
            reelMeta: pickReelMeta(contentPack),
            tenantKey: tenantContext.tenantKey,
            tenantId: tenantContext.tenantId,
            runtime: runtimeResolved.runtime,
            runtimeBehavior: runtimeResolved.runtimeBehavior,
            automationMode: automation.mode,
            autoPublish: automation.autoPublish,
          },
        },
      });

      const replayTaggedJob = await dbUpdateJob(db, job?.id, {
        output: {
          dispatchReplayControl: buildDispatchReplayControl({
            action: "content.asset_generate",
            actor,
            attemptMode: replayAttempt.attemptMode,
            previousJob: replayAttempt.previousJob,
            replayGroup: `content.asset_generate:${row.id}`,
          }),
        },
      });
      const attemptMode = replayAttempt.attemptMode;
      const dispatchCopy = buildAttemptAwareDispatchCopy({
        attemptMode,
        acceptedTitle: isReelPack(contentPack) ? "Video dispatch accepted" : "Asset dispatch accepted",
        acceptedBody: isReelPack(contentPack)
          ? "Local video job queued and external media workflow accepted."
          : "Local asset job queued and external media workflow accepted.",
        skippedTitle: isReelPack(contentPack) ? "Video queued locally" : "Assets queued locally",
        skippedBody: isReelPack(contentPack)
          ? "Local video job was queued, but external dispatch was skipped."
          : "Local asset job was queued, but external dispatch was skipped.",
        failedTitle: isReelPack(contentPack) ? "Video dispatch failed" : "Asset dispatch failed",
        failedBody: isReelPack(contentPack)
          ? "Local video job was queued, but external dispatch failed."
          : "Local asset job was queued, but external dispatch failed.",
        retryAcceptedTitle: isReelPack(contentPack)
          ? "Video retry dispatch accepted"
          : "Asset retry dispatch accepted",
        retryAcceptedBody: isReelPack(contentPack)
          ? "Local video retry job queued and external media workflow accepted."
          : "Local asset retry job queued and external media workflow accepted.",
        retrySkippedTitle: isReelPack(contentPack)
          ? "Video retry queued locally"
          : "Asset retry queued locally",
        retrySkippedBody: isReelPack(contentPack)
          ? "Local video retry job was queued, but external dispatch was skipped."
          : "Local asset retry job was queued, but external dispatch was skipped.",
        retryFailedTitle: isReelPack(contentPack)
          ? "Video retry dispatch failed"
          : "Asset retry dispatch failed",
        retryFailedBody: isReelPack(contentPack)
          ? "Local video retry job was queued, but external dispatch failed."
          : "Local asset retry job was queued, but external dispatch failed.",
      });

      const updated = await patchContentItem({
        db,
        id: row.id,
        patch: {
          status: "asset.requested",
          job_id: job?.id || row.job_id,
        },
        dbReady,
      });

      const dispatch = proposal
        ? await dispatchWorkflow(
            eventName,
            proposal,
            buildAssetNotifyExtra({
              tenantKey: tenantContext.tenantKey,
              tenantId: tenantContext.tenantId,
              proposal,
              row: updated || row,
              jobId: job?.id || null,
              contentPack,
              runtime: runtimeResolved.runtime,
              runtimeBehavior: runtimeResolved.runtimeBehavior,
              automationMode: automation.mode,
              autoPublish: automation.autoPublish,
            })
          )
        : {
            attempted: false,
            accepted: false,
            dispatchOutcome: "skipped",
            reasonCode: "proposal_not_found",
            error: "proposal not found for dispatch",
          };

      const dispatchedJob = await persistDispatchTruth({
        db,
        job,
        dispatch,
        event: eventName,
        actor,
      });

      const notif = await createNotification({
        db,
        dbReady,
        input: buildDispatchNotification({
          acceptedTitle: dispatchCopy.acceptedTitle,
          acceptedBody: dispatchCopy.acceptedBody,
          skippedTitle: dispatchCopy.skippedTitle,
          skippedBody: dispatchCopy.skippedBody,
          failedTitle: dispatchCopy.failedTitle,
          failedBody: dispatchCopy.failedBody,
          payload: {
            contentId: row.id,
            proposalId: row.proposal_id,
            jobId: job?.id || null,
            jobType,
            automationMode: automation.mode,
            attemptMode,
            retryOfJobId: replayAttempt.previousJob?.id || null,
          },
          dispatch,
        }),
      });

      const refreshed = await getContentById({ db, id: row.id, dbReady });

      wsHub?.broadcast?.({ type: "content.updated", content: refreshed || updated || row });
      if (job) wsHub?.broadcast?.({ type: "execution.updated", execution: dispatchedJob || replayTaggedJob || job });
      if (notif) wsHub?.broadcast?.({ type: "notification.created", notification: notif });

      if (dbReady) {
        await pushBroadcastToCeo({
          db,
          title:
            dispatch?.accepted === true
              ? dispatchCopy.acceptedTitle
              : dispatch?.dispatchOutcome === "skipped"
                ? dispatchCopy.skippedTitle
                : dispatchCopy.failedTitle,
          body:
            dispatch?.accepted === true
              ? dispatchCopy.acceptedBody
              : dispatch?.dispatchOutcome === "skipped"
                ? dispatchCopy.skippedBody
                : dispatchCopy.failedBody,
          data: {
            type: "asset.requested",
            contentId: row.id,
            proposalId: proposal?.id || row.proposal_id,
            jobId: job?.id || null,
            jobType,
            automationMode: automation.mode,
            attemptMode,
            retryOfJobId: replayAttempt.previousJob?.id || null,
            dispatch,
          },
        });
      }

      await writeAudit({
        db,
        dbReady,
        actor,
        action: "content.approve.assets",
        entityType: "content",
        entityId: row.id,
        meta: {
          proposalId: proposal?.id || row.proposal_id,
          jobId: job?.id || null,
          jobType,
          automationMode: automation.mode,
          dispatchAttemptMode: attemptMode,
          retryOfJobId: replayAttempt.previousJob?.id || null,
          dispatchOutcome: dispatch?.dispatchOutcome || "failed",
          dispatchAccepted: dispatch?.accepted === true,
          dispatchReasonCode: dispatch?.reasonCode || null,
        },
      });

      return okJson(res, {
        ok: true,
        content: refreshed || updated || row,
        jobId: job?.id || null,
        jobType,
        dispatch: dispatch || null,
        execution: dispatchedJob || replayTaggedJob || job,
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    if (!isDraftReadyStatus(st)) {
      return okJson(res, {
        ok: false,
        error: "content must be draft.ready before approve",
        status: row.status,
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    const contentPack = normalizeContentPack(row.content_pack) || {};
    const eventName = pickAssetGenerationEvent(contentPack);
    const jobType = pickAssetGenerationJobType(contentPack);
    const runtimeResolved = await resolveRuntimeBehavior({
      db,
      tenantKey: tenantContext.tenantKey,
      tenantId: tenantContext.tenantId,
      service: "content.asset_generate",
    });
    if (!runtimeResolved.ok) {
      return okJson(res, runtimeResolved.response);
    }

    const job = await createJob({
      db,
      dbReady,
      input: {
        tenantId: tenantContext.tenantId,
        tenantKey: tenantContext.tenantKey,
        proposalId: row.proposal_id,
        type: jobType,
        status: "queued",
        createdAt: nowIso(),
        input: {
          contentId: row.id,
          contentPack,
          postType: packType(contentPack),
          format: packType(contentPack),
          aspectRatio: pickAspectRatio(contentPack),
          visualPreset: pickVisualPreset(contentPack),
          imagePrompt: pickImagePrompt(contentPack),
          videoPrompt: pickVideoPrompt(contentPack),
          voiceoverText: pickVoiceoverText(contentPack),
          neededAssets: pickNeededAssets(contentPack),
          reelMeta: pickReelMeta(contentPack),
          tenantKey: tenantContext.tenantKey,
          tenantId: tenantContext.tenantId,
          runtime: runtimeResolved.runtime,
          runtimeBehavior: runtimeResolved.runtimeBehavior,
          automationMode: automation.mode,
          autoPublish: automation.autoPublish,
        },
      },
    });

    const replayTaggedJob = await dbUpdateJob(db, job?.id, {
      output: {
        dispatchReplayControl: buildDispatchReplayControl({
          action: "content.asset_generate",
          actor,
          attemptMode: "initial",
          previousJob: null,
          replayGroup: `content.asset_generate:${row.id}`,
        }),
      },
    });
    const dispatchCopy = buildAttemptAwareDispatchCopy({
      attemptMode: "initial",
      acceptedTitle: isReelPack(contentPack) ? "Video dispatch accepted" : "Asset dispatch accepted",
      acceptedBody: isReelPack(contentPack)
        ? "Local video job queued and external media workflow accepted."
        : "Local asset job queued and external media workflow accepted.",
      skippedTitle: isReelPack(contentPack) ? "Video queued locally" : "Assets queued locally",
      skippedBody: isReelPack(contentPack)
        ? "Local video job was queued, but external dispatch was skipped."
        : "Local asset job was queued, but external dispatch was skipped.",
      failedTitle: isReelPack(contentPack) ? "Video dispatch failed" : "Asset dispatch failed",
      failedBody: isReelPack(contentPack)
        ? "Local video job was queued, but external dispatch failed."
        : "Local asset job was queued, but external dispatch failed.",
      retryAcceptedTitle: "",
      retryAcceptedBody: "",
      retrySkippedTitle: "",
      retrySkippedBody: "",
      retryFailedTitle: "",
      retryFailedBody: "",
    });

    const updated = await patchContentItem({
      db,
      id: row.id,
      patch: {
        status: "asset.requested",
        job_id: job?.id || row.job_id,
      },
      dbReady,
    });

    const dispatch = proposal
      ? await dispatchWorkflow(
          eventName,
          proposal,
          buildAssetNotifyExtra({
            tenantKey: tenantContext.tenantKey,
            tenantId: tenantContext.tenantId,
            proposal,
            row: updated || row,
            jobId: job?.id || null,
            contentPack,
            runtime: runtimeResolved.runtime,
            runtimeBehavior: runtimeResolved.runtimeBehavior,
            automationMode: automation.mode,
            autoPublish: automation.autoPublish,
          })
        )
      : {
          attempted: false,
          accepted: false,
          dispatchOutcome: "skipped",
          reasonCode: "proposal_not_found",
          error: "proposal not found for dispatch",
        };

    const dispatchedJob = await persistDispatchTruth({
      db,
      job,
      dispatch,
      event: eventName,
      actor,
    });

    const notif = await createNotification({
      db,
      dbReady,
      input: buildDispatchNotification({
        acceptedTitle: dispatchCopy.acceptedTitle,
        acceptedBody: dispatchCopy.acceptedBody,
        skippedTitle: dispatchCopy.skippedTitle,
        skippedBody: dispatchCopy.skippedBody,
        failedTitle: dispatchCopy.failedTitle,
        failedBody: dispatchCopy.failedBody,
        payload: {
          contentId: row.id,
          proposalId: row.proposal_id,
          jobId: job?.id || null,
          jobType,
          automationMode: automation.mode,
        },
        dispatch,
      }),
    });

    const refreshed = await getContentById({ db, id: row.id, dbReady });

    wsHub?.broadcast?.({ type: "content.updated", content: refreshed || updated || row });
    if (job) wsHub?.broadcast?.({ type: "execution.updated", execution: dispatchedJob || job });
    if (notif) wsHub?.broadcast?.({ type: "notification.created", notification: notif });

    if (dbReady) {
      await pushBroadcastToCeo({
        db,
        title:
          dispatch?.accepted === true
            ? dispatchCopy.acceptedTitle
            : dispatch?.dispatchOutcome === "skipped"
              ? dispatchCopy.skippedTitle
              : dispatchCopy.failedTitle,
        body:
          dispatch?.accepted === true
            ? dispatchCopy.acceptedBody
            : dispatch?.dispatchOutcome === "skipped"
              ? dispatchCopy.skippedBody
              : dispatchCopy.failedBody,
        data: {
          type: "asset.requested",
          contentId: row.id,
          proposalId: proposal?.id || row.proposal_id,
          jobId: job?.id || null,
          jobType,
          automationMode: automation.mode,
          dispatch,
        },
      });
    }

    await writeAudit({
      db,
      dbReady,
      actor,
      action: "content.approve.assets",
      entityType: "content",
      entityId: row.id,
      meta: {
        proposalId: proposal?.id || row.proposal_id,
        jobId: job?.id || null,
        jobType,
        automationMode: automation.mode,
        dispatchOutcome: dispatch?.dispatchOutcome || "failed",
        dispatchAccepted: dispatch?.accepted === true,
        dispatchReasonCode: dispatch?.reasonCode || null,
      },
    });

    return okJson(res, {
      ok: true,
      content: refreshed || updated || row,
      jobId: job?.id || null,
      jobType,
      dispatch: dispatch || null,
      execution: dispatchedJob || replayTaggedJob || job,
      ...(dbReady ? {} : { dbDisabled: true }),
    });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}
export async function analyzeHandler(req, res, { db, wsHub }) {
  const id = String(req.params.id || "").trim();
  const tenantKey = getAuthTenantKey(req) || cleanLower(pickTenantId(req));
  const actor = pickActionActor(req, "ceo");
  const dbReady = isDbReady(db);

  if (!id) return okJson(res, { ok: false, error: "contentId required" });
  if (dbReady && !isUuid(id)) {
    return okJson(res, { ok: false, error: "contentId must be uuid" });
  }

  try {
    const row = await getContentById({ db, id, dbReady });
    if (!row) {
      return okJson(res, {
        ok: false,
        error: "content not found",
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    if (!canAnalyzeRow(row)) {
      return okJson(res, {
        ok: false,
        error: "content must be approved/asset.ready/published before analyze",
        status: row.status,
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    const proposal = await getProposalById({
      db,
      proposalId: row.proposal_id,
      dbReady,
    });

    const contentPack = normalizeContentPack(row.content_pack) || {};
    const assetUrls = collectAssetUrls(contentPack, row);
    const tenantId = pickRuntimeTenantId(row, proposal);
    const runtimeResolved = await resolveContentRuntimeBehavior({
      db,
      tenantKey,
      tenantId,
      service: "content.analyze",
    });
    if (!runtimeResolved.ok) {
      return okJson(res, runtimeResolved.response);
    }
    const tenant = buildAnalyzeTenant({
      tenantKey,
      tenantId,
      contentPack,
      runtimeBehavior: runtimeResolved.runtimeBehavior,
    });

    const analysisRun = await kernelHandle({
      agentHint: "critic",
      usecase: "content.analyze",
      message:
        "Analyze this approved content for niche fit, conversion usefulness, claim safety, and publish readiness. Return strict JSON only.",
      tenant,
      today: String(nowIso()).slice(0, 10),
      format: packType(contentPack),
      extra: buildAnalyzeExtra({
        row,
        proposal,
        contentPack,
        assetUrls,
        runtime: runtimeResolved.runtime,
        runtimeBehavior: runtimeResolved.runtimeBehavior,
      }),
    });

    if (!analysisRun?.ok || !analysisRun?.structured) {
      return okJson(res, {
        ok: false,
        error: "analyze_failed",
        details: {
          status: analysisRun?.status || null,
          warnings: analysisRun?.warnings || [],
          replyText: analysisRun?.replyText || "",
        },
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    const analysis = analysisRun.structured;
    const updatedPack = {
      ...contentPack,
      analysis,
      qa: analysis,
      analyzeMeta: {
        analyzedAt: nowIso(),
        analyzedBy: actor,
        agent: analysisRun.agent || "critic",
        usecase: analysisRun.usecase || "content.analyze",
        model: analysisRun.model || "",
        warnings: Array.isArray(analysisRun.warnings) ? analysisRun.warnings : [],
        replayTrace:
          analysisRun?.meta?.replayTrace ||
          buildAnalyzeExtra({
            row,
            proposal,
            contentPack,
            assetUrls,
            runtime: runtimeResolved.runtime,
            runtimeBehavior: runtimeResolved.runtimeBehavior,
          }).replayTrace ||
          null,
      },
    };

    await patchContentItem({
      db,
      id: row.id,
      patch: { content_pack: updatedPack },
      dbReady,
    });

    const refreshed = await getContentById({ db, id: row.id, dbReady });

    const notif = await createNotification({
      db,
      dbReady,
      input: {
        recipient: "ceo",
        type:
          analysis?.publishReady === true
            ? "success"
            : analysis?.verdict === "needs_major_revision"
            ? "error"
            : "info",
        title: buildAnalyzeTitle(analysis),
        body: buildAnalyzeBody(analysis),
        payload: {
          contentId: row.id,
          proposalId: row.proposal_id,
          analysis,
        },
      },
    });

    wsHub?.broadcast?.({ type: "content.updated", content: refreshed || row });
    if (notif) wsHub?.broadcast?.({ type: "notification.created", notification: notif });

    if (dbReady) {
      await pushBroadcastToCeo({
        db,
        title: buildAnalyzeTitle(analysis),
        body: buildAnalyzeBody(analysis),
        data: {
          type: "content.analyze",
          contentId: row.id,
          proposalId: row.proposal_id,
          score: analysis?.score ?? null,
          verdict: analysis?.verdict || null,
          publishReady: analysis?.publishReady === true,
        },
      });
    }

    await writeAudit({
      db,
      dbReady,
      actor,
      action: "content.analyze",
      entityType: "content",
      entityId: row.id,
      meta: {
        proposalId: row.proposal_id,
        score: analysis?.score ?? null,
        verdict: analysis?.verdict || null,
        publishReady: analysis?.publishReady === true,
      },
    });

    return okJson(res, {
      ok: true,
      content: refreshed || row,
      analysis,
      ...(dbReady ? {} : { dbDisabled: true }),
    });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}

export async function publishHandler(
  req,
  res,
  {
    db,
    wsHub,
    dispatchWorkflow = notifyN8n,
    resolveRuntimeBehavior = resolveContentRuntimeBehavior,
  } = {}
) {
  const id = String(req.params.id || "").trim();
  const requestTenantKey = getAuthTenantKey(req) || cleanLower(pickTenantId(req));
  const requestTenantId = cleanText(req.auth?.tenantId || req.auth?.tenant_id, "");
  const actor = pickActionActor(req, "ceo");
  const automation = pickAutomationMeta(req);
  const dbReady = isDbReady(db);

  if (!id) return okJson(res, { ok: false, error: "contentId required" });
  if (dbReady && !isUuid(id)) {
    return okJson(res, { ok: false, error: "contentId must be uuid" });
  }

  try {
    const row = await getContentById({ db, id, dbReady });
    if (!row) {
      return okJson(res, {
        ok: false,
        error: "content not found",
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    const contentPack = normalizeContentPack(row.content_pack) || {};
    const st = statusLc(row.status);
    let publishReplayAttempt = null;

    if (isPublishRequestedStatus(st)) {
      publishReplayAttempt = await evaluateReplayAttempt({
        db,
        linkedJobId: row.job_id,
        actor,
        action: "content.publish",
        replayGroup: `content.publish:${row.id || id}`,
      });
      if (!publishReplayAttempt.ok) {
        return res.status(publishReplayAttempt.statusCode).json(publishReplayAttempt.payload);
      }
    }

    if (!canPublishRow(row) && !publishReplayAttempt?.ok) {
      return okJson(res, {
        ok: false,
        error: "content must be asset.ready before publish",
        status: row.status,
        hasAssetUrl: !!pickFirstAssetUrl(contentPack, row),
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    const proposal = await getProposalById({
      db,
      proposalId: row.proposal_id,
      dbReady,
    });

    if (dbReady && !proposal) {
      return okJson(res, { ok: false, error: "proposal not found for content" });
    }

    const assetUrl = pickFirstAssetUrl(contentPack, row);
    const caption = buildCaption(contentPack);
    const tenantContext = resolveAuthoritativeContentTenantContext({
      service: "content.publish",
      requestTenantId,
      requestTenantKey,
      proposal,
      content: row,
    });
    if (!tenantContext.ok) {
      return res.status(tenantContext.statusCode).json(tenantContext.payload);
    }

    const runtimeResolved = await resolveRuntimeBehavior({
      db,
      tenantKey: tenantContext.tenantKey,
      tenantId: tenantContext.tenantId,
      service: "content.publish",
    });
    if (!runtimeResolved.ok) {
      return okJson(res, runtimeResolved.response);
    }

    if (!assetUrl) {
      return okJson(res, {
        ok: false,
        error: "publish requires assetUrl (missing assets/url)",
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    const job = await createJob({
      db,
      dbReady,
      input: {
        tenantId: tenantContext.tenantId,
        tenantKey: tenantContext.tenantKey,
        proposalId: row.proposal_id,
        type: "publish",
        status: "queued",
        createdAt: nowIso(),
        input: {
          contentId: row.id || id,
          contentPack,
          assetUrl,
          thumbnailUrl: pickThumbnailUrl(contentPack, row),
          caption,
          format: packType(contentPack),
          aspectRatio: pickAspectRatio(contentPack),
          tenantKey: tenantContext.tenantKey,
          tenantId: tenantContext.tenantId,
          runtime: runtimeResolved.runtime,
          runtimeBehavior: runtimeResolved.runtimeBehavior,
          automationMode: automation.mode,
          autoPublish: automation.autoPublish,
        },
      },
    });

    const replayTaggedJob = await dbUpdateJob(db, job?.id, {
      output: {
        dispatchReplayControl: buildDispatchReplayControl({
          action: "content.publish",
          actor,
          attemptMode: publishReplayAttempt?.attemptMode || "initial",
          previousJob: publishReplayAttempt?.previousJob || null,
          replayGroup: `content.publish:${row.id || id}`,
        }),
      },
    });
    const attemptMode = publishReplayAttempt?.attemptMode || "initial";
    const dispatchCopy = buildAttemptAwareDispatchCopy({
      attemptMode,
      acceptedTitle: "Publish dispatch accepted",
      acceptedBody: "Local publish job queued and external publish workflow accepted.",
      skippedTitle: "Publish queued locally",
      skippedBody: "Local publish job was queued, but external dispatch was skipped.",
      failedTitle: "Publish dispatch failed",
      failedBody: "Local publish job was queued, but external dispatch failed.",
      retryAcceptedTitle: "Publish retry dispatch accepted",
      retryAcceptedBody: "Local publish retry job queued and external publish workflow accepted.",
      retrySkippedTitle: "Publish retry queued locally",
      retrySkippedBody: "Local publish retry job was queued, but external dispatch was skipped.",
      retryFailedTitle: "Publish retry dispatch failed",
      retryFailedBody: "Local publish retry job was queued, but external dispatch failed.",
    });

    await patchContentItem({
      db,
      id: row.id || id,
      patch: {
        status: "publish.requested",
        job_id: job?.id || row.job_id,
      },
      dbReady,
    });

    const dispatch = proposal
      ? await dispatchWorkflow(
          "content.publish",
          proposal,
          buildPublishNotifyExtra({
            tenantKey: tenantContext.tenantKey,
            tenantId: tenantContext.tenantId,
            proposal,
            row,
            jobId: job?.id || null,
            contentPack,
            assetUrl,
            caption,
            runtime: runtimeResolved.runtime,
            runtimeBehavior: runtimeResolved.runtimeBehavior,
            automationMode: automation.mode,
            autoPublish: automation.autoPublish,
          })
        )
      : {
          attempted: false,
          accepted: false,
          dispatchOutcome: "skipped",
          reasonCode: "proposal_not_found",
          error: "proposal not found for dispatch",
        };

    const dispatchedJob = await persistDispatchTruth({
      db,
      job,
      dispatch,
      event: "content.publish",
      actor,
    });

    const notif = await createNotification({
      db,
      dbReady,
      input: buildDispatchNotification({
        acceptedTitle: dispatchCopy.acceptedTitle,
        acceptedBody: dispatchCopy.acceptedBody,
        skippedTitle: dispatchCopy.skippedTitle,
        skippedBody: dispatchCopy.skippedBody,
        failedTitle: dispatchCopy.failedTitle,
        failedBody: dispatchCopy.failedBody,
        payload: {
          contentId: row.id || id,
          proposalId: proposal?.id || row.proposal_id,
          jobId: job?.id || null,
          automationMode: automation.mode,
          attemptMode,
          retryOfJobId: publishReplayAttempt?.previousJob?.id || null,
        },
        dispatch,
      }),
    });

    const refreshed = await getContentById({ db, id: row.id || id, dbReady });

    wsHub?.broadcast?.({ type: "content.updated", content: refreshed || row });
    if (job) wsHub?.broadcast?.({ type: "execution.updated", execution: dispatchedJob || job });
    if (notif) wsHub?.broadcast?.({ type: "notification.created", notification: notif });

    if (dbReady) {
      await pushBroadcastToCeo({
        db,
        title:
          dispatch?.accepted === true
            ? dispatchCopy.acceptedTitle
            : dispatch?.dispatchOutcome === "skipped"
              ? dispatchCopy.skippedTitle
              : dispatchCopy.failedTitle,
        body:
          dispatch?.accepted === true
            ? dispatchCopy.acceptedBody
            : dispatch?.dispatchOutcome === "skipped"
              ? dispatchCopy.skippedBody
              : dispatchCopy.failedBody,
        data: {
          type: "publish.requested",
          contentId: row.id,
          proposalId: proposal?.id || row.proposal_id,
          jobId: job?.id || null,
          automationMode: automation.mode,
          attemptMode,
          retryOfJobId: publishReplayAttempt?.previousJob?.id || null,
          dispatch,
        },
      });
    }

    await writeAudit({
      db,
      dbReady,
      actor,
      action: "content.publish",
      entityType: "content",
      entityId: row.id || id,
      meta: {
        proposalId: proposal?.id || row.proposal_id,
        jobId: job?.id || null,
        status: row.status,
        automationMode: automation.mode,
        dispatchAttemptMode: attemptMode,
        retryOfJobId: publishReplayAttempt?.previousJob?.id || null,
        dispatchOutcome: dispatch?.dispatchOutcome || "failed",
        dispatchAccepted: dispatch?.accepted === true,
        dispatchReasonCode: dispatch?.reasonCode || null,
      },
    });

    return okJson(res, {
      ok: true,
      jobId: job?.id || null,
      contentId: row.id || id,
      dispatch: dispatch || null,
      execution: dispatchedJob || replayTaggedJob || job,
      ...(dbReady ? {} : { dbDisabled: true }),
    });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}

