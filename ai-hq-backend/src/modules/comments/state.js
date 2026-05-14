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

export function mergeClassificationForReply(
  classification,
  {
    replyText,
    actor,
    approved = true,
    sent = false,
    provider = null,
    sendError = "",
    errorCode = "",
    deliveryStatus = "",
    executionId = "",
    providerMessageId = "",
  }
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
      errorCode: s(errorCode || ""),
      delivery: {
        ...(safeJson(reply.delivery, {})),
        status: s(deliveryStatus || safeJson(reply.delivery, {}).status || ""),
        executionId: s(executionId || safeJson(reply.delivery, {}).executionId || ""),
        providerMessageId: s(
          providerMessageId || safeJson(reply.delivery, {}).providerMessageId || ""
        ),
        updatedAt: nowIso(),
      },
      createdAt: reply.createdAt || nowIso(),
      updatedAt: nowIso(),
    },
  };
}

export function mergeClassificationForReplyPending(
  classification,
  {
    replyText,
    actor,
    approved = true,
    executionId = "",
  }
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
    replySuggestion: s(replyText || reply.text || base.replySuggestion || ""),
    privateReplySuggestion: "",
    moderation: {
      ...moderation,
      status: "replied",
      actor: s(actor || reply.actor || moderation.actor || "operator"),
      approved: Boolean(approved),
      updatedAt: nowIso(),
    },
    reply: {
      ...reply,
      text: s(replyText || reply.text || ""),
      actor: s(actor || reply.actor || "operator"),
      approved: Boolean(approved),
      sent: false,
      provider: {},
      error: "",
      errorCode: "",
      delivery: {
        ...(safeJson(reply.delivery, {})),
        status: "pending",
        executionId: s(executionId || ""),
        providerMessageId: "",
        sentAt: "",
        deadLetter: false,
        updatedAt: nowIso(),
      },
      createdAt: reply.createdAt || nowIso(),
      updatedAt: nowIso(),
    },
  };
}
