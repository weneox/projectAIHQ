function cleanString(value, fallback = "") {
  if (value == null) return String(fallback ?? "").trim();
  const text = String(value).trim();
  if (!text) return String(fallback ?? "").trim();
  if (text.toLowerCase() === "null" || text.toLowerCase() === "undefined") {
    return String(fallback ?? "").trim();
  }
  return text;
}

function cleanLower(value, fallback = "") {
  return cleanString(value, fallback).toLowerCase();
}

function asJsonObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function asJsonArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function json(value, fallback) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function rowOrNull(result) {
  return result?.rows?.[0] || null;
}

export function normalizeTenantDomainVerificationRow(row) {
  if (!row) return null;

  return {
    id: cleanString(row.id),
    tenant_id: cleanString(row.tenant_id),
    channel_type: cleanLower(row.channel_type, "webchat"),
    verification_scope: cleanLower(row.verification_scope, "website_widget"),
    verification_method: cleanLower(row.verification_method, "dns_txt"),
    domain: cleanLower(row.domain),
    normalized_domain: cleanLower(row.normalized_domain || row.domain),
    status: cleanLower(row.status, "unverified"),
    challenge_token: cleanString(row.challenge_token),
    challenge_dns_name: cleanLower(row.challenge_dns_name),
    challenge_dns_value: cleanString(row.challenge_dns_value),
    challenge_version: Number(row.challenge_version || 0),
    requested_by: cleanString(row.requested_by),
    last_checked_at: row.last_checked_at || null,
    verified_at: row.verified_at || null,
    status_reason_code: cleanLower(row.status_reason_code),
    status_message: cleanString(row.status_message),
    verification_meta: asJsonObject(row.verification_meta, {}),
    last_seen_values: asJsonArray(row.last_seen_values, []),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export async function dbGetTenantDomainVerification(
  db,
  tenantId,
  { channelType = "webchat", normalizedDomain = "" } = {}
) {
  if (!db || !tenantId || !normalizedDomain) return null;

  const result = await db.query(
    `
      select *
      from tenant_domain_verifications
      where tenant_id = $1
        and channel_type = $2
        and normalized_domain = $3
      limit 1
    `,
    [tenantId, cleanLower(channelType, "webchat"), cleanLower(normalizedDomain)]
  );

  return normalizeTenantDomainVerificationRow(rowOrNull(result));
}

export async function dbGetLatestTenantDomainVerification(
  db,
  tenantId,
  { channelType = "webchat" } = {}
) {
  if (!db || !tenantId) return null;

  const result = await db.query(
    `
      select *
      from tenant_domain_verifications
      where tenant_id = $1
        and channel_type = $2
      order by verified_at desc nulls last, updated_at desc, created_at desc
      limit 1
    `,
    [tenantId, cleanLower(channelType, "webchat")]
  );

  return normalizeTenantDomainVerificationRow(rowOrNull(result));
}

export async function dbUpsertTenantDomainVerification(db, tenantId, input = {}) {
  if (!db || !tenantId) return null;

  const tenant_id = cleanString(tenantId);
  const channel_type = cleanLower(input.channel_type, "webchat");
  const verification_scope = cleanLower(input.verification_scope, "website_widget");
  const verification_method = cleanLower(input.verification_method, "dns_txt");
  const domain = cleanLower(input.domain);
  const normalized_domain = cleanLower(input.normalized_domain || domain);
  const status = cleanLower(input.status, "unverified");
  const challenge_token = cleanString(input.challenge_token);
  const challenge_dns_name = cleanLower(input.challenge_dns_name);
  const challenge_dns_value = cleanString(input.challenge_dns_value);
  const challenge_version = Math.max(1, Number(input.challenge_version || 1));
  const requested_by = cleanString(input.requested_by);
  const last_checked_at = input.last_checked_at || null;
  const verified_at = input.verified_at || null;
  const status_reason_code = cleanLower(input.status_reason_code);
  const status_message = cleanString(input.status_message);
  const verification_meta = asJsonObject(input.verification_meta, {});
  const last_seen_values = asJsonArray(input.last_seen_values, []);

  const result = await db.query(
    `
      insert into tenant_domain_verifications (
        tenant_id,
        channel_type,
        verification_scope,
        verification_method,
        domain,
        normalized_domain,
        status,
        challenge_token,
        challenge_dns_name,
        challenge_dns_value,
        challenge_version,
        requested_by,
        last_checked_at,
        verified_at,
        status_reason_code,
        status_message,
        verification_meta,
        last_seen_values
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17::jsonb,
        $18::jsonb
      )
      on conflict (tenant_id, channel_type, normalized_domain) do update
      set
        verification_scope = excluded.verification_scope,
        verification_method = excluded.verification_method,
        domain = excluded.domain,
        status = excluded.status,
        challenge_token = excluded.challenge_token,
        challenge_dns_name = excluded.challenge_dns_name,
        challenge_dns_value = excluded.challenge_dns_value,
        challenge_version = excluded.challenge_version,
        requested_by = excluded.requested_by,
        last_checked_at = excluded.last_checked_at,
        verified_at = excluded.verified_at,
        status_reason_code = excluded.status_reason_code,
        status_message = excluded.status_message,
        verification_meta = excluded.verification_meta,
        last_seen_values = excluded.last_seen_values
      returning *
    `,
    [
      tenant_id,
      channel_type,
      verification_scope,
      verification_method,
      domain,
      normalized_domain,
      status,
      challenge_token,
      challenge_dns_name,
      challenge_dns_value,
      challenge_version,
      requested_by,
      last_checked_at,
      verified_at,
      status_reason_code,
      status_message,
      json(verification_meta, {}),
      json(last_seen_values, []),
    ]
  );

  return normalizeTenantDomainVerificationRow(rowOrNull(result));
}
