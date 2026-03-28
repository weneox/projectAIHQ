import { apiGet, apiPost } from "./client.js";
import { getSetupTruth } from "./setup.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function b(v) {
  return v === true;
}

function hasKeys(value = {}) {
  return Object.keys(obj(value)).length > 0;
}

function normalizeStringList(value = []) {
  return arr(value).map((item) => s(item)).filter(Boolean);
}

function normalizeReviewAction(value = {}) {
  const item = obj(value);
  return {
    actionType: s(item.actionType || item.type).toLowerCase(),
    label: s(item.label || "Review action"),
    allowed: item.allowed !== false,
    requiredRole: s(item.requiredRole || item.required_role),
    unavailableReason: s(item.unavailableReason || item.reason),
  };
}

function normalizeReviewPeer(value = {}) {
  const item = obj(value);
  return {
    id: s(item.id),
    title: s(item.title || item.valueText || item.value_text || "Candidate"),
    valueText: s(item.valueText || item.value_text),
    sourceDisplayName: s(item.sourceDisplayName || item.source_display_name),
    sourceType: s(item.sourceType || item.source_type).toLowerCase(),
    trustTier: s(item.trustTier || item.trust_tier).toLowerCase(),
    freshnessBucket: s(item.freshnessBucket || item.freshness_bucket).toLowerCase(),
    confidence: n(item.confidence),
    publishPreview: normalizePublishPreview(
      item.publishPreview || item.publish_preview
    ),
    whyStrongerOrWeaker: normalizeStringList(
      item.whyStrongerOrWeaker || item.why_stronger_or_weaker
    ),
  };
}

function normalizePublishPreview(value = {}) {
  const item = obj(value);
  const values = obj(item.values);
  const currentApprovedValue = obj(
    values.currentApprovedValue || values.current_approved_value
  );
  const proposedValue = obj(values.proposedValue || values.proposed_value);
  const canonical = obj(item.canonical);
  const runtime = obj(item.runtime);
  const channels = obj(item.channels);
  const policy = obj(item.policy);
  const guidance = obj(item.guidance);
  const auditSummary = obj(item.auditSummary || item.audit_summary);

  return {
    values: {
      currentApprovedValue: {
        title: s(currentApprovedValue.title),
        valueText: s(currentApprovedValue.valueText || currentApprovedValue.value_text),
        approvedAt: s(currentApprovedValue.approvedAt || currentApprovedValue.approved_at),
      },
      proposedValue: {
        title: s(proposedValue.title),
        valueText: s(proposedValue.valueText || proposedValue.value_text),
      },
      changed: b(values.changed),
    },
    canonical: {
      areas: normalizeStringList(canonical.areas),
      paths: normalizeStringList(canonical.paths),
    },
    runtime: {
      areas: normalizeStringList(runtime.areas),
      paths: normalizeStringList(runtime.paths),
      readinessDelta: s(runtime.readinessDelta || runtime.readiness_delta).toLowerCase(),
    },
    channels: {
      affectedSurfaces: normalizeStringList(
        channels.affectedSurfaces || channels.affected_surfaces
      ),
    },
    policy: {
      currentOutcome: s(policy.currentOutcome || policy.current_outcome).toLowerCase(),
      proposedOutcome: s(policy.proposedOutcome || policy.proposed_outcome).toLowerCase(),
      currentRequiredRole: s(
        policy.currentRequiredRole || policy.current_required_role
      ).toLowerCase(),
      proposedRequiredRole: s(
        policy.proposedRequiredRole || policy.proposed_required_role
      ).toLowerCase(),
      executionPostureDelta: s(
        policy.executionPostureDelta || policy.execution_posture_delta
      ).toLowerCase(),
      autonomyDelta: s(policy.autonomyDelta || policy.autonomy_delta).toLowerCase(),
      riskDelta: s(policy.riskDelta || policy.risk_delta).toLowerCase(),
    },
    guidance: {
      likelyAffectedAreas: normalizeStringList(
        guidance.likelyAffectedAreas || guidance.likely_affected_areas
      ),
      likelyRiskDelta: s(guidance.likelyRiskDelta || guidance.likely_risk_delta).toLowerCase(),
      likelyAutonomyDelta: s(
        guidance.likelyAutonomyDelta || guidance.likely_autonomy_delta
      ).toLowerCase(),
      likelyExecutionPostureDelta: s(
        guidance.likelyExecutionPostureDelta || guidance.likely_execution_posture_delta
      ).toLowerCase(),
      likelyReadinessImplications: normalizeStringList(
        guidance.likelyReadinessImplications || guidance.likely_readiness_implications
      ),
      confidence: s(guidance.confidence).toLowerCase(),
    },
    auditSummary,
  };
}

