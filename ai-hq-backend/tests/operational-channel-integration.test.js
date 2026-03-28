import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  validateProviderAccessResponse,
  validateVoiceOperationalResponse,
} from "@aihq/shared-contracts/operations";
import {
  validateSetupTruthPayload,
  validateSetupTruthPublicationSummary,
} from "@aihq/shared-contracts/setup";
import { validateProjectedRuntime } from "@aihq/shared-contracts/runtime";

import { cfg } from "../src/config.js";
import { runSchemaMigrations } from "../src/db/runSchemaMigrations.js";
import {
  dbUpsertTenantCore,
  dbUpsertTenantChannel,
  dbUpsertTenantProfile,
} from "../src/db/helpers/settings.js";
import { dbUpsertTenantSecret } from "../src/db/helpers/tenantSecrets.js";
import { upsertTenantVoiceSettings } from "../src/db/helpers/voice.js";
import { runOperationalDataBackfill } from "../src/db/helpers/operationalBackfill.js";
import { refreshTenantRuntimeProjectionStrict } from "../src/db/helpers/tenantRuntimeProjection/runtime.js";
import { processVoiceTenantConfig } from "../src/services/voiceInternalRuntime.js";
import { getTenantBrainRuntime } from "../src/services/businessBrain/getTenantBrainRuntime.js";
import { tenantInternalRoutes } from "../src/routes/api/tenants/internal.js";
import { __test__ as setupTest } from "../src/routes/api/workspace/setup.js";

const { Pool } = pg;

