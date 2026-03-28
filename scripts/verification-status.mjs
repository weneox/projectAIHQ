import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import "./workspace-module-loader.mjs";

import { collectIssueEnvKeys } from "./env-validation-utils.mjs";

function printSection(title) {
  console.log(`\n## ${title}`);
}

function printStatus(name, status, details = "") {
  const suffix = details ? ` ${details}` : "";
  console.log(`- ${name}: ${status}${suffix}`);
}

function canUseDocker() {
  const command = process.platform === "win32" ? "docker.exe" : "docker";
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
    shell: false,
    windowsHide: true,
  });
  return result.status === 0;
}

function summarizeIssues(issues = []) {
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  return {
    errors,
    warnings,
    envKeys: collectIssueEnvKeys(errors),
  };
}

function formatEnvKeys(keys = []) {
  return keys.length ? `env=${keys.join(",")}` : "";
}

function resolveRepoRoot() {
  return fileURLToPath(new URL("../", import.meta.url));
}

function dockerBuildCommandFor(workspaceName) {
  return `docker build -f ${workspaceName}/Dockerfile .`;
}

function dockerRunCommandFor(workspaceName) {
  return `docker run --rm -p 8080:8080 ${workspaceName}`;
}

export function getContainerRuntimeParity({ repoRoot = resolveRepoRoot() } = {}) {
  const workspaces = [
    {
      name: "ai-hq-backend",
      dockerfilePath: join(repoRoot, "ai-hq-backend", "Dockerfile"),
      requiredMarkers: [
        "COPY shared-contracts ./shared-contracts",
        "COPY scripts ./scripts",
        "COPY ai-hq-backend/package*.json ./ai-hq-backend/",
        "WORKDIR /app/ai-hq-backend",
        "RUN npm ci",
        'CMD ["npm", "start"]',
      ],
    },
    {
      name: "meta-bot-backend",
      dockerfilePath: join(repoRoot, "meta-bot-backend", "Dockerfile"),
      requiredMarkers: [
        "COPY shared-contracts ./shared-contracts",
        "COPY scripts ./scripts",
        "COPY meta-bot-backend/package*.json ./meta-bot-backend/",
        "WORKDIR /app/meta-bot-backend",
        "RUN npm ci",
        'CMD ["npm", "start"]',
      ],
    },
    {
      name: "twilio-voice-backend",
      dockerfilePath: join(repoRoot, "twilio-voice-backend", "Dockerfile"),
      requiredMarkers: [],
    },
  ];

  return workspaces.map((workspace) => {
    if (!existsSync(workspace.dockerfilePath)) {
      return {
        name: workspace.name,
        status: "no_repo_docker_asset",
        detail: "no Dockerfile is present in-repo; use workspace startup scripts instead",
      };
    }

    const dockerfile = readFileSync(workspace.dockerfilePath, "utf8");
    const missingMarkers = workspace.requiredMarkers.filter(
      (marker) => !dockerfile.includes(marker)
    );

    if (missingMarkers.length > 0) {
      return {
        name: workspace.name,
        status: "drifted_from_workspace_contract",
        detail:
          "docker asset no longer reflects the workspace loader/shared-contracts startup contract",
      };
    }

    return {
      name: workspace.name,
      status: "ready",
      detail: `${dockerBuildCommandFor(workspace.name)} -> ${dockerRunCommandFor(workspace.name)} (build from repo root)`,
    };
  });
}

function renderWorkspaceValidation(name, issues = []) {
  const summary = summarizeIssues(issues);
  if (summary.errors.length === 0) {
    printStatus(
      `${name} validate:env`,
      "ready",
      summary.warnings.length ? `warnings=${summary.warnings.length}` : ""
    );
    return summary;
  }

  printStatus(
    `${name} validate:env`,
    "blocked_by_environment",
    `${summary.errors.length} error(s) ${formatEnvKeys(summary.envKeys)}`.trim()
  );

  for (const issue of summary.errors) {
    printStatus(
      `${name} ${issue.key}`,
      `${issue.requirement}/${issue.phase}/${issue.category}`,
      issue.message
    );
  }

  return summary;
}

