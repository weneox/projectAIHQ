import crypto from "crypto";

import {
  buildOperationalRepairGuidance,
  buildReadinessSurface,
} from "../../../services/operationalReadiness.js";
import { getTenantBrainRuntime } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { getInboxPolicy } from "../../../services/inboxPolicy.js";
import { cfg } from "../../../config.js";
import {
  deleteTelegramWebhook,
  getTelegramBotMe,
  getTelegramWebhookInfo,
  maskTelegramToken,
  redactTelegramWebhookUrl,
  setTelegramWebhook,
} from "../../../utils/telegram.js";
import {
  auditSafe,
  deleteTelegramSecretKeys,
  getPrimaryTelegramChannel,
  getTelegramSecrets,
  getTenantByKey,
  markTelegramDisconnected,
  saveTelegramSecretValue,
  upsertTelegramChannel,
} from "./repository.js";
import { cleanNullable, getReqActor, getReqTenantKey, lower, s } from "./utils.js";

export const TELEGRAM_BOT_TOKEN_SECRET_KEY = "bot_token";
export const TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY = "webhook_route_token";
export const TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY = "webhook_secret_token";
export const TELEGRAM_ALLOWED_UPDATES = Object.freeze(["message"]);

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function trimSlash(v) {
  return s(v).replace(/\/+$/, "");
}

function nowIso() {
  return new Date().toISOString();
}

