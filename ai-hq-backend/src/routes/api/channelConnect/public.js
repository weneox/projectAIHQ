import crypto from "crypto";
import express from "express";

import { cfg } from "../../../config.js";
import { getTenantBrainRuntime } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { isDbReady } from "../../../utils/http.js";
import { createLogger } from "../../../utils/logger.js";
import { resolveTelegramUserAvatar } from "../../../utils/telegram.js";
import { createInboxIngestHandler } from "../inbox/internal.js";
import { validateIngestRequest } from "../inbox/internal/request.js";
import {
  getPrimaryTelegramChannel,
  getTelegramSecrets,
  getTenantByKey,
} from "./repository.js";
import { getWebsiteWidgetStatus } from "./website.js";
import { normalizeWidgetConfig, resolveWidgetEnabled } from "../websiteWidget/config.js";
import {
  TELEGRAM_BOT_TOKEN_SECRET_KEY,
  TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY,
  TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY,
} from "./telegram.js";
import { lower, s } from "./utils.js";

const TELEGRAM_PROVIDER = "telegram";
const TELEGRAM_CHANNEL = "telegram";
const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const webhookLog = createLogger({
  service: "ai-hq-backend",
  component: "channel-connect-public",
});

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

function buildTelegramWebhookVerificationMode({
  strictSecretHeaderVerification = true,
  allowRouteTokenFallback = false,
} = {}) {
  const strict = strictSecretHeaderVerification !== false;
  const allowFallback = allowRouteTokenFallback === true;

  if (strict && allowFallback) {
    return "strict_secret_header_with_route_token_fallback";
  }
  if (strict) return "strict_secret_header";
  if (allowFallback) return "route_token_fallback";
  return "route_token_only";
}

