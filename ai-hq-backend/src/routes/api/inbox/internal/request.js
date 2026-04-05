import { fixText } from "../../../../utils/textFix.js";
import { resolveTenantKeyFromReq } from "../../../../tenancy/index.js";
import { clamp, s, toInt } from "../shared.js";
import { lower, normalizeObj } from "./shared.js";
import { isControlMessageType, normalizeInboxMessageType } from "./execution.js";

function defaultProviderForChannel(channel = "") {
  return lower(channel) === "telegram" ? "telegram" : "meta";
}

export function parseIngestRequest(req) {
  const tenantKey = resolveTenantKeyFromReq(req);
  const channel = s(req.body?.channel || "instagram").toLowerCase() || "instagram";

  const externalThreadId =
    fixText(
      s(
        req.body?.externalThreadId ||
          req.body?.threadExternalId ||
          req.body?.threadId
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

  const raw = normalizeObj(req.body?.raw);
  const customerContext = normalizeObj(req.body?.customerContext);
  const formData = normalizeObj(req.body?.formData);
  const leadContext = normalizeObj(req.body?.leadContext);
  const conversationContext = normalizeObj(req.body?.conversationContext);
  const tenantContext = normalizeObj(req.body?.tenantContext);

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
      source: fixText(s(req.body?.source || "meta")) || "meta",
      platform: fixText(s(req.body?.platform || "instagram")) || "instagram",
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
  if (!input.tenantKey) return { ok: false, response: { ok: false, error: "tenantKey required" } };
  if (!input.text) return { ok: false, response: { ok: false, error: "text required" } };
  return { ok: true };
}

export function parseOutboundRequest(req, existingThread) {
  const threadId = s(req.body?.threadId || "");
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
  const meta = normalizeObj(req.body?.meta);
  const provider =
    s(req.body?.provider || defaultProviderForChannel(channel)) ||
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
  if (!input.threadId) return { ok: false, response: { ok: false, error: "threadId required" } };
  if (!input.isControlMessage && !input.text && input.attachments.length === 0) {
    return {
      ok: false,
      response: { ok: false, error: "text or attachments required" },
    };
  }
  return { ok: true };
}
