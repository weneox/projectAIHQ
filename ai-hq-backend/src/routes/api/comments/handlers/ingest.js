import { okJson } from "../../../../utils/http.js";
import { getInternalTokenAuthResult } from "../../../../utils/auth.js";
import { setTenantContext } from "../../../../db/tenantContext.js";
import { createLogger } from "../../../../utils/logger.js";
import { deepFix } from "../../../../utils/textFix.js";
import { classifyComment } from "../../../../services/commentBrain.js";
import { enqueueQueueJob } from "../../../../services/queue.js";
import { enforceTenantQuota } from "../../../../services/tenantQuota.js";
import { createDurableExecutionHelpers } from "../../../../db/helpers/durableExecutions.js";
import { buildExecutionIdempotencyKey } from "../../../../services/durableExecutionCore.js";
import {
  commitTenantUsageReservation,
  releaseTenantUsageReservation,
} from "../../../../db/helpers/tenantUsage.js";
import { createLeadFromComment } from "../lead.js";
import {
  getCommentById,
  getExistingCommentByExternalId,
  insertComment,
  updateCommentState,
} from "../repository.js";
import { buildCommentActions } from "../state.js";
import {
  buildCommentTenantSummary,
  emitCommentCreatedRealtime,
  ensureCommentsDb,
  loadStrictCommentRuntime,
  parseIngestRequest,
  validateIngestRequest,
  writeCommentAudit,
} from "./shared.js";

const commentsIngestLog = createLogger({
  service: "ai-hq-backend",
  component: "comments-ingest",
});

function queuedClassification(input = {}) {
  return {
    status: "queued",
    queued: true,
    reason: "webhook_async_processing",
    idempotencyKey: input.idempotencyKey || "",
  };
}

async function enqueueReplyActions({
  db,
  tenant,
  tenantKey,
  comment,
  actions = [],
}) {
  const queued = [];
  const helpers = createDurableExecutionHelpers({ db });

  for (const action of actions) {
    if (action?.type !== "reply_comment") continue;
    const actionPayload = {
      tenantKey,
      actions: [
        {
          type: "reply_comment",
          channel: action.channel || comment?.channel || "instagram",
          commentId: comment?.external_comment_id,
          text: action.text,
          meta: {
            ...(action.meta || {}),
            tenantKey,
            commentId: comment?.id,
            externalCommentId: comment?.external_comment_id,
            externalPostId: comment?.external_post_id,
            actor: "system",
          },
        },
      ],
      context: {
        tenantKey,
        channel: action.channel || comment?.channel || "instagram",
        commentId: comment?.external_comment_id,
        externalCommentId: comment?.external_comment_id,
        externalPostId: comment?.external_post_id,
        recipientId: comment?.external_user_id,
        userId: comment?.external_user_id,
      },
    };

    const execution = await helpers.enqueueExecution({
      tenantId: tenant?.id || comment?.tenant_id || "",
      tenantKey,
      channel: action.channel || comment?.channel || "instagram",
      provider: "meta",
      actionType: "meta.comment.reply",
      targetType: "comment",
      targetId: comment?.id || comment?.external_comment_id,
      conversationId: comment?.external_post_id || comment?.external_comment_id,
      idempotencyKey: buildExecutionIdempotencyKey({
        provider: "meta",
        actionType: "meta.comment.reply",
        commentId: comment?.id,
        externalCommentId: comment?.external_comment_id,
        replyText: action.text,
        actor: "system",
      }),
      payloadSummary: actionPayload,
      safeMetadata: {
        commentId: comment?.id,
        externalCommentId: comment?.external_comment_id,
        externalPostId: comment?.external_post_id,
        externalUserId: comment?.external_user_id,
        replyText: action.text,
        actor: "system",
        approved: true,
      },
      correlationIds: {
        commentId: comment?.id,
        externalCommentId: comment?.external_comment_id,
        externalPostId: comment?.external_post_id,
      },
      maxAttempts: 5,
      nextRetryAt: new Date().toISOString(),
    });

    if (execution?.id) queued.push(execution);
  }

  return queued;
}