function normalizeReviewWorkbenchItem(value = {}) {
  const item = obj(value);
  const impactPreview = obj(item.impactPreview || item.impact_preview);
  const finalizeImpactPreview = obj(
    item.finalizeImpactPreview || item.finalize_impact_preview || impactPreview
  );
  const policy = obj(item.approvalPolicy || item.approval_policy);
  const governance = obj(item.governance);
  const source = obj(item.source);

  return {
    id: s(item.id || item.candidateId || item.candidate_id),
    candidateId: s(item.candidateId || item.candidate_id || item.id),
    queueBucket: s(item.queueBucket || item.queue_bucket).toLowerCase(),
    category: s(item.category).toLowerCase(),
    itemKey: s(item.itemKey || item.item_key),
    title: s(item.title || item.valueText || item.value_text || "Candidate"),
    valueText: s(item.valueText || item.value_text),
    valueJson: obj(item.valueJson || item.value_json),
    normalizedText: s(item.normalizedText || item.normalized_text),
    status: s(item.status).toLowerCase(),
    source: {
      displayName: s(source.displayName || source.display_name),
      sourceType: s(source.sourceType || source.source_type).toLowerCase(),
      trustTier: s(source.trustTier || source.trust_tier).toLowerCase(),
      trustLabel: s(source.trustLabel || source.trust_label),
    },
    confidence: {
      score: n(obj(item.confidence).score ?? item.confidence?.score ?? item.confidenceScore ?? item.confidence_score ?? item.confidence),
      label: s(obj(item.confidence).label || item.confidence?.label || item.confidenceLabel || item.confidence_label).toLowerCase(),
    },
    governance: {
      trust: obj(governance.trust),
      freshness: obj(governance.freshness),
      support: obj(governance.support),
      conflict: obj(governance.conflict),
      quarantine: b(governance.quarantine),
      quarantineReasons: normalizeStringList(
        governance.quarantineReasons || governance.quarantine_reasons
      ),
      reviewExplanation: normalizeStringList(
        governance.reviewExplanation || governance.review_explanation
      ),
    },
    approvalPolicy: {
      outcome: s(policy.outcome).toLowerCase(),
      requiredRole: s(policy.requiredRole || policy.required_role).toLowerCase(),
      reasonCodes: normalizeStringList(policy.reasonCodes || policy.reason_codes),
      autoApprovalAllowed: b(policy.autoApprovalAllowed || policy.auto_approval_allowed),
      autoApprovalForbidden: b(
        policy.autoApprovalForbidden || policy.auto_approval_forbidden
      ),
      blocked: b(policy.blocked),
      highRiskOperationalTruth: b(
        policy.highRiskOperationalTruth || policy.high_risk_operational_truth
      ),
      riskLevel: s(policy.riskLevel || policy.risk_level).toLowerCase(),
      riskLabel: s(policy.riskLabel || policy.risk_label).toLowerCase(),
    },
    impactPreview: {
      canonicalAreas: normalizeStringList(
        impactPreview.canonicalAreas || impactPreview.canonical_areas
      ),
      runtimeAreas: normalizeStringList(
        impactPreview.runtimeAreas || impactPreview.runtime_areas
      ),
      canonicalPaths: normalizeStringList(
        impactPreview.canonicalPaths || impactPreview.canonical_paths
      ),
      runtimePaths: normalizeStringList(
        impactPreview.runtimePaths || impactPreview.runtime_paths
      ),
      affectedSurfaces: normalizeStringList(
        impactPreview.affectedSurfaces || impactPreview.affected_surfaces
      ),
      currentTruth: obj(impactPreview.currentTruth || impactPreview.current_truth),
    },
    finalizeImpactPreview: {
      canonicalAreas: normalizeStringList(
        finalizeImpactPreview.canonicalAreas || finalizeImpactPreview.canonical_areas
      ),
      runtimeAreas: normalizeStringList(
        finalizeImpactPreview.runtimeAreas || finalizeImpactPreview.runtime_areas
      ),
      canonicalPaths: normalizeStringList(
        finalizeImpactPreview.canonicalPaths || finalizeImpactPreview.canonical_paths
      ),
      runtimePaths: normalizeStringList(
        finalizeImpactPreview.runtimePaths || finalizeImpactPreview.runtime_paths
      ),
      affectedSurfaces: normalizeStringList(
        finalizeImpactPreview.affectedSurfaces || finalizeImpactPreview.affected_surfaces
      ),
      currentTruth: obj(
        finalizeImpactPreview.currentTruth || finalizeImpactPreview.current_truth
      ),
    },
    publishPreview: normalizePublishPreview(
      item.publishPreview || item.publish_preview
    ),
    currentTruth: obj(item.currentTruth || item.current_truth),
    conflictResolution: Object.keys(
      obj(item.conflictResolution || item.conflict_resolution)
    ).length
      ? {
          conflictHash: s(
            item.conflictResolution?.conflictHash ||
              item.conflict_resolution?.conflict_hash
          ),
          classification: s(
            item.conflictResolution?.classification ||
              item.conflict_resolution?.classification
          ).toLowerCase(),
          reviewRequired: b(
            item.conflictResolution?.reviewRequired ||
              item.conflict_resolution?.review_required
          ),
          peerCount: n(
            item.conflictResolution?.peerCount || item.conflict_resolution?.peer_count
          ),
          peers: arr(
            item.conflictResolution?.peers || item.conflict_resolution?.peers
          ).map(normalizeReviewPeer),
          previewChoices: arr(
            item.conflictResolution?.previewChoices ||
              item.conflict_resolution?.preview_choices
          ).map((choice) => {
            const current = obj(choice);
            return {
              candidateId: s(current.candidateId || current.candidate_id),
              title: s(current.title || current.valueText || current.value_text),
              valueText: s(current.valueText || current.value_text),
              riskLevel: s(current.riskLevel || current.risk_level).toLowerCase(),
              outcome: s(current.outcome).toLowerCase(),
              affectedSurfaces: normalizeStringList(
                current.affectedSurfaces || current.affected_surfaces
              ),
              publishPreview: normalizePublishPreview(
                current.publishPreview || current.publish_preview
              ),
            };
          }),
        }
      : null,
    sourceEvidence: arr(item.sourceEvidence || item.source_evidence),
    review: {
      reviewReason: s(item.review?.reviewReason || item.review?.review_reason),
      firstSeenAt: s(item.review?.firstSeenAt || item.review?.first_seen_at),
      updatedAt: s(item.review?.updatedAt || item.review?.updated_at),
      reviewedAt: s(item.review?.reviewedAt || item.review?.reviewed_at),
      reviewedBy: s(item.review?.reviewedBy || item.review?.reviewed_by),
    },
    auditContext: {
      latestAction: s(
        item.auditContext?.latestAction || item.audit_context?.latest_action
      ).toLowerCase(),
      latestDecision: s(
        item.auditContext?.latestDecision || item.audit_context?.latest_decision
      ).toLowerCase(),
      latestBy: s(item.auditContext?.latestBy || item.audit_context?.latest_by),
      latestAt: s(item.auditContext?.latestAt || item.audit_context?.latest_at),
    },
    actions: arr(item.actions).map(normalizeReviewAction),
  };
}

