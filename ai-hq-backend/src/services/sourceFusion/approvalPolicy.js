import { arr, lower, obj, s, uniqStrings } from "./shared.js";

const ALL_AFFECTED_SURFACES = [
  "inbox",
  "comments",
  "leads",
  "voice",
  "meta",
  "twilio",
  "automation_executions",
];

const OUTCOME_RANK = {
  auto_approvable: 0,
  review_required: 1,
  admin_approval_required: 2,
  owner_approval_required: 3,
  dual_approval_required: 4,
  blocked: 5,
  quarantined: 6,
};

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

export function mapRuntimeAreasToAffectedSurfaces(runtimeAreas = []) {
  const areas = arr(runtimeAreas).map((item) => lower(item)).filter(Boolean);
  const out = new Set();

  for (const area of areas) {
    if (area === "behavioral_policy") {
      ALL_AFFECTED_SURFACES.forEach((item) => out.add(item));
      continue;
    }

    if (["tenant_identity", "tenant_profile", "contact_channels", "offerings", "knowledge"].includes(area)) {
      ["inbox", "comments", "leads", "voice", "meta", "twilio", "automation_executions"].forEach((item) =>
        out.add(item)
      );
      continue;
    }

    if (area === "channels") {
      ["inbox", "comments", "leads", "meta", "automation_executions"].forEach((item) =>
        out.add(item)
      );
    }
  }

  return [...out];
}

function normalizeImpact(impact = {}) {
  const current = obj(impact);
  return {
    canonicalAreas: uniqStrings(arr(current.canonicalAreas || current.canonical_areas)),
    runtimeAreas: uniqStrings(arr(current.runtimeAreas || current.runtime_areas)),
    canonicalPaths: uniqStrings(arr(current.canonicalPaths || current.canonical_paths)),
    runtimePaths: uniqStrings(arr(current.runtimePaths || current.runtime_paths)),
    affectedSurfaces: uniqStrings([
      ...arr(current.affectedSurfaces || current.affected_surfaces),
      ...mapRuntimeAreasToAffectedSurfaces(current.runtimeAreas || current.runtime_areas),
    ]),
  };
}

function normalizeRoleForOutcome(outcome = "") {
  switch (s(outcome)) {
    case "admin_approval_required":
      return "admin";
    case "owner_approval_required":
      return "owner";
    case "dual_approval_required":
      return "admin_and_owner";
    case "quarantined":
    case "blocked":
    case "review_required":
      return "reviewer";
    case "auto_approvable":
    default:
      return "system";
  }
}

export function classifyApprovalRisk({
  category = "",
  itemKey = "",
  impact = {},
} = {}) {
  const safeCategory = lower(category);
  const safeItemKey = lower(itemKey);
  const safeImpact = normalizeImpact(impact);
  const reasons = [];

  let level = "medium";
  let label = "business_fact";
  let operational = false;

  if (
    safeCategory === "capability" ||
    safeImpact.runtimeAreas.includes("behavioral_policy") ||
    /(handoff|callback|routing|operator|autonomy|approval|policy|supports|capture|reply_|booking_mode|sales_mode|pricing_mode)/.test(
      safeItemKey
    )
  ) {
    level = "high";
    label = "operational_truth";
    operational = true;
    reasons.push("behavioral_policy_change");
  } else if (["summary", "faq", "service", "product"].includes(safeCategory)) {
    level = "low";
    label = "descriptive_truth";
    reasons.push("descriptive_profile_change");
  } else if (
    ["company", "contact", "location", "pricing", "pricing_policy", "support", "hours", "social_link", "booking", "profile_setting", "knowledge"].includes(
      safeCategory
    ) ||
    /(company|email|phone|address|language|tone|hours|price|pricing|support|website)/.test(
      safeItemKey
    )
  ) {
    level = "medium";
    label = "customer_facing_truth";
    reasons.push("customer_facing_change");
  }

  if (
    operational &&
    safeImpact.affectedSurfaces.some((item) =>
      ["voice", "twilio", "automation_executions"].includes(item)
    )
  ) {
    reasons.push("operational_surface_affected");
  }

  return {
    level,
    label,
    operational,
    reasonCodes: uniqStrings(reasons),
    canonicalAreas: safeImpact.canonicalAreas,
    runtimeAreas: safeImpact.runtimeAreas,
    affectedSurfaces: safeImpact.affectedSurfaces,
  };
}

