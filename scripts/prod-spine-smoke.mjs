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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(value = "") {
  return s(value).replace(/\/+$/, "");
}

function deriveHealthUrl(baseUrl = "") {
  const root = normalizeBaseUrl(baseUrl);
  return root ? `${root}/health` : "";
}

function deriveRuntimeSignalsUrl(baseUrl = "") {
  const root = normalizeBaseUrl(baseUrl);
  return root ? `${root}/runtime-signals` : "";
}

async function readJson(response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 1200) };
  }
}

async function fetchJson(url, headers = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    const json = await readJson(response);
    return {
      ok: response.ok,
      status: response.status,
      json,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      json: null,
      error:
        error?.name === "AbortError"
          ? "request_timeout"
          : s(error?.message || error || "request_failed"),
    };
  } finally {
    clearTimeout(timer);
  }
}

function printLine(prefix, message, details = "") {
  const suffix = details ? ` ${details}` : "";
  console.log(`${prefix} ${message}${suffix}`);
}

function uniqStrings(values = []) {
  return [...new Set(values.map((item) => s(item).toLowerCase()).filter(Boolean))];
}

const TOLERABLE_AIHQ_READINESS_BLOCKER_CODES = new Set([
  "projection_missing",
  "runtime_projection_missing",
  "projection_stale",
  "runtime_projection_stale",
  "truth_version_drift",
  "authority_invalid",
  "runtime_authority_unavailable",
  "projection_build_failed",
  "repair_pending",
  "source_dependency_failed",
  "approval_required",
  "approved_truth_unavailable",
  "approved_truth_empty",
  "review_required",
]);

function summarizeReadiness(json = {}) {
  const readiness =
    json?.operationalReadiness ||
    json?.readiness ||
    json?.bootReadiness ||
    {};

  const blockerReasonCodes = Array.isArray(readiness?.blockerReasonCodes)
    ? uniqStrings(readiness.blockerReasonCodes)
    : [];

  return {
    status: s(readiness.status || json?.status).toLowerCase(),
    reasonCode: s(readiness.reasonCode || json?.reasonCode).toLowerCase(),
    blockersTotal: n(
      readiness?.blockers?.total ??
        readiness?.blockersTotal ??
        json?.operationalReadiness?.blockers?.total
    ),
    blockerReasonCodes,
    intentionallyUnavailable:
      readiness?.intentionallyUnavailable === true ||
      json?.intentionallyUnavailable === true,
  };
}

function summarizeWorkerFleet(json = {}) {
  const summary = json?.workers?.summary || json?.workerSummary || {};
  return {
    status: s(summary.status || json?.workers?.status).toLowerCase(),
    unavailableCount: n(
      summary.unavailableCount ??
        summary.unavailable ??
        summary.requiredUnavailableCount
    ),
    degradedCount: n(summary.degradedCount ?? summary.degraded),
    requiredUnavailableCount: n(
      summary.requiredUnavailableCount ??
        summary.unavailableCount ??
        summary.requiredMissingCount
    ),
  };
}

function summarizeIncidents(json = {}) {
  const incidents = json?.incidents || json?.operational?.incidents || {};
  return {
    status: s(incidents.status).toLowerCase(),
    total: n(incidents.total),
    errorCount: n(incidents.errorCount),
    warnCount: n(incidents.warnCount),
  };
}

function buildResult(name, ok, details = {}, status = 0) {
  return {
    name,
    ok,
    status,
    details,
  };
}

function renderSummary(results = []) {
  let failed = 0;

  for (const result of results) {
    if (result.skipped) {
      printLine("-", result.name, `skipped (${result.reason})`);
      continue;
    }

    if (result.ok) {
      printLine("OK", result.name, JSON.stringify(result.details));
      continue;
    }

    failed += 1;
    printLine(
      "FAIL",
      result.name,
      JSON.stringify(result.details || { status: result.status })
    );
  }

  return failed;
}

