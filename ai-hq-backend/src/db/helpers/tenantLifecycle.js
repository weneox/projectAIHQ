import { runWithSystemDbContext } from "../tenantContext.js";

function s(v, d = "") {
  const out = String(v ?? "").trim();
  return out || String(d ?? "").trim();
}

export async function writeTenantLifecycleEvent(
  db,
  {
    tenantId = "",
    tenantKey = "",
    actor = "system",
    action = "",
    statusFrom = "",
    statusTo = "",
    reason = "",
    requestId = "",
    meta = {},
  } = {}
) {
  if (!db?.query || !tenantId || !tenantKey || !action) return null;

  const result = await runWithSystemDbContext("tenant_lifecycle_event", () =>
    db.query(
      `
      insert into tenant_lifecycle_events (
        tenant_id,
        tenant_key,
        actor,
        action,
        status_from,
        status_to,
        reason,
        meta,
        request_id
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
      returning *
      `,
      [
        s(tenantId),
        s(tenantKey).toLowerCase(),
        s(actor, "system"),
        s(action),
        s(statusFrom),
        s(statusTo),
        s(reason) || null,
        JSON.stringify(meta && typeof meta === "object" ? meta : {}),
        s(requestId) || null,
      ]
    )
  );

  return result.rows?.[0] || null;
}
