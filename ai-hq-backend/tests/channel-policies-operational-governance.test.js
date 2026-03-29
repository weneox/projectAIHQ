import assert from "node:assert/strict";
import test from "node:test";

import { channelPoliciesSettingsRoutes } from "../src/routes/api/settings/channelPolicies.js";
import { buildTenantRuntimeProjection } from "../src/db/helpers/tenantRuntimeProjection/projection.js";
import { buildProjectionFirstRuntime } from "../src/services/businessBrain/runtimeAssembler.js";

function createMockRes(onFinish) {
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
      onFinish?.();
      return this;
    },
  };
}

async function invokeRouter(router, method, path, req = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ req: fullReq, res });
    };

    const normalizedHeaders = Object.fromEntries(
      Object.entries(req.headers || {}).map(([key, value]) => [String(key).toLowerCase(), value])
    );

    const fullReq = {
      method: String(method || "GET").toUpperCase(),
      path,
      originalUrl: path,
      url: path,
      headers: normalizedHeaders,
      query: req.query || {},
      body: req.body || {},
      params: req.params || {},
      protocol: "https",
      app: { locals: {} },
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      ...req,
    };

    const res = createMockRes(finish);
    router.handle(fullReq, res, (err) => {
      if (settled) return;
      if (err) {
        settled = true;
        reject(err);
        return;
      }
      settled = true;
      resolve({ req: fullReq, res });
    });
  });
}

function buildTenantAuth(role = "admin") {
  return {
    userId: "user-1",
    email: `${role}@acme.test`,
    tenantId: "tenant-1",
    tenantKey: "acme",
    role,
  };
}

