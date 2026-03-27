import { isDbReady } from "../../../../utils/http.js";
import { resolveTenantKey } from "../../../../tenancy/index.js";
import { normalizeComment } from "../utils.js";

export async function getCommentById(db, id) {
  if (!isDbReady(db)) return null;

  const result = await db.query(
    `
    select
      id, tenant_key, channel, source, external_comment_id, external_parent_comment_id,
      external_post_id, external_user_id, external_username, customer_name, text,
      classification, raw, created_at, updated_at
    from comments
    where id = $1::uuid
    limit 1
    `,
    [id]
  );

  return normalizeComment(result.rows?.[0] || null);
}

export async function getExistingCommentByExternalId(
  db,
  tenantKey,
  channel,
  externalCommentId
) {
  if (!isDbReady(db)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);
  const result = await db.query(
    `
    select
      id, tenant_key, channel, source, external_comment_id, external_parent_comment_id,
      external_post_id, external_user_id, external_username, customer_name, text,
      classification, raw, created_at, updated_at
    from comments
    where tenant_key = $1::text
      and channel = $2::text
      and external_comment_id = $3::text
    limit 1
    `,
    [resolvedTenantKey, channel, externalCommentId]
  );

  return normalizeComment(result.rows?.[0] || null);
}

export async function insertComment(db, payload) {
  if (!isDbReady(db)) return null;

  const resolvedTenantKey = resolveTenantKey(payload.tenantKey);
  const result = await db.query(
    `
    insert into comments (
      tenant_key, channel, source, external_comment_id, external_parent_comment_id,
      external_post_id, external_user_id, external_username, customer_name, text,
      classification, raw, created_at, updated_at
    )
    values (
      $1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text,
      $9::text, $10::text, $11::jsonb, $12::jsonb, to_timestamp($13::double precision / 1000.0), now()
    )
    returning
      id, tenant_key, channel, source, external_comment_id, external_parent_comment_id,
      external_post_id, external_user_id, external_username, customer_name, text,
      classification, raw, created_at, updated_at
    `,
    [
      resolvedTenantKey,
      payload.channel,
      payload.source,
      payload.externalCommentId,
      payload.externalParentCommentId,
      payload.externalPostId,
      payload.externalUserId,
      payload.externalUsername,
      payload.customerName,
      payload.text,
      JSON.stringify(payload.classification || {}),
      JSON.stringify(payload.raw || {}),
      payload.timestampMs,
    ]
  );

  return normalizeComment(result.rows?.[0] || null);
}

export async function updateCommentState(db, id, nextClassification, nextRaw) {
  if (!isDbReady(db)) return null;

  const result = await db.query(
    `
    update comments
    set
      classification = $2::jsonb,
      raw = $3::jsonb,
      updated_at = now()
    where id = $1::uuid
    returning
      id, tenant_key, channel, source, external_comment_id, external_parent_comment_id,
      external_post_id, external_user_id, external_username, customer_name, text,
      classification, raw, created_at, updated_at
    `,
    [id, JSON.stringify(nextClassification || {}), JSON.stringify(nextRaw || {})]
  );

  return normalizeComment(result.rows?.[0] || null);
}

export async function listComments(db, { tenantKey, channel, category, q, limit }) {
  if (!isDbReady(db)) return [];

  const resolvedTenantKey = resolveTenantKey(tenantKey);
  const values = [resolvedTenantKey];
  const where = [`tenant_key = $1::text`];

  if (channel) {
    values.push(channel);
    where.push(`channel = $${values.length}::text`);
  }

  if (category) {
    values.push(category);
    where.push(`coalesce(classification->>'category', '') = $${values.length}::text`);
  }

  if (q) {
    values.push(`%${q}%`);
    const i = values.length;
    where.push(`
      (
        coalesce(text, '') ilike $${i}
        or coalesce(external_username, '') ilike $${i}
        or coalesce(customer_name, '') ilike $${i}
        or coalesce(external_post_id, '') ilike $${i}
        or coalesce(external_comment_id, '') ilike $${i}
      )
    `);
  }

  values.push(Number(limit || 50));

  const result = await db.query(
    `
    select
      id, tenant_key, channel, source, external_comment_id, external_parent_comment_id,
      external_post_id, external_user_id, external_username, customer_name, text,
      classification, raw, created_at, updated_at
    from comments
    where ${where.join(" and ")}
    order by created_at desc, updated_at desc
    limit $${values.length}::int
    `,
    values
  );

  return (result.rows || []).map(normalizeComment);
}
