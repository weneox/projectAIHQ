import { fileURLToPath } from "node:url";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function bool(value, fallback = false) {
  const normalized = s(value).toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function printLine(prefix, message, details = "") {
  const suffix = details ? ` ${details}` : "";
  console.log(`${prefix} ${message}${suffix}`);
}

function isProductionLikeEnv() {
  const envText = [
    process.env.MIGRATION_SAFETY_MODE,
    process.env.APP_ENV,
    process.env.NODE_ENV,
    process.env.RAILWAY_ENVIRONMENT_NAME,
    process.env.RAILWAY_ENVIRONMENT,
  ]
    .map((value) => s(value).toLowerCase())
    .filter(Boolean)
    .join(" ");

  return (
    bool(process.env.MIGRATION_SAFETY_STRICT, false) ||
    /\bproduction\b|\bprod\b/.test(envText)
  );
}

function parseIsoDateTime(value = "") {
  const raw = s(value);
  const isoLike = /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const parsedMs = Date.parse(raw);

  if (!raw || !isoLike || !Number.isFinite(parsedMs)) {
    return {
      ok: false,
      raw,
      reasonCode: raw ? "invalid_iso_timestamp" : "missing_timestamp",
    };
  }

  return {
    ok: true,
    raw,
    date: new Date(parsedMs),
    ms: parsedMs,
  };
}

function validateTimestampFreshness({
  name,
  envName,
  value,
  maxAgeMs,
  nowMs,
}) {
  const parsed = parseIsoDateTime(value);

  if (!parsed.ok) {
    return {
      name,
      ok: false,
      details: {
        env: envName,
        valueConfigured: Boolean(parsed.raw),
        reasonCode: parsed.reasonCode,
        message: `${envName} must be an ISO date/time with timezone, for example 2026-04-30T08:15:00Z.`,
      },
    };
  }

  const futureSkewMs = 5 * 60 * 1000;
  const ageMs = nowMs - parsed.ms;

  if (ageMs < -futureSkewMs) {
    return {
      name,
      ok: false,
      details: {
        env: envName,
        value: parsed.raw,
        reasonCode: "timestamp_in_future",
        message: `${envName} is more than five minutes in the future.`,
      },
    };
  }

  if (ageMs > maxAgeMs) {
    return {
      name,
      ok: false,
      details: {
        env: envName,
        value: parsed.raw,
        ageHours: Math.round((ageMs / 36e5) * 10) / 10,
        maxAgeHours: Math.round((maxAgeMs / 36e5) * 10) / 10,
        reasonCode: "timestamp_stale",
        message: `${envName} is stale for a production migration preflight.`,
      },
    };
  }

  return {
    name,
    ok: true,
    details: {
      env: envName,
      value: parsed.raw,
      ageHours: Math.max(0, Math.round((ageMs / 36e5) * 10) / 10),
    },
  };
}

export function buildMigrationSafetyPreflightResult() {
  const strict = isProductionLikeEnv();
  const maxBackupAgeHours = Math.max(
    1,
    n(process.env.MIGRATION_SAFETY_MAX_BACKUP_AGE_HOURS, 24)
  );
  const maxRestoreDrillAgeDays = Math.max(
    1,
    n(process.env.MIGRATION_SAFETY_MAX_RESTORE_DRILL_AGE_DAYS, 30)
  );
  const expectedAck = "backup-and-restore-verified";
  const ack = s(process.env.MIGRATION_SAFETY_ACK);
  const nowMs = Date.now();

  if (!strict) {
    return {
      strict,
      ok: true,
      checks: [
        {
          name: "migration_safety_mode",
          skipped: true,
          reason: "not production-like",
          details: {
            message:
              "Migration backup/restore evidence is required only for production-like migration runs.",
          },
        },
      ],
    };
  }

  const checks = [
    {
      name: "migration_safety_ack",
      ok: ack === expectedAck,
      details: {
        env: "MIGRATION_SAFETY_ACK",
        expected: expectedAck,
        configured: Boolean(ack),
        reasonCode: ack === expectedAck ? "" : "missing_or_invalid_ack",
        message:
          ack === expectedAck
            ? "Operator explicitly acknowledged backup and restore readiness."
            : `Set MIGRATION_SAFETY_ACK=${expectedAck} after verifying backup and restore readiness.`,
      },
    },
    validateTimestampFreshness({
      name: "db_backup_verified_at",
      envName: "DB_BACKUP_VERIFIED_AT",
      value: process.env.DB_BACKUP_VERIFIED_AT,
      maxAgeMs: maxBackupAgeHours * 60 * 60 * 1000,
      nowMs,
    }),
    validateTimestampFreshness({
      name: "db_restore_drill_verified_at",
      envName: "DB_RESTORE_DRILL_VERIFIED_AT",
      value: process.env.DB_RESTORE_DRILL_VERIFIED_AT,
      maxAgeMs: maxRestoreDrillAgeDays * 24 * 60 * 60 * 1000,
      nowMs,
    }),
  ];

  return {
    strict,
    ok: checks.every((check) => check.ok),
    checks,
    thresholds: {
      maxBackupAgeHours,
      maxRestoreDrillAgeDays,
    },
  };
}

export function renderMigrationSafetyPreflight(result) {
  for (const check of result.checks || []) {
    if (check.skipped) {
      printLine(
        "WARN",
        check.name,
        `skipped (${check.reason}) ${JSON.stringify(check.details || {})}`
      );
      continue;
    }

    printLine(check.ok ? "OK" : "FAIL", check.name, JSON.stringify(check.details));
  }
}

export function assertMigrationSafetyPreflight({ quiet = false } = {}) {
  const result = buildMigrationSafetyPreflightResult();

  if (!quiet) {
    printLine(
      "#",
      "Migration safety preflight",
      JSON.stringify({
        strict: result.strict,
        thresholds: result.thresholds || {},
      })
    );
    renderMigrationSafetyPreflight(result);
  }

  if (!result.ok) {
    throw new Error(
      "Production migration safety preflight failed. Verify backup and restore readiness before running migrations."
    );
  }

  return result;
}

async function main() {
  assertMigrationSafetyPreflight();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    printLine("FAIL", "migration_safety_preflight", s(error?.message || error));
    process.exit(1);
  });
}
