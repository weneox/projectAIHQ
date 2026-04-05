import { cfg } from "../config.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function trimSlash(v) {
  return s(v).replace(/\/+$/, "");
}

function isAbortError(error) {
  return lower(error?.name) === "aborterror";
}

async function readJsonSafe(res) {
  const text = await res.text().catch(() => "");
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function maskTelegramToken(token = "") {
  const value = s(token);
  if (!value) return "";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

export function redactTelegramWebhookUrl(url = "") {
  const value = s(url);
  if (!value) return "";

  return value.replace(
    /(\/channels\/telegram\/webhook\/[^/]+\/)([^/?#]+)/i,
    "$1[redacted]"
  );
}

export function getTelegramResponseReasonCode(result = {}) {
  const status = Number(result?.status || result?.json?.error_code || 0);
  const description = lower(
    result?.json?.description || result?.error || result?.message || ""
  );

  if (status === 401) return "telegram_bot_token_invalid";
  if (status === 403 && description.includes("blocked")) {
    return "telegram_bot_blocked_by_user";
  }
  if (status === 403) return "telegram_forbidden";
  if (status === 404) return "telegram_resource_not_found";
  if (status === 400 && description.includes("chat not found")) {
    return "telegram_chat_not_found";
  }
  if (status === 400 && description.includes("message is too long")) {
    return "telegram_message_too_long";
  }
  if (status === 400 && description.includes("secret token")) {
    return "telegram_webhook_secret_invalid";
  }
  if (status === 400 && description.includes("bad webhook")) {
    return "telegram_webhook_invalid";
  }
  if (status === 429) return "telegram_rate_limited";
  if (status >= 500) return "telegram_upstream_unavailable";
  if (status === 0) return "telegram_network_error";
  return "telegram_request_failed";
}

export async function callTelegramBotApi({
  botToken = "",
  method = "",
  body = null,
  timeoutMs = cfg.telegram.sendTimeoutMs,
  apiBaseUrl = cfg.telegram.apiBaseUrl,
} = {}) {
  const token = s(botToken);
  const methodName = s(method);
  const baseUrl = trimSlash(apiBaseUrl);

  if (!token) {
    return {
      ok: false,
      status: 0,
      error: "telegram bot token missing",
      reasonCode: "telegram_bot_token_missing",
      json: null,
      result: null,
    };
  }

  if (!methodName) {
    return {
      ok: false,
      status: 0,
      error: "telegram method missing",
      reasonCode: "telegram_method_missing",
      json: null,
      result: null,
    };
  }

  if (!baseUrl) {
    return {
      ok: false,
      status: 0,
      error: "telegram api base url missing",
      reasonCode: "telegram_api_base_url_missing",
      json: null,
      result: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(1_000, Number(timeoutMs || 15_000))
  );

  try {
    const res = await fetch(`${baseUrl}/bot${token}/${methodName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify(body && typeof body === "object" ? body : {}),
      signal: controller.signal,
    });

    const json = await readJsonSafe(res);
    const ok = Boolean(res.ok && json?.ok !== false);
    const error = ok
      ? ""
      : s(
          json?.description || json?.error || json?.message || `Telegram ${res.status}`
        );

    return {
      ok,
      status: Number(res.status || 0),
      error,
      reasonCode: ok ? "" : getTelegramResponseReasonCode({
        status: res.status,
        json,
        error,
      }),
      json,
      result: obj(json?.result),
    };
  } catch (error) {
    const message = isAbortError(error)
      ? "telegram request timeout"
      : s(error?.message || error || "telegram request failed");

    return {
      ok: false,
      status: 0,
      error: message,
      reasonCode: isAbortError(error)
        ? "telegram_request_timeout"
        : "telegram_request_failed",
      json: null,
      result: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getTelegramBotMe({
  botToken = "",
  timeoutMs = cfg.telegram.connectTimeoutMs,
} = {}) {
  return callTelegramBotApi({
    botToken,
    method: "getMe",
    body: {},
    timeoutMs,
  });
}

export async function getTelegramWebhookInfo({
  botToken = "",
  timeoutMs = cfg.telegram.statusTimeoutMs,
} = {}) {
  return callTelegramBotApi({
    botToken,
    method: "getWebhookInfo",
    body: {},
    timeoutMs,
  });
}

export async function setTelegramWebhook({
  botToken = "",
  url = "",
  secretToken = "",
  allowedUpdates = ["message"],
  dropPendingUpdates = false,
  maxConnections = 40,
  timeoutMs = cfg.telegram.connectTimeoutMs,
} = {}) {
  return callTelegramBotApi({
    botToken,
    method: "setWebhook",
    body: {
      url: s(url),
      secret_token: s(secretToken) || undefined,
      allowed_updates: Array.isArray(allowedUpdates) ? allowedUpdates : ["message"],
      drop_pending_updates: Boolean(dropPendingUpdates),
      max_connections: Number(maxConnections || 40),
    },
    timeoutMs,
  });
}

export async function deleteTelegramWebhook({
  botToken = "",
  dropPendingUpdates = false,
  timeoutMs = cfg.telegram.connectTimeoutMs,
} = {}) {
  return callTelegramBotApi({
    botToken,
    method: "deleteWebhook",
    body: {
      drop_pending_updates: Boolean(dropPendingUpdates),
    },
    timeoutMs,
  });
}

export async function sendTelegramMessage({
  botToken = "",
  chatId = "",
  text = "",
  timeoutMs = cfg.telegram.sendTimeoutMs,
} = {}) {
  return callTelegramBotApi({
    botToken,
    method: "sendMessage",
    body: {
      chat_id: s(chatId),
      text: s(text),
    },
    timeoutMs,
  });
}

export async function sendTelegramChatAction({
  botToken = "",
  chatId = "",
  action = "typing",
  timeoutMs = cfg.telegram.sendTimeoutMs,
} = {}) {
  return callTelegramBotApi({
    botToken,
    method: "sendChatAction",
    body: {
      chat_id: s(chatId),
      action: s(action || "typing"),
    },
    timeoutMs,
  });
}
