import { getResolvedTenantKey, s } from "./shared.js";

export function buildMeta({ tenantKey, thread, message, intent, score = 0, extra = {} }) {
  return {
    tenantKey: getResolvedTenantKey(tenantKey),
    threadId: s(thread?.id),
    messageId: s(message?.id),
    intent: s(intent || "general"),
    score: Number(score || 0),
    handoffActive: Boolean(thread?.handoff_active),
    ...extra,
  };
}

export function sendMessageAction({ channel, recipientId, text, meta }) {
  return {
    type: "send_message",
    channel: s(channel || "instagram").toLowerCase() || "instagram",
    recipientId: s(recipientId),
    text: s(text),
    meta: meta || {},
  };
}

export function createLeadAction({ channel, externalUserId, thread, text, intent, meta }) {
  return {
    type: "create_lead",
    channel: s(channel || "instagram").toLowerCase() || "instagram",
    externalUserId: s(externalUserId),
    threadId: s(thread?.id),
    lead: {
      source: "meta",
      channel: s(channel || "instagram").toLowerCase() || "instagram",
      externalUserId: s(externalUserId),
      threadId: s(thread?.id),
      summary: s(text).slice(0, 500),
      intent: s(intent || "general"),
    },
    meta: meta || {},
  };
}

export function handoffAction({ channel, externalUserId, thread, reason, priority = "normal", meta }) {
  return {
    type: "handoff",
    channel: s(channel || "instagram").toLowerCase() || "instagram",
    externalUserId: s(externalUserId),
    threadId: s(thread?.id),
    reason: s(reason || "manual_review"),
    priority: s(priority || "normal"),
    meta: meta || {},
  };
}

export function noReplyAction({ reason, meta }) {
  return {
    type: "no_reply",
    reason: s(reason || "rule_suppressed"),
    meta: meta || {},
  };
}

export function markSeenAction({ channel, recipientId, meta }) {
  return {
    type: "mark_seen",
    channel: s(channel || "instagram").toLowerCase() || "instagram",
    recipientId: s(recipientId),
    meta: meta || {},
  };
}

export function typingOnAction({ channel, recipientId, meta }) {
  return {
    type: "typing_on",
    channel: s(channel || "instagram").toLowerCase() || "instagram",
    recipientId: s(recipientId),
    meta: meta || {},
  };
}

export function typingOffAction({ channel, recipientId, meta }) {
  return {
    type: "typing_off",
    channel: s(channel || "instagram").toLowerCase() || "instagram",
    recipientId: s(recipientId),
    meta: meta || {},
  };
}