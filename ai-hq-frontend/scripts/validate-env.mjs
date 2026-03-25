import fs from "fs";
import path from "path";

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

function buildEnvSnapshot() {
  const cwd = process.cwd();
  const mode = s(process.env.MODE || process.env.NODE_ENV, "production");
  const files = [
    ".env",
    ".env.local",
    `.env.${mode}`,
    `.env.${mode}.local`,
  ];

  const merged = {};
  for (const file of files) {
    Object.assign(merged, loadEnvFile(path.join(cwd, file)));
  }

  return {
    ...merged,
    ...process.env,
    MODE: mode,
  };
}

function isProductionBuild(env) {
  return ["production", "prod"].includes(lower(env.MODE || env.NODE_ENV)) || lower(env.CI) === "true";
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

function pushIssue(list, level, key, message) {
  list.push({ level, key, message });
}

const env = buildEnvSnapshot();
const issues = [];
const requireBuildEndpoints = isProductionBuild(env);

if (requireBuildEndpoints && !isValidHttpUrl(env.VITE_API_BASE)) {
  pushIssue(
    issues,
    "error",
    "VITE_API_BASE",
    "VITE_API_BASE must be a valid http:// or https:// URL for production/CI builds."
  );
}

if (requireBuildEndpoints && !isValidWsUrl(env.VITE_WS_URL)) {
  pushIssue(
    issues,
    "error",
    "VITE_WS_URL",
    "VITE_WS_URL must be a valid ws:// or wss:// URL for production/CI builds."
  );
}

if (s(env.VITE_ENABLE_INTERNAL_ROUTES) && !["0", "1"].includes(s(env.VITE_ENABLE_INTERNAL_ROUTES))) {
  pushIssue(
    issues,
    "error",
    "VITE_ENABLE_INTERNAL_ROUTES",
    "VITE_ENABLE_INTERNAL_ROUTES must be either '0' or '1' when provided."
  );
}

if (s(env.VITE_DEBUG_PUSH) && !["0", "1", "true", "false"].includes(lower(env.VITE_DEBUG_PUSH))) {
  pushIssue(
    issues,
    "error",
    "VITE_DEBUG_PUSH",
    "VITE_DEBUG_PUSH must be one of: 0, 1, true, false."
  );
}

if (s(env.VITE_VAPID_PUBLIC_KEY) && !/^[A-Za-z0-9\-_]+$/.test(s(env.VITE_VAPID_PUBLIC_KEY))) {
  pushIssue(
    issues,
    "error",
    "VITE_VAPID_PUBLIC_KEY",
    "VITE_VAPID_PUBLIC_KEY must be base64url-safe when provided."
  );
}

const errors = issues.filter((item) => item.level === "error");
const warnings = issues.filter((item) => item.level === "warning");

if (issues.length === 0) {
  console.log("[validate:env] ai-hq-frontend OK");
  process.exit(0);
}

for (const item of warnings) {
  console.warn(`[validate:env][warning] ${item.key}: ${item.message}`);
}

for (const item of errors) {
  console.error(`[validate:env][error] ${item.key}: ${item.message}`);
}

if (errors.length > 0) {
  process.exit(1);
}

console.log("[validate:env] ai-hq-frontend OK");
