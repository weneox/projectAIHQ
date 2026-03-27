import { buildFrontendReviewShape } from "./reviewShape.js";
import { arr, compactObject, obj, s, toFiniteNumber } from "./utils.js";
import { can, normalizeRole } from "../../../utils/roles.js";

export async function loadCurrentReviewPayload(
  { db, actor, eventLimit = 30 },
  deps = {}
) {
  const review = await deps.getCurrentSetupReview(actor.tenantId);
  const setup = await deps.buildSetupStatus({
    db,
    tenantId: actor.tenantId,
    tenantKey: actor.tenantKey,
    role: actor.role,
    tenant: actor.tenant,
  });

  const events = s(review?.session?.id)
    ? await deps.listSetupReviewEvents({
        sessionId: review.session.id,
        limit: eventLimit,
      })
    : [];

  const frontendReview = buildFrontendReviewShape({
    session: review?.session || null,
    draft: review?.draft || null,
    sources: arr(review?.sources),
    events,
  });
  const viewerRole = normalizeRole(actor?.role);
  const canFinalize = can(viewerRole, "workspace", "manage");

  return {
    review: frontendReview,
    viewerRole,
    permissions: {
      setupReviewFinalize: {
        allowed: canFinalize,
        requiredRoles: ["owner", "admin"],
        message: canFinalize
          ? ""
          : "Only owner/admin can finalize setup review.",
      },
    },
    bundleSources: frontendReview.bundleSources,
    contributionSummary: frontendReview.contributionSummary,
    fieldProvenance: frontendReview.fieldProvenance,
    reviewDraftSummary: frontendReview.reviewDraftSummary,
    setup,
  };
}

export function normalizeRequestedReviewLock(body = {}) {
  const root = obj(body);
  const meta = obj(root.metadata);
  const concurrency = obj(root.concurrency);

  const draftVersion = toFiniteNumber(
    root.draftVersion ??
      root.draft_version ??
      root.version ??
      root.revision ??
      concurrency.draftVersion ??
      concurrency.draft_version ??
      concurrency.version ??
      meta.draftVersion ??
      meta.draft_version ??
      meta.version ??
      meta.revision,
    0
  );

  return compactObject({
    sessionId: s(
      root.sessionId ||
        root.session_id ||
        root.reviewSessionId ||
        root.review_session_id ||
        concurrency.sessionId ||
        concurrency.session_id ||
        meta.sessionId ||
        meta.session_id ||
        meta.reviewSessionId ||
        meta.review_session_id
    ),
    draftVersion: draftVersion > 0 ? draftVersion : undefined,
  });
}

export function buildReviewConcurrencyInfo(review = {}) {
  const session = obj(review?.session);
  const draft = obj(review?.draft);
  const canonicalBaseline = obj(obj(session.metadata).canonicalBaseline);

  return compactObject({
    sessionId: s(session.id),
    draftVersion: toFiniteNumber(draft.version, 0) || undefined,
    sessionStatus: s(session.status),
    currentStep: s(session.currentStep),
    protectionMode: "canonical_baseline_drift",
    baselineCaptured: !!s(canonicalBaseline.capturedAt),
  });
}

export function buildFinalizeProtectionInfo(review = {}) {
  const session = obj(review?.session);
  const canonicalBaseline = obj(obj(session.metadata).canonicalBaseline);

  return {
    mode: "canonical_baseline_drift",
    baselineCaptured: !!s(canonicalBaseline.capturedAt),
    sessionId: s(session.id),
    sessionStatus: s(session.status),
  };
}

export function buildReviewLockConflict(current = {}, body = {}) {
  const requested = normalizeRequestedReviewLock(body);
  if (!requested.sessionId && !requested.draftVersion) return null;

  const concurrency = buildReviewConcurrencyInfo(current);

  if (requested.sessionId && requested.sessionId !== concurrency.sessionId) {
    return {
      status: 409,
      error: "SetupReviewSessionConflict",
      code: "SETUP_REVIEW_SESSION_MISMATCH",
      reason: "requested setup review session does not match the current active session",
      requested,
      concurrency,
      finalizeProtection: buildFinalizeProtectionInfo(current),
    };
  }

  if (
    requested.draftVersion &&
    concurrency.draftVersion &&
    requested.draftVersion != concurrency.draftVersion
  ) {
    return {
      status: 409,
      error: "SetupReviewVersionConflict",
      code: "SETUP_REVIEW_DRAFT_VERSION_MISMATCH",
      reason: "requested setup review draft version does not match the current active draft",
      requested,
      concurrency,
      finalizeProtection: buildFinalizeProtectionInfo(current),
    };
  }

  return null;
}