function normalizeTruthReviewWorkbench(payload = {}) {
  const root = obj(payload);
  const summary = obj(root.summary);
  return {
    tenantId: s(root.tenantId || root.tenant_id),
    tenantKey: s(root.tenantKey || root.tenant_key),
    viewerRole: s(root.viewerRole || root.viewer_role).toLowerCase(),
    count: n(root.count),
    summary: {
      total: n(summary.total),
      pending: n(summary.pending),
      quarantined: n(summary.quarantined),
      conflicting: n(summary.conflicting),
      autoApprovable: n(summary.autoApprovable || summary.auto_approvable),
      blockedHighRisk: n(summary.blockedHighRisk || summary.blocked_high_risk),
      highRisk: n(summary.highRisk || summary.high_risk),
    },
    items: arr(root.items).map(normalizeReviewWorkbenchItem),
  };
}

function pickFirstObject(...values) {
  for (const value of values) {
    const next = obj(value);
    if (Object.keys(next).length) return next;
  }
  return {};
}

function pickFirstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const next = s(value);
    if (!next) continue;
    query.set(key, next);
  }

  const text = query.toString();
  return text ? `?${text}` : "";
}

function normalizeFieldValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string"
          ? s(item)
          : s(item?.title || item?.name || item?.label || item?.value || item?.description)
      )
      .filter(Boolean)
      .join(", ");
  }

  if (value && typeof value === "object") {
    return s(
      value.text ||
        value.value ||
        value.label ||
        value.name ||
        value.title ||
        value.description
    );
  }

  return s(value);
}

