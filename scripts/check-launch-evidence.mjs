import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VALID_STATUSES = new Set(["BLOCKED", "READY", "ACCEPTED_RISK"]);
const TARGET_BLOCK_FIELDS = {
  limited: "blocksLimitedLaunch",
  paid: "blocksPaidLaunch",
  public: "blocksPublicLaunch",
};
const REQUIRED_LAUNCH_EVIDENCE_ITEMS = {
  "P0-001-ENV": {
    item: "Deployed Meta bot service is explicitly classified as production/staging",
    requiredBlocks: [
      "blocksLimitedLaunch",
      "blocksPaidLaunch",
      "blocksPublicLaunch",
    ],
  },
  "P1-005": {
    item:
      "V1 data retention policy, dry-run/live cleanup evidence, and privacy exclusions are proven",
    requiredBlocks: [
      "blocksLimitedLaunch",
      "blocksPaidLaunch",
      "blocksPublicLaunch",
    ],
  },
  "P1-006": {
    item:
      "Production observability and alerting owner, contact, destination, and runbook are proven",
    requiredBlocks: [
      "blocksLimitedLaunch",
      "blocksPaidLaunch",
      "blocksPublicLaunch",
    ],
  },
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultEvidencePath = path.join(
  repoRoot,
  "docs",
  "launch",
  "production-launch-evidence.json"
);

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function describeItem(item) {
  return `${item?.id ?? "UNKNOWN"} ${item?.item ?? ""}`.trim();
}

export function validateLaunchEvidence(evidence, { target = "limited" } = {}) {
  const normalizedTarget = String(target || "limited").toLowerCase();
  const blockingField = TARGET_BLOCK_FIELDS[normalizedTarget];
  const errors = [];

  if (!blockingField) {
    return {
      ok: false,
      errors: [
        `Unknown launch evidence target "${target}". Expected one of: ${Object.keys(
          TARGET_BLOCK_FIELDS
        ).join(", ")}.`,
      ],
    };
  }

  if (!evidence || !Array.isArray(evidence.items)) {
    return {
      ok: false,
      errors: ["Launch evidence file must contain an items array."],
    };
  }

  const ids = new Set();
  const itemsById = new Map();

  for (const item of evidence.items) {
    const label = describeItem(item);

    for (const field of [
      "id",
      "item",
      "owner",
      "status",
      "evidence",
      "reasonMissing",
      "date",
      "approver",
      "blocksLimitedLaunch",
      "blocksPaidLaunch",
      "blocksPublicLaunch",
    ]) {
      if (!(field in item)) {
        errors.push(`${label} is missing required field "${field}".`);
      }
    }

    if (hasText(item.id)) {
      if (ids.has(item.id)) {
        errors.push(`Duplicate launch evidence id "${item.id}".`);
      }
      ids.add(item.id);
      itemsById.set(item.id, item);
    }

    if (!VALID_STATUSES.has(item.status)) {
      errors.push(`${label} has invalid status "${item.status}".`);
    }

    if (item.status === "READY" && !hasText(item.evidence)) {
      errors.push(`${label} is READY without an evidence link or local test reference.`);
    }

    if (item.status === "BLOCKED" && !hasText(item.reasonMissing)) {
      errors.push(`${label} is BLOCKED without a missing-evidence reason.`);
    }

    if (item.status === "ACCEPTED_RISK") {
      if (item.acceptedRiskAllowed !== true) {
        errors.push(`${label} marks ACCEPTED_RISK but acceptedRiskAllowed is not true.`);
      }
      if (!hasText(item.reasonMissing)) {
        errors.push(`${label} marks ACCEPTED_RISK without the accepted risk rationale.`);
      }
    }

    if (
      item[blockingField] === true &&
      item.status !== "READY" &&
      !(item.status === "ACCEPTED_RISK" && item.acceptedRiskAllowed === true)
    ) {
      errors.push(
        `${label} blocks ${normalizedTarget} launch and is still ${item.status}.`
      );
    }
  }

  for (const [id, requirement] of Object.entries(REQUIRED_LAUNCH_EVIDENCE_ITEMS)) {
    const item = itemsById.get(id);
    if (!item) {
      errors.push(
        `Missing required launch evidence item "${id}" (${requirement.item}).`
      );
      continue;
    }

    for (const field of requirement.requiredBlocks) {
      if (item[field] !== true) {
        errors.push(
          `${id} must set ${field}=true because ${requirement.item} is required before every launch target.`
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function runCli() {
  const target = process.argv[2] || process.env.LAUNCH_GATE_TARGET || "limited";
  const evidencePath = process.env.LAUNCH_EVIDENCE_FILE || defaultEvidencePath;
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  const result = validateLaunchEvidence(evidence, { target });

  if (result.ok) {
    console.log(`Launch evidence gate passed for target "${target}".`);
    return;
  }

  console.error(`Launch evidence gate failed for target "${target}":`);
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
