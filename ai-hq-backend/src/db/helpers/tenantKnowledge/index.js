import {
  s,
  n,
  b,
  obj,
  arr,
  hasQueryApi,
  normalizeCategory,
  normalizeCandidateStatus,
  normalizeKnowledgeStatus,
  normalizeConfidence,
  normalizeConfidenceLabel,
  normalizeJson,
  iso,
  buildCanonicalKey,
} from "./shared.js";
import {
  q,
  resolveTenantIdentity,
  withTx,
  refreshRuntimeProjectionBestEffort,
  refreshRuntimeProjectionRequired,
  getCandidateByIdInternal,
  getKnowledgeItemByIdInternal,
  getKnowledgeItemByCanonicalKeyInternal,
  getBusinessProfileInternal,
  getBusinessCapabilitiesInternal,
} from "./core.js";
import {
  insertCandidateInternal,
  updateCandidateInternal,
  insertKnowledgeItemInternal,
  updateKnowledgeItemInternal,
  upsertKnowledgeItemInternal,
  upsertBusinessProfileInternal,
  upsertBusinessCapabilitiesInternal,
  createApprovalInternal,
} from "./writers.js";
import { mergeKnowledgeItem, resolveWriteIntent } from "./merge.js";
import { projectApprovedCandidateToCanonicalInternal } from "./projection.js";
import { rowToApproval } from "./mappers.js";