function randomHex(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

function epochSecondsToIso(value) {
  const seconds = Number(value || 0);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null;
}

function normalizeUrlForCompare(value = "") {
  const raw = s(value);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    if (
      (parsed.protocol === "https:" && parsed.port === "443") ||
      (parsed.protocol === "http:" && parsed.port === "80")
    ) {
      parsed.port = "";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function hasUsableTelegramWebhookBaseUrl() {
  const baseUrl = s(cfg.telegram.webhookBaseUrl);
  if (!baseUrl) return false;

  try {
    return lower(new URL(baseUrl).protocol) === "https:";
  } catch {
    return false;
  }
}

function buildTelegramDisplayName(bot = {}, fallback = "Telegram") {
  const username = s(bot?.username);
  if (username) return `Telegram @${username}`;
  const firstName = s(bot?.first_name);
  if (firstName) return `Telegram ${firstName}`;
  return s(fallback || "Telegram");
}

function buildTelegramLastConnectFailure({
  reasonCode = "",
  message = "",
  stage = "",
  occurredAt = nowIso(),
} = {}) {
  const safeReasonCode = s(reasonCode);
  if (!safeReasonCode) return null;

  return {
    reasonCode: safeReasonCode,
    message: s(message),
    stage: s(stage),
    occurredAt,
  };
}

function getTelegramSnapshot(channel = {}) {
  const config = obj(channel?.config);
  const health = obj(channel?.health);
  const failure = obj(health?.last_connect_failure);

  return {
    displayName: s(
      channel?.display_name || config.last_connected_display_name || "Telegram"
    ),
    botUserId: s(channel?.external_user_id || config.bot_user_id),
    botUsername: s(channel?.external_username || config.bot_username),
    botFirstName: s(config.bot_first_name),
    botLastName: s(config.bot_last_name),
    botCanJoinGroups: config.bot_can_join_groups === true,
    botCanReadAllGroupMessages:
      config.bot_can_read_all_group_messages === true,
    botSupportsInlineQueries: config.bot_supports_inline_queries === true,
    lastConnectedAt: s(config.last_connected_at || health.last_connected_at),
    expectedWebhookUrl: s(config.expected_webhook_url || health.webhook_url),
    connectionState: s(health.connection_state || channel?.status),
    authStatus: s(health.auth_status),
    disconnectReason: s(config.disconnect_reason || health.disconnect_reason),
    disconnectedAt: s(health.disconnected_at),
    lastVerifiedAt: s(health.last_verified_at),
    lastConnectFailure: failure?.reasonCode
      ? {
          reasonCode: s(failure.reasonCode),
          message: s(failure.message),
          stage: s(failure.stage),
          occurredAt: s(failure.occurredAt),
        }
      : null,
  };
}

function buildTelegramChannelPayload({
  channel = null,
  bot = null,
  status = "disconnected",
  connectionState = "",
  authStatus = "",
  reasonCode = "",
  webhookUrl = "",
  webhookInfo = null,
  connectedAt = null,
  disconnectedAt = null,
  disconnectReason = "",
  lastConnectFailure = null,
} = {}) {
  const snapshot = getTelegramSnapshot(channel);
  const liveBot = obj(bot);
  const botUserId = s(liveBot?.id || snapshot.botUserId) || null;
  const botUsername = s(liveBot?.username || snapshot.botUsername) || null;
  const displayName = buildTelegramDisplayName(liveBot, snapshot.displayName);
  const resolvedWebhookUrl =
    s(webhookUrl || snapshot.expectedWebhookUrl) || null;

  return {
    provider: "telegram",
    display_name: displayName,
    external_account_id: null,
    external_page_id: null,
    external_user_id: botUserId,
    external_username: botUsername,
    status: s(status || "disconnected"),
    is_primary: true,
    config: {
      connected_via: "bot_token",
      auth_model: "telegram_bot_token",
      bot_user_id: cleanNullable(botUserId),
      bot_username: cleanNullable(botUsername),
      bot_first_name: cleanNullable(liveBot?.first_name || snapshot.botFirstName),
      bot_last_name: cleanNullable(liveBot?.last_name || snapshot.botLastName),
      bot_can_join_groups:
        liveBot?.can_join_groups === true || snapshot.botCanJoinGroups,
      bot_can_read_all_group_messages:
        liveBot?.can_read_all_group_messages === true ||
        snapshot.botCanReadAllGroupMessages,
      bot_supports_inline_queries:
        liveBot?.supports_inline_queries === true ||
        snapshot.botSupportsInlineQueries,
      last_connected_display_name: cleanNullable(displayName),
      last_connected_at: cleanNullable(connectedAt || snapshot.lastConnectedAt),
      expected_webhook_url: cleanNullable(resolvedWebhookUrl),
      allowed_updates: [...TELEGRAM_ALLOWED_UPDATES],
      disconnect_reason: cleanNullable(disconnectReason || reasonCode || snapshot.disconnectReason),
    },
    secrets_ref: "telegram",
    health: {
      connection_state: s(connectionState || status || "disconnected"),
      auth_status: s(
        authStatus ||
          (status === "connected"
            ? "authorized"
            : status === "connecting"
            ? "connecting"
            : status === "disconnected"
            ? "disconnected"
            : "reconnect_required")
      ),
      reason_code: cleanNullable(reasonCode),
      last_verified_at: nowIso(),
      last_connected_at: cleanNullable(connectedAt || snapshot.lastConnectedAt),
      disconnected_at: cleanNullable(disconnectedAt || snapshot.disconnectedAt),
      disconnect_reason: cleanNullable(
        disconnectReason || reasonCode || snapshot.disconnectReason
      ),
      webhook_registered: status === "connected" && Boolean(resolvedWebhookUrl),
      webhook_url: cleanNullable(resolvedWebhookUrl),
      webhook_pending_update_count: Number(
        webhookInfo?.pending_update_count || 0
      ),
      webhook_last_error_date: cleanNullable(
        epochSecondsToIso(webhookInfo?.last_error_date)
      ),
      webhook_last_error_message: cleanNullable(
        webhookInfo?.last_error_message
      ),
      webhook_ip_address: cleanNullable(webhookInfo?.ip_address),
      last_connect_failure:
        lastConnectFailure ||
        buildTelegramLastConnectFailure(snapshot.lastConnectFailure),
    },
    last_sync_at: nowIso(),
  };
}

export function buildTelegramWebhookUrl({
  tenantKey = "",
  routeToken = "",
  webhookBaseUrl = cfg.telegram.webhookBaseUrl,
} = {}) {
  const baseUrl = trimSlash(webhookBaseUrl);
  const safeTenantKey = s(tenantKey);
  const safeRouteToken = s(routeToken);

  if (!baseUrl || !safeTenantKey || !safeRouteToken) return "";

  return `${baseUrl}/api/channels/telegram/webhook/${encodeURIComponent(
    safeTenantKey
  )}/${encodeURIComponent(safeRouteToken)}`;
}

async function getScopedTelegramTenant(db, req) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    const err = new Error("Missing tenant context");
    err.status = 401;
    throw err;
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    const err = new Error("Tenant not found");
    err.status = 400;
    throw err;
  }

  return tenant;
}

async function loadTelegramStatusContext(db, tenantId = "") {
  const [channel, secrets] = await Promise.all([
    getPrimaryTelegramChannel(db, tenantId),
    getTelegramSecrets(db, tenantId),
  ]);

  return {
    channel,
    secrets,
  };
}

async function getTelegramRuntimeSurface({ db, tenantKey = "" } = {}) {
  if (!db?.query || !tenantKey) {
    return {
      ready: false,
      authorityAvailable: false,
      channelAllowed: false,
      deliveryReady: false,
      reasonCode: "runtime_authority_unavailable",
      authority: null,
    };
  }

  try {
    const runtime = await getTenantBrainRuntime({
      db,
      tenantKey,
      authorityMode: "strict",
    });
    const authority = runtime?.authority || null;
    const tenant = runtime?.tenant || null;
    const authorityAvailable = Boolean(authority?.available !== false && tenant);
    const policy = tenant
      ? getInboxPolicy({
          tenantKey,
          channel: "telegram",
          tenant,
        })
      : null;
    const channelAllowed = Boolean(policy?.channelAllowed);

    return {
      ready: authorityAvailable,
      authorityAvailable,
      channelAllowed,
      deliveryReady: authorityAvailable && channelAllowed,
      reasonCode: authorityAvailable
        ? channelAllowed
          ? ""
          : "channel_not_allowed"
        : s(authority?.reasonCode || "runtime_authority_unavailable"),
      authority,
    };
  } catch (error) {
    return {
      ready: false,
      authorityAvailable: false,
      channelAllowed: false,
      deliveryReady: false,
      reasonCode: s(error?.reasonCode || "runtime_authority_unavailable"),
      authority: null,
      error: s(error?.message || error),
    };
  }
}

function buildTelegramStatusBlockers({
  featureReady = true,
  channel = null,
  botToken = "",
  routeToken = "",
  secretToken = "",
  expectedWebhookUrl = "",
  botResult = null,
  webhookResult = null,
  webhookUrlMatches = false,
  runtime = null,
} = {}) {
  const blockers = [];

  if (!featureReady) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "telegram_webhook_base_url_missing",
        title: "Telegram webhook base URL is not configured",
        subtitle:
          "Set TELEGRAM_WEBHOOK_BASE_URL or PUBLIC_BASE_URL to a public HTTPS backend URL before connecting Telegram.",
        missingFields: ["TELEGRAM_WEBHOOK_BASE_URL_or_PUBLIC_BASE_URL"],
      })
    );
  }

  if (!channel?.id && !botToken) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "tenant_channel_missing",
        title: "Telegram channel is not connected",
        subtitle:
          "No tenant Telegram channel row or bot token is available for this tenant.",
        missingFields: ["tenant_channels", TELEGRAM_BOT_TOKEN_SECRET_KEY],
      })
    );
  } else if (!botToken) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "telegram_bot_token_missing",
        title: "Telegram bot token is missing",
        subtitle:
          "Reconnect Telegram so the tenant bot token can be validated and stored again.",
        missingFields: [TELEGRAM_BOT_TOKEN_SECRET_KEY],
      })
    );
  } else if (botResult && botResult.ok === false) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: botResult.reasonCode || "telegram_bot_token_invalid",
        title: "Telegram bot validation failed",
        subtitle: s(botResult.error || "Telegram rejected the stored bot token."),
        missingFields: [TELEGRAM_BOT_TOKEN_SECRET_KEY],
      })
    );
  }

  if (botToken) {
    if (!routeToken) {
      blockers.push(
        buildOperationalRepairGuidance({
          reasonCode: "telegram_webhook_route_missing",
          title: "Telegram webhook route token is missing",
          subtitle:
            "Reconnect Telegram so the tenant-bound webhook route can be restored.",
          missingFields: [TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY],
        })
      );
    }

    if (!secretToken) {
      blockers.push(
        buildOperationalRepairGuidance({
          reasonCode: "telegram_webhook_secret_missing",
          title: "Telegram webhook secret is missing",
          subtitle:
            "Reconnect Telegram so webhook secret verification can be enforced again.",
          missingFields: [TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY],
        })
      );
    }

    if (!expectedWebhookUrl) {
      blockers.push(
        buildOperationalRepairGuidance({
          reasonCode: "telegram_webhook_base_url_missing",
          title: "Telegram webhook URL cannot be built",
          subtitle:
            "The backend does not have a valid public HTTPS base URL for Telegram callbacks.",
          missingFields: ["TELEGRAM_WEBHOOK_BASE_URL_or_PUBLIC_BASE_URL"],
        })
      );
    } else if (webhookResult && webhookResult.ok === false) {
      blockers.push(
        buildOperationalRepairGuidance({
          reasonCode: webhookResult.reasonCode || "telegram_webhook_invalid",
          title: "Telegram webhook status could not be verified",
          subtitle: s(
            webhookResult.error ||
              "Telegram webhook health verification failed for this bot."
          ),
          missingFields: ["telegram_webhook"],
        })
      );
    } else if (webhookResult?.ok && !webhookUrlMatches) {
      blockers.push(
        buildOperationalRepairGuidance({
          reasonCode: "telegram_webhook_mismatch",
          title: "Telegram webhook does not point to this tenant route",
          subtitle:
            "Telegram is configured with a different webhook URL than the expected tenant-bound webhook path.",
          missingFields: ["telegram_webhook_url"],
        })
      );
    }
  }

  if (!runtime?.authorityAvailable) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: runtime?.reasonCode || "runtime_authority_unavailable",
        title: "Tenant runtime is unavailable",
        subtitle:
          "Inbound Telegram messages cannot reach the AI reply path until the approved runtime projection is ready.",
        missingFields: ["tenant_runtime_projection"],
      })
    );
  } else if (runtime?.channelAllowed === false) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "channel_not_allowed",
        title: "Telegram is blocked by inbox policy",
        subtitle:
          "The tenant runtime is loaded, but Telegram is not currently allowed by inbox policy.",
        missingFields: ["inbox_policy.allowedChannels"],
      })
    );
  }

  return blockers;
}

