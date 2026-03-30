import test from "node:test";
import assert from "node:assert/strict";

import {
  loadCurrentProjection,
  loadDbBrainData,
  loadLegacyTenant,
} from "../src/services/businessBrain/runtimeTenantData.js";
import { runOptionalDbStep } from "../src/services/businessBrain/runtimeTenantData/optionalSteps.js";
import { buildTenantRuntimeProjection } from "../src/db/helpers/tenantRuntimeProjection.js";
import { loadTenantCanonicalGraph } from "../src/db/helpers/tenantRuntimeProjection/graph.js";

function withConsoleSpy(methodName, fn) {
  const original = console[methodName];
  const calls = [];
  console[methodName] = (...args) => {
    calls.push(args);
  };

  return Promise.resolve()
    .then(() => fn(calls))
    .finally(() => {
      console[methodName] = original;
    });
}

test("loadCurrentProjection fails closed when freshness marks projection stale", async () => {
  const rows = buildProjectionRows();
  const db = createProjectionDb(rows);
  const graph = await loadTenantCanonicalGraph(
    { tenantId: rows.tenant.id, tenantKey: rows.tenant.tenant_key },
    db
  );
  const projection = buildTenantRuntimeProjection(graph);
  db.state.projectionRow = {
    ...projection,
    id: "projection-1",
    tenant_id: rows.tenant.id,
    tenant_key: rows.tenant.tenant_key,
    status: "ready",
    projection_hash: "stale-hash",
    source_snapshot_id: "snapshot-stale",
    source_profile_id: graph.publishedTruthVersion.business_profile_id,
    source_capabilities_id: graph.publishedTruthVersion.business_capabilities_id,
    metadata_json: {
      publishedTruthVersionId: graph.publishedTruthVersion.id,
    },
  };

  await assert.rejects(
    () =>
      loadCurrentProjection({
        db,
        tenantId: "tenant-1",
        tenantKey: "acme",
      }),
    (error) => {
      assert.equal(error?.code, "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE");
      assert.equal(error?.runtimeAuthority?.reasonCode, "runtime_projection_stale");
      assert.equal(error?.runtimeAuthority?.required, true);
      return true;
    }
  );
});

test("runOptionalDbStep rolls back to savepoint and falls back for optional failures", async () => {
  const sqlLog = [];
  const db = {
    release() {},
    async query(text) {
      sqlLog.push(String(text));
      return { rows: [] };
    },
  };

  const result = await withConsoleSpy("warn", async (warnCalls) => {
    return runOptionalDbStep(
      "optional-demo",
      { id: "tenant-1", tenant_key: "acme" },
      db,
      async () => {
        const error = new Error("optional relation missing");
        error.code = "42P01";
        throw error;
      },
      ["fallback"]
    ).then((value) => {
      assert.equal(warnCalls.length, 1);
      return value;
    });
  });

  assert.deepEqual(result, ["fallback"]);
  assert.equal(sqlLog[0].startsWith("SAVEPOINT runtime_optional_"), true);
  assert.equal(sqlLog[1].startsWith("ROLLBACK TO SAVEPOINT runtime_optional_"), true);
  assert.equal(sqlLog[2].startsWith("RELEASE SAVEPOINT runtime_optional_"), true);
});

test("loadLegacyTenant normalizes provided legacy-shaped tenant input without db access", async () => {
  const tenant = await loadLegacyTenant({
    tenant: {
      tenantKey: " Acme ",
      companyName: "Acme Clinic",
      defaultLanguage: "english",
      enabled_languages: ["EN", "az", "english"],
      industryKey: "clinic",
      profile: {
        tone_of_voice: "calm",
      },
      brand: {
        name: "Acme Clinic",
      },
      aiPolicy: {
        auto_reply_enabled: false,
      },
      inboxPolicy: {
        max_reply_sentences: 2,
      },
    },
  });

  assert.equal(tenant?.tenant_key, "Acme");
  assert.equal(tenant?.default_language, "en");
  assert.deepEqual(tenant?.supported_languages, ["en", "az"]);
  assert.equal(tenant?.company_name, "Acme Clinic");
  assert.equal(tenant?.brand?.displayName, "Acme Clinic");
  assert.equal(tenant?.ai_policy?.auto_reply_enabled, false);
  assert.equal(tenant?.inbox_policy?.max_reply_sentences, 2);
});

