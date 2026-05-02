import { cfg } from "../config.js";

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

const PLAN_ALIASES = Object.freeze({
  free: "free",
  trial: "free",
  starter: "free",
  basic: "basic",
  growth: "pro",
  pro: "pro",
  professional: "pro",
  enterprise: "pro",
});

function buildPlanLimits() {
  return {
    free: {
      apiCallsPerDay: n(cfg?.commercial?.freeDailyApiCalls, 2_000),
      aiUnitsPerDay: n(cfg?.commercial?.freeDailyAiUnits, 150),
      messagesPerDay: n(cfg?.commercial?.freeDailyMessages, 250),
      webhooksPerDay: n(cfg?.commercial?.freeDailyWebhooks, 1_000),
      softLimitRatio: 0.8,
    },
    basic: {
      apiCallsPerDay: n(cfg?.commercial?.basicDailyApiCalls, 20_000),
      aiUnitsPerDay: n(cfg?.commercial?.basicDailyAiUnits, 2_000),
      messagesPerDay: n(cfg?.commercial?.basicDailyMessages, 5_000),
      webhooksPerDay: n(cfg?.commercial?.basicDailyWebhooks, 20_000),
      softLimitRatio: 0.85,
    },
    pro: {
      apiCallsPerDay: n(cfg?.commercial?.proDailyApiCalls, 100_000),
      aiUnitsPerDay: n(cfg?.commercial?.proDailyAiUnits, 15_000),
      messagesPerDay: n(cfg?.commercial?.proDailyMessages, 50_000),
      webhooksPerDay: n(cfg?.commercial?.proDailyWebhooks, 150_000),
      softLimitRatio: 0.9,
    },
  };
}

const PLAN_LABELS = Object.freeze({
  free: "Free",
  basic: "Basic",
  pro: "Pro",
});

export function normalizeCommercialPlanKey(planKey = "") {
  return PLAN_ALIASES[lower(planKey, "free")] || "free";
}

export function getCommercialPlan(planKey = "") {
  const key = normalizeCommercialPlanKey(planKey);
  const limits = buildPlanLimits();
  return {
    key,
    label: PLAN_LABELS[key] || PLAN_LABELS.free,
    limits: {
      ...limits[key],
    },
  };
}

export function getUsageLimitForMetric(planKey = "", metric = "") {
  const plan = getCommercialPlan(planKey);
  const name = lower(metric);
  if (name === "api_calls") return n(plan.limits.apiCallsPerDay);
  if (name === "ai_units") return n(plan.limits.aiUnitsPerDay);
  if (name === "messages_in" || name === "messages_out") {
    return n(plan.limits.messagesPerDay);
  }
  if (name === "webhook_events") return n(plan.limits.webhooksPerDay);
  return 0;
}

export function getEndpointUsageProfile(req = {}) {
  const method = lower(req?.method || "get");
  const path = lower(req?.originalUrl || req?.url || req?.path || "").split("?")[0];

  if (
    path.includes("/chat") ||
    path.includes("/debate") ||
    path.includes("/render") ||
    path.includes("/media") ||
    path.includes("/executions") ||
    (path.includes("/content") && method !== "get")
  ) {
    let cost = 5;
    if (path.includes("/debate")) cost = 12;
    if (path.includes("/render") || path.includes("/media")) cost = 10;
    if (path.includes("/executions")) cost = method === "post" ? 8 : 2;
    if (path.includes("/content")) cost = 6;
    return {
      metric: "ai_units",
      cost,
      class: "ai_execution",
    };
  }

  if (path.includes("/inbox/outbound")) {
    return {
      metric: "messages_out",
      cost: 1,
      class: "outbound_message",
    };
  }

  if (path.includes("/inbox/ingest") || path.includes("/comments/ingest")) {
    return {
      metric: "webhook_events",
      cost: 1,
      class: "webhook_ingestion",
    };
  }

  return {
    metric: "api_calls",
    cost: 1,
    class: "api",
  };
}

export function buildQuotaEnvelope({
  planKey = "",
  metric = "",
  used = 0,
  cost = 1,
} = {}) {
  const plan = getCommercialPlan(planKey);
  const limit = getUsageLimitForMetric(plan.key, metric);
  const current = Math.max(0, n(used));
  const next = current + Math.max(1, n(cost, 1));
  const softAt = Math.floor(limit * n(plan.limits.softLimitRatio, 0.8));

  return {
    plan: plan.key,
    metric: lower(metric),
    limit,
    used: current,
    cost: Math.max(1, n(cost, 1)),
    projected: next,
    remaining: limit > 0 ? Math.max(0, limit - next) : null,
    softLimitReached: limit > 0 && next >= softAt,
    exceeded: limit > 0 && next > limit,
    resetAt: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(),
  };
}

export const __test__ = {
  buildPlanLimits,
  normalizeCommercialPlanKey,
  getEndpointUsageProfile,
};
