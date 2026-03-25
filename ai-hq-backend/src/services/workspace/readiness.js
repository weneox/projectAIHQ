// src/services/workspace/readiness.js
// FINAL v4.0 — canonical-first workspace readiness + setup studio routing
// principles:
// - readiness should reflect canonical truth, not legacy fallback pollution
// - /setup/studio is the primary onboarding route
// - legacy tenant_profiles may help display context but should not complete setup on their own
// - downstream runtime hints are useful for UX/debugging, but checks stay strict

import {
  arr,
  compactText,
  extractItems,
  lower,
  normalizeStringArray,
  obj,
  pickDateValue,
  s,
  uniq,
} from "./shared.js";
import {
  countFromFirstTable,
  getRowById,
  getRowsFromFirstTable,
  listByTenantScope,
} from "./db.js";

const SOURCE_TABLES = ["tenant_sources", "sources"];
const SOURCE_RUN_TABLES = ["tenant_source_sync_runs", "source_sync_runs"];

const KNOWLEDGE_ENTRY_TABLES = [
  "tenant_knowledge_items",
  "tenant_knowledge_entries",
  "knowledge_entries",
];

const KNOWLEDGE_CANDIDATE_TABLES = [
  "tenant_knowledge_candidates",
  "knowledge_candidates",
];

const SERVICE_TABLES = [
  "tenant_services",
  "service_catalog",
  "service_catalog_entries",
];

const PLAYBOOK_TABLES = [
  "tenant_playbooks",
  "response_playbooks",
  "playbooks",
  "tenant_response_playbooks",
];

const AI_POLICY_TABLES = ["tenant_ai_policies"];
const CAPABILITY_TABLES = ["tenant_business_capabilities"];
const BUSINESS_PROFILE_TABLES = ["tenant_business_profile"];
const TENANT_PROFILE_TABLES = ["tenant_profiles"];

function isOperationsRole(role = "") {
  return [
    "agent",
    "support",
    "moderator",
    "operator",
    "csr",
    "community_manager",
  ].includes(lower(role));
}

function scoreReadiness(checks = {}) {
  const weights = {
    businessProfile: 22,
    channels: 18,
    knowledge: 24,
    services: 14,
    playbooks: 12,
    policies: 10,
  };

  let total = 0;

  for (const [key, weight] of Object.entries(weights)) {
    if (checks[key]) total += weight;
  }

  return total;
}

function readinessLabel(score = 0) {
  if (score >= 90) return "ready";
  if (score >= 70) return "almost_ready";
  if (score >= 45) return "in_progress";
  return "early_setup";
}

function buildMissingSteps(checks = {}) {
  const out = [];

  if (!checks.businessProfile) out.push("business_profile");
  if (!checks.channels) out.push("channels");
  if (!checks.knowledge) out.push("knowledge");
  if (!checks.services) out.push("services");
  if (!checks.playbooks) out.push("playbooks");
  if (!checks.policies) out.push("policies");

  return out;
}

function mapStepToStudioStage(step = "") {
  switch (step) {
    case "business_profile":
      return "identity";
    case "channels":
      return "entry";
    case "knowledge":
      return "knowledge";
    case "services":
      return "service";
    case "playbooks":
      return "ready";
    case "policies":
      return "ready";
    default:
      return "entry";
  }
}

function mapStepToRoute(step = "") {
  if (!step) return "/setup/studio";
  return "/setup/studio";
}

function sortRowsByLatest(rows = []) {
  return [...arr(rows)].sort((a, b) => {
    const aa = Date.parse(pickDateValue(a) || 0) || 0;
    const bb = Date.parse(pickDateValue(b) || 0) || 0;
    return bb - aa;
  });
}

function isActiveSource(item = {}) {
  const status = lower(
    item.sync_status ||
      item.connection_status ||
      item.status ||
      item.state
  );

  const enabled =
    item.is_enabled ??
    item.enabled ??
    item.active ??
    item.is_active ??
    true;

  if (enabled === false) return false;
  if (["disabled", "inactive", "archived", "deleted", "revoked"].includes(status)) {
    return false;
  }

  return true;
}

function isApprovedKnowledgeEntry(item = {}) {
  const status = lower(item.status || item.review_status || item.state);
  if (!status) return true;
  return ["approved", "active", "published"].includes(status);
}

