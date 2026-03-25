import { deepFix } from "../../../utils/textFix.js";
import { nowIso, s, safeJson } from "./utils.js";

function normalizePriority(v) {
  const x = s(v).toLowerCase();
  if (["low", "normal", "medium", "high", "urgent"].includes(x)) {
    return x === "medium" ? "normal" : x;
  }
  return "normal";
}

function buildBaseMeta(tenantKey, comment, classification) {
  return {
    tenantKey: s(tenantKey || ""),
    commentId: s(comment?.id || ""),
    externalCommentId: s(comment?.external_comment_id || ""),
    externalPostId: s(comment?.external_post_id || ""),
    externalUserId: s(comment?.external_user_id || ""),
    externalUsername: s(comment?.external_username || ""),
    customerName: s(comment?.customer_name || ""),
    classification: deepFix(classification || {}),
  };
}

export function buildCommentActions({ tenantKey, comment, classification, lead = null }) {
  const actions = [];
  const channel = s(comment?.channel || "instagram").toLowerCase() || "instagram";
  const externalCommentId = s(comment?.external_comment_id || "");
  const replyText = s(classification?.replySuggestion || "");
  const privateReplyText = s(classification?.privateReplySuggestion || "");
  const reason = s(classification?.reason || "");
  const category = s(classification?.category || "");
  const priority = normalizePriority(classification?.priority || "normal");
  const moderation = safeJson(classification?.moderation, {});
  const moderationStatus = s(moderation?.status || "").toLowerCase();

  const baseMeta = buildBaseMeta(tenantKey, comment, classification);

  if (["ignored", "replied"].includes(moderationStatus)) {
    return [
      {
        type: "no_reply",
        channel,
        reason: moderationStatus === "ignored" ? "comment_ignored" : "already_replied",
        meta: {
          ...baseMeta,
          moderation,
        },
      },
    ];
  }

  if (category === "spam" || category === "toxic") {
    actions.push({
      type: "no_reply",
      channel,
      reason: reason || (category === "spam" ? "spam_suppressed" : "toxic_suppressed"),
      meta: baseMeta,
    });

    if (classification?.shouldHandoff) {
      actions.push({
        type: "handoff",
        channel,
        reason: category === "toxic" ? "toxic_comment_manual_review" : "manual_review",
        priority: category === "toxic" ? "high" : priority,
        meta: baseMeta,
      });
    }

    return actions;
  }

  if (classification?.shouldReply && replyText && externalCommentId) {
    actions.push({
      type: "reply_comment",
      channel,
      commentId: externalCommentId,
      text: replyText,
      meta: baseMeta,
    });
  }

  if (classification?.shouldPrivateReply && privateReplyText && externalCommentId) {
    actions.push({
      type: "private_reply_comment",
      channel,
      commentId: externalCommentId,
      text: privateReplyText,
      meta: {
        ...baseMeta,
        skipOutboundAck: true,
      },
    });
  }

  if (classification?.shouldCreateLead) {
    actions.push({
      type: "create_lead",
      channel,
      reason: reason || "comment_sales_intent",
      lead: lead ? deepFix(lead) : null,
      meta: {
        ...baseMeta,
        leadId: s(lead?.id || ""),
      },
    });
  }

  if (classification?.shouldHandoff) {
    actions.push({
      type: "handoff",
      channel,
      reason:
        category === "support"
          ? "support_comment_manual_followup"
          : reason || "manual_review",
      priority:
        priority === "urgent"
          ? "urgent"
          : priority === "high"
            ? "high"
            : "normal",
      meta: baseMeta,
    });
  }

  if (!actions.length) {
    actions.push({
      type: "no_reply",
      channel,
      reason: reason || "no_action_needed",
      meta: baseMeta,
    });
  }

  return actions;
}

export function mergeClassificationForReview(
  classification,
  { status, actor, note, reason }
) {
  const base = deepFix(classification || {});
  const moderation = safeJson(base.moderation, {});

  return {
    ...base,
    moderation: {
      ...moderation,
      status: s(status || moderation.status || "reviewed"),
      actor: s(actor || moderation.actor || "operator"),
      note: s(note || moderation.note || ""),
      reason: s(reason || moderation.reason || ""),
      updatedAt: nowIso(),
    },
  };
}

export function mergeClassificationForReply(
  classification,
  { replyText, actor, approved = true, sent = false, provider = null, sendError = "" }
) {
  const base = deepFix(classification || {});
  const moderation = safeJson(base.moderation, {});
  const reply = safeJson(base.reply, {});

  return {
    ...base,
    shouldReply: false,
    shouldPrivateReply: false,
    shouldCreateLead: false,
    shouldHandoff: false,
    replySuggestion: s(replyText || ""),
    privateReplySuggestion: "",
    moderation: {
      ...moderation,
      status: "replied",
      actor: s(actor || "operator"),
      approved: Boolean(approved),
      updatedAt: nowIso(),
    },
    reply: {
      ...reply,
      text: s(replyText || ""),
      actor: s(actor || "operator"),
      approved: Boolean(approved),
      sent: Boolean(sent),
      provider: provider ? deepFix(provider) : safeJson(reply.provider, {}),
      error: s(sendError || ""),
      createdAt: reply.createdAt || nowIso(),
      updatedAt: nowIso(),
    },
  };
}

export function mergeClassificationForIgnore(classification, { actor, note }) {
  const base = deepFix(classification || {});
  const moderation = safeJson(base.moderation, {});

  return {
    ...base,
    shouldReply: false,
    shouldPrivateReply: false,
    shouldCreateLead: false,
    shouldHandoff: false,
    replySuggestion: "",
    privateReplySuggestion: "",
    moderation: {
      ...moderation,
      status: "ignored",
      actor: s(actor || "operator"),
      note: s(note || ""),
      updatedAt: nowIso(),
    },
  };
}