export function classifyApprovalPolicy({
  title = "",
  category = "",
  itemKey = "",
  impact = {},
  governance = {},
} = {}) {
  const safeGovernance = obj(governance);
  const trust = obj(safeGovernance.trust);
  const freshness = obj(safeGovernance.freshness);
  const support = obj(safeGovernance.support);
  const conflict = obj(safeGovernance.conflict);
  const risk = classifyApprovalRisk({ category, itemKey, impact });
  const reasonCodes = uniqStrings([
    ...arr(safeGovernance.quarantineReasons),
    ...arr(risk.reasonCodes),
  ]);

  const strongestTrustTier = s(trust.strongestTier || trust.trustTier);
  const strongestTrustScore = round(
    trust.strongestTrustScore ?? trust.trustScore,
    3
  );
  const freshnessBucket = s(freshness.bucket || "unknown");
  const uniqueSourceCount = Number(support.uniqueSourceCount || 0);
  const strongEvidenceCount = Number(support.strongEvidenceCount || 0);
  const conflictClassification = s(conflict.classification);
  const hasSourceSignals = Boolean(
    strongestTrustTier || uniqueSourceCount > 0 || freshnessBucket !== "unknown"
  );

  let outcome = "review_required";

  if (safeGovernance.quarantine) {
    outcome = "quarantined";
  } else if (
    risk.level === "high" &&
    (trust.weakOnly === true ||
      ["weak_inferred_scrape", "unknown"].includes(strongestTrustTier))
  ) {
    outcome = "blocked";
    reasonCodes.push("high_risk_untrusted_source");
  } else if (
    hasSourceSignals &&
    (freshness.stale === true ||
      ["aging", "stale", "unknown"].includes(freshnessBucket) ||
      ["conflicting_but_reviewable", "insufficient_support"].includes(
        conflictClassification
      ) ||
      uniqueSourceCount < 2 ||
      strongEvidenceCount < 1 ||
      trust.weakOnly === true)
  ) {
    outcome = "review_required";
  } else if (
    risk.level === "low" &&
    strongestTrustScore >= 0.88 &&
    freshnessBucket === "fresh" &&
    uniqueSourceCount >= 2 &&
    strongEvidenceCount >= 1 &&
    !conflictClassification
  ) {
    outcome = "auto_approvable";
  } else if (
    risk.level === "high" &&
    risk.operational &&
    risk.affectedSurfaces.some((item) =>
      ["voice", "twilio", "automation_executions"].includes(item)
    )
  ) {
    outcome = "dual_approval_required";
  } else if (risk.level === "high" && risk.operational) {
    outcome = "owner_approval_required";
  } else if (risk.level === "high") {
    outcome = "admin_approval_required";
  }

  const requiredRole = normalizeRoleForOutcome(outcome);

  return {
    outcome,
    requiredRole,
    reviewRequired: outcome !== "auto_approvable",
    manualInterventionRequired: outcome !== "auto_approvable",
    autoApprovable: outcome === "auto_approvable",
    autoApprovalForbidden: outcome !== "auto_approvable",
    blocked: ["blocked", "quarantined"].includes(outcome),
    reasonCodes: uniqStrings(reasonCodes),
    risk,
    signals: {
      title: s(title),
      category: s(category),
      itemKey: s(itemKey),
      strongestTrustTier,
      strongestTrustScore,
      freshnessBucket,
      conflictClassification,
      uniqueSourceCount,
      strongEvidenceCount,
      quarantined: safeGovernance.quarantine === true,
      canonicalAreas: risk.canonicalAreas,
      runtimeAreas: risk.runtimeAreas,
      affectedSurfaces: risk.affectedSurfaces,
    },
  };
}

