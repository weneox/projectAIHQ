import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const cwd = process.cwd();
const rawTargets = process.argv.slice(2);

const DEFAULT_TARGETS = ["src", "tests", "scripts", "server.js", "index.js", "vite.config.js", "playwright.config.js"];
const IGNORE_DIRS = new Set([
  ".git",
  ".git_backup",
  ".github",
  "coverage",
  "dist",
  "node_modules",
  "test-results",
  ".vite",
]);
const VALID_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function collectFiles(entryPath, out) {
  if (isFile(entryPath)) {
    if (VALID_EXTENSIONS.has(path.extname(entryPath).toLowerCase())) {
      out.push(entryPath);
    }
    return;
  }

  if (!isDirectory(entryPath)) {
    return;
  }

  for (const dirent of fs.readdirSync(entryPath, { withFileTypes: true })) {
    if (dirent.isDirectory()) {
      if (IGNORE_DIRS.has(dirent.name)) continue;
      collectFiles(path.join(entryPath, dirent.name), out);
      continue;
    }

    if (!dirent.isFile()) continue;

    const filePath = path.join(entryPath, dirent.name);
    if (VALID_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
      out.push(filePath);
    }
  }
}

function resolveTargets() {
  const out = [];
  const seen = new Set();
  const targets = rawTargets.length > 0 ? rawTargets : DEFAULT_TARGETS;

  for (const target of targets) {
    const abs = path.resolve(cwd, target);
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }

  return out;
}

function runSyntaxCheck(filePath) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    cwd,
    encoding: "utf8",
  });

  if (result.error) {
    return {
      ok: false,
      message: String(result.error?.message || result.error),
    };
  }

  if (result.status === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    message:
      String(result.stderr || "").trim() ||
      String(result.stdout || "").trim() ||
      `node --check failed for ${filePath}`,
  };
}

const files = [];
for (const target of resolveTargets()) {
  collectFiles(target, files);
}

const uniqueFiles = [...new Set(files)].sort((a, b) => a.localeCompare(b));

if (uniqueFiles.length === 0) {
  console.log("[lint] no JavaScript files found to check");
  process.exit(0);
}

const failures = [];
for (const filePath of uniqueFiles) {
  const checked = runSyntaxCheck(filePath);
  if (!checked.ok) {
    failures.push({
      filePath: path.relative(cwd, filePath) || filePath,
      message: checked.message,
    });
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[lint] syntax check failed: ${failure.filePath}`);
    if (failure.message) {
      console.error(failure.message);
    }
  }
  process.exit(1);
}

console.log(`[lint] syntax OK across ${uniqueFiles.length} file(s)`);
