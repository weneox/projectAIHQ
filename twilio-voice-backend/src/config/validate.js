import { cfg } from "../config.js";

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

function pushIssue(list, level, key, message) {
  list.push({ level, key, message });
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
      "PUBLIC_BASE_URL must be a valid http:// or https:// URL."
    );
  }

  if (!isValidCorsOriginList(cfg.CORS_ORIGIN)) {
    pushIssue(
      issues,
      "error",
      "CORS_ORIGIN",
      "CORS_ORIGIN must be a comma-separated list of valid http:// or https:// origins."
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
      "OPENAI_API_KEY is required for realtime voice sessions."
    );
  }

  if (!isValidHttpUrl(cfg.AIHQ_BASE_URL)) {
    pushIssue(
      issues,
      "error",
      "AIHQ_BASE_URL",
      "AIHQ_BASE_URL must be a valid http:// or https:// URL."
    );
  }

  if (!s(cfg.AIHQ_INTERNAL_TOKEN)) {
    pushIssue(
      issues,
      "error",
      "AIHQ_INTERNAL_TOKEN",
      "AIHQ_INTERNAL_TOKEN is required for internal AIHQ calls."
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
      pushIssue(issues, "error", key, `${key} is required.`);
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

  return issues;
}

export function printConfigReport(logger = console) {
  const issues = getConfigIssues();
  const errors = issues.filter((item) => item.level === "error");
  const warnings = issues.filter((item) => item.level === "warning");

  if (!issues.length) {
    logger.log("[config] OK: no validation issues found.");
    return { ok: true, issues, errors, warnings };
  }

  for (const item of warnings) {
    logger.warn(`[config][warning] ${item.key}: ${item.message}`);
  }

  for (const item of errors) {
    logger.error(`[config][error] ${item.key}: ${item.message}`);
  }

  return {
    ok: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}

export function assertConfigValid(logger = console) {
  const report = printConfigReport(logger);
  if (!report.ok) {
    throw new Error(
      report.errors.map((item) => `${item.key}: ${item.message}`).join("\n")
    );
  }
  return report;
}