function getOutcomeRank(outcome = "") {
  return OUTCOME_RANK[s(outcome)] ?? OUTCOME_RANK.review_required;
}

export function summarizeApprovalPolicies(items = []) {
  const normalized = arr(items)
    .map((item) => {
      if (!item) return null;
      const safeItem = obj(item);
      const policy = obj(safeItem.approvalPolicy || safeItem.approval_policy);
      if (!Object.keys(policy).length) return null;

      return {
        title: s(safeItem.title || safeItem.itemKey || safeItem.item_key || safeItem.key),
        category: s(safeItem.category),
        itemKey: s(safeItem.itemKey || safeItem.item_key || safeItem.key),
        outcome: s(policy.outcome),
        requiredRole: s(policy.requiredRole || policy.required_role),
        riskLevel: s(policy.risk?.level || policy.riskLevel),
        reasonCodes: uniqStrings(arr(policy.reasonCodes || policy.reason_codes)),
        affectedSurfaces: uniqStrings(
          arr(policy.signals?.affectedSurfaces || policy.affectedSurfaces)
        ),
        canonicalAreas: uniqStrings(
          arr(policy.signals?.canonicalAreas || policy.canonicalAreas)
        ),
        runtimeAreas: uniqStrings(
          arr(policy.signals?.runtimeAreas || policy.runtimeAreas)
        ),
      };
    })
    .filter(Boolean);

  const counts = {};
  const requiredRoles = new Set();
  const affectedSurfaces = new Set();
  const canonicalAreas = new Set();
  const runtimeAreas = new Set();
  const reasonCodes = new Set();

  let strictest = "auto_approvable";

  for (const item of normalized) {
    counts[item.outcome] = (counts[item.outcome] || 0) + 1;
    if (getOutcomeRank(item.outcome) > getOutcomeRank(strictest)) {
      strictest = item.outcome;
    }
    if (item.requiredRole) requiredRoles.add(item.requiredRole);
    item.affectedSurfaces.forEach((value) => affectedSurfaces.add(value));
    item.canonicalAreas.forEach((value) => canonicalAreas.add(value));
    item.runtimeAreas.forEach((value) => runtimeAreas.add(value));
    item.reasonCodes.forEach((value) => reasonCodes.add(value));
  }

  return {
    strictestOutcome: normalized.length ? strictest : "review_required",
    requiredRoles: [...requiredRoles],
    counts,
    autoApprovableCount: counts.auto_approvable || 0,
    blockedCount: (counts.blocked || 0) + (counts.quarantined || 0),
    affectedSurfaces: [...affectedSurfaces],
    canonicalAreas: [...canonicalAreas],
    runtimeAreas: [...runtimeAreas],
    reasonCodes: [...reasonCodes],
    items: normalized,
  };
}