function isPendingCandidate(item = {}) {
  const status = lower(item.status || item.review_status || item.state);
  if (!status) return true;

  return [
    "pending",
    "needs_review",
    "conflict",
    "review",
    "awaiting_review",
  ].includes(status);
}

function isApprovedCandidate(item = {}) {
  const status = lower(item.status || item.review_status || item.state);
  return ["approved", "active", "published", "promoted"].includes(status);
}

function isRejectedCandidate(item = {}) {
  const status = lower(item.status || item.review_status || item.state);
  return ["rejected", "dismissed", "ignored"].includes(status);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const x = s(value);
    if (x) return x;
  }
  return "";
}

function firstArray(...values) {
  for (const value of values) {
    const out = normalizeStringArray(value);
    if (out.length) return out;
  }
  return [];
}

function hasObjectKeys(value) {
  return Object.keys(obj(value)).length > 0;
}

function hasMeaningfulText(...values) {
  return values.some((value) => !!s(value));
}

async function firstScopedRow(db, tableName, scope) {
  const rows = await listByTenantScope(db, tableName, scope, { limit: 1 });
  return obj(rows?.[0]);
}

async function loadTenantBrainRuntimeGetter() {
  try {
    const mod = await import("../businessBrain/getTenantBrainRuntime.js");
    const fn = mod?.getTenantBrainRuntime || mod?.default;
    return typeof fn === "function" ? fn : null;
  } catch {
    return null;
  }
}

async function getRuntimeSnapshot({ db, tenantId, tenantKey }) {
  const getTenantBrainRuntime = await loadTenantBrainRuntimeGetter();

  if (!getTenantBrainRuntime) {
    return {
      raw: null,
      ready: false,
      hasKnowledge: false,
      hasServices: false,
      hasPlaybooks: false,
      hasPolicies: false,
      knowledgeCount: 0,
      serviceCount: 0,
      playbookCount: 0,
      tone: "",
      language: "",
      disabledServicesCount: 0,
    };
  }

  let raw = null;

  try {
    raw = await getTenantBrainRuntime({
      db,
      tenantId,
      tenantKey,
    });
  } catch {
    try {
      raw = await getTenantBrainRuntime({ db, tenantKey });
    } catch {
      raw = null;
    }
  }

  const runtime = obj(raw?.runtime || raw);
  const knowledgeEntries = extractItems(
    runtime.knowledgeEntries || runtime.knowledge || []
  );
  const serviceCatalog = extractItems(
    runtime.serviceCatalog || runtime.services || []
  );
  const responsePlaybooks = extractItems(
    runtime.responsePlaybooks || runtime.playbooks || []
  );

  const tone = s(runtime.tone || runtime.brandTone || runtime.toneText);
  const language = s(runtime.language || runtime.defaultLanguage || runtime.outputLanguage);
  const disabledServices = arr(runtime.disabledServices);

  return {
    raw: runtime,
    ready: !!(
      knowledgeEntries.length ||
      serviceCatalog.length ||
      responsePlaybooks.length
    ),
    hasKnowledge: knowledgeEntries.length > 0,
    hasServices: serviceCatalog.length > 0,
    hasPlaybooks: responsePlaybooks.length > 0,
    hasPolicies: false,
    knowledgeCount: knowledgeEntries.length,
    serviceCount: serviceCatalog.length,
    playbookCount: responsePlaybooks.length,
    tone,
    language,
    disabledServicesCount: disabledServices.length,
  };
}

function hasCanonicalBusinessProfileData(businessProfileRow = {}) {
  const identity = firstNonEmpty(
    businessProfileRow.company_name,
    businessProfileRow.display_name
  );

  const details = [
    businessProfileRow.summary_short,
    businessProfileRow.summary_long,
    businessProfileRow.value_proposition,
    businessProfileRow.website_url,
    businessProfileRow.primary_email,
    businessProfileRow.primary_phone,
    businessProfileRow.primary_address,
    businessProfileRow.industry_key,
    businessProfileRow.main_language,
  ]
    .map((x) => s(x))
    .filter(Boolean);

  const supportedLanguages = normalizeStringArray(
    businessProfileRow.supported_languages
  );

  return !!identity && (details.length > 0 || supportedLanguages.length > 0);
}

