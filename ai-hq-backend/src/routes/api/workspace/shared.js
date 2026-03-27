// src/routes/api/workspace/shared.js
// FINAL v1.0 — shared request helpers for workspace routes

function s(v, d = "") {
  return String(v ?? d).trim();
}

export function pickWorkspaceActor(req) {
  const user =
    req.user ||
    req.auth?.user ||
    req.session?.user ||
    req.currentUser ||
    null;

  const tenant =
    req.tenant ||
    req.auth?.tenant ||
    req.session?.tenant ||
    req.currentTenant ||
    null;

  const tenantId = s(
    req.tenantId ||
      tenant?.id ||
      tenant?.tenant_id ||
      user?.tenantId ||
      user?.tenant_id ||
      req.auth?.tenantId
  );

  const tenantKey = s(
    req.tenantKey ||
      tenant?.key ||
      tenant?.tenant_key ||
      user?.tenantKey ||
      user?.tenant_key ||
      req.auth?.tenantKey
  );

  const role = s(user?.role || user?.user_role || req.auth?.role || "member");

  return {
    user,
    tenant,
    tenantId,
    tenantKey,
    role,
    requestId: s(req.requestId),
    correlationId: s(req.correlationId),
  };
}
