import "dotenv/config";
import crypto from "crypto";

function s(v, fallback = "") {
  return String(v ?? fallback).trim();
}

function n(v, fallback) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function b(v, fallback = false) {
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return fallback;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return fallback;
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

export const PORT = n(process.env.PORT, 8080);
export const APP_ENV = s(process.env.APP_ENV, process.env.NODE_ENV || "development");

export const VERIFY_TOKEN = s(process.env.VERIFY_TOKEN, "neox_verify_token");

function fingerprintSecret(secret = "") {
  const safeSecret = s(secret);
  return safeSecret
    ? crypto.createHash("sha256").update(safeSecret).digest("hex").slice(0, 12)
    : "";
}

function resolveSecretContract(
  explicitEnvName,
  fallbackEnvName = "META_APP_SECRET",
  env = process.env
) {
  const explicitValue = s(env?.[explicitEnvName], "");
  const fallbackValue = s(env?.[fallbackEnvName], "");
  const explicitPresent = Boolean(explicitValue);
  const fallbackPresent = Boolean(fallbackValue);
  const mismatch =
    explicitPresent && fallbackPresent && explicitValue !== fallbackValue;
  const resolvedSecret = explicitPresent ? explicitValue : fallbackValue;
  const resolvedSource = explicitPresent
    ? explicitEnvName
    : fallbackPresent
      ? fallbackEnvName
      : "";

  return {
    explicitEnvName,
    fallbackEnvName,
    explicitPresent,
    fallbackPresent,
    explicitFingerprint: fingerprintSecret(explicitValue),
    fallbackFingerprint: fingerprintSecret(fallbackValue),
    mismatch,
    resolvedSecret,
    resolvedSource,
    resolvedFingerprint: fingerprintSecret(resolvedSecret),
  };
}

export function getMetaWebhookSecretConfig(env = process.env) {
  return resolveSecretContract("META_WEBHOOK_APP_SECRET", "META_APP_SECRET", env);
}

export function readMetaWebhookAppSecret(env = process.env) {
  return getMetaWebhookSecretConfig(env).resolvedSecret;
}

export function assertMetaWebhookSecretConfig(env = process.env) {
  const secretConfig = getMetaWebhookSecretConfig(env);

  if (secretConfig.mismatch) {
    const error = new Error(
      "META_WEBHOOK_APP_SECRET and META_APP_SECRET are both set but differ. meta-bot-backend must resolve a single Meta webhook verification secret."
    );
    error.code = "meta_webhook_secret_mismatch";
    error.reason = "secret_env_mismatch";
    error.secretConfig = secretConfig;
    throw error;
  }

  if (!secretConfig.resolvedSecret) {
    const error = new Error(
      "META_WEBHOOK_APP_SECRET is required for Meta webhook signature verification. META_APP_SECRET is only a legacy fallback."
    );
    error.code = "meta_webhook_secret_missing";
    error.reason = "missing_webhook_secret";
    error.secretConfig = secretConfig;
    throw error;
  }

  return secretConfig;
}

export const META_WEBHOOK_APP_SECRET = readMetaWebhookAppSecret(process.env);
export const META_APP_SECRET = META_WEBHOOK_APP_SECRET;

export const CONTACT_EMAIL = s(process.env.CONTACT_EMAIL, "weneox@gmail.com");
export const PUBLIC_BASE_URL = s(process.env.PUBLIC_BASE_URL, "").replace(/\/+$/, "");

// --------------------------------------------------
// AI HQ bridge
// --------------------------------------------------
export const AIHQ_BASE_URL = s(process.env.AIHQ_BASE_URL, "").replace(/\/+$/, "");
export const AIHQ_INTERNAL_TOKEN =
  s(process.env.AIHQ_INTERNAL_TOKEN_META_BOT) ||
  s(process.env.AIHQ_INTERNAL_META_BOT_TOKEN) ||
  s(process.env.AIHQ_INTERNAL_TOKEN);
export const AIHQ_INTERNAL_SERVICE = s(
  process.env.AIHQ_INTERNAL_SERVICE,
  "meta-bot-backend"
);
export const AIHQ_TIMEOUT_MS = n(process.env.AIHQ_TIMEOUT_MS, 20000);
export const REQUIRE_OPERATIONAL_READINESS_ON_BOOT = prodDefaultBool(
  process.env.REQUIRE_OPERATIONAL_READINESS_ON_BOOT,
  true
);
export const AIHQ_SECRETS_PATH = s(
  process.env.AIHQ_SECRETS_PATH,
  "/api/settings/secrets"
);

// --------------------------------------------------
// Meta send
// production path is tenant secrets from AI HQ
// --------------------------------------------------
export const META_API_VERSION = s(process.env.META_API_VERSION, "v23.0");
export const META_REPLY_TIMEOUT_MS = n(process.env.META_REPLY_TIMEOUT_MS, 15000);

// --------------------------------------------------
// optional logs
// --------------------------------------------------
export const LOG_WEBHOOK_EVENTS = b(process.env.LOG_WEBHOOK_EVENTS, true);
export const LOG_WEBHOOK_IGNORED = b(process.env.LOG_WEBHOOK_IGNORED, true);
export const LOG_ACTION_RESULTS = b(process.env.LOG_ACTION_RESULTS, true);

// --------------------------------------------------
// legacy / optional
// --------------------------------------------------
export const N8N_WEBHOOK_URL = s(process.env.N8N_WEBHOOK_URL, "");
export const N8N_TIMEOUT_MS = n(process.env.N8N_TIMEOUT_MS, 8000);

export function signMetaBody(rawBody = "", { secret = readMetaWebhookAppSecret() } = {}) {
  const safeSecret = s(secret);
  if (!safeSecret) return "";

  return `sha256=${crypto
    .createHmac("sha256", safeSecret)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ""), "utf8"))
    .digest("hex")}`;
}
