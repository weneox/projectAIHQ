import { buildSetupState } from "../setup.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

export function requireSetupActor(req, res, deps = {}) {
  const pickActor = deps.pickWorkspaceActor;
  const actor = typeof pickActor === "function" ? pickActor(req) : null;
  const { user, tenantId, tenantKey } = actor || {};

  if (!user) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized",
      reason: "authenticated user is required",
    });
    return null;
  }

  if (!tenantId && !tenantKey) {
    res.status(400).json({
      ok: false,
      error: "TenantRequired",
      reason: "tenant context is required",
    });
    return null;
  }

  return actor;
}

export async function loadSetupStateResponse(
  { db, actor, errorCode = "SetupStateFailed" },
  deps = {}
) {
  const buildState = deps.buildSetupState || buildSetupState;
  const { tenant, tenantId, tenantKey, role } = actor;

  try {
    const data = await buildState({
      db,
      tenantId,
      tenantKey,
      role,
      tenant,
    });

    return {
      status: 200,
      body: {
        ok: true,
        ...data,
      },
    };
  } catch (err) {
    return {
      status: 500,
      body: {
        ok: false,
        error: errorCode,
        reason: s(err?.message || "failed to load setup state"),
      },
    };
  }
}
