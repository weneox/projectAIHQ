import { lower, s } from "./utils.js";
import { queryDbWithTimeout } from "./utils.js";

export async function listTenantUsersForLogin(db, { email, tenantKey }) {
  if (!db) return [];

  const e = lower(email);
  const tk = s(tenantKey);

  if (!e) return [];

  const params = [e];
  let whereTenant = "";

  if (tk) {
    params.push(tk);
    whereTenant = `and lower(t.tenant_key) = lower($2)`;
  }

  const sql = `
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
    where lower(tu.user_email) = $1
      ${whereTenant}
    order by
      case when tu.status = 'active' then 0 else 1 end,
      tu.updated_at desc nulls last,
      tu.created_at desc nulls last
  `;

  const q = await queryDbWithTimeout(db, sql, params, {
    timeoutMs: 3000,
    label: "auth.login.listTenantUsers",
  });
  return Array.isArray(q?.rows) ? q.rows : [];
}

export async function findTenantUserForLogin(db, { email, tenantKey }) {
  const rows = await listTenantUsersForLogin(db, { email, tenantKey });
  return rows[0] || null;
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