function buildTelegramStatusPayload({
  tenant = {},
  channel = null,
  secrets = {},
  botResult = null,
  webhookResult = null,
  runtime = null,
} = {}) {
  const snapshot = getTelegramSnapshot(channel);
  const botToken = s(secrets?.[TELEGRAM_BOT_TOKEN_SECRET_KEY]);
  const routeToken = s(secrets?.[TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY]);
  const secretToken = s(secrets?.[TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY]);
  const expectedWebhookUrl = buildTelegramWebhookUrl({
    tenantKey: tenant?.tenant_key,
    routeToken,
  });
  const actualWebhookUrl = s(webhookResult?.result?.url);
  const webhookUrlMatches =
    Boolean(expectedWebhookUrl) &&
    Boolean(actualWebhookUrl) &&
    normalizeUrlForCompare(expectedWebhookUrl) ===
      normalizeUrlForCompare(actualWebhookUrl);
  const featureReady =
    Boolean(cfg.telegram.enabled) && hasUsableTelegramWebhookBaseUrl();
  const botIdentity = botResult?.ok ? obj(botResult.result) : {};
  const lastConnectFailure =
    buildTelegramLastConnectFailure(snapshot.lastConnectFailure) || null;

  const connected =
    Boolean(channel?.id) &&
    Boolean(botToken) &&
    botResult?.ok === true &&
    webhookResult?.ok === true &&
    webhookUrlMatches &&
    Boolean(secretToken);

  let state = "not_connected";
  if (connected) {
    state = "connected";
  } else if (lower(channel?.status) === "connecting") {
    state = "connecting";
  } else if (
    lower(channel?.status) === "disconnected" &&
    !botToken &&
    !lastConnectFailure?.reasonCode
  ) {
    state = "disconnected";
  } else if (channel?.id || botToken || lastConnectFailure?.reasonCode) {
    state = "error";
  }

  const connectionReasonCode = connected
    ? ""
    : s(
        !featureReady
          ? "telegram_webhook_base_url_missing"
          : !channel?.id && botToken
          ? "tenant_channel_missing"
          : !botToken
          ? lastConnectFailure?.reasonCode || "telegram_bot_token_missing"
          : botResult?.ok === false
          ? botResult.reasonCode
          : !routeToken
          ? "telegram_webhook_route_missing"
          : !secretToken
          ? "telegram_webhook_secret_missing"
          : !expectedWebhookUrl
          ? "telegram_webhook_base_url_missing"
          : webhookResult?.ok === false
          ? webhookResult.reasonCode
          : !webhookUrlMatches
          ? "telegram_webhook_mismatch"
          : lastConnectFailure?.reasonCode
      );

  const blockers = buildTelegramStatusBlockers({
    featureReady,
    channel,
    botToken,
    routeToken,
    secretToken,
    expectedWebhookUrl,
    botResult,
    webhookResult,
    webhookUrlMatches,
    runtime,
  });

  return {
    connected,
    state,
    reasonCode: cleanNullable(connectionReasonCode),
    channel: channel
      ? {
          id: channel.id,
          provider: channel.provider,
          channel_type: channel.channel_type,
          status: channel.status,
          displayName: snapshot.displayName,
          isPrimary: channel.is_primary === true,
          updatedAt: channel.updated_at || null,
          lastSyncAt: channel.last_sync_at || null,
        }
      : null,
    account: {
      displayName: buildTelegramDisplayName(botIdentity, snapshot.displayName),
      botUserId: cleanNullable(botIdentity?.id || snapshot.botUserId),
      botUsername: cleanNullable(botIdentity?.username || snapshot.botUsername),
      firstName: cleanNullable(botIdentity?.first_name || snapshot.botFirstName),
      lastName: cleanNullable(botIdentity?.last_name || snapshot.botLastName),
      canJoinGroups:
        botIdentity?.can_join_groups === true || snapshot.botCanJoinGroups,
      canReadAllGroupMessages:
        botIdentity?.can_read_all_group_messages === true ||
        snapshot.botCanReadAllGroupMessages,
      supportsInlineQueries:
        botIdentity?.supports_inline_queries === true ||
        snapshot.botSupportsInlineQueries,
      verified: botResult?.ok === true,
      botTokenMasked: cleanNullable(maskTelegramToken(botToken)),
    },
    webhook: {
      configured: Boolean(expectedWebhookUrl),
      verified:
        botResult?.ok === true &&
        webhookResult?.ok === true &&
        webhookUrlMatches &&
        Boolean(secretToken),
      expectedUrl: cleanNullable(redactTelegramWebhookUrl(expectedWebhookUrl)),
      actualUrl: cleanNullable(redactTelegramWebhookUrl(actualWebhookUrl)),
      secretHeaderConfigured: Boolean(secretToken),
      pendingUpdateCount: Number(
        webhookResult?.result?.pending_update_count || 0
      ),
      lastErrorAt: cleanNullable(
        epochSecondsToIso(webhookResult?.result?.last_error_date)
      ),
      lastErrorMessage: cleanNullable(
        webhookResult?.result?.last_error_message
      ),
      ipAddress: cleanNullable(webhookResult?.result?.ip_address),
      reasonCode:
        webhookResult?.ok === false
          ? s(webhookResult.reasonCode || "")
          : !webhookUrlMatches && expectedWebhookUrl
          ? "telegram_webhook_mismatch"
          : "",
    },
    runtime: {
      ready: Boolean(runtime?.ready),
      authorityAvailable: Boolean(runtime?.authorityAvailable),
      channelAllowed: Boolean(runtime?.channelAllowed),
      deliveryReady: Boolean(connected && runtime?.deliveryReady),
      reasonCode: cleanNullable(runtime?.reasonCode),
      authority: runtime?.authority || null,
    },
    lifecycle: {
      connectedAt: cleanNullable(snapshot.lastConnectedAt),
      disconnectedAt: cleanNullable(snapshot.disconnectedAt),
      disconnectReason: cleanNullable(snapshot.disconnectReason),
      authStatus: cleanNullable(snapshot.authStatus),
      connectionState: cleanNullable(snapshot.connectionState),
      lastVerifiedAt: cleanNullable(snapshot.lastVerifiedAt),
      lastConnectFailure,
    },
    actions: {
      connectAvailable: !connected,
      reconnectAvailable: !connected && Boolean(channel?.id || botToken),
      disconnectAvailable: Boolean(channel?.id || botToken || routeToken || secretToken),
      webhookRetryAvailable:
        Boolean(botToken) && botResult?.ok === true && connected === false,
    },
    readiness: buildReadinessSurface({
      status: blockers.length ? "blocked" : "ready",
      message: blockers.length
        ? connected
          ? "Telegram is connected to the bot, but delivery is blocked until the remaining blockers are repaired."
          : "Telegram is not fully connected for this tenant. Review the blockers before relying on live delivery."
        : "Telegram bot, webhook, and tenant runtime are ready for live delivery.",
      blockers,
    }),
  };
}

