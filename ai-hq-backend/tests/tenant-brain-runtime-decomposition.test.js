import test from "node:test";
import assert from "node:assert/strict";

import { buildTenantRuntimeProjection } from "../src/db/helpers/tenantRuntimeProjection.js";
import { loadTenantCanonicalGraph } from "../src/db/helpers/tenantRuntimeProjection/graph.js";
import {
  getTenantBrainRuntime,
  inspectTenantBrainRuntime,
} from "../src/services/businessBrain/getTenantBrainRuntime.js";

function createCaptureLogger(entries = [], context = {}) {
  return {
    child(extra = {}) {
      return createCaptureLogger(entries, { ...context, ...extra });
    },
    info(event, data = {}) {
      entries.push({ level: "info", event, ...context, ...data });
    },
    warn(event, data = {}) {
      entries.push({ level: "warn", event, ...context, ...data });
    },
    error(event, error = null, data = {}) {
      entries.push({
        level: "error",
        event,
        ...context,
        ...data,
        error: error?.message || String(error || ""),
      });
    },
  };
}

function buildProvidedTenant() {
  return {
    id: "tenant-1",
    tenant_key: "acme",
    company_name: "Acme Clinic",
    default_language: "en",
    enabled_languages: ["en", "az"],
    industry_key: "clinic",
    profile: {
      brand_name: "Acme Clinic",
      services_summary: "Consultation, Fillings",
      tone_of_voice: "calm and direct",
      preferred_cta: "Book a visit",
    },
    ai_policy: {
      auto_reply_enabled: false,
      create_lead_enabled: true,
    },
    inbox_policy: {
      max_reply_sentences: 3,
    },
    comment_policy: {},
  };
}

test("strict authority stays fail-closed when no runtime projection is available", async () => {
  await assert.rejects(
    () =>
      getTenantBrainRuntime({
        tenant: buildProvidedTenant(),
        authorityMode: "strict",
      }),
    (error) => {
      assert.equal(error?.code, "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE");
      assert.equal(error?.runtimeAuthority?.required, true);
      assert.equal(error?.runtimeAuthority?.reasonCode, "runtime_projection_missing");
      return true;
    }
  );
});

test("default runtime lookup is strict and fails closed without a projection", async () => {
  await assert.rejects(
    () =>
      getTenantBrainRuntime({
        tenant: buildProvidedTenant(),
      }),
    (error) => {
      assert.equal(error?.code, "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE");
      assert.equal(error?.runtimeAuthority?.required, true);
      assert.equal(error?.runtimeAuthority?.reasonCode, "runtime_projection_missing");
      return true;
    }
  );
});

test("strict authority failure emits reason-coded telemetry context", async () => {
  const entries = [];

  await assert.rejects(
    () =>
      getTenantBrainRuntime({
        tenant: buildProvidedTenant(),
        logger: createCaptureLogger(entries, {
          requestId: "req-runtime-1",
          correlationId: "corr-runtime-1",
        }),
      }),
    (error) => {
      assert.equal(error?.runtimeAuthority?.reasonCode, "runtime_projection_missing");
      return true;
    }
  );

  const blocked = entries.find((entry) => entry.event === "runtime.authority.blocked");
  assert.equal(blocked?.requestId, "req-runtime-1");
  assert.equal(blocked?.correlationId, "corr-runtime-1");
  assert.equal(blocked?.tenantKey, "acme");
  assert.equal(blocked?.reasonCode, "runtime_projection_missing");
});

