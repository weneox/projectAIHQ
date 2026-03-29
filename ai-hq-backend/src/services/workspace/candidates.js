// src/services/workspace/candidates.js
// FINAL v2.1 — canonical knowledge candidate listing + approve/reject flow

import { buildSetupStatus } from "./setup.js";
import { createTenantKnowledgeHelpers } from "../../db/helpers/tenantKnowledge.js";
import { stageApprovedServiceCandidateInMaintenanceSession } from "./setup/draftServices.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

function num(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function uniqStrings(list = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const x = s(item);
    if (!x) continue;
    const key = lower(x);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x);
  }

  return out;
}

function normalizeStringArray(input) {
  if (Array.isArray(input)) {
    return uniqStrings(input.map((x) => s(x)).filter(Boolean));
  }

  const text = s(input);
  if (!text) return [];

  return uniqStrings(
    text
      .split(/[,\n|/]+/)
      .map((x) => s(x))
      .filter(Boolean)
  );
}

function isCatalogCategory(category = "") {
  return ["service", "product"].includes(lower(category));
}

function ensureDb(db) {
  if (!db || typeof db.query !== "function") {
    throw new Error("Database client is not available");
  }
}

function normalizeReviewer(reviewedBy = "") {
  return s(reviewedBy);
}

function normalizeCandidateId(candidateId = "") {
  const id = s(candidateId);
  if (!id) {
    throw new Error("Knowledge candidate id is required");
  }
  return id;
}

async function q(db, text, params = []) {
  ensureDb(db);
  return db.query(text, params);
}

async function resolveTenantScope(knowledge, { tenantId, tenantKey }) {
  const tenant = await knowledge.resolveTenantIdentity({ tenantId, tenantKey });

  if (!tenant?.tenant_id && !tenant?.tenant_key) {
    throw new Error("Tenant could not be resolved");
  }

  return {
    tenantId: s(tenant.tenant_id),
    tenantKey: s(tenant.tenant_key),
  };
}

function assertCandidateScope(candidate, scope) {
  const candidateTenantId = s(candidate?.tenant_id);
  const candidateTenantKey = s(candidate?.tenant_key);

  if (scope.tenantId && candidateTenantId && scope.tenantId === candidateTenantId) {
    return;
  }

  if (scope.tenantKey && candidateTenantKey && lower(scope.tenantKey) === lower(candidateTenantKey)) {
    return;
  }

  throw new Error("Knowledge candidate not found");
}

export async function listKnowledgeCandidates({
  db,
  tenantId,
  tenantKey,
  status = "",
  category = "",
  limit = 100,
}, deps = {}) {
  const knowledge = deps.knowledgeHelper || createTenantKnowledgeHelpers({ db });
  const scope = await resolveTenantScope(knowledge, { tenantId, tenantKey });

  const items = await knowledge.listCandidates({
    tenantId: scope.tenantId,
    tenantKey: scope.tenantKey,
    status: s(status),
    category: s(category),
    limit: Math.max(1, Math.min(num(limit, 100), 300)),
    offset: 0,
  });

  const scopedItems = arr(items).filter((item) => {
    try {
      assertCandidateScope(item, scope);
      return true;
    } catch {
      return false;
    }
  });

  return {
    table: "tenant_knowledge_candidates",
    items: scopedItems,
    count: scopedItems.length,
  };
}

