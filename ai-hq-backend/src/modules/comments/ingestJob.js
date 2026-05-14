import { createDurableExecutionHelpers } from "../../db/helpers/durableExecutions.js";
import { buildExecutionIdempotencyKey } from "../../services/durableExecutionCore.js";
import { classifyComment } from "../../services/commentBrain.js";
import { createLogger } from "../../utils/logger.js";
import { createLeadFromComment } from "./lead.js";
import {
  getCommentById,
  updateCommentState,
} from "./repository.js";
import { buildCommentActions } from "./state.js";
import {
  emitCommentCreatedRealtime,
  loadStrictCommentRuntime,
  writeCommentAudit,
} from "./shared.js";

const commentsIngestLog = createLogger({
  service: "ai-hq-backend",
  component: "comments-ingest",
});

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