export async function processCommentWebhookJob({
  db,
  wsHub,
  payload = {},
  getRuntime,
  classify = classifyComment,
  createLead = createLeadFromComment,
  buildActions = buildCommentActions,
  auditWriter,
  emitEvent,
}) {
  const input = payload.input || {};
  const commentId = String(payload.commentId || "").trim();
  if (!commentId) {
    return {
      ok: false,
      retryable: false,
      errorCode: "comment_missing",
      errorMessage: "comment job missing comment id",
      classification: "invalid_job",
    };
  }

  const comment = await getCommentById(db, commentId, input.tenantKey);
  if (!comment) {
    return {
      ok: false,
      retryable: true,
      errorCode: "comment_missing",
      errorMessage: "comment not found",
      classification: "runtime_missing",
    };
  }

  const runtimeState = await loadStrictCommentRuntime({
    db,
    req: {
      body: {
        tenantKey: input.tenantKey,
      },
      headers: {},
    },
    service: "comments.ingest.worker",
    getRuntime,
  });

  if (!runtimeState.ok) {
    return {
      ok: false,
      retryable: true,
      errorCode: "runtime_authority_unavailable",
      errorMessage: "comment runtime unavailable",
      classification: "runtime_unavailable",
      resultSummary: runtimeState.response || {},
    };
  }

  const { tenant, runtime } = runtimeState;
  const classification = await classify({
    tenantKey: input.tenantKey,
    tenant,
    runtime,
    channel: input.channel,
    externalUserId: input.externalUserId,
    externalUsername: input.externalUsername,
    customerName: input.customerName,
    text: input.text,
  });

  const nextRaw = {
    ...(comment.raw || {}),
    platform: input.platform,
    timestamp: input.timestampMs ?? null,
    raw: input.raw,
    runtime: {
      brandName:
        runtime?.brandName ||
        runtime?.tenant?.profile?.brand_name ||
        runtime?.tenant?.brand?.displayName ||
        runtime?.tenant?.company_name ||
        input.tenantKey,
      services: runtime?.services || [],
      disabledServices: runtime?.disabledServices || [],
      tone: runtime?.tone || "",
      language: runtime?.language || "az",
    },
    asyncProcessing: {
      completedAt: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey || "",
    },
  };

  const updatedComment =
    (await updateCommentState(
      db,
      comment.id,
      classification,
      nextRaw,
      input.tenantKey
    )) || comment;

  emitCommentCreatedRealtime(wsHub, updatedComment, emitEvent);

  await writeCommentAudit(
    db,
    {
      tenantId: tenant?.id || updatedComment?.tenant_id || "",
      tenantKey: input.tenantKey,
      actor: "meta_gateway",
      action: "comment.webhook_processed",
      objectType: "comment",
      objectId: String(updatedComment?.id || ""),
      meta: {
        tenantKey: input.tenantKey,
        channel: input.channel,
        externalCommentId: input.externalCommentId,
        externalPostId: input.externalPostId,
        idempotencyKey: input.idempotencyKey || "",
        classification,
      },
    },
    auditWriter
  );

  let lead = null;
  try {
    lead = await createLead({
      db,
      wsHub,
      tenantKey: input.tenantKey,
      comment: updatedComment,
      classification,
    });
  } catch (error) {
    commentsIngestLog.warn("comment.lead_creation.failed", {
      tenantKey: input.tenantKey,
      commentId: updatedComment?.id || "",
      externalCommentId: input.externalCommentId,
      requestId: input.requestId || "",
      error: String(error?.message || error || "lead_creation_failed"),
    });

    await writeCommentAudit(
      db,
      {
        tenantId: tenant?.id || updatedComment?.tenant_id || "",
        tenantKey: input.tenantKey,
        actor: "system",
        action: "comment.lead_creation_failed",
        objectType: "comment",
        objectId: String(updatedComment?.id || ""),
        meta: {
          error: String(error?.message || error || "lead_creation_failed"),
        },
      },
      auditWriter
    );
  }

  const actions = buildActions({
    tenantKey: input.tenantKey,
    comment: updatedComment,
    classification,
    lead,
  });

  const queuedReplies = await enqueueReplyActions({
    db,
    tenant,
    tenantKey: input.tenantKey,
    comment: updatedComment,
    actions,
  });

  return {
    ok: true,
    retryable: false,
    resultSummary: {
      commentId: updatedComment.id,
      actionCount: actions.length,
      queuedReplyCount: queuedReplies.length,
    },
  };
}