export async function approveKnowledgeCandidate({
  db,
  tenantId,
  tenantKey,
  role = "",
  tenant = null,
  candidateId,
  reviewedBy = "",
}, deps = {}) {
  const knowledge = deps.knowledgeHelper || createTenantKnowledgeHelpers({ db });
  const buildSetup =
    deps.buildSetupStatus || buildSetupStatus;
  const stageServiceCandidate =
    deps.stageApprovedServiceCandidateInMaintenanceSession ||
    stageApprovedServiceCandidateInMaintenanceSession;
  const scope = await resolveTenantScope(knowledge, { tenantId, tenantKey });

  const normalizedCandidateId = normalizeCandidateId(candidateId);
  const reviewer = normalizeReviewer(reviewedBy);

  const candidate = await knowledge.getCandidateById(normalizedCandidateId);
  if (!candidate) {
    throw new Error("Knowledge candidate not found");
  }

  assertCandidateScope(candidate, scope);

  let destination;
  let approval;
  let updatedCandidate;
  let publishStatus = "success";
  let reviewRequired = false;
  let maintenanceSession = null;
  let maintenanceDraft = null;

  if (isCatalogCategory(candidate.category)) {
    destination = await stageServiceCandidate({
      db,
      actor: {
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        role,
        tenant,
      },
      candidate,
      reviewedBy: reviewer,
    });

    publishStatus = s(destination?.publishStatus || "review_required");
    reviewRequired = destination?.reviewRequired === true;
    maintenanceSession = obj(destination?.maintenanceSession);
    maintenanceDraft = obj(destination?.maintenanceDraft);

    updatedCandidate = await knowledge.updateCandidate(candidate.id, {
      status: "approved",
      approvedItemId: "",
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
      reviewReason: "",
    });

    approval = await knowledge.createApproval({
      tenantId: scope.tenantId,
      tenantKey: scope.tenantKey,
      candidateId: candidate.id,
      sourceId: s(candidate.source_id) || null,
      action: "approve",
      decision: "approved",
      reviewerType: "human",
      reviewerId: reviewer,
      reviewerName: reviewer,
      reason: "",
      beforeJson: { candidate },
      afterJson: {
        candidate: updatedCandidate,
        maintenanceSession,
        maintenanceDraft,
      },
      metadataJson: {
        destinationTable: "tenant_setup_review_drafts",
        destinationAction: "stage_service_maintenance_review",
        publishStatus,
      },
    });

    destination = {
      action: "stage_service_maintenance_review",
      table: "tenant_setup_review_drafts",
      reviewSessionId: s(maintenanceSession?.id),
      draftVersion: Number(maintenanceDraft?.version || 0) || 0,
      publishStatus,
      reviewRequired,
    };
  } else {
    const result = await knowledge.approveCandidate(candidate.id, {
      reviewerType: "human",
      reviewerId: reviewer,
      reviewerName: reviewer,
      reason: "",
      action: "approve",
      decision: "approved",
      approvedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
    });

    updatedCandidate = result?.candidate || null;
    approval = result?.approval || null;

    destination = {
      action: result?.knowledge?.id ? "upsert" : "noop",
      table: "tenant_knowledge_items",
      row: result?.knowledge || null,
    };
  }

  const setup = await buildSetup({
    db,
    tenantId: scope.tenantId,
    tenantKey: scope.tenantKey,
    role,
    tenant,
  });

  return {
    candidate: updatedCandidate,
    destination,
    approval,
    publishStatus,
    reviewRequired,
    maintenanceSession,
    maintenanceDraft,
    setup,
  };
}

export async function rejectKnowledgeCandidate({
  db,
  tenantId,
  tenantKey,
  role = "",
  tenant = null,
  candidateId,
  reviewedBy = "",
  reason = "",
}, deps = {}) {
  const knowledge = deps.knowledgeHelper || createTenantKnowledgeHelpers({ db });
  const buildSetup =
    deps.buildSetupStatus || buildSetupStatus;
  const scope = await resolveTenantScope(knowledge, { tenantId, tenantKey });

  const normalizedCandidateId = normalizeCandidateId(candidateId);
  const reviewer = normalizeReviewer(reviewedBy);

  const candidate = await knowledge.getCandidateById(normalizedCandidateId);
  if (!candidate) {
    throw new Error("Knowledge candidate not found");
  }

  assertCandidateScope(candidate, scope);

  const result = await knowledge.rejectCandidate(candidate.id, {
    reviewerType: "human",
    reviewerId: reviewer,
    reviewerName: reviewer,
    reason: s(reason),
    action: "reject",
    decision: "rejected",
    reviewedAt: new Date().toISOString(),
  });

  const setup = await buildSetup({
    db,
    tenantId: scope.tenantId,
    tenantKey: scope.tenantKey,
    role,
    tenant,
  });

  return {
    candidate: result?.candidate || null,
    approval: result?.approval || null,
    setup,
  };
}
