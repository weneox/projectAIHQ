import { buildSetupStatus } from "../setup.js";
import {
  buildFinalizeProtectionInfo,
  buildReviewConcurrencyInfo,
  buildReviewLockConflict,
  loadCurrentReviewPayload,
} from "./reviewFlow.js";
import { compactDraftObject, safeUuidOrNull } from "./draftShared.js";
import { arr, obj, s } from "./utils.js";
import { can, normalizeRole } from "../../../utils/roles.js";

async function defaultGetCurrentSetupReview(tenantId) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.getCurrentSetupReview(tenantId);
}

async function defaultPatchSetupReviewDraft(input) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.patchSetupReviewDraft(input);
}

async function defaultFinalizeSetupReviewSession(input) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.finalizeSetupReviewSession(input);
}

async function defaultProjectSetupReviewDraftToCanonical(input) {
  const projection = await import("./projection.js");
  return projection.projectSetupReviewDraftToCanonical(input);
}

export function normalizeReviewPatchBody(body = {}) {
  const patch = obj(body?.patch) || obj(body);

  const businessProfile =
    patch.businessProfile !== undefined
      ? obj(patch.businessProfile)
      : patch.business_profile !== undefined
        ? obj(patch.business_profile)
        : undefined;

  const capabilities =
    patch.capabilities !== undefined
      ? obj(patch.capabilities)
      : patch.capabilities_json !== undefined
        ? obj(patch.capabilities_json)
        : undefined;

  const services =
    patch.services !== undefined
      ? arr(patch.services)
      : patch.serviceItems !== undefined
        ? arr(patch.serviceItems)
        : undefined;

  const knowledgeItems =
    patch.knowledgeItems !== undefined
      ? arr(patch.knowledgeItems)
      : patch.knowledge_items !== undefined
        ? arr(patch.knowledge_items)
        : undefined;

  const channels = patch.channels !== undefined ? arr(patch.channels) : undefined;

  const sourceSummary =
    patch.sourceSummary !== undefined
      ? obj(patch.sourceSummary)
      : patch.source_summary !== undefined
        ? obj(patch.source_summary)
        : undefined;

  const warnings = patch.warnings !== undefined ? arr(patch.warnings) : undefined;
  const completeness =
    patch.completeness !== undefined ? obj(patch.completeness) : undefined;

  const confidenceSummary =
    patch.confidenceSummary !== undefined
      ? obj(patch.confidenceSummary)
      : patch.confidence_summary !== undefined
        ? obj(patch.confidence_summary)
        : undefined;

  const diffFromCanonical =
    patch.diffFromCanonical !== undefined
      ? obj(patch.diffFromCanonical)
      : patch.diff_from_canonical !== undefined
        ? obj(patch.diff_from_canonical)
        : undefined;

  const draftPayload =
    patch.draftPayload !== undefined
      ? obj(patch.draftPayload)
      : patch.draft_payload !== undefined
        ? obj(patch.draft_payload)
        : undefined;

  const lastSnapshotId =
    patch.lastSnapshotId !== undefined
      ? patch.lastSnapshotId || null
      : patch.last_snapshot_id !== undefined
        ? patch.last_snapshot_id || null
        : undefined;

  const out = {};

  if (draftPayload !== undefined) out.draftPayload = draftPayload;
  if (businessProfile !== undefined) out.businessProfile = businessProfile;
  if (capabilities !== undefined) out.capabilities = capabilities;
  if (services !== undefined) out.services = services;
  if (knowledgeItems !== undefined) out.knowledgeItems = knowledgeItems;
  if (channels !== undefined) out.channels = channels;
  if (sourceSummary !== undefined) out.sourceSummary = sourceSummary;
  if (warnings !== undefined) out.warnings = warnings;
  if (completeness !== undefined) out.completeness = completeness;
  if (confidenceSummary !== undefined) out.confidenceSummary = confidenceSummary;
  if (diffFromCanonical !== undefined) out.diffFromCanonical = diffFromCanonical;
  if (lastSnapshotId !== undefined) out.lastSnapshotId = lastSnapshotId;

  return out;
}

