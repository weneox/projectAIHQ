import {
  buildQuotaEnvelope,
  getEndpointUsageProfile,
  getUsageLimitForMetric,
  normalizeCommercialPlanKey,
} from "./commercialPlans.js";
import {
  getTenantUsageSnapshot,
  recordTenantUsage,
  reserveTenantUsageQuota,
  commitTenantUsageReservation,
  releaseTenantUsageReservation,
} from "../db/helpers/tenantUsage.js";
import {
  recordHttpRequestMetric,
  recordQuotaRejection,
} from "../observability/runtimeSignals.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function metricValue(snapshot = {}, metric = "") {
  return n(snapshot?.[lower(metric)], 0);
}

function reservedMetricColumn(metric = "") {
  const name = lower(metric);
  if (name === "api_calls") return "reserved_api_calls";
  if (name === "ai_units") return "reserved_ai_units";
  if (name === "messages_in") return "reserved_messages_in";
  if (name === "messages_out") return "reserved_messages_out";
  if (name === "webhook_events") return "reserved_webhook_events";
  return "";
}

function metricReservedValue(snapshot = {}, metric = "") {
  const column = reservedMetricColumn(metric);
  return column ? n(snapshot?.[column], 0) : 0;
}

function setQuotaHeaders(res, envelope = {}) {
  if (!res?.setHeader) return;
  res.setHeader("X-Quota-Plan", s(envelope.plan));
  res.setHeader("X-Quota-Metric", s(envelope.metric));
  res.setHeader("X-Quota-Limit", String(envelope.limit ?? ""));
  res.setHeader("X-Quota-Remaining", String(envelope.remaining ?? ""));
  res.setHeader("X-Quota-Reset", s(envelope.resetAt));
  if (envelope.softLimitReached) {
    res.setHeader("X-Quota-Warning", "soft_limit_reached");
  }
}

export async function enforceTenantQuota({ db, req, res, profile = null } = {}) {
  const tenantId = s(req?.auth?.tenantId || req?.tenantId);
  const tenantKey = lower(req?.auth?.tenantKey || req?.tenantKey);
  if (!db) {
    return {
      ok: false,
      status: 503,
      code: "tenant_quota_unavailable",
      error: "Tenant quota could not be validated",
      reason: "quota_store_missing",
    };
  }
  if (!tenantId || !tenantKey) {
    return {
      ok: false,
      status: 403,
      code: "tenant_quota_tenant_required",
      error: "Tenant quota requires tenant context",
      reason: "tenant_context_missing",
    };
  }

  const planKey = normalizeCommercialPlanKey(req?.auth?.planKey || req?.tenant?.plan_key);
  const endpointProfile = profile || getEndpointUsageProfile(req);
  const reservationItems = [
    {
      metric: "api_calls",
      quantity: 1,
      limit: getUsageLimitForMetric(planKey, "api_calls"),
      class: "http",
    },
  ];

  if (endpointProfile.metric && endpointProfile.metric !== "api_calls") {
    reservationItems.push({
      metric: endpointProfile.metric,
      quantity: Math.max(1, n(endpointProfile.cost, 1)),
      limit: getUsageLimitForMetric(planKey, endpointProfile.metric),
      class: endpointProfile.class,
    });
  }

  let reservationResult = null;
  try {
    reservationResult = await reserveTenantUsageQuota(db, {
      tenantId,
      tenantKey,
      planKey,
      reservations: reservationItems,
      requestId: req?.requestId,
      meta: {
        endpoint: s(req?.originalUrl || req?.url),
        route: s(req?.route?.path || req?.path || req?.originalUrl || req?.url),
      },
    });
  } catch (error) {
    if (error?.code !== "TENANT_QUOTA_EXCEEDED") {
      req?.log?.error?.("tenant.quota.reservation_failed_closed", {
        tenantId,
        tenantKey,
        error: s(error?.message || error),
      });
      return {
        ok: false,
        status: 503,
        code: "tenant_quota_unavailable",
        error: "Tenant quota could not be reserved",
        reason: "quota_reservation_failed",
      };
    }

    const exceededMetric = s(error.metric || endpointProfile.metric || "api_calls");
    const exceeded = buildQuotaEnvelope({
      planKey,
      metric: exceededMetric,
      used: Math.max(0, n(error.limit, 0)),
      cost: Math.max(1, n(error.quantity, 1)),
    });
    setQuotaHeaders(res, exceeded);

    await recordTenantUsage(db, {
      tenantId,
      tenantKey,
      planKey,
      metric: "quota_rejections",
      quantity: 1,
      source: "quota.enforcement",
      requestId: req?.requestId,
      meta: {
        endpoint: s(req?.originalUrl || req?.url),
        metric: exceeded.metric,
        limit: exceeded.limit,
        projected: exceeded.projected,
      },
    }).catch((recordError) => {
      req?.log?.warn?.("tenant.quota.rejection_record_failed", {
        tenantId,
        tenantKey,
        planKey,
        metric: exceeded.metric,
        error: s(recordError?.message || recordError),
      });
    });

    recordQuotaRejection({
      tenantId,
      tenantKey,
      planKey,
      metric: exceeded.metric,
      route: s(req?.route?.path || req?.path || req?.originalUrl || req?.url),
    });

    return {
      ok: false,
      status: 429,
      code: "tenant_quota_exceeded",
      error: "Tenant quota exceeded",
      quota: exceeded,
      checks: [exceeded],
      profile: endpointProfile,
    };
  }

  const rowsByMetric = new Map();
  for (const row of reservationResult?.rows || []) {
    for (const item of reservationItems) rowsByMetric.set(item.metric, row);
  }
  const checks = reservationItems.map((item) => {
    const row = rowsByMetric.get(item.metric) || {};
    const usedAfterReservation =
      metricValue(row, item.metric) + metricReservedValue(row, item.metric);
    return buildQuotaEnvelope({
      planKey,
      metric: item.metric,
      used: Math.max(0, usedAfterReservation - item.quantity),
      cost: item.quantity,
    });
  });

  const primary = checks[checks.length - 1];
  setQuotaHeaders(res, primary);

  return {
    ok: true,
    quota: primary,
    checks,
    profile: endpointProfile,
    reservation: reservationResult?.reservation || null,
  };
}

