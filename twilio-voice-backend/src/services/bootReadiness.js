function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

async function safeReadJson(resp) {
  const text = await resp.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function isProdLikeEnv(appEnv = "") {
  return !["", "development", "dev", "test"].includes(lower(appEnv));
}

function buildBootReadinessResult({
  ok = false,
  enforced = false,
  status = "unknown",
  reasonCode = "",
  blockerReasonCodes = [],
  blockersTotal = 0,
  intentionallyUnavailable = false,
  error = "",
  httpStatus = 0,
} = {}) {
  return {
    ok,
    enforced,
    status,
    reasonCode: s(reasonCode),
    blockerReasonCodes: arr(blockerReasonCodes).map((item) => s(item)).filter(Boolean),
    blockersTotal: Number(blockersTotal || 0),
    intentionallyUnavailable,
    error: s(error),
    dependency: "ai-hq",
    aihq: {
      httpStatus: Number(httpStatus || 0),
      reachable: Number(httpStatus || 0) > 0,
      readinessStatus:
        status === "ready"
          ? "ready"
          : status === "blocked"
          ? "blocked"
          : status === "skipped"
          ? "skipped"
          : "attention",
    },
    localDecision: {
      ready: ok && !intentionallyUnavailable,
      status,
      reasonCode: s(reasonCode),
      intentionallyUnavailable,
    },
  };
}

export async function checkAihqOperationalBootReadiness({
  fetchFn = globalThis.fetch?.bind(globalThis),
  baseUrl = "",
  internalToken = "",
  appEnv = "",
  requireOnBoot = false,
  throwOnBlocked = true,
} = {}) {
  const enforced = Boolean(requireOnBoot) && isProdLikeEnv(appEnv);

  if (!requireOnBoot) {
    return buildBootReadinessResult({
      ok: true,
      enforced: false,
      status: "skipped",
      reasonCode: "boot_readiness_check_disabled",
    });
  }

  if (!fetchFn) {
    throw new Error("fetch_unavailable_for_boot_readiness");
  }

  const root = s(baseUrl).replace(/\/+$/, "");
  if (!root) {
    throw new Error("aihq_base_url_missing_for_boot_readiness");
  }

  const resp = await fetchFn(`${root}/api/health`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(s(internalToken)
        ? { "x-internal-token": s(internalToken) }
        : {}),
    },
  });

  const json = await safeReadJson(resp);
  const readiness = isObject(json?.operationalReadiness)
    ? json.operationalReadiness
    : {};
  const blockersTotal = Number(readiness?.blockers?.total || 0);
  const blockerReasonCodes = arr(
    readiness?.blockerReasonCodes || readiness?.blocker_reason_codes
  );

  if (!resp.ok || json?.ok === false) {
    const result = buildBootReadinessResult({
      ok: false,
      enforced,
      status: enforced ? "blocked" : "attention",
      reasonCode: "aihq_health_unavailable",
      intentionallyUnavailable: enforced,
      error: s(json?.error || `aihq_health_failed_${Number(resp.status || 0)}`),
      httpStatus: Number(resp.status || 0),
    });

    if (throwOnBlocked && enforced) {
      throw new Error(result.error || result.reasonCode);
    }

    return result;
  }

  if (blockersTotal > 0) {
    const reasonCode = blockerReasonCodes[0] || "aihq_operational_readiness_blocked";
    const result = buildBootReadinessResult({
      ok: false,
      enforced,
      status: enforced ? "blocked" : "attention",
      reasonCode,
      blockerReasonCodes,
      blockersTotal,
      intentionallyUnavailable: enforced,
      httpStatus: Number(resp.status || 0),
    });

    if (throwOnBlocked && enforced) {
      throw new Error(
        `aihq_operational_readiness_blocked:${blockersTotal}:${result.blockerReasonCodes.join(",") || reasonCode}`
      );
    }

    return result;
  }

  return buildBootReadinessResult({
    ok: true,
    enforced,
    status: "ready",
    blockerReasonCodes,
    blockersTotal,
    httpStatus: Number(resp.status || 0),
  });
}