function evaluateTelegramWebhookSecretCheck({
  headerSecret = "",
  storedHeaderSecret = "",
  strictSecretHeaderVerification = true,
  allowRouteTokenFallback = false,
} = {}) {
  const secretHeaderMatched = safeSecretEquals(
    headerSecret,
    storedHeaderSecret
  );
  const strict = strictSecretHeaderVerification !== false;
  const allowFallback = allowRouteTokenFallback === true;
  const verificationMode = buildTelegramWebhookVerificationMode({
    strictSecretHeaderVerification: strict,
    allowRouteTokenFallback: allowFallback,
  });

  return {
    secretHeaderMatched,
    strictSecretHeaderVerification: strict,
    allowRouteTokenFallback: allowFallback,
    verificationMode,
    shouldReject: !secretHeaderMatched && strict && !allowFallback,
    accepted: secretHeaderMatched || !strict || allowFallback,
  };
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

function logWebhookEvent(level = "info", event = "", req, extra = {}) {
  const payload = buildWebhookDebugMeta(req, extra);

  if (level === "error") {
    webhookLog.error(event, payload);
    return;
  }
  if (level === "warn") {
    webhookLog.warn(event, payload);
    return;
  }
  webhookLog.info(event, payload);
}

function buildTelegramCustomerName(from = {}) {
  const firstName = s(from?.first_name);
  const lastName = s(from?.last_name);
  const full = [firstName, lastName].filter(Boolean).join(" ");
  if (full) return full;
  return s(from?.username || from?.id || "Telegram User");
}

function buildTelegramAvatarPatch(avatarResult = null) {
  if (!avatarResult || typeof avatarResult !== "object") return null;

  if (avatarResult.ok && avatarResult.hasAvatar) {
    return {
      avatarAvailable: true,
      avatarUserId: s(avatarResult.userId) || null,
      avatarFileId: s(avatarResult.fileId) || null,
      avatarFileUniqueId: s(avatarResult.fileUniqueId) || null,
      avatarFilePath: s(avatarResult.filePath) || null,
      avatarFetchedAt: new Date().toISOString(),
    };
  }

  if (avatarResult.ok && avatarResult.hasAvatar === false) {
    return {
      avatarAvailable: false,
      avatarUserId: s(avatarResult.userId) || null,
      avatarFileId: null,
      avatarFileUniqueId: null,
      avatarFilePath: null,
      avatarFetchedAt: new Date().toISOString(),
    };
  }

  return null;
}

function attachTelegramAvatarToInput(input = {}, avatarResult = null) {
  const patch = buildTelegramAvatarPatch(avatarResult);
  if (!patch) return input;

  const existingCustomerContext = obj(input?.customerContext);
  const existingTelegramContext = obj(existingCustomerContext?.telegram);
  const existingProfileContext = obj(existingCustomerContext?.profile);
  const existingMeta = obj(input?.meta);
  const existingMetaTelegram = obj(existingMeta?.telegram);
  const existingIdentity = obj(existingMeta?.identity);

  return {
    ...input,
    customerContext: {
      ...existingCustomerContext,
      profile: {
        ...existingProfileContext,
        ...patch,
      },
      telegram: {
        ...existingTelegramContext,
        ...patch,
      },
    },
    meta: {
      ...existingMeta,
      identity: {
        ...existingIdentity,
        ...patch,
      },
      telegram: {
        ...existingMetaTelegram,
        ...patch,
      },
    },
  };
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
  const fullName = buildTelegramCustomerName(from);
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
      customerName: fullName,
      externalMessageId: `telegram:${chatId}:${messageId}`,
      text,
      timestamp,
      raw: safeUpdate,
      customerContext: {
        fullName,
        username,
        externalUserId: userId,
        channel: TELEGRAM_CHANNEL,
        profile: {
          fullName,
          username,
        },
        telegram: {
          chatId,
          userId,
          username,
          fullName,
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
        provider: TELEGRAM_PROVIDER,
        platform: TELEGRAM_PROVIDER,
        channel: TELEGRAM_CHANNEL,
        timestamp,
        raw: safeUpdate,
        identity: {
          externalUserId: userId,
          externalThreadId: chatId,
          externalUsername: username,
          customerName: fullName,
        },
        telegram: {
          updateId,
          chatId,
          userId,
          username,
          fullName,
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

function getPublicWidgetOrigin(req = {}) {
  return s(
    req.get?.("origin") ||
      req.get?.("referer") ||
      req.query?.origin ||
      req.body?.origin ||
      ""
  );
}

function normalizeOriginHost(value = "") {
  const raw = s(value).toLowerCase();
  if (!raw) return "";

  try {
    return s(new URL(raw).hostname).replace(/^www\./i, "");
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0]
      .trim();
  }
}

function originAllowedForWidget(origin = "", config = {}) {
  const host = normalizeOriginHost(origin);
  if (!host) return false;

  const allowedDomains = Array.isArray(config.allowedDomains)
    ? config.allowedDomains.map(normalizeOriginHost).filter(Boolean)
    : [];

  const allowedOrigins = Array.isArray(config.allowedOrigins)
    ? config.allowedOrigins.map(normalizeOriginHost).filter(Boolean)
    : [];

  return [...allowedDomains, ...allowedOrigins].some((item) => item === host);
}

async function buildPublicWidgetRuntimeGuard({ db, tenantKey = "" } = {}) {
  if (!db?.query || !tenantKey) {
    return {
      publicAnswering: false,
      approvedTruthReady: false,
      reasonCode: "runtime_authority_context_missing",
      summary: "Approved runtime authority is unavailable.",
      authority: null,
    };
  }

  try {
    const runtime = await getTenantBrainRuntime({
      db,
      tenantKey,
      service: "website_widget",
      channelType: "webchat",
      authorityMode: "strict",
    });

    const authority = obj(runtime?.authority);
    const available =
      authority.available === true &&
      authority.stale !== true &&
      s(authority.source) === "approved_runtime_projection" &&
      Boolean(s(authority.runtimeProjectionId || authority.projectionHash));

    return {
      publicAnswering: available,
      approvedTruthReady: available,
      reasonCode: available
        ? ""
        : s(authority.reasonCode, "approved_runtime_projection_unavailable"),
      summary: available
        ? "Approved runtime projection is available for guarded public answers."
        : "Public AI answers are disabled until approved runtime truth is available.",
      authority: {
        mode: s(authority.mode, "strict"),
        available: authority.available === true,
        source: s(authority.source),
        runtimeProjectionId: s(authority.runtimeProjectionId),
        projectionHash: s(authority.projectionHash),
        stale: authority.stale === true,
        reasonCode: s(authority.reasonCode),
      },
    };
  } catch (error) {
    const authority = obj(error?.runtimeAuthority);

    return {
      publicAnswering: false,
      approvedTruthReady: false,
      reasonCode: s(
        authority.reasonCode || error?.reasonCode || error?.code,
        "runtime_authority_unavailable"
      ),
      summary: "Public AI answers are disabled until approved runtime truth is available.",
      authority: Object.keys(authority).length
        ? {
            mode: s(authority.mode, "strict"),
            available: authority.available === true,
            source: s(authority.source),
            runtimeProjectionId: s(authority.runtimeProjectionId),
            projectionHash: s(authority.projectionHash),
            stale: authority.stale === true,
            reasonCode: s(authority.reasonCode),
          }
        : null,
    };
  }
}

function tokenizePublicWidgetQuestion(value = "") {
  return lower(value)
    .replace(/[^a-z0-9əöüğşıçƏÖÜĞŞİÇ\s-]+/gi, " ")
    .split(/\s+/)
    .map((item) => s(item))
    .filter((item) => item.length >= 3)
    .slice(0, 24);
}

function truncatePublicWidgetAnswer(value = "", limit = 460) {
  const text = s(value).replace(/\s+/g, " ");
  if (!text || text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function pushApprovedRuntimeFact(target = [], title = "", value = "", source = "") {
  const text = s(value);
  if (!text || text.length < 8) return;

  target.push({
    title: s(title, "Approved business information"),
    text,
    source: s(source, "approved_runtime_projection"),
  });
}

function collectApprovedRuntimeFacts(runtime = {}) {
  const facts = [];
  const safeRuntime = obj(runtime);

  pushApprovedRuntimeFact(
    facts,
    "Business context",
    safeRuntime.businessContext,
    "business_context"
  );

  for (const item of arr(safeRuntime.serviceCatalog)) {
    const safe = obj(item);
    pushApprovedRuntimeFact(
      facts,
      s(safe.name || safe.title || safe.serviceName, "Service"),
      [
        safe.name || safe.title || safe.serviceName,
        safe.description,
        safe.summary,
        safe.price || safe.pricing,
        safe.details,
      ]
        .map((part) => s(part))
        .filter(Boolean)
        .join(" — "),
      "service_catalog"
    );
  }

  for (const item of arr(safeRuntime.knowledgeEntries)) {
    const safe = obj(item);
    pushApprovedRuntimeFact(
      facts,
      s(safe.title || safe.question || safe.key, "Knowledge"),
      [
        safe.title,
        safe.question,
        safe.answer,
        safe.text,
        safe.content,
        safe.value,
      ]
        .map((part) => s(part))
        .filter(Boolean)
        .join(" — "),
      "knowledge_entries"
    );
  }

  for (const item of arr(safeRuntime.responsePlaybooks)) {
    const safe = obj(item);
    pushApprovedRuntimeFact(
      facts,
      s(safe.title || safe.name || safe.intent, "Response playbook"),
      [
        safe.title,
        safe.intent,
        safe.trigger,
        safe.response,
        safe.answer,
        safe.script,
      ]
        .map((part) => s(part))
        .filter(Boolean)
        .join(" — "),
      "response_playbooks"
    );
  }

  return facts.slice(0, 80);
}

function scoreApprovedRuntimeFact(fact = {}, tokens = []) {
  const haystack = lower(`${fact.title || ""} ${fact.text || ""}`);
  let score = 0;

  for (const token of arr(tokens)) {
    if (!token) continue;
    if (haystack.includes(token)) score += token.length >= 5 ? 2 : 1;
  }

  return score;
}

function buildApprovedTruthPublicReplyFromRuntime({
  runtime = {},
  text = "",
} = {}) {
  const authority = obj(runtime?.authority);
  const approved =
    authority.available === true &&
    authority.stale !== true &&
    s(authority.source) === "approved_runtime_projection" &&
    Boolean(s(authority.runtimeProjectionId || authority.projectionHash));

  if (!approved) {
    return {
      ok: false,
      mode: "manual_first",
      text:
        "Thanks — your message was received. Our team can review it and reply shortly.",
      reasonCode: "approved_runtime_projection_unavailable",
    };
  }

  const tokens = tokenizePublicWidgetQuestion(text);
  const facts = collectApprovedRuntimeFacts(runtime);

  if (!facts.length) {
    return {
      ok: true,
      mode: "approved_truth_fallback",
      text:
        "Thanks — your message was received. I do not have enough approved business information to answer that safely, so the team can review it.",
      reasonCode: "approved_truth_no_public_facts",
    };
  }

  const ranked = facts
    .map((fact) => ({
      ...fact,
      score: scoreApprovedRuntimeFact(fact, tokens),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (!best || Number(best.score || 0) <= 0) {
    return {
      ok: true,
      mode: "approved_truth_fallback",
      text:
        "Thanks — your message was received. I do not have approved information for that exact question yet, so the team can review it.",
      reasonCode: "approved_truth_no_relevant_fact",
    };
  }

  return {
    ok: true,
    mode: "approved_truth_answer",
    text: `Based on approved business information: ${truncatePublicWidgetAnswer(best.text)}`,
    source: {
      title: s(best.title),
      type: s(best.source),
      authority: {
        source: s(authority.source),
        runtimeProjectionId: s(authority.runtimeProjectionId),
        projectionHash: s(authority.projectionHash),
      },
    },
  };
}

async function buildApprovedTruthPublicReply({ db, tenantKey = "", text = "" } = {}) {
  try {
    const runtime = await getTenantBrainRuntime({
      db,
      tenantKey,
      service: "website_widget",
      channelType: "webchat",
      authorityMode: "strict",
    });

    return buildApprovedTruthPublicReplyFromRuntime({ runtime, text });
  } catch (error) {
    return {
      ok: false,
      mode: "manual_first",
      text:
        "Thanks — your message was received. Our team can review it and reply shortly.",
      reasonCode: s(
        error?.runtimeAuthority?.reasonCode || error?.reasonCode || error?.code,
        "runtime_authority_unavailable"
      ),
    };
  }
}

function buildPublicWidgetFailClosed({
  reasonCode = "website_widget_not_ready",
  message = "Website chat is not live yet.",
  status = 200,
} = {}) {
  return {
    ok: false,
    live: false,
    status,
    reasonCode,
    message,
    assistant: {
      title: "Website chat",
      subtitle: "This widget is guarded until setup is complete.",
      statusLabel: "Setup required",
    },
  };
}

async function getPublicWebsiteWidgetBootstrap({ db, req } = {}) {
  const tenantKey = lower(req?.query?.tenantKey || req?.query?.workspace || req?.query?.tenant);
  const widgetId = s(req?.query?.widgetId || req?.query?.id || req?.query?.w);
  const origin = getPublicWidgetOrigin(req);

  if (!tenantKey || !widgetId) {
    return buildPublicWidgetFailClosed({
      reasonCode: "website_widget_bootstrap_missing_identity",
      message: "Widget identity is missing.",
    });
  }

  const status = await getWebsiteWidgetStatus({
    db,
    req: {
      ...req,
      headers: {
        ...obj(req?.headers),
        "x-tenant-key": tenantKey,
      },
      query: {
        ...obj(req?.query),
        tenantKey,
      },
    },
  });

  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: false,
  });

  if (s(config.publicWidgetId) !== widgetId) {
    return buildPublicWidgetFailClosed({
      reasonCode: "website_widget_id_mismatch",
      message: "This widget install ID is not valid for the selected workspace.",
    });
  }

  if (config.enabled !== true || resolveWidgetEnabled(status) !== true) {
    return buildPublicWidgetFailClosed({
      reasonCode: "website_widget_disabled",
      message: "Website chat is currently disabled.",
    });
  }

  const launch = obj(status.launchReadiness);
  if (launch.productionLaunchAllowed !== true && launch.productionReady !== true) {
    return buildPublicWidgetFailClosed({
      reasonCode: s(launch.reasonCode, "website_widget_not_production_ready"),
      message: s(
        launch.message,
        "Website chat is guarded until domain verification and runtime readiness are complete."
      ),
    });
  }

  if (!originAllowedForWidget(origin, config)) {
    return buildPublicWidgetFailClosed({
      reasonCode: "website_widget_origin_not_allowed",
      message: "This website origin is not allowed to load the widget.",
    });
  }

  const runtimeGuard = await buildPublicWidgetRuntimeGuard({
    db,
    tenantKey,
  });

  return {
    ok: true,
    live: true,
    reasonCode: "",
    tenantKey,
    widgetId,
    origin,
    assistant: {
      title: s(config.title, "Website chat"),
      subtitle: s(config.subtitle, "Ask a question and our team will help you."),
      accentColor: s(config.accentColor, "#0f172a"),
      statusLabel: "Live",
      initialPrompts: Array.isArray(config.initialPrompts)
        ? config.initialPrompts.slice(0, 4)
        : [],
    },
    controls: {
      manualFirst: runtimeGuard.publicAnswering !== true,
      approvedTruthOnly: true,
      publicAnswering: runtimeGuard.publicAnswering === true,
      approvedTruthReady: runtimeGuard.approvedTruthReady === true,
      messageCaptureReady: true,
      runtimeGuard,
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
      provider: TELEGRAM_PROVIDER,
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
      logWebhookEvent("info", "telegram.webhook.entry", req, {
        tenantKey: lower(req?.params?.tenantKey),
        hasRouteToken: Boolean(s(req?.params?.routeToken)),
      });

      if (!isDbReady(db)) {
        logWebhookEvent("error", "telegram.webhook.db_disabled", req, {
          reasonCode: "db_disabled",
        });

        return res.status(503).json({
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      const tenantKey = lower(req.params?.tenantKey);
      const routeToken = s(req.params?.routeToken);

      if (!tenantKey || !routeToken) {
        logWebhookEvent("warn", "telegram.webhook.route_missing", req, {
          tenantKey,
          hasRouteToken: Boolean(routeToken),
        });

        return res.status(404).json({ ok: false, error: "Not found" });
      }

      logWebhookEvent("info", "telegram.webhook.tenant_lookup_start", req, {
        tenantKey,
      });

      const tenant = await getTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        logWebhookEvent("warn", "telegram.webhook.tenant_not_found", req, {
          tenantKey,
        });

        return res.status(404).json({ ok: false, error: "Not found" });
      }

      logWebhookEvent("info", "telegram.webhook.tenant_lookup_ok", req, {
        tenantKey,
        tenantId: s(tenant?.id),
      });

      const [channel, secrets] = await Promise.all([
        getPrimaryTelegramChannel(db, tenant.id),
        getTelegramSecrets(db, tenant.id),
      ]);

      if (!channel?.id || lower(channel?.channel_type) !== TELEGRAM_CHANNEL) {
        logWebhookEvent("warn", "telegram.webhook.channel_not_found", req, {
          tenantKey,
          tenantId: s(tenant?.id),
          channelId: s(channel?.id),
          channelType: s(channel?.channel_type),
        });

        return res.status(404).json({ ok: false, error: "Not found" });
      }

      logWebhookEvent("info", "telegram.webhook.channel_lookup_ok", req, {
        tenantKey,
        tenantId: s(tenant?.id),
        channelId: s(channel?.id),
        channelType: s(channel?.channel_type),
      });

      const storedRouteToken = s(
        secrets?.[TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY]
      );

      if (!safeSecretEquals(routeToken, storedRouteToken)) {
        logWebhookEvent("warn", "telegram.webhook.route_token_mismatch", req, {
          tenantKey,
          tenantId: s(tenant?.id),
          channelId: s(channel?.id),
          routeTokenLength: routeToken.length,
          storedRouteTokenLength: storedRouteToken.length,
          routeTokenFingerprint: fingerprintSecret(routeToken),
          storedRouteTokenFingerprint: fingerprintSecret(storedRouteToken),
        });

        return res.status(404).json({ ok: false, error: "Not found" });
      }

      logWebhookEvent("info", "telegram.webhook.route_token_ok", req, {
        tenantKey,
        tenantId: s(tenant?.id),
        channelId: s(channel?.id),
        routeTokenFingerprint: fingerprintSecret(routeToken),
      });

      const headerSecret = s(req.get(TELEGRAM_SECRET_HEADER));
      const storedHeaderSecret = s(
        secrets?.[TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY]
      );
      const secretCheck = evaluateTelegramWebhookSecretCheck({
        headerSecret,
        storedHeaderSecret,
        strictSecretHeaderVerification:
          cfg.telegram.strictSecretHeaderVerification,
        allowRouteTokenFallback: cfg.telegram.allowRouteTokenFallback,
      });

      logWebhookEvent("warn", "telegram.webhook.secret_check", req, {
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
        secretHeaderMatched: secretCheck.secretHeaderMatched,
        shouldReject: secretCheck.shouldReject,
        accepted: secretCheck.accepted,
        verificationMode: secretCheck.verificationMode,
        strictSecretHeaderVerification:
          secretCheck.strictSecretHeaderVerification,
        allowRouteTokenFallback: secretCheck.allowRouteTokenFallback,
      });

      if (!secretCheck.secretHeaderMatched) {
        const mismatchMeta = {
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
          verificationMode: secretCheck.verificationMode,
          strictSecretHeaderVerification:
            secretCheck.strictSecretHeaderVerification,
          allowRouteTokenFallback: secretCheck.allowRouteTokenFallback,
        };

        logWebhookEvent(
          "warn",
          "telegram.webhook.secret_mismatch",
          req,
          mismatchMeta
        );

        if (secretCheck.shouldReject) {
          logWebhookEvent("error", "telegram.webhook.secret_rejected", req, {
            ...mismatchMeta,
            reasonCode: "telegram_webhook_secret_invalid",
          });

          return res.status(403).json({
            ok: false,
            error: "Forbidden",
            reasonCode: "telegram_webhook_secret_invalid",
          });
        }

        logWebhookEvent(
          "warn",
          "telegram.webhook.accepted_via_route_token",
          req,
          mismatchMeta
        );
      }

      const botToken = s(secrets?.[TELEGRAM_BOT_TOKEN_SECRET_KEY]);
      if (!botToken) {
        logWebhookEvent("error", "telegram.webhook.bot_token_missing", req, {
          tenantKey,
          tenantId: s(tenant?.id),
          channelId: s(channel?.id),
          reasonCode: "telegram_bot_token_missing",
        });

        return res.status(503).json({
          ok: false,
          error: "telegram bot token missing",
          reasonCode: "telegram_bot_token_missing",
        });
      }

      logWebhookEvent("info", "telegram.webhook.bot_token_present", req, {
        tenantKey,
        tenantId: s(tenant?.id),
        channelId: s(channel?.id),
      });

      let normalized = normalizeTelegramWebhookUpdate(
        req.body,
        tenant.tenant_key
      );

      logWebhookEvent("info", "telegram.webhook.update_normalized", req, {
        tenantKey,
        tenantId: s(tenant?.id),
        channelId: s(channel?.id),
        supported: normalized.supported === true,
        normalizeReasonCode: s(normalized.reasonCode),
        updateId: s(req?.body?.update_id),
        externalThreadId: s(normalized?.input?.externalThreadId),
        externalUserId: s(normalized?.input?.externalUserId),
      });

      if (!normalized.supported) {
        logWebhookEvent("info", "telegram.webhook.ignored_update", req, {
          tenantKey,
          tenantId: s(tenant?.id),
          channelId: s(channel?.id),
          reasonCode: s(normalized.reasonCode),
          updateId: s(req?.body?.update_id),
        });

        return res.status(200).json({
          ok: true,
          ignored: true,
          reasonCode: normalized.reasonCode,
        });
      }

      let avatarResult = null;
      try {
        avatarResult = await resolveTelegramUserAvatar({
          botToken,
          userId: normalized?.input?.externalUserId,
        });
      } catch {}

      normalized = {
        ...normalized,
        input: attachTelegramAvatarToInput(normalized.input, avatarResult),
      };

      logWebhookEvent("info", "telegram.webhook.avatar_resolved", req, {
        tenantKey,
        tenantId: s(tenant?.id),
        channelId: s(channel?.id),
        externalUserId: s(normalized?.input?.externalUserId),
        avatarLookupOk: avatarResult?.ok === true,
        avatarAvailable: avatarResult?.hasAvatar === true,
        avatarReasonCode: s(avatarResult?.reasonCode),
      });

      const validation = validateIngestRequest(normalized.input);
      if (!validation.ok) {
        logWebhookEvent("warn", "telegram.webhook.validation_failed", req, {
          tenantKey,
          tenantId: s(tenant?.id),
          channelId: s(channel?.id),
          updateId: s(req?.body?.update_id),
          externalThreadId: s(normalized?.input?.externalThreadId),
          externalUserId: s(normalized?.input?.externalUserId),
        });

        return res.status(400).json(validation.response);
      }

      logWebhookEvent("info", "telegram.webhook.validation_ok", req, {
        tenantKey,
        tenantId: s(tenant?.id),
        channelId: s(channel?.id),
        updateId: s(req?.body?.update_id),
        externalThreadId: s(normalized?.input?.externalThreadId),
        externalUserId: s(normalized?.input?.externalUserId),
      });

      const captureRes = createCaptureRes();

      logWebhookEvent("info", "telegram.webhook.ingest_dispatch_start", req, {
        tenantKey,
        tenantId: s(tenant?.id),
        channelId: s(channel?.id),
        updateId: s(req?.body?.update_id),
        externalThreadId: s(normalized?.input?.externalThreadId),
        externalUserId: s(normalized?.input?.externalUserId),
      });

      await inboxIngestHandler(
        buildInternalIngestRequest(req, tenant.tenant_key, normalized.input),
        captureRes
      );

      const payload = captureRes.body;

      if (payload?.ok === true) {
        logWebhookEvent("info", "telegram.webhook.ingest_succeeded", req, {
          tenantKey,
          tenantId: s(tenant?.id),
          channelId: s(channel?.id),
          updateId: s(req?.body?.update_id),
          externalThreadId: s(normalized?.input?.externalThreadId),
          externalUserId: s(normalized?.input?.externalUserId),
          ingestStatusCode: Number(captureRes.statusCode || 200),
          secretHeaderMatched: secretCheck.secretHeaderMatched,
          verificationMode: secretCheck.verificationMode,
        });

        return res.status(200).json(payload);
      }

      logWebhookEvent("error", "telegram.webhook.ingest_failed", req, {
        tenantKey,
        tenantId: s(tenant?.id),
        channelId: s(channel?.id),
        updateId: s(req?.body?.update_id),
        externalThreadId: s(normalized?.input?.externalThreadId),
        externalUserId: s(normalized?.input?.externalUserId),
        ingestStatusCode: Number(captureRes.statusCode || 503),
        ingestError: s(payload?.error),
        ingestReasonCode: s(payload?.reasonCode),
        secretHeaderMatched: secretCheck.secretHeaderMatched,
        verificationMode: secretCheck.verificationMode,
      });

      return res.status(503).json(
        payload || {
          ok: false,
          error: "telegram_webhook_processing_failed",
        }
      );
    } catch (error) {
      logWebhookEvent("error", "telegram.webhook.unhandled_error", req, {
        error: s(error?.message || "telegram_webhook_unhandled_error"),
        stack: s(error?.stack),
      });

      return res.status(500).json({
        ok: false,
        error: s(error?.message || "telegram_webhook_unhandled_error"),
        reasonCode: "telegram_webhook_unhandled_error",
      });
    }
  };
}

function buildWebsiteWidgetSessionId(req = {}) {
  const explicit = s(req.body?.sessionId || req.body?.session_id);
  if (explicit) return explicit.slice(0, 120);

  const raw = [
    s(req.body?.widgetId || req.query?.widgetId),
    s(req.body?.origin || req.query?.origin || getPublicWidgetOrigin(req)),
    s(req.get?.("user-agent")),
    s(req.ip),
  ].join("|");

  return `web:${crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24)}`;
}

function buildWebsiteWidgetMessageId({ sessionId = "", text = "" } = {}) {
  const raw = [sessionId, text, Date.now(), crypto.randomUUID()].join("|");
  return `website:${crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}

function normalizeWebsiteWidgetMessage(req = {}) {
  const text = s(req.body?.text || req.body?.message || req.body?.messageText);

  if (!text) {
    return {
      ok: false,
      reasonCode: "website_widget_message_text_required",
      response: { ok: false, error: "Message text is required." },
    };
  }

  if (text.length > 2000) {
    return {
      ok: false,
      reasonCode: "website_widget_message_too_long",
      response: { ok: false, error: "Message is too long." },
    };
  }

  const tenantKey = lower(req.body?.tenantKey || req.query?.tenantKey || req.body?.workspace || req.query?.workspace);
  const widgetId = s(req.body?.widgetId || req.query?.widgetId || req.body?.id || req.query?.id);
  const origin = s(req.body?.origin || req.query?.origin || getPublicWidgetOrigin(req));
  const sessionId = buildWebsiteWidgetSessionId(req);
  const externalUserId = `website-user:${sessionId}`;
  const externalThreadId = `website-thread:${tenantKey}:${widgetId}:${sessionId}`;
  const externalMessageId = buildWebsiteWidgetMessageId({ sessionId, text });

  return {
    ok: true,
    tenantKey,
    widgetId,
    origin,
    sessionId,
    text,
    ingest: {
      tenantKey,
      channel: "website",
      source: "website",
      provider: "website",
      platform: "website",
      externalThreadId,
      externalUserId,
      externalUsername: null,
      customerName: "Website visitor",
      externalMessageId,
      text,
      timestamp: Date.now(),
      raw: {
        widgetId,
        origin,
        sessionId,
        text,
      },
      customerContext: {
        fullName: "Website visitor",
        channel: "website",
        website: {
          sessionId,
          origin,
          widgetId,
        },
      },
      formData: {},
      leadContext: {
        source: "website_widget",
        origin,
      },
      conversationContext: {
        website: {
          sessionId,
          origin,
          widgetId,
        },
      },
      tenantContext: {
        widget: {
          widgetId,
          origin,
          publicSurface: true,
        },
      },
      meta: {
        source: "website",
        provider: "website",
        platform: "website",
        channel: "website",
        origin,
        widgetId,
        sessionId,
      },
    },
  };
}

function buildWebsiteWidgetIngestRequest(req = {}, normalized = {}) {
  return {
    originalUrl: req.originalUrl,
    url: req.url,
    path: req.path,
    method: "POST",
    headers: {
      "x-tenant-key": normalized.tenantKey,
      "x-internal-token": "website-widget-public",
      "x-channel-provider": "website",
    },
    body: normalized.ingest,
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

  router.get("/channels/webchat/bootstrap", async (req, res) => {
    try {
      const payload = await getPublicWebsiteWidgetBootstrap({ db, req });
      return res.status(payload.status || 200).json(payload);
    } catch (error) {
      webhookLog.warn("webchat.bootstrap.failed", {
        error: s(error?.message || error),
        reasonCode: s(error?.reasonCode),
      });

  router.post("/channels/webchat/message", async (req, res) => {
    try {
      const normalized = normalizeWebsiteWidgetMessage(req);

      if (!normalized.ok) {
        return res.status(400).json({
          ...normalized.response,
          reasonCode: normalized.reasonCode,
        });
      }

      const bootstrap = await getPublicWebsiteWidgetBootstrap({
        db,
        req: {
          ...req,
          query: {
            ...obj(req.query),
            tenantKey: normalized.tenantKey,
            widgetId: normalized.widgetId,
            origin: normalized.origin,
          },
        },
      });

      if (bootstrap.live !== true || bootstrap.controls?.messageCaptureReady !== true) {
        return res.status(200).json({
          ok: false,
          received: false,
          live: false,
          reasonCode: s(bootstrap.reasonCode, "website_widget_not_ready"),
          message: s(
            bootstrap.message,
            "Website chat is not ready to receive messages yet."
          ),
        });
      }

      const validation = validateIngestRequest(normalized.ingest);
      if (!validation.ok) {
        return res.status(400).json(validation.response);
      }

      const captureRes = createCaptureRes();

      await inboxIngestHandler(
        buildWebsiteWidgetIngestRequest(req, normalized),
        captureRes
      );

      const payload = captureRes.body || {};

      if (payload.ok !== true) {
        return res.status(503).json({
          ok: false,
          received: false,
          reasonCode: s(payload.reasonCode, "website_widget_ingest_failed"),
          error: s(payload.error, "Failed to receive website message."),
        });
      }

      const approvedTruthReply =
        bootstrap.controls?.publicAnswering === true
          ? await buildApprovedTruthPublicReply({
              db,
              tenantKey: normalized.tenantKey,
              text: normalized.text,
            })
          : null;

      const assistantReply =
        approvedTruthReply?.ok === true
          ? {
              mode: s(approvedTruthReply.mode, "approved_truth_answer"),
              text: s(approvedTruthReply.text),
              source: approvedTruthReply.source || null,
              guard: bootstrap.controls?.runtimeGuard || null,
            }
          : {
              mode: "manual_first",
              text:
                "Thanks — your message was received. Our team can review it and reply shortly.",
              guard: bootstrap.controls?.runtimeGuard || null,
            };

      return res.status(200).json({
        ok: true,
        received: true,
        live: true,
        sessionId: normalized.sessionId,
        threadId: s(payload.threadId || payload.thread?.id),
        messageId: s(payload.messageId || payload.message?.id),
        assistant: assistantReply,
      });
    } catch (error) {
      webhookLog.warn("webchat.message.failed", {
        error: s(error?.message || error),
        reasonCode: s(error?.reasonCode),
      });

      return res.status(200).json({
        ok: false,
        received: false,
        reasonCode: s(error?.reasonCode, "website_widget_message_failed"),
        message: "Website chat is temporarily unavailable.",
      });
    }
  });

      return res.status(200).json(
        buildPublicWidgetFailClosed({
          reasonCode: s(error?.reasonCode, "website_widget_bootstrap_failed"),
          message: "Website chat is temporarily unavailable.",
        })
      );
    }
  });

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
  buildApprovedTruthPublicReplyFromRuntime,
  buildPublicWidgetRuntimeGuard,
  normalizeWebsiteWidgetMessage,
  originAllowedForWidget,
  buildPublicWidgetFailClosed,
  normalizeOriginHost,
  normalizeTelegramWebhookUpdate,
  safeSecretEquals,
  buildInternalIngestRequest,
  fingerprintSecret,
  buildTelegramWebhookVerificationMode,
  evaluateTelegramWebhookSecretCheck,
};
