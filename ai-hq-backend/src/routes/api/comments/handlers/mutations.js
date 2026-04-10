import { okJson, isUuid } from "../../../../utils/http.js";
import { getAuthTenantKey } from "../../../../utils/auth.js";
import { deepFix } from "../../../../utils/textFix.js";
import {
  buildExecutionPolicyDecisionAuditShape,
  evaluateExecutionPolicy,
  mapExecutionOutcomeToDecisionEventType,
} from "../../../../services/executionPolicy.js";
import {
  enqueueMetaCommentReplyExecution,
  mapDurableExecutionToCommentDeliveryStatus,
} from "../../../../services/durableExecutionService.js";
import { safeAppendDecisionEvent } from "../../../../db/helpers/decisionEvents.js";
import { getCommentById, updateCommentState } from "../repository.js";
import {
  mergeClassificationForReview,
  mergeClassificationForReply,
  mergeClassificationForIgnore,
} from "../state.js";
import { s } from "../utils.js";
import {
  buildIgnoreRaw,
  buildOwnedCommentLookupHandler,
  buildReplyRaw,
  buildReviewRaw,
  emitCommentUpdatedRealtime,
  ensureCommentsDb,
  loadStrictCommentRuntime,
  writeCommentAudit,
} from "./shared.js";

const loadOwnedComment = buildOwnedCommentLookupHandler({
  getCommentById,
});

