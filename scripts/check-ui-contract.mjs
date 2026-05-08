import fs from "node:fs";
import path from "node:path";

const root = path.resolve("ai-hq-frontend/src");

const allowedRawButtonFiles = new Set([
  "ai-hq-frontend/src/components/ui/AppShellPrimitives.jsx",
  "ai-hq-frontend/src/components/ui/Button.jsx",
  "ai-hq-frontend/src/components/ui/AppIconButton.jsx",
  "ai-hq-frontend/src/components/ui/AppCompactActionButton.jsx",
  "ai-hq-frontend/src/components/ui/AppTableFilters.jsx",
  "ai-hq-frontend/src/components/ui/AppPaginationFooter.jsx",
  "ai-hq-frontend/src/pages/Team.jsx",
]);

const allowedRawInputFiles = new Set([
  "ai-hq-frontend/src/components/ui/Input.jsx",
  "ai-hq-frontend/src/components/ui/AppTableFilters.jsx",
  "ai-hq-frontend/src/pages/Team.jsx",
]);

const allowedVisualWrapperFiles = new Set([
  "ai-hq-frontend/src/components/ui/Badge.jsx",
  "ai-hq-frontend/src/components/ui/Card.jsx",
  "ai-hq-frontend/src/components/ui/AppStatCard.jsx",
  "ai-hq-frontend/src/components/ui/AppStatusText.jsx",
  "ai-hq-frontend/src/components/ui/AppIconButton.jsx",
  "ai-hq-frontend/src/components/ui/AppCompactActionButton.jsx",
  "ai-hq-frontend/src/components/ui/AppTableFilters.jsx",
  "ai-hq-frontend/src/components/ui/AppPaginationFooter.jsx",
  "ai-hq-frontend/src/pages/Team.jsx",
]);

function walk(dir) {
  const files = [];

  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!["node_modules", "dist", "build", ".git"].includes(entry.name)) {
        files.push(...walk(full));
      }
      continue;
    }

    if (/\.(jsx|js)$/.test(entry.name)) {
      files.push(full);
    }
  }

  return files;
}

function rel(file) {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

const issues = [];

for (const file of walk(root)) {
  const relative = rel(file);
  const code = fs.readFileSync(file, "utf8");

  const isPage = relative.includes("/src/pages/");
  const isComponent = relative.includes("/src/components/");

  if (!isPage && !isComponent) continue;

  if (
    /<button\s+[^>]*className=/.test(code) &&
    !allowedRawButtonFiles.has(relative)
  ) {
    issues.push({
      file: relative,
      issue: "Raw visual <button className=...> found. Use Button/AppIconButton/AppCompactActionButton/AppTableFilters.",
    });
  }

  if (
    /<input\s+[^>]*className=/.test(code) &&
    !allowedRawInputFiles.has(relative)
  ) {
    issues.push({
      file: relative,
      issue: "Raw visual <input className=...> found. Use Input or AppTableFilters search input.",
    });
  }

  if (
    /rounded-(md|lg|xl|2xl)[^"`']*(border|shadow-\[|bg-surface-subtle)/.test(code) &&
    !allowedVisualWrapperFiles.has(relative)
  ) {
    issues.push({
      file: relative,
      issue: "Page/component appears to create a new visual wrapper language. Use Card/Input/Button/App* primitives.",
    });
  }

  if (
    /bg-surface-subtle[^"`']*text-text-muted[^"`']*<[^>]*(Users|UserRound|Sparkles|TrendingUp|CheckCircle2)/s.test(code) &&
    !allowedVisualWrapperFiles.has(relative)
  ) {
    issues.push({
      file: relative,
      issue: "Possible gray icon pill detected. Default icons should be naked unless inside stat/empty/avatar primitives.",
    });
  }
}

if (!issues.length) {
  console.log("[ui-contract] OK");
  process.exit(0);
}

console.log(`[ui-contract] FAIL ${issues.length} issue(s)\n`);

for (const item of issues) {
  console.log(`${item.file}`);
  console.log(`  - ${item.issue}`);
}

process.exit(1);
