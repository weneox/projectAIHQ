import { emitRealtimeEvent } from "../../realtime/events.js";
import { deepFix } from "../../utils/textFix.js";

function s(v) {
  return String(v ?? "").trim();
}

function safeJson(v, fallback = {}) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return fallback;
  return v;
}

function nowIso() {
  return new Date().toISOString();
}

export function emitCommentUpdatedRealtime(
  wsHub,
  comment,
  emitEvent = emitRealtimeEvent
) {
  try {
    emitEvent(wsHub, {
      type: "comment.updated",
      audience: "operator",
      tenantKey: comment?.tenant_key || comment?.tenantKey,
      tenantId: comment?.tenant_id || comment?.tenantId,
      comment,
    });
  } catch {}
}

export function buildReplyRaw(
  existing,
  {
    replyText,
    actor,
    approved,
    sent,
    provider,
    sendError,
    errorCode = "",
    deliveryStatus = "",
    executionId = "",
    providerMessageId = "",
  }
) {
  return {
    ...(deepFix(existing.raw || {})),
    reply: {
      ...(safeJson(existing.raw?.reply, {})),
      text: replyText,
      actor,
      approved: Boolean(approved),
      sent: Boolean(sent),
      error: sendError,
      errorCode,
      provider: provider || null,
      delivery: {
        ...(safeJson(existing.raw?.reply?.delivery, {})),
        status: deliveryStatus,
        executionId,
        providerMessageId,
        updatedAt: nowIso(),
      },
      createdAt: safeJson(existing.raw?.reply, {}).createdAt || nowIso(),
      updatedAt: nowIso(),
    },
    moderation: {
      ...(safeJson(existing.raw?.moderation, {})),
      status: "replied",
      actor,
      approved: Boolean(approved),
      updatedAt: nowIso(),
    },
  };
}

export function buildReplyPendingRaw(
  existing,
  {
    replyText,
    actor,
    approved,
    executionId = "",
  }
) {
  return {
    ...(deepFix(existing.raw || {})),
    reply: {
      ...(safeJson(existing.raw?.reply, {})),
      text: s(replyText || safeJson(existing.raw?.reply, {}).text || ""),
      actor: s(actor || safeJson(existing.raw?.reply, {}).actor || "operator"),
      approved: Boolean(approved),
      sent: false,
      error: "",
      errorCode: "",
      provider: null,
      delivery: {
        ...(safeJson(existing.raw?.reply?.delivery, {})),
        status: "pending",
        executionId: s(executionId || ""),
        providerMessageId: "",
        sentAt: "",
        deadLetter: false,
        updatedAt: nowIso(),
      },
      createdAt: safeJson(existing.raw?.reply, {}).createdAt || nowIso(),
      updatedAt: nowIso(),
    },
    moderation: {
      ...(safeJson(existing.raw?.moderation, {})),
      status: "replied",
      actor: s(actor || safeJson(existing.raw?.moderation, {}).actor || "operator"),
      approved: Boolean(approved),
      updatedAt: nowIso(),
    },
  };
}
