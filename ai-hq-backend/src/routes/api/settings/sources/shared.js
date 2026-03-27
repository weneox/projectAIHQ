import { getAuthTenantId, getAuthTenantKey } from "../../../../utils/auth.js";

export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

export function b(v, d = false) {
  if (typeof v === "boolean") return v;
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return d;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return d;
}

export function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

export function lower(v) {
  return s(v).toLowerCase();
}

export function hasDb(db) {
  return Boolean(db && typeof db.query === "function");
}

export function bad(res, code, message, extra = {}) {
  return res.status(code).json({
    ok: false,
    error: message,
    ...extra,
  });
}

export function ok(res, data = {}) {
  return res.json({
    ok: true,
    ...data,
  });
}

export function normalizeSourceType(v) {
  const x = lower(v);
  if (
    [
      "website",
      "instagram",
      "facebook_page",
      "facebook_comments",
      "messenger",
      "whatsapp_business",
      "google_maps",
      "google_business",
      "linkedin",
      "tiktok",
      "youtube",
      "telegram",
      "email",
      "pdf",
      "document",
      "spreadsheet",
      "notion",
      "drive_folder",
      "crm",
      "manual_note",
      "api",
      "other",
    ].includes(x)
  ) {
    return x;
  }
  return "other";
}

export function pickUserId(req) {
  return (
    s(req.user?.id) ||
    s(req.session?.user?.id) ||
    s(req.auth?.user?.id) ||
    s(req.body?.by) ||
    s(req.body?.userId) ||
    s(req.headers["x-user-id"])
  );
}

export function pickUserName(req) {
  return (
    s(req.user?.name) ||
    s(req.session?.user?.name) ||
    s(req.auth?.user?.name) ||
    s(req.body?.byName) ||
    s(req.headers["x-user-name"])
  );
}

export function pickTenantKey(req) {
  return s(getAuthTenantKey(req));
}

export function pickTenantId(req) {
  return s(getAuthTenantId(req));
}

export function normalizeSourcePayload(body = {}) {
  const permissions = obj(body.permissionsJson || body.permissions || {}, {});
  const settings = obj(body.settingsJson || body.settings || {}, {});
  const metadata = obj(body.metadataJson || body.metadata || {}, {});

  return {
    sourceType: normalizeSourceType(body.sourceType || body.source_type),
    sourceKey: s(body.sourceKey || body.source_key),
    displayName: s(body.displayName || body.display_name),
    status: s(body.status || "pending"),
    authStatus: s(body.authStatus || body.auth_status || "not_required"),
    syncStatus: s(body.syncStatus || body.sync_status || "idle"),
    connectionMode: s(body.connectionMode || body.connection_mode || "manual"),
    accessScope: s(body.accessScope || body.access_scope || "public"),
    sourceUrl: s(body.sourceUrl || body.source_url),
    externalAccountId: s(body.externalAccountId || body.external_account_id),
    externalPageId: s(body.externalPageId || body.external_page_id),
    externalUsername: s(body.externalUsername || body.external_username),
    isEnabled: b(body.isEnabled ?? body.is_enabled, true),
    isPrimary: b(body.isPrimary ?? body.is_primary, false),
    permissionsJson: permissions,
    settingsJson: settings,
    metadataJson: metadata,
  };
}

export function normalizeApprovePayload(body = {}) {
  return {
    canonicalKey: s(body.canonicalKey || body.canonical_key),
    category: s(body.category),
    itemKey: s(body.itemKey || body.item_key),
    title: s(body.title),
    valueText: s(body.valueText || body.value_text),
    valueJson: body.valueJson ?? body.value_json,
    normalizedText: s(body.normalizedText || body.normalized_text),
    normalizedJson: body.normalizedJson ?? body.normalized_json,
    priority: body.priority,
    confidence: body.confidence,
    sourceCount: body.sourceCount,
    primarySourceId: s(body.primarySourceId || body.primary_source_id),
    sourceEvidenceJson: body.sourceEvidenceJson ?? body.source_evidence_json,
    approvalMode: s(body.approvalMode || body.approval_mode || "promoted"),
    tagsJson: body.tagsJson ?? body.tags_json,
    metadataJson: body.metadataJson ?? body.metadata_json,
    knowledgeStatus: s(body.knowledgeStatus || body.knowledge_status || "approved"),
    candidateStatus: s(body.candidateStatus || body.candidate_status || "approved"),
    reason: s(body.reason),
  };
}

export function buildSourceSyncReviewState(started = {}) {
  const run = obj(started.run);
  const source = obj(started.source);
  const runMeta = obj(run.metadata_json);
  const sourceMeta = obj(source.metadata_json);

  const sessionId = s(
    run.review_session_id ||
      run.reviewSessionId ||
      source.review_session_id ||
      source.reviewSessionId ||
      runMeta.review_session_id ||
      runMeta.reviewSessionId ||
      sourceMeta.review_session_id ||
      sourceMeta.reviewSessionId
  );

  const projectionStatus = s(
    run.projection_status ||
      run.projectionStatus ||
      source.projection_status ||
      source.projectionStatus ||
      runMeta.projection_status ||
      runMeta.projectionStatus ||
      sourceMeta.projection_status ||
      sourceMeta.projectionStatus ||
      (sessionId ? "review_required" : "")
  );

  const candidateDraftCount = Math.max(
    n(run.candidate_draft_count, 0),
    n(run.candidateDraftCount, 0),
    n(source.candidate_draft_count, 0),
    n(source.candidateDraftCount, 0),
    n(runMeta.candidate_draft_count, 0),
    n(runMeta.candidateDraftCount, 0),
    n(sourceMeta.candidate_draft_count, 0),
    n(sourceMeta.candidateDraftCount, 0)
  );

  const candidateCreatedCount = Math.max(
    n(run.candidate_created_count, 0),
    n(run.candidateCreatedCount, 0),
    n(source.candidate_created_count, 0),
    n(source.candidateCreatedCount, 0),
    n(runMeta.candidate_created_count, 0),
    n(runMeta.candidateCreatedCount, 0),
    n(sourceMeta.candidate_created_count, 0),
    n(sourceMeta.candidateCreatedCount, 0)
  );

  const required =
    !!sessionId ||
    projectionStatus === "review_required" ||
    candidateDraftCount > 0 ||
    candidateCreatedCount > 0;

  return {
    required,
    sessionId,
    projectionStatus,
    candidateDraftCount,
    candidateCreatedCount,
    canonicalProjection: s(
      run.canonical_projection ||
        run.canonicalProjection ||
        source.canonical_projection ||
        source.canonicalProjection ||
        runMeta.canonical_projection ||
        runMeta.canonicalProjection ||
        sourceMeta.canonical_projection ||
        sourceMeta.canonicalProjection ||
        (required ? "deferred_to_review" : "")
    ),
  };
}
