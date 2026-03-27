import { okJson, isUuid } from "../../../../utils/http.js";
import { getAuthTenantKey } from "../../../../utils/auth.js";
import { deepFix } from "../../../../utils/textFix.js";
import { forwardCommentReplyToMetaGateway } from "../gateway.js";
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
  forwardReply = forwardCommentReplyToMetaGateway,
  updateState = updateCommentState,
  getOwnedComment = loadOwnedComment,
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
      let sendResult = null;
      let sent = false;
      let sendError = "";

      if (executeNow) {
        sendResult = await forwardReply({
          tenantKey: existing.tenant_key,
          channel: existing.channel,
          comment: existing,
          actions: [
            {
              type: "reply_comment",
              channel: s(existing.channel || "instagram").toLowerCase() || "instagram",
              commentId: s(existing.external_comment_id || ""),
              text: replyText,
              meta: {
                tenantKey: s(existing.tenant_key || ""),
                commentId: s(existing.id || ""),
                externalCommentId: s(existing.external_comment_id || ""),
                externalPostId: s(existing.external_post_id || ""),
                actor: s(actor || "operator"),
              },
            },
          ],
        });

        sent = Boolean(sendResult?.ok);
        sendError = sent ? "" : s(sendResult?.error || "");
      }

      const nextClassification = mergeClassificationForReply(existing.classification, {
        replyText,
        actor,
        approved,
        sent,
        provider: sendResult?.json || null,
        sendError,
      });
      const nextRaw = buildReplyRaw(existing, {
        replyText,
        actor,
        approved,
        sent,
        provider: sendResult?.json || null,
        sendError,
      });
      const comment = await updateState(db, id, nextClassification, nextRaw);

      emitCommentUpdatedRealtime(wsHub, comment, emitEvent);
      await writeCommentAudit(
        db,
        {
          actor,
          action: sent ? "comment.reply_sent" : "comment.reply_saved",
          objectType: "comment",
          objectId: String(comment?.id || ""),
          meta: {
            approved: Boolean(approved),
            replyText,
            executeNow: Boolean(executeNow),
            sent: Boolean(sent),
            sendError,
            gatewayStatus: Number(sendResult?.status || 0),
          },
        },
        auditWriter
      );

      return okJson(res, {
        ok: true,
        comment,
        replyQueued: false,
        replySaved: true,
        replySent: Boolean(sent),
        replyError: sendError || null,
        gateway: sendResult
          ? {
              ok: Boolean(sendResult.ok),
              status: Number(sendResult.status || 0),
              error: sendResult.error || null,
              skipped: Boolean(sendResult.skipped),
            }
          : null,
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