function getIncomingTelegramBotToken(req) {
  return s(
    req?.body?.botToken ||
      req?.body?.bot_token ||
      req?.body?.token ||
      req?.body?.telegramBotToken
  );
}

export async function connectTelegram({ db, req } = {}) {
  const tenant = await getScopedTelegramTenant(db, req);
  const actor = getReqActor(req);
  const botToken = getIncomingTelegramBotToken(req);

  if (!cfg.telegram.enabled) {
    const err = new Error("Telegram integration is disabled");
    err.status = 409;
    err.reasonCode = "telegram_disabled";
    throw err;
  }

  if (!botToken) {
    const err = new Error("Telegram bot token is required");
    err.status = 400;
    err.reasonCode = "telegram_bot_token_missing";
    throw err;
  }

  if (!hasUsableTelegramWebhookBaseUrl()) {
    await upsertTelegramChannel(
      db,
      tenant.id,
      buildTelegramChannelPayload({
        status: "error",
        connectionState: "reconnect_required",
        authStatus: "configuration_invalid",
        reasonCode: "telegram_webhook_base_url_missing",
        lastConnectFailure: buildTelegramLastConnectFailure({
          reasonCode: "telegram_webhook_base_url_missing",
          message:
            "A public HTTPS TELEGRAM_WEBHOOK_BASE_URL or PUBLIC_BASE_URL is required before connecting Telegram.",
          stage: "configuration",
        }),
      })
    );

    const err = new Error(
      "A public HTTPS TELEGRAM_WEBHOOK_BASE_URL or PUBLIC_BASE_URL is required before connecting Telegram"
    );
    err.status = 409;
    err.reasonCode = "telegram_webhook_base_url_missing";
    throw err;
  }

  const meResult = await getTelegramBotMe({
    botToken,
    timeoutMs: cfg.telegram.connectTimeoutMs,
  });

  if (!meResult.ok) {
    await upsertTelegramChannel(
      db,
      tenant.id,
      buildTelegramChannelPayload({
        status: "error",
        connectionState: "reconnect_required",
        authStatus: "invalid",
        reasonCode: meResult.reasonCode || "telegram_bot_token_invalid",
        lastConnectFailure: buildTelegramLastConnectFailure({
          reasonCode: meResult.reasonCode || "telegram_bot_token_invalid",
          message: s(meResult.error || "Telegram rejected the supplied bot token."),
          stage: "get_me",
        }),
      })
    );
    await auditSafe(
      db,
      actor,
      tenant,
      "settings.channel.telegram.connect_failed",
      "tenant_channel",
      "telegram",
      {
        reasonCode: s(meResult.reasonCode || "telegram_bot_token_invalid"),
        status: Number(meResult.status || 0),
        botTokenMasked: maskTelegramToken(botToken),
      }
    );

    const err = new Error(
      s(meResult.error || "Telegram bot token validation failed")
    );
    err.status = 409;
    err.reasonCode = s(meResult.reasonCode || "telegram_bot_token_invalid");
    throw err;
  }

  const routeToken = randomHex(24);
  const secretToken = randomHex(24);
  const webhookUrl = buildTelegramWebhookUrl({
    tenantKey: tenant.tenant_key,
    routeToken,
  });

  await saveTelegramSecretValue(
    db,
    tenant.id,
    TELEGRAM_BOT_TOKEN_SECRET_KEY,
    botToken,
    actor
  );
  await saveTelegramSecretValue(
    db,
    tenant.id,
    TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY,
    routeToken,
    actor
  );
  await saveTelegramSecretValue(
    db,
    tenant.id,
    TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY,
    secretToken,
    actor
  );

  await upsertTelegramChannel(
    db,
    tenant.id,
    buildTelegramChannelPayload({
      bot: meResult.result,
      status: "connecting",
      connectionState: "connecting",
      authStatus: "authorized",
      webhookUrl,
    })
  );

  const webhookSetResult = await setTelegramWebhook({
    botToken,
    url: webhookUrl,
    secretToken,
    allowedUpdates: [...TELEGRAM_ALLOWED_UPDATES],
    dropPendingUpdates: false,
    timeoutMs: cfg.telegram.connectTimeoutMs,
  });

  if (!webhookSetResult.ok) {
    await upsertTelegramChannel(
      db,
      tenant.id,
      buildTelegramChannelPayload({
        bot: meResult.result,
        status: "error",
        connectionState: "reconnect_required",
        authStatus: "authorized",
        reasonCode: webhookSetResult.reasonCode || "telegram_webhook_invalid",
        webhookUrl,
        lastConnectFailure: buildTelegramLastConnectFailure({
          reasonCode: webhookSetResult.reasonCode || "telegram_webhook_invalid",
          message: s(
            webhookSetResult.error || "Telegram webhook registration failed"
          ),
          stage: "set_webhook",
        }),
      })
    );
    await auditSafe(
      db,
      actor,
      tenant,
      "settings.channel.telegram.connect_failed",
      "tenant_channel",
      "telegram",
      {
        reasonCode: s(webhookSetResult.reasonCode || "telegram_webhook_invalid"),
        status: Number(webhookSetResult.status || 0),
        webhookUrl: redactTelegramWebhookUrl(webhookUrl),
        botUserId: cleanNullable(meResult.result?.id),
        botUsername: cleanNullable(meResult.result?.username),
      }
    );

    const err = new Error(
      s(webhookSetResult.error || "Telegram webhook registration failed")
    );
    err.status = 409;
    err.reasonCode = s(
      webhookSetResult.reasonCode || "telegram_webhook_invalid"
    );
    throw err;
  }

  const webhookInfoResult = await getTelegramWebhookInfo({
    botToken,
    timeoutMs: cfg.telegram.statusTimeoutMs,
  });
  const webhookUrlMatches =
    webhookInfoResult.ok &&
    normalizeUrlForCompare(webhookInfoResult?.result?.url) ===
      normalizeUrlForCompare(webhookUrl);

  if (!webhookInfoResult.ok || !webhookUrlMatches) {
    await upsertTelegramChannel(
      db,
      tenant.id,
      buildTelegramChannelPayload({
        bot: meResult.result,
        status: "error",
        connectionState: "reconnect_required",
        authStatus: "authorized",
        reasonCode:
          webhookInfoResult.ok === false
            ? webhookInfoResult.reasonCode || "telegram_webhook_invalid"
            : "telegram_webhook_mismatch",
        webhookUrl,
        webhookInfo: webhookInfoResult.result,
        lastConnectFailure: buildTelegramLastConnectFailure({
          reasonCode:
            webhookInfoResult.ok === false
              ? webhookInfoResult.reasonCode || "telegram_webhook_invalid"
              : "telegram_webhook_mismatch",
          message:
            webhookInfoResult.ok === false
              ? s(
                  webhookInfoResult.error ||
                    "Telegram webhook verification failed after registration"
                )
              : "Telegram reported a different webhook URL than the expected tenant route",
          stage: "get_webhook_info",
        }),
      })
    );
    await auditSafe(
      db,
      actor,
      tenant,
      "settings.channel.telegram.connect_failed",
      "tenant_channel",
      "telegram",
      {
        reasonCode:
          webhookInfoResult.ok === false
            ? s(webhookInfoResult.reasonCode || "telegram_webhook_invalid")
            : "telegram_webhook_mismatch",
        status: Number(webhookInfoResult.status || 0),
        expectedWebhookUrl: redactTelegramWebhookUrl(webhookUrl),
        actualWebhookUrl: cleanNullable(
          redactTelegramWebhookUrl(webhookInfoResult?.result?.url)
        ),
      }
    );

    const err = new Error(
      webhookInfoResult.ok === false
        ? s(
            webhookInfoResult.error ||
              "Telegram webhook verification failed after registration"
          )
        : "Telegram reported a webhook URL that does not match the expected tenant route"
    );
    err.status = 409;
    err.reasonCode =
      webhookInfoResult.ok === false
        ? s(webhookInfoResult.reasonCode || "telegram_webhook_invalid")
        : "telegram_webhook_mismatch";
    throw err;
  }

  const savedChannel = await upsertTelegramChannel(
    db,
    tenant.id,
    buildTelegramChannelPayload({
      bot: meResult.result,
      status: "connected",
      connectionState: "connected",
      authStatus: "authorized",
      webhookUrl,
      webhookInfo: webhookInfoResult.result,
      connectedAt: nowIso(),
      lastConnectFailure: null,
    })
  );

  await auditSafe(
    db,
    actor,
    tenant,
    "settings.channel.telegram.connected",
    "tenant_channel",
    "telegram",
    {
      botUserId: cleanNullable(meResult.result?.id),
      botUsername: cleanNullable(meResult.result?.username),
      webhookUrl: redactTelegramWebhookUrl(webhookUrl),
    }
  );

  return buildTelegramStatusPayload({
    tenant,
    channel: savedChannel,
    secrets: {
      [TELEGRAM_BOT_TOKEN_SECRET_KEY]: botToken,
      [TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY]: routeToken,
      [TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY]: secretToken,
    },
    botResult: meResult,
    webhookResult: webhookInfoResult,
    runtime: await getTelegramRuntimeSurface({
      db,
      tenantKey: tenant.tenant_key,
    }),
  });
}