export async function applySetupReviewPatch(
  { db, actor, body = {} },
  deps = {}
) {
  const getCurrentSetupReview = deps.getCurrentSetupReview || defaultGetCurrentSetupReview;
  const normalizePatch = deps.normalizeReviewPatchBody || normalizeReviewPatchBody;
  const patchSetupReviewDraft = deps.patchSetupReviewDraft || defaultPatchSetupReviewDraft;
  const loadReviewPayload = deps.loadCurrentReviewPayload || loadCurrentReviewPayload;
  const auditSetupAction = deps.auditSetupAction || (async () => {});
  const buildLockConflict = deps.buildReviewLockConflict || buildReviewLockConflict;

  const current = await getCurrentSetupReview(actor.tenantId);

  if (!current?.session?.id) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "SetupReviewSessionNotFound",
        reason: "active setup review session not found",
      },
    };
  }

  const lockConflict = buildLockConflict(current, body);
  if (lockConflict) {
    return {
      status: lockConflict.status,
      body: {
        ok: false,
        error: lockConflict.error,
        reason: lockConflict.reason,
        code: lockConflict.code,
        requested: lockConflict.requested,
        concurrency: lockConflict.concurrency,
        finalizeProtection: lockConflict.finalizeProtection,
      },
    };
  }

  const patch = normalizePatch(body);

  if (!Object.keys(patch).length) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "SetupReviewPatchInvalid",
        reason: "no valid draft patch fields were provided",
      },
    };
  }

  const draft = await patchSetupReviewDraft({
    sessionId: current.session.id,
    tenantId: actor.tenantId,
    patch,
    bumpVersion: true,
  });

  const data = await loadReviewPayload({
    db,
    actor,
    eventLimit: 30,
  });

  await auditSetupAction(
    db,
    actor,
    "setup.review.updated",
    "tenant_setup_review_session",
    current.session.id,
    {
      sessionId: current.session.id,
      draftVersion: Number(draft?.version || data?.review?.draft?.version || 0),
      currentStep: s(data?.review?.session?.currentStep || current.session.currentStep),
    }
  );

  return {
    status: 200,
    body: {
      ok: true,
      message: "Setup review draft updated",
      draft,
      ...data,
    },
  };
}

function buildFinalizeReviewer(actor = {}) {
  const reviewerId =
    safeUuidOrNull(actor?.user?.id) ||
    safeUuidOrNull(actor?.user?.userId) ||
    safeUuidOrNull(actor?.user?.user_id) ||
    null;

  const reviewerEmail = s(actor?.user?.email);
  const reviewerName =
    s(actor?.user?.name) ||
    s(actor?.user?.full_name) ||
    s(actor?.user?.fullName) ||
    reviewerEmail ||
    s(actor?.user?.id) ||
    "system";

  return {
    reviewerId,
    reviewerEmail,
    reviewerName,
  };
}

