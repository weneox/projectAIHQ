// src/services/workspace/bootstrap.js
// FINAL v1.0 — app bootstrap payload

import { arr, lower, obj, s } from "./shared.js";
import { getRowsFromFirstTable } from "./db.js";
import { getWorkspaceReadiness } from "./readiness.js";

const THREAD_TABLES = ["inbox_threads", "threads"];
const COMMENT_TABLES = ["comments"];
const LEAD_TABLES = ["leads"];
const KNOWLEDGE_CANDIDATE_TABLES = ["knowledge_candidates", "tenant_knowledge_candidates"];

function extractUser(user = {}) {
  return {
    id: s(user.id || user.user_id),
    email: s(user.email),
    name: s(user.full_name || user.fullName || user.name || user.display_name),
    role: s(user.role || user.user_role || "member"),
  };
}

function extractTenant(tenant = {}, tenantKey = "", tenantId = "") {
  return {
    id: s(tenant.id || tenant.tenant_id || tenantId),
    key: s(tenant.key || tenant.tenant_key || tenantKey),
    name: s(tenant.name || tenant.display_name || tenant.company_name),
    status: s(tenant.status || tenant.state || "active"),
  };
}

function isPendingThread(item = {}) {
  const status = lower(item.status || item.reply_status || item.state);
  return (
    item.needs_reply === true ||
    item.awaiting_approval === true ||
    ["pending", "open", "needs_reply", "awaiting_approval"].includes(status)
  );
}

function isPendingComment(item = {}) {
  const status = lower(item.status || item.reply_status || item.state);
  return (
    item.needs_reply === true ||
    item.awaiting_approval === true ||
    ["pending", "open", "needs_reply", "awaiting_approval"].includes(status)
  );
}

function isNewLead(item = {}) {
  const stage = lower(item.stage);
  const status = lower(item.status);
  if (!stage && !status) return true;
  return stage === "new" || status === "new" || status === "open";
}

function isPendingCandidate(item = {}) {
  const status = lower(item.status || item.review_status || item.state);
  if (!status) return true;
  return ["pending", "review", "awaiting_review"].includes(status);
}

async function getOperationalCounts({ db, tenantId, tenantKey }) {
  const scope = { tenantId, tenantKey };

  const { rows: threadRows } = await getRowsFromFirstTable(db, THREAD_TABLES, scope, {
    limit: 500,
  });

  const { rows: commentRows } = await getRowsFromFirstTable(db, COMMENT_TABLES, scope, {
    limit: 500,
  });

  const { rows: leadRows } = await getRowsFromFirstTable(db, LEAD_TABLES, scope, {
    limit: 500,
  });

  const { rows: candidateRows } = await getRowsFromFirstTable(
    db,
    KNOWLEDGE_CANDIDATE_TABLES,
    scope,
    { limit: 500 }
  );

  return {
    pendingInbox: threadRows.filter(isPendingThread).length,
    pendingComments: commentRows.filter(isPendingComment).length,
    newLeads: leadRows.filter(isNewLead).length,
    knowledgeCandidates: candidateRows.filter(isPendingCandidate).length,
  };
}

export async function buildAppBootstrap({
  db,
  user,
  tenant,
  tenantId,
  tenantKey,
}) {
  const safeUser = extractUser(obj(user));
  const safeTenant = extractTenant(obj(tenant), tenantKey, tenantId);

  const readiness = await getWorkspaceReadiness({
    db,
    tenantId: safeTenant.id,
    tenantKey: safeTenant.key,
    role: safeUser.role,
    tenant: safeTenant,
  });

  const counts = await getOperationalCounts({
    db,
    tenantId: safeTenant.id,
    tenantKey: safeTenant.key,
  });

  return {
    user: safeUser,
    tenant: safeTenant,
    workspace: {
      setupCompleted: readiness.setupCompleted,
      readinessScore: readiness.readinessScore,
      readinessLabel: readiness.readinessLabel,
      missingSteps: arr(readiness.missingSteps),
      primaryMissingStep: s(readiness.primaryMissingStep),
      nextRoute: s(readiness.nextRoute),
      nextSetupRoute: s(readiness.nextSetupRoute),
      checks: obj(readiness.checks),
    },
    counts,
    runtime: obj(readiness.runtime),
    setup: {
      businessProfile: obj(readiness.tenantProfile),
      sources: obj(readiness.sources),
      knowledge: obj(readiness.knowledge),
      catalog: obj(readiness.catalog),
    },
    navigation: {
      initialRoute: s(readiness.nextRoute),
      setupRoute: s(readiness.nextSetupRoute || "/setup"),
    },
  };
}