export function reviewCommentHandler({
  db,
  wsHub,
  updateState = updateCommentState,
  getOwnedComment = loadOwnedComment,
  auditWriter,
  emitEvent,
}) {
  return async function reviewCommentRoute(req, res) {
    const id = s(req.params.id || "");
    const tenantKey = getAuthTenantKey(req);
    const status = s(req.body?.status || "reviewed").toLowerCase();
    const actor = s(req.body?.actor || "operator");
    const note = s(req.body?.note || "");
    const reason = s(req.body?.reason || "");

    if (!id) return okJson(res, { ok: false, error: "comment id required" });
    if (!isUuid(id)) return okJson(res, { ok: false, error: "comment id must be uuid" });
    if (!["reviewed", "pending", "flagged", "approved", "manual_review"].includes(status)) {
      return okJson(res, { ok: false, error: "invalid review status" });
    }

    try {
      if (!ensureCommentsDb(res, db)) {
        return;
      }

      const ownedComment = await getOwnedComment({ db, id, tenantKey });
      if (!ownedComment.ok) {
        return okJson(res, ownedComment.response);
      }

      const existing = ownedComment.comment;
      const nextClassification = mergeClassificationForReview(existing.classification, {
        status,
        actor,
        note,
        reason,
      });
      const nextRaw = buildReviewRaw(existing, { status, actor, note, reason });
      const comment = await updateState(db, id, nextClassification, nextRaw);

      emitCommentUpdatedRealtime(wsHub, comment, emitEvent);
      await writeCommentAudit(
        db,
        {
          actor,
          action: "comment.reviewed",
          objectType: "comment",
          objectId: String(comment?.id || ""),
          meta: { status, note, reason },
        },
        auditWriter
      );

      return okJson(res, { ok: true, comment });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  };
}

export function replyCommentHandler({
  db,
  wsHub,
  enqueueReplyExecution = enqueueMetaCommentReplyExecution,
  updateState = updateCommentState,
  getOwnedComment = loadOwnedComment,
  getRuntime,
  auditWriter,
  emitEvent,
}) {
  return async function replyCommentRoute(req, res) {
    const id = s(req.params.id || "");
    const tenantKey = getAuthTenantKey(req);
    const replyText = s(req.body?.replyText || req.body?.text || "");
    const actor = s(req.body?.actor || "operator");
    const approved = req.body?.approved !== false;
    const executeNow = req.body?.executeNow !== false;

    if (!id) return okJson(res, { ok: false, error: "comment id required" });
    if (!isUuid(id)) return okJson(res, { ok: false, error: "comment id must be uuid" });
    if (!replyText) return okJson(res, { ok: false, error: "replyText required" });

    try {
      if (!ensureCommentsDb(res, db)) {
        return;
      }

      const ownedComment = await getOwnedComment({ db, id, tenantKey });
      if (!ownedComment.ok) {
        return okJson(res, ownedComment.response);
      }

      const existing = ownedComment.comment;
      let runtimeState = null;
      let executionPolicy = null;

      if (executeNow) {
        runtimeState = await loadStrictCommentRuntime({
          db,
          req,
          service: "comments.reply",
          getRuntime,
        });

        if (!runtimeState.ok) {
          return okJson(res, {
            ...runtimeState.response,
            executionPolicy: {
              outcome: "blocked_until_repair",
              requiredExecutionLevel: "blocked_until_repair",
              blockedUntilRepair: true,
              reasonCodes: ["runtime_authority_unavailable"],
            },
          });
        }

        executionPolicy = evaluateExecutionPolicy({
          runtime: runtimeState.runtime,
          action: {
            type: "reply_comment",
            text: replyText,
            meta: {
              intent: "comment_reply",
              category: s(existing?.classification?.category || ""),
            },
          },
          surface: "comments",
          channelType: s(existing.channel || "instagram").toLowerCase() || "instagram",
          actorType: actor || "operator",
        });

        const decisionAudit = buildExecutionPolicyDecisionAuditShape({
          tenantId: s(existing?.tenant_id || runtimeState?.tenant?.id),
          tenantKey: s(existing?.tenant_key || tenantKey),
          source: "comments.reply",
          actor: actor || "operator",
          surface: "comments",
          channelType: s(existing.channel || "instagram").toLowerCase() || "instagram",
          runtime: runtimeState.runtime,
          decision: executionPolicy,
          action: {
            type: "reply_comment",
            meta: {
              intent: "comment_reply",
            },
          },
        });

        await safeAppendDecisionEvent(db, {
          ...decisionAudit,
          decisionContext: {
            ...decisionAudit.decisionContext,
            commentId: s(existing?.id),
            externalCommentId: s(existing?.external_comment_id),
            executeNow: Boolean(executeNow),
            approved: Boolean(approved),
          },
        });

        if (executionPolicy.blocked || executionPolicy.blockedUntilRepair) {
          const blockedDecisionAudit = buildExecutionPolicyDecisionAuditShape({
            tenantId: s(existing?.tenant_id || runtimeState?.tenant?.id),
            tenantKey: s(existing?.tenant_key || tenantKey),
            source: "comments.reply",
            actor: actor || "operator",
            surface: "comments",
            channelType:
              s(existing.channel || "instagram").toLowerCase() || "instagram",
            runtime: runtimeState.runtime,
            decision: executionPolicy,
            action: {
              type: "reply_comment",
              meta: {
                intent: "comment_reply",
              },
            },
          });

          await safeAppendDecisionEvent(db, {
            ...blockedDecisionAudit,
            eventType: mapExecutionOutcomeToDecisionEventType(executionPolicy.outcome),
            decisionContext: {
              ...blockedDecisionAudit.decisionContext,
              commentId: s(existing?.id),
              externalCommentId: s(existing?.external_comment_id),
              executeNow: Boolean(executeNow),
              approved: Boolean(approved),
            },
          });
          return okJson(res, {
            ok: false,
            error: "execution_policy_blocked",
            executionPolicy,
          });
        }
      }

      let queuedExecution = null;
      let deliveryStatus = executeNow ? "pending" : "";
      let sent = false;
      let sendError = "";

      if (executeNow) {
        queuedExecution = await enqueueReplyExecution({
          db,
          tenantId: s(existing?.tenant_id || runtimeState?.tenant?.id),
          tenantKey: s(existing.tenant_key || tenantKey),
          channel: s(existing.channel || "instagram").toLowerCase() || "instagram",
          provider: "meta",
          commentId: s(existing.id || ""),
          externalCommentId: s(existing.external_comment_id || ""),
          externalPostId: s(existing.external_post_id || ""),
          externalUserId: s(existing.external_user_id || ""),
          replyText,
          actor,
          approved,
          maxAttempts: 5,
        });
        deliveryStatus = mapDurableExecutionToCommentDeliveryStatus(
          queuedExecution?.status
        );
        sent = deliveryStatus === "sent";
        sendError = s(queuedExecution?.last_error_message || "");
      }

      const nextClassification = mergeClassificationForReply(existing.classification, {
        replyText,
        actor,
        approved,
        sent,
        provider: null,
        sendError,
        deliveryStatus,
        executionId: s(queuedExecution?.id || ""),
      });
      const nextRaw = buildReplyRaw(existing, {
        replyText,
        actor,
        approved,
        sent,
        provider: null,
        sendError,
        deliveryStatus,
        executionId: s(queuedExecution?.id || ""),
      });
      const comment = await updateState(db, id, nextClassification, nextRaw);

      emitCommentUpdatedRealtime(wsHub, comment, emitEvent);
      await writeCommentAudit(
        db,
        {
          actor,
          action: executeNow ? "comment.reply_requested" : "comment.reply_saved",
          objectType: "comment",
          objectId: String(comment?.id || ""),
          meta: {
            approved: Boolean(approved),
            replyText,
            executeNow: Boolean(executeNow),
            sent: Boolean(sent),
            replyQueued: Boolean(executeNow && deliveryStatus === "pending"),
            sendError,
            deliveryStatus,
            executionId: s(queuedExecution?.id || ""),
            durableExecutionStatus: s(queuedExecution?.status || ""),
            executionPolicy,
          },
        },
        auditWriter
      );

      return okJson(res, {
        ok: true,
        comment,
        replyQueued: Boolean(executeNow && deliveryStatus === "pending"),
        replySaved: true,
        replySent: Boolean(sent),
        replyError: sendError || null,
        executionPolicy,
        durableExecution: queuedExecution,
        gateway: null,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  };
}

export function ignoreCommentHandler({
  db,
  wsHub,
  updateState = updateCommentState,
  getOwnedComment = loadOwnedComment,
  auditWriter,
  emitEvent,
}) {
  return async function ignoreCommentRoute(req, res) {
    const id = s(req.params.id || "");
    const tenantKey = getAuthTenantKey(req);
    const actor = s(req.body?.actor || "operator");
    const note = s(req.body?.note || "");

    if (!id) return okJson(res, { ok: false, error: "comment id required" });
    if (!isUuid(id)) return okJson(res, { ok: false, error: "comment id must be uuid" });

    try {
      if (!ensureCommentsDb(res, db)) {
        return;
      }

      const ownedComment = await getOwnedComment({ db, id, tenantKey });
      if (!ownedComment.ok) {
        return okJson(res, ownedComment.response);
      }

      const existing = ownedComment.comment;
      const nextClassification = mergeClassificationForIgnore(existing.classification, {
        actor,
        note,
      });
      const nextRaw = buildIgnoreRaw(existing, { actor, note });
      const comment = await updateState(db, id, nextClassification, nextRaw);

      emitCommentUpdatedRealtime(wsHub, comment, emitEvent);
      await writeCommentAudit(
        db,
        {
          actor,
          action: "comment.ignored",
          objectType: "comment",
          objectId: String(comment?.id || ""),
          meta: { note },
        },
        auditWriter
      );

      return okJson(res, { ok: true, comment });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  };
}
