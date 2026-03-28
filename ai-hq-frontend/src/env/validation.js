import fs from "fs";
import path from "path";

import {
  createValidationIssue,
  printValidationReport,
} from "../../../scripts/env-validation-utils.mjs";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const out = {};
  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, valuePart] = match;
    let value = valuePart.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

export function buildFrontendEnvSnapshot({
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  const mode = s(env.MODE || env.NODE_ENV, "production");
  const files = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];

  const merged = {};
  for (const file of files) {
    Object.assign(merged, loadEnvFile(path.join(cwd, file)));
  }

  return {
    ...merged,
    ...env,
    MODE: mode,
  };
}

export function isFrontendProductionBuild(env = {}) {
  return (
    ["production", "prod"].includes(lower(env.MODE || env.NODE_ENV)) ||
    lower(env.CI) === "true"
  );
}

export function getFrontendEnvIssues(env = buildFrontendEnvSnapshot()) {
  const issues = [];
  const requireBuildEndpoints = isFrontendProductionBuild(env);

  if (requireBuildEndpoints && !isValidHttpUrl(env.VITE_API_BASE)) {
    issues.push(
      createValidationIssue({
        level: "error",
        key: "VITE_API_BASE",
        message:
          "VITE_API_BASE must be a valid http:// or https:// URL for production/CI builds.",
        category: "frontend-endpoints",
        requirement: "build-required",
        phase: "build",
        envKeys: ["VITE_API_BASE"],
      })
    );
  }

  if (requireBuildEndpoints && !isValidWsUrl(env.VITE_WS_URL)) {
    issues.push(
      createValidationIssue({
        level: "error",
        key: "VITE_WS_URL",
        message:
          "VITE_WS_URL must be a valid ws:// or wss:// URL for production/CI builds.",
        category: "frontend-endpoints",
        requirement: "build-required",
        phase: "build",
        envKeys: ["VITE_WS_URL"],
      })
    );
  }

  if (
    s(env.VITE_ENABLE_INTERNAL_ROUTES) &&
    !["0", "1"].includes(s(env.VITE_ENABLE_INTERNAL_ROUTES))
  ) {
    issues.push(
      createValidationIssue({
        level: "error",
        key: "VITE_ENABLE_INTERNAL_ROUTES",
        message:
          "VITE_ENABLE_INTERNAL_ROUTES must be either '0' or '1' when provided.",
        category: "frontend-flags",
        requirement: "optional",
        phase: "build",
        envKeys: ["VITE_ENABLE_INTERNAL_ROUTES"],
      })
    );
  }

  if (
    s(env.VITE_DEBUG_PUSH) &&
    !["0", "1", "true", "false"].includes(lower(env.VITE_DEBUG_PUSH))
  ) {
    issues.push(
      createValidationIssue({
        level: "error",
        key: "VITE_DEBUG_PUSH",
        message: "VITE_DEBUG_PUSH must be one of: 0, 1, true, false.",
        category: "frontend-flags",
        requirement: "optional",
        phase: "build",
        envKeys: ["VITE_DEBUG_PUSH"],
      })
    );
  }

  if (
    s(env.VITE_ENABLE_SERVICE_WORKER) &&
    !["0", "1", "true", "false"].includes(lower(env.VITE_ENABLE_SERVICE_WORKER))
  ) {
    issues.push(
      createValidationIssue({
        level: "error",
        key: "VITE_ENABLE_SERVICE_WORKER",
        message:
          "VITE_ENABLE_SERVICE_WORKER must be one of: 0, 1, true, false.",
        category: "frontend-flags",
        requirement: "optional",
        phase: "build",
        envKeys: ["VITE_ENABLE_SERVICE_WORKER"],
      })
    );
  }

  if (
    s(env.VITE_VAPID_PUBLIC_KEY) &&
    !/^[A-Za-z0-9\-_]+$/.test(s(env.VITE_VAPID_PUBLIC_KEY))
  ) {
    issues.push(
      createValidationIssue({
        level: "error",
        key: "VITE_VAPID_PUBLIC_KEY",
        message: "VITE_VAPID_PUBLIC_KEY must be base64url-safe when provided.",
        category: "frontend-push",
        requirement: "optional",
        phase: "build",
        envKeys: ["VITE_VAPID_PUBLIC_KEY"],
      })
    );
  }

  return issues;
}

export function printFrontendEnvReport(logger = console, env = buildFrontendEnvSnapshot()) {
  return printValidationReport({
    workspace: "ai-hq-frontend",
    issues: getFrontendEnvIssues(env),
    logger,
    okMessage: "[validate:env] ai-hq-frontend OK",
  });
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

function isValidWsUrl(value = "") {
  const raw = s(value);
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "ws:" || parsed.protocol === "wss:";
  } catch {
    return false;
  }
}
