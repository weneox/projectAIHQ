import crypto from "crypto";

import {
  enqueueChannelOutboundExecution,
} from "../../../../services/durableExecutionService.js";
import { outboundDeliveryIdempotencyKey } from "../../../../utils/idempotency.js";
import { createOutboundAttempt } from "../repository.js";
import { normalizeMessage, s } from "../shared.js";
import { lower, normalizeArr, normalizeObj, nowIso } from "./shared.js";

const META_PROVIDER = "meta";
const TELEGRAM_PROVIDER = "telegram";
const WEBSITE_WIDGET_PROVIDER = "website_widget";

const STORED_INBOX_MESSAGE_TYPES = new Set([
  "text",
  "image",
  "video",
  "audio",
  "file",
  "document",
  "voice",
  "sticker",
  "gif",
  "location",
  "contact",
  "story_reply",
  "reaction",
  "button",
  "interactive",
  "system",
  "other",
]);

export function isControlMessageType(value) {
  const x = lower(value);
  return ["typing_on", "typing_off", "mark_seen"].includes(x);
}

export function normalizeInboxMessageType(value, fallback = "text") {
  const x = lower(value || fallback);
  const fb = lower(fallback || "text") || "text";

  if (!x) return STORED_INBOX_MESSAGE_TYPES.has(fb) ? fb : "text";
  if (STORED_INBOX_MESSAGE_TYPES.has(x)) return x;
  if (["attachment", "attachments", "doc"].includes(x)) return "file";
  if (["voice_note", "voice-message", "voice_message"].includes(x)) return "voice";
  if (["story-reply", "storyreply"].includes(x)) return "story_reply";
  if (
    [
      "template",
      "template_message",
      "template-message",
      "quick_reply",
      "quick-reply",
      "carousel",
      "list",
    ].includes(x)
  ) {
    return "interactive";
  }
  if (isControlMessageType(x)) return "system";
  if (["typing", "typing_start", "typing-start", "typingon", "typing-on"].includes(x)) {
    return "system";
  }
  if (
    ["typing_stop", "typing-stop", "typingoff", "typing-off", "seen", "read", "markseen", "mark-seen"].includes(
      x
    )
  ) {
    return "system";
  }
  if (["unknown", "unsupported"].includes(x)) {
    return STORED_INBOX_MESSAGE_TYPES.has(fb) ? fb : "other";
  }
  return STORED_INBOX_MESSAGE_TYPES.has(fb) ? fb : "text";
}

function resolveExecutionProvider({ provider = "", channel = "", action = {} } = {}) {
  const explicit =
    lower(provider) ||
    lower(action?.provider) ||
    lower(action?.meta?.provider);

  if (explicit) return explicit;
  if (["web", "webchat", "website", WEBSITE_WIDGET_PROVIDER].includes(lower(channel))) {
    return WEBSITE_WIDGET_PROVIDER;
  }
  if (lower(channel) === TELEGRAM_PROVIDER) return TELEGRAM_PROVIDER;
  return META_PROVIDER;
}

const CUSTOMER_VISIBLE_EXECUTION_ACTIONS = new Set(["send_message"]);
const PROVIDER_CONTROL_ACTIONS = new Set(["typing_on", "typing_off", "mark_seen"]);

export function isProviderControlExecutionAction(action = {}) {
  return PROVIDER_CONTROL_ACTIONS.has(lower(action?.type));
}

export function supportedExecutionAction(action = {}) {
  const type = lower(action?.type);
  return CUSTOMER_VISIBLE_EXECUTION_ACTIONS.has(type);
}

export function mapActionToMessageType(action = {}) {
  const type = lower(action?.type);

  if (type === "send_message") {
    return lower(action?.messageType || action?.message_type || action?.meta?.messageType || "text") || "text";
  }
  if (type === "typing_on") return "typing_on";
  if (type === "typing_off") return "typing_off";
  if (type === "mark_seen") return "mark_seen";

  return "text";
}

export function mapActionToSenderType(action = {}) {
  const type = lower(action?.type);
  if (type === "send_message") {
    return lower(action?.senderType || action?.sender_type || action?.meta?.senderType || "ai") || "ai";
  }
  return lower(action?.senderType || action?.sender_type || action?.meta?.senderType || "system") || "system";
}

