import {
  AIHQ_BASE_URL,
  AIHQ_INTERNAL_TOKEN,
  APP_ENV,
  CONTACT_EMAIL,
  META_APP_SECRET,
  META_PAGE_ACCESS_TOKEN,
  META_TOKEN_FALLBACK_ENABLED,
  REQUIRE_OPERATIONAL_READINESS_ON_BOOT,
  N8N_WEBHOOK_URL,
  PUBLIC_BASE_URL,
  VERIFY_TOKEN,
} from "../config.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function isProdLikeEnv(env = APP_ENV) {
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

function looksLikeEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(value));
}

function pushIssue(list, level, key, message) {
  list.push({ level, key, message });
}

export function getConfigIssues() {
  const issues = [];
  const isProd = isProdLikeEnv(APP_ENV);

  if (!s(APP_ENV)) {
    pushIssue(issues, "error", "APP_ENV", "APP_ENV is required.");
  }

  if (!s(VERIFY_TOKEN)) {
    pushIssue(issues, "error", "VERIFY_TOKEN", "VERIFY_TOKEN is required.");
  } else if (isProd && s(VERIFY_TOKEN) === "neox_verify_token") {
    pushIssue(
      issues,
      "error",
      "VERIFY_TOKEN",
      "VERIFY_TOKEN cannot use the legacy default value in production-like environments."
    );
  }

  if (!s(META_APP_SECRET)) {
    pushIssue(
      issues,
      "error",
      "META_APP_SECRET",
      "META_APP_SECRET is required for webhook signature verification."
    );
  }

  if (!isValidHttpUrl(PUBLIC_BASE_URL)) {
    pushIssue(
      issues,
      "error",
      "PUBLIC_BASE_URL",
      "PUBLIC_BASE_URL must be a valid http:// or https:// URL."
    );
  }

  if (!isValidHttpUrl(AIHQ_BASE_URL)) {
    pushIssue(
      issues,
      "error",
      "AIHQ_BASE_URL",
      "AIHQ_BASE_URL must be a valid http:// or https:// URL."
    );
  }

  if (!s(AIHQ_INTERNAL_TOKEN)) {
    pushIssue(
      issues,
      "error",
      "AIHQ_INTERNAL_TOKEN",
      "AIHQ_INTERNAL_TOKEN is required for internal AIHQ calls."
    );
  }

  if (!looksLikeEmail(CONTACT_EMAIL)) {
    pushIssue(
      issues,
      "error",
      "CONTACT_EMAIL",
      "CONTACT_EMAIL must be a valid contact email address."
    );
  }

  if (s(N8N_WEBHOOK_URL) && !isValidHttpUrl(N8N_WEBHOOK_URL)) {
    pushIssue(
      issues,
      "error",
      "N8N_WEBHOOK_URL",
      "N8N_WEBHOOK_URL must be a valid http:// or https:// URL when provided."
    );
  }

  if (META_TOKEN_FALLBACK_ENABLED && !s(META_PAGE_ACCESS_TOKEN)) {
    pushIssue(
      issues,
      "warning",
      "META_PAGE_ACCESS_TOKEN",
      "META_TOKEN_FALLBACK_ENABLED=true but META_PAGE_ACCESS_TOKEN is empty; tenant-secret fallback must be available at runtime."
    );
  }

  if (isProd && META_TOKEN_FALLBACK_ENABLED) {
    pushIssue(
      issues,
      "warning",
      "META_TOKEN_FALLBACK_ENABLED",
      "META_TOKEN_FALLBACK_ENABLED=true enables legacy env-token fallback and should remain disabled in production-like environments."
    );
  }

  if (isProd && !REQUIRE_OPERATIONAL_READINESS_ON_BOOT) {
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
