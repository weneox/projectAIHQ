import { deepFix, fixText } from "../../utils/textFix.js";

function cleanText(v, fallback = null) {
  const s = fixText(v == null ? "" : String(v)).trim();
  return s || fallback;
}

function cleanLower(v, fallback = "") {
  return cleanText(v, fallback)?.toLowerCase?.() || String(fallback || "").trim().toLowerCase();
}

function asObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function toIso(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

export function normalizeAuditRow(row = {}) {
  const meta = asObject(row?.meta);

  return {
    id: cleanText(row?.id, ""),
    tenantId: cleanText(row?.tenant_id || meta?.tenantId || meta?.tenant_id, null),
    tenantKey: cleanLower(row?.tenant_key || meta?.tenantKey || meta?.tenant_key, ""),
    actor: cleanText(row?.actor, "system"),
    action: cleanText(row?.action, "unknown.action"),
    objectType: cleanText(row?.object_type, "unknown"),
    objectId: row?.object_id == null ? null : String(row.object_id),
    meta,
    createdAt: toIso(row?.created_at),
  };
}

export async function dbAudit(db, actor, action, objectType, objectId, meta = {}) {
  try {
    const safeMeta = deepFix(meta || {});

    const tenantId =
      safeMeta.tenantId ||
      safeMeta.tenant_id ||
      null;

    const tenantKey =
      cleanText(safeMeta.tenantKey) ||
      cleanText(safeMeta.tenant_key) ||
      null;

    await db.query(
      `insert into audit_log (
        tenant_id,
        tenant_key,
        actor,
        action,
        object_type,
        object_id,
        meta
      )
      values ($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::jsonb)`,
      [
        tenantId,
        tenantKey,
        cleanText(actor, "system"),
        cleanText(action, "unknown.action"),
        cleanText(objectType, "unknown"),
        objectId == null ? null : String(objectId),
        safeMeta,
      ]
    );
  } catch {}
}

export async function dbListAuditEntries(
  db,
  { tenantId = "", tenantKey = "", actions = [], limit = 50, offset = 0 } = {}
) {
  if (!db?.query) return [];

  const safeTenantId = cleanText(tenantId, "");
  const safeTenantKey = cleanLower(tenantKey, "");
  if (!safeTenantId && !safeTenantKey) return [];

  const safeActions = Array.isArray(actions)
    ? actions.map((item) => cleanText(item, "")).filter(Boolean)
    : [];
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const safeOffset = Math.max(0, Number(offset) || 0);

  const params = [];
  const where = [];

  if (safeTenantId) {
    params.push(safeTenantId);
    where.push(`tenant_id = $${params.length}`);
  }

  if (safeTenantKey) {
    params.push(safeTenantKey);
    where.push(`lower(coalesce(tenant_key, '')) = $${params.length}`);
  }

  if (safeActions.length) {
    params.push(safeActions);
    where.push(`action = any($${params.length}::text[])`);
  }

  params.push(safeLimit);
  const limitIdx = params.length;
  params.push(safeOffset);
  const offsetIdx = params.length;

  try {
    const result = await db.query(
      `
        select *
        from audit_log
        where (${where.join(" or ")})
        order by created_at desc
        limit $${limitIdx}
        offset $${offsetIdx}
      `,
      params
    );

    return Array.isArray(result?.rows)
      ? result.rows.map((row) => normalizeAuditRow(row))
      : [];
  } catch {
    return [];
  }
}