export function ingestCommentHandler({
  db,
  wsHub,
  getRuntime,
  classify = classifyComment,
  createLead = createLeadFromComment,
  getExistingComment = getExistingCommentByExternalId,
  insert = insertComment,
  buildActions = buildCommentActions,
  auditWriter,
  emitEvent,
}) {
  const runInlineCompatibility =
    classify !== classifyComment ||
      createLead !== createLeadFromComment ||
      buildActions !== buildCommentActions;

  async function buildDuplicateResponse({ comment, tenant, input }) {
    let lead = null;
    try {
      lead = await createLead({
        db,
        wsHub,
        tenantKey: input.tenantKey,
        comment,
          classification: comment.classification || {},
        });
    } catch (error) {
      commentsIngestLog.warn("comment.duplicate_lead_creation.failed", {
        tenantKey: input.tenantKey,
        commentId: comment?.id || "",
        externalCommentId: input.externalCommentId,
        error: String(error?.message || error || "lead_creation_failed"),
      });
    }

    const actions = buildActions({
      tenantKey: input.tenantKey,
      comment,
      classification: comment.classification || {},
      lead,
    });

    return {
      ok: true,
      duplicate: true,
      deduped: true,
      comment,
      classification: deepFix(comment.classification || {}),
      actions,
      lead,
      tenant: buildCommentTenantSummary(tenant),
    };
  }

  return async function ingestComment(req, res) {
    const internalAuth = getInternalTokenAuthResult(req, {
      allowedServices: ["meta-bot-backend"],
      allowedAudiences: ["aihq-backend.comments.ingest"],
    });
    if (!internalAuth.ok) {
      return res.status(
        internalAuth.code === "internal_token_not_configured" ? 500 : 401
      ).json({
        ok: false,
        error:
          internalAuth.code === "internal_token_not_configured"
            ? "internal_auth_misconfigured"
            : "unauthorized",
      });
    }

    const input = parseIngestRequest(req);
    const validation = validateIngestRequest(input);
    if (!validation.ok) {
      return res.status(400).json(validation.response);
    }
    setTenantContext({
      tenantKey: input.tenantKey,
      requestId: req.requestId,
      source: "internal.comments.ingest",
    });

    let quotaReservation = null;
    let quotaCommitted = false;
    async function commitQuota(meta = {}) {
      if (!quotaReservation || quotaCommitted) return;
      await commitTenantUsageReservation(db, {
        ...quotaReservation,
        meta: {
          ...(quotaReservation.meta || {}),
          ...meta,
        },
      });
      quotaCommitted = true;
    }

    try {
      if (!ensureCommentsDb(res, db)) {
        return;
      }

      const runtimeState = await loadStrictCommentRuntime({
        db,
        req,
        service: "comments.ingest",
        getRuntime,
      });
      if (!runtimeState.ok) {
        return res.status(runtimeState.response?.status || 503).json(runtimeState.response);
      }

      const { tenant, runtime } = runtimeState;
      setTenantContext({
        tenantId: tenant?.id,
        tenantKey: input.tenantKey,
        requestId: req.requestId,
        source: "internal.comments.ingest",
      });
      req.auth = {
        ...(req.auth || {}),
        tenantId: tenant?.id || "",
        tenantKey: input.tenantKey,
        planKey: tenant?.plan_key || "starter",
        _serverControlled: true,
      };

      const quota = await enforceTenantQuota({
        db,
        req,
        res,
        profile: {
          metric: "webhook_events",
          cost: 1,
          class: "webhook_ingestion",
        },
      });
      if (quota?.ok === false) {
        return res.status(quota.status || 429).json({
          ok: false,
          error: quota.error || "Tenant quota exceeded",
          code: quota.code || "tenant_quota_exceeded",
          requestId: req.requestId || null,
          quota: quota.quota,
        });
      }
      quotaReservation = quota?.reservation || null;

      const existing = await getExistingComment(
        db,
        input.tenantKey,
        input.channel,
        input.externalCommentId
      );

      if (existing) {
        await commitQuota({
          channel: input.channel,
          externalCommentId: input.externalCommentId,
          duplicate: true,
        });
        return okJson(
          res,
          await buildDuplicateResponse({
            comment: existing,
            tenant,
            input,
          })
        );
      }

      const comment = await insert(db, {
        tenantKey: input.tenantKey,
        channel: input.channel,
        source: input.source,
        externalCommentId: input.externalCommentId,
        externalParentCommentId: input.externalParentCommentId,
        externalPostId: input.externalPostId,
        externalUserId: input.externalUserId,
        externalUsername: input.externalUsername,
        customerName: input.customerName,
        text: input.text,
        classification: queuedClassification(input),
        raw: {
          platform: input.platform,
          timestamp: req.body?.timestamp ?? null,
          raw: input.raw,
          asyncProcessing: {
            queuedAt: new Date().toISOString(),
            idempotencyKey: input.idempotencyKey || "",
          },
        },
        timestampMs: input.timestampMs,
      });

      if (comment?.duplicate) {
        await commitQuota({
          channel: input.channel,
          externalCommentId: input.externalCommentId,
          duplicate: true,
        });
        return okJson(
          res,
          await buildDuplicateResponse({
            comment,
            tenant,
            input,
          })
        );
      }

      emitCommentCreatedRealtime(wsHub, comment, emitEvent);

      await writeCommentAudit(
        db,
        {
          tenantId: tenant?.id || comment?.tenant_id || "",
          tenantKey: input.tenantKey,
          actor: "meta_gateway",
          action: "comment.ingested",
          objectType: "comment",
          objectId: String(comment?.id || ""),
          meta: {
            tenantKey: input.tenantKey,
            channel: input.channel,
            externalCommentId: input.externalCommentId,
            externalPostId: input.externalPostId,
            event: "webhook_received",
            idempotencyKey: input.idempotencyKey || "",
          },
        },
        auditWriter
      );

      let compatibility = null;
      if (runInlineCompatibility) {
        const classification = await classify({
          tenantKey: input.tenantKey,
          tenant,
          runtime,
          channel: input.channel,
          externalUserId: input.externalUserId,
          externalUsername: input.externalUsername,
          customerName: input.customerName,
          text: input.text,
        });
        let lead = null;
        try {
          lead = await createLead({
            db,
            wsHub,
          tenantKey: input.tenantKey,
          comment,
          classification,
        });
        } catch (error) {
          commentsIngestLog.warn("comment.compat_lead_creation.failed", {
            tenantKey: input.tenantKey,
            commentId: comment?.id || "",
            externalCommentId: input.externalCommentId,
            error: String(error?.message || error || "lead_creation_failed"),
          });
        }
        compatibility = {
          classification,
          lead,
          actions: buildActions({
            tenantKey: input.tenantKey,
            comment,
            classification,
            lead,
          }),
        };
      }

      const queued = await enqueueQueueJob({
        db,
        tenantId: tenant?.id || comment?.tenant_id || "",
        tenantKey: input.tenantKey,
        queue: "webhook",
        actionType: "comments.webhook.process",
        targetType: "comment",
        targetId: comment?.id || input.externalCommentId,
        payload: {
          input,
          commentId: comment?.id,
        },
        metadata: {
          source: "comments.ingest",
          commentId: comment?.id || "",
          externalCommentId: input.externalCommentId || "",
        },
        correlationIds: {
          requestId: req.requestId || "",
          idempotencyKey: input.idempotencyKey || "",
          commentId: comment?.id || "",
          externalCommentId: input.externalCommentId || "",
        },
        idempotencyKey: input.idempotencyKey,
        maxAttempts: 5,
      });

      await commitQuota({
        channel: input.channel,
        externalCommentId: input.externalCommentId,
        commentId: comment?.id || "",
        queueId: queued?.id || "",
      });

      return okJson(res, {
        ok: true,
        accepted: true,
        queued: true,
        queue: {
          id: queued?.id || null,
          status: queued?.status || null,
          actionType: queued?.action_type || "comments.webhook.process",
        },
        duplicate: false,
        deduped: false,
        comment,
        classification: deepFix(
          compatibility?.classification || comment?.classification || {}
        ),
        actions: compatibility?.actions || [],
        lead: compatibility?.lead || null,
        tenant: buildCommentTenantSummary(tenant),
      });
    } catch (e) {
      if (quotaReservation && !quotaCommitted) {
        await releaseTenantUsageReservation(db, quotaReservation).catch((releaseError) => {
          commentsIngestLog.warn("comment.quota_reservation_release_failed", {
            tenantKey: input?.tenantKey || "",
            externalCommentId: input?.externalCommentId || "",
            error: String(releaseError?.message || releaseError),
          });
        });
      }
      commentsIngestLog.error("comment.ingest.failed", e, {
        tenantKey: input?.tenantKey || "",
        channel: input?.channel || "",
        externalCommentId: input?.externalCommentId || "",
        requestId: req.requestId || "",
      });
      return res.status(500).json({
        ok: false,
        error: "comment_ingest_failed",
        details: { message: String(e?.message || e) },
      });
    }
  };
}