async function getTenantProfileSnapshot({ db, tenantId, tenantKey, tenant, runtime }) {
  let tenantRow = obj(tenant);

  if (!tenantRow.id && tenantId) {
    tenantRow = obj(await getRowById(db, "tenants", "id", tenantId), tenantRow);
  }

  if (!tenantRow.id && tenantKey) {
    tenantRow = obj(
      await getRowById(db, "tenants", "tenant_key", tenantKey),
      tenantRow
    );
  }

  const scope = {
    tenantId: s(tenantRow.id || tenantId),
    tenantKey: s(tenantRow.tenant_key || tenantRow.key || tenantKey),
  };

  const businessProfileRow = await firstScopedRow(
    db,
    BUSINESS_PROFILE_TABLES[0],
    scope
  );

  const tenantProfileRow = await firstScopedRow(
    db,
    TENANT_PROFILE_TABLES[0],
    scope
  );

  const businessProfileJson = obj(businessProfileRow.profile_json);
  const businessProfileMeta = obj(businessProfileRow.metadata_json);
  const tenantProfileExtra = obj(tenantProfileRow.extra_context);

  const companyName = firstNonEmpty(
    businessProfileRow.company_name,
    businessProfileRow.display_name,
    tenantProfileRow.brand_name,
    tenantRow.company_name,
    tenantRow.name,
    tenantRow.display_name
  );

  const description = compactText(
    firstNonEmpty(
      businessProfileRow.summary_long,
      businessProfileRow.summary_short,
      businessProfileRow.value_proposition,
      tenantProfileRow.brand_summary,
      tenantProfileRow.value_proposition,
      tenantProfileRow.services_summary,
      tenantProfileRow.audience_summary
    ),
    800
  );

  const timezone = firstNonEmpty(
    businessProfileJson.timezone,
    businessProfileMeta.timezone,
    tenantProfileExtra.timezone,
    tenantRow.timezone,
    tenantRow.time_zone
  );

  const languages = uniq(
    [
      ...firstArray(
        businessProfileRow.supported_languages,
        tenantProfileExtra.languages
      ),
      firstNonEmpty(
        businessProfileRow.main_language,
        runtime.language
      ),
    ].filter(Boolean)
  );

  const tone = firstNonEmpty(
    businessProfileRow.tone_profile,
    businessProfileJson.tone,
    businessProfileMeta.tone,
    tenantProfileRow.tone_of_voice,
    tenantProfileExtra.tone,
    runtime.tone
  );

  const hasBusinessProfile = hasCanonicalBusinessProfileData(businessProfileRow);

  return {
    companyName,
    description,
    timezone,
    languages,
    tone,
    hasBusinessProfile,
    hasLegacyProfileHints: !!(
      s(tenantProfileRow.brand_name) ||
      s(tenantProfileRow.brand_summary) ||
      s(tenantProfileRow.website_url) ||
      s(tenantProfileRow.public_email) ||
      s(tenantProfileRow.public_phone)
    ),
    rawTenant: tenantRow,
    rawTenantProfile: tenantProfileRow,
    rawBusinessProfile: businessProfileRow,
  };
}

async function getSourcesSummary({ db, tenantId, tenantKey }) {
  const scope = { tenantId, tenantKey };

  const { rows: sourceRows } = await getRowsFromFirstTable(db, SOURCE_TABLES, scope, {
    limit: 300,
  });

  const { count: totalCount } = await countFromFirstTable(db, SOURCE_TABLES, scope);

  const activeRows = sourceRows.filter(isActiveSource);
  const activeCount = activeRows.length;

  const websiteCount = activeRows.filter(
    (x) => lower(x.source_type || x.type) === "website"
  ).length;

  const googleMapsCount = activeRows.filter(
    (x) => lower(x.source_type || x.type) === "google_maps"
  ).length;

  const connectedTypes = uniq(
    activeRows
      .map((x) => s(x.source_type || x.type))
      .filter(Boolean)
  ).sort();

  const { rows: runRows } = await getRowsFromFirstTable(db, SOURCE_RUN_TABLES, scope, {
    limit: 50,
  });

  const latestRun = sortRowsByLatest(runRows)[0] || null;

  return {
    totalCount,
    activeCount,
    websiteCount,
    googleMapsCount,
    connectedTypes,
    lastSyncAt: s(pickDateValue(latestRun)),
    lastSyncStatus: s(
      latestRun?.run_status ||
        latestRun?.sync_status ||
        latestRun?.status
    ),
  };
}

