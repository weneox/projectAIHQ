function normalizeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeList(values = []) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => normalizeText(value)).filter(Boolean);
}

export function createValidationIssue({
  level,
  key,
  message,
  category = "configuration",
  requirement = null,
  phase = "runtime",
  envKeys = [],
}) {
  const normalizedLevel = normalizeText(level, "error").toLowerCase();
  const normalizedKey = normalizeText(key, "unknown");
  const normalizedMessage = normalizeText(message, "Validation issue");
  const normalizedRequirement =
    normalizeText(requirement) ||
    (normalizedLevel === "error" ? "required" : "optional");

  return {
    level: normalizedLevel,
    key: normalizedKey,
    message: normalizedMessage,
    category: normalizeText(category, "configuration").toLowerCase(),
    requirement: normalizedRequirement.toLowerCase(),
    phase: normalizeText(phase, "runtime").toLowerCase(),
    envKeys: normalizeList(envKeys.length ? envKeys : inferEnvKeys(normalizedKey)),
  };
}

export function printValidationReport({
  workspace,
  issues = [],
  logger = console,
  okMessage = null,
}) {
  const errors = issues.filter((item) => item.level === "error");
  const warnings = issues.filter((item) => item.level === "warning");
  const normalizedWorkspace = normalizeText(workspace, "workspace");

  if (!issues.length) {
    logger.log(
      okMessage || `[validate:env] ${normalizedWorkspace} OK (no validation issues)`
    );
    return {
      ok: true,
      errors,
      warnings,
      issues,
    };
  }

  logger.log(
    `[validate:env] ${normalizedWorkspace} summary: ${errors.length} error(s), ${warnings.length} warning(s)`
  );

  for (const item of warnings) {
    logger.warn(formatIssueLine(normalizedWorkspace, item));
  }

  for (const item of errors) {
    logger.error(formatIssueLine(normalizedWorkspace, item));
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    issues,
  };
}

export function formatValidationFailure(workspace, report) {
  const normalizedWorkspace = normalizeText(workspace, "workspace");
  const errors = Array.isArray(report?.errors) ? report.errors : [];
  const summary = errors
    .map((item) => `${item.key}: ${item.message}`)
    .join("\n");

  return `[validate:env] ${normalizedWorkspace} failed with ${errors.length} error(s)\n${summary}`;
}

export function collectIssueEnvKeys(issues = []) {
  const keys = new Set();
  for (const issue of Array.isArray(issues) ? issues : []) {
    for (const envKey of normalizeList(issue?.envKeys)) {
      keys.add(envKey);
    }
  }
  return Array.from(keys);
}

function inferEnvKeys(key = "") {
  const normalized = normalizeText(key);
  if (/^[A-Z0-9_]+$/.test(normalized)) {
    return [normalized];
  }
  return [];
}

function formatIssueLine(workspace, item) {
  const envSuffix =
    Array.isArray(item?.envKeys) && item.envKeys.length
      ? ` env=${item.envKeys.join(",")}`
      : "";

  return `[validate:env][${workspace}][${item.level}][${item.requirement}][${item.phase}][${item.category}] ${item.key}: ${item.message}${envSuffix}`;
}