test("loadDbBrainData keeps core data loaders hard-fail", async () => {
  const db = {
    async query(text) {
      const sql = String(text || "").toLowerCase();

      if (sql.includes("from tenants")) {
        return {
          rows: [
            {
              id: "tenant-1",
              tenant_key: "acme",
            },
          ],
        };
      }

      if (sql.includes("from tenant_business_profile")) {
        throw Object.assign(new Error("profile read failed"), { code: "XX001" });
      }

      if (sql.includes("from tenant_business_capabilities")) {
        return { rows: [] };
      }

      if (sql.includes("from tenant_knowledge_items")) {
        return { rows: [] };
      }

      if (sql.includes("from tenant_business_facts")) {
        return { rows: [] };
      }

      if (sql.includes("from tenant_contacts")) {
        return { rows: [] };
      }

      if (sql.includes("from tenant_locations")) {
        return { rows: [] };
      }

      if (sql.includes("from tenant_channel_policies")) {
        return { rows: [] };
      }

      if (sql.includes("from tenant_services")) {
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  await withConsoleSpy("error", async (errorCalls) => {
    await assert.rejects(
      () =>
        loadDbBrainData({
          db,
          tenant: {
            id: "tenant-1",
            tenant_key: "acme",
          },
        }),
      /profile read failed/
    );

    assert.equal(errorCalls.length >= 1, true);
    assert.equal(
      String(errorCalls[0]?.[0] || "").includes("knowledge.getBusinessProfile failed"),
      true
    );
  });
});

function buildProjectionRows() {
  const tenant = {
    id: "tenant-1",
    tenant_key: "acme",
    company_name: "Acme Clinic",
    legal_name: "Acme Clinic LLC",
    industry_key: "clinic",
    default_language: "en",
    enabled_languages: ["en", "az"],
  };

  return {
    tenant,
    profile: {
      id: "profile-1",
      tenant_id: tenant.id,
      tenant_key: tenant.tenant_key,
      company_name: tenant.company_name,
      legal_name: tenant.legal_name,
      industry_key: tenant.industry_key,
      summary_short: "Premium clinic care",
      summary_long: "Same-day consultations and follow-up support.",
      tone_profile: "professional",
      value_proposition: "Fast, careful treatment",
      website_url: "https://acme.example",
      primary_email: "hello@acme.example",
      primary_phone: "+15550001111",
      main_language: "en",
      supported_languages: ["en", "az"],
      profile_json: {
        companyName: "Acme Clinic",
        displayName: "Acme Clinic",
        mainLanguage: "en",
        supportedLanguages: ["en", "az"],
        summaryShort: "Premium clinic care",
        summaryLong: "Same-day consultations and follow-up support.",
        toneProfile: "professional",
        targetAudience: "Families",
        valueProposition: "Fast, careful treatment",
        websiteUrl: "https://acme.example",
        primaryEmail: "hello@acme.example",
        primaryPhone: "+15550001111",
        industryKey: "clinic",
      },
    },
    capabilities: {
      id: "capabilities-1",
      tenant_id: tenant.id,
      tenant_key: tenant.tenant_key,
      primary_language: "en",
      supported_languages: ["en", "az"],
      reply_style: "professional",
      reply_length: "medium",
      cta_style: "soft",
      capabilities_json: {
        primaryLanguage: "en",
        supportedLanguages: ["en", "az"],
        replyStyle: "professional",
        replyLength: "medium",
        ctaStyle: "soft",
      },
    },
    synthesis: {
      id: "snapshot-1",
    },
    publishedTruthVersion: {
      id: "truth-v1",
      tenant_id: tenant.id,
      tenant_key: tenant.tenant_key,
      business_profile_id: "profile-1",
      business_capabilities_id: "capabilities-1",
      profile_snapshot_json: {
        companyName: "Acme Clinic",
        displayName: "Acme Clinic",
        mainLanguage: "en",
        supportedLanguages: ["en", "az"],
        summaryShort: "Premium clinic care",
        summaryLong: "Same-day consultations and follow-up support.",
        toneProfile: "professional",
        targetAudience: "Families",
        valueProposition: "Fast, careful treatment",
        websiteUrl: "https://acme.example",
        primaryEmail: "hello@acme.example",
        primaryPhone: "+15550001111",
        industryKey: "clinic",
      },
      capabilities_snapshot_json: {
        primaryLanguage: "en",
        supportedLanguages: ["en", "az"],
        replyStyle: "professional",
        replyLength: "medium",
        ctaStyle: "soft",
      },
    },
    contacts: [],
    services: [],
    knowledge: [],
    facts: [],
    channelPolicies: [],
  };
}

function createProjectionDb(rows) {
  const { tenant } = rows;
  const state = {
    projectionRow: null,
  };

  return {
    state,
    async query(text) {
      const sql = String(text || "").toLowerCase();

      if (sql.includes("from tenants t") && sql.includes("left join tenant_profiles")) {
        return {
          rows: [
            {
              id: tenant.id,
              tenant_key: tenant.tenant_key,
              company_name: tenant.company_name,
              legal_name: tenant.legal_name,
              industry_key: tenant.industry_key,
              country_code: "AZ",
              timezone: "Asia/Baku",
              default_language: tenant.default_language,
              enabled_languages: tenant.enabled_languages,
              market_region: "AZ",
              plan_key: "pro",
              status: "active",
              active: true,
              brand_name: "Acme Clinic",
              website_url: "https://acme.example",
              public_email: "hello@acme.example",
              public_phone: "+15550001111",
              audience_summary: "Families",
              services_summary: "Consultation",
              value_proposition: "Fast, careful treatment",
              brand_summary: "Premium clinic care",
              tone_of_voice: "professional",
              preferred_cta: "Book a visit",
              banned_phrases: [],
              communication_rules: {},
              visual_style: {},
              extra_context: {},
              auto_reply_enabled: true,
              create_lead_enabled: true,
              inbox_policy: {},
              comment_policy: {},
              content_policy: {},
              escalation_rules: {},
              risk_rules: {},
              lead_scoring_rules: {},
              publish_policy: {},
            },
          ],
        };
      }

      if (sql.includes("select id, tenant_key") && sql.includes("from tenants")) {
        return {
          rows: [
            {
              id: tenant.id,
              tenant_key: tenant.tenant_key,
            },
          ],
        };
      }

      if (sql.includes("from tenants") && sql.includes("order by created_at desc")) {
        return {
          rows: [
            {
              id: tenant.id,
              tenant_key: tenant.tenant_key,
              company_name: tenant.company_name,
              legal_name: tenant.legal_name,
              industry_key: tenant.industry_key,
              default_language: tenant.default_language,
              enabled_languages: tenant.enabled_languages,
            },
          ],
        };
      }

      if (sql.includes("from tenant_business_runtime_projection")) {
        return { rows: state.projectionRow ? [state.projectionRow] : [] };
      }

      if (sql.includes("from tenant_business_profile_versions")) {
        return { rows: [rows.publishedTruthVersion] };
      }

      if (sql.includes("from tenant_business_profile")) {
        return { rows: [rows.profile] };
      }

      if (sql.includes("from tenant_business_capabilities")) {
        return { rows: [rows.capabilities] };
      }

      if (sql.includes("from tenant_business_synthesis_snapshots")) {
        return { rows: [rows.synthesis] };
      }

      if (sql.includes("from tenant_contacts")) {
        return { rows: rows.contacts };
      }

      if (sql.includes("from tenant_services")) {
        return { rows: rows.services };
      }

      if (sql.includes("from tenant_knowledge_items")) {
        return { rows: rows.knowledge };
      }

      if (sql.includes("from tenant_business_facts")) {
        return { rows: rows.facts };
      }

      if (sql.includes("from tenant_channel_policies")) {
        return { rows: rows.channelPolicies };
      }

      return { rows: [] };
    },
  };
}
