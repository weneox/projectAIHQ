import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(testDir, "..");
const servicesRoot = path.join(backendRoot, "src", "services");

// Known remaining service -> route debts.
// Keep this list small and remove entries as each dependency is fixed.
const allowedRouteLayerImports = new Set([
]);

function listJsFiles(dir) {
  const output = [];

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      output.push(...listJsFiles(fullPath));
      continue;
    }

    if (item.isFile() && item.name.endsWith(".js")) {
      output.push(fullPath);
    }
  }

  return output;
}

function findImportSources(content) {
  const sources = [];
  const importRegex =
    /(?:import\s+[\s\S]*?\s+from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|export\s+[\s\S]*?\s+from\s*["']([^"']+)["'])/g;

  for (const match of content.matchAll(importRegex)) {
    sources.push(match[1] || match[2] || match[3] || "");
  }

  return sources.filter(Boolean);
}

function isRouteLayerImport(source) {
  return (
    source.includes("/routes/") ||
    source.includes("../routes/") ||
    source.includes("../../routes/") ||
    source.includes("../../../routes/") ||
    source.includes("../../../../routes/") ||
    source.includes("routes/api/")
  );
}

test("backend services do not add new route-layer imports", () => {
  const files = listJsFiles(servicesRoot);
  assert.ok(files.length > 0, "expected service files to scan");

  const violations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const relativePath = path.relative(backendRoot, file).replaceAll("\\", "/");

    for (const source of findImportSources(content)) {
      if (isRouteLayerImport(source)) {
        violations.push(`${relativePath} -> ${source}`);
      }
    }
  }

  const unexpected = violations.filter(
    (violation) => !allowedRouteLayerImports.has(violation)
  );

  assert.deepEqual(unexpected, []);
});
