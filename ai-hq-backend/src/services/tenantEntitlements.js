function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function dedupe(values = []) {
  return [...new Set(values.filter(Boolean))];
}

const PLAN_ALIASES = Object.freeze({
  basic: "starter",
  starter: "starter",
  trial: "starter",
  free: "starter",
  growth: "growth",
  pro: "growth",
  professional: "growth",
  enterprise: "enterprise",
});

const PLAN_LABELS = Object.freeze({
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
});

const PLAN_ORDER = Object.freeze({
  starter: 1,
  growth: 2,
  enterprise: 3,
});

const CAPABILITY_DEFS = Object.freeze({
  workspaceCore: {
    minimumPlan: "starter",
    summary: "Core workspace, truth, and operator settings",
  },
  sourceGovernance: {
    minimumPlan: "starter",
    summary: "Source sync, review queue, and truth governance",
  },
  metaChannelConnect: {
    minimumPlan: "growth",
    summary: "Meta channel onboarding and reconnect flows",
  },
  agentConfigMutation: {
    minimumPlan: "growth",
    summary: "Tenant agent model and enablement changes",
  },
});

function normalizePlanKey(planKey = "") {
  const raw = lower(planKey, "starter");
  return PLAN_ALIASES[raw] || "starter";
}

function planMeetsMinimum(planKey = "starter", minimumPlan = "starter") {
  return (PLAN_ORDER[planKey] || 0) >= (PLAN_ORDER[minimumPlan] || 0);
}

function buildCapabilityState({
  capabilityKey,
  normalizedPlanKey,
  rawPlanKey,
  minimumPlan = "starter",
  summary = "",
} = {}) {
  const allowed = planMeetsMinimum(normalizedPlanKey, minimumPlan);
  const requiredPlans = dedupe(
    Object.keys(PLAN_ORDER).filter((plan) => planMeetsMinimum(plan, minimumPlan))
  );

  return {
    key: capabilityKey,
    allowed,
    minimumPlan,
    requiredPlans,
    planKey: rawPlanKey || normalizedPlanKey,
    normalizedPlanKey,
    source: "managed_plan_key",
    summary,
    message: allowed
      ? `${summary} is included in the ${PLAN_LABELS[normalizedPlanKey] || "managed"} plan.`
      : `${summary} is not included in the ${PLAN_LABELS[normalizedPlanKey] || rawPlanKey || "current"} plan. Plan assignment is managed internally and self-serve billing is not enabled.`,
  };
}

export function buildTenantEntitlements(tenant = {}) {
  const rawPlanKey = lower(tenant?.plan_key || tenant?.planKey || "starter", "starter");
  const normalizedPlanKey = normalizePlanKey(rawPlanKey);

  const capabilities = Object.fromEntries(
    Object.entries(CAPABILITY_DEFS).map(([capabilityKey, definition]) => [
      capabilityKey,
      buildCapabilityState({
        capabilityKey,
        normalizedPlanKey,
        rawPlanKey,
        minimumPlan: definition.minimumPlan,
        summary: definition.summary,
      }),
    ])
  );

  const restricted = Object.values(capabilities)
    .filter((item) => item.allowed === false)
    .map((item) => item.key);
  const included = Object.values(capabilities)
    .filter((item) => item.allowed !== false)
    .map((item) => item.key);

  return {
    source: "managed_plan_key",
    billing: {
      selfServeAvailable: false,
      message:
        "Plan assignment is managed internally. Self-serve billing and subscription changes are not enabled in this product surface.",
    },
    plan: {
      key: rawPlanKey,
      normalizedKey: normalizedPlanKey,
      label: PLAN_LABELS[normalizedPlanKey] || PLAN_LABELS.starter,
      managed: true,
    },
    capabilities,
    summary: {
      included,
      restricted,
      restrictedCount: restricted.length,
    },
  };
}

export function getTenantCapability(tenant = {}, capabilityKey = "") {
  return buildTenantEntitlements(tenant).capabilities[capabilityKey] || null;
}
