// src/utils/auditLog.js
import { getTenantContext } from "../db/tenantContext.js";
import { createLogger } from "./logger.js";

function s(v) {
  return String(v ?? "").trim();
}

const auditLogger = createLogger({
  service: "ai-hq-backend",
  component: "audit-log",
});

export async function writeAudit(db, entry = {}) {
  const context = getTenantContext() || {};
  const tenantId = s(entry.tenantId || entry.tenant_id || context.tenantId) || null;
  const tenantKey = s(entry.tenantKey || entry.tenant_key || context.tenantKey) || null;
  const requestId = s(entry.requestId || entry.request_id || context.requestId) || null;
  const actor = s(entry.actor || "system") || "system";
  const action = s(entry.action || "unknown") || "unknown";
  const objectType = s(entry.objectType || "unknown") || "unknown";
  const objectId = s(entry.objectId || "") || null;
  const meta =
    entry.meta && typeof entry.meta === "object" ? entry.meta : {};

  try {
    if (!db || typeof db.query !== "function") return null;

    const result = await db.query(
      `
      insert into audit_log (
        tenant_id,
        tenant_key,
        actor,
        action,
        object_type,
        object_id,
        meta,
        request_id
      )
      values (
        nullif($1::text, '')::uuid,
        nullif($2::text, ''),
        $3::text,
        $4::text,
        $5::text,
        $6::text,
        $7::jsonb,
        nullif($8::text, '')
      )
      returning id, tenant_id, tenant_key, request_id, actor, action, object_type, object_id, meta, created_at
      `,
      [
        tenantId || "",
        tenantKey || "",
        actor,
        action,
        objectType,
        objectId,
        JSON.stringify({
          ...meta,
          ...(requestId ? { requestId } : {}),
        }),
        requestId || "",
      ]
    );

    return result.rows?.[0] || null;
  } catch (error) {
    if (db?.__tenantGuardedDb !== true && db && typeof db.query === "function") {
      try {
        const legacyResult = await db.query(
          `
          insert into audit_log (
            actor,
            action,
            object_type,
            object_id,
            meta
          )
          values ($1::text,$2::text,$3::text,$4::text,$5::jsonb)
          returning id, actor, action, object_type, object_id, meta, created_at
          `,
          [
            actor,
            action,
            objectType,
            objectId,
            JSON.stringify({
              ...meta,
              ...(tenantId ? { tenantId } : {}),
              ...(tenantKey ? { tenantKey } : {}),
              ...(requestId ? { requestId } : {}),
            }),
          ]
        );
        return legacyResult.rows?.[0] || null;
      } catch {}
    }

    auditLogger.warn("audit.write.failed", {
      action: s(entry.action),
      objectType: s(entry.objectType),
      objectId: s(entry.objectId),
      tenantId: s(entry.tenantId || entry.tenant_id),
      tenantKey: s(entry.tenantKey || entry.tenant_key),
      errorMessage: s(error?.message || error),
      code: s(error?.code),
    });
    return null;
  }
}

export async function writeAuditEvent(db, entry = {}) {
  return writeAudit(db, entry);
}
