function cleanString(v, fallback = "") {
  if (v === null || v === undefined) return String(fallback ?? "").trim();
  const s = String(v).trim();
  if (!s) return String(fallback ?? "").trim();
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
    return String(fallback ?? "").trim();
  }
  return s;
}

function cleanNullableString(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;
  return s;
}

function cleanLower(v, fallback = "") {
  return cleanString(v, fallback).toLowerCase();
}

function rowOrNull(r) {
  return r?.rows?.[0] || null;
}

export async function dbResolveTenantChannel(
  db,
  { channel, recipientId, pageId, igUserId }
) {
  if (!db) return null;

  const safeChannel = cleanLower(channel);
  const safeRecipientId = cleanNullableString(recipientId);
  const safePageId = cleanNullableString(pageId);
  const safeIgUserId = cleanNullableString(igUserId);

  if (!safeChannel) return null;
  if (!safeRecipientId && !safePageId && !safeIgUserId) return null;

  const q = await db.query(
    `
      select
        tc.id,
        tc.tenant_id,
        tc.channel_type,
        tc.provider,
        tc.display_name,
        tc.external_account_id,
        tc.external_page_id,
        tc.external_user_id,
        tc.external_username,
        tc.status,
        tc.is_primary,
        tc.config,
        tc.secrets_ref,
        tc.health,
        tc.last_sync_at,
        tc.created_at,
        tc.updated_at,
        t.tenant_key,
        t.company_name,
        t.legal_name,
        t.industry_key,
        t.country_code,
        t.timezone,
        t.default_language,
        t.enabled_languages,
        t.market_region,
        t.plan_key,
        t.status as tenant_status,
        t.active as tenant_active,
        t.lifecycle_status as tenant_lifecycle_status,
        t.billing_status as tenant_billing_status
      from tenant_channels tc
      join tenants t on t.id = tc.tenant_id
      where tc.channel_type = $1
        and t.active = true
        and t.status not in ('suspended', 'archived', 'deleted')
        and (
          ($2::text is not null and tc.external_page_id = $2)
          or ($3::text is not null and tc.external_user_id = $3)
          or ($4::text is not null and tc.external_account_id = $4)
        )
      order by
        tc.is_primary desc,
        tc.updated_at desc,
        tc.created_at desc
      limit 1
    `,
    [safeChannel, safePageId, safeRecipientId, safeIgUserId]
  );

  return rowOrNull(q);
}
