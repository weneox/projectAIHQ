import {
  dbGetTenantByKey,
  dbUpsertTenantAiPolicy,
  dbUpsertTenantCore,
  dbUpsertTenantProfile,
} from "../../db/helpers/settings.js";
import { dbGetAuthIdentityByEmail, dbUpdateAuthIdentity } from "../../db/helpers/authIdentities.js";
import { dbGetAuthIdentityMembership } from "../../db/helpers/authIdentityMemberships.js";
import { runWithTenantContext } from "../../db/tenantContext.js";
import { createTenantUser as createCanonicalTenantUser } from "../../routes/api/team/repository.js";
import { isReservedTenantKey, slugTenantKey, validTenantKey } from "../../routes/api/tenants/utils.js";
import { withTransaction } from "./canonicalUserAccess.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function normalizeTenantKeySeed(value = "") {
  const seed = slugTenantKey(value);
  if (!seed) return "workspace";
  if (!isReservedTenantKey(seed) && validTenantKey(seed)) return seed;
  return `${seed}-workspace`.slice(0, 63);
}

export async function reserveUniqueTenantKey(db, companyName = "", explicitTenantKey = "") {
  const baseSeed = normalizeTenantKeySeed(explicitTenantKey || companyName);
  let attempt = 0;

  while (attempt < 50) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const available = `${baseSeed}${suffix}`.slice(0, 63).replace(/-+$/g, "");
    if (!available || isReservedTenantKey(available) || !validTenantKey(available)) {
      attempt += 1;
      continue;
    }

    const existing = await dbGetTenantByKey(db, available);
    if (!existing?.id) {
      return available;
    }

    attempt += 1;
  }

  throw new Error("Unable to reserve a unique workspace key");
}

export async function createSelfServiceWorkspace({
  db,
  requestId = "",
  source = "auth.signup",
  email,
  fullName = "",
  companyName,
  websiteUrl = "",
  explicitTenantKey = "",
  passwordHash = null,
  authProvider = "local",
  providerSubject = "",
  emailVerified = false,
  userMeta = {},
  identityMeta = {},
} = {}) {
  const normalizedEmail = lower(email);
  const cleanCompanyName = s(companyName);
  if (!db || !normalizedEmail || !cleanCompanyName) {
    throw new Error("workspace creation requires database, email, and workspace name");
  }

  const created = await withTransaction(db, async (tx) => {
    const tenantKey = await reserveUniqueTenantKey(tx, cleanCompanyName, explicitTenantKey);
    const tenant = await dbUpsertTenantCore(tx, tenantKey, {
      tenant_key: tenantKey,
      company_name: cleanCompanyName,
      plan_key: "free",
      status: "trial",
      lifecycle_status: "trial",
      billing_status: "trialing",
    });

    return runWithTenantContext(
      {
        tenantId: tenant.id,
        tenantKey,
        requestId,
        source,
        reason: "self_service_workspace_creation",
      },
      async () => {
        await dbUpsertTenantProfile(tx, tenant.id, {
          brand_name: cleanCompanyName,
          website_url: s(websiteUrl) || null,
        });
        await dbUpsertTenantAiPolicy(tx, tenant.id, {});

        const user = await createCanonicalTenantUser(tx, tenant.id, {
          user_email: normalizedEmail,
          full_name: s(fullName) || cleanCompanyName,
          role: "owner",
          status: "active",
          password_hash: passwordHash || null,
          auth_provider: authProvider || "local",
          email_verified: emailVerified === true,
          permissions: {},
          meta: {
            signupCreated: true,
            emailVerificationRequired: emailVerified !== true,
            ...userMeta,
          },
        });

        let identity = await dbGetAuthIdentityByEmail(tx, normalizedEmail);
        if (identity?.id && (providerSubject || emailVerified === true || Object.keys(identityMeta).length)) {
          const nextProvider =
            identity.password_hash && lower(identity.auth_provider, "local") === "local"
              ? "local"
              : lower(authProvider, identity.auth_provider || "local");
          identity = await dbUpdateAuthIdentity(tx, identity.id, {
            primary_email: identity.primary_email || normalizedEmail,
            normalized_email: normalizedEmail,
            password_hash: identity.password_hash,
            auth_provider: nextProvider,
            provider_subject: providerSubject || identity.provider_subject,
            email_verified: emailVerified === true ? true : identity.email_verified,
            status: identity.status || "active",
            meta: {
              ...(identity.meta || {}),
              ...identityMeta,
            },
            last_login_at: identity.last_login_at || null,
          });
        }

        const membership = await dbGetAuthIdentityMembership(tx, identity?.id, tenant.id);

        return {
          tenant,
          user,
          identity,
          membership,
        };
      }
    );
  });

  if (!created?.tenant?.id || !created?.identity?.id || !created?.membership?.id || !created?.user?.id) {
    throw new Error("workspace creation did not produce a complete auth context");
  }

  return created;
}
