import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

import { runSchemaMigrations } from "../src/db/runSchemaMigrations.js";
import {
  dbUpsertTenantChannel,
  dbUpsertTenantCore,
  dbUpsertTenantProfile,
} from "../src/db/helpers/settings.js";
import {
  checkWebsiteDomainVerification,
  createWebsiteDomainVerificationChallenge,
  createWebsiteWidgetInstallHandoff,
  getWebsiteWidgetStatus,
} from "../src/routes/api/channelConnect/website.js";
import { websiteWidgetRoutes } from "../src/routes/api/websiteWidget/index.js";

const { Pool } = pg;

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function hasRealDb() {
  return Boolean(s(process.env.DATABASE_URL));
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    finished: false,
    responseType: "",
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    type(value) {
      this.responseType = value;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
    send(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
  };
}

async function invokeRoute(router, method, path, req = {}) {
  const layer = router.stack.find(
    (item) => item.route?.path === path && item.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route not found for ${method.toUpperCase()} ${path}`);
  }

  const handlers = layer.route.stack.map((item) => item.handle);
  const res = createMockRes();
  const fullReq = {
    method: method.toUpperCase(),
    path,
    originalUrl: path,
    url: path,
    headers: {},
    query: {},
    body: {},
    params: {},
    protocol: "https",
    get(name) {
      return this.headers[String(name || "").toLowerCase()];
    },
    app: { locals: {} },
    ...req,
  };

  async function runAt(index) {
    if (index >= handlers.length || res.finished) return;

    const handler = handlers[index];

    if (handler.length >= 3) {
      await new Promise((resolve, reject) => {
        let settled = false;

        const next = (err) => {
          if (settled) return;
          settled = true;
          if (err) {
            reject(err);
            return;
          }
          resolve(runAt(index + 1));
        };

        Promise.resolve(handler(fullReq, res, next))
          .then(() => {
            if (!settled && res.finished) {
              settled = true;
              resolve();
            }
          })
          .catch(reject);
      });
      return;
    }

    await Promise.resolve(handler(fullReq, res));
    if (!res.finished) {
      await runAt(index + 1);
    }
  }

  await runAt(0);

  return { req: fullReq, res };
}

function createTransactionalRouteDb(client, prefix = "website_widget_lane") {
  let savepointIndex = 0;

  function emptyResult(command) {
    return {
      command,
      rowCount: 0,
      rows: [],
      fields: [],
    };
  }

  return {
    query(text, params) {
      return client.query(text, params);
    },
    async connect() {
      const savepoint = `${prefix}_${savepointIndex += 1}`;
      let transactionOpen = false;
      let finalized = false;

      return {
        async query(text, params) {
          const sql = s(typeof text === "string" ? text : text?.text);
          const normalized = sql.toUpperCase();

          if (normalized === "BEGIN" || normalized.startsWith("BEGIN ")) {
            if (!transactionOpen) {
              await client.query(`SAVEPOINT ${savepoint}`);
              transactionOpen = true;
            }
            return emptyResult("BEGIN");
          }

          if (normalized === "COMMIT" || normalized.startsWith("COMMIT ")) {
            if (transactionOpen && !finalized) {
              await client.query(`RELEASE SAVEPOINT ${savepoint}`);
              finalized = true;
            }
            return emptyResult("COMMIT");
          }

          if (normalized === "ROLLBACK" || normalized.startsWith("ROLLBACK ")) {
            if (transactionOpen && !finalized) {
              await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
              await client.query(`RELEASE SAVEPOINT ${savepoint}`);
              finalized = true;
            }
            return emptyResult("ROLLBACK");
          }

          return client.query(text, params);
        },
        release() {},
      };
    },
  };
}

let pool = null;
let migrationsReady = false;

test.before(async () => {
  if (!hasRealDb()) return;

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
    });
  }

  if (!migrationsReady) {
    await runSchemaMigrations(pool);
    migrationsReady = true;
  }
});

test.after(async () => {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
});

test(
  "db-backed website widget production lane verifies the domain, unlocks install handoff, and serves the public widget flow",
  { skip: !hasRealDb() ? "DATABASE_URL not configured for integration test" : false },
  async () => {
    const client = await pool.connect();
    const tenantKey = `web-${randomUUID().slice(0, 8)}`;
    const publicWidgetId = `ww_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const publicDomain = "acme-example.com";
    const publicOrigin = `https://www.${publicDomain}`;

    try {
      await client.query("begin");

      const tenant = await dbUpsertTenantCore(client, tenantKey, {
        company_name: "Acme Web Co",
        legal_name: "Acme Web Co LLC",
        industry_key: "software",
        country_code: "US",
        timezone: "America/New_York",
        default_language: "en",
        enabled_languages: ["en"],
      });

      assert.ok(tenant?.id, "tenant should be created");

      await dbUpsertTenantProfile(client, tenant.id, {
        brand_name: "Acme Web Co",
        website_url: publicOrigin,
      });

      await dbUpsertTenantChannel(client, tenant.id, "webchat", {
        provider: "website_widget",
        display_name: "Website chat",
        status: "connected",
        is_primary: true,
        config: {
          enabled: true,
          publicWidgetId,
          allowedOrigins: [publicOrigin],
          allowedDomains: [publicDomain],
          title: "Acme Web Chat",
          subtitle: "Ask a question.",
          accentColor: "#0f172a",
          initialPrompts: ["Pricing?", "Talk to sales"],
        },
      });

      const authReq = {
        auth: {
          tenantKey,
          role: "owner",
          email: "owner@acme-example.com",
        },
        headers: {
          host: "app.example.com",
          "x-forwarded-proto": "https",
        },
        protocol: "https",
        get(name) {
          return this.headers[String(name || "").toLowerCase()];
        },
      };

      const challengePayload = await createWebsiteDomainVerificationChallenge({
        db: client,
        req: {
          ...authReq,
          body: {
            domain: publicDomain,
          },
        },
      });

      assert.equal(s(challengePayload.state).toLowerCase(), "pending");
      assert.equal(s(challengePayload.domain), publicDomain);
      assert.ok(
        s(challengePayload.challenge?.name),
        "challenge TXT host should be present"
      );
      assert.ok(
        s(challengePayload.challenge?.value),
        "challenge TXT value should be present"
      );

      const verifiedPayload = await checkWebsiteDomainVerification({
        db: client,
        req: {
          ...authReq,
          body: {
            domain: publicDomain,
          },
        },
        resolveTxtFn: async () => [s(challengePayload.challenge?.value)],
      });

      assert.equal(s(verifiedPayload.state).toLowerCase(), "verified");
      assert.equal(s(verifiedPayload.domain), publicDomain);

      const statusPayload = await getWebsiteWidgetStatus({
        db: client,
        req: authReq,
      });

      assert.equal(s(statusPayload.state).toLowerCase(), "connected");
      assert.equal(s(statusPayload.widget?.publicWidgetId), publicWidgetId);
      assert.equal(statusPayload.install?.productionInstallReady, true);
      assert.equal(statusPayload.install?.productionBlocked, false);
      assert.equal(
        s(statusPayload.domainVerification?.state).toLowerCase(),
        "verified"
      );

      const handoffPayload = await createWebsiteWidgetInstallHandoff({
        db: client,
        req: {
          ...authReq,
          body: {
            domain: publicDomain,
          },
        },
      });

      assert.equal(handoffPayload.ready, true);
      assert.equal(s(handoffPayload.packageType), "developer");
      assert.equal(s(handoffPayload.targetDomain), publicDomain);
      assert.equal(handoffPayload.productionReady, true);
      assert.match(
        s(handoffPayload.packageText),
        /Website Chat developer install handoff/i
      );
      assert.match(s(handoffPayload.packageText), new RegExp(publicWidgetId));

      const routeDb = createTransactionalRouteDb(client);
      const router = websiteWidgetRoutes({
        db: routeDb,
        wsHub: null,
        getRuntime: async () => ({
          tenant: {
            id: tenant.id,
            tenant_key: tenantKey,
          },
          authority: {
            mode: "strict",
            required: true,
            available: true,
            stale: false,
            source: "approved_runtime_projection",
            runtimeProjectionId: "proj_test_widget",
          },
          truthVersionId: "truth_v_test_widget",
          serviceCatalog: [],
          knowledgeEntries: [],
          responsePlaybooks: [],
          aiPolicy: {},
          inboxPolicy: {},
          commentPolicy: {},
          threadState: null,
          businessContext: "Acme Web Co",
          tone: "professional",
          language: "en",
          raw: {
            projection: {
              projection_hash: "proj_hash_test_widget",
              truth_version_id: "truth_v_test_widget",
              metadata_json: {
                publishedTruthVersionId: "truth_v_test_widget",
              },
            },
          },
        }),
        buildActions: async () => ({
          actions: [],
          intent: "general_question",
          leadScore: 0,
          trace: {
            source: "website-widget-test",
          },
        }),
        persistLead: async () => [],
        applyHandoff: async () => [],
      });

      const installTokenCall = await invokeRoute(
        router,
        "post",
        "/public/widget/install-token",
        {
          headers: {
            origin: publicOrigin,
            referer: `${publicOrigin}/pricing`,
            host: "app.example.com",
            "x-forwarded-proto": "https",
          },
          protocol: "https",
          body: {
            widgetId: publicWidgetId,
            page: {
              url: `${publicOrigin}/pricing`,
              title: "Pricing",
              referrer: "https://www.google.com/search?q=acme",
            },
          },
        }
      );

      assert.equal(installTokenCall.res.statusCode, 200);
      assert.equal(installTokenCall.res.body?.ok, true);
      assert.equal(s(installTokenCall.res.body?.widgetId), publicWidgetId);
      assert.ok(
        s(installTokenCall.res.body?.bootstrapToken),
        "bootstrap token should be issued"
      );

      const bootstrapCall = await invokeRoute(
        router,
        "post",
        "/public/widget/bootstrap",
        {
          headers: {
            host: "app.example.com",
            "x-forwarded-proto": "https",
          },
          protocol: "https",
          body: {
            widgetId: publicWidgetId,
            bootstrapToken: installTokenCall.res.body.bootstrapToken,
          },
        }
      );

      assert.equal(bootstrapCall.res.statusCode, 200);
      assert.equal(bootstrapCall.res.body?.ok, true);
      assert.ok(
        s(bootstrapCall.res.body?.sessionToken),
        "session token should be issued"
      );
      assert.equal(
        s(bootstrapCall.res.body?.widget?.title),
        "Acme Web Chat"
      );
      assert.equal(
        s(bootstrapCall.res.body?.automation?.mode),
        "handoff_required"
      );

      const postMessageCall = await invokeRoute(
        router,
        "post",
        "/public/widget/message",
        {
          headers: {
            host: "app.example.com",
            "x-forwarded-proto": "https",
          },
          protocol: "https",
          body: {
            sessionToken: bootstrapCall.res.body.sessionToken,
            text: "Hello from the pricing page",
            messageId: "msg_public_test_1",
            visitor: {
              name: "Taylor",
              email: "taylor@acme-example.com",
            },
          },
        }
      );

      assert.equal(postMessageCall.res.statusCode, 200);
      if (postMessageCall.res.body?.ok !== true) {
        console.error(
          "website widget post message response",
          JSON.stringify(postMessageCall.res.body, null, 2)
        );
      }
      assert.equal(postMessageCall.res.body?.ok, true);
      assert.ok(postMessageCall.res.body?.thread?.id, "thread should exist");
      assert.equal(
        s(postMessageCall.res.body?.messages?.[0]?.text),
        "Hello from the pricing page"
      );
      assert.equal(
        s(postMessageCall.res.body?.messages?.[0]?.role),
        "visitor"
      );

      const transcriptCall = await invokeRoute(
        router,
        "post",
        "/public/widget/transcript",
        {
          headers: {
            host: "app.example.com",
            "x-forwarded-proto": "https",
          },
          protocol: "https",
          body: {
            sessionToken: postMessageCall.res.body.sessionToken,
          },
        }
      );

      assert.equal(transcriptCall.res.statusCode, 200);
      assert.equal(transcriptCall.res.body?.ok, true);
      assert.equal(
        s(transcriptCall.res.body?.thread?.id),
        s(postMessageCall.res.body?.thread?.id)
      );
      assert.equal(
        s(transcriptCall.res.body?.messages?.[0]?.text),
        "Hello from the pricing page"
      );
      assert.equal(
        s(transcriptCall.res.body?.messages?.[0]?.direction),
        "inbound"
      );
    } finally {
      await client.query("rollback").catch(() => {});
      client.release();
    }
  }
);
