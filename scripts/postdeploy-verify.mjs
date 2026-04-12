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
    return {
      raw: text.slice(0, 800),
    };
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
    status: s(readiness.status || json?.status),
    reasonCode: s(readiness.reasonCode || json?.reasonCode),
    blockersTotal: Number(
      readiness?.blockers?.total ??
        readiness?.blockersTotal ??
        json?.operationalReadiness?.blockers?.total ??
        0
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
    status: s(summary.status || json?.workers?.status),
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
    status: s(incidents.status),
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

function getRequiredEnvIssues({ aihqBaseUrl, internalToken }) {
  const issues = [];

  if (!aihqBaseUrl) {
    issues.push({
      name: "aihq_base_url",
      ok: false,
      status: 0,
      details: {
        env: "AIHQ_BASE_URL",
        reasonCode: "missing_required_env",
        message:
          "AIHQ_BASE_URL is required for post-deploy verification and the verifier fails closed when it is missing.",
      },
    });
  }

  if (!internalToken) {
    issues.push({
      name: "aihq_internal_token",
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
      "aihq_worker_fleet",
      health.ok &&
        workers.status !== "unavailable" &&
        workers.requiredUnavailableCount === 0,
      {
        status: workers.status,
        unavailableCount: workers.unavailableCount,
        degradedCount: workers.degradedCount,
        requiredUnavailableCount: workers.requiredUnavailableCount,
      },
      health.status
    ),
    buildResult(
      "aihq_product_spine",
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
      name: `${prefix}_product_spine`,
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
    s(healthReadiness.status).toLowerCase() === "degraded" ||
    s(runtimeReadiness.status).toLowerCase() === "degraded";

  return [
    buildResult(
      `${prefix}_health`,
      health.ok &&
        healthReadiness.intentionallyUnavailable !== true &&
        s(healthReadiness.status || "ready").toLowerCase() !== "blocked",
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
        s(runtimeReadiness.status || "ready").toLowerCase() !== "blocked",
      {
        url: runtimeSignalsUrl,
        readinessStatus: runtimeReadiness.status,
        reasonCode: runtimeReadiness.reasonCode,
        blockersTotal: runtimeReadiness.blockersTotal,
      },
      runtimeSignals.status
    ),
    buildResult(
      `${prefix}_product_spine`,
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

async function main() {
  const timeoutMs = Math.max(
    1000,
    Number(process.env.POSTDEPLOY_TIMEOUT_MS || 10000)
  );
  const aihqBaseUrl = normalizeBaseUrl(process.env.AIHQ_BASE_URL);
  const internalToken = s(process.env.AIHQ_INTERNAL_TOKEN);
  const metaBaseUrl = normalizeBaseUrl(process.env.META_BOT_BASE_URL);
  const twilioBaseUrl = normalizeBaseUrl(process.env.TWILIO_VOICE_BASE_URL);
  const strictSidecars = bool(process.env.POSTDEPLOY_STRICT_SIDECARS, false);
  const failOnDegraded = bool(
    process.env.POSTDEPLOY_FAIL_ON_DEGRADED,
    true
  );

  printLine(
    "#",
    "Post-deploy verification mode",
    JSON.stringify({
      timeoutMs,
      strictSidecars,
      failOnDegraded,
    })
  );

  const results = [];
  results.push(...getRequiredEnvIssues({ aihqBaseUrl, internalToken }));

  if (results.length > 0) {
    printLine("#", "Post-deploy verification summary");
    const failed = renderSummary(results);
    printLine("!", "Verification failed", `failures=${failed}`);
    process.exit(1);
  }

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

  printLine("#", "Post-deploy verification summary");
  const failed = renderSummary(results);

  if (failed > 0) {
    printLine("!", "Verification failed", `failures=${failed}`);
    process.exit(1);
  }

  printLine("OK", "Verification passed");
}

main().catch((error) => {
  printLine("FAIL", "postdeploy_verifier", s(error?.message || error));
  process.exit(1);
});