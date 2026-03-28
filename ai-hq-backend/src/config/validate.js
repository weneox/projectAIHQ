// src/config/validate.js

import { cfg } from "../config.js";
import {
  createValidationIssue,
  formatValidationFailure,
  printValidationReport,
} from "../../../scripts/env-validation-utils.mjs";

function isNonEmpty(v) {
  return String(v ?? "").trim().length > 0;
}

function isValidDatabaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    return ["postgres:", "postgresql:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function pushIssue(list, level, key, message, meta = {}) {
  list.push(
    createValidationIssue({
      level,
      key,
      message,
      ...meta,
    })
  );
}

export function isDbRequiredAppEnv(env = cfg?.app?.env) {
  return String(env || "").trim().toLowerCase() !== "test";
}

export function getConfigIssues() {
  const issues = [];

  const env = String(cfg?.app?.env || "").trim().toLowerCase();
  const isProd = env === "production";

  const draftScheduleWorkerEnabled = Boolean(
    cfg?.workers?.draftScheduleWorkerEnabled ?? false
  );
  const scheduleDraftUrl = String(cfg?.n8n?.scheduleDraftUrl || "").trim();

  if (!isNonEmpty(cfg?.app?.env)) {
    pushIssue(issues, "error", "app.env", "APP_ENV is missing.");
  }

  if (!isNonEmpty(cfg?.app?.defaultTimezone)) {
    pushIssue(
      issues,
      "warning",
      "app.defaultTimezone",
      "DEFAULT_TIMEZONE is empty."
    );
  }

  if (!isNonEmpty(cfg?.db?.url)) {
    pushIssue(
      issues,
      isDbRequiredAppEnv(env) ? "error" : "warning",
      "db.url",
      isDbRequiredAppEnv(env)
        ? "DATABASE_URL is required outside test environments."
        : "DATABASE_URL is not set for test runtime.",
      {
        category: "database",
        envKeys: ["DATABASE_URL"],
      }
    );
  } else if (!isValidDatabaseUrl(cfg?.db?.url)) {
    pushIssue(
      issues,
      isDbRequiredAppEnv(env) ? "error" : "warning",
      "db.url",
      "DATABASE_URL must be a valid postgres:// or postgresql:// URL.",
      {
        category: "database",
        envKeys: ["DATABASE_URL"],
      }
    );
  }

  if (
    isProd &&
    String(cfg?.urls?.corsOrigin || "").trim() === "*"
  ) {
    pushIssue(
      issues,
      "error",
      "urls.corsOrigin",
      "CORS_ORIGIN='*' is not allowed in production when credentialed requests are enabled."
    );
  }

  if (cfg?.auth?.adminPanelEnabled) {
    if (!isNonEmpty(cfg?.auth?.adminPasscodeHash)) {
      pushIssue(
        issues,
        "warning",
        "auth.adminPasscodeHash",
        "ADMIN_PANEL_ENABLED=true but ADMIN_PANEL_PASSCODE_HASH is missing.",
        {
          category: "authentication",
          envKeys: ["ADMIN_PANEL_PASSCODE_HASH"],
        }
      );
    }

    if (!isNonEmpty(cfg?.auth?.adminSessionSecret)) {
      pushIssue(
        issues,
        "error",
        "auth.adminSessionSecret",
        "ADMIN_PANEL_ENABLED=true but ADMIN_SESSION_SECRET is missing.",
        {
          category: "authentication",
          envKeys: ["ADMIN_SESSION_SECRET"],
        }
      );
    }
  }

  if (!isNonEmpty(cfg?.auth?.userSessionSecret)) {
    pushIssue(
      issues,
      "error",
      "auth.userSessionSecret",
      "USER_SESSION_SECRET is missing.",
      {
        category: "authentication",
        envKeys: ["USER_SESSION_SECRET"],
      }
    );
  }

  if (
    isProd &&
    !isNonEmpty(cfg?.auth?.sessionCookieDomain) &&
    !isNonEmpty(cfg?.auth?.cookieDomain) &&
    !isNonEmpty(cfg?.auth?.userCookieDomain)
  ) {
    pushIssue(
      issues,
      "warning",
      "auth.cookieDomain",
      "Production mode without explicit cookie domain config may cause session/cookie issues."
    );
  }

  if (!isNonEmpty(cfg?.security?.aihqInternalToken)) {
    pushIssue(
      issues,
      isDbRequiredAppEnv(env) ? "error" : "warning",
      "security.aihqInternalToken",
      isDbRequiredAppEnv(env)
        ? "AIHQ_INTERNAL_TOKEN is required outside test environments."
        : "AIHQ_INTERNAL_TOKEN is missing.",
      {
        category: "internal-access",
        envKeys: ["AIHQ_INTERNAL_TOKEN"],
      }
    );
  }

  if (
    env !== "test" &&
    (cfg?.security?.debugRoutesEnabled || env === "production") &&
    !isNonEmpty(cfg?.security?.debugApiToken)
  ) {
    pushIssue(
      issues,
      cfg?.security?.debugRoutesEnabled ? "error" : "warning",
      "security.debugApiToken",
      cfg?.security?.debugRoutesEnabled
        ? "DEBUG_ROUTES_ENABLED=true but DEBUG_API_TOKEN is missing outside test environments."
        : "DEBUG_API_TOKEN is missing; debug-token protected routes and diagnostics will deny access outside test environments.",
      {
        category: "debug-access",
        envKeys: ["DEBUG_API_TOKEN", "DEBUG_ROUTES_ENABLED"],
      }
    );
  }

  if (!isNonEmpty(cfg?.security?.cronSecret)) {
    pushIssue(
      issues,
      "warning",
      "security.cronSecret",
      "CRON_SECRET is missing.",
      {
        category: "background-jobs",
        envKeys: ["CRON_SECRET"],
      }
    );
  }

  if (!isNonEmpty(cfg?.security?.tenantSecretMasterKey)) {
    pushIssue(
      issues,
      "warning",
      "security.tenantSecretMasterKey",
      "TENANT_SECRET_MASTER_KEY is missing.",
      {
        category: "secrets",
        envKeys: ["TENANT_SECRET_MASTER_KEY"],
      }
    );
  }

  if (isProd && cfg?.operational?.enforceReadinessOnStartup !== true) {
    pushIssue(
      issues,
      "warning",
      "operational.enforceReadinessOnStartup",
      "ENFORCE_OPERATIONAL_READINESS_ON_STARTUP=false disables startup blocking when operational blockers are present."
    );
  }

  const hasAnyAiProvider =
    isNonEmpty(cfg?.ai?.openaiApiKey) ||
    isNonEmpty(cfg?.ai?.geminiApiKey) ||
    isNonEmpty(cfg?.ai?.anthropicApiKey);

  if (!hasAnyAiProvider) {
    pushIssue(
      issues,
      "warning",
      "ai",
      "No AI provider API key is configured.",
      {
        category: "providers",
        envKeys: ["OPENAI_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"],
      }
    );
  }

  if (n(cfg?.ai?.openaiMaxOutputTokens, 0) <= 0) {
    pushIssue(
      issues,
      "error",
      "ai.openaiMaxOutputTokens",
      "OPENAI_MAX_OUTPUT_TOKENS must be greater than 0."
    );
  }

  if (n(cfg?.ai?.openaiTimeoutMs, 0) < 1000) {
    pushIssue(
      issues,
      "warning",
      "ai.openaiTimeoutMs",
      "OPENAI_TIMEOUT_MS looks too low."
    );
  }

  if (n(cfg?.ai?.openaiDebateConcurrency, 0) < 1) {
    pushIssue(
      issues,
      "error",
      "ai.openaiDebateConcurrency",
      "OPENAI_DEBATE_CONCURRENCY must be at least 1."
    );
  }

  const hasAnyMediaProvider =
    isNonEmpty(cfg?.media?.runwayApiKey) ||
    isNonEmpty(cfg?.media?.pikaApiKey) ||
    isNonEmpty(cfg?.media?.creatomateApiKey) ||
    isNonEmpty(cfg?.media?.elevenlabsApiKey);

  if (cfg?.workers?.mediaJobWorkerEnabled && !hasAnyMediaProvider) {
    pushIssue(
      issues,
      "warning",
      "workers.mediaJobWorkerEnabled",
      "MEDIA_JOB_WORKER_ENABLED=true but no media provider is configured."
    );
  }

  if (
    isNonEmpty(cfg?.media?.elevenlabsApiKey) &&
    !isNonEmpty(cfg?.media?.elevenlabsVoiceId)
  ) {
    pushIssue(
      issues,
      "warning",
      "media.elevenlabsVoiceId",
      "ELEVENLABS_API_KEY is set but ELEVENLABS_VOICE_ID is empty."
    );
  }

  const hasMetaOauthPartial =
    isNonEmpty(cfg?.meta?.appId) ||
    isNonEmpty(cfg?.meta?.appSecret) ||
    isNonEmpty(cfg?.meta?.redirectUri);

  const hasMetaOauthFull =
    isNonEmpty(cfg?.meta?.appId) &&
    isNonEmpty(cfg?.meta?.appSecret) &&
    isNonEmpty(cfg?.meta?.redirectUri);

  if (hasMetaOauthPartial && !hasMetaOauthFull) {
    pushIssue(
      issues,
      "error",
      "meta.oauth",
      "META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI must all be set together.",
      {
        category: "provider-oauth",
        envKeys: ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"],
      }
    );
  }

  const hasGoogleBusinessProfilePartial =
    isNonEmpty(cfg?.google?.businessProfileClientId) ||
    isNonEmpty(cfg?.google?.businessProfileClientSecret) ||
    isNonEmpty(cfg?.google?.businessProfileRedirectUri);

  const hasGoogleBusinessProfileFull =
    isNonEmpty(cfg?.google?.businessProfileClientId) &&
    isNonEmpty(cfg?.google?.businessProfileClientSecret) &&
    isNonEmpty(cfg?.google?.businessProfileRedirectUri);

  if (hasGoogleBusinessProfilePartial && !hasGoogleBusinessProfileFull) {
    pushIssue(
      issues,
      "error",
      "google.businessProfileOauth",
      "GOOGLE_BUSINESS_PROFILE_CLIENT_ID, GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET, and GOOGLE_BUSINESS_PROFILE_REDIRECT_URI must all be set together.",
      {
        category: "provider-oauth",
        envKeys: [
          "GOOGLE_BUSINESS_PROFILE_CLIENT_ID",
          "GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET",
          "GOOGLE_BUSINESS_PROFILE_REDIRECT_URI",
        ],
      }
    );
  }

  if (!isNonEmpty(cfg?.google?.placesApiKey)) {
    pushIssue(
      issues,
      "warning",
      "google.placesApiKey",
      "GOOGLE_PLACES_API_KEY is missing. Google Places import will be disabled.",
      {
        category: "providers",
        envKeys: ["GOOGLE_PLACES_API_KEY"],
      }
    );
  }

  if (!isNonEmpty(cfg?.google?.placesApiBase)) {
    pushIssue(
      issues,
      "error",
      "google.placesApiBase",
      "GOOGLE_PLACES_API_BASE is missing."
    );
  }

  if (!isNonEmpty(cfg?.google?.placesDefaultLanguage)) {
    pushIssue(
      issues,
      "warning",
      "google.placesDefaultLanguage",
      "GOOGLE_PLACES_DEFAULT_LANGUAGE is empty."
    );
  }

  if (!isNonEmpty(cfg?.google?.placesDefaultRegion)) {
    pushIssue(
      issues,
      "warning",
      "google.placesDefaultRegion",
      "GOOGLE_PLACES_DEFAULT_REGION is empty."
    );
  }

  const hasN8nAny =
    isNonEmpty(cfg?.n8n?.webhookBase) ||
    isNonEmpty(cfg?.n8n?.webhookUrl) ||
    isNonEmpty(cfg?.n8n?.webhookProposalApprovedUrl) ||
    isNonEmpty(cfg?.n8n?.webhookPublishUrl) ||
    isNonEmpty(scheduleDraftUrl);

  if (hasN8nAny && !isNonEmpty(cfg?.n8n?.webhookToken)) {
    pushIssue(
      issues,
      env === "test" ? "warning" : "error",
      "n8n.webhookToken",
      "n8n is configured but N8N_WEBHOOK_TOKEN is missing.",
      {
        category: "automation",
        envKeys: ["N8N_WEBHOOK_TOKEN"],
      }
    );
  }

  if (hasN8nAny && !isNonEmpty(cfg?.n8n?.callbackToken)) {
    pushIssue(
      issues,
      env === "test" ? "warning" : "error",
      "n8n.callbackToken",
      "n8n is configured but N8N_CALLBACK_TOKEN is missing.",
      {
        category: "automation",
        envKeys: ["N8N_CALLBACK_TOKEN"],
      }
    );
  }

  if (n(cfg?.n8n?.timeoutMs, 0) < 1000) {
    pushIssue(
      issues,
      "warning",
      "n8n.timeoutMs",
      "N8N_TIMEOUT_MS looks too low."
    );
  }

  if (n(cfg?.n8n?.retries, 0) < 0) {
    pushIssue(
      issues,
      "error",
      "n8n.retries",
      "N8N_RETRIES cannot be negative."
    );
  }

  if (draftScheduleWorkerEnabled && !scheduleDraftUrl) {
    pushIssue(
      issues,
      "warning",
      "workers.draftScheduleWorkerEnabled",
      "Draft schedule worker is enabled but n8n.scheduleDraftUrl is missing."
    );
  }

  if (cfg?.telegram?.enabled) {
    if (!isNonEmpty(cfg?.telegram?.botToken)) {
      pushIssue(
        issues,
        "error",
        "telegram.botToken",
        "TELEGRAM_ENABLED=true but TELEGRAM_BOT_TOKEN is missing.",
        {
          category: "providers",
          envKeys: ["TELEGRAM_ENABLED", "TELEGRAM_BOT_TOKEN"],
        }
      );
    }

    if (!isNonEmpty(cfg?.telegram?.chatId)) {
      pushIssue(
        issues,
        "warning",
        "telegram.chatId",
        "TELEGRAM_ENABLED=true but TELEGRAM_CHAT_ID is missing.",
        {
          category: "providers",
          envKeys: ["TELEGRAM_ENABLED", "TELEGRAM_CHAT_ID"],
        }
      );
    }
  }

  if (cfg?.push?.enabled) {
    if (!isNonEmpty(cfg?.push?.vapidPublicKey)) {
      pushIssue(
        issues,
        "error",
        "push.vapidPublicKey",
        "PUSH_ENABLED=true but VAPID_PUBLIC_KEY is missing.",
        {
          category: "push",
          envKeys: ["PUSH_ENABLED", "VAPID_PUBLIC_KEY"],
        }
      );
    }

    if (!isNonEmpty(cfg?.push?.vapidPrivateKey)) {
      pushIssue(
        issues,
        "error",
        "push.vapidPrivateKey",
        "PUSH_ENABLED=true but VAPID_PRIVATE_KEY is missing.",
        {
          category: "push",
          envKeys: ["PUSH_ENABLED", "VAPID_PRIVATE_KEY"],
        }
      );
    }
  }

  const hasMetaGatewayPartial =
    isNonEmpty(cfg?.gateway?.metaGatewayBaseUrl) ||
    isNonEmpty(cfg?.gateway?.metaGatewayInternalToken);

  const hasMetaGatewayFull =
    isNonEmpty(cfg?.gateway?.metaGatewayBaseUrl) &&
    isNonEmpty(cfg?.gateway?.metaGatewayInternalToken);

  if (hasMetaGatewayPartial && !hasMetaGatewayFull) {
    pushIssue(
      issues,
      "warning",
      "gateway.metaGateway",
      "META_GATEWAY_BASE_URL and META_GATEWAY_INTERNAL_TOKEN should be set together."
    );
  }

  if (n(cfg?.sourceSync?.websiteFetchTimeoutMs, 0) < 1000) {
    pushIssue(
      issues,
      "warning",
      "sourceSync.websiteFetchTimeoutMs",
      "SOURCE_SYNC_WEBSITE_FETCH_TIMEOUT_MS looks too low."
    );
  }

  if (n(cfg?.sourceSync?.websiteMaxHtmlBytes, 0) < 100_000) {
    pushIssue(
      issues,
      "warning",
      "sourceSync.websiteMaxHtmlBytes",
      "SOURCE_SYNC_WEBSITE_MAX_HTML_BYTES looks too low."
    );
  }

  if (n(cfg?.workers?.outboundRetryBatchSize, 0) < 1) {
    pushIssue(
      issues,
      "error",
      "workers.outboundRetryBatchSize",
      "OUTBOUND_RETRY_BATCH_SIZE must be at least 1."
    );
  }

  if (n(cfg?.workers?.mediaJobWorkerBatchSize, 0) < 1) {
    pushIssue(
      issues,
      "error",
      "workers.mediaJobWorkerBatchSize",
      "MEDIA_JOB_WORKER_BATCH_SIZE must be at least 1."
    );
  }

  return issues;
}