function createRouteDbHarness() {
  const state = {
    policy: {
      id: "policy-1",
      tenant_id: "tenant-1",
      channel: "instagram",
      subchannel: "default",
      enabled: true,
      auto_reply_enabled: true,
      ai_reply_enabled: true,
      human_handoff_enabled: true,
      pricing_visibility: "public",
      public_reply_mode: "allowed",
      contact_capture_mode: "guided",
      escalation_mode: "manual",
      reply_style: "professional",
      max_reply_sentences: 2,
      rules: {},
      meta: {},
    },
    auditActions: [],
  };

  const db = {
    async query(text, params = []) {
      const sql = String(text || "").toLowerCase();

      if (sql.includes("from tenants") || sql.includes("from tenant_profiles")) {
        return {
          rows: [
            {
              id: "tenant-1",
              tenant_key: "acme",
              company_name: "Acme Clinic",
            },
          ],
        };
      }

      if (sql.includes("from tenant_channel_policies")) {
        return { rows: state.policy ? [state.policy] : [] };
      }

      if (sql.includes("insert into tenant_channel_policies")) {
        state.policy = {
          ...state.policy,
          id: state.policy?.id || "policy-1",
          tenant_id: "tenant-1",
          channel: params[1],
          subchannel: params[2],
          enabled: params[3],
          auto_reply_enabled: params[4],
          ai_reply_enabled: params[5],
          human_handoff_enabled: params[6],
          pricing_visibility: params[7],
          public_reply_mode: params[8],
          contact_capture_mode: params[9],
          escalation_mode: params[10],
          reply_style: params[11],
          max_reply_sentences: params[12],
          rules: JSON.parse(params[13] || "{}"),
          meta: JSON.parse(params[14] || "{}"),
        };
        return { rows: [state.policy] };
      }

      if (sql.includes("delete from tenant_channel_policies")) {
        const deleted = state.policy?.id === params[1];
        state.policy = deleted ? null : state.policy;
        return { rows: deleted ? [{ id: params[1] }] : [] };
      }

      if (sql.includes("insert into audit_log")) {
        state.auditActions.push({
          action: params[3],
          objectType: params[4],
          objectId: params[5],
        });
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  return { db, state };
}

function buildProjectionGraph() {
  return {
    tenant: {
      id: "tenant-1",
      tenant_key: "acme",
    },
    publishedTruthVersion: {
      id: "truth-version-1",
      profile_snapshot_json: {
        companyName: "Acme Clinic",
        displayName: "Acme Clinic",
        mainLanguage: "en",
        supportedLanguages: ["en"],
      },
      capabilities_snapshot_json: {
        replyStyle: "professional",
        replyLength: "medium",
        ctaStyle: "soft",
      },
    },
    profile: {
      id: "profile-1",
      tenant_key: "acme",
      company_name: "Acme Clinic",
      default_language: "en",
      enabled_languages: ["en"],
    },
    capabilities: {
      id: "capabilities-1",
      reply_style: "professional",
      reply_length: "medium",
      cta_style: "soft",
    },
    synthesis: {
      id: "snapshot-1",
      confidence_score: 0.92,
    },
    contacts: [],
    locations: [],
    hours: [],
    services: [],
    products: [],
    faq: [],
    policies: [],
    socialAccounts: [],
    channels: [],
    mediaAssets: [],
    knowledge: [],
    facts: [],
    publishedTruthFacts: [],
    operationalFacts: [],
    channelPolicies: [
      {
        channel: "instagram",
        subchannel: "default",
        pricingVisibility: "public",
        publicReplyMode: "allowed",
        contactCaptureMode: "guided",
        escalationMode: "manual",
        aiReplyEnabled: true,
        humanHandoffEnabled: true,
        replyStyle: "professional",
        maxReplySentences: 3,
      },
    ],
    operationalChannelPolicies: [
      {
        channel: "instagram",
        subchannel: "default",
        pricingVisibility: "public",
        publicReplyMode: "allowed",
        contactCaptureMode: "guided",
        escalationMode: "manual",
        aiReplyEnabled: true,
        humanHandoffEnabled: true,
        replyStyle: "professional",
        maxReplySentences: 3,
      },
    ],
  };
}

test("channel policy settings reads and writes are explicit operational config, not truth publication", async () => {
  const { db, state } = createRouteDbHarness();
  const router = channelPoliciesSettingsRoutes({ db });

  const readResult = await invokeRouter(router, "get", "/channel-policies", {
    auth: buildTenantAuth("admin"),
  });

  assert.equal(readResult.res.statusCode, 200);
  assert.equal(readResult.res.body.configSurface, "operational_runtime_config");
  assert.equal(readResult.res.body.publishGovernance, "not_applicable");
  assert.equal(readResult.res.body.truthPublicationRequired, false);
  assert.equal(readResult.res.body.publishedTruthChanged, false);
  assert.equal(readResult.res.body.policies[0].meta.configSurface, "operational_runtime_config");

  const writeResult = await invokeRouter(router, "post", "/channel-policies", {
    auth: buildTenantAuth("admin"),
    body: {
      channel: "instagram",
      pricing_visibility: "public",
      public_reply_mode: "allowed",
      contact_capture_mode: "guided",
      escalation_mode: "manual",
      reply_style: "professional",
      max_reply_sentences: 3,
    },
  });

  assert.equal(writeResult.res.statusCode, 200);
  assert.equal(writeResult.res.body.savedAsOperationalConfig, true);
  assert.equal(writeResult.res.body.truthVersionCreated, false);
  assert.equal(writeResult.res.body.publishedTruthChanged, false);
  assert.equal(writeResult.res.body.runtimeConsumption, "operational_config_projection_input");
  assert.equal(
    state.auditActions.some((entry) => entry.action === "settings.channel_policy.operational_config.updated"),
    true
  );
});

test("runtime projection keeps channel policies as operational config input instead of published truth", () => {
  const projection = buildTenantRuntimeProjection(buildProjectionGraph());

  assert.equal(projection.channel_policies_json.length, 1);
  assert.equal(
    projection.metadata_json.operationalConfig.channelPolicies.governanceModel,
    "operational_runtime_config"
  );
  assert.equal(
    projection.metadata_json.operationalConfig.channelPolicies.source,
    "tenant_channel_policies"
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(projection.metadata_json, "publishedTruthChannelPolicies"),
    false
  );
});

test("projection-first runtime still consumes channel policies correctly as operational config", () => {
  const projection = buildTenantRuntimeProjection(buildProjectionGraph());
  const runtime = buildProjectionFirstRuntime({
    legacyTenant: {
      id: "tenant-1",
      tenant_key: "acme",
      profile: {},
      inbox_policy: {},
      comment_policy: {},
    },
    input: {
      authorityMode: "strict",
    },
    projection,
    freshness: {
      stale: false,
      reasons: [],
    },
  });

  assert.equal(runtime.raw.operationalConfig.channelPolicies.governanceModel, "operational_runtime_config");
  assert.equal(runtime.raw.operationalChannelPolicies.length, 1);
  assert.equal(runtime.raw.channelPolicies[0].pricing_visibility, "public");
  assert.equal(runtime.tenant.inbox_policy.pricing_visibility, "public");
});
