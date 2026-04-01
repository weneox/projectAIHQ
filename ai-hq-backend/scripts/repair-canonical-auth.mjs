import "dotenv/config";

import { assertConfigValid } from "../src/config/validate.js";
import { closeDb, getDb, initDb } from "../src/db/index.js";
import { dbListAuthIdentityMembershipsByIdentity } from "../src/db/helpers/authIdentityMemberships.js";
import {
  ensureCanonicalAndLegacyAccessForEmail,
  ensureLegacyBridgeForMemberships,
  listLegacyTenantUsersByEmail,
} from "../src/services/auth/canonicalUserAccess.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function parseArgs(argv = []) {
  const out = {
    email: "",
    tenantKey: "",
    limit: 0,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = s(argv[i]);

    if (token === "--email") {
      out.email = lower(argv[i + 1]);
      i += 1;
      continue;
    }

    if (token === "--tenant" || token === "--tenantKey") {
      out.tenantKey = lower(argv[i + 1]);
      i += 1;
      continue;
    }

    if (token === "--limit") {
      const next = Number(argv[i + 1] || 0);
      out.limit = Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0;
      i += 1;
      continue;
    }

    if (token === "--verbose") {
      out.verbose = true;
    }
  }

  return out;
}

function pickUniqueTenantIds(legacyUsers = []) {
  return Array.from(
    new Set(
      legacyUsers
        .map((user) => s(user?.tenant_id))
        .filter(Boolean)
    )
  );
}

function classifyLegacyState(legacyUsers = []) {
  const result = {
    total: legacyUsers.length,
    activeOrInvited: 0,
    disabledOrRemoved: 0,
    passwordHashPresent: 0,
  };

  for (const user of legacyUsers) {
    const status = lower(user?.status, "active");
    if (status === "active" || status === "invited") {
      result.activeOrInvited += 1;
    } else {
      result.disabledOrRemoved += 1;
    }

    if (s(user?.password_hash)) {
      result.passwordHashPresent += 1;
    }
  }

  return result;
}

async function listTargetEmails(db, { email = "", tenantKey = "", limit = 0 } = {}) {
  if (email) return [lower(email)];

  const params = [];
  const clauses = [];
  let paramIndex = 1;

  if (tenantKey) {
    params.push(tenantKey);
    clauses.push(`lower(t.tenant_key) = $${paramIndex++}`);
  }

  const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const limitSql = limit > 0 ? `limit ${Number(limit)}` : "";

  const query = await db.query(`
    select distinct lower(tu.user_email) as email
    from tenant_users tu
    join tenants t on t.id = tu.tenant_id
    ${whereSql}
    order by lower(tu.user_email) asc
    ${limitSql}
  `, params);

  return (query?.rows || [])
    .map((row) => lower(row?.email))
    .filter(Boolean);
}

async function repairOneEmail(db, email, { tenantKey = "", verbose = false } = {}) {
  const legacyUsers = await listLegacyTenantUsersByEmail(db, { email, tenantKey });
  const legacyState = classifyLegacyState(legacyUsers);

  if (!legacyUsers.length) {
    return {
      email,
      ok: false,
      code: "legacy_user_not_found",
      legacyState,
      identityId: "",
      membershipCount: 0,
      bridgeCreated: 0,
      bridgeExisting: 0,
      bridgeFailed: 0,
    };
  }

  const canonical = await ensureCanonicalAndLegacyAccessForEmail(db, { email, tenantKey });
  const identity = canonical?.identity || null;

  if (!identity?.id) {
    return {
      email,
      ok: false,
      code: canonical?.repair?.code || "identity_repair_failed",
      legacyState,
      identityId: "",
      membershipCount: 0,
      bridgeCreated: 0,
      bridgeExisting: 0,
      bridgeFailed: 0,
    };
  }

  const allMemberships = await dbListAuthIdentityMembershipsByIdentity(db, identity.id);
  const relevantTenantIds = new Set(pickUniqueTenantIds(legacyUsers));
  const relevantMemberships = allMemberships.filter((membership) =>
    relevantTenantIds.has(s(membership?.tenant_id))
  );

  const bridge = await ensureLegacyBridgeForMemberships(
    db,
    identity,
    relevantMemberships
  );

  const result = {
    email,
    ok: true,
    code: canonical?.repair?.code || "canonical_access_ready",
    legacyState,
    identityId: identity.id,
    membershipCount: relevantMemberships.length,
    bridgeCreated: Number(bridge?.repaired?.length || 0),
    bridgeExisting: Number(bridge?.existing?.length || 0),
    bridgeFailed: Number(bridge?.failed?.length || 0),
  };

  if (verbose) {
    console.log(
      "[repair-canonical-auth] repaired",
      JSON.stringify(result, null, 2)
    );
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  assertConfigValid(console);
  await initDb();

  const db = getDb();
  if (!db?.query) {
    throw new Error("DATABASE_URL is required for canonical auth repair");
  }

  const emails = await listTargetEmails(db, args);

  if (!emails.length) {
    console.log(
      "[repair-canonical-auth] no matching tenant users found",
      JSON.stringify(
        {
          email: args.email || null,
          tenantKey: args.tenantKey || null,
          limit: args.limit || null,
        },
        null,
        2
      )
    );
    return;
  }

  const summary = {
    totalEmails: emails.length,
    ok: 0,
    failed: 0,
    membershipsRepaired: 0,
    bridgeCreated: 0,
    bridgeExisting: 0,
    bridgeFailed: 0,
    results: [],
  };

  for (const email of emails) {
    try {
      const result = await repairOneEmail(db, email, args);
      summary.results.push(result);

      if (result.ok) {
        summary.ok += 1;
      } else {
        summary.failed += 1;
      }

      summary.membershipsRepaired += Number(result.membershipCount || 0);
      summary.bridgeCreated += Number(result.bridgeCreated || 0);
      summary.bridgeExisting += Number(result.bridgeExisting || 0);
      summary.bridgeFailed += Number(result.bridgeFailed || 0);

      if (!args.verbose) {
        console.log(
          `[repair-canonical-auth] ${result.ok ? "OK" : "FAIL"} ${result.email} :: ${result.code}`
        );
      }
    } catch (error) {
      summary.failed += 1;
      summary.results.push({
        email,
        ok: false,
        code: "unexpected_error",
        error: s(error?.message || error || "unexpected_error"),
      });

      console.error(
        `[repair-canonical-auth] FAIL ${email} :: ${s(
          error?.message || error || "unexpected_error"
        )}`
      );
    }
  }

  console.log(
    "[repair-canonical-auth] summary",
    JSON.stringify(
      {
        totalEmails: summary.totalEmails,
        ok: summary.ok,
        failed: summary.failed,
        membershipsRepaired: summary.membershipsRepaired,
        bridgeCreated: summary.bridgeCreated,
        bridgeExisting: summary.bridgeExisting,
        bridgeFailed: summary.bridgeFailed,
      },
      null,
      2
    )
  );

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[repair-canonical-auth] fatal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });