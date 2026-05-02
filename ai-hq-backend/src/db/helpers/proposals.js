import { deepFix, fixText } from "../../utils/textFix.js";
import { getTenantContext } from "../tenantContext.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function tenantScope(input = {}) {
  const context = getTenantContext() || {};
  const tenantId = s(input.tenantId || input.tenant_id || context.tenantId);
  const tenantKey = lower(input.tenantKey || input.tenant_key || context.tenantKey);

  if (!tenantId && !tenantKey) {
    if (input.allowSystemLookup === true) {
      return null;
    }
    const error = new Error("proposal access requires tenant context");
    error.code = "TENANT_CONTEXT_REQUIRED";
    throw error;
  }

  if (tenantId) {
    return {
      clause: "tenant_id = $2::uuid",
      values: [tenantId],
    };
  }

  return {
    clause: "tenant_key = $2::text",
    values: [tenantKey],
  };
}

export async function dbGetProposalById(db, idText, scopeInput = {}) {
  const scope = tenantScope(scopeInput);
  const q = await db.query(
    `select tenant_id, tenant_key, id, thread_id, agent, type, status, title, payload, created_at, decided_at, decision_by
     from proposals
     where id::text = $1::text
       ${scope ? `and ${scope.clause}` : ""}
     limit 1`,
    scope ? [String(idText), ...scope.values] : [String(idText)]
  );
  const row = q.rows?.[0] || null;
  if (!row) return null;
  row.title = fixText(row.title);
  row.payload = deepFix(row.payload);
  return row;
}

export async function dbSetProposalStatus(db, idText, status, patchPayload = {}, scopeInput = {}) {
  const scope = tenantScope(scopeInput);
  const q = await db.query(
    `update proposals
     set status = $2::text,
         payload = (coalesce(payload,'{}'::jsonb) || $3::jsonb)
     where id::text = $1::text
       and ${scope.clause.replace("$2", "$4")}
     returning tenant_id, tenant_key, id, thread_id, agent, type, status, title, payload, created_at, decided_at, decision_by`,
    [String(idText), String(status), deepFix(patchPayload || {}), ...scope.values]
  );
  const row = q.rows?.[0] || null;
  if (!row) return null;
  row.title = fixText(row.title);
  row.payload = deepFix(row.payload);
  return row;
}
