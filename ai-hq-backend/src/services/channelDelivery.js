import {
  getPrimaryTelegramChannel,
  getTelegramSecrets,
} from "../routes/api/channelConnect/repository.js";
import {
  TELEGRAM_BOT_TOKEN_SECRET_KEY,
} from "../routes/api/channelConnect/telegram.js";
import { sendOutboundViaMetaGateway } from "./metaGatewayClient.js";
import {
  sendTelegramChatAction,
  sendTelegramMessage,
} from "../utils/telegram.js";

const META_PROVIDER = "meta";
const TELEGRAM_PROVIDER = "telegram";

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

function buildDeliveryFailure({
  error = "delivery failed",
  reasonCode = "delivery_failed",
  status = 0,
  json = null,
  providerResponse = {},
  providerMessageId = null,
} = {}) {
  return {
    ok: false,
    status: Number(status || 0),
    error: s(error || "delivery failed"),
    reasonCode: s(reasonCode || "delivery_failed"),
    json,
    providerResponse: obj(providerResponse),
    providerMessageId: s(providerMessageId) || null,
  };
}

function buildDeliverySuccess({
  source = {},
  providerResponse = {},
  providerMessageId = null,
} = {}) {
  return {
    ...source,
    ok: true,
    status: Number(source?.status || 200),
    error: "",
    reasonCode: "",
    providerResponse: obj(providerResponse),
    providerMessageId: s(providerMessageId) || null,
  };
}

function resolveDeliveryProvider({ execution = {}, payload = {}, thread = {} } = {}) {
  return (
    lower(execution?.provider) ||
    lower(payload?.provider) ||
    lower(obj(payload?.meta)?.provider) ||
    (lower(thread?.channel) === TELEGRAM_PROVIDER
      ? TELEGRAM_PROVIDER
      : META_PROVIDER)
  );
}

function resolvePayloadActionType(payload = {}) {
  const meta = obj(payload?.meta);
  const explicit = lower(meta?.actionType || payload?.actionType);
  if (explicit) return explicit;

  const messageType = lower(payload?.messageType || payload?.message_type);
  if (messageType === "typing_on") return "typing_on";
  if (messageType === "typing_off") return "typing_off";
  if (messageType === "mark_seen") return "mark_seen";

  return "send_message";
}

function resolveTelegramTenantId({ execution = {}, thread = {}, message = {} } = {}) {
  return (
    s(execution?.tenant_id || execution?.tenantId) ||
    s(thread?.tenant_id || thread?.tenantId) ||
    s(message?.tenant_id || message?.tenantId)
  );
}

function resolveTelegramRecipientId({ payload = {}, thread = {}, message = {} } = {}) {
  const meta = obj(payload?.meta);
  const messageMeta = obj(message?.meta);

  return (
    s(payload?.recipientId) ||
    s(payload?.recipient_id) ||
    s(meta?.recipientId) ||
    s(meta?.recipient_id) ||
    s(meta?.chatId) ||
    s(meta?.chat_id) ||
    s(messageMeta?.recipientId) ||
    s(messageMeta?.recipient_id) ||
    s(messageMeta?.chatId) ||
    s(messageMeta?.chat_id) ||
    s(thread?.external_thread_id) ||
    s(thread?.external_user_id) ||
    s(thread?.customer_external_id)
  );
}

function resolveTelegramText({ payload = {}, message = {} } = {}) {
  return (
    s(payload?.text) ||
    s(payload?.body) ||
    s(message?.text) ||
    s(message?.body)
  );
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

  if (!gateway?.ok) {
    return buildDeliveryFailure({
      error: gateway?.error || "meta delivery failed",
      reasonCode: gateway?.reasonCode || "meta_delivery_failed",
      status: gateway?.status || 0,
      json: gateway?.json || null,
      providerResponse,
      providerMessageId,
    });
  }

  return buildDeliverySuccess({
    source: gateway,
    providerResponse,
    providerMessageId,
  });
}

async function deliverTelegramOutbound({
  db,
  execution = {},
  payload = {},
  message = {},
  thread = {},
} = {}) {
  const tenantId = resolveTelegramTenantId({ execution, thread, message });
  if (!tenantId) {
    return buildDeliveryFailure({
      error: "telegram tenant missing",
      reasonCode: "telegram_tenant_missing",
    });
  }

  const [channel, secrets] = await Promise.all([
    getPrimaryTelegramChannel(db, tenantId),
    getTelegramSecrets(db, tenantId),
  ]);

  if (!channel?.id) {
    return buildDeliveryFailure({
      error: "telegram channel missing",
      reasonCode: "telegram_channel_missing",
    });
  }

  const botToken = s(secrets?.[TELEGRAM_BOT_TOKEN_SECRET_KEY]);
  if (!botToken) {
    return buildDeliveryFailure({
      error: "telegram bot token missing",
      reasonCode: "telegram_bot_token_missing",
    });
  }

  const actionType = resolvePayloadActionType(payload);
  const recipientId = resolveTelegramRecipientId({ payload, thread, message });

  if (!recipientId) {
    return buildDeliveryFailure({
      error: "telegram chat id missing",
      reasonCode: "telegram_chat_not_found",
    });
  }

  if (actionType === "typing_off" || actionType === "mark_seen") {
    return buildDeliveryFailure({
      error: `${actionType} is not supported by Telegram delivery`,
      reasonCode: "telegram_action_unsupported",
      status: 400,
    });
  }

  if (arr(payload?.attachments).length > 0) {
    return buildDeliveryFailure({
      error: "telegram attachment delivery is not supported for this action",
      reasonCode: "telegram_action_unsupported",
      status: 400,
    });
  }

  let result = null;

  if (actionType === "typing_on") {
    result = await sendTelegramChatAction({
      botToken,
      chatId: recipientId,
      action: "typing",
    });
  } else {
    const text = resolveTelegramText({ payload, message });
    if (!text) {
      return buildDeliveryFailure({
        error: "telegram message text missing",
        reasonCode: "telegram_message_empty",
        status: 400,
      });
    }

    result = await sendTelegramMessage({
      botToken,
      chatId: recipientId,
      text,
    });
  }

  const providerResponse = result?.result || obj(result?.json?.result);
  const providerMessageId =
    s(
      providerResponse?.message_id ||
        providerResponse?.messageId ||
        providerResponse?.id
    ) || null;

  if (!result?.ok) {
    return buildDeliveryFailure({
      error: result?.error || "telegram delivery failed",
      reasonCode: result?.reasonCode || "telegram_delivery_failed",
      status: result?.status || 0,
      json: result?.json || null,
      providerResponse,
      providerMessageId,
    });
  }

  return buildDeliverySuccess({
    source: result,
    providerResponse,
    providerMessageId,
  });
}

export async function deliverChannelOutbound({
  db,
  execution = {},
  payload = {},
  message = {},
  thread = {},
} = {}) {
  const provider = resolveDeliveryProvider({ execution, payload, thread });

  if (provider === META_PROVIDER) {
    return deliverMetaOutbound(payload);
  }

  if (provider === TELEGRAM_PROVIDER) {
    return deliverTelegramOutbound({
      db,
      execution,
      payload,
      message,
      thread,
    });
  }

  return buildDeliveryFailure({
    error: `unsupported delivery provider: ${provider || "unknown"}`,
    reasonCode: "unsupported_delivery_provider",
  });
}