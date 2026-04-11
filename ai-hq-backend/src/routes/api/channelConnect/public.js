import crypto from "crypto";
import express from "express";

import { cfg } from "../../../config.js";
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
import { lower, s } from "./utils.js";

const TELEGRAM_PROVIDER = "telegram";
const TELEGRAM_CHANNEL = "telegram";
const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function hasText(v) {
  return !!s(v);
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

function fingerprintSecret(value = "") {
  const text = s(value);
  if (!text) return "";
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
}

function buildWebhookDebugMeta(req, extra = {}) {
  return {
    method: s(req?.method),
    path: s(req?.path),
    originalUrl: s(req?.originalUrl),
    tenantKeyParam: lower(req?.params?.tenantKey),
    hasRouteTokenParam: Boolean(s(req?.params?.routeToken)),
    userAgent: s(req?.get?.("user-agent")),
    contentType: s(req?.get?.("content-type")),
    xForwardedFor: s(req?.get?.("x-forwarded-for")),
    ...extra,
  };
}

function buildTelegramCustomerName(from = {}) {
  const firstName = s(from?.first_name);
  const lastName = s(from?.last_name);
  const full = [firstName, lastName].filter(Boolean).join(" ");
  if (full) return full;
  return s(from?.username || from?.id || "Telegram User");
}

function normalizeTelegramWebhookUpdate(update = {}, tenantKey = "") {
  const safeUpdate = obj(update);
  const updateId = s(safeUpdate?.update_id);
  const message = obj(safeUpdate?.message);
  const chat = obj(message?.chat);
  const from = obj(message?.from);
  const text = s(message?.text);
  const chatType = lower(chat?.type);
  const chatId = s(chat?.id);
  const userId = s(from?.id);
  const messageId = s(message?.message_id);

  if (!hasText(updateId) && !messageId) {
    return {
      supported: false,
      reasonCode: "unsupported_update_type",
    };
  }

  if (!Object.keys(message).length) {
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

  if (!chatId || !userId || !messageId) {
    return {
      supported: false,
      reasonCode: "telegram_update_missing_identity",
    };
  }

  const username = s(from?.username) || null;
  const firstName = s(from?.first_name) || null;
  const lastName = s(from?.last_name) || null;
  const timestamp =
    Number(message?.date || 0) > 0 ? Number(message.date) * 1000 : Date.now();

  return {
    supported: true,
    reasonCode: "",
    input: {
      tenantKey: lower(tenantKey),
      channel: TELEGRAM_CHANNEL,
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
          chatId,
        },
      },
      tenantContext: {
        webhook: {
          provider: TELEGRAM_PROVIDER,
          updateId,
        },
      },
      meta: {
        source: TELEGRAM_PROVIDER,
        platform: TELEGRAM_PROVIDER,
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

function buildInternalIngestRequest(req, tenantKey, normalizedInput) {
  return {
    originalUrl: req.originalUrl,
    url: req.url,
    path: req.path,
    method: "POST",
    headers: {
      "x-tenant-key": tenantKey,
      "x-internal-token": "telegram-webhook",
      "x-channel-provider": TELEGRAM_PROVIDER,
    },
    body: {
      ...normalizedInput,
      source: TELEGRAM_PROVIDER,
      platform: TELEGRAM_PROVIDER,
      channel: TELEGRAM_CHANNEL,
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
    try {
      if (!isDbReady(db)) {
        console.error(
          "telegram.webhook.db_disabled",
          buildWebhookDebugMeta(req, {
            reasonCode: "db_disabled",
          })
        );

        return res.status(503).json({
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      const tenantKey = lower(req.params?.tenantKey);
      const routeToken = s(req.params?.routeToken);

      if (!tenantKey || !routeToken) {
        console.warn(
          "telegram.webhook.route_missing",
          buildWebhookDebugMeta(req, {
            tenantKey,
            hasRouteToken: Boolean(routeToken),
          })
        );

        return res.status(404).json({ ok: false, error: "Not found" });
      }

      const tenant = await getTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        console.warn(
          "telegram.webhook.tenant_not_found",
          buildWebhookDebugMeta(req, {
            tenantKey,
          })
        );

        return res.status(404).json({ ok: false, error: "Not found" });
      }

      const [channel, secrets] = await Promise.all([
        getPrimaryTelegramChannel(db, tenant.id),
        getTelegramSecrets(db, tenant.id),
      ]);

      if (!channel?.id || lower(channel?.channel_type) !== TELEGRAM_CHANNEL) {
        console.warn(
          "telegram.webhook.channel_not_found",
          buildWebhookDebugMeta(req, {
            tenantKey,
            tenantId: s(tenant?.id),
            channelId: s(channel?.id),
            channelType: s(channel?.channel_type),
          })
        );

        return res.status(404).json({ ok: false, error: "Not found" });
      }

      const storedRouteToken = s(
        secrets?.[TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY]
      );

      if (!safeSecretEquals(routeToken, storedRouteToken)) {
        console.warn(
          "telegram.webhook.route_token_mismatch",
          buildWebhookDebugMeta(req, {
            tenantKey,
            tenantId: s(tenant?.id),
            channelId: s(channel?.id),
            routeTokenLength: routeToken.length,
            storedRouteTokenLength: storedRouteToken.length,
            routeTokenFingerprint: fingerprintSecret(routeToken),
            storedRouteTokenFingerprint: fingerprintSecret(storedRouteToken),
          })
        );

        return res.status(404).json({ ok: false, error: "Not found" });
      }

      const headerSecret = s(req.get(TELEGRAM_SECRET_HEADER));
      const storedHeaderSecret = s(
        secrets?.[TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY]
      );
      const secretHeaderMatched = safeSecretEquals(
        headerSecret,
        storedHeaderSecret
      );

      if (!secretHeaderMatched) {
        console.warn(
          "telegram.webhook.secret_mismatch",
          buildWebhookDebugMeta(req, {
            tenantKey,
            tenantId: s(tenant?.id),
            channelId: s(channel?.id),
            routeTokenMatched: true,
            hasHeaderSecret: Boolean(headerSecret),
            hasStoredHeaderSecret: Boolean(storedHeaderSecret),
            headerSecretLength: headerSecret.length,
            storedHeaderSecretLength: storedHeaderSecret.length,
            headerSecretFingerprint: fingerprintSecret(headerSecret),
            storedHeaderSecretFingerprint: fingerprintSecret(storedHeaderSecret),
            verificationMode: cfg.telegram.allowRouteTokenFallback
              ? "route_token_fallback"
              : "strict_secret_header",
          })
        );

        if (!cfg.telegram.allowRouteTokenFallback) {
          return res.status(403).json({
            ok: false,
            error: "Forbidden",
            reasonCode: "telegram_webhook_secret_invalid",
          });
        }
      }

      const botToken = s(secrets?.[TELEGRAM_BOT_TOKEN_SECRET_KEY]);
      if (!botToken) {
        console.error(
          "telegram.webhook.bot_token_missing",
          buildWebhookDebugMeta(req, {
            tenantKey,
            tenantId: s(tenant?.id),
            channelId: s(channel?.id),
            reasonCode: "telegram_bot_token_missing",
          })
        );

        return res.status(503).json({
          ok: false,
          error: "telegram bot token missing",
          reasonCode: "telegram_bot_token_missing",
        });
      }

      const normalized = normalizeTelegramWebhookUpdate(
        req.body,
        tenant.tenant_key
      );

      if (!normalized.supported) {
        console.info(
          "telegram.webhook.ignored_update",
          buildWebhookDebugMeta(req, {
            tenantKey,
            tenantId: s(tenant?.id),
            channelId: s(channel?.id),
            reasonCode: s(normalized.reasonCode),
            updateId: s(req?.body?.update_id),
          })
        );

        return res.status(200).json({
          ok: true,
          ignored: true,
          reasonCode: normalized.reasonCode,
        });
      }

      const validation = validateIngestRequest(normalized.input);
      if (!validation.ok) {
        console.warn(
          "telegram.webhook.validation_failed",
          buildWebhookDebugMeta(req, {
            tenantKey,
            tenantId: s(tenant?.id),
            channelId: s(channel?.id),
            updateId: s(req?.body?.update_id),
            externalThreadId: s(normalized?.input?.externalThreadId),
            externalUserId: s(normalized?.input?.externalUserId),
          })
        );

        return res.status(400).json(validation.response);
      }

      const captureRes = createCaptureRes();

      await inboxIngestHandler(
        buildInternalIngestRequest(req, tenant.tenant_key, normalized.input),
        captureRes
      );

      const payload = captureRes.body;

      if (payload?.ok === true) {
        console.info(
          "telegram.webhook.ingest_succeeded",
          buildWebhookDebugMeta(req, {
            tenantKey,
            tenantId: s(tenant?.id),
            channelId: s(channel?.id),
            updateId: s(req?.body?.update_id),
            externalThreadId: s(normalized?.input?.externalThreadId),
            externalUserId: s(normalized?.input?.externalUserId),
            ingestStatusCode: Number(captureRes.statusCode || 200),
            secretHeaderMatched,
          })
        );

        return res.status(200).json(payload);
      }

      console.error(
        "telegram.webhook.ingest_failed",
        buildWebhookDebugMeta(req, {
          tenantKey,
          tenantId: s(tenant?.id),
          channelId: s(channel?.id),
          updateId: s(req?.body?.update_id),
          externalThreadId: s(normalized?.input?.externalThreadId),
          externalUserId: s(normalized?.input?.externalUserId),
          ingestStatusCode: Number(captureRes.statusCode || 503),
          ingestError: s(payload?.error),
          ingestReasonCode: s(payload?.reasonCode),
          secretHeaderMatched,
        })
      );

      return res.status(503).json(
        payload || {
          ok: false,
          error: "telegram_webhook_processing_failed",
        }
      );
    } catch (error) {
      console.error(
        "telegram.webhook.unhandled_error",
        buildWebhookDebugMeta(req, {
          error: s(error?.message || "telegram_webhook_unhandled_error"),
          stack: s(error?.stack),
        })
      );

      return res.status(500).json({
        ok: false,
        error: s(error?.message || "telegram_webhook_unhandled_error"),
        reasonCode: "telegram_webhook_unhandled_error",
      });
    }
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

export const __test__ = {
  normalizeTelegramWebhookUpdate,
  safeSecretEquals,
  buildInternalIngestRequest,
  fingerprintSecret,
};