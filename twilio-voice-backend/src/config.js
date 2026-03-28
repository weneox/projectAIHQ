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

function prodDefaultBool(v, fallbackProd = true) {
  const raw = String(v ?? "").trim().toLowerCase();
  if (raw) {
    if (["1", "true", "yes", "y", "on"].includes(raw)) return true;
    if (["0", "false", "no", "n", "off"].includes(raw)) return false;
  }

  const env = s(process.env.APP_ENV, process.env.NODE_ENV || "development").toLowerCase();
  const prodLike = !["", "development", "dev", "test"].includes(env);
  return prodLike ? fallbackProd : false;
}

const DEFAULT_OPERATOR_PHONE = s(
  process.env.OPERATOR_PHONE || process.env.DEFAULT_OPERATOR_PHONE
);

export const cfg = {
  PORT: n(process.env.PORT, 8081),
  APP_ENV: s(process.env.APP_ENV, "development"),
  TRUST_PROXY: b(process.env.TRUST_PROXY, false),
  ENABLE_HSTS: b(process.env.ENABLE_HSTS, false),

  OPENAI_API_KEY: s(process.env.OPENAI_API_KEY),
  OPENAI_REALTIME_MODEL: s(
    process.env.OPENAI_REALTIME_MODEL,
    "gpt-4o-realtime-preview"
  ),
  OPENAI_REALTIME_VOICE: s(process.env.OPENAI_REALTIME_VOICE, "alloy"),
  OPENAI_REALTIME_INSTRUCTIONS: s(process.env.OPENAI_REALTIME_INSTRUCTIONS),
  OPENAI_REALTIME_RECONNECT_MAX: Math.max(
    0,
    n(process.env.OPENAI_REALTIME_RECONNECT_MAX, 2)
  ),

  PUBLIC_BASE_URL: s(process.env.PUBLIC_BASE_URL).replace(/\/+$/, ""),
  CORS_ORIGIN: s(process.env.CORS_ORIGIN).replace(/\/+$/, ""),

  TWILIO_ACCOUNT_SID: s(process.env.TWILIO_ACCOUNT_SID),
  TWILIO_API_KEY: s(process.env.TWILIO_API_KEY),
  TWILIO_API_SECRET: s(process.env.TWILIO_API_SECRET),
  TWILIO_TWIML_APP_SID: s(process.env.TWILIO_TWIML_APP_SID),
  TWILIO_AUTH_TOKEN: s(process.env.TWILIO_AUTH_TOKEN),
  TWILIO_CALLER_ID: s(process.env.TWILIO_CALLER_ID),

  AIHQ_BASE_URL: s(process.env.AIHQ_BASE_URL).replace(/\/+$/, ""),
  AIHQ_INTERNAL_TOKEN: s(process.env.AIHQ_INTERNAL_TOKEN),
  AIHQ_INTERNAL_SERVICE: s(
    process.env.AIHQ_INTERNAL_SERVICE,
    "twilio-voice-backend"
  ),
  REQUIRE_OPERATIONAL_READINESS_ON_BOOT: prodDefaultBool(
    process.env.REQUIRE_OPERATIONAL_READINESS_ON_BOOT,
    true
  ),

  DEFAULT_TENANT_KEY: s(process.env.DEFAULT_TENANT_KEY, "default"),
  DEFAULT_LANGUAGE: s(process.env.DEFAULT_LANGUAGE, "en"),
  ALLOW_UNSAFE_TENANT_KEY_RESOLUTION: b(
    process.env.ALLOW_UNSAFE_TENANT_KEY_RESOLUTION,
    false
  ),
  ALLOW_LOCAL_TENANT_CONFIG_FALLBACK: b(
    process.env.ALLOW_LOCAL_TENANT_CONFIG_FALLBACK,
    false
  ),

  // system-level fallback only
  DEFAULT_TRANSFER_MODE: s(process.env.DEFAULT_TRANSFER_MODE, "manual"),

  // keep both names for compatibility
  DEFAULT_OPERATOR_PHONE,
  OPERATOR_PHONE: DEFAULT_OPERATOR_PHONE,

  DEBUG_REALTIME: b(process.env.DEBUG_REALTIME, false),
};
