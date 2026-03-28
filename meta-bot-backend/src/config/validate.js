import {
  AIHQ_BASE_URL,
  AIHQ_INTERNAL_TOKEN,
  APP_ENV,
  CONTACT_EMAIL,
  META_APP_SECRET,
  REQUIRE_OPERATIONAL_READINESS_ON_BOOT,
  N8N_WEBHOOK_URL,
  PUBLIC_BASE_URL,
  VERIFY_TOKEN,
} from "../config.js";
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
  const isProd = isProdLikeEnv(APP_ENV);

  if (!s(APP_ENV)) {
    pushIssue(issues, "error", "APP_ENV", "APP_ENV is required.");
  }

  if (!s(VERIFY_TOKEN)) {
    pushIssue(issues, "error", "VERIFY_TOKEN", "VERIFY_TOKEN is required.", {
      category: "webhook-auth",
      envKeys: ["VERIFY_TOKEN"],
    });
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
      "META_APP_SECRET is required for webhook signature verification.",
      {
        category: "providers",
        envKeys: ["META_APP_SECRET"],
      }
    );
  }

  if (!isValidHttpUrl(PUBLIC_BASE_URL)) {
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

  if (!isValidHttpUrl(AIHQ_BASE_URL)) {
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

  if (!s(AIHQ_INTERNAL_TOKEN)) {
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

  if (!looksLikeEmail(CONTACT_EMAIL)) {
    pushIssue(
      issues,
      "error",
      "CONTACT_EMAIL",
      "CONTACT_EMAIL must be a valid contact email address.",
      {
        category: "contact",
        envKeys: ["CONTACT_EMAIL"],
      }
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
  return printValidationReport({
    workspace: "meta-bot-backend",
    issues: getConfigIssues(),
    logger,
    okMessage: "[validate:env] meta-bot-backend OK",
  });
}

export function assertConfigValid(logger = console) {
  const report = printConfigReport(logger);
  if (!report.ok) {
    throw new Error(formatValidationFailure("meta-bot-backend", report));
  }
  return report;
}