async function getKnowledgeSummary({ db, tenantId, tenantKey, runtime }) {
  const scope = { tenantId, tenantKey };

  const { rows: entryRows } = await getRowsFromFirstTable(
    db,
    KNOWLEDGE_ENTRY_TABLES,
    scope,
    { limit: 400 }
  );

  const { count: entryCount } = await countFromFirstTable(
    db,
    KNOWLEDGE_ENTRY_TABLES,
    scope
  );

  const { rows: candidateRows } = await getRowsFromFirstTable(
    db,
    KNOWLEDGE_CANDIDATE_TABLES,
    scope,
    { limit: 500 }
  );

  const approvedEntryCount = entryRows.length
    ? entryRows.filter(isApprovedKnowledgeEntry).length
    : entryCount;

  const pendingCandidateCount = candidateRows.filter(isPendingCandidate).length;
  const approvedCandidateCount = candidateRows.filter(isApprovedCandidate).length;
  const rejectedCandidateCount = candidateRows.filter(isRejectedCandidate).length;

  return {
    approvedKnowledgeCount: approvedEntryCount,
    approvedEntryCount,
    pendingCandidateCount,
    approvedCandidateCount,
    rejectedCandidateCount,
    runtimeKnowledgeCount: runtime.knowledgeCount || 0,
  };
}

async function getCatalogSummary({ db, tenantId, tenantKey, runtime }) {
  const scope = { tenantId, tenantKey };

  const { count: serviceCountDb } = await countFromFirstTable(
    db,
    SERVICE_TABLES,
    scope
  );

  const { count: playbookCountDb } = await countFromFirstTable(
    db,
    PLAYBOOK_TABLES,
    scope
  );

  return {
    serviceCount: serviceCountDb,
    playbookCount: playbookCountDb,
    dbServiceCount: serviceCountDb,
    dbPlaybookCount: playbookCountDb,
    runtimeServiceCount: runtime.serviceCount || 0,
    runtimePlaybookCount: runtime.playbookCount || 0,
  };
}

function hasExplicitAiPolicyData(row = {}) {
  return [
    typeof row.auto_reply_enabled === "boolean",
    typeof row.suppress_ai_during_handoff === "boolean",
    typeof row.mark_seen_enabled === "boolean",
    typeof row.typing_indicator_enabled === "boolean",
    typeof row.create_lead_enabled === "boolean",
    typeof row.approval_required_content === "boolean",
    typeof row.approval_required_publish === "boolean",
    typeof row.quiet_hours_enabled === "boolean",
    hasObjectKeys(row.quiet_hours),
    hasObjectKeys(row.inbox_policy),
    hasObjectKeys(row.comment_policy),
    hasObjectKeys(row.content_policy),
    hasObjectKeys(row.escalation_rules),
    hasObjectKeys(row.risk_rules),
    hasObjectKeys(row.lead_scoring_rules),
    hasObjectKeys(row.publish_policy),
  ].some(Boolean);
}

function hasExplicitCapabilitiesData(row = {}) {
  return [
    hasMeaningfulText(
      row.reply_style,
      row.reply_length,
      row.emoji_level,
      row.cta_style,
      row.primary_language
    ),
    normalizeStringArray(row.supported_languages).length > 0,
    typeof row.can_capture_leads === "boolean",
    typeof row.handoff_enabled === "boolean",
    typeof row.should_avoid_legal_claims === "boolean",
    typeof row.should_avoid_unverified_promises === "boolean",
    typeof row.should_avoid_competitor_comparisons === "boolean",
  ].some(Boolean);
}

