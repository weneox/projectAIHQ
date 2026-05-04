import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildMissingWebsiteLaneTenantKeyResult,
  buildWebsiteLaneHeaders,
  buildWebsiteLaneHealthUrl,
  classifyWebsiteLaneHealth,
} from "./website-lane-verifier.mjs";
import {
  buildInternalServiceHeaders,
  buildLaunchPostureHeaders,
  buildLaunchPostureUrl,
  classifyLaunchPosture,
  resolveLaunchPostureInternalToken,
  resolveLaunchPostureSessionCookie,
  resolveLaunchPostureTenantKey,
} from "./launch-posture-verifier.mjs";

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

function pickFirst(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function normalizeSha(value = "") {
  return s(value).replace(/[^a-f0-9]/gi, "").toLowerCase();
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

function deriveAihqReadinessUrl(baseUrl = "") {
  const root = normalizeBaseUrl(baseUrl);
  const path = s(process.env.AIHQ_READINESS_PATH, "/readyz");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return root ? `${root}${normalizedPath}` : "";
}

function deriveRuntimeSignalsUrl(baseUrl = "") {
  const root = normalizeBaseUrl(baseUrl);
  return root ? `${root}/runtime-signals` : "";
}

function deriveBuildcheckUrls(baseUrl = "") {
  const root = normalizeBaseUrl(baseUrl);
  return root ? [`${root}/api/__buildcheck`, `${root}/__buildcheck`] : [];
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
      headers: Object.fromEntries(response.headers.entries()),
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

export function summarizeIncidents(json = {}) {
  const incidents = json?.incidents || json?.operational?.incidents || {};
  const active = incidents?.active || incidents?.current || {};
  return {
    status: s(
      incidents.activeStatus || active.status || incidents.status
    ).toLowerCase(),
    total: n(active.total ?? incidents.activeTotal ?? incidents.total),
    errorCount: n(
      active.errorCount ?? incidents.activeErrorCount ?? incidents.errorCount
    ),
    warnCount: n(
      active.warnCount ?? incidents.activeWarnCount ?? incidents.warnCount
    ),
    activeWindowStartedAt: s(
      incidents.activeWindowStartedAt ||
        incidents.windowStartedAt ||
        incidents.window?.startedAt
    ),
    historyStatus: s(incidents.history?.status || incidents.historicalStatus),
    historyErrorCount: n(
      incidents.history?.errorCount ?? incidents.historicalErrorCount
    ),
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

function resolveExpectedReleaseSha(env = process.env) {
  return normalizeSha(
    pickFirst(
      env.AIHQ_EXPECTED_RELEASE_SHA,
      env.EXPECTED_RELEASE_SHA,
      env.AIHQ_RELEASE_SHA,
      env.RELEASE_SHA,
      env.GITHUB_SHA
    )
  );
}

function releaseShaMatches(candidate = "", expected = "") {
  const actual = normalizeSha(candidate);
  const wanted = normalizeSha(expected);

  if (!actual || !wanted) return false;
  if (actual === wanted) return true;

  const minLength = Math.min(actual.length, wanted.length);
  if (minLength < 7) return false;

  return actual.startsWith(wanted) || wanted.startsWith(actual);
}

function extractBuildShaCandidates(response = {}) {
  const json = response.json || {};
  const build = json.build || {};

  return [
    build.fullSha,
    build.releaseSha,
    build.commitSha,
    build.gitSha,
    build.sha,
    json.fullSha,
    json.releaseSha,
    json.sha,
    response.headers?.["x-aihq-build-sha"],
  ]
    .map((value) => normalizeSha(value))
    .filter(Boolean);
}

function isExplicitNonProdReleaseGate(env = process.env) {
  if (bool(env.PROD_SPINE_NON_PROD, false)) return true;
  const mode = s(env.PROD_SPINE_ENV || env.APP_ENV || env.NODE_ENV).toLowerCase();
  return ["dev", "development", "test", "local", "nonprod", "non-production"].includes(
    mode
  );
}

export function resolveBackendReleaseShaRequirement(env = process.env) {
  const explicit = s(
    env.PROD_SPINE_REQUIRE_BACKEND_RELEASE_SHA ||
      env.PROD_SPINE_REQUIRE_RELEASE_SHA
  );

  if (isExplicitNonProdReleaseGate(env)) {
    return bool(explicit, false);
  }

  return true;
}

function renderSummary(results = []) {
  let failed = 0;

  for (const result of results) {
    if (result.skipped) {
      const details = result.details ? ` ${JSON.stringify(result.details)}` : "";
      printLine(
        result.warning ? "WARN" : "-",
        result.name,
        `skipped (${result.reason})${details}`
      );
      continue;
    }

    if (result.ok) {
      printLine(
        result.warning ? "WARN" : "OK",
        result.name,
        JSON.stringify(result.details)
      );
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

function getRequiredEnvIssues({
  aihqBaseUrl,
  internalToken,
  launchPostureInternalToken,
  expectedReleaseSha,
  requireBackendReleaseSha,
}) {
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

  if (!launchPostureInternalToken) {
    issues.push({
      name: "prod_spine_aihq_launch_posture_internal_token_meta_bot",
      ok: false,
      status: 0,
      details: {
        env: "AIHQ_INTERNAL_TOKEN_META_BOT",
        reasonCode: "missing_required_env",
        message:
          "AIHQ_INTERNAL_TOKEN_META_BOT is required so launch posture smoke uses the scoped Meta service identity instead of a broad internal token.",
      },
    });
  }

  if (requireBackendReleaseSha && !expectedReleaseSha) {
    issues.push({
      name: "prod_spine_expected_release_sha",
      ok: false,
      status: 0,
      details: {
        env: "AIHQ_EXPECTED_RELEASE_SHA",
        reasonCode: "missing_expected_release_sha",
        message:
          "AIHQ_EXPECTED_RELEASE_SHA is required when PROD_SPINE_REQUIRE_BACKEND_RELEASE_SHA=1.",
      },
    });
  }

  return issues;
}

export function classifyAihqReadiness(readiness = {}) {
  const blockerReasonCodes = uniqStrings(readiness.blockerReasonCodes || []);
  const fatalBlockerReasonCodes =
    Number(readiness.blockersTotal || 0) > 0 ? blockerReasonCodes : [];
  const effectiveBlockersTotal = Number(readiness.blockersTotal || 0);
  const effectiveStatus = s(readiness.status);

  return {
    blockerReasonCodes,
    fatalBlockerReasonCodes,
    tolerableOnly: false,
    effectiveBlockersTotal,
    effectiveStatus,
    productionBlockersEnforced: true,
  };
}

export function classifyIncidentAcceptance({
  incidents = {},
  readinessPolicy = {},
  dbOk = false,
  workers = {},
  status = "",
} = {}) {
  const activeIncidentDegraded =
    s(incidents.status).toLowerCase() === "degraded" ||
    Number(incidents.errorCount || 0) > 0;
  const activeIncidentAttention =
    s(incidents.status).toLowerCase() === "attention" ||
    Number(incidents.warnCount || 0) > 0;
  const workerReady =
    s(workers.status).toLowerCase() !== "unavailable" &&
    Number(workers.requiredUnavailableCount || 0) === 0;
  const readinessReady =
    s(status).toLowerCase() === "ready" &&
    Number(readinessPolicy.effectiveBlockersTotal || 0) === 0;
  const staleIncidentHistoryIgnored =
    !activeIncidentDegraded &&
    Number(incidents.historyErrorCount || 0) > 0 &&
    dbOk === true &&
    readinessReady &&
    workerReady;

  return {
    activeIncidentDegraded,
    activeIncidentAttention,
    staleIncidentHistoryIgnored,
    decision:
      activeIncidentDegraded || activeIncidentAttention
        ? "fail_active_incident"
        : "accept",
  };
}

export function isAihqDegradedForAcceptance({
  status = "",
  readinessPolicy = {},
  workers = {},
  incidents = {},
} = {}) {
  const degradedFromReadiness =
    s(status).toLowerCase() === "degraded";

  return (
    degradedFromReadiness ||
    s(workers.status).toLowerCase() === "degraded" ||
    s(incidents.status).toLowerCase() === "degraded"
  );
}

async function verifyAihqBuildIdentity({
  baseUrl,
  internalToken,
  expectedReleaseSha,
  requireBackendReleaseSha,
  timeoutMs,
}) {
  if (!expectedReleaseSha) {
    return [
      {
        name: "aihq_build_identity",
        ok: !requireBackendReleaseSha,
        skipped: !requireBackendReleaseSha,
        warning: !requireBackendReleaseSha,
        reason: requireBackendReleaseSha
          ? "AIHQ_EXPECTED_RELEASE_SHA missing"
          : "AIHQ_EXPECTED_RELEASE_SHA not configured",
        details: {
          requireBackendReleaseSha,
          reasonCode: requireBackendReleaseSha
            ? "missing_expected_release_sha"
            : "expected_release_sha_not_configured",
        },
      },
    ];
  }

  const headers = internalToken
    ? buildInternalServiceHeaders({
        internalToken,
        audience: "aihq-backend.diagnostics",
      })
    : {};
  let lastResponse = null;
  let lastUrl = "";

  for (const url of deriveBuildcheckUrls(baseUrl)) {
    const response = await fetchJson(url, headers, timeoutMs);
    lastResponse = response;
    lastUrl = url;

    if (!response.ok) continue;

    const candidates = extractBuildShaCandidates(response);
    const matched = candidates.some((candidate) =>
      releaseShaMatches(candidate, expectedReleaseSha)
    );
    const shaRequired = Boolean(requireBackendReleaseSha);
    const ok = shaRequired ? matched : true;
    const reasonCode = matched
      ? ""
      : shaRequired
        ? "release_sha_mismatch"
        : "backend_release_sha_not_required";

    return [
      {
        ...buildResult(
          "aihq_build_identity",
          ok,
          {
            url,
            service: s(response.json?.service),
            marker: s(response.json?.marker || response.json?.build?.marker),
            expectedSha: expectedReleaseSha,
            deployedSha: candidates[0] || "",
            candidateShas: candidates,
            requireBackendReleaseSha: shaRequired,
            reasonCode,
          },
          response.status
        ),
        warning: !shaRequired && !matched,
      },
    ];
  }

  return [
    {
      ...buildResult(
        "aihq_build_identity",
        !requireBackendReleaseSha,
        {
          url: lastUrl,
          status: lastResponse?.status || 0,
          expectedSha: expectedReleaseSha,
          requireBackendReleaseSha,
          reasonCode: requireBackendReleaseSha
            ? "buildcheck_unavailable"
            : "backend_release_sha_not_required",
          message: s(
            lastResponse?.json?.error ||
              lastResponse?.error ||
              "AI HQ buildcheck endpoint is unavailable or unauthorized."
          ),
        },
        lastResponse?.status || 0
      ),
      warning: !requireBackendReleaseSha,
    },
  ];
}

async function verifyAihq({ baseUrl, timeoutMs, failOnDegraded }) {
  const healthUrl = deriveAihqReadinessUrl(baseUrl);
  const health = await fetchJson(healthUrl, {}, timeoutMs);

  const readiness = summarizeReadiness(health.json || {});
  const workers = summarizeWorkerFleet(health.json || {});
  const incidents = summarizeIncidents(health.json || {});
  const dbOk = health.json?.db?.ok === true;
  const rawStatus = s(health.json?.status).toLowerCase();
  const readinessPolicy = classifyAihqReadiness(readiness);
  const status = s(readinessPolicy.effectiveStatus || rawStatus).toLowerCase();
  const incidentAcceptance = classifyIncidentAcceptance({
    incidents,
    readinessPolicy,
    dbOk,
    workers,
    status,
  });

  const degradedFromReadiness = status === "degraded";
  const degraded =
    isAihqDegradedForAcceptance({
      status,
      readinessPolicy,
      workers,
      incidents,
    }) ||
    incidentAcceptance.activeIncidentDegraded ||
    incidentAcceptance.activeIncidentAttention;

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
        productionBlockersEnforced: readinessPolicy.productionBlockersEnforced,
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
        incidentActiveWindowStartedAt: incidents.activeWindowStartedAt,
        incidentHistoryStatus: incidents.historyStatus,
        incidentHistoryErrorCount: incidents.historyErrorCount,
        activeIncidentDegraded: incidentAcceptance.activeIncidentDegraded,
        activeIncidentAttention: incidentAcceptance.activeIncidentAttention,
        staleIncidentHistoryIgnored:
          incidentAcceptance.staleIncidentHistoryIgnored,
        incidentAcceptanceDecision: incidentAcceptance.decision,
        failOnDegraded,
      },
      health.status
    ),
  ];
}

function buildSkippedSidecarResults(
  prefix = "",
  reason = "",
  strictSidecars = false
) {
  const envName = `${prefix.toUpperCase()}_BASE_URL`;

  if (strictSidecars) {
    return [
      buildResult(
        `${prefix}_required_env`,
        false,
        {
          env: envName,
          reasonCode: "missing_required_env",
          message: `${envName} is required when PROD_SPINE_STRICT_SIDECARS=1.`,
        }
      ),
    ];
  }

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

async function verifySidecar(
  prefix,
  baseUrl,
  timeoutMs,
  failOnDegraded,
  strictSidecars = false
) {
  const healthUrl = deriveHealthUrl(baseUrl);
  const runtimeSignalsUrl = deriveRuntimeSignalsUrl(baseUrl);

  if (!healthUrl) {
    return buildSkippedSidecarResults(
      prefix,
      `${prefix.toUpperCase()}_BASE_URL missing`,
      strictSidecars
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

async function verifyLaunchPosture({
  baseUrl,
  launchPostureInternalToken,
  sessionCookie,
  tenantKey,
  timeoutMs,
}) {
  const results = [];
  const internalUrl = buildLaunchPostureUrl(baseUrl, {
    internal: true,
    tenantKey,
  });
  const internalResponse = await fetchJson(
    internalUrl,
    buildLaunchPostureHeaders({
      internalToken: launchPostureInternalToken,
      internal: true,
    }),
    timeoutMs
  );

  if (!internalResponse.ok) {
    results.push(
      buildResult(
        "aihq_launch_posture",
        false,
        {
          url: internalUrl,
          routeMode: "internal",
          tenantKey: s(tenantKey),
          httpStatus: internalResponse.status,
          internalService: "meta-bot-backend",
          scopedInternalTokenConfigured: Boolean(s(launchPostureInternalToken)),
          reasonCode: s(
            internalResponse.json?.reasonCode ||
              internalResponse.json?.reason ||
              internalResponse.json?.error ||
              internalResponse.error ||
              "launch_posture_unavailable"
          ),
          message: s(
            internalResponse.json?.message ||
              internalResponse.json?.reason ||
              internalResponse.json?.error ||
              internalResponse.error ||
              "Internal launch posture endpoint is unavailable or unauthorized for smoke credentials."
          ),
        },
        internalResponse.status
      )
    );
  } else {
    const posture = classifyLaunchPosture(internalResponse.json || {});
    results.push(
      buildResult(
        "aihq_launch_posture",
        posture.ok,
        {
          url: internalUrl,
          routeMode: "internal",
          tenantKey: s(tenantKey),
          httpStatus: internalResponse.status,
          internalService: "meta-bot-backend",
          scopedInternalTokenConfigured: Boolean(s(launchPostureInternalToken)),
          ...posture.details,
        },
        internalResponse.status
      )
    );
  }

  if (!s(sessionCookie)) return results;

  const appUrl = buildLaunchPostureUrl(baseUrl, { internal: false });
  const appResponse = await fetchJson(
    appUrl,
    buildLaunchPostureHeaders({ sessionCookie, internal: false }),
    timeoutMs
  );

  if (!appResponse.ok) {
    results.push(
      buildResult(
        "aihq_launch_posture_app",
        false,
        {
          url: appUrl,
          routeMode: "app",
          httpStatus: appResponse.status,
          sessionCookieConfigured: true,
          reasonCode: s(
            appResponse.json?.reasonCode ||
              appResponse.json?.reason ||
              appResponse.json?.error ||
              appResponse.error ||
              "launch_posture_app_unavailable"
          ),
          message: s(
            appResponse.json?.message ||
              appResponse.json?.reason ||
              appResponse.json?.error ||
              appResponse.error ||
              "App launch posture endpoint is unavailable or unauthorized for smoke credentials."
          ),
        },
        appResponse.status
      )
    );
    return results;
  }

  const appPosture = classifyLaunchPosture(appResponse.json || {});
  results.push(
    buildResult(
      "aihq_launch_posture_app",
      appPosture.ok,
      {
        url: appUrl,
        routeMode: "app",
        httpStatus: appResponse.status,
        sessionCookieConfigured: true,
        ...appPosture.details,
      },
      appResponse.status
    )
  );

  return results;
}

async function verifyWebsiteLane({
  baseUrl,
  internalToken,
  tenantKey,
  domain,
  timeoutMs,
  requireWebsiteLane,
}) {
  if (!s(tenantKey)) {
    return [
      buildMissingWebsiteLaneTenantKeyResult({
        name: "website_lane_prod_spine",
        required: requireWebsiteLane,
        strictEnv: "PROD_SPINE_REQUIRE_WEBSITE_LANE",
      }),
    ];
  }

  const url = buildWebsiteLaneHealthUrl(baseUrl, {
    tenantKey,
    domain,
  });
  const response = await fetchJson(
    url,
    buildWebsiteLaneHeaders({ internalToken }),
    timeoutMs
  );

  if (!response.ok) {
    return [
      buildResult(
        "website_lane_prod_spine",
        false,
        {
          url,
          tenantKey: s(tenantKey),
          reasonCode: s(
            response.json?.reasonCode ||
              response.json?.reason ||
              response.json?.error ||
              response.error ||
              "website_lane_health_unavailable"
          ),
          message: s(
            response.json?.message ||
              response.json?.reason ||
              response.error ||
              "Website lane health endpoint is unavailable."
          ),
        },
        response.status
      ),
    ];
  }

  const lane = classifyWebsiteLaneHealth(response.json || {});

  return [
    buildResult(
      "website_lane_prod_spine",
      lane.tenantFound &&
        lane.channelConfigured &&
        lane.configurationReady &&
        lane.productionReady,
      {
        url,
        tenantKey: lane.tenantKey || s(tenantKey),
        tenantId: lane.tenantId,
        status: lane.status,
        channelConfigured: lane.channelConfigured,
        configurationReady: lane.configurationReady,
        widgetEnabled: lane.widgetEnabled,
        publicWidgetIdPresent: lane.publicWidgetIdPresent,
        publicWidgetId: lane.publicWidgetId,
        targetDomain: lane.targetDomain,
        domainVerificationState: lane.domainVerificationState,
        productionReady: lane.productionReady,
        testingOnly: lane.testingOnly,
        installSurfaceReady: lane.installSurfaceReady,
        developerHandoffReady: lane.handoffs.developer.ready,
        gtmHandoffReady: lane.handoffs.gtm.ready,
        wordpressHandoffReady: lane.handoffs.wordpress.ready,
        reasonCode: lane.reasonCode,
        message: lane.message,
        blockerReasonCodes: lane.blockerReasonCodes,
      },
      response.status
    ),
  ];
}

async function runAttempt({
  aihqBaseUrl,
  internalToken,
  launchPostureInternalToken,
  expectedReleaseSha,
  requireBackendReleaseSha,
  metaBaseUrl,
  twilioBaseUrl,
  websiteLaneTenantKey,
  websiteLaneDomain,
  launchPostureSessionCookie,
  launchPostureTenantKey,
  timeoutMs,
  strictSidecars,
  failOnDegraded,
  requireWebsiteLane,
}) {
  const results = [];

  results.push(
    ...(await verifyAihqBuildIdentity({
      baseUrl: aihqBaseUrl,
      internalToken,
      expectedReleaseSha,
      requireBackendReleaseSha,
      timeoutMs,
    }))
  );

  results.push(
    ...(await verifyAihq({
      baseUrl: aihqBaseUrl,
      timeoutMs,
      failOnDegraded,
    }))
  );
  results.push(
    ...(await verifyLaunchPosture({
      baseUrl: aihqBaseUrl,
      launchPostureInternalToken,
      sessionCookie: launchPostureSessionCookie,
      tenantKey: launchPostureTenantKey,
      timeoutMs,
    }))
  );
  if (requireWebsiteLane) {
    results.push(
      ...(await verifyWebsiteLane({
        baseUrl: aihqBaseUrl,
        internalToken,
        tenantKey: websiteLaneTenantKey,
        domain: websiteLaneDomain,
        timeoutMs,
        requireWebsiteLane,
      }))
    );
  } else {
    results.push({
      name: "website_lane_prod_spine",
      ok: true,
      skipped: true,
      warning: Boolean(websiteLaneTenantKey),
      reason: websiteLaneTenantKey
        ? "PROD_SPINE_REQUIRE_WEBSITE_LANE=0; tenant-specific Website lane launch gate skipped"
        : "PROD_SPINE_REQUIRE_WEBSITE_LANE=0; Website lane launch gate skipped",
      details: {
        requireWebsiteLane,
        tenantKeyConfigured: Boolean(websiteLaneTenantKey),
        domainConfigured: Boolean(websiteLaneDomain),
        reasonCode: "website_lane_not_required_for_deploy_gate",
      },
    });
  }

  const metaResults = await verifySidecar(
    "meta_bot",
    metaBaseUrl,
    timeoutMs,
    failOnDegraded,
    strictSidecars
  );
  const twilioResults = await verifySidecar(
    "twilio_voice",
    twilioBaseUrl,
    timeoutMs,
    failOnDegraded,
    strictSidecars
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
  const launchPostureInternalToken = resolveLaunchPostureInternalToken();
  const internalToken = s(launchPostureInternalToken || process.env.AIHQ_INTERNAL_TOKEN);
  const metaBaseUrl = normalizeBaseUrl(process.env.META_BOT_BASE_URL);
  const twilioBaseUrl = normalizeBaseUrl(process.env.TWILIO_VOICE_BASE_URL);
  const websiteLaneTenantKey = s(process.env.WEBSITE_LANE_TENANT_KEY);
  const websiteLaneDomain = s(process.env.WEBSITE_LANE_DOMAIN);
  const launchPostureSessionCookie = resolveLaunchPostureSessionCookie();
  const launchPostureTenantKey = resolveLaunchPostureTenantKey();
  const strictSidecars = bool(process.env.PROD_SPINE_STRICT_SIDECARS, false);
  const expectedReleaseSha = resolveExpectedReleaseSha();
  const requireBackendReleaseSha = resolveBackendReleaseShaRequirement();
  const requireWebsiteLane = bool(
    process.env.PROD_SPINE_REQUIRE_WEBSITE_LANE,
    false
  );
  const failOnDegraded = bool(process.env.PROD_SPINE_FAIL_ON_DEGRADED, true);

  printLine(
    "#",
    "Prod spine smoke mode",
    JSON.stringify({
      attempts,
      delayMs,
      timeoutMs,
      strictSidecars,
      expectedReleaseShaConfigured: Boolean(expectedReleaseSha),
      requireBackendReleaseSha,
      requireWebsiteLane,
      failOnDegraded,
      readinessPath: s(process.env.AIHQ_READINESS_PATH, "/readyz"),
      websiteLaneTenantKeyConfigured: Boolean(websiteLaneTenantKey),
      websiteLaneDomainConfigured: Boolean(websiteLaneDomain),
      launchPostureTenantKeyConfigured: Boolean(launchPostureTenantKey),
      launchPostureSessionCookieConfigured: Boolean(launchPostureSessionCookie),
    })
  );

  const envIssues = getRequiredEnvIssues({
    aihqBaseUrl,
    internalToken,
    launchPostureInternalToken,
    expectedReleaseSha,
    requireBackendReleaseSha,
  });
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
      internalToken,
      launchPostureInternalToken,
      expectedReleaseSha,
      requireBackendReleaseSha,
      metaBaseUrl,
      twilioBaseUrl,
      websiteLaneTenantKey,
      websiteLaneDomain,
      launchPostureSessionCookie,
      launchPostureTenantKey,
      timeoutMs,
      strictSidecars,
      failOnDegraded,
      requireWebsiteLane,
    });

    lastFailed = renderSummary(lastResults);
    const warnings = lastResults.filter((result) => result.warning).length;

    if (lastFailed === 0) {
      printLine(
        "OK",
        "Prod spine smoke passed",
        warnings ? `warnings=${warnings}` : ""
      );
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

function isDirectRun(metaUrl = "") {
  return (
    Boolean(process.argv[1]) &&
    pathToFileURL(path.resolve(process.argv[1])).href === metaUrl
  );
}

if (isDirectRun(import.meta.url)) {
  main().catch((error) => {
    printLine("FAIL", "prod_spine_smoke", s(error?.message || error));
    process.exit(1);
  });
}