function getRequiredEnvIssues({ aihqBaseUrl, internalToken }) {
  const issues = [];

  if (!aihqBaseUrl) {
    issues.push({
      name: "prod_spine_aihq_base_url",
      ok: false,
      status: 0,
      details: {
        env: "AIHQ_BASE_URL",
        reasonCode: "missing_required_env",
        message:
          "AIHQ_BASE_URL is required for prod spine smoke and this command fails closed when it is missing.",
      },
    });
  }

  if (!internalToken) {
    issues.push({
      name: "prod_spine_aihq_internal_token",
      ok: false,
      status: 0,
      details: {
        env: "AIHQ_INTERNAL_TOKEN",
        reasonCode: "missing_required_env",
        message:
          "AIHQ_INTERNAL_TOKEN is required by the current release workflow configuration.",
      },
    });
  }

  return issues;
}

function classifyAihqReadiness(readiness = {}) {
  const blockerReasonCodes = uniqStrings(readiness.blockerReasonCodes || []);
  const fatalBlockerReasonCodes = blockerReasonCodes.filter(
    (code) => !TOLERABLE_AIHQ_READINESS_BLOCKER_CODES.has(code)
  );

  const tolerableOnly =
    Number(readiness.blockersTotal || 0) > 0 &&
    blockerReasonCodes.length > 0 &&
    fatalBlockerReasonCodes.length === 0;

  const effectiveBlockersTotal = tolerableOnly
    ? 0
    : Number(readiness.blockersTotal || 0);

  const effectiveStatus =
    tolerableOnly &&
    ["blocked", "unavailable"].includes(s(readiness.status).toLowerCase())
      ? "degraded"
      : s(readiness.status);

  return {
    blockerReasonCodes,
    fatalBlockerReasonCodes,
    tolerableOnly,
    effectiveBlockersTotal,
    effectiveStatus,
  };
}

async function verifyAihq({ baseUrl, timeoutMs, failOnDegraded }) {
  const healthUrl = deriveHealthUrl(baseUrl);
  const health = await fetchJson(healthUrl, {}, timeoutMs);

  const readiness = summarizeReadiness(health.json || {});
  const workers = summarizeWorkerFleet(health.json || {});
  const incidents = summarizeIncidents(health.json || {});
  const dbOk = health.json?.db?.ok === true;
  const rawStatus = s(health.json?.status).toLowerCase();
  const readinessPolicy = classifyAihqReadiness(readiness);
  const status = s(readinessPolicy.effectiveStatus || rawStatus).toLowerCase();

  const degradedFromReadiness =
    status === "degraded" && !readinessPolicy.tolerableOnly;

  const degraded =
    degradedFromReadiness ||
    workers.status === "degraded" ||
    incidents.status === "degraded";

  return [
    buildResult(
      "aihq_health",
      health.ok &&
        readiness.intentionallyUnavailable !== true &&
        status !== "blocked" &&
        status !== "unavailable",
      {
        url: healthUrl,
        status,
        rawStatus,
        readinessStatus: readiness.status,
        effectiveReadinessStatus: readinessPolicy.effectiveStatus,
        reasonCode: readiness.reasonCode,
        blockersTotal: readiness.blockersTotal,
        effectiveBlockersTotal: readinessPolicy.effectiveBlockersTotal,
        blockerReasonCodes: readinessPolicy.blockerReasonCodes,
        fatalBlockerReasonCodes: readinessPolicy.fatalBlockerReasonCodes,
        tolerableReadinessOnly: readinessPolicy.tolerableOnly,
        degradedFromReadiness,
        dbOk,
      },
      health.status
    ),
    buildResult(
      "aihq_worker_fleet_ready",
      health.ok &&
        workers.status !== "unavailable" &&
        workers.requiredUnavailableCount === 0,
      {
        workerStatus: workers.status,
        unavailableCount: workers.unavailableCount,
        degradedCount: workers.degradedCount,
        requiredUnavailableCount: workers.requiredUnavailableCount,
      },
      health.status
    ),
    buildResult(
      "aihq_prod_spine_acceptance",
      health.ok &&
        dbOk &&
        readiness.intentionallyUnavailable !== true &&
        readinessPolicy.effectiveBlockersTotal === 0 &&
        status !== "unavailable" &&
        workers.status !== "unavailable" &&
        workers.requiredUnavailableCount === 0 &&
        (!failOnDegraded || !degraded),
      {
        status,
        rawStatus,
        dbOk,
        blockersTotal: readiness.blockersTotal,
        effectiveBlockersTotal: readinessPolicy.effectiveBlockersTotal,
        blockerReasonCodes: readinessPolicy.blockerReasonCodes,
        fatalBlockerReasonCodes: readinessPolicy.fatalBlockerReasonCodes,
        tolerableReadinessOnly: readinessPolicy.tolerableOnly,
        degradedFromReadiness,
        workerStatus: workers.status,
        requiredUnavailableCount: workers.requiredUnavailableCount,
        incidentStatus: incidents.status,
        incidentErrorCount: incidents.errorCount,
        failOnDegraded,
      },
      health.status
    ),
  ];
}