async function loadValidationData() {
  const [
    backendModule,
    frontendModule,
    metaModule,
    twilioModule,
  ] = await Promise.all([
    import("../ai-hq-backend/src/config/validate.js"),
    import("../ai-hq-frontend/src/env/validation.js"),
    import("../meta-bot-backend/src/config/validate.js"),
    import("../twilio-voice-backend/src/config/validate.js"),
  ]);

  return {
    backendIssues: backendModule.getConfigIssues(),
    frontendIssues: frontendModule.getFrontendEnvIssues(),
    metaIssues: metaModule.getConfigIssues(),
    twilioIssues: twilioModule.getConfigIssues(),
  };
}

export async function main() {
  const dockerAvailable = canUseDocker();
  const hasDatabaseUrl = Boolean(String(process.env.DATABASE_URL || "").trim());
  const {
    backendIssues,
    frontendIssues,
    metaIssues,
    twilioIssues,
  } = await loadValidationData();

  printSection("Validation Status");
  const backend = renderWorkspaceValidation("ai-hq-backend", backendIssues);
  const frontend = renderWorkspaceValidation("ai-hq-frontend", frontendIssues);
  const meta = renderWorkspaceValidation("meta-bot-backend", metaIssues);
  const twilio = renderWorkspaceValidation("twilio-voice-backend", twilioIssues);

  printSection("Verification Paths");
  printStatus(
    "shared-contracts",
    "fully_verifiable",
    "npm run test -w shared-contracts && npm run build -w shared-contracts"
  );
  printStatus("ai-hq-backend tests", "fully_verifiable", "npm run test -w ai-hq-backend");
  printStatus(
    "ai-hq-backend DB harness",
    hasDatabaseUrl || dockerAvailable ? "ready" : "external_infra_unavailable",
    hasDatabaseUrl
      ? "DATABASE_URL present -> npm run test:aihq:db"
      : dockerAvailable
        ? "Docker present -> npm run test:aihq:db"
        : "requires DATABASE_URL or Docker"
  );
  printStatus(
    "ai-hq-backend build",
    backend.errors.length === 0 ? "ready" : "blocked_by_environment",
    "npm run build -w ai-hq-backend"
  );
  printStatus(
    "meta-bot-backend build",
    meta.errors.length === 0 ? "ready" : "blocked_by_environment",
    "npm run build -w meta-bot-backend"
  );
  printStatus(
    "twilio-voice-backend build",
    twilio.errors.length === 0 ? "ready" : "blocked_by_environment",
    "npm run build -w twilio-voice-backend"
  );
  printStatus(
    "ai-hq-frontend build",
    frontend.errors.length === 0 ? "ready" : "blocked_by_environment",
    "npm run build -w ai-hq-frontend"
  );
  printStatus(
    "post-deploy verification",
    "requires_live_services",
    "AIHQ_BASE_URL required; AIHQ_INTERNAL_TOKEN required for /api/health; sidecar base URLs optional unless strict"
  );

  printSection("Container Runtime Parity");
  for (const workspace of getContainerRuntimeParity()) {
    printStatus(workspace.name, workspace.status, workspace.detail);
  }

  printSection("Classification");
  printStatus(
    "blocked_by_environment",
    "means",
    "required env is missing or invalid for that workspace"
  );
  printStatus(
    "external_infra_unavailable",
    "means",
    "the command needs Docker, Postgres, or a live deployed service"
  );
  printStatus(
    "fully_verifiable",
    "means",
    "the command is code-only under the current machine/env"
  );
  printStatus(
    "ready",
    "means",
    "the repo ships a Dockerfile that matches the current workspace startup contract"
  );
  printStatus(
    "drifted_from_workspace_contract",
    "means",
    "the Dockerfile exists but no longer matches the workspace loader/shared-contracts startup contract"
  );
  printStatus(
    "no_repo_docker_asset",
    "means",
    "the repo does not currently ship a Dockerfile for that service"
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