export function getConfigErrors() {
  return getConfigIssues().filter((x) => x.level === "error");
}

export function getConfigWarnings() {
  return getConfigIssues().filter((x) => x.level === "warning");
}

export function printConfigReport(logger = console) {
  const issues = getConfigIssues();
  return printConfigIssues(issues, logger);
}

export function printSelectedConfigReport(keys = [], logger = console) {
  const selectedKeys = new Set(
    Array.isArray(keys)
      ? keys.map((value) => String(value || "").trim()).filter(Boolean)
      : []
  );
  const issues =
    selectedKeys.size === 0
      ? getConfigIssues()
      : getConfigIssues().filter((item) => selectedKeys.has(item.key));
  return printConfigIssues(issues, logger);
}

function printConfigIssues(issues, logger = console) {
  return printValidationReport({
    workspace: "ai-hq-backend",
    issues,
    logger,
    okMessage: "[validate:env] ai-hq-backend OK",
  });
}

export function assertConfigValid(logger = console) {
  const report = printConfigReport(logger);

  if (!report.ok) {
    throw new Error(formatValidationFailure("ai-hq-backend", report));
  }

  return report;
}

export function assertSelectedConfigValid(keys = [], logger = console) {
  const report = printSelectedConfigReport(keys, logger);

  if (!report.ok) {
    throw new Error(formatValidationFailure("ai-hq-backend", report));
  }

  return report;
}
