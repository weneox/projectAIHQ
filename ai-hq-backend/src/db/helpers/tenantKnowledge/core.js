import {
  refreshTenantRuntimeProjection,
  refreshTenantRuntimeProjectionStrict,
} from "../tenantRuntimeProjection.js";
import {
  s,
  hasQueryApi,
  hasConnectApi,
} from "./shared.js";
import {
  rowToCandidate,
  rowToKnowledgeItem,
  rowToBusinessProfile,
  rowToBusinessCapabilities,
} from "./mappers.js";

export async function q(db, text, params = []) {
  if (!hasQueryApi(db)) {
    throw new Error("tenantKnowledge: db.query(...) is required");
  }
  return db.query(text, params);
}

export async function resolveTenantIdentity(db, { tenantId, tenantKey }) {
  const id = s(tenantId);
  const key = s(tenantKey);

  if (id) {
    const r = await q(
      db,
      `
      select id, tenant_key
      from tenants
      where id = $1
      limit 1
      `,
      [id]
    );

    if (r.rows[0]) {
      return {
        tenant_id: s(r.rows[0].id),
        tenant_key: s(r.rows[0].tenant_key),
      };
    }
  }

  if (key) {
    const r = await q(
      db,
      `
      select id, tenant_key
      from tenants
      where lower(tenant_key) = lower($1)
      limit 1
      `,
      [key]
    );

    if (r.rows[0]) {
      return {
        tenant_id: s(r.rows[0].id),
        tenant_key: s(r.rows[0].tenant_key),
      };
    }
  }

  return null;
}

export async function withTx(db, fn) {
  if (hasConnectApi(db)) {
    const client = await db.connect();
    try {
      await q(client, "begin");
      const out = await fn(client);
      await q(client, "commit");
      return out;
    } catch (err) {
      try {
        await q(client, "rollback");
      } catch {}
      throw err;
    } finally {
      try {
        if (typeof client.release === "function") client.release();
      } catch {}
    }
  }

  await q(db, "begin");
  try {
    const out = await fn(db);
    await q(db, "commit");
    return out;
  } catch (err) {
    try {
      await q(db, "rollback");
    } catch {}
    throw err;
  }
}

export async function refreshRuntimeProjectionBestEffort(
  db,
  {
    tenantId = "",
    tenantKey = "",
    triggerType = "review_approval",
    requestedBy = "tenantKnowledge",
    runnerKey = "tenantKnowledge",
    generatedBy = "system",
    metadata = {},
  } = {}
) {
  if (!hasQueryApi(db)) return null;
  if (!s(tenantId) && !s(tenantKey)) return null;

  try {
    return await refreshTenantRuntimeProjection(
      {
        tenantId: s(tenantId),
        tenantKey: s(tenantKey),
        triggerType,
        requestedBy,
        runnerKey,
        generatedBy,
        metadata,
      },
      db
    );
  } catch {
    return null;
  }
}

export async function refreshRuntimeProjectionRequired(
  db,
  {
    tenantId = "",
    tenantKey = "",
    triggerType = "review_approval",
    requestedBy = "tenantKnowledge",
    runnerKey = "tenantKnowledge",
    generatedBy = "system",
    metadata = {},
  } = {}
) {
  if (!hasQueryApi(db)) {
    throw new Error("tenantKnowledge: db.query(...) is required for runtime projection refresh");
  }
  if (!s(tenantId) && !s(tenantKey)) {
    throw new Error("tenantKnowledge: tenantId or tenantKey is required for runtime projection refresh");
  }

  return await refreshTenantRuntimeProjectionStrict(
    {
      tenantId: s(tenantId),
      tenantKey: s(tenantKey),
      triggerType,
      requestedBy,
      runnerKey,
      generatedBy,
      metadata,
    },
    db
  );
}

export async function getCandidateByIdInternal(db, candidateId) {
  const r = await q(
    db,
    `
    select *
    from tenant_knowledge_candidates
    where id = $1
    limit 1
    `,
    [s(candidateId)]
  );

  return rowToCandidate(r.rows[0]);
}

export async function getKnowledgeItemByIdInternal(db, id) {
  const r = await q(
    db,
    `
    select *
    from tenant_knowledge_items
    where id = $1
    limit 1
    `,
    [s(id)]
  );

  return rowToKnowledgeItem(r.rows[0]);
}

export async function getKnowledgeItemByCanonicalKeyInternal(db, { tenantId, tenantKey, canonicalKey }) {
  const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
  if (!tenant) return null;

  const r = await q(
    db,
    `
    select *
    from tenant_knowledge_items
    where tenant_id = $1
      and canonical_key = $2
    limit 1
    `,
    [tenant.tenant_id, s(canonicalKey)]
  );

  return rowToKnowledgeItem(r.rows[0]);
}

export async function getBusinessProfileInternal(db, { tenantId, tenantKey }) {
  const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
  if (!tenant) return null;

  const r = await q(
    db,
    `
    select *
    from tenant_business_profile
    where tenant_id = $1
    limit 1
    `,
    [tenant.tenant_id]
  );

  return rowToBusinessProfile(r.rows[0]);
}

export async function getBusinessCapabilitiesInternal(db, { tenantId, tenantKey }) {
  const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
  if (!tenant) return null;

  const r = await q(
    db,
    `
    select *
    from tenant_business_capabilities
    where tenant_id = $1
    limit 1
    `,
    [tenant.tenant_id]
  );

  return rowToBusinessCapabilities(r.rows[0]);
}