function mapBusinessProfileField(field = "") {
  const safeField = lower(field);

  if (["companyname", "displayname", "legalname"].includes(safeField)) {
    return {
      category: "company",
      itemKey: "canonical_company_name",
      impact: {
        canonicalAreas: ["business_profile"],
        runtimeAreas: ["tenant_identity"],
      },
    };
  }

  if (safeField === "websiteurl") {
    return {
      category: "company",
      itemKey: "canonical_website_url",
      impact: {
        canonicalAreas: ["business_profile"],
        runtimeAreas: ["tenant_profile"],
      },
    };
  }

  if (["summaryshort", "summarylong", "description", "valueproposition", "targetaudience"].includes(safeField)) {
    return {
      category: "summary",
      itemKey: safeField.includes("long") ? "summary_long" : "summary_short",
      impact: {
        canonicalAreas: ["business_profile"],
        runtimeAreas: ["tenant_profile"],
      },
    };
  }

  if (safeField === "primaryphone") {
    return {
      category: "contact",
      itemKey: "phone_primary",
      impact: {
        canonicalAreas: ["business_profile"],
        runtimeAreas: ["contact_channels"],
      },
    };
  }

  if (safeField === "primaryemail") {
    return {
      category: "contact",
      itemKey: "email_primary",
      impact: {
        canonicalAreas: ["business_profile"],
        runtimeAreas: ["contact_channels"],
      },
    };
  }

  if (safeField === "primaryaddress") {
    return {
      category: "location",
      itemKey: "primary_address",
      impact: {
        canonicalAreas: ["business_profile"],
        runtimeAreas: ["contact_channels"],
      },
    };
  }

  return {
    category: "profile_setting",
    itemKey: safeField,
    impact: {
      canonicalAreas: ["business_profile"],
      runtimeAreas: ["tenant_profile"],
    },
  };
}

export function buildFinalizeApprovalPolicySummary({ draft = {} } = {}) {
  const items = [];
  const businessProfile = obj(draft.businessProfile);

  for (const field of Object.keys(businessProfile)) {
    if (field === "fieldSources") continue;
    const mapped = mapBusinessProfileField(field);
    items.push({
      title: field,
      category: mapped.category,
      itemKey: mapped.itemKey,
      approvalPolicy: classifyApprovalPolicy({
        title: field,
        category: mapped.category,
        itemKey: mapped.itemKey,
        impact: mapped.impact,
        governance: {},
      }),
    });
  }

  const capabilities = obj(draft.capabilities);
  for (const field of Object.keys(capabilities)) {
    items.push({
      title: field,
      category: "capability",
      itemKey: field,
      approvalPolicy: classifyApprovalPolicy({
        title: field,
        category: "capability",
        itemKey: field,
        impact: {
          canonicalAreas: ["business_capabilities"],
          runtimeAreas: ["behavioral_policy"],
          affectedSurfaces: [...ALL_AFFECTED_SURFACES],
        },
        governance: {},
      }),
    });
  }

  for (const service of arr(draft.services)) {
    const metadata = obj(service.metadataJson || service.metadata_json);
    items.push({
      title: s(service.title || service.key),
      category: "service",
      itemKey: s(service.key || service.itemKey || "service"),
      approvalPolicy:
        obj(metadata.approvalPolicy).outcome
          ? obj(metadata.approvalPolicy)
          : classifyApprovalPolicy({
              title: s(service.title || service.key),
              category: "service",
              itemKey: s(service.key || "service"),
              impact: {
                canonicalAreas: ["services"],
                runtimeAreas: ["offerings"],
              },
              governance: obj(metadata.governance),
            }),
    });
  }

  for (const item of arr(draft.knowledgeItems)) {
    const metadata = obj(item.metadataJson || item.metadata_json);
    items.push({
      title: s(item.title || item.key),
      category: s(item.category || "knowledge"),
      itemKey: s(item.itemKey || item.item_key || item.key),
      approvalPolicy:
        obj(metadata.approvalPolicy).outcome
          ? obj(metadata.approvalPolicy)
          : classifyApprovalPolicy({
              title: s(item.title || item.key),
              category: s(item.category || "knowledge"),
              itemKey: s(item.itemKey || item.item_key || item.key),
              impact: {
                canonicalAreas: ["knowledge"],
                runtimeAreas: ["knowledge"],
              },
              governance: obj(metadata.governance),
            }),
    });
  }

  return summarizeApprovalPolicies(items);
}

export const __test__ = {
  buildFinalizeApprovalPolicySummary,
  classifyApprovalPolicy,
  classifyApprovalRisk,
  mapRuntimeAreasToAffectedSurfaces,
  summarizeApprovalPolicies,
};