function summarizeProvenance(value = {}) {
  const item = obj(value);
  const labels = [
    s(item.label || item.sourceLabel || item.sourceType),
    s(item.sourceUrl),
  ].filter(Boolean);

  const unique = [...new Set(labels)];
  const authorityRank = Number(item.authorityRank);
  const note = Number.isFinite(authorityRank) && authorityRank > 0
    ? `Authority ${authorityRank}`
    : s(item.note || item.reason || item.summary || item.display);

  if (unique.length && note) return `${unique.join(", ")} - ${note}`;
  if (unique.length) return unique.join(", ");
  return note;
}

function summarizeSourceSummary(value = {}) {
  const item = obj(value);
  const parts = [
    s(item.primaryLabel || item.primarySourceLabel || item.label),
    s(item.primaryUrl || item.primarySourceUrl || item.url),
  ].filter(Boolean);

  const supportingCount = Number(
    item.supportingCount || item.sourceCount || item.supportingSourcesCount
  );

  if (Number.isFinite(supportingCount) && supportingCount > 0) {
    parts.push(
      `${supportingCount} supporting source${supportingCount === 1 ? "" : "s"}`
    );
  }

  return parts.join(" - ");
}

function summarizeVersionDiff(value = {}) {
  const item = obj(value);
  const changedFields = arr(item.changedFields || item.changed_fields)
    .map((field) =>
      typeof field === "string"
        ? s(field)
        : s(field?.label || field?.key || field?.field)
    )
    .filter(Boolean);

  if (changedFields.length > 0) {
    const preview = changedFields.slice(0, 3).join(", ");
    const remainder = changedFields.length - 3;
    return remainder > 0 ? `${preview}, +${remainder} more` : preview;
  }

  return s(
    item.diffSummary ||
      item.diff_summary ||
      item.changeSummary ||
      item.change_summary ||
      item.diff?.summary ||
      item.diff?.changeSummary
  );
}

function normalizeChangedFields(value = []) {
  return arr(value)
    .map((field) =>
      typeof field === "string"
        ? {
            key: s(field),
            label: s(field),
          }
        : {
            key: s(field?.key || field?.field || field?.name || field?.label),
            label: s(field?.label || field?.key || field?.field || field?.name),
          }
    )
    .filter((field) => field.key || field.label);
}

function summarizeFieldChangeValue(value) {
  const x = obj(value);
  return s(
    x.summary ||
      x.display ||
      x.text ||
      x.label ||
      x.value ||
      x.description ||
      normalizeFieldValue(x)
  );
}

function normalizeFieldChanges(value = []) {
    return arr(value)
      .map((entry) => {
        const item = obj(entry);
        const beforeValue =
          item.beforeSummary ?? item.before ?? item.previous ?? item.from;
        const afterValue =
          item.afterSummary ?? item.after ?? item.current ?? item.to;

      return {
        key: s(item.key || item.field || item.name || item.label),
        label: s(item.label || item.key || item.field || item.name),
        beforeSummary: summarizeFieldChangeValue(beforeValue),
        afterSummary: summarizeFieldChangeValue(afterValue),
        summary: s(
          item.summary || item.changeSummary || item.change_summary
        ),
      };
    })
    .filter((item) => item.key || item.label || item.beforeSummary || item.afterSummary);
}

function normalizeVersionMeta(value = {}, fallbackId = "") {
  const item = obj(value);
  const version = s(item.version || item.revision || item.id || fallbackId);
  const profileStatus = s(item.profileStatus || item.status);
  const versionLabel = s(
    item.versionLabel ||
      item.version_label ||
      item.label ||
      (version ? `Truth version ${version}` : "") ||
      (profileStatus ? `Truth version (${profileStatus})` : "")
  );

  return {
    id: s(item.id || version || fallbackId),
    version,
    versionLabel: versionLabel || "Truth version",
    profileStatus,
    approvedAt: s(item.approvedAt || item.createdAt || item.updatedAt),
    approvedBy: s(
      item.approvedBy ||
        item.actor ||
        item.createdBy ||
        item.updatedBy ||
        item.user
    ),
    sourceSummary: summarizeSourceSummary(
      item.sourceSummary ||
        item.source_summary ||
        item.sourceSummaryJson ||
        item.source_summary_json
    ),
  };
}

