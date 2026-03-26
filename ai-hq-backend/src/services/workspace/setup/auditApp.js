import { compactDraftObject } from "./draftShared.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

export function getSetupAuditActor(actor = {}) {
  return (
    s(actor?.user?.email) ||
    s(actor?.user?.name) ||
    s(actor?.user?.full_name) ||
    s(actor?.user?.fullName) ||
    s(actor?.user?.id) ||
    "system"
  );
}

export async function auditSetupAction(
  db,
  actor,
  action,
  objectType,
  objectId,
  meta = {},
  deps = {}
) {
  const audit =
    deps.dbAudit ||
    (async (...args) => {
      const auditModule = await import("../../../db/helpers/audit.js");
      return auditModule.dbAudit(...args);
    });

  try {
    await audit(db, getSetupAuditActor(actor), action, objectType, objectId, {
      tenantId: actor?.tenantId || actor?.tenant?.id || null,
      tenantKey: actor?.tenantKey || actor?.tenant?.tenant_key || null,
      role: s(actor?.role || actor?.user?.role || "member"),
      ...compactDraftObject(meta),
    });
  } catch {}
}