function s(v, d = "") {
  return String(v ?? d).trim();
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
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
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
    const relationCheck = await pool.query(
      "select to_regclass('tenant_execution_policy_controls') as regclass"
    );
    assert.equal(
      relationCheck.rows[0]?.regclass,
      "tenant_execution_policy_controls"
    );
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
  "db-backed finalize refresh exposes strict operational contracts for voice and provider access",
  { skip: !hasRealDb() ? "DATABASE_URL not configured for integration test" : false },
  async () => {
    const previousInternalToken = cfg.security.aihqInternalToken;
    const previousMasterKey = cfg.security.tenantSecretMasterKey;

    cfg.security.aihqInternalToken = "integration-internal-token";
    cfg.security.tenantSecretMasterKey =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const client = await pool.connect();
    const tenantKey = `ops-${randomUUID().slice(0, 8)}`;

    try {
      await client.query("begin");

      const tenant = await dbUpsertTenantCore(client, tenantKey, {
        company_name: "Operational Control Co",
        legal_name: "Operational Control Co LLC",
        industry_key: "consulting",
        country_code: "US",
        timezone: "America/New_York",
        default_language: "en",
        enabled_languages: ["en", "es"],
        market_region: "US",
      });

      assert.ok(tenant?.id, "tenant should be created");

      const projectionSummary = await setupTest.projectSetupReviewDraftToCanonical({
        db: client,
        actor: {
          tenantId: tenant.id,
          tenantKey,
          role: "admin",
          user: {
            id: "reviewer-1",
            name: "Reviewer One",
          },
        },
        session: {
          id: randomUUID(),
          primarySourceType: "website",
        },
        draft: {
          version: 1,
          businessProfile: {
            companyName: "Operational Control Co",
            description: "High-touch consulting for multi-channel operations.",
            websiteUrl: "https://ops.example.com",
            timezone: "America/New_York",
            languages: ["en", "es"],
            tone: "professional",
          },
          capabilities: {
            primaryLanguage: "en",
            supportedLanguages: ["en", "es"],
            toneProfile: "professional",
            autoReplyEnabled: true,
            humanApprovalRequired: false,
            inboxApprovalMode: "manual",
            commentApprovalMode: "manual",
          },
          services: [
            {
              key: "ops-consulting",
              title: "Ops Consulting",
              description: "Operational channel strategy and setup.",
            },
          ],
          knowledgeItems: [],
          sourceSummary: {
            primarySourceType: "website",
            primarySourceUrl: "https://ops.example.com",
          },
        },
        sources: [
          {
            sourceId: randomUUID(),
            sourceType: "website",
            role: "primary",
            sourceUrl: "https://ops.example.com",
          },
        ],
      });

      assert.ok(
        s(projectionSummary?.truthVersion?.id),
        "finalize should create a truth version"
      );
      assert.equal(
        validateSetupTruthPublicationSummary(projectionSummary).ok,
        true
      );

      const refreshed = await refreshTenantRuntimeProjectionStrict(
        {
          tenantId: tenant.id,
          tenantKey,
          triggerType: "review_approval",
          requestedBy: "integration-test",
        },
        client
      );

      assert.ok(s(refreshed?.projection?.id), "runtime projection should exist");
      assert.equal(refreshed?.freshness?.stale, false);

      const truthPayload = await setupTest.loadSetupTruthPayload(
        {
          db: client,
          actor: {
            tenantId: tenant.id,
            tenantKey,
            role: "admin",
            tenant: null,
          },
        },
        {
          async setupBuilder() {
            return {
              progress: {
                nextRoute: "/setup/truth",
              },
            };
          },
        }
      );

      assert.equal(validateSetupTruthPayload(truthPayload).ok, true);
      assert.equal(truthPayload?.truth?.readiness?.status, "ready");

      await upsertTenantVoiceSettings(client, tenant.id, {
        enabled: true,
        provider: "twilio",
        mode: "assistant",
        displayName: "Ops Voice",
        defaultLanguage: "en",
        supportedLanguages: ["en", "es"],
        instructions: "Route callers to the right operator and capture leads.",
        operatorEnabled: true,
        operatorPhone: "+15555550123",
        operatorLabel: "front desk",
        transferStrategy: "handoff",
        callbackEnabled: true,
        callbackMode: "lead_only",
        maxCallSeconds: 240,
        silenceHangupSeconds: 15,
        twilioPhoneNumber: "+15555550100",
        twilioPhoneSid: "PN1234567890",
        twilioConfig: {
          callerId: "+15555550100",
        },
        meta: {
          realtimeModel: "gpt-4o-realtime-preview",
          realtimeVoice: "alloy",
          operatorRouting: {
            mode: "handoff",
            defaultDepartment: "sales",
            departments: {
              sales: {
                enabled: true,
                label: "Sales",
                phone: "+15555550124",
              },
            },
          },
        },
      });

      await dbUpsertTenantChannel(client, tenant.id, "instagram", {
        provider: "meta",
        display_name: "Ops Instagram",
        external_page_id: "page-integration-1",
        external_user_id: "ig-integration-1",
        external_username: "opsco",
        status: "connected",
        is_primary: true,
        secrets_ref: "meta",
      });

      await dbUpsertTenantSecret(
        client,
        tenant.id,
        "meta",
        "page_access_token",
        "meta-page-token-integration",
        "integration-test"
      );
      await dbUpsertTenantSecret(
        client,
        tenant.id,
        "meta",
        "app_secret",
        "meta-app-secret-integration",
        "integration-test"
      );

      const runtime = await getTenantBrainRuntime({
        db: client,
        tenantId: tenant.id,
        tenantKey,
        authorityMode: "strict",
      });

      assert.equal(runtime?.authority?.available, true);
      assert.equal(runtime?.authority?.source, "approved_runtime_projection");
      assert.ok(s(runtime?.authority?.runtimeProjectionId));

      const voiceConfig = await processVoiceTenantConfig({
        db: client,
        tenantKey,
      });

      assert.equal(voiceConfig?.ok, true);
      assert.equal(
        validateVoiceOperationalResponse(voiceConfig?.payload || {}).ok,
        true
      );
      assert.equal(
        validateProjectedRuntime(voiceConfig?.payload?.projectedRuntime || {}).ok,
        true
      );
      assert.equal(
        voiceConfig?.payload?.operationalChannels?.voice?.source,
        "tenant_voice_settings"
      );
      assert.equal(
        voiceConfig?.payload?.operationalChannels?.voice?.operator?.phone,
        "+15555550123"
      );
      assert.equal(
        voiceConfig?.payload?.authority?.runtimeProjectionId,
        runtime.authority.runtimeProjectionId
      );

      const voiceConfigByNumber = await processVoiceTenantConfig({
        db: client,
        toNumber: "+1 (555) 555-0100",
      });

      assert.equal(voiceConfigByNumber?.ok, true);
      assert.equal(voiceConfigByNumber?.payload?.tenantKey, tenantKey);
      assert.equal(
        voiceConfigByNumber?.payload?.operationalChannels?.voice?.telephony?.phoneNumber,
        "+15555550100"
      );

      const router = tenantInternalRoutes({ db: client });
      const { res } = await invokeRoute(
        router,
        "get",
        "/internal/providers/meta-channel-access",
        {
          headers: {
            "x-internal-token": "integration-internal-token",
            "x-internal-service": "meta-bot-backend",
            "x-internal-audience": "aihq-backend.providers.meta-channel-access",
          },
          query: {
            channel: "instagram",
            pageId: "page-integration-1",
          },
        }
      );

      assert.equal(res.statusCode, 200);
      assert.equal(validateProviderAccessResponse(res.body || {}).ok, true);
      assert.equal(res.body?.providerAccess?.available, true);
      assert.equal(
        res.body?.providerAccess?.pageAccessToken,
        "meta-page-token-integration"
      );
      assert.equal(res.body?.operationalChannels?.meta?.source, "tenant_channels");
      assert.equal(res.body?.operationalChannels?.meta?.pageId, "page-integration-1");
      assert.equal(
        res.body?.projectedRuntime?.authority?.runtimeProjectionId,
        runtime.authority.runtimeProjectionId
      );
    } finally {
      await client.query("rollback").catch(() => {});
      client.release();
      cfg.security.aihqInternalToken = previousInternalToken;
      cfg.security.tenantSecretMasterKey = previousMasterKey;
    }
  }
);

