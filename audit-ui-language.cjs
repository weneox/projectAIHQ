const fs = require("node:fs");
const path = require("node:path");

const root = "ai-hq-frontend/src";

const allowedNativeControlFiles = new Set([
  "ai-hq-frontend/src/components/ui/Input.jsx",
  "ai-hq-frontend/src/pages/Login.jsx",
  "ai-hq-frontend/src/pages/Team.jsx",
]);

const allowedLocalTeamFile = "ai-hq-frontend/src/pages/Team.jsx";

const ignoredDirs = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
]);

const findings = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...walk(full));
      }
      continue;
    }

    if (/\.(jsx|js|css)$/.test(entry.name)) {
      files.push(full);
    }
  }

  return files;
}

function add(file, type, line, text, note = "") {
  findings.push({
    file,
    type,
    line,
    text: text.trim().slice(0, 180),
    note,
  });
}

function scanFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((lineText, index) => {
    const line = index + 1;
    const t = lineText.trim();

    if (!t) return;

    if (
      /<input\b/.test(t) &&
      !allowedNativeControlFiles.has(file)
    ) {
      add(file, "native-input", line, t, "Use Input.jsx or approved Team input language.");
    }

    if (
      /<select\b/.test(t) &&
      !allowedNativeControlFiles.has(file)
    ) {
      add(file, "native-select", line, t, "Use Select from Input.jsx or approved Team filter language.");
    }

    if (
      /<textarea\b/.test(t) &&
      !allowedNativeControlFiles.has(file)
    ) {
      add(file, "native-textarea", line, t, "Use Textarea from Input.jsx unless it is public widget-specific.");
    }

    if (
      /rounded-full|rounded-3xl|rounded-2xl|rounded-xl|rounded-\[[0-9]+px\]/.test(t) &&
      !file.endsWith("index.css")
    ) {
      add(file, "rounded-class", line, t, "Sharp geometry contract should replace yumru radius.");
    }

    if (
      /#[0-9A-Fa-f]{3,8}/.test(t) &&
      !/warningIcon|stopColor|accentColor/.test(t)
    ) {
      add(file, "hardcoded-color", line, t, "Prefer rgb(var(--color-*)) tokens.");
    }

    if (
      /reports-premium|customers-premium|detail-clean|lines-off|premium-page|premium-detail|harmony/.test(t)
    ) {
      add(file, "page-specific-old-language", line, t, "Looks like old page-specific visual language.");
    }

    if (
      /shadow-\[|bg-\[linear-gradient|bg-\[radial-gradient/.test(t) &&
      !file.endsWith("index.css")
    ) {
      add(file, "heavy-arbitrary-style", line, t, "Consider moving into shared UI contract.");
    }

    if (
      /className=.*(px-6|px-5|py-6|py-5|max-w-\[|mx-auto)/.test(t) &&
      !file.endsWith("index.css")
    ) {
      add(file, "layout-drift-risk", line, t, "May fight app-page-canvas shell spacing.");
    }

    if (
      /<button\b/.test(t) &&
      !/Button/.test(file) &&
      file !== allowedLocalTeamFile &&
      /rounded-|shadow-|border|bg-/.test(t)
    ) {
      add(file, "native-button-style", line, t, "Native styled button may bypass Button.jsx/Team button language.");
    }
  });
}

const files = walk(root);
files.forEach(scanFile);

const grouped = findings.reduce((acc, item) => {
  acc[item.type] ||= [];
  acc[item.type].push(item);
  return acc;
}, {});

console.log("\n=== AIHQ UI LANGUAGE AUDIT ===");
console.log(`Scanned files: ${files.length}`);
console.log(`Total findings: ${findings.length}`);

for (const [type, items] of Object.entries(grouped).sort()) {
  console.log(`\n## ${type}: ${items.length}`);

  for (const item of items.slice(0, 40)) {
    console.log(`- ${item.file}:${item.line}`);
    console.log(`  ${item.text}`);
    if (item.note) console.log(`  note: ${item.note}`);
  }

  if (items.length > 40) {
    console.log(`  ... ${items.length - 40} more`);
  }
}

const outPath = "ui-language-audit.json";
fs.writeFileSync(outPath, JSON.stringify({ files: files.length, findings }, null, 2), "utf8");

console.log(`\nAudit JSON written to: ${outPath}`);

const serious = findings.filter((item) =>
  [
    "page-specific-old-language",
    "native-input",
    "native-select",
    "native-textarea",
    "native-button-style",
  ].includes(item.type)
);

console.log(`Serious cleanup candidates: ${serious.length}`);
