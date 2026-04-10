import test from "node:test";
import assert from "node:assert/strict";

import {
  checkWebsiteDomainVerification,
  createWebsiteDomainVerificationChallenge,
  getWebsiteWidgetStatus,
} from "../src/routes/api/channelConnect/website.js";
import { __test__ as websiteDomainVerificationTest } from "../src/services/websiteDomainVerification.js";

function normalizeSql(sql = "") {
  return String(sql || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function parseJsonLike(value, fallback) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  if (value && typeof value === "object") {
    return clone(value);
  }

  return fallback;
}

function buildAuthedReq({
  tenantKey = "acme",
  email = "owner@acme.test",
  role = "owner",
  body = {},
  query = {},
} = {}) {
  return {
    auth: {
      tenantKey,
      email,
      userId: "user-1",
      role,
    },
    user: {
      tenantKey,
      email,
      id: "user-1",
      role,
    },
    body,
    query,
    headers: {},
    get(name) {
      return this.headers[String(name || "").toLowerCase()];
    },
  };
}

class FakeWebsiteDomainVerificationDb {
  constructor() {
    this.tenant = {
      id: "tenant-1",
      tenant_key: "acme",
      company_name: "Acme",
      legal_name: "Acme LLC",
      industry_key: "generic_business",
      country_code: "AZ",
      timezone: "Asia/Baku",
      default_language: "az",
      enabled_languages: ["az"],
      market_region: "AZ",
      plan_key: "growth",
      status: "active",
      active: true,
    };
    this.websiteStatus = {
      id: this.tenant.id,
      tenant_key: this.tenant.tenant_key,
      company_name: this.tenant.company_name,
      timezone: this.tenant.timezone,
      website_url: "https://www.acme.example",
      widget_channel_id: "channel-webchat-1",
      widget_channel_status: "connected",
      widget_display_name: "Website chat",
      widget_provider: "website_widget",
      widget_config: {
        enabled: true,
        publicWidgetId: "ww_acme_widget",
        allowedDomains: ["acme.example"],
        allowedOrigins: ["https://www.acme.example"],
      },
      widget_updated_at: "2026-04-10T10:00:00.000Z",
    };
    this.verifications = new Map();
    this.auditEntries = [];
    this.clock = 0;
  }

  nextIso() {
    this.clock += 1;
    return `2026-04-10T10:00:${String(this.clock).padStart(2, "0")}.000Z`;
  }

  verificationKey(channelType, domain) {
    return `${String(channelType || "").toLowerCase()}:${String(domain || "").toLowerCase()}`;
  }

  listVerifications(channelType = "webchat") {
    return [...this.verifications.values()]
      .filter(
        (row) =>
          String(row.channel_type || "").toLowerCase() ===
          String(channelType || "").toLowerCase()
      )
      .sort((a, b) => {
        const aVerified = String(a.verified_at || "");
        const bVerified = String(b.verified_at || "");
        if (aVerified && bVerified) return bVerified.localeCompare(aVerified);
        if (bVerified) return 1;
        if (aVerified) return -1;
        return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
      });
  }

  async query(text, values = []) {
    const sql = normalizeSql(text);

    if (
      sql.includes("select * from tenants") &&
      sql.includes("where lower(tenant_key) = $1")
    ) {
      return {
        rows:
          String(values[0] || "").toLowerCase() === this.tenant.tenant_key
            ? [clone(this.tenant)]
            : [],
      };
    }

    if (
      sql.includes("from tenants t") &&
      sql.includes("left join tenant_profiles") &&
      sql.includes("tenant_channels")
    ) {
      return { rows: [clone(this.websiteStatus)] };
    }

    if (
      sql.includes("from tenant_domain_verifications") &&
      sql.includes("normalized_domain = $3")
    ) {
      const key = this.verificationKey(values[1], values[2]);
      const row = this.verifications.get(key) || null;
      return { rows: row ? [clone(row)] : [] };
    }

    if (
      sql.includes("from tenant_domain_verifications") &&
      sql.includes("order by verified_at desc nulls last")
    ) {
      return { rows: this.listVerifications(values[1]).slice(0, 1).map(clone) };
    }

    if (sql.startsWith("insert into tenant_domain_verifications")) {
      const existing = this.verifications.get(this.verificationKey(values[1], values[5]));
      const now = this.nextIso();
      const row = {
        id: existing?.id || `verification-${this.verifications.size + 1}`,
        tenant_id: values[0],
        channel_type: values[1],
        verification_scope: values[2],
        verification_method: values[3],
        domain: values[4],
        normalized_domain: values[5],
        status: values[6],
        challenge_token: values[7],
        challenge_dns_name: values[8],
        challenge_dns_value: values[9],
        challenge_version: values[10],
        requested_by: values[11],
        last_checked_at: values[12],
        verified_at: values[13],
        status_reason_code: values[14],
        status_message: values[15],
        verification_meta: parseJsonLike(values[16], {}),
        last_seen_values: parseJsonLike(values[17], []),
        created_at: existing?.created_at || now,
        updated_at: now,
      };
      this.verifications.set(this.verificationKey(row.channel_type, row.normalized_domain), row);
      return { rows: [clone(row)] };
    }

    if (sql.includes("insert into audit_log")) {
      this.auditEntries.push({
        action: values[3],
        objectType: values[4],
        objectId: values[5],
        meta: clone(values[6]),
      });
      return { rows: [] };
    }

    throw new Error(`Unhandled SQL in FakeWebsiteDomainVerificationDb: ${sql}`);
  }
}

test("website domain verification normalizes public website domains safely", () => {
  const normalized = websiteDomainVerificationTest.normalizeWebsiteVerificationDomain(
    "https://WWW.Acme.Example/pricing"
  );

  assert.equal(normalized.ok, true);
  assert.equal(normalized.domain, "acme.example");

  const wildcard = websiteDomainVerificationTest.normalizeWebsiteVerificationDomain(
    "*.acme.example"
  );
  assert.equal(wildcard.ok, false);
  assert.equal(wildcard.reasonCode, "website_domain_wildcard_unsupported");
});

test("website domain verification challenge creates a tenant-scoped pending DNS TXT record", async () => {
  const db = new FakeWebsiteDomainVerificationDb();

  const payload = await createWebsiteDomainVerificationChallenge({
    db,
    req: buildAuthedReq({
      body: {
        domain: "https://www.acme.example/pricing",
      },
    }),
  });

  assert.equal(payload.state, "pending");
  assert.equal(payload.domain, "acme.example");
  assert.equal(payload.challenge?.type, "TXT");
  assert.equal(payload.challenge?.name, "_aihq-webchat.acme.example");
  assert.match(
    String(payload.challenge?.value || ""),
    /^aihq-webchat-verification=/
  );
  assert.equal(payload.challengeVersion, 1);
  assert.equal(
    db.auditEntries.some(
      (entry) =>
        entry.action ===
        "settings.channel.webchat.domain_verification.challenge_created"
    ),
    true
  );
});

test("website domain verification check marks the record verified when DNS TXT matches", async () => {
  const db = new FakeWebsiteDomainVerificationDb();

  const challenge = await createWebsiteDomainVerificationChallenge({
    db,
    req: buildAuthedReq({
      body: {
        domain: "acme.example",
      },
    }),
  });

  const payload = await checkWebsiteDomainVerification({
    db,
    req: buildAuthedReq({
      body: {
        domain: "acme.example",
      },
    }),
    resolveTxtFn: async () => [[challenge.challenge.value]],
  });

  assert.equal(payload.state, "verified");
  assert.equal(payload.verified, true);
  assert.equal(payload.reasonCode, "dns_txt_verified");
  assert.equal(typeof payload.verifiedAt, "string");
});

test("website domain verification evaluator reports failed when TXT records do not match", async () => {
  const challenge = websiteDomainVerificationTest.buildWebsiteDomainVerificationChallenge(
    "acme.example"
  );

  const result = await websiteDomainVerificationTest.evaluateWebsiteDomainVerification(
    {
      ...challenge,
      status: "pending",
    },
    {
      resolveTxtFn: async () => [["wrong-token"]],
    }
  );

  assert.equal(result.status, "failed");
  assert.equal(result.status_reason_code, "dns_txt_mismatch");
  assert.deepEqual(result.last_seen_values, ["wrong-token"]);
});

test("website widget status exposes additive domain verification readiness without enforcing it yet", async () => {
  const db = new FakeWebsiteDomainVerificationDb();

  const payload = await getWebsiteWidgetStatus({
    db,
    req: buildAuthedReq({
      role: "member",
    }),
  });

  assert.equal(payload.state, "connected");
  assert.equal(payload.domainVerification?.state, "unverified");
  assert.equal(payload.domainVerification?.candidateDomain, "acme.example");
  assert.equal(payload.domainVerification?.requiredForProductionInstall, true);
  assert.equal(payload.domainVerification?.enforcementActive, false);
  assert.equal(
    payload.domainVerification?.readiness?.productionInstallReady,
    false
  );
});
