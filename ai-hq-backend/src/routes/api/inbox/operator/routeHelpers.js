import { writeAudit } from "../../../../utils/auditLog.js";
import { fixText } from "../../../../utils/textFix.js";
import { resolveTenantKeyFromReq } from "../../../../tenancy/index.js";
import { getTenantContext } from "../../../../platform/tenancy/index.js";
import { emitRealtimeEvent } from "../../../../realtime/events.js";
import { isUuid } from "../../../../utils/http.js";
import { s } from "../../../../modules/inbox/index.js";

export function getScopedTenantKey(req) {
  const ctx = getTenantContext(req);

  return (
    fixText(s(ctx?.tenantKey || "")) ||
    fixText(s(req.auth?.tenantKey || req.user?.tenantKey || "")) ||
    resolveTenantKeyFromReq(req)
  );
}

export function getScopedTenantId(req) {
  const ctx = getTenantContext(req);
  const tenantId = s(ctx?.tenantId || req.auth?.tenantId || req.user?.tenantId || "");
  return isUuid(tenantId) ? tenantId : "";
}

export function emitOperatorThreadEvent(wsHub, req, type, payload = {}) {
  try {
    emitRealtimeEvent(wsHub, {
      type,
      audience: "operator",
      tenantKey:
        payload?.thread?.tenant_key ||
        payload?.attempt?.tenant_key ||
        req.auth?.tenantKey,
      tenantId:
        payload?.thread?.tenant_id ||
        payload?.attempt?.tenant_id ||
        req.auth?.tenantId,
      ...payload,
    });
  } catch {}
}

export async function auditSafe(db, entry = {}) {
  try {
    await writeAudit(db, entry);
  } catch {}
}
