import { resolveTenantKeyFromReq } from "../../../tenancy/index.js";
import { getAuthTenantId } from "../../../utils/auth.js";

import {
  okJson,
  clamp,
  isUuid,
  normalizeDecision,
  isDbReady,
  serviceUnavailableJson,
} from "../../../utils/http.js";
import { deepFix, fixText } from "../../../utils/textFix.js";

import { pushBroadcastToCeo } from "../../../services/pushBroadcast.js";
import { notifyN8n } from "../../../services/n8nNotify.js";
import {
  dbGetLatestJobByProposalAndType,
  dbUpdateJob,
} from "../../../db/helpers/jobs.js";

import {
  normalizeRequestedStatus,
  pickDecisionActor,
  pickAutomationMeta,
  clean,
  safeTitle,
  safeTopic,
  buildDraftJobInput,
} from "./utils.js";

import { matchesRequestedUiStatus, mapProposalRow } from "./status.js";

import { buildN8nExtra } from "./notify.js";

import {
  listDbProposalRows,
  getDbProposalById,
  updateDbProposalDecision,
  createDbNotification,
  createDbJob,
  auditDb,
  getLatestDraftLikeByProposal,
  getLatestApprovedDraftByProposal,
} from "./repository.js";

function requireProposalsDb(res, db) {
  if (isDbReady(db)) return false;
  serviceUnavailableJson(
    res,
    "database unavailable; proposals require persistent storage"
  );
  return true;
}

function cleanText(v, fallback = "") {
  const value = String(v ?? fallback).trim();
  return value || String(fallback ?? "").trim();
}

function buildDispatchControl(job, dispatch, { event = "", actor = "" } = {}) {
  const ts = new Date().toISOString();
  return deepFix({
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
  });
}

function getJobStatusForDispatch(dispatch = {}) {
  if (dispatch?.accepted === true) return "queued";
  if (dispatch?.dispatchOutcome === "skipped") return "dispatch_skipped";
  return "dispatch_failed";
}

function buildProposalDispatchNotification({
  dispatch,
  proposalId,
  jobId,
  automationMode,
  attemptMode = "initial",
}) {
  const normalizedAttemptMode = cleanText(attemptMode || "initial").toLowerCase();
  const isRetry = normalizedAttemptMode === "retry";
  if (dispatch?.accepted === true) {
    return {
      recipient: "ceo",
      type: "info",
      title: isRetry ? "Draft retry dispatch accepted" : "Draft dispatch accepted",
      body: isRetry
        ? "Local draft retry job queued and external draft workflow accepted."
        : "Local draft job queued and external draft workflow accepted.",
      payload: {
        proposalId,
        jobId,
        automationMode,
        attemptMode: normalizedAttemptMode,
        dispatch,
      },
    };
  }

  if (dispatch?.dispatchOutcome === "skipped") {
    return {
      recipient: "ceo",
      type: "error",
      title: isRetry ? "Draft retry queued locally" : "Draft queued locally",
      body: isRetry
        ? "Local draft retry job was queued, but external dispatch was skipped."
        : "Local draft job was queued, but external dispatch was skipped.",
      payload: {
        proposalId,
        jobId,
        automationMode,
        attemptMode: normalizedAttemptMode,
        dispatch,
      },
    };
  }

  return {
    recipient: "ceo",
    type: "error",
    title: isRetry ? "Draft retry dispatch failed" : "Draft dispatch failed",
    body: isRetry
      ? "Local draft retry job was queued, but external dispatch failed."
      : "Local draft job was queued, but external dispatch failed.",
    payload: {
      proposalId,
      jobId,
      automationMode,
      attemptMode: normalizedAttemptMode,
      dispatch,
    },
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
  reasonCode = "tenant_truth_unavailable",
  message = "",
  proposalId = null,
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
          ? "Request tenant context does not match authoritative proposal tenant truth."
          : "Authoritative proposal tenant truth is unavailable for orchestration."),
      reasonCode,
      proposalId: proposalId || null,
      requestTenantId: requestTenantId || null,
      requestTenantKey: cleanText(requestTenantKey),
      authorityTenantId: authorityTenantId || null,
      authorityTenantKey: cleanText(authorityTenantKey),
    },
  };
}

