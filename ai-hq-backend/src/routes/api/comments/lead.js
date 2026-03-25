import { writeAudit } from "../../../utils/auditLog.js";
import { deepFix } from "../../../utils/textFix.js";
import { s } from "./utils.js";
import { findExistingLeadByComment, insertLeadFromComment } from "./repository.js";

function normalizePriority(v) {
  const x = s(v).toLowerCase();
  if (["low", "normal", "medium", "high", "urgent"].includes(x)) return x;
  return "normal";
}

function normalizeLeadScore(classification = {}) {
  const explicit =
    Number.isFinite(Number(classification?.score))
      ? Number(classification.score)
      : Number.isFinite(Number(classification?.leadScore))
        ? Number(classification.leadScore)
        : null;

  if (explicit !== null) {
    return Math.max(0, Math.min(100, Math.round(explicit)));
  }

  const priority = normalizePriority(classification?.priority);

  if (priority === "urgent") return 95;
  if (priority === "high") return 85;
  if (priority === "medium") return 65;
  return 40;
}

function pickInterest(comment, classification) {
  return (
    s(classification?.reason || "") ||
    s(classification?.category || "") ||
    s(comment?.channel || "") ||
    "sales"
  );
}

export function buildLeadPayloadFromComment(comment, classification) {
  const priority = normalizePriority(classification?.priority);
  const score = normalizeLeadScore(classification);

  return {
    source: "comment",
    sourceRef: s(comment?.external_comment_id || ""),
    fullName: s(comment?.customer_name || "") || null,
    username: s(comment?.external_username || "") || null,
    externalUserId: s(comment?.external_user_id || "") || null,
    interest: pickInterest(comment, classification),
    notes: s(comment?.text || ""),
    stage: "new",
    score,
    status: "open",
    priority: priority === "medium" ? "normal" : priority,
    channel: s(comment?.channel || "") || null,
    extra: {
      fromComment: true,
      commentId: s(comment?.id || ""),
      externalCommentId: s(comment?.external_comment_id || ""),
      externalParentCommentId: s(comment?.external_parent_comment_id || ""),
      postId: s(comment?.external_post_id || ""),
      channel: s(comment?.channel || ""),
      customerName: s(comment?.customer_name || ""),
      externalUsername: s(comment?.external_username || ""),
      externalUserId: s(comment?.external_user_id || ""),
      classificationCategory: s(classification?.category || ""),
      classificationReason: s(classification?.reason || ""),
      sentiment: s(classification?.sentiment || ""),
      requiresHuman: Boolean(classification?.requiresHuman),
      shouldReply: Boolean(classification?.shouldReply),
      shouldPrivateReply: Boolean(classification?.shouldPrivateReply),
      shouldHandoff: Boolean(classification?.shouldHandoff),
      replySuggestion: s(classification?.replySuggestion || ""),
      privateReplySuggestion: s(classification?.privateReplySuggestion || ""),
      classification: deepFix(classification || {}),
    },
  };
}

export async function createLeadFromComment({
  db,
  wsHub,
  tenantKey,
  comment,
  classification,
}) {
  if (!classification?.shouldCreateLead) return null;

  const externalCommentId = s(comment?.external_comment_id || "");
  if (!externalCommentId) return null;

  const existingLead = await findExistingLeadByComment(db, tenantKey, externalCommentId);
  if (existingLead) return existingLead;

  const leadPayload = buildLeadPayloadFromComment(comment, classification);
  const lead = await insertLeadFromComment(db, { tenantKey, leadPayload });

  if (!lead) return null;

  try {
    wsHub?.broadcast?.("lead.created", {
      type: "lead.created",
      lead,
    });
  } catch {}

  try {
    await writeAudit(db, {
      actor: "ai_hq",
      action: "lead.created_from_comment",
      objectType: "lead",
      objectId: String(lead?.id || ""),
      meta: {
        tenantKey,
        commentId: comment?.id,
        externalCommentId,
        channel: s(comment?.channel || ""),
        reason: s(classification?.reason || ""),
        category: s(classification?.category || ""),
        priority: s(classification?.priority || ""),
        score: normalizeLeadScore(classification),
      },
    });
  } catch {}

  return lead;
}