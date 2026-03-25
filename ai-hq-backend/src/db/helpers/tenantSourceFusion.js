// src/db/helpers/tenantSourceFusion.js
// FINAL v1.0 — source observations + synthesis snapshots

import { createTenantKnowledgeHelpers } from "./tenantKnowledge.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

function iso(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function lower(v) {
  return s(v).toLowerCase();
}

function hasQueryApi(db) {
  return !!db && typeof db.query === "function";
}

async function q(db, text, params = []) {
  if (!hasQueryApi(db)) {
    throw new Error("tenantSourceFusion: db.query(...) is required");
  }
  return db.query(text, params);
}

async function withTx(db, fn) {
  await q(db, "begin");
  try {
    const out = await fn();
    await q(db, "commit");
    return out;
  } catch (err) {
    try {
      await q(db, "rollback");
    } catch {}
    throw err;
  }
}

function normalizeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      return fallback;
    }
  }
  if (typeof value === "object") return value;
  return fallback;
}

function normalizeConfidence(v, d = 0) {
  const x = Number(v);
  if (!Number.isFinite(x)) return d;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function normalizeConfidenceLabel(v) {
  const x = lower(v);
  if (["low", "medium", "high", "very_high"].includes(x)) return x;
  return "low";
}

function normalizeResolutionStatus(v) {
  const x = lower(v);
  if (["pending", "resolved", "conflict", "ignored", "superseded"].includes(x)) return x;
  return "pending";
}

function rowToObservation(row) {
  if (!row) return null;

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),

    source_id: s(row.source_id),
    source_run_id: s(row.source_run_id),
    source_type: s(row.source_type),

    observation_group: s(row.observation_group),
    claim_type: s(row.claim_type),
    claim_key: s(row.claim_key),

    raw_value_text: s(row.raw_value_text),
    raw_value_json: normalizeJson(row.raw_value_json, {}),

    normalized_value_text: s(row.normalized_value_text),
    normalized_value_json: normalizeJson(row.normalized_value_json, {}),

    evidence_text: s(row.evidence_text),
    page_url: s(row.page_url),
    page_title: s(row.page_title),

    confidence: normalizeConfidence(row.confidence, 0),
    confidence_label: normalizeConfidenceLabel(row.confidence_label),

    resolution_status: normalizeResolutionStatus(row.resolution_status),
    conflict_key: s(row.conflict_key),

    extraction_method: s(row.extraction_method),
    extraction_model: s(row.extraction_model),

    metadata_json: normalizeJson(row.metadata_json, {}),

    first_seen_at: iso(row.first_seen_at),
    last_seen_at: iso(row.last_seen_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function rowToSnapshot(row) {
  if (!row) return null;

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),
    source_run_id: s(row.source_run_id),

    synthesis_version: s(row.synthesis_version),
    status: s(row.status),
    is_current: !!row.is_current,

    sources_json: normalizeJson(row.sources_json, []),
    observations_json: normalizeJson(row.observations_json, {}),
    conflicts_json: normalizeJson(row.conflicts_json, []),

    profile_json: normalizeJson(row.profile_json, {}),
    capabilities_json: normalizeJson(row.capabilities_json, {}),
    knowledge_items_json: normalizeJson(row.knowledge_items_json, []),

    summary_text: s(row.summary_text),
    confidence: normalizeConfidence(row.confidence, 0),
    confidence_label: normalizeConfidenceLabel(row.confidence_label),

    metadata_json: normalizeJson(row.metadata_json, {}),

    created_by: s(row.created_by),
    approved_by: s(row.approved_by),

    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

export function createTenantSourceFusionHelpers({ db }) {
  if (!hasQueryApi(db)) {
    throw new Error("createTenantSourceFusionHelpers: valid db.query(...) adapter required");
  }

  const knowledge = createTenantKnowledgeHelpers({ db });

  return {
    async resolveTenantIdentity(input = {}) {
      return knowledge.resolveTenantIdentity(input);
    },

    async createObservation(input = {}) {
      const tenant = await knowledge.resolveTenantIdentity({
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
      });

      if (!tenant) {
        throw new Error("tenantSourceFusion.createObservation: tenant not found");
      }

      const r = await q(
        db,
        `
        insert into tenant_source_observations (
          tenant_id,
          tenant_key,
          source_id,
          source_run_id,
          source_type,
          observation_group,
          claim_type,
          claim_key,
          raw_value_text,
          raw_value_json,
          normalized_value_text,
          normalized_value_json,
          evidence_text,
          page_url,
          page_title,
          confidence,
          confidence_label,
          resolution_status,
          conflict_key,
          extraction_method,
          extraction_model,
          metadata_json,
          first_seen_at,
          last_seen_at
        )
        values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13,$14,$15,
          $16,$17,$18,$19,$20,$21,$22::jsonb,$23,$24
        )
        returning *
        `,
        [
          tenant.tenant_id,
          tenant.tenant_key,
          s(input.sourceId) || null,
          s(input.sourceRunId) || null,
          s(input.sourceType),
          s(input.observationGroup || "general"),
          s(input.claimType),
          s(input.claimKey),
          s(input.rawValueText),
          JSON.stringify(obj(input.rawValueJson, {})),
          s(input.normalizedValueText),
          JSON.stringify(obj(input.normalizedValueJson, {})),
          s(input.evidenceText),
          s(input.pageUrl),
          s(input.pageTitle),
          normalizeConfidence(input.confidence, 0),
          normalizeConfidenceLabel(input.confidenceLabel),
          normalizeResolutionStatus(input.resolutionStatus),
          s(input.conflictKey),
          s(input.extractionMethod || "parser"),
          s(input.extractionModel),
          JSON.stringify(obj(input.metadataJson, {})),
          input.firstSeenAt || new Date().toISOString(),
          input.lastSeenAt || new Date().toISOString(),
        ]
      );

      return rowToObservation(r.rows[0]);
    },

    async createObservationsBulk(items = []) {
      const out = [];
      for (const item of arr(items)) {
        out.push(await this.createObservation(item));
      }
      return out;
    },

    async listObservations({
      tenantId,
      tenantKey,
      sourceId = "",
      sourceRunId = "",
      sourceType = "",
      claimType = "",
      resolutionStatus = "",
      limit = 2500,
      offset = 0,
    } = {}) {
      const tenant = await knowledge.resolveTenantIdentity({ tenantId, tenantKey });
      if (!tenant) return [];

      const params = [tenant.tenant_id];
      let idx = 1;
      let where = `where tenant_id = $1`;

      if (s(sourceId)) {
        idx += 1;
        params.push(s(sourceId));
        where += ` and source_id = $${idx}`;
      }

      if (s(sourceRunId)) {
        idx += 1;
        params.push(s(sourceRunId));
        where += ` and source_run_id = $${idx}`;
      }

      if (s(sourceType)) {
        idx += 1;
        params.push(s(sourceType));
        where += ` and lower(source_type) = lower($${idx})`;
      }

      if (s(claimType)) {
        idx += 1;
        params.push(s(claimType));
        where += ` and lower(claim_type) = lower($${idx})`;
      }

      if (s(resolutionStatus)) {
        idx += 1;
        params.push(normalizeResolutionStatus(resolutionStatus));
        where += ` and resolution_status = $${idx}`;
      }

      idx += 1;
      params.push(Math.max(1, Math.min(10000, n(limit, 2500))));
      const limitIdx = idx;

      idx += 1;
      params.push(Math.max(0, n(offset, 0)));
      const offsetIdx = idx;

      const r = await q(
        db,
        `
        select *
        from tenant_source_observations
        ${where}
        order by created_at desc, confidence desc
        limit $${limitIdx}
        offset $${offsetIdx}
        `,
        params
      );

      return r.rows.map(rowToObservation);
    },

    async createSynthesisSnapshot(input = {}) {
      const tenant = await knowledge.resolveTenantIdentity({
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
      });

      if (!tenant) {
        throw new Error("tenantSourceFusion.createSynthesisSnapshot: tenant not found");
      }

      return withTx(db, async () => {
        if (input.isCurrent) {
          await q(
            db,
            `
            update tenant_business_synthesis_snapshots
            set
              is_current = false,
              updated_at = now()
            where tenant_id = $1
              and is_current = true
            `,
            [tenant.tenant_id]
          );
        }

        const r = await q(
          db,
          `
          insert into tenant_business_synthesis_snapshots (
            tenant_id,
            tenant_key,
            source_run_id,
            synthesis_version,
            status,
            is_current,
            sources_json,
            observations_json,
            conflicts_json,
            profile_json,
            capabilities_json,
            knowledge_items_json,
            summary_text,
            confidence,
            confidence_label,
            metadata_json,
            created_by,
            approved_by
          )
          values (
            $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,
            $13,$14,$15,$16::jsonb,$17,$18
          )
          returning *
          `,
          [
            tenant.tenant_id,
            tenant.tenant_key,
            s(input.sourceRunId) || null,
            s(input.synthesisVersion || "source_fusion_v1"),
            s(input.status || "generated"),
            !!input.isCurrent,
            JSON.stringify(arr(input.sourcesJson, [])),
            JSON.stringify(obj(input.observationsJson, {})),
            JSON.stringify(arr(input.conflictsJson, [])),
            JSON.stringify(obj(input.profileJson, {})),
            JSON.stringify(obj(input.capabilitiesJson, {})),
            JSON.stringify(arr(input.knowledgeItemsJson, [])),
            s(input.summaryText),
            normalizeConfidence(input.confidence, 0),
            normalizeConfidenceLabel(input.confidenceLabel),
            JSON.stringify(obj(input.metadataJson, {})),
            s(input.createdBy),
            s(input.approvedBy),
          ]
        );

        return rowToSnapshot(r.rows[0]);
      });
    },

    async getLatestSynthesisSnapshot({ tenantId, tenantKey, currentOnly = true } = {}) {
      const tenant = await knowledge.resolveTenantIdentity({ tenantId, tenantKey });
      if (!tenant) return null;

      const params = [tenant.tenant_id];
      let where = `where tenant_id = $1`;

      if (currentOnly) {
        where += ` and is_current = true`;
      }

      const r = await q(
        db,
        `
        select *
        from tenant_business_synthesis_snapshots
        ${where}
        order by created_at desc
        limit 1
        `,
        params
      );

      return rowToSnapshot(r.rows[0]);
    },
  };
}

export default createTenantSourceFusionHelpers;