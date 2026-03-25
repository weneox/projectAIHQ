import { okJson, isDbReady, isUuid, nowIso } from "../../../utils/http.js";

import { pushBroadcastToCeo } from "../../../services/pushBroadcast.js";
import { notifyN8n } from "../../../services/n8nNotify.js";
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

export async function feedbackHandler(req, res, { db, wsHub }) {
  const id = String(req.params.id || "").trim();
  const tenantKey = getAuthTenantKey(req) || cleanLower(pickTenantId(req));
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

    const updated = await patchContentItem({
      db,
      id,
      patch: {
        status: "draft.regenerating",
        last_feedback: feedbackText,
      },
      dbReady,
    });

    const proposal = await getProposalById({
      db,
      proposalId: current.proposal_id,
      dbReady,
    });

    const tenantId = pickRuntimeTenantId(updated, current, proposal);

    const job = await createJob({
      db,
      dbReady,
      input: {
        proposalId: current.proposal_id,
        type: "draft.regen",
        status: "queued",
        createdAt: nowIso(),
        input: {
          contentId: updated?.id || current.id,
          proposalId: current.proposal_id,
          feedbackText,
          tenantKey,
          tenantId,
          automationMode: automation.mode,
          autoPublish: automation.autoPublish,
        },
      },
    });

    await patchContentItem({
      db,
      id: updated?.id || current.id,
      patch: {
        job_id: job?.id || current.job_id,
      },
      dbReady,
    });

    if (proposal) {
      notifyN8n("content.revise", proposal, {
        tenantKey,
        tenantId,
        proposalId: String(proposal.id),
        threadId: String(proposal.thread_id || proposal.threadId || ""),
        jobId: job?.id || null,
        contentId: String(updated?.id || current.id),
        feedbackText,
        automationMode: automation.mode,
        autoPublish: automation.autoPublish,
        contentPack: normalizeContentPack(updated?.content_pack || current.content_pack) || {},
        callback: { url: "/api/executions/callback", tokenHeader: "x-webhook-token" },
      });
    }

    const notif = await createNotification({
      db,
      dbReady,
      input: {
        recipient: "ceo",
        type: "info",
        title: "Changes requested",
        body: "Draft yenidən hazırlanır…",
        payload: {
          contentId: id,
          proposalId: current.proposal_id,
          jobId: job?.id || null,
          automationMode: automation.mode,
        },
      },
    });

    const refreshed = await getContentById({ db, id, dbReady });

    wsHub?.broadcast?.({ type: "content.updated", content: refreshed || updated || current });
    if (job) wsHub?.broadcast?.({ type: "execution.updated", execution: job });
    if (notif) wsHub?.broadcast?.({ type: "notification.created", notification: notif });

    if (dbReady) {
      await pushBroadcastToCeo({
        db,
        title: "Draft yenilənir",
        body: "Rəy göndərildi — n8n draftı yenidən hazırlayır.",
        data: {
          type: "draft.regen",
          contentId: id,
          proposalId: current.proposal_id,
          jobId: job?.id || null,
          automationMode: automation.mode,
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
      },
    });

    return okJson(res, {
      ok: true,
      content: refreshed || updated || current,
      jobId: job?.id || null,
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

export async function approveHandler(req, res, { db, wsHub }) {
  const id = String(req.params.id || "").trim();
  const tenantKey = getAuthTenantKey(req) || cleanLower(pickTenantId(req));
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

    if (!isDraftReadyStatus(st)) {
      return okJson(res, {
        ok: false,
        error: "content must be draft.ready before approve",
        status: row.status,
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

    const contentPack = normalizeContentPack(row.content_pack) || {};
    const eventName = pickAssetGenerationEvent(contentPack);
    const jobType = pickAssetGenerationJobType(contentPack);
    const tenantId = pickRuntimeTenantId(row, proposal);

    const job = await createJob({
      db,
      dbReady,
      input: {
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
          tenantKey,
          tenantId,
          automationMode: automation.mode,
          autoPublish: automation.autoPublish,
        },
      },
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

    if (proposal) {
      notifyN8n(
        eventName,
        proposal,
        buildAssetNotifyExtra({
          tenantKey,
          tenantId,
          proposal,
          row: updated || row,
          jobId: job?.id || null,
          contentPack,
          automationMode: automation.mode,
          autoPublish: automation.autoPublish,
        })
      );
    }

    const notif = await createNotification({
      db,
      dbReady,
      input: {
        recipient: "ceo",
        type: "info",
        title: isReelPack(contentPack) ? "Video generating" : "Assets generating",
        body: isReelPack(contentPack)
          ? "Reel/video hazırlanır…"
          : "Şəkil/video/karusel hazırlanır…",
        payload: {
          contentId: row.id,
          proposalId: row.proposal_id,
          jobId: job?.id || null,
          jobType,
          automationMode: automation.mode,
        },
      },
    });

    const refreshed = await getContentById({ db, id: row.id, dbReady });

    wsHub?.broadcast?.({ type: "content.updated", content: refreshed || updated || row });
    if (job) wsHub?.broadcast?.({ type: "execution.updated", execution: job });
    if (notif) wsHub?.broadcast?.({ type: "notification.created", notification: notif });

    if (dbReady) {
      await pushBroadcastToCeo({
        db,
        title: isReelPack(contentPack) ? "Video hazırlanır" : "Asset hazırlanır",
        body: isReelPack(contentPack)
          ? "Approve edildi — reel/video hazırlanır."
          : "Approve edildi — vizual hazırlanır.",
        data: {
          type: "asset.requested",
          contentId: row.id,
          proposalId: proposal?.id || row.proposal_id,
          jobId: job?.id || null,
          jobType,
          automationMode: automation.mode,
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
      },
    });

    return okJson(res, {
      ok: true,
      content: refreshed || updated || row,
      jobId: job?.id || null,
      jobType,
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
    const tenant = buildAnalyzeTenant({ tenantKey, tenantId, contentPack });

    const analysisRun = await kernelHandle({
      agentHint: "critic",
      usecase: "content.analyze",
      message:
        "Analyze this approved content for premium quality, business usefulness, and publish readiness. Return strict JSON only.",
      tenant,
      today: String(nowIso()).slice(0, 10),
      format: packType(contentPack),
      extra: buildAnalyzeExtra({
        row,
        proposal,
        contentPack,
        assetUrls,
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

export async function publishHandler(req, res, { db, wsHub }) {
  const id = String(req.params.id || "").trim();
  const tenantKey = getAuthTenantKey(req) || cleanLower(pickTenantId(req));
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

    if (isPublishRequestedStatus(st)) {
      return okJson(res, {
        ok: true,
        alreadyRequested: true,
        note: "publish already requested",
        status: row.status,
        contentId: row.id || id,
        ...(dbReady ? {} : { dbDisabled: true }),
      });
    }

    if (!canPublishRow(row)) {
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
    const tenantId = pickRuntimeTenantId(row, proposal);

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
          tenantKey,
          tenantId,
          automationMode: automation.mode,
          autoPublish: automation.autoPublish,
        },
      },
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

    if (proposal) {
      notifyN8n(
        "content.publish",
        proposal,
        buildPublishNotifyExtra({
          tenantKey,
          tenantId,
          proposal,
          row,
          jobId: job?.id || null,
          contentPack,
          assetUrl,
          caption,
          automationMode: automation.mode,
          autoPublish: automation.autoPublish,
        })
      );
    }

    const notif = await createNotification({
      db,
      dbReady,
      input: {
        recipient: "ceo",
        type: "info",
        title: "Publish started",
        body: "n8n paylaşımı edir…",
        payload: {
          contentId: row.id || id,
          proposalId: proposal?.id || row.proposal_id,
          jobId: job?.id || null,
          automationMode: automation.mode,
        },
      },
    });

    const refreshed = await getContentById({ db, id: row.id || id, dbReady });

    wsHub?.broadcast?.({ type: "content.updated", content: refreshed || row });
    if (job) wsHub?.broadcast?.({ type: "execution.updated", execution: job });
    if (notif) wsHub?.broadcast?.({ type: "notification.created", notification: notif });

    if (dbReady) {
      await pushBroadcastToCeo({
        db,
        title: "Publish başladı",
        body: "Instagram paylaşımı hazırlanır…",
        data: {
          type: "publish.requested",
          contentId: row.id,
          proposalId: proposal?.id || row.proposal_id,
          jobId: job?.id || null,
          automationMode: automation.mode,
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
      },
    });

    return okJson(res, {
      ok: true,
      jobId: job?.id || null,
      contentId: row.id || id,
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
