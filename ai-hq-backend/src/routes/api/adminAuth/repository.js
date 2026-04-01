import { lower, s } from "./utils.js";
import { queryDbWithTimeout } from "./utils.js";

export async function findAuthIdentityForLogin(db, { email }) {
  if (!db) return null;

  const normalizedEmail = lower(email);
  if (!normalizedEmail) return null;

  const query = await queryDbWithTimeout(
    db,
    `
      select
        id,
        primary_email,
        normalized_email,
        password_hash,
        auth_provider,
        provider_subject,
        email_verified,
        status,
        meta,
        last_login_at,
        created_at,
        updated_at
      from auth_identities
      where normalized_email = $1
      limit 1
    `,
    [normalizedEmail],
    {
      timeoutMs: 3000,
      label: "auth.login.findAuthIdentity",
    }
  );

  return query?.rows?.[0] || null;
}

export async function listIdentityMembershipChoicesForLogin(
  db,
  { identityId, tenantKey = "" } = {}
) {
  if (!db || !identityId) return [];

  const params = [s(identityId)];
  let whereTenant = "";

  if (s(tenantKey)) {
    params.push(s(tenantKey).toLowerCase());
    whereTenant = `and lower(t.tenant_key) = $2`;
  }

  const query = await queryDbWithTimeout(
    db,
    `
      select
        m.id,
        m.identity_id,
        m.tenant_id,
        m.role,
        m.status,
        m.permissions,
        m.meta,
        m.last_seen_at,
        t.tenant_key,
        t.company_name
      from auth_identity_memberships m
      join tenants t on t.id = m.tenant_id
      where m.identity_id = $1
        and m.status = 'active'
        ${whereTenant}
      order by
        case when m.role = 'owner' then 0 else 1 end,
        t.company_name asc nulls last,
        t.tenant_key asc
    `,
    params,
    {
      timeoutMs: 3000,
      label: "auth.login.listIdentityMembershipChoices",
    }
  );

  return Array.isArray(query?.rows) ? query.rows : [];
}

export async function findLegacyTenantUserForIdentityLogin(
  db,
  { tenantId, email } = {}
) {
  if (!db || !tenantId || !email) return null;

  const query = await queryDbWithTimeout(
    db,
    `
      select
        tu.id,
        tu.tenant_id,
        t.tenant_key,
        tu.user_email,
        tu.full_name,
        tu.role,
        tu.status,
        tu.password_hash,
        tu.auth_provider,
        tu.email_verified,
        tu.session_version,
        t.company_name
      from tenant_users tu
      join tenants t on t.id = tu.tenant_id
      where tu.tenant_id = $1
        and lower(tu.user_email) = $2
      limit 1
    `,
    [s(tenantId), lower(email)],
    {
      timeoutMs: 3000,
      label: "auth.login.findLegacyTenantUser",
    }
  );

  return query?.rows?.[0] || null;
}

export async function markUserLogin(db, userId) {
  if (!db || !userId) return;
  try {
    await queryDbWithTimeout(
      db,
      `
      update tenant_users
      set
        last_login_at = now(),
        last_seen_at = now(),
        updated_at = now()
      where id = $1
      `,
      [userId],
      {
        timeoutMs: 1500,
        label: "auth.login.markUserLogin",
      }
    );
  } catch {}
}

export async function markIdentityLogin(db, identityId) {
  if (!db || !identityId) return;
  try {
    await queryDbWithTimeout(
      db,
      `
      update auth_identities
      set
        last_login_at = now(),
        updated_at = now()
      where id = $1
      `,
      [s(identityId)],
      {
        timeoutMs: 1500,
        label: "auth.login.markIdentityLogin",
      }
    );
  } catch {}
}
