import { cfg } from "../config.js";
import {
  createValidationIssue,
  formatValidationFailure,
  printValidationReport,
} from "../../../scripts/env-validation-utils.mjs";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function isProdLikeEnv(env = cfg.APP_ENV) {
  return !["", "development", "dev", "test"].includes(lower(env));
}

function isValidHttpUrl(value = "") {
  const raw = s(value);
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidCorsOriginList(value = "") {
  const raw = s(value);
  if (!raw) return false;
  if (raw === "*") return true;

  return raw
    .split(",")
    .map((item) => s(item))
    .filter(Boolean)
    .every((item) => isValidHttpUrl(item));
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

export function getConfigIssues() {
  const issues = [];
  const isProd = isProdLikeEnv(cfg.APP_ENV);

  if (!s(cfg.APP_ENV)) {
    pushIssue(issues, "error", "APP_ENV", "APP_ENV is required.");
  }

  if (!isValidHttpUrl(cfg.PUBLIC_BASE_URL)) {
    pushIssue(
      issues,
      "error",
      "PUBLIC_BASE_URL",
      "PUBLIC_BASE_URL must be a valid http:// or https:// URL.",
      {
        category: "routing",
        envKeys: ["PUBLIC_BASE_URL"],
      }
    );
  }

  if (!isValidCorsOriginList(cfg.CORS_ORIGIN)) {
    pushIssue(
      issues,
      "error",
      "CORS_ORIGIN",
      "CORS_ORIGIN must be a comma-separated list of valid http:// or https:// origins.",
      {
        category: "routing",
        envKeys: ["CORS_ORIGIN"],
      }
    );
  } else if (isProd && s(cfg.CORS_ORIGIN) === "*") {
    pushIssue(
      issues,
      "error",
      "CORS_ORIGIN",
      "CORS_ORIGIN='*' is not allowed in production-like environments."
    );
  }

  if (!s(cfg.OPENAI_API_KEY)) {
    pushIssue(
      issues,
      "error",
      "OPENAI_API_KEY",
      "OPENAI_API_KEY is required for realtime voice sessions.",
      {
        category: "providers",
        envKeys: ["OPENAI_API_KEY"],
      }
    );
  }

  if (!isValidHttpUrl(cfg.AIHQ_BASE_URL)) {
    pushIssue(
      issues,
      "error",
      "AIHQ_BASE_URL",
      "AIHQ_BASE_URL must be a valid http:// or https:// URL.",
      {
        category: "internal-access",
        envKeys: ["AIHQ_BASE_URL"],
      }
    );
  }

  if (!s(cfg.AIHQ_INTERNAL_TOKEN)) {
    pushIssue(
      issues,
      "error",
      "AIHQ_INTERNAL_TOKEN",
      "AIHQ_INTERNAL_TOKEN is required for internal AIHQ calls.",
      {
        category: "internal-access",
        envKeys: ["AIHQ_INTERNAL_TOKEN"],
      }
    );
  }

  for (const key of [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_API_KEY",
    "TWILIO_API_SECRET",
    "TWILIO_TWIML_APP_SID",
    "TWILIO_AUTH_TOKEN",
  ]) {
    if (!s(cfg[key])) {
      pushIssue(issues, "error", key, `${key} is required.`, {
        category: "providers",
        envKeys: [key],
      });
    }
  }

  if (!s(cfg.TWILIO_CALLER_ID)) {
    pushIssue(
      issues,
      "warning",
      "TWILIO_CALLER_ID",
      "TWILIO_CALLER_ID is empty; transfer and outbound caller identity may be degraded."
    );
  }

  if (isProd && !cfg.ENABLE_HSTS) {
    pushIssue(
      issues,
      "warning",
      "ENABLE_HSTS",
      "ENABLE_HSTS=false in a production-like environment."
    );
  }

  if (cfg.ALLOW_UNSAFE_TENANT_KEY_RESOLUTION) {
    pushIssue(
      issues,
      isProd ? "error" : "warning",
      "ALLOW_UNSAFE_TENANT_KEY_RESOLUTION",
      "ALLOW_UNSAFE_TENANT_KEY_RESOLUTION enables request-supplied tenant keys for call routing and must stay disabled in production-like environments."
    );
  }

  if (cfg.ALLOW_LOCAL_TENANT_CONFIG_FALLBACK) {
    pushIssue(
      issues,
      isProd ? "error" : "warning",
      "ALLOW_LOCAL_TENANT_CONFIG_FALLBACK",
      "ALLOW_LOCAL_TENANT_CONFIG_FALLBACK enables generic local voice config fallback and must stay disabled in production-like environments."
    );
  }

  if (isProd && !cfg.REQUIRE_OPERATIONAL_READINESS_ON_BOOT) {
    pushIssue(
      issues,
      "warning",
      "REQUIRE_OPERATIONAL_READINESS_ON_BOOT",
      "REQUIRE_OPERATIONAL_READINESS_ON_BOOT=false disables startup blocking when AI HQ reports operational readiness blockers."
    );
  }

  return issues;
}

export function printConfigReport(logger = console) {
  return printValidationReport({
    workspace: "twilio-voice-backend",
    issues: getConfigIssues(),
    logger,
    okMessage: "[validate:env] twilio-voice-backend OK",
  });
}

export function assertConfigValid(logger = console) {
  const report = printConfigReport(logger);
  if (!report.ok) {
    throw new Error(formatValidationFailure("twilio-voice-backend", report));
  }
  return report;
}
