import { buildSetupState } from "../setup.js";
import { auditSetupAction } from "./auditApp.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

export async function discardSetupReviewComposition(
  { db, actor, body = {} },
  deps = {}
) {
  const discardReviewSession =
    deps.discardSetupReviewSession ||
    (async (input) => {
      const reviewModule = await import("../../../db/helpers/tenantSetupReview.js");
      return reviewModule.discardSetupReviewSession(input);
    });
  const buildState = deps.buildSetupState || buildSetupState;
  const auditAction = deps.auditSetupAction || auditSetupAction;

  const discarded = await discardReviewSession({
    tenantId: actor.tenantId,
    reason: s(body?.reason),
    metadata: obj(body?.metadata),
  });

  const setup = await buildState({
    db,
    tenantId: actor.tenantId,
    tenantKey: actor.tenantKey,
    role: actor.role,
    tenant: actor.tenant,
  });

  await auditAction(
    db,
    actor,
    "setup.review.discarded",
    "tenant_setup_review_session",
    discarded?.id || null,
    {
      sessionId: s(discarded?.id),
      reason: s(body?.reason),
    }
  );

  return {
    status: 200,
    body: {
      ok: true,
      message: "Setup review session discarded",
      session: discarded || null,
      setup,
    },
  };
}
