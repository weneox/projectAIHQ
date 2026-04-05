import crypto from "crypto";
import express from "express";

import { getTenantBrainRuntime } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { isDbReady } from "../../../utils/http.js";
import { createInboxIngestHandler } from "../inbox/internal.js";
import { validateIngestRequest } from "../inbox/internal/request.js";
import {
  getPrimaryTelegramChannel,
  getTelegramSecrets,
  getTenantByKey,
} from "./repository.js";
import {
  TELEGRAM_BOT_TOKEN_SECRET_KEY,
  TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY,
  TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY,
} from "./telegram.js";
import { s } from "./utils.js";

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function safeSecretEquals(left = "", right = "") {
  const a = Buffer.from(s(left));
  const b = Buffer.from(s(right));
  if (!a.length || !b.length || a.length !== b.length) return false;

  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function buildTelegramCustomerName(from = {}) {
  const firstName = s(from?.first_name);
  const lastName = s(from?.last_name);
  return (
    [firstName, lastName].filter(Boolean).join(" ") ||
    s(from?.username) ||
    s(from?.id) ||
    "Telegram User"
  );
}

function normalizeTelegramWebhookUpdate(update = {}, tenantKey = "") {
  const safeUpdate = obj(update);
  const updateId = s(safeUpdate?.update_id);
  const message = obj(safeUpdate?.message);
  const chat = obj(message?.chat);
  const from = obj(message?.from);
  const text = s(message?.text);
  const chatType = s(chat?.type);

  if (!message || !chatType) {
    return {
      supported: false,
      reasonCode: "unsupported_update_type",
    };
  }

  if (chatType !== "private") {
    return {
      supported: false,
      reasonCode: "unsupported_chat_type",
    };
  }

  if (!text) {
    return {
      supported: false,
      reasonCode: "unsupported_message_type",
    };
  }

  const chatId = s(chat?.id);
  const userId = s(from?.id);
  const username = s(from?.username) || null;
  const firstName = s(from?.first_name) || null;
  const lastName = s(from?.last_name) || null;
  const messageId = s(message?.message_id);
  const timestamp =
    Number(message?.date || 0) > 0
      ? Number(message.date) * 1000
      : Date.now();

  return {
    supported: true,
    reasonCode: "",
    input: {
      tenantKey: s(tenantKey).toLowerCase(),
      channel: "telegram",
      externalThreadId: chatId,
      externalUserId: userId,
      externalUsername: username,
      customerName: buildTelegramCustomerName(from),
      externalMessageId: `telegram:${chatId}:${messageId}`,
      text,
      timestamp,
      raw: safeUpdate,
      customerContext: {
        telegram: {
          chatId,
          userId,
          username,
          firstName,
          lastName,
        },
      },
      formData: {},
      leadContext: {},
      conversationContext: {
        telegram: {
          updateId,
          messageId,
        },
      },
      tenantContext: {
        webhook: {
          provider: "telegram",
          updateId,
        },
      },
      meta: {
        source: "telegram",
        platform: "telegram",
        timestamp,
        raw: safeUpdate,
        telegram: {
          updateId,
          chatId,
          userId,
          username,
          firstName,
          lastName,
          messageId,
        },
      },
    },
  };
}

function createCaptureRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

export function createTelegramWebhookHandler({
  db,
  wsHub,
  getRuntime = getTenantBrainRuntime,
  buildActions,
  persistLead,
  applyHandoff,
} = {}) {
  const inboxIngestHandler = createInboxIngestHandler({
    db,
    wsHub,
    getRuntime,
    buildActions,
    persistLead,
    applyHandoff,
  });

  return async function telegramWebhookHandler(req, res) {
    if (!isDbReady(db)) {
      return res.status(503).json({
        ok: false,
        error: "db disabled",
        dbDisabled: true,
      });
    }

    const tenantKey = s(req.params?.tenantKey).toLowerCase();
    const routeToken = s(req.params?.routeToken);

    if (!tenantKey || !routeToken) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const tenant = await getTenantByKey(db, tenantKey);
    if (!tenant?.id) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const [channel, secrets] = await Promise.all([
      getPrimaryTelegramChannel(db, tenant.id),
      getTelegramSecrets(db, tenant.id),
    ]);

    if (!channel?.id) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const storedRouteToken = s(
      secrets?.[TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY]
    );
    if (!safeSecretEquals(routeToken, storedRouteToken)) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const headerSecret = s(req.get("x-telegram-bot-api-secret-token"));
    const storedHeaderSecret = s(
      secrets?.[TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY]
    );

    if (!safeSecretEquals(headerSecret, storedHeaderSecret)) {
      return res.status(403).json({
        ok: false,
        error: "Forbidden",
        reasonCode: "telegram_webhook_secret_invalid",
      });
    }

    if (!s(secrets?.[TELEGRAM_BOT_TOKEN_SECRET_KEY])) {
      return res.status(503).json({
        ok: false,
        error: "telegram bot token missing",
        reasonCode: "telegram_bot_token_missing",
      });
    }

    const normalized = normalizeTelegramWebhookUpdate(req.body, tenant.tenant_key);
    if (!normalized.supported) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reasonCode: normalized.reasonCode,
      });
    }

    const validation = validateIngestRequest(normalized.input);
    if (!validation.ok) {
      return res.status(400).json(validation.response);
    }

    const captureRes = createCaptureRes();
    await inboxIngestHandler(
      {
        originalUrl: req.originalUrl,
        url: req.url,
        path: req.path,
        headers: {
          "x-tenant-key": tenant.tenant_key,
          "x-internal-token": "telegram-webhook",
        },
        body: {
          ...normalized.input,
          source: "telegram",
          platform: "telegram",
        },
      },
      captureRes
    );

    const payload = captureRes.body;

    if (payload?.ok === true) {
      return res.status(200).json(payload);
    }

    return res.status(503).json(
      payload || {
        ok: false,
        error: "telegram_webhook_processing_failed",
      }
    );
  };
}

export function channelConnectPublicRoutes({
  db,
  wsHub,
  getRuntime = getTenantBrainRuntime,
  buildActions,
  persistLead,
  applyHandoff,
} = {}) {
  const router = express.Router();

  router.post(
    "/channels/telegram/webhook/:tenantKey/:routeToken",
    createTelegramWebhookHandler({
      db,
      wsHub,
      getRuntime,
      buildActions,
      persistLead,
      applyHandoff,
    })
  );

  return router;
}
