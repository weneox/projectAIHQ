import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAX_FILE_BYTES = 1024 * 1024;

const SKIP_PATH_PARTS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "test-results",
  ".cache",
  ".vite",
]);

const SKIP_FILE_NAMES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

const TEXT_EXTENSIONS = new Set([
  "",
  ".cjs",
  ".css",
  ".env",
  ".example",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".md",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const SENSITIVE_KEY_PATTERN =
  /(?:SECRET|TOKEN|PASSWORD|PASSCODE|PRIVATE_KEY|API_KEY|AUTH_TOKEN|SESSION_SECRET|INTERNAL_TOKEN|DEPLOY_HOOK|DATABASE_URL|DB_URL|POSTGRES_URL)/i;

const ASSIGNMENT_PATTERN =
  /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSCODE|PRIVATE_KEY|API_KEY|AUTH_TOKEN|SESSION_SECRET|INTERNAL_TOKEN|DEPLOY_HOOK|DATABASE_URL|DB_URL|POSTGRES_URL)[A-Z0-9_]*)\s*[:=]\s*(.+?)\s*$/;

const HIGH_CONFIDENCE_PATTERNS = [
  {
    reason: "openai_api_key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    reason: "github_token",
    pattern:
      /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  },
  {
    reason: "meta_page_access_token",
    pattern: /\bEAA[A-Za-z0-9]{20,}\b/,
  },
  {
    reason: "cloudflare_deploy_hook",
    pattern:
      /https:\/\/api\.cloudflare\.com\/client\/v4\/pages\/webhooks\/deploy_hooks\/[A-Za-z0-9_-]{12,}/i,
  },
  {
    reason: "private_key",
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    reason: "jwt_token",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizePath(filePath = "") {
  return filePath.replace(/\\/g, "/");
}

function printLine(prefix, message, details = "") {
  const suffix = details ? ` ${details}` : "";
  console.log(`${prefix} ${message}${suffix}`);
}

function isSkippedPath(filePath = "") {
  const normalized = normalizePath(filePath);
  const parts = normalized.split("/");
  if (parts.some((part) => SKIP_PATH_PARTS.has(part))) return true;
  if (SKIP_FILE_NAMES.has(path.basename(normalized))) return true;
  return false;
}

function isProbablyTextFile(filePath = "") {
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  return path.basename(filePath).startsWith(".");
}

function listTrackedFiles() {
  try {
    return execFileSync("git", ["ls-files", "-z"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\0")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    printLine(
      "FAIL",
      "security_secret_scan",
      JSON.stringify({ reasonCode: "git_ls_files_unavailable" })
    );
    process.exit(1);
  }
}

function stripInlineComment(value = "") {
  const raw = s(value).replace(/[,;]$/, "");
  if (!raw.includes("#")) return raw;
  return raw.replace(/\s+#.*$/, "").trim();
}

function normalizeAssignedValue(value = "") {
  let raw = stripInlineComment(value);
  raw = raw.replace(/^["']|["']$/g, "");
  raw = raw.replace(/^`|`$/g, "");
  return raw.trim();
}

function isDocumentedPlaceholder(value = "") {
  const raw = s(value);
  const lower = raw.toLowerCase();

  if (!raw) return true;
  if (raw === "''" || raw === '""') return true;
  if (/^\$\{\{\s*(secrets|github|env|vars)\./i.test(raw)) return true;
  if (raw.includes("${") || raw.includes("process.env") || raw.includes("import.meta.env")) {
    return true;
  }
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(raw)) return true;
  if (
    lower.includes("replace_with") ||
    lower.includes("placeholder") ||
    lower.includes("example.com") ||
    lower.includes("example.test") ||
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("::1") ||
    lower.startsWith("ci-") ||
    lower.startsWith("local-") ||
    lower.startsWith("test-") ||
    lower.startsWith("mock-") ||
    lower.startsWith("dummy-") ||
    lower.startsWith("fake-") ||
    lower === "backup-and-restore-verified"
  ) {
    return true;
  }

  if (/^(?:0123456789abcdef){2,}$/i.test(raw)) return true;
  if (/^(true|false|null|undefined|0|1)$/i.test(raw)) return true;

  return false;
}

function isRealLookingSecretValue(value = "") {
  const raw = normalizeAssignedValue(value);
  const lower = raw.toLowerCase();

  if (isDocumentedPlaceholder(raw)) return false;
  if (raw.length < 12 && !raw.includes("://")) return false;
  if (lower.includes("mailto:")) return false;
  if (/^[A-Z0-9_]+$/.test(raw) && raw.includes("PLACEHOLDER")) return false;

  return true;
}

function postgresPasswordLooksReal(value = "") {
  const raw = normalizeAssignedValue(value);
  const match = raw.match(/postgres(?:ql)?:\/\/[^:\s/]+:([^@\s]+)@/i);
  if (!match) return false;

  const password = decodeURIComponent(match[1]);
  return isRealLookingSecretValue(password);
}

function collectFindingsForLine(filePath, line, lineNumber) {
  const findings = [];

  for (const item of HIGH_CONFIDENCE_PATTERNS) {
    if (item.pattern.test(line) && !isDocumentedPlaceholder(line)) {
      findings.push({
        filePath,
        lineNumber,
        reason: item.reason,
      });
    }
  }

  if (postgresPasswordLooksReal(line)) {
    findings.push({
      filePath,
      lineNumber,
      reason: "postgres_url_with_real_password",
    });
  }

  const assignment = line.match(ASSIGNMENT_PATTERN);
  if (assignment) {
    const key = assignment[1];
    const value = normalizeAssignedValue(assignment[2]);
    if (SENSITIVE_KEY_PATTERN.test(key) && isRealLookingSecretValue(value)) {
      findings.push({
        filePath,
        lineNumber,
        reason: `real_looking_secret_assignment:${key}`,
      });
    }
  }

  return findings;
}

function scanFile(filePath) {
  const abs = path.resolve(ROOT, filePath);
  const stat = fs.statSync(abs);
  if (stat.size > MAX_FILE_BYTES) return [];
  if (!isProbablyTextFile(filePath)) return [];

  const content = fs.readFileSync(abs, "utf8");
  if (content.includes("\0")) return [];

  return content
    .split(/\r?\n/)
    .flatMap((line, index) => collectFindingsForLine(filePath, line, index + 1));
}

function main() {
  const files = listTrackedFiles().filter(
    (filePath) => !isSkippedPath(filePath) && isProbablyTextFile(filePath)
  );
  const findings = files.flatMap((filePath) => scanFile(filePath));

  if (findings.length) {
    printLine(
      "FAIL",
      "security_secret_scan",
      JSON.stringify({ findings: findings.length })
    );

    for (const finding of findings.slice(0, 50)) {
      printLine(
        "!",
        `${finding.filePath}:${finding.lineNumber}`,
        finding.reason
      );
    }

    if (findings.length > 50) {
      printLine("!", "security_secret_scan", `${findings.length - 50} more finding(s)`);
    }

    process.exit(1);
  }

  printLine(
    "OK",
    "security_secret_scan",
    JSON.stringify({ filesScanned: files.length })
  );
}

main();
