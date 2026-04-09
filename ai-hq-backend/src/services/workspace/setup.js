// src/services/workspace/setup.js
// FINAL v1.1 — setup status / overview service

import { arr, obj, s } from "./shared.js";
import { getWorkspaceReadiness } from "./readiness.js";
import { buildActiveWorkspaceContract } from "./activeWorkspace.js";

const SETUP_WIDGET_ROUTE = "/home?assistant=setup";

function pluralize(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

function buildPoliciesSummary(readiness = {}) {
  const checks = obj(readiness.checks);
  const policies = obj(readiness.policies);
  const runtime = obj(readiness.runtime);
  const tenantProfile = obj(readiness.tenantProfile);

  if (!checks.policies) {
    return "Runtime preferences still need setup";
  }

  const parts = [];

  if (policies.hasAiPolicies) {
    parts.push("AI policies saved");
  }

  if (policies.hasCapabilities) {
    parts.push("capabilities configured");
  }

  if (tenantProfile.tone) {
    parts.push("tone detected");
  }

  if (runtime.language) {
    parts.push(`language: ${runtime.language}`);
  }

  if (!parts.length) {
    return "Tone / language / policy preferences detected";
  }

  return parts.join(" • ");
}

function buildChecklist(readiness = {}) {
  const checks = obj(readiness.checks);
  const tenantProfile = obj(readiness.tenantProfile);
  const sources = obj(readiness.sources);
  const knowledge = obj(readiness.knowledge);
  const catalog = obj(readiness.catalog);

  const sourceTypes = arr(sources.connectedTypes).filter(Boolean);

  return [
    {
      key: "business_profile",
      title: "Business profile",
      complete: !!checks.businessProfile,
      route: SETUP_WIDGET_ROUTE,
      summary: tenantProfile.companyName
        ? `${tenantProfile.companyName}${tenantProfile.description ? " configured" : " partially configured"}`
        : "Company identity is not configured yet",
    },
    {
      key: "channels",
      title: "Channels and sources",
      complete: !!checks.channels,
      route: "/channels",
      summary: sources.activeCount
        ? `${pluralize(sources.activeCount, "active source", "active sources")} connected${sourceTypes.length ? ` • ${sourceTypes.join(", ")}` : ""}`
        : "No active channels or sources connected yet",
    },
    {
      key: "knowledge",
      title: "Knowledge base",
      complete: !!checks.knowledge,
      route: "/truth",
      summary: knowledge.approvedKnowledgeCount
        ? `${pluralize(knowledge.approvedKnowledgeCount, "approved knowledge entry", "approved knowledge entries")}${knowledge.pendingCandidateCount ? ` • ${pluralize(knowledge.pendingCandidateCount, "pending candidate", "pending candidates")}` : ""}`
        : knowledge.pendingCandidateCount
          ? `${pluralize(knowledge.pendingCandidateCount, "pending candidate", "pending candidates")} waiting for review`
          : "No approved knowledge available yet",
    },
    {
      key: "services",
      title: "Service catalog",
      complete: !!checks.services,
      route: SETUP_WIDGET_ROUTE,
      summary: catalog.serviceCount
        ? `${pluralize(catalog.serviceCount, "service entry", "service entries")} available`
        : "Service catalog is still empty",
    },
    {
      key: "playbooks",
      title: "Response playbooks",
      complete: !!checks.playbooks,
      route: "/truth",
      summary: catalog.playbookCount
        ? `${pluralize(catalog.playbookCount, "playbook", "playbooks")} configured`
        : "No response playbooks configured yet",
    },
    {
      key: "policies",
      title: "Runtime preferences",
      complete: !!checks.policies,
      route: "/truth",
      summary: buildPoliciesSummary(readiness),
    },
  ];
}

export async function buildSetupStatus({
  db,
  tenantId,
  tenantKey,
  role = "",
  tenant = null,
}) {
  const readiness = await getWorkspaceReadiness({
    db,
    tenantId,
    tenantKey,
    role,
    tenant,
  });

  const workspaceState = buildActiveWorkspaceContract({
    readiness,
    tenant,
    tenantId,
    tenantKey,
    role,
  });

  return {
    progress: {
      setupCompleted: readiness.setupCompleted,
      readinessScore: readiness.readinessScore,
      readinessLabel: readiness.readinessLabel,
      missingSteps: arr(readiness.missingSteps),
      primaryMissingStep: s(readiness.primaryMissingStep),
      nextRoute: s(workspaceState.routeHint || "/workspace"),
      nextSetupRoute: s(readiness.nextSetupRoute),
      nextStudioStage: s(readiness.nextStudioStage),
    },
    checks: obj(readiness.checks),
    tenantProfile: obj(readiness.tenantProfile),
    runtime: obj(readiness.runtime),
    sources: obj(readiness.sources),
    knowledge: obj(readiness.knowledge),
    catalog: obj(readiness.catalog),
    policies: obj(readiness.policies),
    checklist: buildChecklist(readiness),
  };
}