async function getPoliciesSummary({ db, tenantId, tenantKey }) {
  const scope = { tenantId, tenantKey };

  const aiPolicyRow = await firstScopedRow(
    db,
    AI_POLICY_TABLES[0],
    scope
  );

  const capabilityRow = await firstScopedRow(
    db,
    CAPABILITY_TABLES[0],
    scope
  );

  const hasAiPolicies = hasExplicitAiPolicyData(aiPolicyRow);
  const hasCapabilities = hasExplicitCapabilitiesData(capabilityRow);

  return {
    hasPolicies: hasAiPolicies || hasCapabilities,
    hasAiPolicies,
    hasCapabilities,
    aiPolicyRow,
    capabilityRow,
  };
}

export async function getWorkspaceReadiness({
  db,
  tenantId,
  tenantKey,
  role = "",
  tenant = null,
}) {
  if (!tenantId && !tenantKey) {
    throw new Error("getWorkspaceReadiness: tenantId or tenantKey is required");
  }

  const runtime = await getRuntimeSnapshot({
    db,
    tenantId,
    tenantKey,
  });

  const tenantProfile = await getTenantProfileSnapshot({
    db,
    tenantId,
    tenantKey,
    tenant,
    runtime,
  });

  const sources = await getSourcesSummary({
    db,
    tenantId,
    tenantKey,
  });

  const knowledge = await getKnowledgeSummary({
    db,
    tenantId,
    tenantKey,
    runtime,
  });

  const catalog = await getCatalogSummary({
    db,
    tenantId,
    tenantKey,
    runtime,
  });

  const policies = await getPoliciesSummary({
    db,
    tenantId,
    tenantKey,
  });

  const checks = {
    businessProfile: tenantProfile.hasBusinessProfile,
    channels: sources.activeCount > 0,
    knowledge: knowledge.approvedKnowledgeCount > 0,
    services: catalog.dbServiceCount > 0,
    playbooks: catalog.dbPlaybookCount > 0,
    policies: policies.hasPolicies,
  };

  const readinessScore = scoreReadiness(checks);
  const missingSteps = buildMissingSteps(checks);
  const primaryMissingStep = missingSteps[0] || "";
  const nextStudioStage = mapStepToStudioStage(primaryMissingStep);

  const setupCompleted =
    checks.businessProfile &&
    checks.channels &&
    checks.knowledge &&
    checks.services &&
    checks.playbooks &&
    checks.policies;

  const nextRoute = setupCompleted
    ? isOperationsRole(role)
      ? "/inbox"
      : "/"
    : "/setup/studio";

  return {
    setupCompleted,
    readinessScore,
    readinessLabel: readinessLabel(readinessScore),
    missingSteps,
    primaryMissingStep,
    nextRoute,
    nextSetupRoute: setupCompleted ? "" : mapStepToRoute(primaryMissingStep),
    nextStudioStage: setupCompleted ? "" : nextStudioStage,
    checks,

    tenantProfile: {
      companyName: tenantProfile.companyName,
      description: tenantProfile.description,
      timezone: tenantProfile.timezone,
      languages: tenantProfile.languages,
      tone: tenantProfile.tone,
      hasLegacyProfileHints: tenantProfile.hasLegacyProfileHints,
    },

    sources,
    knowledge,
    catalog,

    policies: {
      hasPolicies: policies.hasPolicies,
      hasAiPolicies: policies.hasAiPolicies,
      hasCapabilities: policies.hasCapabilities,
    },

    runtime: {
      ready: runtime.ready,
      hasKnowledge: runtime.hasKnowledge,
      hasServices: runtime.hasServices,
      hasPlaybooks: runtime.hasPlaybooks,
      hasPolicies: policies.hasPolicies,
      knowledgeCount: runtime.knowledgeCount,
      serviceCount: runtime.serviceCount,
      playbookCount: runtime.playbookCount,
      tone: runtime.tone,
      language: runtime.language,
      disabledServicesCount: runtime.disabledServicesCount,
    },

    debug: {
      canonicalBusinessProfileComplete: checks.businessProfile,
      activeSourceCount: sources.activeCount,
      approvedKnowledgeCount: knowledge.approvedKnowledgeCount,
      dbServiceCount: catalog.dbServiceCount,
      dbPlaybookCount: catalog.dbPlaybookCount,
      hasCapabilityRow: policies.hasCapabilities,
      hasAiPolicyRow: policies.hasAiPolicies,
      nextStudioStage,
    },
  };
}