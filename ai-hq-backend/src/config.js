// src/config.js

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function b(v, d = false) {
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return d;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return d;
}

function mode(v, d = "manual") {
  const x = String(v ?? "").trim().toLowerCase();
  if (x === "auto" || x === "manual") return x;
  return d;
}

function processRole(v, d = "all") {
  const x = String(v ?? "").trim().toLowerCase();
  if (x === "web") return "web";
  return d;
}

function prodDefaultBool(v, fallbackProd = true) {
  const raw = String(v ?? "").trim().toLowerCase();
  if (raw) {
    if (["1", "true", "yes", "y", "on"].includes(raw)) return true;
    if (["0", "false", "no", "n", "off"].includes(raw)) return false;
  }

  const env = s(process.env.APP_ENV, process.env.NODE_ENV || "production").toLowerCase();
  const prodLike = !["", "development", "dev", "test"].includes(env);
  return prodLike ? fallbackProd : false;
}

export const cfg = {
  app: {
    port: n(process.env.PORT, 8080),
    env: s(process.env.APP_ENV, process.env.NODE_ENV || "production"),
    trustProxy: b(process.env.TRUST_PROXY, false),
    logLevel: s(process.env.LOG_LEVEL, "info"),
    defaultTimezone: s(process.env.DEFAULT_TIMEZONE, "Asia/Baku"),
    defaultMode: mode(process.env.DEFAULT_MODE, "manual"),
    processRole: processRole(process.env.AIHQ_PROCESS_ROLE, "all"),
  },

  urls: {
    corsOrigin: s(process.env.CORS_ORIGIN, ""),
    publicBaseUrl: s(process.env.PUBLIC_BASE_URL, ""),
    channelsReturnUrl: s(process.env.CHANNELS_RETURN_URL, ""),
    aihqSecretsPath: s(
      process.env.AIHQ_SECRETS_PATH,
      "/api/settings/secrets"
    ),
  },

  db: {
    url: s(process.env.DATABASE_URL, ""),
    migrateTx: b(process.env.DB_MIGRATE_TX, true),
    autoMigrateOnStartup: b(process.env.DB_AUTO_MIGRATE_ON_STARTUP, false),
  },

  operational: {
    enforceReadinessOnStartup: prodDefaultBool(
      process.env.ENFORCE_OPERATIONAL_READINESS_ON_STARTUP,
      true
    ),
  },

  ws: {
    authToken: s(process.env.WS_AUTH_TOKEN, ""),
  },

  security: {
    debugApiToken: s(process.env.DEBUG_API_TOKEN, ""),
    debugRoutesEnabled: b(process.env.DEBUG_ROUTES_ENABLED, false),
    aihqInternalToken: s(process.env.AIHQ_INTERNAL_TOKEN, ""),
    aihqInternalMetaBotToken: s(process.env.AIHQ_INTERNAL_TOKEN_META_BOT, ""),
    aihqInternalTwilioVoiceToken: s(
      process.env.AIHQ_INTERNAL_TOKEN_TWILIO_VOICE,
      ""
    ),
    cronSecret: s(process.env.CRON_SECRET, ""),
    tenantSecretMasterKey: s(process.env.TENANT_SECRET_MASTER_KEY, ""),
  },

  auth: {
    adminPanelEnabled: b(process.env.ADMIN_PANEL_ENABLED, true),

    adminPasscodeHash: s(process.env.ADMIN_PANEL_PASSCODE_HASH, ""),
    adminSessionSecret: s(process.env.ADMIN_SESSION_SECRET, ""),
    adminSessionCookieName: s(
      process.env.ADMIN_SESSION_COOKIE_NAME,
      "aihq_admin"
    ),
    adminSessionTtlHours: n(process.env.ADMIN_SESSION_TTL_HOURS, 12),
    adminRateLimitWindowMs: n(
      process.env.ADMIN_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000
    ),
    adminRateLimitMaxAttempts: n(
      process.env.ADMIN_RATE_LIMIT_MAX_ATTEMPTS,
      5
    ),
    adminRateLimitBlockMs: n(
      process.env.ADMIN_RATE_LIMIT_BLOCK_MS,
      15 * 60 * 1000
    ),

    userSessionSecret: s(
      process.env.USER_SESSION_SECRET,
      process.env.ADMIN_SESSION_SECRET || ""
    ),
    userSessionCookieName: s(
      process.env.USER_SESSION_COOKIE_NAME,
      "aihq_user"
    ),
    userSessionTtlHours: n(process.env.USER_SESSION_TTL_HOURS, 24 * 7),
    userRateLimitWindowMs: n(
      process.env.USER_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000
    ),
    userRateLimitMaxAttempts: n(
      process.env.USER_RATE_LIMIT_MAX_ATTEMPTS,
      8
    ),
    userRateLimitBlockMs: n(
      process.env.USER_RATE_LIMIT_BLOCK_MS,
      15 * 60 * 1000
    ),

    sessionCookieDomain: s(process.env.SESSION_COOKIE_DOMAIN, ""),
    cookieDomain: s(process.env.COOKIE_DOMAIN, ""),
    userCookieDomain: s(process.env.USER_COOKIE_DOMAIN, ""),
  },

  rateLimit: {
    executionCallbackWindowMs: n(
      process.env.EXECUTION_CALLBACK_RATE_LIMIT_WINDOW_MS,
      60 * 1000
    ),
    executionCallbackMaxRequests: n(
      process.env.EXECUTION_CALLBACK_RATE_LIMIT_MAX_REQUESTS,
      120
    ),
  },

  tenant: {
    defaultTenantKey: s(process.env.DEFAULT_TENANT_KEY, "default"),
    dailyPublishHourLocal: n(process.env.DAILY_PUBLISH_HOUR_LOCAL, 10),
    dailyPublishMinuteLocal: n(process.env.DAILY_PUBLISH_MINUTE_LOCAL, 0),
  },

  ai: {
    openaiApiKey: s(process.env.OPENAI_API_KEY, ""),
    openaiModel: s(process.env.OPENAI_MODEL, "gpt-5"),
    openaiMaxOutputTokens: n(process.env.OPENAI_MAX_OUTPUT_TOKENS, 800),
    openaiTimeoutMs: n(process.env.OPENAI_TIMEOUT_MS, 25_000),

    openaiDebateConcurrency: n(process.env.OPENAI_DEBATE_CONCURRENCY, 2),
    openaiDebateAgentTokens: n(
      process.env.OPENAI_DEBATE_AGENT_TOKENS,
      900
    ),
    openaiDebateSynthTokens: n(
      process.env.OPENAI_DEBATE_SYNTH_TOKENS,
      1400
    ),

    geminiApiKey: s(process.env.GEMINI_API_KEY, ""),
    anthropicApiKey: s(process.env.ANTHROPIC_API_KEY, ""),
  },

  media: {
    runwayApiKey: s(process.env.RUNWAY_API_KEY, ""),
    runwayVideoModel: s(process.env.RUNWAY_VIDEO_MODEL, "gen4.5"),

    pikaApiKey: s(process.env.PIKA_API_KEY, ""),

    elevenlabsApiKey: s(process.env.ELEVENLABS_API_KEY, ""),
    elevenlabsVoiceId: s(process.env.ELEVENLABS_VOICE_ID, ""),
    elevenlabsModelId: s(
      process.env.ELEVENLABS_MODEL_ID,
      "eleven_multilingual_v2"
    ),

    creatomateApiKey: s(process.env.CREATOMATE_API_KEY, ""),
    creatomateApiBase: s(
      process.env.CREATOMATE_API_BASE,
      "https://api.creatomate.com/v1"
    ),
    creatomateTemplateIdReel: s(
      process.env.CREATOMATE_TEMPLATE_ID_REEL,
      ""
    ),
    creatomateTemplateIdCarouselVideo: s(
      process.env.CREATOMATE_TEMPLATE_ID_CAROUSEL_VIDEO,
      ""
    ),
  },

  meta: {
    pageAccessToken: s(process.env.META_PAGE_ACCESS_TOKEN, ""),
    apiVersion: s(process.env.META_API_VERSION, "v23.0"),

    appId: s(process.env.META_APP_ID, ""),
    appSecret: s(process.env.META_APP_SECRET, ""),
    redirectUri: s(process.env.META_REDIRECT_URI, ""),
  },

  google: {
    placesApiKey: s(process.env.GOOGLE_PLACES_API_KEY, ""),
    placesApiBase: s(
      process.env.GOOGLE_PLACES_API_BASE,
      "https://places.googleapis.com"
    ),
    placesDefaultLanguage: s(
      process.env.GOOGLE_PLACES_DEFAULT_LANGUAGE,
      "en"
    ),
    placesDefaultRegion: s(
      process.env.GOOGLE_PLACES_DEFAULT_REGION,
      "AZ"
    ),

    businessProfileClientId: s(
      process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID,
      ""
    ),
    businessProfileClientSecret: s(
      process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET,
      ""
    ),
    businessProfileRedirectUri: s(
      process.env.GOOGLE_BUSINESS_PROFILE_REDIRECT_URI,
      ""
    ),
  },

  n8n: {
    webhookBase: s(process.env.N8N_WEBHOOK_BASE, ""),
    webhookUrl: s(process.env.N8N_WEBHOOK_URL, ""),
    webhookProposalApprovedUrl: s(
      process.env.N8N_WEBHOOK_PROPOSAL_APPROVED_URL,
      ""
    ),
    webhookPublishUrl: s(process.env.N8N_WEBHOOK_PUBLISH_URL, ""),
    webhookToken: s(process.env.N8N_WEBHOOK_TOKEN, ""),
    callbackToken: s(process.env.N8N_CALLBACK_TOKEN, ""),
    timeoutMs: n(process.env.N8N_TIMEOUT_MS, 10_000),
    retries: n(process.env.N8N_RETRIES, 2),
    backoffMs: n(process.env.N8N_BACKOFF_MS, 500),

    scheduleDraftUrl: s(process.env.N8N_WEBHOOK_SCHEDULE_DRAFT_URL, ""),
  },

  telegram: {
    enabled: b(process.env.TELEGRAM_ENABLED, false),
    botToken: s(process.env.TELEGRAM_BOT_TOKEN, ""),
    chatId: s(process.env.TELEGRAM_CHAT_ID, ""),
  },

  push: {
    enabled: b(process.env.PUSH_ENABLED, true),
    vapidPublicKey: s(process.env.VAPID_PUBLIC_KEY, ""),
    vapidPrivateKey: s(process.env.VAPID_PRIVATE_KEY, ""),
    vapidSubject: s(
      process.env.VAPID_SUBJECT,
      "mailto:info@example.com"
    ),
  },

  gateway: {
    metaGatewayBaseUrl: s(process.env.META_GATEWAY_BASE_URL, ""),
    metaGatewayInternalToken: s(
      process.env.META_GATEWAY_INTERNAL_TOKEN,
      ""
    ),
    metaGatewayTimeoutMs: n(
      process.env.META_GATEWAY_TIMEOUT_MS,
      20_000
    ),
  },

  sourceSync: {
    websiteFetchTimeoutMs: n(
      process.env.SOURCE_SYNC_WEBSITE_FETCH_TIMEOUT_MS,
      7_000
    ),
    websitePageTimeoutMs: n(
      process.env.SOURCE_SYNC_WEBSITE_PAGE_TIMEOUT_MS,
      7_000
    ),
    websiteEntryTimeoutMs: n(
      process.env.SOURCE_SYNC_WEBSITE_ENTRY_TIMEOUT_MS,
      18_000
    ),
    websiteExtractTimeoutMs: n(
      process.env.SOURCE_SYNC_WEBSITE_EXTRACT_TIMEOUT_MS,
      32_000
    ),
    websiteSyncTimeoutMs: n(
      process.env.SOURCE_SYNC_WEBSITE_SYNC_TIMEOUT_MS,
      52_000
    ),
    websiteFinalizeReserveMs: n(
      process.env.SOURCE_SYNC_WEBSITE_FINALIZE_RESERVE_MS,
      4_000
    ),
    websiteMinStepBudgetMs: n(
      process.env.SOURCE_SYNC_WEBSITE_MIN_STEP_BUDGET_MS,
      400
    ),
    websiteRobotsTimeoutMs: n(
      process.env.SOURCE_SYNC_WEBSITE_ROBOTS_TIMEOUT_MS,
      2_200
    ),
    websiteSitemapTimeoutMs: n(
      process.env.SOURCE_SYNC_WEBSITE_SITEMAP_TIMEOUT_MS,
      4_500
    ),
    websiteMaxHtmlBytes: n(
      process.env.SOURCE_SYNC_WEBSITE_MAX_HTML_BYTES,
      1_500_000
    ),
    websiteMaxPagesAllowed: n(
      process.env.SOURCE_SYNC_WEBSITE_MAX_PAGES_ALLOWED,
      6
    ),
    websiteMaxCandidatesQueued: n(
      process.env.SOURCE_SYNC_WEBSITE_MAX_CANDIDATES_QUEUED,
      40
    ),
    websiteMaxFetchPages: n(
      process.env.SOURCE_SYNC_WEBSITE_MAX_FETCH_PAGES,
      10
    ),
    websiteUserAgent: s(
      process.env.SOURCE_SYNC_WEBSITE_USER_AGENT,
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    extractVisibleText: b(
      process.env.SOURCE_SYNC_EXTRACT_VISIBLE_TEXT,
      true
    ),
    extractContactHints: b(
      process.env.SOURCE_SYNC_EXTRACT_CONTACT_HINTS,
      true
    ),
    extractSocialLinks: b(
      process.env.SOURCE_SYNC_EXTRACT_SOCIAL_LINKS,
      true
    ),
  },

  workers: {
    sourceSyncWorkerEnabled: b(process.env.SOURCE_SYNC_WORKER_ENABLED, true),
    sourceSyncWorkerIntervalMs: n(
      process.env.SOURCE_SYNC_WORKER_INTERVAL_MS,
      5_000
    ),
    sourceSyncWorkerBatchSize: n(
      process.env.SOURCE_SYNC_WORKER_BATCH_SIZE,
      4
    ),
    sourceSyncWorkerLeaseMs: n(
      process.env.SOURCE_SYNC_WORKER_LEASE_MS,
      10 * 60_000
    ),
    sourceSyncWorkerMaxAttempts: n(
      process.env.SOURCE_SYNC_WORKER_MAX_ATTEMPTS,
      3
    ),
    outboundRetryEnabled: b(process.env.OUTBOUND_RETRY_ENABLED, true),
    outboundRetryIntervalMs: n(
      process.env.OUTBOUND_RETRY_INTERVAL_MS,
      15_000
    ),
    outboundRetryBatchSize: n(
      process.env.OUTBOUND_RETRY_BATCH_SIZE,
      10
    ),
    durableExecutionWorkerEnabled: b(
      process.env.DURABLE_EXECUTION_WORKER_ENABLED,
      b(process.env.OUTBOUND_RETRY_ENABLED, true)
    ),
    durableExecutionWorkerIntervalMs: n(
      process.env.DURABLE_EXECUTION_WORKER_INTERVAL_MS,
      n(process.env.OUTBOUND_RETRY_INTERVAL_MS, 15_000)
    ),
    durableExecutionWorkerBatchSize: n(
      process.env.DURABLE_EXECUTION_WORKER_BATCH_SIZE,
      n(process.env.OUTBOUND_RETRY_BATCH_SIZE, 10)
    ),
    durableExecutionWorkerLeaseMs: n(
      process.env.DURABLE_EXECUTION_WORKER_LEASE_MS,
      60_000
    ),

    draftScheduleWorkerEnabled: b(
      process.env.DRAFT_SCHEDULE_WORKER_ENABLED,
      true
    ),
    draftScheduleWorkerIntervalMs: n(
      process.env.DRAFT_SCHEDULE_WORKER_INTERVAL_MS,
      60_000
    ),

    mediaJobWorkerEnabled: b(
      process.env.MEDIA_JOB_WORKER_ENABLED,
      true
    ),
    mediaJobWorkerIntervalMs: n(
      process.env.MEDIA_JOB_WORKER_INTERVAL_MS,
      15_000
    ),
    mediaJobWorkerBatchSize: n(
      process.env.MEDIA_JOB_WORKER_BATCH_SIZE,
      10
    ),
  },

  observability: {
    staleWorkerHeartbeatMs: n(
      process.env.OBS_STALE_WORKER_HEARTBEAT_MS,
      2 * 60_000
    ),
    retryableBacklogAttentionCount: n(
      process.env.OBS_RETRYABLE_BACKLOG_ATTENTION_COUNT,
      10
    ),
    deadLetterAttentionCount: n(
      process.env.OBS_DEAD_LETTER_ATTENTION_COUNT,
      5
    ),
    stuckInProgressAttentionMs: n(
      process.env.OBS_STUCK_IN_PROGRESS_ATTENTION_MS,
      15 * 60_000
    ),
    recentSignalWindowMs: n(
      process.env.OBS_RECENT_SIGNAL_WINDOW_MS,
      5 * 60_000
    ),
    realtimeAuthFailureAttentionCount: n(
      process.env.OBS_REALTIME_AUTH_FAILURE_ATTENTION_COUNT,
      5
    ),
    sourceSyncAttentionCount: n(
      process.env.OBS_SOURCE_SYNC_ATTENTION_COUNT,
      3
    ),
  },

  debug: {
    debateRaw: b(process.env.DEBUG_DEBATE_RAW, false),
  },
};

cfg.DEFAULT_TENANT_KEY = cfg.tenant.defaultTenantKey;