test("inspection runtime preserves shaping for hydrated tenant input", async () => {
  const runtime = await inspectTenantBrainRuntime({
    tenant: buildProvidedTenant(),
  });

  assert.equal(runtime.authority.available, false);
  assert.equal(runtime.authority.reasonCode, "inspection_legacy_runtime_fallback");
  assert.deepEqual(runtime.languages, ["en", "az"]);
  assert.equal(runtime.defaultLanguage, "en");
  assert.equal(runtime.autoReplyEnabled, false);
  assert.equal(runtime.createLeadEnabled, true);
  assert.equal(runtime.companyName, "Acme Clinic");
  assert.deepEqual(runtime.services, ["Consultation", "Fillings"]);
  assert.equal(runtime.raw.mode, "inspection_fallback");
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
    contacts: [
      {
        id: "contact-1",
        contact_key: "main-phone",
        channel: "phone",
        label: "Main line",
        value: "+15550001111",
        is_primary: true,
        enabled: true,
        visible_public: true,
        visible_in_ai: true,
        sort_order: 0,
        meta: {},
      },
      {
        id: "contact-2",
        contact_key: "main-email",
        channel: "email",
        label: "Email",
        value: "hello@acme.example",
        is_primary: true,
        enabled: true,
        visible_public: true,
        visible_in_ai: true,
        sort_order: 1,
        meta: {},
      },
    ],
    services: [
      {
        id: "service-1",
        service_key: "consultation",
        title: "Consultation",
        description: "General consultation",
        category: "general",
        currency: "AZN",
        pricing_model: "custom_quote",
        duration_minutes: 30,
        is_active: true,
        sort_order: 0,
        highlights_json: [],
        metadata_json: {},
      },
    ],
    knowledge: [
      {
        id: "knowledge-1",
        item_key: "booking",
        category: "booking",
        question: "How do I book?",
        answer: "Send your preferred day and we will confirm.",
        language: "en",
        priority: 1,
        status: "approved",
        metadata_json: {},
      },
    ],
    facts: [
      {
        id: "fact-1",
        category: "cta",
        fact_key: "contact_cta",
        value_text: "Call or message us to get started.",
        priority: 1,
        enabled: true,
        metadata_json: {},
      },
    ],
    channelPolicies: [
      {
        id: "policy-1",
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
    ],
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

test("projection-first runtime stays authoritative and preserves output shaping", async () => {
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
    source_snapshot_id: graph.synthesis.id,
    source_profile_id: graph.publishedTruthVersion.business_profile_id,
    source_capabilities_id: graph.publishedTruthVersion.business_capabilities_id,
    metadata_json: {
      publishedTruthVersionId: graph.publishedTruthVersion.id,
    },
  };

  const runtime = await getTenantBrainRuntime({
    db,
    tenantId: rows.tenant.id,
    tenantKey: rows.tenant.tenant_key,
    authorityMode: "strict",
  });

  assert.equal(runtime.authority.available, true);
  assert.equal(runtime.authority.source, "approved_runtime_projection");
  assert.equal(runtime.authority.runtimeProjectionId, "projection-1");
  assert.equal(runtime.raw.mode, "projection_first");
  assert.equal(runtime.companyName, "Acme Clinic");
  assert.deepEqual(runtime.languages, ["en", "az"]);
  assert.deepEqual(runtime.services, ["Consultation"]);
  assert.equal(runtime.preferredCta, "soft");
  assert.equal(runtime.businessType, "clinic");
  assert.equal(runtime.niche, "clinic");
  assert.equal(runtime.conversionGoal, "capture_qualified_lead");
  assert.equal(runtime.primaryCta, "contact_us");
  assert.equal(runtime.leadQualificationMode, "service_booking_triage");
  assert.equal(runtime.bookingFlowType, "manual");
  assert.equal(Array.isArray(runtime.qualificationQuestions), true);
  assert.equal(runtime.qualificationQuestions.length > 0, true);
  assert.equal(Array.isArray(runtime.handoffTriggers), true);
  assert.equal(Array.isArray(runtime.disallowedClaims), true);
  assert.equal(
    runtime.behavior?.channelBehavior?.voice?.primaryAction,
    "route_or_capture_callback"
  );
  assert.equal(runtime.raw.projection.id, "projection-1");
});
