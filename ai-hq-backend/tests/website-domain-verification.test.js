import test from "node:test";
import assert from "node:assert/strict";

import {
  checkWebsiteDomainVerification,
  createWebsiteDomainVerificationChallenge,
  createWebsiteWidgetGtmInstallHandoff,
  createWebsiteWidgetInstallHandoff,
  createWebsiteWidgetWordpressInstallHandoff,
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
  headers = {
    host: "app.example.test",
    "x-forwarded-proto": "https",
  },
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
    headers,
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

async function withWebsiteHandoffEnv(
  {
    nodeEnv,
    appEnv,
    allowUnverifiedHandoffs,
  } = {},
  callback
) {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAppEnv = process.env.APP_ENV;
  const previousAllowUnverifiedHandoffs =
    process.env.WEBSITE_WIDGET_ALLOW_UNVERIFIED_HANDOFFS;

  if (nodeEnv == null) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;

  if (appEnv == null) delete process.env.APP_ENV;
  else process.env.APP_ENV = appEnv;

  if (allowUnverifiedHandoffs == null) {
    delete process.env.WEBSITE_WIDGET_ALLOW_UNVERIFIED_HANDOFFS;
  } else {
    process.env.WEBSITE_WIDGET_ALLOW_UNVERIFIED_HANDOFFS =
      allowUnverifiedHandoffs;
  }

  try {
    return await callback();
  } finally {
    if (previousNodeEnv == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;

    if (previousAppEnv == null) delete process.env.APP_ENV;
    else process.env.APP_ENV = previousAppEnv;

    if (previousAllowUnverifiedHandoffs == null) {
      delete process.env.WEBSITE_WIDGET_ALLOW_UNVERIFIED_HANDOFFS;
    } else {
      process.env.WEBSITE_WIDGET_ALLOW_UNVERIFIED_HANDOFFS =
        previousAllowUnverifiedHandoffs;
    }
  }
}

async function verifyWebsiteDomain(db, domain = "acme.example") {
  const challenge = await createWebsiteDomainVerificationChallenge({
    db,
    req: buildAuthedReq({
      body: {
        domain,
      },
    }),
  });

  await checkWebsiteDomainVerification({
    db,
    req: buildAuthedReq({
      body: {
        domain,
      },
    }),
    resolveTxtFn: async () => [[challenge.challenge.value]],
  });

  return challenge;
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

test("website widget unverified handoff helper stays strict for production unless explicitly overridden", () => {
  assert.equal(
    websiteDomainVerificationTest.shouldAllowUnverifiedWebsiteWidgetHandoffs({
      env: "production",
      override: "0",
    }),
    false
  );
  assert.equal(
    websiteDomainVerificationTest.shouldAllowUnverifiedWebsiteWidgetHandoffs({
      env: "test",
      override: "0",
    }),
    true
  );
  assert.equal(
    websiteDomainVerificationTest.shouldAllowUnverifiedWebsiteWidgetHandoffs({
      env: "production",
      override: "1",
    }),
    true
  );
});

test("website widget status blocks production install until domain ownership is verified", async () => {
  await withWebsiteHandoffEnv(
    {
      nodeEnv: "production",
      allowUnverifiedHandoffs: "0",
    },
    async () => {
      const db = new FakeWebsiteDomainVerificationDb();

      const payload = await getWebsiteWidgetStatus({
        db,
        req: buildAuthedReq({
          role: "member",
        }),
      });

      assert.equal(payload.state, "blocked");
      assert.equal(payload.domainVerification?.state, "unverified");
      assert.equal(payload.domainVerification?.candidateDomain, "acme.example");
      assert.equal(payload.domainVerification?.requiredForProductionInstall, true);
      assert.equal(payload.domainVerification?.enforcementActive, true);
      assert.equal(
        payload.domainVerification?.readiness?.productionInstallReady,
        false
      );
      assert.equal(payload.install?.productionBlocked, true);
      assert.equal(payload.install?.productionInstallReady, false);
      assert.equal(payload.install?.embedSnippet, "");
      assert.equal(payload.install?.unverifiedHandoffsAllowed, false);
      assert.equal(payload.install?.developerHandoffReady, false);
      assert.equal(payload.install?.gtmHandoffReady, false);
      assert.equal(payload.install?.wordpressHandoffReady, false);
      assert.equal(payload.install?.handoffTargetDomain, "acme.example");
      assert.equal(payload.readiness?.status, "blocked");
    }
  );
});

test("website widget install handoff returns a developer package only when production install is ready", async () => {
  await withWebsiteHandoffEnv(
    {
      nodeEnv: "production",
      allowUnverifiedHandoffs: "0",
    },
    async () => {
      const db = new FakeWebsiteDomainVerificationDb();

      await verifyWebsiteDomain(db);

      const payload = await createWebsiteWidgetInstallHandoff({
        db,
        req: buildAuthedReq(),
      });

      assert.equal(payload.ready, true);
      assert.equal(payload.targetDomain, "acme.example");
      assert.equal(payload.verifiedDomain, "acme.example");
      assert.equal(payload.productionReady, true);
      assert.equal(payload.testingOnly, false);
      assert.equal(payload.verificationState, "verified");
      assert.equal(payload.widgetId, "ww_acme_widget");
      assert.match(
        String(payload.embedSnippet || ""),
        /data-widget-id="ww_acme_widget"/
      );
      assert.match(
        String(payload.packageText || ""),
        /Verified domain: acme\.example/
      );
      assert.equal(
        db.auditEntries.some(
          (entry) =>
            entry.action ===
            "settings.channel.webchat.install_handoff.generated"
        ),
        true
      );
    }
  );
});

test("website widget install handoff refuses to generate while production install is blocked", async () => {
  await withWebsiteHandoffEnv(
    {
      nodeEnv: "production",
      allowUnverifiedHandoffs: "0",
    },
    async () => {
      const db = new FakeWebsiteDomainVerificationDb();

      await assert.rejects(
        () =>
          createWebsiteWidgetInstallHandoff({
            db,
            req: buildAuthedReq(),
          }),
        (error) => {
          assert.equal(error?.status, 409);
          assert.equal(error?.reasonCode, "website_domain_verification_missing");
          return true;
        }
      );
    }
  );
});

test("website widget GTM handoff returns a GTM package only when production install is ready", async () => {
  await withWebsiteHandoffEnv(
    {
      nodeEnv: "production",
      allowUnverifiedHandoffs: "0",
    },
    async () => {
      const db = new FakeWebsiteDomainVerificationDb();

      await verifyWebsiteDomain(db);

      const payload = await createWebsiteWidgetGtmInstallHandoff({
        db,
        req: buildAuthedReq(),
      });

      assert.equal(payload.ready, true);
      assert.equal(payload.packageType, "gtm");
      assert.equal(payload.targetDomain, "acme.example");
      assert.equal(payload.verifiedDomain, "acme.example");
      assert.equal(payload.productionReady, true);
      assert.equal(payload.testingOnly, false);
      assert.match(
        String(payload.gtmCustomHtmlSnippet || ""),
        /Website Chat GTM Custom HTML tag/
      );
      assert.match(String(payload.packageText || ""), /GTM Custom HTML tag:/);
      assert.equal(
        db.auditEntries.some(
          (entry) =>
            entry.action ===
            "settings.channel.webchat.install_handoff.gtm_generated"
        ),
        true
      );
    }
  );
});

test("website widget GTM handoff refuses to generate while production install is blocked", async () => {
  await withWebsiteHandoffEnv(
    {
      nodeEnv: "production",
      allowUnverifiedHandoffs: "0",
    },
    async () => {
      const db = new FakeWebsiteDomainVerificationDb();

      await assert.rejects(
        () =>
          createWebsiteWidgetGtmInstallHandoff({
            db,
            req: buildAuthedReq(),
          }),
        (error) => {
          assert.equal(error?.status, 409);
          assert.equal(error?.reasonCode, "website_domain_verification_missing");
          return true;
        }
      );
    }
  );
});

test("website widget WordPress handoff returns a WordPress package only when production install is ready", async () => {
  await withWebsiteHandoffEnv(
    {
      nodeEnv: "production",
      allowUnverifiedHandoffs: "0",
    },
    async () => {
      const db = new FakeWebsiteDomainVerificationDb();

      await verifyWebsiteDomain(db);

      const payload = await createWebsiteWidgetWordpressInstallHandoff({
        db,
        req: buildAuthedReq(),
      });

      assert.equal(payload.ready, true);
      assert.equal(payload.packageType, "wordpress");
      assert.equal(payload.targetDomain, "acme.example");
      assert.equal(payload.verifiedDomain, "acme.example");
      assert.equal(payload.productionReady, true);
      assert.equal(payload.testingOnly, false);
      assert.match(String(payload.packageText || ""), /"packageType": "wordpress"/);
      assert.equal(
        payload.wordpressConfig?.wordpressPlugin?.slug,
        "aihq-website-chat"
      );
      assert.equal(
        db.auditEntries.some(
          (entry) =>
            entry.action ===
            "settings.channel.webchat.install_handoff.wordpress_generated"
        ),
        true
      );
    }
  );
});

test("website widget WordPress handoff refuses to generate while production install is blocked", async () => {
  await withWebsiteHandoffEnv(
    {
      nodeEnv: "production",
      allowUnverifiedHandoffs: "0",
    },
    async () => {
      const db = new FakeWebsiteDomainVerificationDb();

      await assert.rejects(
        () =>
          createWebsiteWidgetWordpressInstallHandoff({
            db,
            req: buildAuthedReq(),
          }),
        (error) => {
          assert.equal(error?.status, 409);
          assert.equal(error?.reasonCode, "website_domain_verification_missing");
          return true;
        }
      );
    }
  );
});

test("website widget allows testing-only developer, GTM, and WordPress handoffs outside production while keeping the public snippet blocked", async () => {
  await withWebsiteHandoffEnv(
    {
      nodeEnv: "test",
      allowUnverifiedHandoffs: "0",
    },
    async () => {
      const db = new FakeWebsiteDomainVerificationDb();

      const statusPayload = await getWebsiteWidgetStatus({
        db,
        req: buildAuthedReq({
          role: "member",
        }),
      });

      assert.equal(statusPayload.install?.productionBlocked, true);
      assert.equal(statusPayload.install?.productionInstallReady, false);
      assert.equal(statusPayload.install?.embedSnippet, "");
      assert.equal(statusPayload.install?.unverifiedHandoffsAllowed, true);
      assert.equal(statusPayload.install?.developerHandoffReady, true);
      assert.equal(statusPayload.install?.gtmHandoffReady, true);
      assert.equal(statusPayload.install?.wordpressHandoffReady, true);
      assert.match(
        String(statusPayload.install?.handoffMessage || ""),
        /local\/dev\/test only/i
      );

      const developerPayload = await createWebsiteWidgetInstallHandoff({
        db,
        req: buildAuthedReq(),
      });
      const gtmPayload = await createWebsiteWidgetGtmInstallHandoff({
        db,
        req: buildAuthedReq(),
      });
      const wordpressPayload = await createWebsiteWidgetWordpressInstallHandoff({
        db,
        req: buildAuthedReq(),
      });

      assert.equal(developerPayload.ready, true);
      assert.equal(developerPayload.productionReady, false);
      assert.equal(developerPayload.testingOnly, true);
      assert.equal(developerPayload.verificationState, "unverified");
      assert.equal(developerPayload.verifiedDomain, "");
      assert.equal(developerPayload.targetDomain, "acme.example");
      assert.match(
        String(developerPayload.packageText || ""),
        /Target domain: acme\.example/
      );

      assert.equal(gtmPayload.ready, true);
      assert.equal(gtmPayload.packageType, "gtm");
      assert.equal(gtmPayload.productionReady, false);
      assert.equal(gtmPayload.testingOnly, true);
      assert.equal(gtmPayload.verificationState, "unverified");

      assert.equal(wordpressPayload.ready, true);
      assert.equal(wordpressPayload.packageType, "wordpress");
      assert.equal(wordpressPayload.productionReady, false);
      assert.equal(wordpressPayload.testingOnly, true);
      assert.equal(wordpressPayload.verificationState, "unverified");
      assert.equal(wordpressPayload.verifiedDomain, "");
      assert.equal(wordpressPayload.targetDomain, "acme.example");
      assert.equal(wordpressPayload.wordpressConfig?.targetDomain, "acme.example");
      assert.equal(wordpressPayload.wordpressConfig?.testingOnly, true);
      assert.equal(wordpressPayload.wordpressConfig?.productionReady, false);
      assert.equal(
        wordpressPayload.wordpressConfig?.verificationRequiredForProduction,
        true
      );
      assert.match(
        String(wordpressPayload.packageText || ""),
        /"testingOnly": true/
      );
    }
  );
});

test("website widget allows testing-only developer, GTM, and WordPress handoffs in production only when explicitly overridden", async () => {
  await withWebsiteHandoffEnv(
    {
      nodeEnv: "production",
      allowUnverifiedHandoffs: "1",
    },
    async () => {
      const db = new FakeWebsiteDomainVerificationDb();

      const statusPayload = await getWebsiteWidgetStatus({
        db,
        req: buildAuthedReq({
          role: "member",
        }),
      });

      assert.equal(statusPayload.install?.productionBlocked, true);
      assert.equal(statusPayload.install?.productionInstallReady, false);
      assert.equal(statusPayload.install?.embedSnippet, "");
      assert.equal(statusPayload.install?.unverifiedHandoffsAllowed, true);
      assert.equal(statusPayload.install?.developerHandoffReady, true);
      assert.equal(statusPayload.install?.gtmHandoffReady, true);
      assert.equal(statusPayload.install?.wordpressHandoffReady, true);

      const developerPayload = await createWebsiteWidgetInstallHandoff({
        db,
        req: buildAuthedReq(),
      });
      const gtmPayload = await createWebsiteWidgetGtmInstallHandoff({
        db,
        req: buildAuthedReq(),
      });
      const wordpressPayload = await createWebsiteWidgetWordpressInstallHandoff({
        db,
        req: buildAuthedReq(),
      });

      assert.equal(developerPayload.testingOnly, true);
      assert.equal(developerPayload.productionReady, false);
      assert.equal(developerPayload.verificationState, "unverified");

      assert.equal(gtmPayload.testingOnly, true);
      assert.equal(gtmPayload.productionReady, false);
      assert.equal(gtmPayload.verificationState, "unverified");

      assert.equal(wordpressPayload.testingOnly, true);
      assert.equal(wordpressPayload.productionReady, false);
      assert.equal(wordpressPayload.verificationState, "unverified");
      assert.equal(wordpressPayload.wordpressConfig?.testingOnly, true);
      assert.equal(wordpressPayload.wordpressConfig?.productionReady, false);
    }
  );
});
