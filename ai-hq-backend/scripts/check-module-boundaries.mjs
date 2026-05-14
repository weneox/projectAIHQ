import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const srcRoot = path.join(backendRoot, "src");
const scanRoots = [
  path.join(srcRoot, "platform"),
  path.join(srcRoot, "modules"),
];

const TEMPORARY_ALLOWLIST = new Map();

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function relativeToSrc(file) {
  return toPosix(path.relative(srcRoot, file));
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && /\.(?:js|mjs)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function findImportSources(source) {
  const matches = [];
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+\*\s+from\s+["']([^"']+)["']/g,
    /\bexport\s+\{[\s\S]*?\}\s+from\s+["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      matches.push(match[1]);
    }
  }

  return matches;
}

function resolveRelativeImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  return path.resolve(path.dirname(fromFile), specifier);
}

function getArea(srcRelativePath) {
  if (srcRelativePath.startsWith("platform/")) return "platform";
  if (srcRelativePath.startsWith("modules/")) return "modules";
  if (srcRelativePath.startsWith("routes/")) return "routes";
  return "";
}

function violatedRule(sourceArea, targetArea) {
  if (sourceArea === "platform" && targetArea === "routes") {
    return "src/platform/** must NOT import from src/routes/**";
  }
  if (sourceArea === "platform" && targetArea === "modules") {
    return "src/platform/** must NOT import from src/modules/**";
  }
  if (sourceArea === "modules" && targetArea === "routes") {
    return "src/modules/** must NOT import from src/routes/**";
  }
  return "";
}

function allowlistKey(sourceRelativePath, targetRelativePath) {
  return `${sourceRelativePath} -> ${targetRelativePath}`;
}

const files = scanRoots.flatMap(walk).sort();
const violations = [];
const temporaryAllowed = [];

for (const file of files) {
  const sourceRelativePath = relativeToSrc(file);
  const sourceArea = getArea(sourceRelativePath);
  const source = fs.readFileSync(file, "utf8");

  for (const specifier of findImportSources(source)) {
    const resolved = resolveRelativeImport(file, specifier);
    if (!resolved) continue;

    const targetRelativePath = relativeToSrc(resolved);
    const targetArea = getArea(targetRelativePath);
    const rule = violatedRule(sourceArea, targetArea);
    if (!rule) continue;

    const key = allowlistKey(sourceRelativePath, targetRelativePath);
    const todo = TEMPORARY_ALLOWLIST.get(key);

    const entry = {
      file: `src/${sourceRelativePath}`,
      target: `src/${targetRelativePath}`,
      rule,
      todo,
    };

    if (todo) {
      temporaryAllowed.push(entry);
    } else {
      violations.push(entry);
    }
  }
}

if (temporaryAllowed.length) {
  console.log("[boundaries] Temporary allowed violations:");
  for (const item of temporaryAllowed) {
    console.log(`- ${item.file}`);
    console.log(`  imports: ${item.target}`);
    console.log(`  rule: ${item.rule}`);
    console.log(`  ${item.todo}`);
  }
}

if (violations.length) {
  console.error("[boundaries] Import boundary violations found:");
  for (const item of violations) {
    console.error(`- ${item.file}`);
    console.error(`  imports: ${item.target}`);
    console.error(`  rule: ${item.rule}`);
  }
  process.exit(1);
}

console.log(
  `[boundaries] OK: no new platform/modules route-layer violations across ${files.length} file(s).`
);
