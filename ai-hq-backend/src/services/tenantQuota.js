import {
  buildQuotaEnvelope,
  getEndpointUsageProfile,
  getUsageLimitForMetric,
  normalizeCommercialPlanKey,
} from "./commercialPlans.js";
import { cfg } from "../config.js";
import {
  getTenantUsageSnapshot,
  recordTenantUsage,
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
  if (!db || !tenantId || !tenantKey) return { ok: true, skipped: true };

  const planKey = normalizeCommercialPlanKey(req?.auth?.planKey || req?.tenant?.plan_key);
  const endpointProfile = profile || getEndpointUsageProfile(req);
  let snapshot = null;
  try {
    snapshot = await getTenantUsageSnapshot(db, { tenantId, tenantKey });
  } catch (error) {
    req?.log?.error?.("tenant.quota.snapshot_failed_closed", {
      tenantId,
      tenantKey,
      error: s(error?.message || error),
    });
    return {
      ok: false,
      status: 503,
      code: "tenant_quota_unavailable",
      error: "Tenant quota could not be validated",
      reason: "quota_snapshot_failed",
    };
  }
  const checks = [
    buildQuotaEnvelope({
      planKey,
      metric: "api_calls",
      used: metricValue(snapshot, "api_calls"),
      cost: 1,
    }),
  ];

  if (endpointProfile.metric && endpointProfile.metric !== "api_calls") {
    checks.push(
      buildQuotaEnvelope({
        planKey,
        metric: endpointProfile.metric,
        used: metricValue(snapshot, endpointProfile.metric),
        cost: endpointProfile.cost,
      })
    );
  }

  const exceeded = checks.find((item) => item.exceeded);
  const primary = exceeded || checks[checks.length - 1];
  setQuotaHeaders(res, primary);

  if (!exceeded) {
    return {
      ok: true,
      quota: primary,
      checks,
      profile: endpointProfile,
    };
  }

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
  }).catch((error) => {
    req?.log?.warn?.("tenant.quota.rejection_record_failed", {
      tenantId,
      tenantKey,
      planKey,
      metric: exceeded.metric,
      error: s(error?.message || error),
    });
  });

  recordQuotaRejection({
    tenantId,
    tenantKey,
    planKey,
    metric: exceeded.metric,
    route: s(req?.route?.path || req?.path || req?.originalUrl || req?.url),
  });

  const enforcementMode = lower(cfg?.commercial?.quotaEnforcementMode, "enforce");
  if (enforcementMode === "monitor" || enforcementMode === "off") {
    req?.log?.warn?.("tenant.quota.limit_observed", {
      tenantId,
      tenantKey,
      planKey,
      metric: exceeded.metric,
      limit: exceeded.limit,
      projected: exceeded.projected,
      enforcementMode,
    });

    return {
      ok: true,
      monitored: true,
      quota: exceeded,
      checks,
      profile: endpointProfile,
    };
  }

  return {
    ok: false,
    status: 429,
    code: "tenant_quota_exceeded",
    error: "Tenant quota exceeded",
    quota: exceeded,
    checks,
    profile: endpointProfile,
  };
}

export function createTenantUsageAndQuotaMiddleware({ db }) {
  return async function tenantUsageAndQuota(req, res, next) {
    const tenantId = s(req?.auth?.tenantId || req?.tenantId);
    const tenantKey = lower(req?.auth?.tenantKey || req?.tenantKey);
    const planKey = normalizeCommercialPlanKey(req?.auth?.planKey || req?.tenant?.plan_key);
    const profile = getEndpointUsageProfile(req);
    const startedAt = Date.now();

    if (!tenantId || !tenantKey || !db) {
      return next();
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

      if (res.statusCode < 200 || res.statusCode >= 400) return;

      recordTenantUsage(db, {
        tenantId,
        tenantKey,
        planKey,
        metric: "api_calls",
        quantity: 1,
        source: "http",
        requestId: req.requestId,
        meta: {
          route: s(req?.route?.path || req?.path || req?.originalUrl || req?.url),
          status: res.statusCode,
          durationMs,
        },
      }).catch((error) => {
        req.log?.warn?.("tenant.usage.api_call_record_failed", {
          tenantId,
          tenantKey,
          error: s(error?.message || error),
        });
      });

      if (profile.metric && profile.metric !== "api_calls") {
        const limit = getUsageLimitForMetric(planKey, profile.metric);
        recordTenantUsage(db, {
          tenantId,
          tenantKey,
          planKey,
          metric: profile.metric,
          quantity: Math.max(1, n(profile.cost, 1)),
          source: profile.class,
          requestId: req.requestId,
          meta: {
            route: s(req?.route?.path || req?.path || req?.originalUrl || req?.url),
            limit,
            status: res.statusCode,
          },
        }).catch((error) => {
          req.log?.warn?.("tenant.usage.endpoint_record_failed", {
            tenantId,
            tenantKey,
            metric: profile.metric,
            error: s(error?.message || error),
          });
        });
      }
    });

    return next();
  };
}

export const __test__ = {
  metricValue,
};