export function createTenantKnowledgeHelpers({ db }) {
  if (!hasQueryApi(db)) {
    throw new Error("createTenantKnowledgeHelpers: valid db.query(...) adapter required");
  }

  const helpers = {
    async resolveTenantIdentity(input = {}) {
      return resolveTenantIdentity(db, input);
    },

    async createCandidate(input = {}) {
      const tenant = await resolveTenantIdentity(db, {
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
      });
      if (!tenant) throw new Error("tenantKnowledge.createCandidate: tenant not found");

      return insertCandidateInternal(db, tenant, input);
    },

    async createCandidatesBulk(items = []) {
      return withTx(db, async (tx) => {
        const out = [];

        for (const item of arr(items)) {
          const tenant = await resolveTenantIdentity(tx, {
            tenantId: item?.tenantId,
            tenantKey: item?.tenantKey,
          });
          if (!tenant) continue;

          out.push(await insertCandidateInternal(tx, tenant, item));
        }

        return out;
      });
    },

    async getCandidateById(candidateId) {
      return getCandidateByIdInternal(db, candidateId);
    },

    async listCandidates({
      tenantId,
      tenantKey,
      sourceId = "",
      sourceRunId = "",
      category = "",
      status = "",
      limit = 100,
      offset = 0,
    } = {}) {
      const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
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

      if (s(category)) {
        idx += 1;
        params.push(normalizeCategory(category));
        where += ` and category = $${idx}`;
      }

      if (s(status)) {
        idx += 1;
        params.push(normalizeCandidateStatus(status));
        where += ` and status = $${idx}`;
      }

      idx += 1;
      params.push(Math.max(1, Math.min(500, n(limit, 100))));
      const limitIdx = idx;

      idx += 1;
      params.push(Math.max(0, n(offset, 0)));
      const offsetIdx = idx;

      const r = await q(
        db,
        `
        select *
        from tenant_knowledge_candidates
        ${where}
        order by confidence desc, updated_at desc, created_at desc
        limit $${limitIdx}
        offset $${offsetIdx}
        `,
        params
      );

      return r.rows.map((row) => ({
        id: s(row.id),
        tenant_id: s(row.tenant_id),
        tenant_key: s(row.tenant_key),
        source_id: s(row.source_id),
        source_run_id: s(row.source_run_id),
        candidate_group: s(row.candidate_group),
        category: normalizeCategory(row.category),
        item_key: s(row.item_key),
        title: s(row.title),
        value_text: s(row.value_text),
        value_json: normalizeJson(row.value_json, {}),
        normalized_text: s(row.normalized_text),
        normalized_json: normalizeJson(row.normalized_json, {}),
        confidence: normalizeConfidence(row.confidence, 0),
        confidence_label: normalizeConfidenceLabel(row.confidence_label),
        status: normalizeCandidateStatus(row.status),
        review_reason: s(row.review_reason),
        conflict_hash: s(row.conflict_hash),
        source_evidence_json: normalizeJson(row.source_evidence_json, []),
        first_seen_at: iso(row.first_seen_at),
        last_seen_at: iso(row.last_seen_at),
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
      }));
    },

    async updateCandidate(candidateId, patch = {}) {
      return updateCandidateInternal(db, candidateId, patch);
    },

    async listReviewQueue({
      tenantId,
      tenantKey,
      category = "",
      status = "",
      limit = 100,
      offset = 0,
    } = {}) {
      const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
      if (!tenant) return [];

      const params = [tenant.tenant_id];
      let idx = 1;
      let where = `where tenant_id = $1`;

      if (s(category)) {
        idx += 1;
        params.push(normalizeCategory(category));
        where += ` and category = $${idx}`;
      }

      if (s(status)) {
        idx += 1;
        params.push(normalizeCandidateStatus(status));
        where += ` and status = $${idx}`;
      } else {
        where += ` and status in ('pending','needs_review','conflict')`;
      }

      idx += 1;
      params.push(Math.max(1, Math.min(500, n(limit, 100))));
      const limitIdx = idx;

      idx += 1;
      params.push(Math.max(0, n(offset, 0)));
      const offsetIdx = idx;

      const r = await q(
        db,
        `
        select *
        from v_tenant_knowledge_review_queue
        ${where}
        order by confidence desc, created_at desc
        limit $${limitIdx}
        offset $${offsetIdx}
        `,
        params
      );

      return r.rows.map((row) => ({
        id: s(row.id),
        tenant_id: s(row.tenant_id),
        tenant_key: s(row.tenant_key),
        source_id: s(row.source_id),
        source_type: s(row.source_type),
        source_display_name: s(row.source_display_name),
        source_run_id: s(row.source_run_id),
        category: normalizeCategory(row.category),
        item_key: s(row.item_key),
        title: s(row.title),
        value_text: s(row.value_text),
        value_json: normalizeJson(row.value_json, {}),
        confidence: normalizeConfidence(row.confidence, 0),
        confidence_label: normalizeConfidenceLabel(row.confidence_label),
        status: normalizeCandidateStatus(row.status),
        review_reason: s(row.review_reason),
        conflict_hash: s(row.conflict_hash),
        source_evidence_json: normalizeJson(row.source_evidence_json, []),
        first_seen_at: iso(row.first_seen_at),
        last_seen_at: iso(row.last_seen_at),
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
      }));
    },

    async createKnowledgeItem(input = {}) {
      const tenant = await resolveTenantIdentity(db, {
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
      });
      if (!tenant) throw new Error("tenantKnowledge.createKnowledgeItem: tenant not found");

      const row = await insertKnowledgeItemInternal(db, tenant, input);

      await refreshRuntimeProjectionRequired(db, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        triggerType: "review_approval",
        requestedBy: s(input.createdBy || input.updatedBy || "tenantKnowledge.createKnowledgeItem"),
        runnerKey: "tenantKnowledge.createKnowledgeItem",
        generatedBy: s(input.approvedBy || input.createdBy || "system"),
        metadata: {
          source: "createKnowledgeItem",
          knowledgeItemId: row?.id || "",
        },
      });

      return row;
    },

    async upsertKnowledgeItem(input = {}) {
      const row = await upsertKnowledgeItemInternal(db, input);

      await refreshRuntimeProjectionRequired(db, {
        tenantId: row?.tenant_id,
        tenantKey: row?.tenant_key,
        triggerType: "review_approval",
        requestedBy: s(
          input.updatedBy ||
            input.approvedBy ||
            input.createdBy ||
            "tenantKnowledge.upsertKnowledgeItem"
        ),
        runnerKey: "tenantKnowledge.upsertKnowledgeItem",
        generatedBy: s(input.approvedBy || input.createdBy || "system"),
        metadata: {
          source: "upsertKnowledgeItem",
          knowledgeItemId: row?.id || "",
        },
      });

      return row;
    },

    async getKnowledgeItemById(id) {
      return getKnowledgeItemByIdInternal(db, id);
    },

    async getKnowledgeItemByCanonicalKey({ tenantId, tenantKey, canonicalKey }) {
      return getKnowledgeItemByCanonicalKeyInternal(db, { tenantId, tenantKey, canonicalKey });
    },

    async listKnowledgeItems({
      tenantId,
      tenantKey,
      category = "",
      status = "",
      activeOnly = false,
      limit = 200,
      offset = 0,
    } = {}) {
      const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
      if (!tenant) return [];

      const params = [tenant.tenant_id];
      let idx = 1;
      let where = `where tenant_id = $1`;

      if (s(category)) {
        idx += 1;
        params.push(normalizeCategory(category));
        where += ` and category = $${idx}`;
      }

      if (activeOnly) {
        where += ` and status in ('approved','active')`;
      } else if (s(status)) {
        idx += 1;
        params.push(normalizeKnowledgeStatus(status));
        where += ` and status = $${idx}`;
      }

      idx += 1;
      params.push(Math.max(1, Math.min(500, n(limit, 200))));
      const limitIdx = idx;

      idx += 1;
      params.push(Math.max(0, n(offset, 0)));
      const offsetIdx = idx;

      const r = await q(
        db,
        `
        select *
        from tenant_knowledge_items
        ${where}
        order by priority asc, updated_at desc, created_at desc
        limit $${limitIdx}
        offset $${offsetIdx}
        `,
        params
      );

      return r.rows.map((row) => ({
        id: s(row.id),
        tenant_id: s(row.tenant_id),
        tenant_key: s(row.tenant_key),
        canonical_key: s(row.canonical_key),
        category: normalizeCategory(row.category),
        item_key: s(row.item_key),
        title: s(row.title),
        value_text: s(row.value_text),
        value_json: normalizeJson(row.value_json, {}),
        normalized_text: s(row.normalized_text),
        normalized_json: normalizeJson(row.normalized_json, {}),
        status: normalizeKnowledgeStatus(row.status),
        priority: n(row.priority, 100),
        confidence: normalizeConfidence(row.confidence, 1),
        source_count: n(row.source_count, 0),
        primary_source_id: s(row.primary_source_id),
        source_evidence_json: normalizeJson(row.source_evidence_json, []),
        tags_json: normalizeJson(row.tags_json, []),
        metadata_json: normalizeJson(row.metadata_json, {}),
        created_at: iso(row.created_at),
        approved_at: iso(row.approved_at),
        updated_at: iso(row.updated_at),
      }));
    },

    async listActiveKnowledge({ tenantId, tenantKey, category = "" } = {}) {
      const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
      if (!tenant) return [];

      const params = [tenant.tenant_id];
      let idx = 1;
      let where = `where tenant_id = $1`;

      if (s(category)) {
        idx += 1;
        params.push(normalizeCategory(category));
        where += ` and category = $${idx}`;
      }

      const r = await q(
        db,
        `
        select *
        from v_tenant_active_knowledge
        ${where}
        order by priority asc, updated_at desc
        `,
        params
      );

      return r.rows.map((row) => ({
        id: s(row.id),
        tenant_id: s(row.tenant_id),
        tenant_key: s(row.tenant_key),
        canonical_key: s(row.canonical_key),
        category: normalizeCategory(row.category),
        item_key: s(row.item_key),
        title: s(row.title),
        value_text: s(row.value_text),
        value_json: normalizeJson(row.value_json, {}),
        normalized_text: s(row.normalized_text),
        normalized_json: normalizeJson(row.normalized_json, {}),
        priority: n(row.priority, 100),
        confidence: normalizeConfidence(row.confidence, 1),
        source_count: n(row.source_count, 0),
        primary_source_id: s(row.primary_source_id),
        primary_source_type: s(row.primary_source_type),
        primary_source_display_name: s(row.primary_source_display_name),
        source_evidence_json: normalizeJson(row.source_evidence_json, []),
        tags_json: normalizeJson(row.tags_json, []),
        metadata_json: normalizeJson(row.metadata_json, {}),
        created_at: iso(row.created_at),
        approved_at: iso(row.approved_at),
        updated_at: iso(row.updated_at),
      }));
    },

    async updateKnowledgeItem(id, patch = {}) {
      const current = await getKnowledgeItemByIdInternal(db, id);
      if (!current) return null;

      const merged = mergeKnowledgeItem(current, patch, {
        intent: resolveWriteIntent(patch, "manual"),
      });

      const row = await updateKnowledgeItemInternal(db, id, {
        ...merged,
        canonicalKey: merged.canonical_key,
        itemKey: merged.item_key,
        valueText: merged.value_text,
        valueJson: merged.value_json,
        normalizedText: merged.normalized_text,
        normalizedJson: merged.normalized_json,
        sourceCount: merged.source_count,
        primarySourceId: merged.primary_source_id,
        sourceEvidenceJson: merged.source_evidence_json,
        approvalMode: merged.approval_mode,
        approvedFromCandidateId: merged.approved_from_candidate_id,
        effectiveFrom: merged.effective_from,
        effectiveTo: merged.effective_to,
        tagsJson: merged.tags_json,
        metadataJson: merged.metadata_json,
        createdBy: merged.created_by,
        approvedBy: merged.approved_by,
        updatedBy: patch.updatedBy || merged.updated_by,
        approvedAt: merged.approved_at,
      });

      await refreshRuntimeProjectionRequired(db, {
        tenantId: row?.tenant_id,
        tenantKey: row?.tenant_key,
        triggerType: "review_approval",
        requestedBy: s(
          patch.updatedBy || patch.approvedBy || "tenantKnowledge.updateKnowledgeItem"
        ),
        runnerKey: "tenantKnowledge.updateKnowledgeItem",
        generatedBy: s(patch.approvedBy || patch.updatedBy || "system"),
        metadata: {
          source: "updateKnowledgeItem",
          knowledgeItemId: row?.id || "",
        },
      });

      return row;
    },

    async archiveKnowledgeItem(id, updatedBy = "") {
      return helpers.updateKnowledgeItem(id, {
        status: "archived",
        updatedBy,
      });
    },

    async createApproval(input = {}) {
      return createApprovalInternal(db, input);
    },

    async listApprovals({
      tenantId,
      tenantKey,
      candidateId = "",
      knowledgeItemId = "",
      limit = 100,
      offset = 0,
    } = {}) {
      const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
      if (!tenant) return [];

      const params = [tenant.tenant_id];
      let idx = 1;
      let where = `where tenant_id = $1`;

      if (s(candidateId)) {
        idx += 1;
        params.push(s(candidateId));
        where += ` and candidate_id = $${idx}`;
      }

      if (s(knowledgeItemId)) {
        idx += 1;
        params.push(s(knowledgeItemId));
        where += ` and knowledge_item_id = $${idx}`;
      }

      idx += 1;
      params.push(Math.max(1, Math.min(500, n(limit, 100))));
      const limitIdx = idx;

      idx += 1;
      params.push(Math.max(0, n(offset, 0)));
      const offsetIdx = idx;

      const r = await q(
        db,
        `
        select *
        from tenant_knowledge_approvals
        ${where}
        order by created_at desc
        limit $${limitIdx}
        offset $${offsetIdx}
        `,
        params
      );

      return r.rows.map(rowToApproval);
    },

    async getBusinessProfile({ tenantId, tenantKey }) {
      return getBusinessProfileInternal(db, { tenantId, tenantKey });
    },

    async upsertBusinessProfile(input = {}) {
      const row = await upsertBusinessProfileInternal(db, input);

      await refreshRuntimeProjectionRequired(db, {
        tenantId: row?.tenant_id,
        tenantKey: row?.tenant_key,
        triggerType: "manual",
        requestedBy: s(
          input.approvedBy || input.generatedBy || "tenantKnowledge.upsertBusinessProfile"
        ),
        runnerKey: "tenantKnowledge.upsertBusinessProfile",
        generatedBy: s(input.generatedBy || input.approvedBy || "system"),
        metadata: {
          source: "upsertBusinessProfile",
          profileId: row?.id || "",
        },
      });

      return row;
    },

    async getBusinessCapabilities({ tenantId, tenantKey }) {
      return getBusinessCapabilitiesInternal(db, { tenantId, tenantKey });
    },

    async upsertBusinessCapabilities(input = {}) {
      const row = await upsertBusinessCapabilitiesInternal(db, input);

      await refreshRuntimeProjectionRequired(db, {
        tenantId: row?.tenant_id,
        tenantKey: row?.tenant_key,
        triggerType: "manual",
        requestedBy: s(input.approvedBy || "tenantKnowledge.upsertBusinessCapabilities"),
        runnerKey: "tenantKnowledge.upsertBusinessCapabilities",
        generatedBy: s(input.approvedBy || "system"),
        metadata: {
          source: "upsertBusinessCapabilities",
          capabilitiesId: row?.id || "",
        },
      });

      return row;
    },

    async projectApprovedCandidateToCanonical(candidateId, options = {}) {
      const candidate = await getCandidateByIdInternal(db, candidateId);
      if (!candidate) return null;

      return withTx(db, async (tx) => {
        return projectApprovedCandidateToCanonicalInternal(tx, candidate, options);
      });
    },

    async approveCandidate(candidateId, options = {}) {
      const candidate = await getCandidateByIdInternal(db, candidateId);
      if (!candidate) return null;

      const tenant = {
        tenantId: candidate.tenant_id,
        tenantKey: candidate.tenant_key,
      };

      return withTx(db, async (tx) => {
        const beforeCandidate = candidate;

        const knowledge = await upsertKnowledgeItemInternal(tx, {
          tenantId: tenant.tenantId,
          tenantKey: tenant.tenantKey,
          canonicalKey:
            s(options.canonicalKey) ||
            buildCanonicalKey(
              candidate.category,
              options.itemKey || candidate.item_key,
              candidate.value_text || candidate.title
            ),
          category: options.category || candidate.category,
          itemKey: options.itemKey || candidate.item_key,
          title: options.title || candidate.title,
          valueText: options.valueText || candidate.value_text,
          valueJson: options.valueJson !== undefined ? options.valueJson : candidate.value_json,
          normalizedText:
            options.normalizedText !== undefined ? options.normalizedText : candidate.normalized_text,
          normalizedJson:
            options.normalizedJson !== undefined ? options.normalizedJson : candidate.normalized_json,
          status: options.knowledgeStatus || "approved",
          priority: options.priority ?? 100,
          confidence: options.confidence ?? candidate.confidence,
          sourceCount: options.sourceCount ?? 1,
          primarySourceId: options.primarySourceId || candidate.source_id || null,
          sourceEvidenceJson:
            options.sourceEvidenceJson !== undefined
              ? options.sourceEvidenceJson
              : candidate.source_evidence_json,
          approvalMode: options.approvalMode || "promoted",
          approvedFromCandidateId: candidate.id,
          tagsJson: options.tagsJson || [],
          metadataJson: {
            ...obj(options.metadataJson, {}),
            projection_source: "candidate_approval",
          },
          createdBy: options.createdBy || options.reviewerId || "",
          approvedBy: options.approvedBy || options.reviewerId || "",
          updatedBy: options.updatedBy || options.reviewerId || "",
          approvedAt: options.approvedAt || new Date().toISOString(),
          writeIntent: "approved_projection",
        });

        const updatedCandidate = await updateCandidateInternal(tx, candidate.id, {
          status: options.candidateStatus || "approved",
          approvedItemId: knowledge.id,
          reviewedBy: options.reviewerId || "",
          reviewedAt: options.reviewedAt || new Date().toISOString(),
          reviewReason: options.reason || "",
        });

        const projection =
          options.projectToCanonical === false
            ? { profile: null, capabilities: null, runtimeProjection: null }
            : await projectApprovedCandidateToCanonicalInternal(tx, updatedCandidate, {
                reviewerId: options.reviewerId || "",
                reviewerName: options.reviewerName || "",
              });

        const approval = await createApprovalInternal(tx, {
          tenantId: tenant.tenantId,
          tenantKey: tenant.tenantKey,
          candidateId: candidate.id,
          knowledgeItemId: knowledge.id,
          sourceId: candidate.source_id,
          action: options.action || "approve",
          decision: options.decision || "approved",
          reviewerType: options.reviewerType || "human",
          reviewerId: options.reviewerId || "",
          reviewerName: options.reviewerName || "",
          reason: options.reason || "",
          beforeJson: {
            candidate: beforeCandidate,
          },
          afterJson: {
            candidate: updatedCandidate,
            knowledge,
            projection,
          },
          metadataJson: obj(options.metadataJson, {}),
        });

        const runtimeProjection =
          options.projectToCanonical === false
            ? await refreshRuntimeProjectionRequired(tx, {
                tenantId: tenant.tenantId,
                tenantKey: tenant.tenantKey,
                triggerType: "review_approval",
                requestedBy: s(options.reviewerId || "candidate_approval"),
                runnerKey: "tenantKnowledge.approveCandidate",
                generatedBy: s(options.reviewerName || options.reviewerId || "system"),
                metadata: {
                  source: "approveCandidate",
                  candidateId: candidate.id,
                  knowledgeItemId: knowledge.id,
                },
              })
            : projection?.runtimeProjection || null;

        return {
          candidate: updatedCandidate,
          knowledge,
          approval,
          projection: {
            ...obj(projection),
            runtimeProjection,
          },
        };
      });
    },

    async rejectCandidate(candidateId, options = {}) {
      const candidate = await getCandidateByIdInternal(db, candidateId);
      if (!candidate) return null;

      const updatedCandidate = await updateCandidateInternal(db, candidate.id, {
        status: "rejected",
        reviewedBy: options.reviewerId || "",
        reviewedAt: options.reviewedAt || new Date().toISOString(),
        reviewReason: options.reason || "",
      });

      const approval = await createApprovalInternal(db, {
        tenantId: candidate.tenant_id,
        tenantKey: candidate.tenant_key,
        candidateId: candidate.id,
        sourceId: candidate.source_id,
        action: options.action || "reject",
        decision: options.decision || "rejected",
        reviewerType: options.reviewerType || "human",
        reviewerId: options.reviewerId || "",
        reviewerName: options.reviewerName || "",
        reason: options.reason || "",
        beforeJson: { candidate },
        afterJson: { candidate: updatedCandidate },
        metadataJson: obj(options.metadataJson, {}),
      });

      return {
        candidate: updatedCandidate,
        approval,
      };
    },

    async markCandidateConflict(candidateId, options = {}) {
      const candidate = await getCandidateByIdInternal(db, candidateId);
      if (!candidate) return null;

      return updateCandidateInternal(db, candidate.id, {
        status: "conflict",
        reviewReason: options.reason || candidate.review_reason,
        conflictHash: options.conflictHash || candidate.conflict_hash,
        reviewedBy: options.reviewerId || candidate.reviewed_by,
        reviewedAt: options.reviewedAt || candidate.reviewed_at,
      });
    },

    async refreshChannelCapabilitiesFromSources({ tenantId, tenantKey, approvedBy = "" } = {}) {
      const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
      if (!tenant) return null;

      const r = await q(
        db,
        `
        select source_type, is_enabled, status
        from tenant_sources
        where tenant_id = $1
          and is_enabled = true
          and status in ('connected','pending')
        `,
        [tenant.tenant_id]
      );

      const types = new Set(
        r.rows
          .filter((x) => b(x.is_enabled, true))
          .map((x) => s(x.source_type))
          .filter(Boolean)
      );

      const current = (await getBusinessCapabilitiesInternal(db, tenant)) || {};

      const row = await upsertBusinessCapabilitiesInternal(db, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        writeIntent: "approved_projection",
        canSharePrices: current.can_share_prices,
        canShareStartingPrices: current.can_share_starting_prices,
        requiresHumanForCustomQuote: current.requires_human_for_custom_quote ?? true,
        canCaptureLeads: current.can_capture_leads ?? true,
        canCapturePhone: current.can_capture_phone ?? true,
        canCaptureEmail: current.can_capture_email ?? true,
        canOfferBooking: current.can_offer_booking ?? false,
        canOfferConsultation: current.can_offer_consultation ?? false,
        canOfferCallback: current.can_offer_callback ?? true,
        supportsInstagramDm: types.has("instagram"),
        supportsFacebookMessenger: types.has("messenger") || types.has("facebook_page") || types.has("facebook"),
        supportsWhatsapp: types.has("whatsapp_business"),
        supportsComments: types.has("facebook_comments") || types.has("instagram") || types.has("facebook"),
        supportsVoice: false,
        supportsEmail: types.has("email") || current.supports_email,
        supportsMultilanguage: current.supports_multilanguage ?? false,
        primaryLanguage: current.primary_language || "az",
        supportedLanguages: current.supported_languages || [],
        handoffEnabled: current.handoff_enabled ?? true,
        autoHandoffOnHumanRequest: current.auto_handoff_on_human_request ?? true,
        autoHandoffOnLowConfidence: current.auto_handoff_on_low_confidence ?? true,
        shouldAvoidCompetitorComparisons: current.should_avoid_competitor_comparisons ?? true,
        shouldAvoidLegalClaims: current.should_avoid_legal_claims ?? true,
        shouldAvoidUnverifiedPromises: current.should_avoid_unverified_promises ?? true,
        replyStyle: current.reply_style || "professional",
        replyLength: current.reply_length || "medium",
        emojiLevel: current.emoji_level || "low",
        ctaStyle: current.cta_style || "soft",
        pricingMode: current.pricing_mode || "custom_quote",
        bookingMode: current.booking_mode || "manual",
        salesMode: current.sales_mode || "consultative",
        capabilitiesJson: current.capabilities_json || {},
        metadataJson: {
          ...(current.metadata_json || {}),
          channel_refresh: true,
        },
        derivedFromProfile: true,
        approvedBy,
      });

      await refreshRuntimeProjectionRequired(db, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        triggerType: "source_change",
        requestedBy: s(approvedBy || "tenantKnowledge.refreshChannelCapabilitiesFromSources"),
        runnerKey: "tenantKnowledge.refreshChannelCapabilitiesFromSources",
        generatedBy: s(approvedBy || "system"),
        metadata: {
          source: "refreshChannelCapabilitiesFromSources",
          capabilitiesId: row?.id || "",
        },
      });

      return row;
    },
  };

  return helpers;
}

export { buildCanonicalKey };
