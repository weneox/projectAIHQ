// src/routes/api/inbox/internal.js
// FINAL v2.3 — inbox internal routes
// canonical business runtime aware + thread state + outbound execution queue
// + runtime db fingerprint logging
// + tenant_id propagation/backfill for inbox_threads

import crypto from "crypto";
import express from "express";
import { okJson, isDbReady, isUuid } from "../../../utils/http.js";
import { requireInternalToken } from "../../../utils/auth.js";
import { fixText } from "../../../utils/textFix.js";
import { buildInboxActions } from "../../../services/inboxBrain.js";
import { getTenantBrainRuntime } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { resolveTenantKeyFromReq } from "../../../tenancy/index.js";
import { emitRealtimeEvent } from "../../../realtime/events.js";
import { enqueueMetaOutboundExecution } from "../../../services/durableExecutionService.js";

import {
  normalizeMessage,
  normalizeThread,
  s,
  clamp,
  toInt,
  sortMessagesChronologically,
} from "./shared.js";

import {
  createOutboundAttempt,
  findExistingInboundMessage,
  findExistingOutboundMessage,
  findLatestAttemptByMessageId,
  getInboxThreadState,
  getThreadById,
  refreshThread,
  upsertInboxThreadState,
} from "./repository.js";

import { applyHandoffActions, persistLeadActions } from "./mutations.js";

function normalizeObj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function normalizeArr(v) {
  return Array.isArray(v) ? v : [];
}