function normalizeHistory(items = []) {
  return arr(items)
    .map((entry, index) => {
      const item = obj(entry);
      const meta = normalizeVersionMeta(item, `history-${index + 1}`);
      const changedFields = normalizeChangedFields(
        item.changedFields ||
          item.changed_fields ||
          item.diff?.changedFields ||
          item.diff?.changed_fields
      );
      const fieldChanges = normalizeFieldChanges(
        item.fieldChanges ||
          item.field_changes ||
          item.diff?.fieldChanges ||
          item.diff?.field_changes
      );
      const diffSummary = summarizeVersionDiff(item);

      if (
        !meta.approvedAt &&
        !meta.approvedBy &&
        !meta.version &&
        !meta.versionLabel
      ) {
        return null;
      }

      return {
        ...meta,
        previousVersionId: s(item.previousVersionId || item.previous_version_id),
        sourceSummaryData: pickFirstObject(
          item.sourceSummary,
          item.source_summary,
          item.sourceSummaryJson,
          item.source_summary_json
        ),
        metadata: pickFirstObject(item.metadata, item.metadata_json),
        governance: pickFirstObject(
          item.governance,
          item.sourceSummary?.governance,
          item.source_summary?.governance,
          item.metadata?.governance,
          item.metadata_json?.governance
        ),
        finalizeImpact: pickFirstObject(
          item.finalizeImpact,
          item.sourceSummary?.finalizeImpact,
          item.source_summary?.finalizeImpact,
          item.metadata?.finalizeImpact,
          item.metadata_json?.finalizeImpact
        ),
        changedFields,
        fieldChanges,
        changedFieldCount: changedFields.length || fieldChanges.length,
        diffSummary,
      };
    })
    .filter(Boolean);
}

function normalizeCompareResponse(payload = {}, versionId = "", compareTo = "") {
  const root = obj(payload);
  const detail = pickFirstObject(
    root.detail,
    root.version,
    root.truthVersion,
    root.item,
    root
  );
  const compare = pickFirstObject(
    root.compare,
    root.comparedVersion,
    root.compared_version,
    root.previousVersion,
    root.previous_version
  );
  const diff = pickFirstObject(root.diff, detail.diff);
  const changedFields = normalizeChangedFields(
    root.changedFields ||
      root.changed_fields ||
      detail.changedFields ||
      detail.changed_fields ||
      diff.changedFields ||
      diff.changed_fields
  );
  const fieldChanges = normalizeFieldChanges(
    root.fieldChanges ||
      root.field_changes ||
      detail.fieldChanges ||
      detail.field_changes ||
      diff.fieldChanges ||
      diff.field_changes
  );
  const sectionChanges = arr(
    root.sectionChanges ||
      root.section_changes ||
      diff.sectionChanges ||
      diff.section_changes
  )
    .map((entry) => {
      const item = obj(entry);
      return {
        key: s(item.key || item.section || item.name || item.label),
        label: s(item.label || item.section || item.name || item.key),
        summary: s(item.summary || item.changeSummary || item.change_summary),
      };
    })
    .filter((item) => item.key || item.label || item.summary);

  return {
    selectedVersion: normalizeVersionMeta(detail, versionId),
    comparedVersion: normalizeVersionMeta(compare, compareTo),
    changedFields,
    fieldChanges,
    sectionChanges,
    diffSummary: summarizeVersionDiff({
      ...detail,
      ...diff,
      changedFields,
    }),
    hasStructuredDiff:
      changedFields.length > 0 ||
      fieldChanges.length > 0 ||
      sectionChanges.length > 0 ||
      !!summarizeVersionDiff({ ...detail, ...diff }),
  };
}