test(
  "db-backed operational backfill populates persisted voice settings and channel identifiers",
  { skip: !hasRealDb() ? "DATABASE_URL not configured for integration test" : false },
  async () => {
    const client = await pool.connect();
    const tenantKey = `backfill-${randomUUID().slice(0, 8)}`;

    try {
      await client.query("begin");

      const tenant = await dbUpsertTenantCore(client, tenantKey, {
        company_name: "Backfill Ops Co",
        legal_name: "Backfill Ops Co LLC",
        industry_key: "consulting",
        country_code: "US",
        timezone: "America/New_York",
        default_language: "en",
        enabled_languages: ["en"],
      });

      await dbUpsertTenantProfile(client, tenant.id, {
        brand_name: "Backfill Ops Co",
        public_phone: "+15555550150",
        extra_context: {
          twilio_phone: "+15555550150",
          twilio_caller_id: "+15555550150",
          operator_phone: "+15555550151",
          operator: {
            phone: "+15555550151",
            label: "front desk",
            callerId: "+15555550150",
          },
          realtime: {
            model: "gpt-4o-realtime-preview",
            voice: "alloy",
            instructions: "Backfilled operational instructions",
          },
          operatorRouting: {
            mode: "handoff",
            defaultDepartment: "sales",
          },
        },
      });

      await dbUpsertTenantChannel(client, tenant.id, "instagram", {
        provider: "meta",
        display_name: "Backfill Instagram",
        status: "connected",
        is_primary: true,
        secrets_ref: "",
        config: {
          provider: "meta",
          pageId: "page-backfill-1",
          igUserId: "ig-backfill-1",
        },
      });

      const result = await runOperationalDataBackfill(client, {
        actor: "integration-test",
      });

      assert.equal(result.ok, true);
      assert.equal(result.insertedVoiceSettings >= 1, true);
      assert.equal(result.updatedChannels >= 1, true);

      const voiceSettingsQ = await client.query(
        `
          select
            twilio_phone_number,
            operator_phone,
            twilio_config,
            meta
          from tenant_voice_settings
          where tenant_id = $1
          limit 1
        `,
        [tenant.id]
      );

      assert.equal(voiceSettingsQ.rows[0]?.twilio_phone_number, "+15555550150");
      assert.equal(voiceSettingsQ.rows[0]?.operator_phone, "+15555550151");
      assert.equal(
        voiceSettingsQ.rows[0]?.twilio_config?.callerId,
        "+15555550150"
      );
      assert.equal(
        voiceSettingsQ.rows[0]?.meta?.realtimeModel,
        "gpt-4o-realtime-preview"
      );

      const channelQ = await client.query(
        `
          select
            external_page_id,
            external_user_id,
            secrets_ref
          from tenant_channels
          where tenant_id = $1
            and channel_type = 'instagram'
          limit 1
        `,
        [tenant.id]
      );

      assert.equal(channelQ.rows[0]?.external_page_id, "page-backfill-1");
      assert.equal(channelQ.rows[0]?.external_user_id, "ig-backfill-1");
      assert.equal(channelQ.rows[0]?.secrets_ref, "meta");
    } finally {
      await client.query("rollback").catch(() => {});
      client.release();
    }
  }
);
