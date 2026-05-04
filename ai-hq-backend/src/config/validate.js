import { cfg, getMetaConnectStartupConfig } from "../config.js";
import {
  createValidationIssue,
  formatValidationFailure,
  printValidationReport,
} from "../../../scripts/env-validation-utils.mjs";

function isNonEmpty(v) {
  return String(v ?? "").trim().length > 0;
}

function s(v, d = "") {
  const out = String(v ?? "").trim();
  return out || String(d ?? "").trim();
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

function envBool(value) {
  return ["1", "true", "yes", "y", "on"].includes(
    String(value ?? "").trim().toLowerCase()
  );
}

const DISABLED_DB_SSL_VALUES = new Set([
  "0",
  "false",
  "no",
  "n",
  "off",
  "disable",
  "disabled",
]);

function parseDatabaseUrl(value) {
  try {
    return new URL(String(value ?? "").trim());
  } catch {
    return null;
  }
}

function isRailwayPrivateDatabaseHost(value) {
  const parsed = parseDatabaseUrl(value);
  const host = String(parsed?.hostname || "").trim().toLowerCase();
  return Boolean(host && (host === "railway.internal" || host.endsWith(".railway.internal")));
}

function getDisabledDbSslReason(databaseUrl = "", env = process.env) {
  const explicitDbSsl = String(env.DB_SSL ?? "").trim().toLowerCase();
  if (DISABLED_DB_SSL_VALUES.has(explicitDbSsl)) {
    return "DB_SSL disables database TLS";
  }

  const parsed = parseDatabaseUrl(databaseUrl);
  const sslmode = String(parsed?.searchParams?.get("sslmode") || "").trim().toLowerCase();
  if (DISABLED_DB_SSL_VALUES.has(sslmode)) {
    return "DATABASE_URL sslmode disables database TLS";
  }

  if (isRailwayPrivateDatabaseHost(databaseUrl)) {
    return "Railway private database host disables database TLS by default";
  }

  return "";
}

function isAllowedPrivateNetworkDbSslException(databaseUrl = "", env = process.env) {
  return (
    envBool(env.DB_SSL_PRIVATE_NETWORK_TRUSTED) &&
    isRailwayPrivateDatabaseHost(databaseUrl)
  );
}

function isPlaceholderLookingSecret(value = "") {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return true;
  if (/^(changeme|change-me|change_me|password|secret|placeholder|example|test|dev|local)$/.test(raw)) {
    return true;
  }
  if (/(changeme|placeholder|example|test-secret|dev-secret|local-secret)/.test(raw)) {
    return true;
  }
  return false;
}

function isRepeatingSecret(value = "") {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw.length > 0 && /^([a-z0-9])\1+$/.test(raw);
}

function getTenantSecretMasterKeyIssue(value = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return "TENANT_SECRET_MASTER_KEY is missing.";
  if (isPlaceholderLookingSecret(raw)) {
    return "TENANT_SECRET_MASTER_KEY must not use placeholder, example, dev, or test values.";
  }
  if (raw.length < 64) {
    return "TENANT_SECRET_MASTER_KEY must be a 64-character hex-encoded 32-byte key in production.";
  }
  if (!/^[a-f0-9]{64}$/i.test(raw)) {
    return "TENANT_SECRET_MASTER_KEY must be a 64-character hex-encoded 32-byte key in production.";
  }
  if (isRepeatingSecret(raw)) {
    return "TENANT_SECRET_MASTER_KEY must not be a repeated-character test key.";
  }
  return "";
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

  if (isProd && isNonEmpty(cfg?.db?.url) && isValidDatabaseUrl(cfg?.db?.url)) {
    const disabledDbSslReason = getDisabledDbSslReason(cfg?.db?.url);
    if (
      disabledDbSslReason &&
      !isAllowedPrivateNetworkDbSslException(cfg?.db?.url)
    ) {
      pushIssue(
        issues,
        "error",
        "db.ssl",
        `${disabledDbSslReason}. Set DB_SSL_PRIVATE_NETWORK_TRUSTED=1 only for a verified Railway private database host, or enable database TLS.`,
        {
          category: "database",
          envKeys: [
            "DATABASE_URL",
            "DB_SSL",
            "DB_SSL_PRIVATE_NETWORK_TRUSTED",
          ],
        }
      );
    }
  }

  if (isProd && String(cfg?.urls?.corsOrigin || "").trim() === "*") {
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
        isProd ? "error" : "warning",
        "auth.adminPasscodeHash",
        isProd
          ? "ADMIN_PANEL_ENABLED=true but ADMIN_PANEL_PASSCODE_HASH is missing in production."
          : "ADMIN_PANEL_ENABLED=true but ADMIN_PANEL_PASSCODE_HASH is missing.",
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

  if (isProd && isNonEmpty(cfg?.auth?.userSessionSecret) && s(cfg.auth.userSessionSecret).length < 32) {
    pushIssue(
      issues,
      "error",
      "auth.userSessionSecret",
      "USER_SESSION_SECRET must be at least 32 characters in production.",
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

  if (isProd && isNonEmpty(cfg?.security?.aihqInternalToken) && s(cfg.security.aihqInternalToken).length < 24) {
    pushIssue(
      issues,
      "error",
      "security.aihqInternalToken",
      "AIHQ_INTERNAL_TOKEN must be at least 24 characters in production.",
      {
        category: "internal-access",
        envKeys: ["AIHQ_INTERNAL_TOKEN"],
      }
    );
  }

  if (isProd && !isNonEmpty(cfg?.security?.aihqInternalMetaBotToken)) {
    pushIssue(
      issues,
      "error",
      "security.aihqInternalMetaBotToken",
      "AIHQ_INTERNAL_TOKEN_META_BOT is required in production for scoped Meta sidecar access.",
      {
        category: "internal-access",
        envKeys: ["AIHQ_INTERNAL_TOKEN_META_BOT", "AIHQ_INTERNAL_META_BOT_TOKEN"],
      }
    );
  } else if (isProd && s(cfg?.security?.aihqInternalMetaBotToken).length < 24) {
    pushIssue(
      issues,
      "error",
      "security.aihqInternalMetaBotToken",
      "AIHQ_INTERNAL_TOKEN_META_BOT must be at least 24 characters in production.",
      {
        category: "internal-access",
        envKeys: ["AIHQ_INTERNAL_TOKEN_META_BOT", "AIHQ_INTERNAL_META_BOT_TOKEN"],
      }
    );
  }

  if (isProd && !isNonEmpty(cfg?.security?.aihqInternalTwilioVoiceToken)) {
    pushIssue(
      issues,
      "error",
      "security.aihqInternalTwilioVoiceToken",
      "AIHQ_INTERNAL_TOKEN_TWILIO_VOICE is required in production for scoped Twilio voice sidecar access.",
      {
        category: "internal-access",
        envKeys: ["AIHQ_INTERNAL_TOKEN_TWILIO_VOICE", "AIHQ_INTERNAL_TWILIO_VOICE_TOKEN"],
      }
    );
  } else if (isProd && s(cfg?.security?.aihqInternalTwilioVoiceToken).length < 24) {
    pushIssue(
      issues,
      "error",
      "security.aihqInternalTwilioVoiceToken",
      "AIHQ_INTERNAL_TOKEN_TWILIO_VOICE must be at least 24 characters in production.",
      {
        category: "internal-access",
        envKeys: ["AIHQ_INTERNAL_TOKEN_TWILIO_VOICE", "AIHQ_INTERNAL_TWILIO_VOICE_TOKEN"],
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

  const tenantSecretIssue = getTenantSecretMasterKeyIssue(
    cfg?.security?.tenantSecretMasterKey
  );
  if (tenantSecretIssue) {
    pushIssue(
      issues,
      isProd ? "error" : "warning",
      "security.tenantSecretMasterKey",
      tenantSecretIssue,
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

  for (const item of [
    {
      key: "observability.incidentOwner",
      envKeys: ["OBS_INCIDENT_OWNER"],
      message:
        "OBS_INCIDENT_OWNER is missing; production incidents have no accountable owner.",
    },
    {
      key: "observability.incidentContact",
      envKeys: ["OBS_INCIDENT_CONTACT"],
      message:
        "OBS_INCIDENT_CONTACT is missing; production alerts have no configured contact/channel.",
    },
    {
      key: "observability.alertDestination",
      envKeys: ["OBS_ALERT_DESTINATION"],
      message:
        "OBS_ALERT_DESTINATION is missing; production alert routing is not configured.",
    },
    {
      key: "observability.alertRunbookUrl",
      envKeys: ["OBS_ALERT_RUNBOOK_URL"],
      message:
        "OBS_ALERT_RUNBOOK_URL is missing; first-response runbook routing is not configured.",
    },
  ]) {
    if (!isNonEmpty(cfg?.observability?.[item.key.split(".")[1]])) {
      pushIssue(issues, "warning", item.key, item.message, {
        category: "observability",
        envKeys: item.envKeys,
      });
    }
  }

  const quotaMode = s(cfg?.commercial?.quotaEnforcementMode || "").toLowerCase();
  if (!["enforce", "monitor", "off"].includes(quotaMode)) {
    pushIssue(
      issues,
      "error",
      "commercial.quotaEnforcementMode",
      "QUOTA_ENFORCEMENT_MODE must be one of enforce, monitor, or off.",
      {
        category: "commercial",
        envKeys: ["QUOTA_ENFORCEMENT_MODE"],
      }
    );
  } else if (isProd && quotaMode !== "enforce") {
    pushIssue(
      issues,
      "error",
      "commercial.quotaEnforcementMode",
      "QUOTA_ENFORCEMENT_MODE must be enforce in production.",
      {
        category: "commercial",
        envKeys: ["QUOTA_ENFORCEMENT_MODE"],
      }
    );
  }

  for (const [key, value] of Object.entries(cfg?.commercial || {})) {
    if (key === "quotaEnforcementMode") continue;
    if (n(value, 0) <= 0) {
      pushIssue(
        issues,
        "error",
        `commercial.${key}`,
        `${key} must be greater than 0.`,
        {
          category: "commercial",
        }
      );
    }
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

  if (cfg?.ai?.openaiSetupAssistantEnabled) {
    if (!isNonEmpty(cfg?.ai?.openaiApiKey)) {
      pushIssue(
        issues,
        env === "test" ? "warning" : "error",
        "ai.openaiSetupAssistantEnabled",
        "OPENAI_SETUP_ASSISTANT_ENABLED=true but OPENAI_API_KEY is missing.",
        {
          category: "providers",
          envKeys: ["OPENAI_SETUP_ASSISTANT_ENABLED", "OPENAI_API_KEY"],
        }
      );
    }

    if (!isNonEmpty(cfg?.ai?.openaiSetupModel)) {
      pushIssue(
        issues,
        "error",
        "ai.openaiSetupModel",
        "OPENAI_SETUP_ASSISTANT_ENABLED=true but OPENAI_SETUP_MODEL is empty.",
        {
          category: "providers",
          envKeys: ["OPENAI_SETUP_MODEL"],
        }
      );
    }

    if (n(cfg?.ai?.openaiSetupMaxOutputTokens, 0) <= 0) {
      pushIssue(
        issues,
        "error",
        "ai.openaiSetupMaxOutputTokens",
        "OPENAI_SETUP_MAX_OUTPUT_TOKENS must be greater than 0.",
        {
          category: "providers",
          envKeys: ["OPENAI_SETUP_MAX_OUTPUT_TOKENS"],
        }
      );
    }

    if (n(cfg?.ai?.openaiSetupTimeoutMs, 0) < 2000) {
      pushIssue(
        issues,
        "warning",
        "ai.openaiSetupTimeoutMs",
        "OPENAI_SETUP_TIMEOUT_MS looks too low for a setup reasoning turn.",
        {
          category: "providers",
          envKeys: ["OPENAI_SETUP_TIMEOUT_MS"],
        }
      );
    }

    if (cfg?.ai?.openaiSetupForceFallback === true) {
      pushIssue(
        issues,
        "warning",
        "ai.openaiSetupForceFallback",
        "OPENAI_SETUP_ASSISTANT_ENABLED=true but OPENAI_SETUP_FORCE_FALLBACK=true, so the setup brain will stay on local fallback.",
        {
          category: "providers",
          envKeys: [
            "OPENAI_SETUP_ASSISTANT_ENABLED",
            "OPENAI_SETUP_FORCE_FALLBACK",
          ],
        }
      );
    }

    if (
      n(cfg?.ai?.openaiSetupTimeoutMs, 0) >
      0 &&
      n(cfg?.ai?.openaiTimeoutMs, 0) > 0 &&
      n(cfg?.ai?.openaiSetupTimeoutMs, 0) < n(cfg?.ai?.openaiTimeoutMs, 0) / 4
    ) {
      pushIssue(
        issues,
        "warning",
        "ai.openaiSetupTimeoutMs",
        "OPENAI_SETUP_TIMEOUT_MS is much lower than the general OPENAI_TIMEOUT_MS and may cause setup turns to fall back too aggressively.",
        {
          category: "providers",
          envKeys: ["OPENAI_SETUP_TIMEOUT_MS", "OPENAI_TIMEOUT_MS"],
        }
      );
    }
  } else if (cfg?.ai?.openaiSetupForceFallback === true) {
    pushIssue(
      issues,
      "warning",
      "ai.openaiSetupForceFallback",
      "OPENAI_SETUP_FORCE_FALLBACK=true while OPENAI_SETUP_ASSISTANT_ENABLED=false has no practical effect.",
      {
        category: "providers",
        envKeys: [
          "OPENAI_SETUP_FORCE_FALLBACK",
          "OPENAI_SETUP_ASSISTANT_ENABLED",
        ],
      }
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

  const metaConnectConfig = getMetaConnectStartupConfig();

  if (metaConnectConfig.configOutcome === "invalid") {
    const mismatch = metaConnectConfig.reason === "secret_env_mismatch";
    pushIssue(
      issues,
      "error",
      "meta.oauth",
      mismatch
        ? "META_CONNECT_APP_SECRET and META_APP_SECRET are both set but differ. ai-hq-backend must resolve a single connect/reconnect secret."
        : "META_APP_ID, META_CONNECT_APP_SECRET (or legacy META_APP_SECRET), and META_REDIRECT_URI must all be set together.",
      {
        category: "provider-oauth",
        envKeys: mismatch
          ? ["META_CONNECT_APP_SECRET", "META_APP_SECRET"]
          : [
              "META_APP_ID",
              "META_CONNECT_APP_SECRET",
              "META_APP_SECRET",
              "META_REDIRECT_URI",
            ],
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
    if (!isNonEmpty(cfg?.telegram?.apiBaseUrl)) {
      pushIssue(
        issues,
        "error",
        "telegram.apiBaseUrl",
        "TELEGRAM_ENABLED=true but TELEGRAM_API_BASE_URL is missing.",
        {
          category: "providers",
          envKeys: ["TELEGRAM_ENABLED", "TELEGRAM_API_BASE_URL"],
        }
      );
    }

    if (!isNonEmpty(cfg?.telegram?.webhookBaseUrl)) {
      pushIssue(
        issues,
        "warning",
        "telegram.webhookBaseUrl",
        "TELEGRAM_ENABLED=true but TELEGRAM_WEBHOOK_BASE_URL/PUBLIC_BASE_URL is missing. Telegram connect will fail closed until a public HTTPS base URL is configured.",
        {
          category: "providers",
          envKeys: [
            "TELEGRAM_ENABLED",
            "TELEGRAM_WEBHOOK_BASE_URL",
            "PUBLIC_BASE_URL",
          ],
        }
      );
    }
  }

  if (
    isProd &&
    cfg?.telegram?.enabled &&
    cfg?.telegram?.strictSecretHeaderVerification !== true
  ) {
    pushIssue(
      issues,
      "error",
      "telegram.strictSecretHeaderVerification",
      "TELEGRAM_STRICT_SECRET_HEADER_VERIFICATION must stay enabled in production.",
      {
        category: "providers",
        envKeys: [
          "TELEGRAM_ENABLED",
          "TELEGRAM_STRICT_SECRET_HEADER_VERIFICATION",
        ],
      }
    );
  }

  if (
    isProd &&
    cfg?.telegram?.enabled &&
    cfg?.telegram?.allowRouteTokenFallback === true
  ) {
    pushIssue(
      issues,
      "error",
      "telegram.allowRouteTokenFallback",
      "TELEGRAM_WEBHOOK_ALLOW_ROUTE_TOKEN_FALLBACK must be disabled in production.",
      {
        category: "providers",
        envKeys: [
          "TELEGRAM_ENABLED",
          "TELEGRAM_WEBHOOK_ALLOW_ROUTE_TOKEN_FALLBACK",
        ],
      }
    );
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

export const __test__ = {
  getDisabledDbSslReason,
  getTenantSecretMasterKeyIssue,
  isAllowedPrivateNetworkDbSslException,
  isPlaceholderLookingSecret,
};

