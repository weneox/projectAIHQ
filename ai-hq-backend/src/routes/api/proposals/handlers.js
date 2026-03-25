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
  normalizeRequestedStatus,
  pickDecisionActor,
  pickAutomationMeta,
  clean,
  safeTitle,
  safeTopic,
  buildDraftJobInput,
} from "./utils.js";

import {
  matchesRequestedUiStatus,
  mapProposalRow,
} from "./status.js";

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

export async function proposalDecisionHandler(req, res, { db, wsHub }) {
  const id = String(req.params.id || "").trim();
  const decision = normalizeDecision(req.body?.decision);
  const by = pickDecisionActor(req, "ceo");
  const reason = fixText(String(req.body?.reason || "").trim());

  const tenantKey = resolveTenantKeyFromReq(req);
  const tenantId =
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
          tenantId,
          tenantKey,
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

    const job = await createDbJob(db, {
      tenantId: tenantId || null,
      tenantKey: tenantKey || null,
      proposalId: p2.id,
      type: "draft.generate",
      status: "queued",
      input: buildDraftJobInput(p2, automation, tenantKey, tenantId),
    });

    const notif = await createDbNotification(db, {
      recipient: "ceo",
      type: "info",
      title: "Drafting started",
      body:
        automation.mode === "full_auto"
          ? "Auto content draft hazÄ±rlanÄ±râ€¦"
          : "n8n draft hazÄ±rlayÄ±râ€¦",
      payload: {
        proposalId: p2.id,
        jobId: job?.id || null,
        automationMode: automation.mode,
      },
    });

    wsHub?.broadcast?.({ type: "proposal.updated", proposal: p2 });
    wsHub?.broadcast?.({ type: "execution.updated", execution: job });
    wsHub?.broadcast?.({ type: "notification.created", notification: notif });

    await pushBroadcastToCeo({
      db,
      title: automation.mode === "full_auto" ? "Auto drafting baÅŸladÄ±" : "Drafting baÅŸladÄ±",
      body: safeTitle(p2) || "Draft hazÄ±rlanÄ±râ€¦",
      data: {
        type: "proposal.in_progress",
        proposalId: p2.id,
        jobId: job?.id || null,
        automationMode: automation.mode,
      },
    });

    await auditDb(db, by, "proposal.approve", "proposal", String(p2.id), {
      reason,
      automationMode: automation.mode,
    });

    try {
      notifyN8n(
        "proposal.approved",
        p2,
        buildN8nExtra({
          tenantId,
          tenantKey,
          proposal: p2,
          jobId: job?.id || null,
          reason,
          automationMode: automation.mode,
          autoPublish: automation.autoPublish,
        })
      );
    } catch {}

    return okJson(res, {
      ok: true,
      proposal: p2,
      jobId: job?.id || null,
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
