import { validateReadinessSurface } from "./operations.js";
import { validateProjectedRuntime } from "./runtime.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function bool(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function num(v, fallback = null) {
  const value = Number(v);
  return Number.isFinite(value) ? value : fallback;
}

function ok(value) {
  return { ok: true, value };
}

function fail(error, details = {}) {
  return {
    ok: false,
    error: s(error || "invalid_setup_contract"),
    details: obj(details),
  };
}

function validateSetupSession(input = {}) {
  const value = obj(input);

  if (!s(value.id)) {
    return fail("setup_review_session_invalid");
  }

  return ok({
    id: s(value.id),
    status: lower(value.status || ""),
    currentStep: s(value.currentStep || value.current_step || ""),
    primarySourceId: s(value.primarySourceId || value.primary_source_id || ""),
    primarySourceType: s(value.primarySourceType || value.primary_source_type || ""),
    metadata: obj(value.metadata),
  });
}

function validateSetupDraft(input = {}) {
  const value = obj(input);
  const version = num(value.version, null);

  if (version === null) {
    return fail("setup_review_draft_invalid");
  }

  return ok({
    version,
    businessProfile: obj(value.businessProfile || value.business_profile),
    capabilities: obj(value.capabilities || value.capabilities_json),
    services: arr(value.services),
    knowledgeItems: arr(value.knowledgeItems || value.knowledge_items),
    sourceSummary: obj(value.sourceSummary || value.source_summary),
    warnings: arr(value.warnings),
  });
}

function validateReviewDraftSummary(input = {}) {
  const value = obj(input);

  return ok({
    completeness: obj(value.completeness),
    confidence: obj(value.confidence),
    warningCount: num(value.warningCount || value.warning_count, 0),
    warnings: arr(value.warnings),
    serviceCount: num(value.serviceCount || value.service_count, 0),
    knowledgeCount: num(value.knowledgeCount || value.knowledge_count, 0),
    hasBusinessProfile: bool(
      value.hasBusinessProfile ?? value.has_business_profile,
      false
    ),
  });
}

export function validateSetupReviewShape(input = {}) {
  const value = obj(input);
  const session =
    value.session === null ? { ok: true, value: null } : validateSetupSession(value.session);
  if (!session.ok) return session;

  const draft =
    value.draft === null ? { ok: true, value: null } : validateSetupDraft(value.draft);
  if (!draft.ok) return draft;

  const reviewDraftSummary = validateReviewDraftSummary(value.reviewDraftSummary);
  if (!reviewDraftSummary.ok) return reviewDraftSummary;

  return ok({
    session: session.value,
    draft: draft.value,
    sources: arr(value.sources).map((entry) => obj(entry)),
    events: arr(value.events).map((entry) => obj(entry)),
    bundleSources: arr(value.bundleSources).map((entry) => obj(entry)),
    contributionSummary: arr(value.contributionSummary).map((entry) => obj(entry)),
    fieldProvenance: obj(value.fieldProvenance),
    reviewDraftSummary: reviewDraftSummary.value,
  });
}

export function validateSetupCurrentReviewPayload(input = {}) {
  const value = obj(input);
  const review = validateSetupReviewShape(value.review);
  if (!review.ok) return review;

  return ok({
    review: review.value,
    bundleSources: arr(value.bundleSources).map((entry) => obj(entry)),
    contributionSummary: arr(value.contributionSummary).map((entry) => obj(entry)),
    fieldProvenance: obj(value.fieldProvenance),
    reviewDraftSummary: obj(value.reviewDraftSummary),
    setup: obj(value.setup),
  });
}

export function validateSetupTruthPayload(input = {}) {
  const value = obj(input);
  const truth = obj(value.truth);
  const readiness = validateReadinessSurface(truth.readiness);
  if (!readiness.ok) return readiness;

  return ok({
    truth: {
      profile: obj(truth.profile),
      fieldProvenance: obj(truth.fieldProvenance || truth.field_provenance),
      history: arr(truth.history).map((entry) => obj(entry)),
      approvedAt: s(truth.approvedAt || truth.approved_at || ""),
      approvedBy: s(truth.approvedBy || truth.approved_by || ""),
      generatedAt: s(truth.generatedAt || truth.generated_at || ""),
      generatedBy: s(truth.generatedBy || truth.generated_by || ""),
      profileStatus: s(truth.profileStatus || truth.profile_status || ""),
      sourceSummary: obj(truth.sourceSummary || truth.source_summary),
      metadata: obj(truth.metadata),
      readiness: readiness.value,
    },
    setup: obj(value.setup),
  });
}

export function validateSetupTruthPublicationSummary(input = {}) {
  const value = obj(input);
  const truthVersion = obj(value.truthVersion || value.truth_version);
  const runtimeProjection = obj(value.runtimeProjection || value.runtime_projection);

  if (!s(truthVersion.id)) {
    return fail("setup_truth_publication_summary_invalid");
  }

  if (Object.keys(runtimeProjection).length) {
    if (s(runtimeProjection.id) && !runtimeProjection.authority && !runtimeProjection.tenant) {
      return ok({
        projectedProfile: bool(value.projectedProfile ?? value.projected_profile, false),
        projectedCapabilities: bool(
          value.projectedCapabilities ?? value.projected_capabilities,
          false
        ),
        truthVersion: {
          id: s(truthVersion.id),
          approvedAt: s(truthVersion.approvedAt || truthVersion.approved_at || ""),
          approvedBy: s(truthVersion.approvedBy || truthVersion.approved_by || ""),
          reviewSessionId: s(
            truthVersion.reviewSessionId || truthVersion.review_session_id || ""
          ),
        },
        runtimeProjection: {
          id: s(runtimeProjection.id),
        },
        serviceProjection: obj(value.serviceProjection || value.service_projection),
        knowledgeProjection: obj(value.knowledgeProjection || value.knowledge_projection),
        sourceInfo: obj(value.sourceInfo || value.source_info),
      });
    }

    const runtimeChecked = validateProjectedRuntime(runtimeProjection);
    if (!runtimeChecked.ok) return runtimeChecked;
  }

  return ok({
    projectedProfile: bool(value.projectedProfile ?? value.projected_profile, false),
    projectedCapabilities: bool(
      value.projectedCapabilities ?? value.projected_capabilities,
      false
    ),
    truthVersion: {
      id: s(truthVersion.id),
      approvedAt: s(truthVersion.approvedAt || truthVersion.approved_at || ""),
      approvedBy: s(truthVersion.approvedBy || truthVersion.approved_by || ""),
      reviewSessionId: s(
        truthVersion.reviewSessionId || truthVersion.review_session_id || ""
      ),
    },
    runtimeProjection: Object.keys(runtimeProjection).length ? runtimeProjection : null,
    serviceProjection: obj(value.serviceProjection || value.service_projection),
    knowledgeProjection: obj(value.knowledgeProjection || value.knowledge_projection),
    sourceInfo: obj(value.sourceInfo || value.source_info),
  });
}

export function validateSetupFinalizeResponse(input = {}) {
  const value = obj(input);
  if (typeof value.ok !== "boolean") {
    return fail("setup_finalize_response_invalid");
  }

  if (!value.ok) return ok(value);

  const projectionSummary = validateSetupTruthPublicationSummary(value.projectionSummary);
  if (!projectionSummary.ok) return projectionSummary;

  return ok({
    ...value,
    projectionSummary: projectionSummary.value,
    concurrency: obj(value.concurrency),
    finalizeProtection: obj(value.finalizeProtection),
    setup: obj(value.setup),
  });
}