export function createTenantUsageAndQuotaMiddleware({ db }) {
  return async function tenantUsageAndQuota(req, res, next) {
    const tenantId = s(req?.auth?.tenantId || req?.tenantId);
    const tenantKey = lower(req?.auth?.tenantKey || req?.tenantKey);
    const planKey = normalizeCommercialPlanKey(req?.auth?.planKey || req?.tenant?.plan_key);
    const profile = getEndpointUsageProfile(req);
    const startedAt = Date.now();

    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Tenant quota could not be validated",
        code: "tenant_quota_unavailable",
        requestId: req.requestId || null,
      });
    }

    if (!tenantId || !tenantKey) {
      return res.status(403).json({
        ok: false,
        error: "Tenant quota requires tenant context",
        code: "tenant_quota_tenant_required",
        requestId: req.requestId || null,
      });
    }

    let quotaResult = null;
    try {
      quotaResult = await enforceTenantQuota({ db, req, res, profile });
    } catch (error) {
      req.log?.error?.("tenant.quota.check_failed_closed", {
        tenantId,
        tenantKey,
        error: s(error?.message || error),
      });
      quotaResult = {
        ok: false,
        status: 503,
        code: "tenant_quota_unavailable",
        error: "Tenant quota could not be validated",
      };
    }

    if (quotaResult?.ok === false) {
      return res.status(quotaResult.status || 429).json({
        ok: false,
        error: quotaResult.error || "Tenant quota exceeded",
        code: quotaResult.code || "tenant_quota_exceeded",
        requestId: req.requestId || null,
        quota: quotaResult.quota,
      });
    }

    res.on("finish", () => {
      const durationMs = Math.max(0, Date.now() - startedAt);
      recordHttpRequestMetric({
        tenantId,
        tenantKey,
        route: s(req?.route?.path || req?.path || req?.originalUrl || req?.url),
        method: s(req?.method || "GET").toUpperCase(),
        status: res.statusCode,
        durationMs,
      });

      const reservation = quotaResult?.reservation || null;
      if (!reservation) return;

      const finalReservation = {
        ...reservation,
        meta: {
          ...(reservation.meta || {}),
          route: s(req?.route?.path || req?.path || req?.originalUrl || req?.url),
          status: res.statusCode,
          durationMs,
        },
      };

      const shouldCommit = res.statusCode >= 200 && res.statusCode < 400;
      const action = shouldCommit
        ? commitTenantUsageReservation
        : releaseTenantUsageReservation;
      action(db, finalReservation).catch((error) => {
        req.log?.warn?.(
          shouldCommit
            ? "tenant.usage.reservation_commit_failed"
            : "tenant.usage.reservation_release_failed",
          {
            tenantId,
            tenantKey,
            error: s(error?.message || error),
          }
        );
      });
    });

    return next();
  };
}

export const __test__ = {
  metricValue,
};
