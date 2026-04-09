import express from "express";

import {
  createUserSessionRecord,
  getUserCookieName,
  hashUserPassword,
  isUserAuthConfigured,
  userCookieOptions,
  clearUserCookie,
} from "../../../utils/adminAuth.js";
import { setNoStore, s, lower, getIp } from "./utils.js";
import { dbGetTenantByKey, dbUpsertTenantAiPolicy, dbUpsertTenantCore, dbUpsertTenantProfile } from "../../../db/helpers/settings.js";
import { dbGetAuthIdentityByEmail } from "../../../db/helpers/authIdentities.js";
import { dbGetAuthIdentityMembership } from "../../../db/helpers/authIdentityMemberships.js";
import { loadActiveWorkspaceContract } from "../../../services/workspace/activeWorkspace.js";
import { createTenantUser as createCanonicalTenantUser } from "../team/repository.js";
import {
  ensureCanonicalAndLegacyAccessForEmail,
  listLegacyTenantUsersByEmail,
  withTransaction,
} from "../../../services/auth/canonicalUserAccess.js";
import { isLikelyEmail, isReservedTenantKey, slugTenantKey, validTenantKey } from "../tenants/utils.js";
import { markIdentityLogin, markUserLogin } from "./repository.js";

function normalizeTenantKeySeed(value = "") {
  const seed = slugTenantKey(value);
  if (!seed) return "workspace";
  if (!isReservedTenantKey(seed) && validTenantKey(seed)) return seed;
  return `${seed}-workspace`.slice(0, 63);
}

async function reserveUniqueTenantKey(db, companyName = "", explicitTenantKey = "") {
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

export function userSignupRoutes({
  db,
  resolveWorkspaceState = loadActiveWorkspaceContract,
} = {}) {
  const r = express.Router();

  r.post("/auth/signup", async (req, res) => {
    setNoStore(res);

    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Database is not available",
      });
    }

    if (!isUserAuthConfigured()) {
      return res.status(500).json({
        ok: false,
        error: "User auth is not configured",
      });
    }

    const email = lower(req.body?.email);
    const password = s(req.body?.password);
    const fullName = s(req.body?.fullName || req.body?.full_name);
    const companyName = s(req.body?.companyName || req.body?.company_name);
    const websiteUrl = s(req.body?.websiteUrl || req.body?.website_url);
    const explicitTenantKey = s(req.body?.tenantKey || req.body?.tenant_key).toLowerCase();

    if (!email) {
      return res.status(400).json({ ok: false, error: "email is required" });
    }

    if (!isLikelyEmail(email)) {
      return res.status(400).json({ ok: false, error: "email is invalid" });
    }

    if (!password) {
      return res.status(400).json({ ok: false, error: "password is required" });
    }

    if (!companyName) {
      return res.status(400).json({ ok: false, error: "companyName is required" });
    }

    try {
      const existing = await ensureCanonicalAndLegacyAccessForEmail(db, { email });
      const legacyUsers = await listLegacyTenantUsersByEmail(db, { email });
      if (existing?.identity?.id || legacyUsers.length) {
        return res.status(409).json({
          ok: false,
          error: "An account with this email already exists",
          code: "identity_exists",
        });
      }

      const created = await withTransaction(db, async (tx) => {
        const tenantKey = await reserveUniqueTenantKey(tx, companyName, explicitTenantKey);
        const tenant = await dbUpsertTenantCore(tx, tenantKey, {
          tenant_key: tenantKey,
          company_name: companyName,
        });

        await dbUpsertTenantProfile(tx, tenant.id, {
          brand_name: companyName,
          website_url: websiteUrl || null,
        });
        await dbUpsertTenantAiPolicy(tx, tenant.id, {});

        const user = await createCanonicalTenantUser(tx, tenant.id, {
          user_email: email,
          full_name: fullName || companyName,
          role: "owner",
          status: "active",
          password_hash: hashUserPassword(password),
          auth_provider: "local",
          email_verified: true,
          permissions: {},
          meta: {
            signupCreated: true,
          },
        });

        const identity = await dbGetAuthIdentityByEmail(tx, email);
        const membership = await dbGetAuthIdentityMembership(tx, identity?.id, tenant.id);

        return {
          tenant,
          user,
          identity,
          membership,
        };
      });

      if (!created?.identity?.id || !created?.membership?.id || !created?.user?.id) {
        return res.status(500).json({
          ok: false,
          error: "Signup could not be completed",
          code: "signup_incomplete",
        });
      }

      const workspace = await resolveWorkspaceState({
        db,
        tenantId: created.tenant.id,
        tenantKey: created.tenant.tenant_key,
        membershipId: created.membership.id,
        role: created.membership.role,
        tenant: {
          id: created.tenant.id,
          tenant_key: created.tenant.tenant_key,
          company_name: created.tenant.company_name,
        },
      });

      const { token, expiresAt } = await createUserSessionRecord(
        db,
        {
          identityId: created.identity.id,
          membershipId: created.membership.id,
          tenant_id: created.tenant.id,
          tenant_key: created.tenant.tenant_key,
          session_version: 1,
        },
        {
          ip: getIp(req),
          ua: s(req.headers["user-agent"]),
        }
      );

      clearUserCookie(res);
      res.cookie(getUserCookieName(), token, userCookieOptions(req));

      await Promise.allSettled([
        markIdentityLogin(db, created.identity.id),
        markUserLogin(db, created.user.id),
      ]);

      return res.status(201).json({
        ok: true,
        created: true,
        authenticated: true,
        authType: "tenant_user",
        user: {
          id: created.user.id,
          email: created.identity.primary_email || created.identity.normalized_email,
          fullName: created.user.full_name || "",
          role: created.user.role,
          tenantId: created.tenant.id,
          tenantKey: created.tenant.tenant_key,
          companyName: created.tenant.company_name || "",
          identityId: created.identity.id,
          membershipId: created.membership.id,
          sessionExpiresAt: expiresAt,
        },
        workspace,
        destination: workspace?.destination || {
          kind: "setup",
          path: "/home?assistant=setup",
        },
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: s(error?.message || error || "Signup failed"),
      });
    }
  });

  return r;
}