function normalizeTruthResponse(payload = {}, source = "") {
  const root = obj(payload);
  const truth = pickFirstObject(root.truth, root.snapshot);
  const readiness = pickFirstObject(truth.readiness, root.readiness);

  const profile = pickFirstObject(
    truth.profile,
    root.profile
  );

  const fieldProvenance = pickFirstObject(
    truth.fieldProvenance,
    truth.field_provenance,
    root.fieldProvenance,
    root.field_provenance
  );

  const history = normalizeHistory(
    pickFirstArray(
      truth.history,
      root.history,
      truth.versions
    )
  );

  const fields = [
    ["Company name", normalizeFieldValue(profile.companyName || profile.name), "companyName"],
    ["Short business summary", normalizeFieldValue(profile.description || profile.summaryShort || profile.companySummaryShort), "description"],
    ["Website URL", normalizeFieldValue(profile.websiteUrl), "websiteUrl"],
    ["Primary phone", normalizeFieldValue(profile.primaryPhone), "primaryPhone"],
    ["Primary email", normalizeFieldValue(profile.primaryEmail), "primaryEmail"],
    ["Primary address", normalizeFieldValue(profile.primaryAddress), "primaryAddress"],
    ["Primary language", normalizeFieldValue(profile.mainLanguage || profile.language || profile.primaryLanguage), "mainLanguage"],
    ["Services", normalizeFieldValue(profile.services), "services"],
    ["Products", normalizeFieldValue(profile.products), "products"],
    ["Pricing", normalizeFieldValue(profile.pricingHints), "pricingHints"],
    ["Social", normalizeFieldValue(profile.socialLinks), "socialLinks"],
  ]
    .map(([label, value, key]) => ({
      key,
      label,
      value,
      provenance: summarizeProvenance(fieldProvenance[key]),
      hasProvenance: !!summarizeProvenance(fieldProvenance[key]),
    }))
    .filter((field) => field.value);

  const approval = {
    approvedAt: s(truth.approvedAt || root.approvedAt),
    approvedBy: s(truth.approvedBy || root.approvedBy),
    version: s(truth.profileStatus || root.profileStatus),
  };
  const sourceSummary = pickFirstObject(
    truth.sourceSummary,
    truth.source_summary,
    root.sourceSummary,
    root.source_summary
  );
  const metadata = pickFirstObject(truth.metadata, root.metadata);
  const governance = pickFirstObject(
    truth.governance,
    sourceSummary.governance,
    metadata.governance
  );
  const finalizeImpact = pickFirstObject(
    truth.finalizeImpact,
    sourceSummary.finalizeImpact,
    metadata.finalizeImpact
  );

  const hasApprovalMeta = !!(approval.approvedAt || approval.approvedBy || approval.version);
  const hasTruth = fields.length > 0 || hasKeys(profile);

  return {
    source,
    fields,
    approval,
    hasApprovalMeta,
    hasHistory: history.length > 0,
    history,
    hasProvenance: fields.some((field) => field.hasProvenance),
    hasTruth,
    sourceSummary,
    metadata,
    governance: {
      disposition: s(governance.disposition).toLowerCase(),
      promotable: governance.promotable === true,
      quarantine: governance.quarantine === true,
      quarantineReasons: normalizeStringList(
        governance.quarantineReasons || governance.quarantine_reasons
      ),
      quarantinedClaimCount:
        Number(
          governance.quarantinedClaimCount || governance.quarantined_claim_count
        ) || arr(governance.quarantinedClaims || governance.quarantined_claims).length,
      trust: obj(governance.trust),
      freshness: obj(governance.freshness),
      support: obj(governance.support),
      conflict: obj(governance.conflict),
    },
    finalizeImpact: {
      canonicalAreas: normalizeStringList(
        finalizeImpact.canonicalAreas || finalizeImpact.canonical_areas
      ),
      runtimeAreas: normalizeStringList(
        finalizeImpact.runtimeAreas || finalizeImpact.runtime_areas
      ),
      canonicalPaths: normalizeStringList(
        finalizeImpact.canonicalPaths || finalizeImpact.canonical_paths
      ),
      runtimePaths: normalizeStringList(
        finalizeImpact.runtimePaths || finalizeImpact.runtime_paths
      ),
      affectedSurfaces: normalizeStringList(
        finalizeImpact.affectedSurfaces || finalizeImpact.affected_surfaces
      ),
    },
    readiness,
  };
}

function buildApprovedTruthUnavailableSnapshot(
  reasonCode = "approved_truth_unavailable",
  notice = "Approved truth is unavailable. No non-approved fallback data is being shown."
) {
  return {
    source: "/api/setup/truth/current",
    fields: [],
    approval: { approvedAt: "", approvedBy: "", version: "" },
    hasApprovalMeta: false,
    hasHistory: false,
    history: [],
    hasProvenance: false,
    hasTruth: false,
    approvedTruthUnavailable: true,
    unavailableReasonCode: s(reasonCode),
    notices: [s(notice)],
    sourceSummary: {},
    metadata: {},
    governance: {},
    finalizeImpact: {
      canonicalAreas: [],
      runtimeAreas: [],
      canonicalPaths: [],
      runtimePaths: [],
      affectedSurfaces: [],
    },
    readiness: {
      status: "blocked",
      reasonCode: s(reasonCode),
      intentionallyUnavailable: true,
      message: s(notice),
      blockers: [
        {
          blocked: true,
          category: "truth",
          dependencyType: "approved_truth",
          reasonCode: s(reasonCode),
          title: "Approved truth blocker",
          subtitle: s(notice),
          missing: ["approved_truth"],
          suggestedRepairActionId: "open_setup_route",
          nextAction: {
            id: "open_setup_route",
            kind: "route",
            label: "Open setup",
            requiredRole: "operator",
            allowed: true,
            target: {
              path: "/setup/studio",
              section: "truth",
            },
          },
        },
      ],
    },
  };
}

export const __test__ = {
  normalizeTruthResponse,
  normalizeCompareResponse,
  buildApprovedTruthUnavailableSnapshot,
  normalizeTruthReviewWorkbench,
};

export async function getTruthVersionDetail(versionId, options = {}) {
  const id = encodeURIComponent(s(versionId));
  const query = buildQuery({
    compareTo: options.compareTo,
  });
  const payload = await apiGet(`/api/setup/truth/history/${id}${query}`);
  return normalizeCompareResponse(payload, s(versionId), s(options.compareTo));
}

export async function getCanonicalTruthSnapshot() {
  const truth = await getSetupTruth().catch(() => null);
  if (truth) {
    const normalized = normalizeTruthResponse(truth, "/api/setup/truth/current");
    const approvedTruthUnavailable = !(
      normalized.hasTruth || normalized.hasApprovalMeta || normalized.hasHistory
    );
    const unavailableReasonCode = approvedTruthUnavailable ? "approved_truth_empty" : "";
    const notices = approvedTruthUnavailable
      ? ["Approved truth is unavailable. The backend returned no approved truth fields."]
      : [];
    return {
      ...normalized,
      approvedTruthUnavailable,
      unavailableReasonCode,
      notices,
      readiness: Object.keys(obj(normalized.readiness)).length > 0
        ? normalized.readiness
        : approvedTruthUnavailable
        ? buildApprovedTruthUnavailableSnapshot(
            unavailableReasonCode || "approved_truth_empty",
            notices[0] || "Approved truth is unavailable. The backend returned no approved truth fields."
          ).readiness
        : {
            status: "ready",
            blockers: [],
          },
    };
  }

  return {
    ...buildApprovedTruthUnavailableSnapshot(),
  };
}

export async function getTruthReviewWorkbench(params = {}) {
  const query = buildQuery({
    category: params.category,
    status: params.status,
    limit: params.limit,
    offset: params.offset,
  });
  const payload = await apiGet(`/api/settings/knowledge/review-queue${query}`);
  return normalizeTruthReviewWorkbench(payload);
}

async function mutateTruthReviewCandidate(candidateId, actionType, payload = {}) {
  const id = encodeURIComponent(s(candidateId));
  const suffixMap = {
    approve: "approve",
    reject: "reject",
    mark_follow_up: "needs-review",
    keep_quarantined: "quarantine",
  };
  const suffix = suffixMap[s(actionType).toLowerCase()];
  if (!suffix) {
    throw new Error("Unknown truth review action");
  }
  return apiPost(`/api/settings/knowledge/${id}/${suffix}`, payload);
}

export async function approveTruthReviewCandidate(candidateId, payload = {}) {
  return mutateTruthReviewCandidate(candidateId, "approve", payload);
}

export async function rejectTruthReviewCandidate(candidateId, payload = {}) {
  return mutateTruthReviewCandidate(candidateId, "reject", payload);
}

export async function markTruthReviewCandidateForFollowUp(candidateId, payload = {}) {
  return mutateTruthReviewCandidate(candidateId, "mark_follow_up", payload);
}

export async function keepTruthReviewCandidateQuarantined(candidateId, payload = {}) {
  return mutateTruthReviewCandidate(candidateId, "keep_quarantined", payload);
}
