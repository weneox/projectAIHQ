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

function normalizeBaseUrl(value = "") {
  return s(value).replace(/\/+$/, "");
}

function deriveApiHealthUrl(baseUrl = "") {
  const root = normalizeBaseUrl(baseUrl);
  return root ? `${root}/api/health` : "";
}

function deriveHealthUrl(baseUrl = "") {
  const root = normalizeBaseUrl(baseUrl);
  return root ? `${root}/health` : "";
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

function summarizeReadiness(json = {}) {
  const readiness =
    json?.operationalReadiness ||
    json?.readiness ||
    json?.bootReadiness ||
    {};

  return {
    status: s(readiness.status || json?.status),
    reasonCode: s(readiness.reasonCode || json?.reasonCode),
    blockersTotal: Number(
      readiness?.blockers?.total ??
        readiness?.blockersTotal ??
        json?.operationalReadiness?.blockers?.total ??
        0
    ),
    blockerReasonCodes: Array.isArray(readiness?.blockerReasonCodes)
      ? readiness.blockerReasonCodes
      : [],
    intentionallyUnavailable:
      readiness?.intentionallyUnavailable === true ||
      json?.intentionallyUnavailable === true,
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
          "AIHQ_INTERNAL_TOKEN is required for /api/health post-deploy verification and the verifier fails closed when it is missing.",
      },
    });
  }

  return issues;
}

async function verifyAihq({ baseUrl, internalToken, timeoutMs }) {
  const rootHealthUrl = deriveHealthUrl(baseUrl);
  const apiHealthUrl = deriveApiHealthUrl(baseUrl);
  const headers = internalToken ? { "x-internal-token": internalToken } : {};
  const results = [];

  const root = await fetchJson(rootHealthUrl, headers, timeoutMs);
  const rootReadiness = summarizeReadiness(root.json || {});
  results.push({
    name: "aihq_root_health",
    ok:
      root.ok &&
      rootReadiness.intentionallyUnavailable !== true &&
      s(rootReadiness.status || "ready").toLowerCase() !== "blocked",
    status: root.status,
    details: {
      url: rootHealthUrl,
      readinessStatus: rootReadiness.status,
      reasonCode: rootReadiness.reasonCode,
      blockersTotal: rootReadiness.blockersTotal,
    },
  });

  const api = await fetchJson(apiHealthUrl, headers, timeoutMs);
  const apiReadiness = summarizeReadiness(api.json || {});
  results.push({
    name: "aihq_api_health",
    ok:
      api.ok &&
      apiReadiness.intentionallyUnavailable !== true &&
      s(apiReadiness.status || "ready").toLowerCase() !== "blocked",
    status: api.status,
    details: {
      url: apiHealthUrl,
      readinessStatus: apiReadiness.status,
      reasonCode: apiReadiness.reasonCode,
      blockersTotal: apiReadiness.blockersTotal,
    },
  });

  return results;
}

async function verifySidecar(name, baseUrl, timeoutMs) {
  const url = deriveHealthUrl(baseUrl);
  if (!url) {
    return {
      name,
      skipped: true,
      reason: `${name.toUpperCase()}_BASE_URL missing`,
    };
  }

  const result = await fetchJson(url, {}, timeoutMs);
  const readiness = summarizeReadiness(result.json || {});

  return {
    name,
    ok:
      result.ok &&
      readiness.intentionallyUnavailable !== true &&
      s(readiness.status || "ready").toLowerCase() !== "blocked",
    status: result.status,
    details: {
      url,
      readinessStatus: readiness.status,
      reasonCode: readiness.reasonCode,
      blockersTotal: readiness.blockersTotal,
    },
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
    printLine("FAIL", result.name, JSON.stringify(result.details || { status: result.status }));
  }

  return failed;
}

async function main() {
  const timeoutMs = Math.max(1000, Number(process.env.POSTDEPLOY_TIMEOUT_MS || 10000));
  const aihqBaseUrl = normalizeBaseUrl(process.env.AIHQ_BASE_URL);
  const internalToken = s(process.env.AIHQ_INTERNAL_TOKEN);
  const metaBaseUrl = normalizeBaseUrl(process.env.META_BOT_BASE_URL);
  const twilioBaseUrl = normalizeBaseUrl(process.env.TWILIO_VOICE_BASE_URL);
  const strictSidecars = bool(process.env.POSTDEPLOY_STRICT_SIDECARS, false);

  const results = [];
  results.push(...getRequiredEnvIssues({ aihqBaseUrl, internalToken }));

  if (results.length > 0) {
    printLine("#", "Post-deploy verification summary");
    const failed = renderSummary(results);
    printLine("!", "Verification failed", `failures=${failed}`);
    process.exit(1);
  }

  results.push(...(await verifyAihq({ baseUrl: aihqBaseUrl, internalToken, timeoutMs })));

  const meta = await verifySidecar("meta_bot_health", metaBaseUrl, timeoutMs);
  const twilio = await verifySidecar("twilio_voice_health", twilioBaseUrl, timeoutMs);

  if (!meta.skipped || strictSidecars) results.push(meta);
  if (!twilio.skipped || strictSidecars) results.push(twilio);

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
