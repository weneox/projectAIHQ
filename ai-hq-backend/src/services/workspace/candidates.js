// src/services/workspace/candidates.js
// FINAL v2.1 — canonical knowledge candidate listing + approve/reject flow

import { buildSetupStatus } from "./setup.js";
import { createTenantKnowledgeHelpers } from "../../db/helpers/tenantKnowledge.js";

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

function slugify(value = "") {
  const out = s(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return out || "service";
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

function buildCanonicalServicePayload(candidate = {}) {
  const meta = obj(candidate.value_json);

  const title =
    s(candidate.title) ||
    s(meta.title) ||
    s(meta.name) ||
    s(candidate.value_text);

  if (!title) {
    throw new Error("Approved service candidate is missing a title");
  }

  const serviceKey =
    s(meta.service_key) ||
    s(candidate.item_key) ||
    slugify(title);

  const rawPrice =
    meta.priceFrom ??
    meta.price_from ??
    meta.startingPrice ??
    meta.starting_price;

  const rawDuration =
    meta.durationMinutes ??
    meta.duration_minutes;

  const priceFrom =
    rawPrice === "" || rawPrice == null ? null : num(rawPrice, null);

  const durationMinutes =
    rawDuration === "" || rawDuration == null ? null : num(rawDuration, null);

  return {
    serviceKey,
    title,
    description:
      s(meta.description) ||
      s(meta.summary) ||
      s(candidate.value_text),
    category: lower(candidate.category || "general") || "general",
    priceFrom: priceFrom == null ? null : priceFrom,
    currency: s(meta.currency || "AZN").toUpperCase() || "AZN",
    pricingModel:
      s(meta.pricingModel || meta.pricing_model || "custom_quote").toLowerCase() ||
      "custom_quote",
    durationMinutes: durationMinutes == null ? null : durationMinutes,
    isActive:
      typeof meta.isActive === "boolean"
        ? meta.isActive
        : typeof meta.is_active === "boolean"
          ? meta.is_active
          : true,
    sortOrder: num(meta.sortOrder ?? meta.sort_order, 0),
    highlights: normalizeStringArray(
      meta.highlights ??
        meta.highlightsText ??
        meta.highlights_text ??
        meta.highlights_json
    ),
  };
}

async function upsertTenantServiceFromCandidate({
  db,
  scope,
  candidate,
  reviewedBy = "",
}) {
  const payload = buildCanonicalServicePayload(candidate);

  const existingRes = await q(
    db,
    `
      select *
      from tenant_services
      where tenant_id = $1::uuid
        and (
          service_key = $2
          or lower(title) = lower($3)
        )
      limit 1
    `,
    [scope.tenantId, payload.serviceKey, payload.title]
  );

  const existing = existingRes?.rows?.[0] || null;

  const metadataJson = {
    source: "knowledge_candidate_approval",
    approvedCandidateId: s(candidate.id),
    sourceId: s(candidate.source_id),
    sourceRunId: s(candidate.source_run_id),
    reviewedBy: s(reviewedBy),
    category: s(candidate.category),
    itemKey: s(candidate.item_key),
  };

  if (existing?.id) {
    const resolvedServiceKey = s(existing.service_key || payload.serviceKey);

    const updatedRes = await q(
      db,
      `
        update tenant_services
        set
          tenant_key = $3,
          service_key = $4,
          title = $5,
          description = $6,
          category = $7,
          price_from = $8,
          currency = $9,
          pricing_model = $10,
          duration_minutes = $11,
          is_active = $12,
          sort_order = $13,
          highlights_json = $14::jsonb,
          metadata_json = coalesce(metadata_json, '{}'::jsonb) || $15::jsonb,
          updated_at = now()
        where id = $1::uuid
          and tenant_id = $2::uuid
        returning *
      `,
      [
        s(existing.id),
        scope.tenantId,
        scope.tenantKey,
        resolvedServiceKey,
        payload.title,
        payload.description,
        payload.category,
        payload.priceFrom,
        payload.currency,
        payload.pricingModel,
        payload.durationMinutes,
        payload.isActive,
        payload.sortOrder,
        JSON.stringify(payload.highlights),
        JSON.stringify(metadataJson),
      ]
    );

    return {
      action: "update",
      table: "tenant_services",
      row: updatedRes?.rows?.[0] || existing,
    };
  }

  const insertedRes = await q(
    db,
    `
      insert into tenant_services (
        tenant_id,
        tenant_key,
        service_key,
        title,
        description,
        category,
        price_from,
        currency,
        pricing_model,
        duration_minutes,
        is_active,
        sort_order,
        highlights_json,
        metadata_json
      )
      values (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13::jsonb,
        $14::jsonb
      )
      returning *
    `,
    [
      scope.tenantId,
      scope.tenantKey,
      payload.serviceKey,
      payload.title,
      payload.description,
      payload.category,
      payload.priceFrom,
      payload.currency,
      payload.pricingModel,
      payload.durationMinutes,
      payload.isActive,
      payload.sortOrder,
      JSON.stringify(payload.highlights),
      JSON.stringify(metadataJson),
    ]
  );

  return {
    action: "insert",
    table: "tenant_services",
    row: insertedRes?.rows?.[0] || null,
  };
}

export async function listKnowledgeCandidates({
  db,
  tenantId,
  tenantKey,
  status = "",
  category = "",
  limit = 100,
}) {
  const knowledge = createTenantKnowledgeHelpers({ db });
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
}) {
  const knowledge = createTenantKnowledgeHelpers({ db });
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

  if (isCatalogCategory(candidate.category)) {
    destination = await upsertTenantServiceFromCandidate({
      db,
      scope,
      candidate,
      reviewedBy: reviewer,
    });

    updatedCandidate = await knowledge.updateCandidate(candidate.id, {
      status: "approved",
      approvedItemId: s(destination?.row?.id),
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
        service: destination?.row || null,
      },
      metadataJson: {
        destinationTable: "tenant_services",
        destinationAction: s(destination?.action),
      },
    });
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

  const setup = await buildSetupStatus({
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
}) {
  const knowledge = createTenantKnowledgeHelpers({ db });
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

  const setup = await buildSetupStatus({
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