export function buildOutboundAttemptPayload({
  threadId,
  tenantKey,
  channel,
  provider,
  recipientId,
  senderType,
  messageType,
  storageMessageType,
  text,
  attachments,
  meta,
}) {
  const requestedMessageType = lower(messageType || "text") || "text";
  const storedType = normalizeInboxMessageType(
    storageMessageType || requestedMessageType || "text",
    "text"
  );

  return {
    threadId: s(threadId || ""),
    tenantKey: s(tenantKey || ""),
    provider: lower(provider || META_PROVIDER) || META_PROVIDER,
    channel: s(channel || "instagram").toLowerCase() || "instagram",
    recipientId: s(recipientId || "") || null,
    senderType: s(senderType || "ai").toLowerCase() || "ai",
    messageType: requestedMessageType,
    storageMessageType: storedType,
    text: s(text || ""),
    attachments: Array.isArray(attachments) ? attachments : [],
    meta: meta && typeof meta === "object" ? meta : {},
  };
}

export async function persistOutboundMessage({
  client,
  thread,
  tenantId,
  tenantKey,
  channel,
  recipientId,
  senderType,
  externalMessageId = null,
  requestedMessageType = "text",
  storageMessageType = null,
  text = "",
  attachments = [],
  meta = {},
  provider = "",
  maxAttempts = 5,
  enqueueExecution = true,
  createAttempt = createOutboundAttempt,
  enqueueOutboundExecution = enqueueChannelOutboundExecution,
}) {
  if (!tenantId || !tenantKey) {
    const error = new Error("persistOutboundMessage requires tenant identity");
    error.code = "TENANT_CONTEXT_REQUIRED";
    throw error;
  }

  const resolvedProvider = resolveExecutionProvider({ provider, channel });
  const autoDeliveredProvider =
    resolvedProvider === WEBSITE_WIDGET_PROVIDER && !s(externalMessageId);
  const providerMessageId =
    s(externalMessageId) ||
    (autoDeliveredProvider
      ? `website-widget:${typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now()}`
      : null);
  const messageType = normalizeInboxMessageType(
    storageMessageType || requestedMessageType || "text",
    "text"
  );
  const originalMeta = normalizeObj(meta);
  const releaseThreadHandoff = Boolean(
    originalMeta.releaseHandoff === true ||
      originalMeta.release_handoff === true ||
      originalMeta.resumeAutomation === true ||
      originalMeta.resume_automation === true
  );
  const deliveryStatus = providerMessageId ? "sent" : "pending";
  const sentAt = providerMessageId ? nowIso() : null;

  const mergedMeta = {
    ...originalMeta,
    recipientId,
    provider: resolvedProvider,
    originalMessageType: requestedMessageType,
    storageMessageType: messageType,
    delivery: {
      status: deliveryStatus,
      provider: resolvedProvider,
      pending: !providerMessageId,
      failed: false,
      providerMessageId: s(providerMessageId || "") || null,
      updatedAt: sentAt,
    },
  };

  const inserted = await client.query(
    `
    insert into inbox_messages (
      thread_id, tenant_id, tenant_key, direction, sender_type, external_message_id,
      message_type, text, attachments, sent_at, meta
    )
    values (
      $1::uuid, $2::uuid, $3::text, 'outbound', $4::text, $5::text,
      $6::text, $7::text, $8::jsonb, $9::timestamptz, $10::jsonb
    )
    returning
      id, thread_id, tenant_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    `,
    [
      thread.id,
      tenantId,
      tenantKey,
      senderType,
      providerMessageId,
      messageType,
      text,
      JSON.stringify(Array.isArray(attachments) ? attachments : []),
      sentAt,
      JSON.stringify(mergedMeta),
    ]
  );

  const message = normalizeMessage(inserted.rows?.[0] || null);

  await client.query(
    `
    update inbox_threads
    set
      tenant_id = coalesce(tenant_id, nullif($5::text, '')::uuid),
      last_message_at = case
        when $4::text in (
          'text','image','video','audio','file','document','voice',
          'sticker','gif','location','contact','story_reply',
          'reaction','button','interactive'
        )
          then now()
        else last_message_at
      end,
      last_outbound_at = now(),
      external_user_id = coalesce($2::text, external_user_id),
      updated_at = now(),
      handoff_active = case when $3::text in ('agent','operator') and $6::boolean then false else handoff_active end,
      handoff_reason = case when $3::text in ('agent','operator') and $6::boolean then '' else handoff_reason end,
      handoff_priority = case when $3::text in ('agent','operator') and $6::boolean then 'normal' else handoff_priority end,
      handoff_at = case when $3::text in ('agent','operator') and $6::boolean then null else handoff_at end,
      handoff_by = case when $3::text in ('agent','operator') and $6::boolean then null else handoff_by end,
      meta = case
        when $3::text in ('agent','operator') and $6::boolean then
          jsonb_set(
            coalesce(meta, '{}'::jsonb),
            '{handoff}',
            '{"active":false,"reason":"","priority":"normal","at":null,"by":null}'::jsonb,
            true
          )
        else coalesce(meta, '{}'::jsonb)
      end
    where id = $1::uuid
      and tenant_key = $7::text
    `,
    [thread.id, recipientId, senderType, messageType, tenantId, releaseThreadHandoff, tenantKey]
  );

  const attemptPayload = buildOutboundAttemptPayload({
    threadId: thread.id,
    tenantKey,
    channel,
    provider: resolvedProvider,
    recipientId,
    senderType,
    messageType: requestedMessageType,
    storageMessageType: messageType,
    text,
    attachments,
    meta: mergedMeta,
  });
  const idempotencyKey = outboundDeliveryIdempotencyKey({
    tenantKey,
    provider: resolvedProvider,
    channel,
    threadId: thread.id,
    messageId: message.id,
    recipientId,
    text,
  });
  attemptPayload.meta = {
    ...(attemptPayload.meta || {}),
    idempotencyKey,
  };

  const attempt = await createAttempt({
    db: client,
    messageId: message.id,
    threadId: thread.id,
    tenantId,
    tenantKey,
    channel,
    provider: resolvedProvider,
    recipientId,
    idempotencyKey,
    payload: attemptPayload,
    status: providerMessageId ? "sent" : "pending",
    maxAttempts,
    nextRetryAt: providerMessageId ? null : nowIso(),
  });

  if (enqueueExecution && !providerMessageId) {
    await enqueueOutboundExecution({
      db: client,
      tenantId,
      tenantKey,
      channel,
      provider: resolvedProvider,
      threadId: thread.id,
      messageId: message.id,
      payload: attemptPayload,
      safeMetadata: {
        provider: resolvedProvider,
        inboxOutboundAttemptId: s(attempt?.id),
        threadId: thread.id,
        messageId: message.id,
        recipientId,
      },
      correlationIds: {
        threadId: thread.id,
        messageId: message.id,
        outboundAttemptId: s(attempt?.id),
      },
      maxAttempts,
    });
  }

  return {
    message,
    attempt,
    mergedMeta,
    messageType,
    provider: resolvedProvider,
  };
}