function resolveAuthoritativeProposalTenantContext({
  service = "",
  requestTenantId = null,
  requestTenantKey = "",
  proposal = null,
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
        reasonCode: "tenant_truth_unavailable",
        proposalId: proposal?.id || null,
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
        reasonCode: "tenant_truth_mismatch",
        proposalId: proposal?.id || null,
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
  return deepFix(job?.output?.dispatchReplayControl || {});
}

function buildDispatchReplayControl({
  action = "",
  actor = "",
  attemptMode = "initial",
  previousJob = null,
  replayGroup = "",
} = {}) {
  return deepFix({
    action: cleanText(action),
    replayGroup: cleanText(replayGroup),
    attemptMode,
    previousJobId: previousJob?.id || null,
    previousJobStatus: cleanText(previousJob?.status),
    replayRequestedAt: new Date().toISOString(),
    replayRequestedBy: cleanText(actor),
  });
}

async function rejectProposalReplayAttempt({
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

export async function listProposalsHandler(req, res, { db }) {
  const rawStatus = normalizeRequestedStatus(req.query.status);
  const uiStatus =
    rawStatus === "pending" || rawStatus === "in_progress" ? "draft" : rawStatus;
  const tenantKey = resolveTenantKeyFromReq(req);
  const tenantId = clean(getAuthTenantId(req)) || null;

  const limit = clamp(req.query.limit ?? 50, 1, 200);
  const includeContent = String(req.query.includeContent || "1") === "1";
  const includePack = String(req.query.includePack || "0") === "1";

  try {
    if (requireProposalsDb(res, db)) return;

    const rows = await listDbProposalRows(db, {
      tenantId,
      tenantKey,
      limit,
      includePack,
    });
    const proposals = rows
      .map((row) => mapProposalRow(row, includeContent, includePack))
      .filter((p) => matchesRequestedUiStatus(uiStatus, p, p.latestContent))
      .slice(0, limit);

    return okJson(res, {
      ok: true,
      status: uiStatus,
      proposals,
    });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}

export async function proposalDecisionHandler(
  req,
  res,
  { db, wsHub, dispatchWorkflow = notifyN8n } = {}
) {
  const id = String(req.params.id || "").trim();
  const decision = normalizeDecision(req.body?.decision);
  const by = pickDecisionActor(req, "ceo");
  const reason = fixText(String(req.body?.reason || "").trim());

  const requestTenantKey = resolveTenantKeyFromReq(req);
  const requestTenantId =
    clean(req.auth?.tenantId || req.auth?.tenant_id || req.body?.tenantId || "") || null;

  const automation = pickAutomationMeta(req);

  if (!id) {
    return okJson(res, { ok: false, error: "proposalId required" });
  }

  if (decision !== "approved" && decision !== "rejected") {
    return okJson(res, {
      ok: false,
      error: "decision must be approved|rejected",
    });
  }

  try {
    if (requireProposalsDb(res, db)) return;

    const proposal = await getDbProposalById(db, id);
    if (!proposal) {
      return okJson(res, { ok: false, error: "proposal not found" });
    }

    const tenantContext = resolveAuthoritativeProposalTenantContext({
      service: "proposal.approved",
      requestTenantId,
      requestTenantKey,
      proposal,
    });
    if (!tenantContext.ok) {
      return res.status(tenantContext.statusCode).json(tenantContext.payload);
    }

    const latestDraftJob = await dbGetLatestJobByProposalAndType(
      db,
      proposal.id,
      "draft.generate"
    );

    if (decision === "rejected") {
      const p2 = await updateDbProposalDecision(db, id, {
        decision: "rejected",
        by,
        reason,
        automationMode: automation.mode,
      });

      if (!p2) {
        return okJson(res, { ok: false, error: "update failed" });
      }

      const notif = await createDbNotification(db, {
        recipient: "ceo",
        type: "info",
        title: "Proposal rejected",
        body: reason || safeTitle(p2),
        payload: {
          proposalId: p2.id,
          decision: "rejected",
          reason,
          automationMode: automation.mode,
        },
      });

      wsHub?.broadcast?.({ type: "proposal.updated", proposal: p2 });
      wsHub?.broadcast?.({ type: "notification.created", notification: notif });

      await pushBroadcastToCeo({
        db,
        title: "Rejected",
        body: safeTitle(p2) || "Proposal rejected",
        data: {
          type: "proposal.rejected",
          proposalId: p2.id,
          automationMode: automation.mode,
        },
      });

      await auditDb(db, by, "proposal.reject", "proposal", String(p2.id), {
        reason,
        automationMode: automation.mode,
      });

      try {
        notifyN8n("proposal.rejected", p2, {
          tenantId: tenantContext.tenantId,
          tenantKey: tenantContext.tenantKey,
          proposalId: String(p2.id),
          reason,
          topic: safeTopic(p2),
          payload: deepFix(p2.payload),
          automationMode: automation.mode,
          autoPublish: automation.autoPublish,
        });
      } catch {}

      return okJson(res, { ok: true, proposal: p2 });
    }

    const p2 = await updateDbProposalDecision(db, id, {
      decision: "approved",
      by,
      reason,
      automationMode: automation.mode,
    });

    if (!p2) {
      return okJson(res, { ok: false, error: "update failed" });
    }

    if (
      latestDraftJob &&
      !RETRYABLE_DISPATCH_JOB_STATUSES.has(cleanText(latestDraftJob.status).toLowerCase())
    ) {
      const reasonCode = COMPLETED_DISPATCH_JOB_STATUSES.has(
        cleanText(latestDraftJob.status).toLowerCase()
      )
        ? "dispatch_attempt_already_completed"
        : "dispatch_attempt_already_open";
      const existingExecution = await rejectProposalReplayAttempt({
        db,
        existingJob: latestDraftJob,
        actor: by,
        action: "proposal.approved",
        reasonCode,
      });

      return res.status(409).json({
        ok: false,
        error: "dispatch_attempt_conflict",
        mutationOutcome: "rejected",
        execution: existingExecution || latestDraftJob,
        details: {
          action: "proposal.approved",
          reasonCode,
          proposalId: p2.id,
          existingJobId: latestDraftJob.id,
          existingJobStatus: latestDraftJob.status,
        },
      });
    }

    const job = await createDbJob(db, {
      tenantId: tenantContext.tenantId || null,
      tenantKey: tenantContext.tenantKey || null,
      proposalId: p2.id,
      type: "draft.generate",
      status: "queued",
      input: buildDraftJobInput(p2, automation, tenantContext.tenantKey, tenantContext.tenantId),
    });

    const replayTaggedJob = await dbUpdateJob(db, job?.id, {
      output: {
        dispatchReplayControl: buildDispatchReplayControl({
          action: "proposal.approved",
          actor: by,
          attemptMode: latestDraftJob ? "retry" : "initial",
          previousJob: latestDraftJob,
          replayGroup: `proposal.approved:${p2.id}`,
        }),
      },
    });
    const attemptMode = latestDraftJob ? "retry" : "initial";

    const dispatch = await dispatchWorkflow(
      "proposal.approved",
      p2,
      buildN8nExtra({
        tenantId: tenantContext.tenantId,
        tenantKey: tenantContext.tenantKey,
        proposal: p2,
        jobId: job?.id || null,
        reason,
        automationMode: automation.mode,
        autoPublish: automation.autoPublish,
      })
    );

    const dispatchedJob = await dbUpdateJob(db, job?.id, {
      status: getJobStatusForDispatch(dispatch),
      output: {
        dispatchControl: buildDispatchControl(job, dispatch, {
          event: "proposal.approved",
          actor: by,
        }),
      },
      error:
        dispatch?.accepted === true
          ? null
          : cleanText(dispatch?.error || dispatch?.reasonCode || "external dispatch failed"),
    });

    const notif = await createDbNotification(
      db,
      buildProposalDispatchNotification({
        dispatch,
        proposalId: p2.id,
        jobId: job?.id || null,
        automationMode: automation.mode,
        attemptMode,
      })
    );

    wsHub?.broadcast?.({ type: "proposal.updated", proposal: p2 });
    wsHub?.broadcast?.({ type: "execution.updated", execution: dispatchedJob || job });
    wsHub?.broadcast?.({ type: "notification.created", notification: notif });

    await pushBroadcastToCeo({
      db,
      title:
        dispatch?.accepted === true
          ? attemptMode === "retry"
            ? "Draft retry dispatch accepted"
            : "Draft dispatch accepted"
          : dispatch?.dispatchOutcome === "skipped"
            ? attemptMode === "retry"
              ? "Draft retry queued locally"
              : "Draft queued locally"
            : attemptMode === "retry"
              ? "Draft retry dispatch failed"
              : "Draft dispatch failed",
      body:
        dispatch?.accepted === true
          ? attemptMode === "retry"
            ? "Local draft retry job queued and external draft workflow accepted."
            : safeTitle(p2) || "External draft workflow accepted."
          : dispatch?.dispatchOutcome === "skipped"
            ? attemptMode === "retry"
              ? "Local draft retry job was queued, but external dispatch was skipped."
              : "Local draft job was queued, but external dispatch was skipped."
            : attemptMode === "retry"
              ? "Local draft retry job was queued, but external dispatch failed."
              : "Local draft job was queued, but external dispatch failed.",
      data: {
        type: "proposal.in_progress",
        proposalId: p2.id,
        jobId: job?.id || null,
        automationMode: automation.mode,
        attemptMode,
        retryOfJobId: latestDraftJob?.id || null,
        dispatch,
      },
    });

    await auditDb(db, by, "proposal.approve", "proposal", String(p2.id), {
      reason,
      automationMode: automation.mode,
      jobId: job?.id || null,
      dispatchAttemptMode: attemptMode,
      retryOfJobId: latestDraftJob?.id || null,
      dispatchOutcome: dispatch?.dispatchOutcome || "failed",
      dispatchAccepted: dispatch?.accepted === true,
      dispatchReasonCode: dispatch?.reasonCode || null,
    });

    return okJson(res, {
      ok: true,
      proposal: p2,
      jobId: job?.id || null,
      dispatch: dispatch || null,
      execution: dispatchedJob || replayTaggedJob || job,
    });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}

export async function requestChangesHandler(req, res, { db }) {
  const proposalId = String(req.params.id || "").trim();
  const feedbackText = fixText(String(req.body?.feedbackText || "").trim());

  if (!proposalId) {
    return okJson(res, { ok: false, error: "proposalId required" });
  }
  if (!feedbackText) {
    return okJson(res, { ok: false, error: "feedbackText required" });
  }
  if (!isUuid(proposalId)) {
    return okJson(res, { ok: false, error: "proposalId must be uuid" });
  }

  try {
    if (requireProposalsDb(res, db)) return;

    const content = await getLatestDraftLikeByProposal(db, proposalId);
    if (!content) {
      return okJson(res, { ok: false, error: "no content for proposal" });
    }

    return okJson(res, { ok: true, contentId: content.id });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}

export async function publishProposalHandler(req, res, { db }) {
  const proposalId = String(req.params.id || "").trim();

  if (!proposalId) {
    return okJson(res, { ok: false, error: "proposalId required" });
  }
  if (!isUuid(proposalId)) {
    return okJson(res, { ok: false, error: "proposalId must be uuid" });
  }

  try {
    if (requireProposalsDb(res, db)) return;

    const c = await getLatestApprovedDraftByProposal(db, proposalId);
    if (!c) {
      return okJson(res, {
        ok: false,
        error: "no draft.approved content found",
      });
    }

    return okJson(res, { ok: true, contentId: c.id });
  } catch (e) {
    return okJson(res, {
      ok: false,
      error: "Error",
      details: { message: String(e?.message || e) },
    });
  }
}
