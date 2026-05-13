import { fixText } from "../../../utils/textFix.js";
import { resolveTenantKeyFromReq } from "../../../tenancy/index.js";
import { inboundWebhookIdempotencyKey } from "../../../utils/idempotency.js";
import { clamp, s, toInt } from "../shared.js";
import { lower, normalizeObj } from "./shared.js";
import { isControlMessageType, normalizeInboxMessageType } from "./execution.js";

function defaultProviderForChannel(channel = "") {
  const normalized = lower(channel);
  if (["web", "webchat", "website", "website_widget"].includes(normalized)) {
    return "website_widget";
  }
  if (normalized === "telegram") return "telegram";
  if (["facebook", "instagram", "messenger", "meta", "whatsapp"].includes(normalized)) {
    return "meta";
  }
  return "unsupported";
}

function defaultPlatformForChannel(channel = "") {
  const safeChannel = lower(channel);
  return safeChannel || "instagram";
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

function cleanNullableText(value) {
  const next = cleanText(value);
  return next || null;
}

function cleanUsername(value) {
  const next = cleanText(value).replace(/^@+/, "");
  return next || null;
}

function looksLikeNumericIdentity(value = "") {
  const safe = cleanText(value);
  if (!safe) return false;
  return /^\d{5,}$/.test(safe);
}

function isPlaceholderDisplayName(value = "") {
  const safe = lower(value);
  if (!safe) return true;

  return [
    "customer",
    "conversation",
    "instagram user",
    "telegram user",
    "facebook user",
    "whatsapp user",
    "website user",
    "web user",
    "user",
    "unknown",
  ].includes(safe);
}

function joinNameParts(...parts) {
  const joined = parts
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(" ");

  return joined || "";
}

function pickBestCustomerName(...candidates) {
  for (const candidate of candidates) {
    const value = cleanText(candidate);
    if (!value) continue;
    if (looksLikeNumericIdentity(value)) continue;
    if (isPlaceholderDisplayName(value)) continue;
    return value;
  }

  return null;
}

function buildCustomerNameFromContexts({
  rawCustomerName = "",
  rawExternalUsername = "",
  customerContext = {},
  raw = {},
  from = {},
} = {}) {
  const safeCustomerContext = normalizeObj(customerContext);
  const safeRaw = normalizeObj(raw);
  const safeFrom = normalizeObj(from);

  const telegramCtx = normalizeObj(safeCustomerContext.telegram);
  const instagramCtx = normalizeObj(safeCustomerContext.instagram);
  const metaCtx = normalizeObj(safeCustomerContext.meta);
  const profileCtx = normalizeObj(safeCustomerContext.profile);

  const fromFullName = joinNameParts(
    safeFrom.fullName,
    safeFrom.first_name,
    safeFrom.last_name
  );

  const ctxFullName = joinNameParts(
    safeCustomerContext.fullName,
    safeCustomerContext.firstName,
    safeCustomerContext.lastName
  );

  const profileFullName = joinNameParts(
    profileCtx.fullName,
    profileCtx.firstName,
    profileCtx.lastName
  );

  const telegramFullName = joinNameParts(
    telegramCtx.fullName,
    telegramCtx.firstName,
    telegramCtx.lastName
  );

  const instagramFullName = joinNameParts(
    instagramCtx.fullName,
    instagramCtx.firstName,
    instagramCtx.lastName
  );

  const metaFullName = joinNameParts(
    metaCtx.fullName,
    metaCtx.firstName,
    metaCtx.lastName
  );

  return pickBestCustomerName(
    rawCustomerName,
    safeFrom.fullName,
    safeFrom.name,
    fromFullName,
    safeCustomerContext.fullName,
    safeCustomerContext.displayName,
    safeCustomerContext.name,
    ctxFullName,
    profileCtx.displayName,
    profileCtx.name,
    profileFullName,
    telegramCtx.displayName,
    telegramCtx.name,
    telegramFullName,
    instagramCtx.displayName,
    instagramCtx.name,
    instagramFullName,
    metaCtx.displayName,
    metaCtx.name,
    metaFullName,
    safeRaw?.customerName,
    safeRaw?.customer_name,
    safeRaw?.from?.name,
    safeRaw?.from?.fullName,
    rawExternalUsername
  );
}

export function parseIngestRequest(req) {
  const tenantKey = resolveTenantKeyFromReq(req);
  const channel =
    cleanText(req.body?.channel || req.body?.platform || "instagram").toLowerCase() ||
    "instagram";

  const provider =
    cleanText(req.body?.provider || req.body?.source || defaultProviderForChannel(channel)) ||
    defaultProviderForChannel(channel);

  const raw = normalizeObj(req.body?.raw);
  const from = normalizeObj(req.body?.from);
  const customerContext = normalizeObj(req.body?.customerContext);
  const formData = normalizeObj(req.body?.formData);
  const leadContext = normalizeObj(req.body?.leadContext);
  const conversationContext = normalizeObj(req.body?.conversationContext);
  const tenantContext = normalizeObj(req.body?.tenantContext);
  const requestMeta = normalizeObj(req.body?.meta);

  const externalUserId =
    cleanNullableText(
      req.body?.externalUserId ||
        req.body?.userId ||
        from?.userId ||
        from?.id ||
        customerContext?.telegram?.userId ||
        customerContext?.telegram?.user_id ||
        customerContext?.instagram?.userId ||
        customerContext?.instagram?.user_id ||
        customerContext?.meta?.userId ||
        customerContext?.meta?.user_id
    ) || null;

  const externalThreadId =
    cleanNullableText(
      req.body?.externalThreadId ||
        req.body?.threadExternalId ||
        req.body?.threadId ||
        req.body?.chatId ||
        customerContext?.telegram?.chatId ||
        customerContext?.telegram?.chat_id
    ) || null;

  const externalUsername =
    cleanUsername(
      req.body?.externalUsername ||
        from?.username ||
        req.body?.username ||
        customerContext?.username ||
        customerContext?.telegram?.username ||
        customerContext?.instagram?.username ||
        customerContext?.meta?.username
    ) || null;

  const customerName =
    buildCustomerNameFromContexts({
      rawCustomerName: req.body?.customerName,
      rawExternalUsername: externalUsername,
      customerContext,
      raw,
      from,
    }) || null;

  const externalMessageId =
    cleanNullableText(
      req.body?.externalMessageId ||
        req.body?.messageExternalId ||
        req.body?.message?.id
    ) || null;

  const text = cleanText(req.body?.text || req.body?.message?.text);
  const timestamp = normalizeTimestamp(
    req.body?.timestamp || req.body?.message?.timestamp || req.body?.receivedAt
  );

  const idempotencyKey = inboundWebhookIdempotencyKey({
    tenantKey,
    channel,
    provider,
    externalThreadId,
    externalMessageId,
    eventType: "inbox_message",
  });

  return {
    tenantKey,
    channel,
    provider,
    idempotencyKey,
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
        cleanText(
          requestMeta.platform ||
            req.body?.platform ||
            defaultPlatformForChannel(channel)
        ) || defaultPlatformForChannel(channel),
      channel,
      idempotencyKey,
      timestamp,
      raw,
      from,
      identity: {
        externalUserId: externalUserId || "",
        externalThreadId: externalThreadId || "",
        externalUsername: externalUsername || "",
        customerName: customerName || "",
      },
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
    cleanNullableText(
      req.body?.recipientId ||
        req.body?.recipient_id ||
        meta?.recipientId ||
        meta?.recipient_id ||
        meta?.chatId ||
        meta?.chat_id ||
        existingThread?.external_thread_id ||
        existingThread?.external_user_id
    ) || null;

  const senderType =
    cleanText(req.body?.senderType || req.body?.sender_type || "ai").toLowerCase() ||
    "ai";
  const externalMessageId =
    cleanNullableText(req.body?.providerMessageId || req.body?.externalMessageId || "") ||
    null;

  const requestedMessageType =
    lower(req.body?.messageType || req.body?.message_type || "text") || "text";
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