export async function queueOutboundAction({
  client,
  thread,
  tenantId,
  tenantKey,
  channel,
  action,
  provider = "",
  createAttempt,
  enqueueOutboundExecution,
}) {
  if (!client || !thread?.id || !supportedExecutionAction(action)) return null;

  const actionType = lower(action?.type);
  const resolvedProvider = resolveExecutionProvider({
    provider,
    channel,
    action,
  });
  const recipientId =
    s(action?.recipientId || action?.recipient_id || thread?.external_user_id || thread?.external_thread_id || "") ||
    null;
  const senderType = mapActionToSenderType(action);
  const requestedMessageType = mapActionToMessageType(action);
  const text = actionType === "send_message" ? s(action?.text || "") : "";
  const attachments =
    actionType === "send_message" && Array.isArray(action?.attachments)
      ? action.attachments
      : [];
  const meta = {
    ...normalizeObj(action?.meta),
    provider: resolvedProvider,
    actionType,
    internalExecution: true,
  };

  const delivery = await persistOutboundMessage({
    client,
    thread,
    tenantId,
    tenantKey,
    channel,
    recipientId,
    senderType,
    requestedMessageType,
    text,
    attachments,
    meta,
    provider: resolvedProvider,
    maxAttempts: 5,
    enqueueExecution: true,
    createAttempt,
    enqueueOutboundExecution,
  });

  return {
    actionType,
    provider: resolvedProvider,
    message: delivery.message,
    attempt: delivery.attempt,
  };
}

export async function queueExecutionActions({
  client,
  thread,
  tenantId,
  tenantKey,
  channel,
  provider = "",
  actions,
  createAttempt,
  enqueueOutboundExecution,
}) {
  const results = [];

  for (const action of normalizeArr(actions)) {
    if (!supportedExecutionAction(action)) continue;

    const queued = await queueOutboundAction({
      client,
      thread,
      tenantId,
      tenantKey,
      channel,
      action,
      provider,
      createAttempt,
      enqueueOutboundExecution,
    });

    if (queued) results.push(queued);
  }

  return results;
}
