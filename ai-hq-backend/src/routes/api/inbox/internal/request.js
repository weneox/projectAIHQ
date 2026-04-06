import { fixText } from "../../../../utils/textFix.js";
import { resolveTenantKeyFromReq } from "../../../../tenancy/index.js";
import { clamp, s, toInt } from "../shared.js";
import { lower, normalizeObj } from "./shared.js";
import { isControlMessageType, normalizeInboxMessageType } from "./execution.js";

function defaultProviderForChannel(channel = "") {
  return lower(channel) === "telegram" ? "telegram" : "meta";
}

function defaultPlatformForChannel(channel = "") {
  const safeChannel = lower(channel);
  return safeChannel || "instagram";
}

function defaultCustomerLabelForChannel(channel = "") {
  return lower(channel) === "telegram" ? "Telegram User" : "Instagram User";
}

function normalizeTimestamp(value) {
  if (value == null || value === "") return Date.now();

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const parsed = Date.parse(String(value));
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return Date.now();
}

function cleanText(value) {
  return fixText(s(value));
}

export function parseIngestRequest(req) {
  const tenantKey = resolveTenantKeyFromReq(req);
  const channel =
    cleanText(req.body?.channel || req.body?.platform || "instagram").toLowerCase() ||
    "instagram";

  const provider =
    cleanText(req.body?.provider || req.body?.source || defaultProviderForChannel(channel)) ||
    defaultProviderForChannel(channel);

  const externalUserId =
    cleanText(
      req.body?.externalUserId ||
        req.body?.userId ||
        req.body?.from?.userId ||
        req.body?.from?.id ||
        req.body?.customerContext?.telegram?.userId ||
        req.body?.customerContext?.telegram?.user_id
    ) || null;

  const externalThreadId =
    cleanText(
      req.body?.externalThreadId ||
        req.body?.threadExternalId ||
        req.body?.threadId ||
        req.body?.chatId ||
        req.body?.customerContext?.telegram?.chatId ||
        req.body?.customerContext?.telegram?.chat_id
    ) || null;

  const externalUsername =
    cleanText(
      req.body?.externalUsername ||
        req.body?.from?.username ||
        req.body?.username ||
        req.body?.customerContext?.telegram?.username
    ) || null;

  const customerName =
    cleanText(
      req.body?.customerName ||
        req.body?.from?.fullName ||
        req.body?.from?.name ||
        externalUsername ||
        externalUserId ||
        defaultCustomerLabelForChannel(channel)
    ) || defaultCustomerLabelForChannel(channel);

  const externalMessageId =
    cleanText(
      req.body?.externalMessageId ||
        req.body?.messageExternalId ||
        req.body?.message?.id
    ) || null;

  const text = cleanText(req.body?.text || req.body?.message?.text);
  const timestamp = normalizeTimestamp(
    req.body?.timestamp || req.body?.message?.timestamp || req.body?.receivedAt
  );

  const raw = normalizeObj(req.body?.raw);
  const customerContext = normalizeObj(req.body?.customerContext);
  const formData = normalizeObj(req.body?.formData);
  const leadContext = normalizeObj(req.body?.leadContext);
  const conversationContext = normalizeObj(req.body?.conversationContext);
  const tenantContext = normalizeObj(req.body?.tenantContext);
  const requestMeta = normalizeObj(req.body?.meta);

  return {
    tenantKey,
    channel,
    externalThreadId,
    externalUserId,
    externalUsername,
    customerName,
    externalMessageId,
    text,
    timestamp,
    raw,
    customerContext,
    formData,
    leadContext,
    conversationContext,
    tenantContext,
    meta: {
      ...requestMeta,
      source: cleanText(requestMeta.source || req.body?.source || provider) || provider,
      provider: cleanText(requestMeta.provider || provider) || provider,
      platform:
        cleanText(requestMeta.platform || req.body?.platform || defaultPlatformForChannel(channel)) ||
        defaultPlatformForChannel(channel),
      channel,
      timestamp,
      raw,
      customerContext,
      formData,
      leadContext,
      conversationContext,
      tenantContext,
    },
  };
}

export function validateIngestRequest(input) {
  if (!input.tenantKey) {
    return { ok: false, response: { ok: false, error: "tenantKey required" } };
  }

  if (!input.channel) {
    return { ok: false, response: { ok: false, error: "channel required" } };
  }

  if (!input.externalThreadId) {
    return {
      ok: false,
      response: { ok: false, error: "externalThreadId required" },
    };
  }

  if (!input.externalUserId) {
    return {
      ok: false,
      response: { ok: false, error: "externalUserId required" },
    };
  }

  if (!input.text) {
    return { ok: false, response: { ok: false, error: "text required" } };
  }

  return { ok: true };
}

export function parseOutboundRequest(req, existingThread) {
  const threadId = s(req.body?.threadId || "");
  const tenantKey = resolveTenantKeyFromReq(req, existingThread?.tenant_key);
  const channel =
    cleanText(req.body?.channel || existingThread?.channel || "instagram").toLowerCase() ||
    "instagram";

  const meta = normalizeObj(req.body?.meta);

  const recipientId =
    cleanText(
      req.body?.recipientId ||
        req.body?.recipient_id ||
        meta?.recipientId ||
        meta?.recipient_id ||
        meta?.chatId ||
        meta?.chat_id ||
        existingThread?.external_thread_id ||
        existingThread?.external_user_id
    ) || null;

  const senderType = cleanText(req.body?.senderType || req.body?.sender_type || "ai").toLowerCase() || "ai";
  const externalMessageId =
    cleanText(req.body?.providerMessageId || req.body?.externalMessageId || "") || null;

  const requestedMessageType = lower(req.body?.messageType || req.body?.message_type || "text") || "text";
  const messageType = normalizeInboxMessageType(requestedMessageType, "text");
  const text = cleanText(req.body?.text || "");
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

  const provider =
    cleanText(req.body?.provider || meta?.provider || defaultProviderForChannel(channel)) ||
    defaultProviderForChannel(channel);

  const maxAttempts = clamp(toInt(req.body?.maxAttempts, 5), 1, 20);
  const isControlMessage = isControlMessageType(requestedMessageType);

  return {
    threadId,
    tenantKey,
    channel,
    recipientId,
    senderType,
    externalMessageId,
    requestedMessageType,
    messageType,
    text,
    attachments,
    meta,
    provider,
    maxAttempts,
    isControlMessage,
  };
}

export function validateOutboundRequest(input) {
  if (!input.threadId) {
    return { ok: false, response: { ok: false, error: "threadId required" } };
  }

  if (!input.tenantKey) {
    return { ok: false, response: { ok: false, error: "tenantKey required" } };
  }

  if (!input.isControlMessage && !input.text && input.attachments.length === 0) {
    return {
      ok: false,
      response: { ok: false, error: "text or attachments required" },
    };
  }

  return { ok: true };
}