function buildSkippedSidecarResults(prefix = "", reason = "") {
  return [
    {
      name: `${prefix}_health`,
      skipped: true,
      reason,
    },
    {
      name: `${prefix}_runtime_signals`,
      skipped: true,
      reason,
    },
    {
      name: `${prefix}_prod_spine_acceptance`,
      skipped: true,
      reason,
    },
  ];
}

async function verifySidecar(prefix, baseUrl, timeoutMs, failOnDegraded) {
  const healthUrl = deriveHealthUrl(baseUrl);
  const runtimeSignalsUrl = deriveRuntimeSignalsUrl(baseUrl);

  if (!healthUrl) {
    return buildSkippedSidecarResults(
      prefix,
      `${prefix.toUpperCase()}_BASE_URL missing`
    );
  }

  const health = await fetchJson(healthUrl, {}, timeoutMs);
  const runtimeSignals = await fetchJson(runtimeSignalsUrl, {}, timeoutMs);

  const healthReadiness = summarizeReadiness(health.json || {});
  const runtimeReadiness = summarizeReadiness(runtimeSignals.json || {});
  const degraded =
    healthReadiness.status === "degraded" ||
    runtimeReadiness.status === "degraded";

  return [
    buildResult(
      `${prefix}_health`,
      health.ok &&
        healthReadiness.intentionallyUnavailable !== true &&
        healthReadiness.status !== "blocked" &&
        healthReadiness.status !== "unavailable",
      {
        url: healthUrl,
        readinessStatus: healthReadiness.status,
        reasonCode: healthReadiness.reasonCode,
        blockersTotal: healthReadiness.blockersTotal,
      },
      health.status
    ),
    buildResult(
      `${prefix}_runtime_signals`,
      runtimeSignals.ok &&
        runtimeReadiness.intentionallyUnavailable !== true &&
        runtimeReadiness.status !== "blocked" &&
        runtimeReadiness.status !== "unavailable",
      {
        url: runtimeSignalsUrl,
        readinessStatus: runtimeReadiness.status,
        reasonCode: runtimeReadiness.reasonCode,
        blockersTotal: runtimeReadiness.blockersTotal,
        blockerReasonCodes: runtimeReadiness.blockerReasonCodes,
      },
      runtimeSignals.status
    ),
    buildResult(
      `${prefix}_prod_spine_acceptance`,
      health.ok &&
        runtimeSignals.ok &&
        healthReadiness.intentionallyUnavailable !== true &&
        runtimeReadiness.intentionallyUnavailable !== true &&
        healthReadiness.blockersTotal === 0 &&
        runtimeReadiness.blockersTotal === 0 &&
        (!failOnDegraded || !degraded),
      {
        healthStatus: healthReadiness.status,
        runtimeSignalsStatus: runtimeReadiness.status,
        blockersTotal: Math.max(
          healthReadiness.blockersTotal,
          runtimeReadiness.blockersTotal
        ),
        blockerReasonCodes: [
          ...healthReadiness.blockerReasonCodes,
          ...runtimeReadiness.blockerReasonCodes,
        ].filter(Boolean),
        failOnDegraded,
      },
      Math.max(health.status, runtimeSignals.status)
    ),
  ];
}