export async function finalizeSetupReviewComposition(
  { db, actor, body = {}, log = null },
  deps = {}
) {
  const getCurrentSetupReview = deps.getCurrentSetupReview || defaultGetCurrentSetupReview;
  const finalizeSetupReviewSession =
    deps.finalizeSetupReviewSession || defaultFinalizeSetupReviewSession;
  const buildStatus = deps.buildSetupStatus || buildSetupStatus;
  const auditSetupAction = deps.auditSetupAction || (async () => {});
  const projectDraftToCanonical =
    deps.projectSetupReviewDraftToCanonical ||
    defaultProjectSetupReviewDraftToCanonical;
  const reviewConcurrency = deps.buildReviewConcurrencyInfo || buildReviewConcurrencyInfo;
  const finalizeProtection =
    deps.buildFinalizeProtectionInfo || buildFinalizeProtectionInfo;

  let current = null;

  try {
    current = await getCurrentSetupReview(actor.tenantId);
    const actorRole = normalizeRole(actor?.role);
    if (!can(actorRole, "workspace", "manage")) {
      await auditSetupAction(
        db,
        actor,
        "setup.review.finalize",
        "tenant_setup_review_session",
        current?.session?.id || current?.id || null,
        {
          outcome: "blocked",
          reasonCode: "insufficient_role",
          targetArea: "setup_review",
          reviewSessionId: s(current?.session?.id || current?.id),
          attemptedRole: actorRole,
          requiredRoles: ["owner", "admin"],
          reason: s(body?.reason),
        }
      );

      log?.warn?.("setup.review.finalize.blocked", {
        tenantKey: actor?.tenantKey,
        tenantId: actor?.tenantId,
        role: actorRole,
        reasonCode: "insufficient_role",
      });

      return {
        status: 403,
        body: {
          ok: false,
          error: "Forbidden",
          reason: "Only owner/admin can finalize setup review",
          reasonCode: "insufficient_role",
          viewerRole: actorRole,
          requiredRoles: ["owner", "admin"],
          concurrency: current ? reviewConcurrency(current) : {},
          finalizeProtection: current ? finalizeProtection(current) : {},
        },
      };
    }

    log?.info?.("setup.review.finalize.requested", {
      tenantKey: actor.tenantKey,
      tenantId: actor.tenantId,
      reason: s(body?.reason),
    });

    let projectionSummary = null;
    const reviewer = buildFinalizeReviewer(actor);

    const finalized = await finalizeSetupReviewSession({
      tenantId: actor.tenantId,
      currentStep: "finalize",
      refreshRuntime: true,
      metadata: compactDraftObject({
        ...reviewer,
        finalizeReason: s(body?.reason),
      }),
      async projectDraftToCanonical({ client, tenantId, session, draft, sources }) {
        projectionSummary = await projectDraftToCanonical({
          db: client,
          actor: {
            ...actor,
            tenantId,
          },
          session,
          draft,
          sources,
        });
      },
    });

    const setup = await buildStatus({
      db,
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      role: actor.role,
      tenant: actor.tenant,
    });

    await auditSetupAction(
      db,
      actor,
      "setup.review.finalized",
      "tenant_setup_review_session",
      finalized?.session?.id || finalized?.id || null,
      {
        sessionId: s(finalized?.session?.id || finalized?.id),
        reviewSessionId: s(finalized?.session?.id || finalized?.reviewSessionId),
        reason: s(body?.reason),
        truthVersionId: s(projectionSummary?.truthVersion?.id),
        runtimeProjectionId: s(projectionSummary?.runtimeProjection?.id),
      }
    );

    if (projectionSummary?.truthVersion?.id) {
      await auditSetupAction(
        db,
        actor,
        "truth.version.created",
        "tenant_business_profile_version",
        projectionSummary.truthVersion.id,
        {
          truthVersionId: s(projectionSummary?.truthVersion?.id),
          reviewSessionId: s(finalized?.session?.id || finalized?.reviewSessionId),
          approvedAt: s(projectionSummary?.truthVersion?.approvedAt),
          approvedBy: s(projectionSummary?.truthVersion?.approvedBy),
        }
      );
    }

    log?.info?.("setup.review.finalize.succeeded", {
      tenantKey: actor.tenantKey,
      tenantId: actor.tenantId,
      reviewSessionId: s(finalized?.session?.id || finalized?.reviewSessionId),
      truthVersionId: s(projectionSummary?.truthVersion?.id),
      runtimeProjectionId: s(projectionSummary?.runtimeProjection?.id),
    });

    return {
      status: 200,
      body: {
        ok: true,
        message: "Setup review finalized",
        ...finalized,
        concurrency: reviewConcurrency(finalized),
        finalizeProtection: finalizeProtection(finalized),
        projectionSummary,
        setup,
      },
    };
  } catch (err) {
    await auditSetupAction(
      db,
      actor,
      "setup.review.finalize",
      "tenant_setup_review_session",
      current?.session?.id || current?.id || null,
      {
        outcome: "failed",
        reasonCode: s(err?.code || "setup_review_finalize_failed"),
        targetArea: "setup_review",
        reviewSessionId: s(current?.session?.id || current?.id),
        reason: s(body?.reason),
      }
    );
    log?.error?.("setup.review.finalize.failed", err, {
      tenantKey: actor?.tenantKey,
      tenantId: actor?.tenantId,
      code: s(err?.code),
    });
    err.currentReview = current;
    throw err;
  }
}

export const __test__ = {
  buildFinalizeReviewer,
};