function safeJson(v) {
  return JSON.stringify(normalizeObj(v));
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function logInfo(message, data = null) {
  try {
    if (data) console.log(`[ai-hq] ${message}`, data);
    else console.log(`[ai-hq] ${message}`);
  } catch {}
}

async function logRuntimeDbFingerprint(client, label = "inbox-runtime", extra = {}) {
  try {
    const meta = await client.query(`
      select
        current_database() as current_database,
        current_user as current_user,
        current_schema() as current_schema,
        current_setting('search_path') as search_path,
        inet_server_addr()::text as server_addr,
        inet_server_port() as server_port
    `);

    console.log(`[${label}] fingerprint`, {
      ...(extra && typeof extra === "object" ? extra : {}),
      ...(meta.rows?.[0] || {}),
    });
  } catch (err) {
    console.error(`[${label}] fingerprint failed`, err);
  }
}

async function resolveTenantRow(client, tenantKey = "") {
  const key = fixText(s(tenantKey || ""));
  if (!client || !key) return null;

  const result = await client.query(
    `
    select id, tenant_key, company_name, timezone, inbox_policy
    from tenants
    where tenant_key = $1::text
    limit 1
    `,
    [key]
  );

  return result.rows?.[0] || null;
}

function mergeTenant(primary, fallback, tenantKey = "") {
  const p = normalizeObj(primary);
  const f = normalizeObj(fallback);

  if (!Object.keys(p).length && !Object.keys(f).length) return null;

  const merged = {
    ...f,
    ...p,
  };

  const id = s(p?.id || f?.id || "");
  const key = s(p?.tenant_key || f?.tenant_key || tenantKey || "");

  if (id) merged.id = id;
  if (key) merged.tenant_key = key;

  return merged;
}

function hashText(text) {
  const value = s(text || "");
  if (!value) return "";
  try {
    return crypto.createHash("sha256").update(value).digest("hex");
  } catch {
    return "";
  }
}

function getStateValue(state, ...keys) {
  const src = normalizeObj(state);
  for (const key of keys) {
    const value = src?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function hasAction(actions = [], type = "") {
  const target = lower(type);
  return normalizeArr(actions).some((item) => lower(item?.type) === target);
}

function findAction(actions = [], type = "") {
  const target = lower(type);
  return normalizeArr(actions).find((item) => lower(item?.type) === target) || null;
}

const INBOX_THREAD_SELECT_COLUMNS = `
  id, tenant_id, tenant_key, channel, external_thread_id, external_user_id,
  external_username, customer_name, status, last_message_at,
  last_inbound_at, last_outbound_at, unread_count, assigned_to,
  labels, meta, handoff_active, handoff_reason, handoff_priority,
  handoff_at, handoff_by, created_at, updated_at
`;

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

const LAST_MESSAGE_VISIBLE_TYPES = new Set([
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
]);

function isControlMessageType(value) {
  const x = lower(value);
  return ["typing_on", "typing_off", "mark_seen"].includes(x);
}

function normalizeInboxMessageType(value, fallback = "text") {
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
  if (["typing_stop", "typing-stop", "typingoff", "typing-off"].includes(x)) {
    return "system";
  }
  if (["seen", "read", "markseen", "mark-seen"].includes(x)) {
    return "system";
  }

  if (["unknown", "unsupported"].includes(x)) {
    return STORED_INBOX_MESSAGE_TYPES.has(fb) ? fb : "other";
  }

  return STORED_INBOX_MESSAGE_TYPES.has(fb) ? fb : "text";
}

function supportedExecutionAction(action = {}) {
  const type = lower(action?.type);
  return ["send_message", "typing_on", "typing_off", "mark_seen"].includes(type);
}

function mapActionToMessageType(action = {}) {
  const type = lower(action?.type);
  if (type === "send_message") {
    return lower(action?.messageType || action?.meta?.messageType || "text") || "text";
  }
  if (type === "typing_on") return "typing_on";
  if (type === "typing_off") return "typing_off";
  if (type === "mark_seen") return "mark_seen";
  return "text";
}

function mapActionToSenderType(action = {}) {
  const type = lower(action?.type);
  if (type === "send_message") {
    return lower(action?.senderType || action?.meta?.senderType || "ai") || "ai";
  }
  return lower(action?.senderType || action?.meta?.senderType || "system") || "system";
}

function buildOutboundAttemptPayload({
  threadId,
  tenantKey,
  channel,
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
    channel: s(channel || "instagram").toLowerCase() || "instagram",
    recipientId: fixText(s(recipientId || "")) || null,
    senderType: s(senderType || "ai").toLowerCase() || "ai",
    messageType: requestedMessageType,
    storageMessageType: storedType,
    text: fixText(s(text || "")),
    attachments: Array.isArray(attachments) ? attachments : [],
    meta: meta && typeof meta === "object" ? meta : {},
  };
}

function buildRuntimePayload(runtimePack) {
  const serviceCatalog = Array.isArray(runtimePack?.serviceCatalog)
    ? runtimePack.serviceCatalog
    : Array.isArray(runtimePack?.servicesDetailed)
      ? runtimePack.servicesDetailed
      : [];

  const services = Array.isArray(runtimePack?.services)
    ? runtimePack.services
    : serviceCatalog
        .map((item) => s(item?.title || item?.name || item?.service_key || item))
        .filter(Boolean);

  const disabledServices = Array.isArray(runtimePack?.disabledServices)
    ? runtimePack.disabledServices
    : serviceCatalog
        .filter(
          (item) =>
            item &&
            (
              item.enabled === false ||
              item.active === false ||
              item.visible_in_ai === false ||
              item.visibleInAi === false
            )
        )
        .map((item) => s(item?.title || item?.name || item?.service_key || ""))
        .filter(Boolean);

  const knowledgeEntries = Array.isArray(runtimePack?.knowledgeEntries)
    ? runtimePack.knowledgeEntries
    : [];

  const responsePlaybooks = Array.isArray(runtimePack?.responsePlaybooks)
    ? runtimePack.responsePlaybooks
    : [];

  return {
    ...runtimePack,
    tenant: runtimePack?.tenant || null,
    serviceCatalog,
    services,
    disabledServices,
    knowledgeEntries,
    responsePlaybooks,
    aiPolicy:
      runtimePack?.aiPolicy ||
      runtimePack?.ai_policy ||
      runtimePack?.tenant?.ai_policy ||
      {},
    inboxPolicy:
      runtimePack?.inboxPolicy ||
      runtimePack?.inbox_policy ||
      runtimePack?.tenant?.inbox_policy ||
      {},
    commentPolicy:
      runtimePack?.commentPolicy ||
      runtimePack?.comment_policy ||
      runtimePack?.tenant?.comment_policy ||
      {},
    businessContext:
      s(runtimePack?.businessContext) ||
      s(runtimePack?.businessSummary) ||
      s(runtimePack?.companySummaryLong) ||
      s(runtimePack?.companySummaryShort) ||
      "",
    tone:
      s(runtimePack?.tone) ||
      s(runtimePack?.toneText) ||
      s(runtimePack?.tenant?.profile?.tone_of_voice) ||
      "professional, warm, concise",
    preferredCta:
      s(runtimePack?.preferredCta) ||
      s(runtimePack?.tenant?.profile?.preferred_cta) ||
      "",
    bannedPhrases: Array.isArray(runtimePack?.bannedPhrases)
      ? runtimePack.bannedPhrases
      : Array.isArray(runtimePack?.forbiddenClaims)
        ? runtimePack.forbiddenClaims
        : [],
    language:
      s(runtimePack?.language) ||
      s(runtimePack?.defaultLanguage) ||
      s(runtimePack?.outputLanguage) ||
      s(runtimePack?.tenant?.default_language) ||
      "az",
    threadState:
      runtimePack?.threadState ||
      runtimePack?.thread_state ||
      null,
    raw: runtimePack?.raw || {},
  };
}

async function queueOutboundAction({
  client,
  thread,
  tenantKey,
  channel,
  action,
  provider = "meta",
}) {
  if (!client || !thread?.id || !supportedExecutionAction(action)) return null;

  const actionType = lower(action?.type);
  const recipientId =
    fixText(s(action?.recipientId || thread?.external_user_id || "")) || null;
  const senderType = mapActionToSenderType(action);
  const requestedMessageType = mapActionToMessageType(action);
  const storageMessageType = normalizeInboxMessageType(requestedMessageType, "text");
  const text = actionType === "send_message" ? fixText(s(action?.text || "")) : "";
  const attachments =
    actionType === "send_message" && Array.isArray(action?.attachments)
      ? action.attachments
      : [];
  const meta = normalizeObj(action?.meta);
  const mergedMeta = {
    ...meta,
    recipientId,
    provider,
    actionType,
    originalMessageType: requestedMessageType,
    storageMessageType,
    internalExecution: true,
  };

  const inserted = await client.query(
    `
    insert into inbox_messages (
      thread_id, tenant_key, direction, sender_type, external_message_id,
      message_type, text, attachments, meta, sent_at
    )
    values (
      $1::uuid, $2::text, 'outbound', $3::text, null,
      $4::text, $5::text, $6::jsonb, $7::jsonb, now()
    )
    returning
      id, thread_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    `,
    [
      thread.id,
      tenantKey,
      senderType,
      storageMessageType,
      text,
      JSON.stringify(attachments),
      JSON.stringify(mergedMeta),
    ]
  );

  const message = normalizeMessage(inserted.rows?.[0] || null);

  await client.query(
    `
    update inbox_threads
    set
      last_outbound_at = now(),
      last_message_at = case
        when $2::text in (
          'text','image','video','audio','file','document','voice',
          'sticker','gif','location','contact','story_reply',
          'reaction','button','interactive'
        )
          then now()
        else last_message_at
      end,
      updated_at = now()
    where id = $1::uuid
    `,
    [thread.id, storageMessageType]
  );

  const attemptPayload = buildOutboundAttemptPayload({
    threadId: thread.id,
    tenantKey,
    channel,
    recipientId,
    senderType,
    messageType: requestedMessageType,
    storageMessageType,
    text,
    attachments,
    meta: mergedMeta,
  });

  const attempt = await createOutboundAttempt({
    db: client,
    messageId: message.id,
    threadId: thread.id,
    tenantKey,
    channel,
    provider,
    recipientId,
    payload: attemptPayload,
    status: "queued",
    maxAttempts: 5,
    nextRetryAt: nowIso(),
  });

  // Durable execution is the control-plane source of truth for claim/retry/dead-letter.
  // inbox_outbound_attempts is retained only as message-level compatibility/history state.
  await enqueueMetaOutboundExecution({
    db: client,
    tenantId: s(thread?.tenant_id || ""),
    tenantKey,
    channel,
    provider,
    threadId: thread.id,
    messageId: message.id,
    payload: attemptPayload,
    safeMetadata: {
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
    maxAttempts: 5,
  });

  return {
    actionType,
    message,
    attempt,
  };
}

async function queueExecutionActions({
  client,
  thread,
  tenantKey,
  channel,
  actions,
}) {
  const results = [];

  for (const action of normalizeArr(actions)) {
    if (!supportedExecutionAction(action)) continue;
    const queued = await queueOutboundAction({
      client,
      thread,
      tenantKey,
      channel,
      action,
    });
    if (queued) results.push(queued);
  }

  return results;
}

function buildThreadStateForDecision({
  thread,
  tenant,
  tenantKey,
  priorState,
  brain,
  actions,
  leadResults,
  handoffResults,
  executionResults,
}) {
  const prev = normalizeObj(priorState);
  const intent = s(brain?.intent || "");
  const previousIntent = s(
    getStateValue(prev, "last_customer_intent", "lastCustomerIntent") || ""
  );
  const previousRepeatIntent = Number(
    getStateValue(prev, "repeat_intent_count", "repeatIntentCount") || 0
  );

  const firstSendExecution =
    normalizeArr(executionResults).find((item) => item?.actionType === "send_message") || null;

  const sentMessage = firstSendExecution?.message || null;
  const handoffAction = findAction(actions, "handoff");
  const noReplyAction = findAction(actions, "no_reply");

  const repeatIntentCount = intent
    ? lower(intent) === lower(previousIntent)
      ? previousRepeatIntent + 1
      : 1
    : previousRepeatIntent;

  const priorRepeatServiceCount = Number(
    getStateValue(prev, "repeat_service_count", "repeatServiceCount") || 0
  );

  const currentSuppressed =
    Boolean(getStateValue(prev, "suppressed_until_operator_reply", "suppressedUntilOperatorReply"));

  const handoffActive = handoffResults.length
    ? true
    : Boolean(thread?.handoff_active) || currentSuppressed;

  const handoffReason =
    s(handoffAction?.reason || thread?.handoff_reason || prev?.handoffReason || "");
  const handoffPriority =
    s(handoffAction?.priority || thread?.handoff_priority || prev?.handoffPriority || "normal") ||
    "normal";

  const responseMode = sentMessage
    ? "auto_reply"
    : noReplyAction
      ? "no_reply"
      : s(getStateValue(prev, "last_response_mode", "lastResponseMode") || "");

  return {
    thread_id: s(thread?.id || ""),
    tenant_id: s(
      thread?.tenant_id ||
        tenant?.id ||
        getStateValue(prev, "tenant_id", "tenantId") ||
        ""
    ),
    tenant_key: s(
      thread?.tenant_key ||
        tenantKey ||
        getStateValue(prev, "tenant_key", "tenantKey") ||
        ""
    ),
    last_customer_intent: intent || previousIntent,
    last_customer_service_key: s(
      getStateValue(prev, "last_customer_service_key", "lastCustomerServiceKey") || ""
    ),
    last_ai_intent: sentMessage
      ? intent || s(getStateValue(prev, "last_ai_intent", "lastAiIntent") || "")
      : s(getStateValue(prev, "last_ai_intent", "lastAiIntent") || ""),
    last_ai_service_key: s(
      getStateValue(prev, "last_ai_service_key", "lastAiServiceKey") || ""
    ),
    last_ai_reply_hash: sentMessage?.text
      ? hashText(sentMessage.text)
      : s(getStateValue(prev, "last_ai_reply_hash", "lastAiReplyHash") || ""),
    last_ai_reply_text: sentMessage?.text
      ? s(sentMessage.text)
      : s(getStateValue(prev, "last_ai_reply_text", "lastAiReplyText") || ""),
    last_ai_cta_type: sentMessage
      ? "reply"
      : s(getStateValue(prev, "last_ai_cta_type", "lastAiCtaType") || ""),
    last_response_mode: responseMode,
    lead_created_at: leadResults.length
      ? nowIso()
      : getStateValue(prev, "lead_created_at", "leadCreatedAt") || null,
    handoff_announced_at: handoffResults.length
      ? nowIso()
      : getStateValue(prev, "handoff_announced_at", "handoffAnnouncedAt") || null,
    handoff_message_id: handoffResults.length
      ? s(sentMessage?.id || getStateValue(prev, "handoff_message_id", "handoffMessageId") || "")
      : s(getStateValue(prev, "handoff_message_id", "handoffMessageId") || ""),
    suppressed_until_operator_reply: handoffResults.length ? true : currentSuppressed,
    repeat_intent_count: repeatIntentCount,
    repeat_service_count: priorRepeatServiceCount,
    awaiting_customer_answer_to: sentMessage
      ? "reply"
      : s(getStateValue(prev, "awaiting_customer_answer_to", "awaitingCustomerAnswerTo") || ""),
    last_decision_meta: {
      handoffActive,
      handoffReason,
      handoffPriority,
      operatorRecentlyReplied: false,
      closedLike: ["closed", "spam"].includes(lower(thread?.status || "")),
      lastDecisionAt: nowIso(),
      lastDecisionIntent: intent || "",
      leadCreated: leadResults.length > 0,
      queuedExecutionActionTypes: normalizeArr(executionResults).map((item) => item.actionType),
      queuedExecutionMessageIds: normalizeArr(executionResults)
        .map((item) => s(item?.message?.id || ""))
        .filter(Boolean),
      queuedExecutionAttemptIds: normalizeArr(executionResults)
        .map((item) => s(item?.attempt?.id || ""))
        .filter(Boolean),
      noReplyReason: s(noReplyAction?.reason || ""),
    },
  };
}

function buildThreadStateForOutbound({
  thread,
  tenantKey,
  priorState,
  message,
  senderType,
  messageType,
  meta,
}) {
  const prev = normalizeObj(priorState);
  const sender = lower(senderType || message?.sender_type || "ai");
  const type = normalizeInboxMessageType(
    messageType || message?.message_type || meta?.storageMessageType || "text",
    "text"
  );
  const messageText = s(message?.text || "");
  const operatorReply = sender === "agent" || sender === "operator";
  const aiReply = (sender === "ai" || sender === "assistant") && type === "text";
  const handoffReset = operatorReply;

  return {
    thread_id: s(thread?.id || ""),
    tenant_key: s(
      thread?.tenant_key ||
        tenantKey ||
        getStateValue(prev, "tenant_key", "tenantKey") ||
        ""
    ),
    tenant_id: s(
      thread?.tenant_id ||
        getStateValue(prev, "tenant_id", "tenantId") ||
        ""
    ),
    last_ai_intent: aiReply
      ? s(getStateValue(prev, "last_customer_intent", "lastCustomerIntent") || "")
      : s(getStateValue(prev, "last_ai_intent", "lastAiIntent") || ""),
    last_ai_service_key: s(
      getStateValue(prev, "last_ai_service_key", "lastAiServiceKey") || ""
    ),
    last_ai_reply_hash: aiReply
      ? hashText(messageText)
      : s(getStateValue(prev, "last_ai_reply_hash", "lastAiReplyHash") || ""),
    last_ai_reply_text: aiReply
      ? messageText
      : s(getStateValue(prev, "last_ai_reply_text", "lastAiReplyText") || ""),
    last_ai_cta_type: aiReply
      ? "reply"
      : s(getStateValue(prev, "last_ai_cta_type", "lastAiCtaType") || ""),
    last_response_mode: aiReply
      ? (meta?.internalExecution ? "auto_reply" : "manual_outbound")
      : s(getStateValue(prev, "last_response_mode", "lastResponseMode") || ""),
    suppressed_until_operator_reply: handoffReset
      ? false
      : Boolean(getStateValue(prev, "suppressed_until_operator_reply", "suppressedUntilOperatorReply")),
    handoff_message_id: handoffReset
      ? ""
      : s(getStateValue(prev, "handoff_message_id", "handoffMessageId") || ""),
    awaiting_customer_answer_to: type === "text"
      ? "reply"
      : s(getStateValue(prev, "awaiting_customer_answer_to", "awaitingCustomerAnswerTo") || ""),
    repeat_intent_count: Number(
      getStateValue(prev, "repeat_intent_count", "repeatIntentCount") || 0
    ),
    repeat_service_count: Number(
      getStateValue(prev, "repeat_service_count", "repeatServiceCount") || 0
    ),
    last_decision_meta: {
      handoffActive: handoffReset ? false : Boolean(thread?.handoff_active),
      handoffReason: handoffReset ? "" : s(thread?.handoff_reason || prev?.handoffReason || ""),
      handoffPriority: handoffReset
        ? "normal"
        : s(thread?.handoff_priority || prev?.handoffPriority || "normal") || "normal",
      operatorRecentlyReplied: operatorReply,
      closedLike: ["closed", "spam"].includes(lower(thread?.status || "")),
      lastManualOutboundAt: operatorReply ? nowIso() : undefined,
      lastManualMessageId: operatorReply ? s(message?.id || "") : undefined,
      lastAiOutboundAt: aiReply ? nowIso() : undefined,
      lastAiMessageId: aiReply ? s(message?.id || "") : undefined,
      lastOutboundMessageType: type,
    },
  };
}

export function inboxInternalRoutes({ db, wsHub }) {
  const r = express.Router();

  r.post("/inbox/ingest", requireInternalToken, async (req, res) => {
    logInfo("inbox-internal hit", {
      path: req.originalUrl || req.url || req.path,
      hasInternalToken: Boolean(req.headers["x-internal-token"]),
    });

    const tenantKey = resolveTenantKeyFromReq(req);
    const channel = s(req.body?.channel || "instagram").toLowerCase() || "instagram";

    const externalThreadId =
      fixText(
        s(
          req.body?.externalThreadId ||
            req.body?.threadExternalId ||
            req.body?.threadId ||
            req.body?.userId
        )
      ) || null;

    const externalUserId =
      fixText(
        s(
          req.body?.externalUserId ||
            req.body?.userId ||
            req.body?.from?.userId ||
            req.body?.from?.id
        )
      ) || null;

    const externalUsername =
      fixText(
        s(req.body?.externalUsername || req.body?.from?.username || req.body?.username)
      ) || null;

    const customerName =
      fixText(
        s(
          req.body?.customerName ||
            req.body?.from?.fullName ||
            req.body?.from?.name ||
            externalUsername ||
            req.body?.externalUserId ||
            req.body?.userId ||
            "Instagram User"
        )
      ) || "Instagram User";

    const externalMessageId =
      fixText(
        s(req.body?.externalMessageId || req.body?.messageExternalId || req.body?.message?.id)
      ) || null;

    const text = fixText(s(req.body?.text || req.body?.message?.text));
    const timestamp =
      req.body?.timestamp || req.body?.message?.timestamp || req.body?.receivedAt || Date.now();

    const raw = req.body?.raw && typeof req.body.raw === "object" ? req.body.raw : {};

    const customerContext =
      req.body?.customerContext && typeof req.body.customerContext === "object"
        ? req.body.customerContext
        : {};

    const formData =
      req.body?.formData && typeof req.body.formData === "object" ? req.body.formData : {};

    const leadContext =
      req.body?.leadContext && typeof req.body.leadContext === "object"
        ? req.body.leadContext
        : {};

    const conversationContext =
      req.body?.conversationContext && typeof req.body.conversationContext === "object"
        ? req.body.conversationContext
        : {};

    const tenantContext =
      req.body?.tenantContext && typeof req.body.tenantContext === "object"
        ? req.body.tenantContext
        : {};

    const meta = {
      source: fixText(s(req.body?.source || "meta")) || "meta",
      platform: fixText(s(req.body?.platform || "instagram")) || "instagram",
      timestamp,
      raw,
      customerContext,
      formData,
      leadContext,
      conversationContext,
      tenantContext,
    };

    if (!tenantKey) {
      return okJson(res, { ok: false, error: "tenantKey required" });
    }

    if (!text) {
      return okJson(res, { ok: false, error: "text required" });
    }

    let client = null;

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
          actions: [],
        });
      }

      client = await db.connect();
      await client.query("BEGIN");

      await logRuntimeDbFingerprint(client, "inbox.ingest.db", {
        tenantKey,
        channel,
        externalThreadId,
        externalUserId,
        externalMessageId,
      });

      const tenantRow = await resolveTenantRow(client, tenantKey);
      const tenantId = s(tenantRow?.id || "");

      if (!tenantId) {
        await client.query("ROLLBACK");
        client.release();
        client = null;

        return okJson(res, {
          ok: false,
          error: "tenant not found",
          details: { tenantKey },
          actions: [],
        });
      }

      let thread = null;
      let threadWasCreated = false;

      if (externalThreadId) {
        const existing = await client.query(
          `
          select ${INBOX_THREAD_SELECT_COLUMNS}
          from inbox_threads
          where tenant_key = $1::text
            and channel = $2::text
            and external_thread_id = $3::text
          limit 1
          `,
          [tenantKey, channel, externalThreadId]
        );

        thread = existing.rows?.[0] || null;
      }

      if (!thread) {
        try {
          const created = await client.query(
            `
            insert into inbox_threads (
              tenant_id, tenant_key, channel, external_thread_id, external_user_id,
              external_username, customer_name, status, assigned_to, labels, meta,
              last_message_at, last_inbound_at, unread_count
            )
            values (
              $1::uuid, $2::text, $3::text, $4::text, $5::text,
              $6::text, $7::text, 'open', null, '[]'::jsonb, $8::jsonb,
              now(), now(), 1
            )
            returning ${INBOX_THREAD_SELECT_COLUMNS}
            `,
            [
              tenantId,
              tenantKey,
              channel,
              externalThreadId,
              externalUserId,
              externalUsername,
              customerName,
              safeJson(meta),
            ]
          );

          thread = created.rows?.[0] || null;
          threadWasCreated = true;
        } catch (e) {
          const code = String(e?.code || "");
          if (code !== "23505") throw e;

          const retry = await client.query(
            `
            select ${INBOX_THREAD_SELECT_COLUMNS}
            from inbox_threads
            where tenant_key = $1::text
              and channel = $2::text
              and external_thread_id = $3::text
            limit 1
            `,
            [tenantKey, channel, externalThreadId]
          );

          thread = retry.rows?.[0] || null;
        }
      } else {
        const updated = await client.query(
          `
          update inbox_threads
          set
            tenant_id = coalesce(tenant_id, $2::uuid),
            external_user_id = coalesce($3::text, external_user_id),
            external_username = coalesce($4::text, external_username),
            customer_name = coalesce($5::text, customer_name),
            last_message_at = now(),
            last_inbound_at = now(),
            unread_count = coalesce(unread_count, 0) + 1,
            meta = coalesce(meta, '{}'::jsonb) || $6::jsonb,
            updated_at = now()
          where id = $1::uuid
          returning ${INBOX_THREAD_SELECT_COLUMNS}
          `,
          [thread.id, tenantId, externalUserId, externalUsername, customerName, safeJson(meta)]
        );

        thread = updated.rows?.[0] || thread;
      }

      if (externalMessageId && thread?.id) {
        const existingMessage = await findExistingInboundMessage({
          db: client,
          tenantKey,
          threadId: thread.id,
          externalMessageId,
        });

        if (existingMessage) {
          await client.query("COMMIT");
          client.release();
          client = null;

          return okJson(res, {
            ok: true,
            duplicate: true,
            deduped: true,
            thread: normalizeThread(thread),
            message: existingMessage,
            actions: [],
            leadResults: [],
            handoffResults: [],
            executionResults: [],
            threadState: await getInboxThreadState(db, thread.id),
          });
        }
      }

      const insertedMessage = await client.query(
        `
        insert into inbox_messages (
          thread_id, tenant_key, direction, sender_type, external_message_id,
          message_type, text, attachments, meta, sent_at
        )
        values (
          $1::uuid, $2::text, 'inbound', 'customer', $3::text,
          'text', $4::text, '[]'::jsonb, $5::jsonb,
          coalesce(to_timestamp($6::double precision / 1000.0), now())
        )
        returning
          id, thread_id, tenant_key, direction, sender_type,
          external_message_id, message_type, text, attachments, meta, sent_at, created_at
        `,
        [thread.id, tenantKey, externalMessageId, text, safeJson(meta), Number(timestamp || Date.now())]
      );

      const message = normalizeMessage(insertedMessage.rows?.[0] || null);
      let normalizedThread = normalizeThread(thread);

      const recentMessagesQuery = await client.query(
        `
        select
          id, thread_id, tenant_key, direction, sender_type,
          external_message_id, message_type, text, attachments, meta, sent_at, created_at
        from inbox_messages
        where thread_id = $1::uuid
        order by sent_at desc, created_at desc
        limit 8
        `,
        [thread.id]
      );

      const recentMessages = sortMessagesChronologically(
        (recentMessagesQuery.rows || []).map(normalizeMessage)
      );

      const priorThreadState = await getInboxThreadState(client, thread.id);

      const runtimePack = await getTenantBrainRuntime({
        db: client,
        tenantKey,
        threadState: priorThreadState || null,
      });

      const tenant = mergeTenant(runtimePack?.tenant, tenantRow, tenantKey);
      const services = Array.isArray(runtimePack?.serviceCatalog)
        ? runtimePack.serviceCatalog
        : [];
      const knowledgeEntries = Array.isArray(runtimePack?.knowledgeEntries)
        ? runtimePack.knowledgeEntries
        : [];
      const responsePlaybooks = Array.isArray(runtimePack?.responsePlaybooks)
        ? runtimePack.responsePlaybooks
        : [];

      const runtimePayload = buildRuntimePayload({
        ...runtimePack,
        tenant,
        threadState: priorThreadState || runtimePack?.threadState || null,
      });

      const brain = await buildInboxActions({
        text,
        channel,
        externalUserId,
        tenantKey,
        thread: normalizedThread,
        message,
        tenant,
        recentMessages,
        customerContext,
        formData,
        leadContext,
        conversationContext,
        tenantContext: {
          ...tenantContext,
          runtime: runtimePayload,
        },
        services,
        knowledgeEntries,
        responsePlaybooks,
        threadState: runtimePayload.threadState || null,
        runtime: runtimePayload,
      });

      const actions = Array.isArray(brain?.actions) ? brain.actions : [];

      logInfo("inbox brain result", {
        tenantKey,
        intent: brain?.intent || "",
        leadScore: Number(brain?.leadScore || 0),
        actionsCount: actions.length,
      });

      const leadResults = await persistLeadActions({
        db,
        client,
        wsHub,
        tenantKey,
        actions,
      });

      const handoffResults = await applyHandoffActions({
        db,
        client,
        wsHub,
        threadId: normalizedThread?.id,
        actions,
      });

      const executionResults = await queueExecutionActions({
        client,
        thread: normalizedThread,
        tenantKey,
        channel,
        actions,
      });

      normalizedThread = await refreshThread(client, normalizedThread?.id, normalizedThread);

      const nextThreadState = await upsertInboxThreadState(
        client,
        buildThreadStateForDecision({
          thread: normalizedThread,
          tenant,
          tenantKey,
          priorState: priorThreadState,
          brain,
          actions,
          leadResults,
          handoffResults,
          executionResults,
        })
      );

      await client.query("COMMIT");
      client.release();
      client = null;

      try {
        if (threadWasCreated) {
          emitRealtimeEvent(wsHub, {
            type: "inbox.thread.created",
            audience: "operator",
            tenantKey: normalizedThread?.tenant_key || tenantKey,
            tenantId: normalizedThread?.tenant_id || tenant?.id,
            thread: normalizedThread,
          });
        } else {
          emitRealtimeEvent(wsHub, {
            type: "inbox.thread.updated",
            audience: "operator",
            tenantKey: normalizedThread?.tenant_key || tenantKey,
            tenantId: normalizedThread?.tenant_id || tenant?.id,
            thread: normalizedThread,
          });
        }
      } catch {}

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.message.created",
          audience: "operator",
          tenantKey: message?.tenant_key || normalizedThread?.tenant_key || tenantKey,
          tenantId: message?.tenant_id || normalizedThread?.tenant_id || tenant?.id,
          threadId: normalizedThread?.id || thread?.id,
          message,
        });
      } catch {}

      for (const item of executionResults) {
        try {
          if (item?.message) {
            emitRealtimeEvent(wsHub, {
              type: "inbox.message.created",
              audience: "operator",
              tenantKey: item.message?.tenant_key || normalizedThread?.tenant_key || tenantKey,
              tenantId: item.message?.tenant_id || normalizedThread?.tenant_id || tenant?.id,
              threadId: normalizedThread?.id || thread?.id,
              message: item.message,
            });
          }
        } catch {}

        try {
          if (item?.attempt) {
            emitRealtimeEvent(wsHub, {
              type: "inbox.outbound.attempt.created",
              audience: "operator",
              tenantKey: item.attempt?.tenant_key || tenantKey,
              tenantId: item.attempt?.tenant_id || tenant?.id,
              attempt: item.attempt,
            });
          }
        } catch {}
      }

      return okJson(res, {
        ok: true,
        duplicate: false,
        deduped: false,
        thread: normalizedThread,
        threadState: nextThreadState,
        message,
        tenant: tenant
          ? {
              id: tenant.id || null,
              tenant_key: tenant.tenant_key,
              name:
                tenant.company_name ||
                tenant?.profile?.brand_name ||
                tenant?.brand?.displayName ||
                tenant.tenant_key,
              timezone: tenant.timezone,
              inbox_policy: tenant.inbox_policy || {},
            }
          : null,
        intent: brain?.intent || "general",
        leadScore: Number(brain?.leadScore || 0),
        policy: brain?.policy || null,
        actions,
        leadResults,
        handoffResults,
        executionResults,
      });
    } catch (e) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        try {
          client.release();
        } catch {}
      }

      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
        actions: [],
      });
    }
  });

  r.post("/inbox/outbound", requireInternalToken, async (req, res) => {
    logInfo("inbox-outbound internal hit", {
      path: req.originalUrl || req.url || req.path,
      hasInternalToken: Boolean(req.headers["x-internal-token"]),
    });

    const threadId = s(req.body?.threadId || "");
    if (!threadId) return okJson(res, { ok: false, error: "threadId required" });
    if (!isUuid(threadId)) return okJson(res, { ok: false, error: "threadId must be uuid" });

    let client = null;

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }

      const existingThread = await getThreadById(db, threadId);
      if (!existingThread) {
        return okJson(res, { ok: false, error: "thread not found" });
      }

      const tenantKey = resolveTenantKeyFromReq(req, existingThread?.tenant_key);

      const channel =
        s(req.body?.channel || existingThread?.channel || "instagram").toLowerCase() || "instagram";

      const recipientId = fixText(s(req.body?.recipientId || "")) || null;
      const senderType = s(req.body?.senderType || "ai").toLowerCase() || "ai";
      const externalMessageId =
        fixText(s(req.body?.providerMessageId || req.body?.externalMessageId || "")) || null;
      const requestedMessageType = lower(req.body?.messageType || "text") || "text";
      const messageType = normalizeInboxMessageType(requestedMessageType, "text");
      const text = fixText(s(req.body?.text || ""));
      const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
      const meta = req.body?.meta && typeof req.body.meta === "object" ? req.body.meta : {};
      const provider = s(req.body?.provider || "meta") || "meta";
      const maxAttempts = clamp(toInt(req.body?.maxAttempts, 5), 1, 20);

      const isControlMessage = isControlMessageType(requestedMessageType);

      if (!isControlMessage && !text && attachments.length === 0) {
        return okJson(res, { ok: false, error: "text or attachments required" });
      }

      if (externalMessageId) {
        const existingMessage = await findExistingOutboundMessage({
          db,
          tenantKey,
          threadId,
          externalMessageId,
        });

        if (existingMessage) {
          const existingAttempt = await findLatestAttemptByMessageId(db, existingMessage.id);

          return okJson(res, {
            ok: true,
            duplicate: true,
            deduped: true,
            thread: existingThread,
            message: existingMessage,
            attempt: existingAttempt,
            threadState: await getInboxThreadState(db, threadId),
          });
        }
      }

      const mergedMeta = {
        ...meta,
        recipientId,
        provider,
        operatorName: s(req.body?.operatorName || ""),
        originalMessageType: requestedMessageType,
        storageMessageType: messageType,
      };

      client = await db.connect();
      await client.query("BEGIN");

      await logRuntimeDbFingerprint(client, "inbox.outbound.db", {
        tenantKey,
        channel,
        threadId,
        recipientId,
        externalMessageId,
      });

      const tenantRow = await resolveTenantRow(client, tenantKey);
      const tenantId = s(existingThread?.tenant_id || tenantRow?.id || "");

      if (!tenantId) {
        await client.query("ROLLBACK");
        client.release();
        client = null;

        return okJson(res, {
          ok: false,
          error: "tenant not found",
          details: { tenantKey, threadId },
        });
      }

      const inserted = await client.query(
        `
        insert into inbox_messages (
          thread_id, tenant_key, direction, sender_type, external_message_id,
          message_type, text, attachments, meta, sent_at
        )
        values (
          $1::uuid, $2::text, 'outbound', $3::text, $4::text,
          $5::text, $6::text, $7::jsonb, $8::jsonb, now()
        )
        returning
          id, thread_id, tenant_key, direction, sender_type,
          external_message_id, message_type, text, attachments, meta, sent_at, created_at
        `,
        [
          threadId,
          tenantKey,
          senderType,
          externalMessageId,
          messageType,
          text,
          JSON.stringify(attachments),
          JSON.stringify(mergedMeta),
        ]
      );

      const message = normalizeMessage(inserted.rows?.[0] || null);

      await client.query(
        `
        update inbox_threads
        set
          tenant_id = coalesce(tenant_id, $5::uuid),
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
          handoff_active = case when $3::text in ('agent','operator') then false else handoff_active end,
          handoff_reason = case when $3::text in ('agent','operator') then '' else handoff_reason end,
          handoff_priority = case when $3::text in ('agent','operator') then 'normal' else handoff_priority end,
          handoff_at = case when $3::text in ('agent','operator') then null else handoff_at end,
          handoff_by = case when $3::text in ('agent','operator') then null else handoff_by end,
          meta = case
            when $3::text in ('agent','operator') then
              jsonb_set(
                coalesce(meta, '{}'::jsonb),
                '{handoff}',
                '{"active":false,"reason":"","priority":"normal","at":null,"by":null}'::jsonb,
                true
              )
            else coalesce(meta, '{}'::jsonb)
          end
        where id = $1::uuid
        `,
        [threadId, recipientId, senderType, messageType, tenantId]
      );

      const attemptPayload = buildOutboundAttemptPayload({
        threadId,
        tenantKey,
        channel,
        recipientId,
        senderType,
        messageType: requestedMessageType,
        storageMessageType: messageType,
        text,
        attachments,
        meta: mergedMeta,
      });

      const attempt = await createOutboundAttempt({
        db: client,
        messageId: message.id,
        threadId,
        tenantKey,
        channel,
        provider,
        recipientId,
        payload: attemptPayload,
        status: externalMessageId ? "sent" : "queued",
        maxAttempts,
        nextRetryAt: externalMessageId ? null : new Date().toISOString(),
      });

      if (!externalMessageId) {
        // Durable execution is the primary runtime control plane for outbound processing.
        // The legacy attempt row remains a compatibility/history record for thread tooling.
        await enqueueMetaOutboundExecution({
          db: client,
          tenantId,
          tenantKey,
          channel,
          provider,
          threadId,
          messageId: message.id,
          payload: attemptPayload,
          safeMetadata: {
            inboxOutboundAttemptId: s(attempt?.id),
            threadId,
            messageId: message.id,
            recipientId,
          },
          correlationIds: {
            threadId,
            messageId: message.id,
            outboundAttemptId: s(attempt?.id),
          },
          maxAttempts,
        });
      }

      const normalizedThread = await refreshThread(client, threadId, existingThread);
      const priorThreadState = await getInboxThreadState(client, threadId);

      const nextThreadState = await upsertInboxThreadState(
        client,
        buildThreadStateForOutbound({
          thread: normalizedThread,
          tenantKey,
          priorState: priorThreadState,
          message,
          senderType,
          messageType,
          meta: mergedMeta,
        })
      );

      await client.query("COMMIT");
      client.release();
      client = null;

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.message.created",
          audience: "operator",
          tenantKey: message?.tenant_key || tenantKey,
          tenantId: message?.tenant_id || tenant?.id,
          threadId,
          message,
        });
      } catch {}

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.thread.updated",
          audience: "operator",
          tenantKey: normalizedThread?.tenant_key || tenantKey,
          tenantId: normalizedThread?.tenant_id || tenant?.id,
          thread: normalizedThread,
        });
      } catch {}

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.outbound.attempt.created",
          audience: "operator",
          tenantKey: attempt?.tenant_key || tenantKey,
          tenantId: attempt?.tenant_id || tenant?.id,
          attempt,
        });
      } catch {}

      return okJson(res, {
        ok: true,
        duplicate: false,
        deduped: false,
        thread: normalizedThread,
        threadState: nextThreadState,
        message,
        attempt,
      });
    } catch (e) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        try {
          client.release();
        } catch {}
      }

      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  return r;
}