export async function getTelegramStatus({ db, req } = {}) {
  const tenant = await getScopedTelegramTenant(db, req);
  const { channel, secrets } = await loadTelegramStatusContext(db, tenant.id);
  const botToken = s(secrets?.[TELEGRAM_BOT_TOKEN_SECRET_KEY]);

  let botResult = null;
  let webhookResult = null;

  if (botToken) {
    botResult = await getTelegramBotMe({
      botToken,
      timeoutMs: cfg.telegram.statusTimeoutMs,
    });

    if (botResult.ok) {
      webhookResult = await getTelegramWebhookInfo({
        botToken,
        timeoutMs: cfg.telegram.statusTimeoutMs,
      });
    }
  }

  return buildTelegramStatusPayload({
    tenant,
    channel,
    secrets,
    botResult,
    webhookResult,
    runtime: await getTelegramRuntimeSurface({
      db,
      tenantKey: tenant.tenant_key,
    }),
  });
}

export async function disconnectTelegram({ db, req } = {}) {
  const tenant = await getScopedTelegramTenant(db, req);
  const actor = getReqActor(req);
  const { channel, secrets } = await loadTelegramStatusContext(db, tenant.id);
  const snapshot = getTelegramSnapshot(channel);
  const disconnectedAt = nowIso();
  const botToken = s(secrets?.[TELEGRAM_BOT_TOKEN_SECRET_KEY]);
  let remoteWebhookRemoved = false;
  let remoteReasonCode = "";
  let remoteError = "";

  if (botToken) {
    const deleteResult = await deleteTelegramWebhook({
      botToken,
      dropPendingUpdates: false,
      timeoutMs: cfg.telegram.connectTimeoutMs,
    });
    remoteWebhookRemoved = deleteResult.ok === true;
    remoteReasonCode = s(deleteResult.reasonCode);
    remoteError = s(deleteResult.error);
  }

  await deleteTelegramSecretKeys(db, tenant.id, [
    TELEGRAM_BOT_TOKEN_SECRET_KEY,
    TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY,
    TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY,
  ]);

  const savedChannel = await markTelegramDisconnected(db, tenant.id, {
    displayName: snapshot.displayName || "Telegram",
    status: "disconnected",
    externalUserId: cleanNullable(snapshot.botUserId),
    externalUsername: cleanNullable(snapshot.botUsername),
    config: {
      connected_via: "bot_token",
      auth_model: "telegram_bot_token",
      bot_user_id: cleanNullable(snapshot.botUserId),
      bot_username: cleanNullable(snapshot.botUsername),
      bot_first_name: cleanNullable(snapshot.botFirstName),
      bot_last_name: cleanNullable(snapshot.botLastName),
      last_connected_display_name: cleanNullable(snapshot.displayName),
      last_connected_at: cleanNullable(snapshot.lastConnectedAt),
      expected_webhook_url: cleanNullable(snapshot.expectedWebhookUrl),
      allowed_updates: [...TELEGRAM_ALLOWED_UPDATES],
      disconnect_reason: "user_disconnect",
    },
    health: {
      connection_state: "disconnected",
      auth_status: "disconnected",
      reason_code: cleanNullable(
        remoteWebhookRemoved ? "" : remoteReasonCode || "telegram_webhook_delete_unverified"
      ),
      last_verified_at: disconnectedAt,
      last_connected_at: cleanNullable(snapshot.lastConnectedAt),
      disconnected_at: disconnectedAt,
      disconnect_reason: "user_disconnect",
      webhook_registered: false,
      webhook_url: null,
      webhook_pending_update_count: 0,
      webhook_last_error_date: null,
      webhook_last_error_message: null,
      last_connect_failure: null,
    },
    lastSyncAt: disconnectedAt,
  });

  await auditSafe(
    db,
    actor,
    tenant,
    "settings.channel.telegram.disconnected",
    "tenant_channel",
    "telegram",
    {
      disconnectedAt,
      remoteWebhookRemoved,
      remoteReasonCode: cleanNullable(remoteReasonCode),
      remoteError: cleanNullable(remoteError),
    }
  );

  return {
    disconnected: true,
    channel: "telegram",
    disconnectedAt,
    remoteWebhookRemoved,
    remoteReasonCode: cleanNullable(remoteReasonCode),
    remoteError: cleanNullable(remoteError),
    preservedBotIdentity:
      snapshot.botUsername || snapshot.botUserId
        ? {
            botUserId: cleanNullable(snapshot.botUserId),
            botUsername: cleanNullable(snapshot.botUsername),
          }
        : null,
    status: buildTelegramStatusPayload({
      tenant,
      channel: savedChannel,
      secrets: {},
      botResult: null,
      webhookResult: null,
      runtime: await getTelegramRuntimeSurface({
        db,
        tenantKey: tenant.tenant_key,
      }),
    }),
  };
}
