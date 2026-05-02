import crypto from "node:crypto";

function s(value = "") {
  return String(value ?? "").trim();
}

function lower(value = "") {
  return s(value).toLowerCase();
}

export function buildStableIdempotencyKey(namespace = "default", parts = {}) {
  const entries = Object.entries(parts || {})
    .map(([key, value]) => [key, s(value)])
    .filter(([, value]) => value)
    .sort(([a], [b]) => a.localeCompare(b));

  const raw = JSON.stringify({
    namespace: lower(namespace || "default"),
    entries,
  });

  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function inboundWebhookIdempotencyKey({
  tenantKey = "",
  channel = "",
  provider = "",
  externalThreadId = "",
  externalMessageId = "",
  externalCommentId = "",
  eventType = "",
} = {}) {
  return buildStableIdempotencyKey("inbound_webhook", {
    tenantKey: lower(tenantKey),
    channel: lower(channel),
    provider: lower(provider),
    eventType: lower(eventType),
    externalThreadId,
    externalMessageId,
    externalCommentId,
  });
}

export function outboundDeliveryIdempotencyKey({
  tenantKey = "",
  provider = "",
  channel = "",
  threadId = "",
  messageId = "",
  recipientId = "",
  text = "",
} = {}) {
  return buildStableIdempotencyKey("outbound_delivery", {
    tenantKey: lower(tenantKey),
    provider: lower(provider),
    channel: lower(channel),
    threadId,
    messageId,
    recipientId,
    text,
  });
}

export const __test__ = {
  buildStableIdempotencyKey,
};
