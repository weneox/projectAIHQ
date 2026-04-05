import { getPrimaryTelegramChannel, getTelegramSecrets } from "../routes/api/channelConnect/repository.js";
import { sendOutboundViaMetaGateway } from "./metaGatewayClient.js";
import { sendTelegramChatAction, sendTelegramMessage } from "../utils/telegram.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function resolveDeliveryProvider({ execution = {}, payload = {}, thread = {} } = {}) {
  return (
    lower(execution?.provider) ||
    lower(payload?.provider) ||
    (lower(thread?.channel) === "telegram" ? "telegram" : "meta")
  );
}

function resolvePayloadActionType(payload = {}) {
  const meta = obj(payload?.meta);
  const explicit = lower(meta?.actionType || payload?.actionType);
  if (explicit) return explicit;

  const messageType = lower(payload?.messageType);
  if (messageType === "typing_on") return "typing_on";
  if (messageType === "typing_off") return "typing_off";
  if (messageType === "mark_seen") return "mark_seen";
  return "send_message";
}

async function deliverMetaOutbound(payload = {}) {
  const gateway = await sendOutboundViaMetaGateway(payload);
  const providerResult = gateway?.json?.result || gateway?.json || {};
  const providerResponse =
    providerResult?.response || providerResult?.json || providerResult || {};
  const providerMessageId =
    s(
      providerResponse?.message_id ||
        providerResponse?.messageId ||
        providerResponse?.id
    ) || null;

  return {
    ...gateway,
    providerResponse,
    providerMessageId,
  };
}

async function deliverTelegramOutbound({ db, execution = {}, payload = {}, thread = {} } = {}) {
  const tenantId =
    s(execution?.tenant_id || execution?.tenantId) ||
    s(thread?.tenant_id || thread?.tenantId);
  if (!tenantId) {
    return {
      ok: false,
      status: 0,
      error: "telegram tenant missing",
      reasonCode: "telegram_tenant_missing",
      json: null,
      providerResponse: {},
      providerMessageId: null,
    };
  }

  const [channel, secrets] = await Promise.all([
    getPrimaryTelegramChannel(db, tenantId),
    getTelegramSecrets(db, tenantId),
  ]);
  if (!channel?.id) {
    return {
      ok: false,
      status: 0,
      error: "telegram channel missing",
      reasonCode: "telegram_channel_missing",
      json: null,
      providerResponse: {},
      providerMessageId: null,
    };
  }

  const botToken = s(secrets?.bot_token);
  if (!botToken) {
    return {
      ok: false,
      status: 0,
      error: "telegram bot token missing",
      reasonCode: "telegram_bot_token_missing",
      json: null,
      providerResponse: {},
      providerMessageId: null,
    };
  }

  const actionType = resolvePayloadActionType(payload);
  const recipientId =
    s(payload?.recipientId) ||
    s(obj(payload?.meta)?.recipientId) ||
    s(thread?.external_thread_id) ||
    s(thread?.external_user_id);

  if (!recipientId) {
    return {
      ok: false,
      status: 0,
      error: "telegram chat id missing",
      reasonCode: "telegram_chat_not_found",
      json: null,
      providerResponse: {},
      providerMessageId: null,
    };
  }

  let result = null;

  if (actionType === "typing_on") {
    result = await sendTelegramChatAction({
      botToken,
      chatId: recipientId,
      action: "typing",
    });
  } else if (actionType === "typing_off" || actionType === "mark_seen") {
    result = {
      ok: false,
      status: 400,
      error: `${actionType} is not supported by Telegram delivery`,
      reasonCode: "telegram_action_unsupported",
      json: null,
      result: null,
    };
  } else if (arr(payload?.attachments).length > 0) {
    result = {
      ok: false,
      status: 400,
      error: "telegram attachment delivery is not supported for this action",
      reasonCode: "telegram_action_unsupported",
      json: null,
      result: null,
    };
  } else {
    result = await sendTelegramMessage({
      botToken,
      chatId: recipientId,
      text: s(payload?.text),
    });
  }

  const providerResponse = result?.result || obj(result?.json?.result);
  const providerMessageId =
    s(
      providerResponse?.message_id ||
        providerResponse?.messageId ||
        providerResponse?.id
    ) || null;

  return {
    ...result,
    providerResponse,
    providerMessageId,
  };
}

export async function deliverChannelOutbound({
  db,
  execution = {},
  payload = {},
  message = {},
  thread = {},
} = {}) {
  const provider = resolveDeliveryProvider({ execution, payload, thread, message });

  if (provider === "meta") {
    return deliverMetaOutbound(payload);
  }

  if (provider === "telegram") {
    return deliverTelegramOutbound({ db, execution, payload, message, thread });
  }

  return {
    ok: false,
    status: 0,
    error: `unsupported delivery provider: ${provider || "unknown"}`,
    reasonCode: "unsupported_delivery_provider",
    json: null,
    providerResponse: {},
    providerMessageId: null,
  };
}