async function runAttempt({
  aihqBaseUrl,
  metaBaseUrl,
  twilioBaseUrl,
  timeoutMs,
  strictSidecars,
  failOnDegraded,
}) {
  const results = [];

  results.push(
    ...(await verifyAihq({
      baseUrl: aihqBaseUrl,
      timeoutMs,
      failOnDegraded,
    }))
  );

  const metaResults = await verifySidecar(
    "meta_bot",
    metaBaseUrl,
    timeoutMs,
    failOnDegraded
  );
  const twilioResults = await verifySidecar(
    "twilio_voice",
    twilioBaseUrl,
    timeoutMs,
    failOnDegraded
  );

  if (metaBaseUrl || strictSidecars) {
    results.push(...metaResults);
  }

  if (twilioBaseUrl || strictSidecars) {
    results.push(...twilioResults);
  }

  return results;
}

async function main() {
  const timeoutMs = Math.max(1000, n(process.env.PROD_SPINE_TIMEOUT_MS, 12000));
  const attempts = Math.max(1, n(process.env.PROD_SPINE_SMOKE_ATTEMPTS, 1));
  const delayMs = Math.max(0, n(process.env.PROD_SPINE_SMOKE_DELAY_MS, 15000));
  const aihqBaseUrl = normalizeBaseUrl(process.env.AIHQ_BASE_URL);
  const internalToken = s(process.env.AIHQ_INTERNAL_TOKEN);
  const metaBaseUrl = normalizeBaseUrl(process.env.META_BOT_BASE_URL);
  const twilioBaseUrl = normalizeBaseUrl(process.env.TWILIO_VOICE_BASE_URL);
  const strictSidecars = bool(process.env.PROD_SPINE_STRICT_SIDECARS, false);
  const failOnDegraded = bool(process.env.PROD_SPINE_FAIL_ON_DEGRADED, true);

  printLine(
    "#",
    "Prod spine smoke mode",
    JSON.stringify({
      attempts,
      delayMs,
      timeoutMs,
      strictSidecars,
      failOnDegraded,
    })
  );

  const envIssues = getRequiredEnvIssues({ aihqBaseUrl, internalToken });
  if (envIssues.length > 0) {
    printLine("#", "Prod spine smoke summary");
    const failed = renderSummary(envIssues);
    printLine("!", "Prod spine smoke failed", `failures=${failed}`);
    process.exit(1);
  }

  let lastResults = [];
  let lastFailed = 0;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    printLine(
      "#",
      "Prod spine smoke attempt",
      JSON.stringify({ attempt, attempts, timeoutMs, failOnDegraded })
    );

    lastResults = await runAttempt({
      aihqBaseUrl,
      metaBaseUrl,
      twilioBaseUrl,
      timeoutMs,
      strictSidecars,
      failOnDegraded,
    });

    lastFailed = renderSummary(lastResults);

    if (lastFailed === 0) {
      printLine("OK", "Prod spine smoke passed");
      process.exit(0);
    }

    if (attempt < attempts) {
      printLine(
        "!",
        "Prod spine smoke retry scheduled",
        JSON.stringify({ failed: lastFailed, nextAttemptInMs: delayMs })
      );
      await sleep(delayMs);
    }
  }

  printLine("#", "Final prod spine smoke summary");
  renderSummary(lastResults);
  printLine("!", "Prod spine smoke failed", `failures=${lastFailed}`);
  process.exit(1);
}

main().catch((error) => {
  printLine("FAIL", "prod_spine_smoke", s(error?.message || error));
  process.exit(1);
});