import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import {
  getTenantBrainRuntime,
  __test__ as runtimeAuthorityTest,
  buildRuntimeAuthorityFailurePayload,
} from "../src/services/businessBrain/getTenantBrainRuntime.js";
import { buildProjectedTenantRuntime } from "../src/services/projectedTenantRuntime.js";
import { buildVoiceConfigFromProjectedRuntime } from "../src/routes/api/voice/config.js";
import { processVoiceTenantConfig } from "../src/services/voiceInternalRuntime.js";
import { ingestCommentHandler } from "../src/routes/api/comments/handlers.js";
import { inboxInternalRoutes } from "../src/routes/api/inbox/internal.js";
import {
  getTenantByKey as getInboxTenantByKey,
  getTenantInboxBrainContext,
} from "../src/routes/api/inbox/repository.js";
import { getTenantByKey as getCommentTenantByKey } from "../src/routes/api/comments/repository.js";
import { buildOperationalChannels } from "../src/services/operationalChannels.js";
import {
  getCurrentTenantRuntimeProjection,
  buildTenantRuntimeProjection,
  refreshTenantRuntimeProjectionStrict,
} from "../src/db/helpers/tenantRuntimeProjection.js";
import { loadTenantCanonicalGraph } from "../src/db/helpers/tenantRuntimeProjection/graph.js";

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    finished: false,
    setHeader(key, value) {
      this.headers[String(key).toLowerCase()] = value;
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
    type(value) {
      this.headers["content-type"] = value;
      return this;
    },
    send(payload) {
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
      Object.entries(req.headers || {}).map(([key, value]) => [
        String(key).toLowerCase(),
        value,
      ])
    );

    const fullReq = {
      method: String(method || "GET").toUpperCase(),
      path,
      originalUrl: path,
      url: path,
      headers: normalizedHeaders,
      query: req.query || {},
      body: req.body || {},
      protocol: "https",
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      header(name) {
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

function buildApprovedRuntimePack(overrides = {}) {
  const tenant = {
    id: "tenant-1",
    tenant_key: "acme",
    company_name: "Acme Clinic",
    timezone: "Asia/Baku",
    default_language: "en",
    supported_languages: ["en", "az"],
    enabled_languages: ["en", "az"],
    profile: {
      brand_name: "Acme Clinic",
      tone_of_voice: "professional",
      preferred_cta: "Book a visit",
    },
    ai_policy: {},
    inbox_policy: {},
    comment_policy: {},
  };

  return {
    authority: {
      mode: "strict",
      required: true,
      available: true,
      source: "approved_runtime_projection",
      tenantId: "tenant-1",
      tenantKey: "acme",
      runtimeProjectionId: "projection-1",
      projectionHash: "hash-1",
    },
    tenant,
    services: ["Consultation"],
    serviceCatalog: [
      {
        id: "service-1",
        service_key: "consultation",
        title: "Consultation",
        name: "Consultation",
        enabled: true,
        visible_in_ai: true,
        visibleInAi: true,
        keywords: ["consultation"],
      },
    ],
    knowledgeEntries: [
      {
        id: "knowledge-1",
        title: "Booking",
        question: "How do I book?",
        answer: "Send your preferred day and we will confirm.",
      },
    ],
    responsePlaybooks: [],
    aiPolicy: {
      autoReplyEnabled: true,
      createLeadEnabled: true,
      handoffEnabled: true,
      markSeenEnabled: true,
      typingIndicatorEnabled: false,
      suppressAiDuringHandoff: true,
    },
    inboxPolicy: {},
    commentPolicy: {},
    language: "en",
    tone: "professional",
    preferredCta: "Book a visit",
    raw: {
      projection: {
        id: "projection-1",
        projection_hash: "hash-1",
      },
    },
    ...overrides,
    tenant: {
      ...tenant,
      ...(overrides?.tenant || {}),
    },
  };
}

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
    channels: [
      {
        id: "channel-1",
        channel_type: "instagram",
        display_name: "Instagram",
        endpoint: "instagram",
        is_active: true,
        is_primary: true,
        config_json: {},
        metadata_json: {},
      },
    ],
    responsePlaybooks: [
      {
        id: "playbook-1",
        tenant_id: tenant.id,
        intent_key: "general",
        service_key: "",
        language: "en",
        user_example: "Tell me more",
        ideal_reply: "Happy to help.",
        reply_style: "professional",
        cta_type: "reply",
        priority: 1,
        enabled: true,
        meta: {
          name: "General reply",
          replyTemplate: "Happy to help.",
        },
      },
    ],
  };
}

function createProjectionDb(rows) {
  const { tenant } = rows;
  const state = {
    projectionRow: null,
    projectionRunRow: null,
    legacyTenantQueryCount: 0,
  };

  return {
    state,
    async query(text, values = []) {
      const sql = String(text || "").toLowerCase();

      if (sql.includes("from tenants t") && sql.includes("left join tenant_profiles")) {
        state.legacyTenantQueryCount += 1;
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

      if (sql.includes("insert into tenant_business_runtime_projection")) {
        state.projectionRow = {
          id: "projection-1",
          tenant_id: rows.tenant.id,
          tenant_key: rows.tenant.tenant_key,
          status: values[2] || "ready",
          source_snapshot_id: values[3] || rows.synthesis.id,
          source_profile_id: values[4] || rows.profile.id,
          source_capabilities_id: values[5] || rows.capabilities.id,
          projection_hash: values[6] || "hash-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          identity_json: JSON.parse(values[7] || "{}"),
          profile_json: JSON.parse(values[8] || "{}"),
          capabilities_json: JSON.parse(values[9] || "{}"),
          contacts_json: JSON.parse(values[10] || "[]"),
          locations_json: JSON.parse(values[11] || "[]"),
          hours_json: JSON.parse(values[12] || "[]"),
          services_json: JSON.parse(values[13] || "[]"),
          products_json: JSON.parse(values[14] || "[]"),
          faq_json: JSON.parse(values[15] || "[]"),
          policies_json: JSON.parse(values[16] || "[]"),
          social_accounts_json: JSON.parse(values[17] || "[]"),
          channels_json: JSON.parse(values[18] || "[]"),
          media_assets_json: JSON.parse(values[19] || "[]"),
          approved_knowledge_json: JSON.parse(values[20] || "[]"),
          active_facts_json: JSON.parse(values[21] || "[]"),
          channel_policies_json: JSON.parse(values[22] || "[]"),
          inbox_json: JSON.parse(values[23] || "{}"),
          comments_json: JSON.parse(values[24] || "{}"),
          content_json: JSON.parse(values[25] || "{}"),
          voice_json: JSON.parse(values[26] || "{}"),
          lead_capture_json: JSON.parse(values[27] || "{}"),
          handoff_json: JSON.parse(values[28] || "{}"),
          retrieval_corpus_json: JSON.parse(values[29] || "[]"),
          runtime_context_text: values[30] || "",
          readiness_score: values[31] || 1,
          readiness_label: values[32] || "ready",
          confidence: values[33] || 1,
          confidence_label: values[34] || "high",
        };
        return { rows: [state.projectionRow] };
      }

      if (sql.includes("from tenant_business_runtime_projection")) {

        if (sql.includes("from tenant_business_runtime_projection_runs")) {
          return { rows: state.projectionRunRow ? [state.projectionRunRow] : [] };
        }

        return { rows: state.projectionRow ? [state.projectionRow] : [] };
      }

      if (sql.includes("insert into tenant_business_runtime_projection_runs")) {
        state.projectionRunRow = {
          id: "projection-run-1",
          tenant_id: rows.tenant.id,
          tenant_key: rows.tenant.tenant_key,
          status: "running",
          started_at: new Date().toISOString(),
        };
        return { rows: [{ id: "projection-run-1" }] };
      }

      if (sql.includes("update tenant_business_runtime_projection_runs")) {
        state.projectionRunRow = {
          ...(state.projectionRunRow || {}),
          status: sql.includes("status = 'success'") ? "success" : "failed",
          runtime_projection_id: state.projectionRow?.id || "",
          finished_at: new Date().toISOString(),
        };
        return { rows: [] };
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

      if (sql.includes("from tenant_business_channels")) {
        return { rows: rows.channels };
      }

      if (sql.includes("from tenant_response_playbooks")) {
        return { rows: rows.responsePlaybooks };
      }

      return { rows: [] };
    },
  };
}

test("strict runtime authority metadata is authoritative only for approved runtime projection", () => {
  const authority = runtimeAuthorityTest.buildRuntimeAuthority({
    mode: "strict",
    available: true,
    tenantId: "tenant-1",
    tenantKey: "acme",
    runtimeProjection: {
      id: "projection-1",
      status: "ready",
      projection_hash: "hash-1",
    },
    freshness: {
      stale: false,
      reasons: [],
    },
  });

  assert.equal(authority.required, true);
  assert.equal(authority.available, true);
  assert.equal(authority.source, "approved_runtime_projection");
  assert.equal(authority.runtimeProjectionId, "projection-1");
  assert.equal(authority.projectionHash, "hash-1");
  assert.deepEqual(authority.freshnessReasons, []);
});

test("projected runtime unifies voice and tenant profile from approved projection", () => {
  const operationalChannels = {
    voice: {
      available: true,
      ready: true,
      reasonCode: "",
      provider: "twilio",
      operator: {
        phone: "+15550002222",
        callerId: "+15550003333",
      },
      operatorRouting: {
        mode: "manual",
        departments: {},
      },
      realtime: {
        model: "gpt-4o-realtime-preview",
        voice: "alloy",
      },
      telephony: {
        phoneNumber: "+15550001111",
      },
      callback: {},
      transfer: {},
      limits: {},
      source: "tenant_voice_settings",
      updatedAt: "2026-03-26T00:00:00.000Z",
      contractHash: "hash-op-1",
    },
    meta: {
      available: false,
      ready: false,
      reasonCode: "channel_not_connected",
      provider: "meta",
      channelType: "",
      pageId: "",
      igUserId: "",
    },
  };

  const projectedRuntime = buildProjectedTenantRuntime({
    runtime: {
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
        runtimeProjectionId: "projection-1",
      },
      raw: {
        projection: {
          projection_hash: "hash-1",
          readiness_label: "ready",
          confidence_label: "high",
          identity_json: {
            tenantId: "tenant-1",
            tenantKey: "acme",
            companyName: "Acme Clinic",
            displayName: "Acme Clinic",
            industryKey: "beauty",
            websiteUrl: "https://acme.example",
            mainLanguage: "en",
            supportedLanguages: ["en", "az"],
          },
          profile_json: {
            summaryShort: "Premium care",
            toneProfile: "professional",
          },
          contacts_json: [
            {
              channel: "phone",
              isPrimary: true,
              value: "+15550001111",
            },
            {
              channel: "email",
              isPrimary: true,
              value: "hello@acme.example",
            },
          ],
          services_json: [
            {
              serviceKey: "consultation",
              title: "Consultation",
              description: "Book a consultation",
            },
          ],
          inbox_json: {
            enabled: true,
          },
          comments_json: {
            enabled: true,
          },
          voice_json: {
            enabled: true,
            supportsCalls: true,
            primaryPhone: "+15550001111",
            canOfferCallback: true,
          },
          lead_capture_json: {
            enabled: true,
            contactCaptureMode: "guided",
          },
          handoff_json: {
            enabled: true,
            escalationMode: "manual",
          },
          channels_json: [
            {
              channelType: "instagram",
              label: "IG",
              endpoint: "instagram",
            },
          ],
        },
      },
    },
    operationalChannels,
  });

  const voiceConfig = buildVoiceConfigFromProjectedRuntime(projectedRuntime, {
    tenantKey: "acme",
    toNumber: "+15550001111",
  });

  assert.equal(projectedRuntime.tenant.companyName, "Acme Clinic");
  assert.equal(projectedRuntime.channels.voice.primaryPhone, "+15550001111");
  assert.equal(voiceConfig.authority.runtimeProjectionId, "projection-1");
  assert.equal(voiceConfig.voiceProfile.businessSummary, "Premium care");
  assert.equal(voiceConfig.operator.phone, "+15550002222");
});

test("voice tenant config consumes unified projected runtime from strict authority", async () => {
  const db = {
    async query(text) {
      const sql = String(text || "").toLowerCase();
      if (sql.includes("from tenants") && sql.includes("where lower(tenant_key)")) {
        return {
          rows: [
            {
              id: "tenant-1",
              tenant_key: "acme",
              company_name: "Acme Clinic",
              default_language: "en",
              meta: {
                operator: {
                  phone: "+15550002222",
                  callerId: "+15550003333",
                },
                realtime: {
                  model: "gpt-4o-realtime-preview",
                  voice: "alloy",
                },
              },
            },
          ],
        };
      }
      if (sql.includes("from tenant_voice_settings")) {
        return {
          rows: [
            {
              tenant_id: "tenant-1",
              enabled: true,
              provider: "twilio",
              mode: "assistant",
              display_name: "Acme Voice",
              default_language: "en",
              supported_languages: ["en"],
              instructions: "Route calls cleanly.",
              operator_enabled: true,
              operator_phone: "+15550002222",
              operator_label: "operator",
              transfer_strategy: "handoff",
              callback_enabled: true,
              callback_mode: "lead_only",
              max_call_seconds: 180,
              silence_hangup_seconds: 12,
              twilio_phone_number: "+15550001111",
              twilio_phone_sid: "PN123",
              twilio_config: {
                callerId: "+15550003333",
              },
              meta: {
                realtimeModel: "gpt-4o-realtime-preview",
                realtimeVoice: "alloy",
              },
              created_at: "2026-03-26T00:00:00.000Z",
              updated_at: "2026-03-26T00:00:00.000Z",
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const result = await processVoiceTenantConfig({
    db,
    tenantKey: "acme",
    getRuntime: async () => ({
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
        runtimeProjectionId: "projection-1",
      },
      raw: {
        projection: {
          projection_hash: "hash-1",
          identity_json: {
            tenantId: "tenant-1",
            tenantKey: "acme",
            companyName: "Acme Clinic",
            displayName: "Acme Clinic",
            mainLanguage: "en",
            supportedLanguages: ["en"],
          },
          profile_json: {
            summaryShort: "Premium care",
          },
          contacts_json: [
            {
              channel: "phone",
              isPrimary: true,
              value: "+15550001111",
            },
          ],
          services_json: [],
          voice_json: {
            enabled: true,
            supportsCalls: true,
            primaryPhone: "+15550001111",
          },
          lead_capture_json: {
            enabled: false,
          },
          handoff_json: {
            enabled: true,
            escalationMode: "manual",
          },
          inbox_json: {},
          comments_json: {},
          channels_json: [],
        },
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload?.authority?.runtimeProjectionId, "projection-1");
  assert.equal(result.payload?.projectedRuntime?.tenant?.tenantKey, "acme");
  assert.equal(result.payload?.operator?.phone, "+15550002222");
});

test("operational channels fail closed when tenant voice settings are missing", async () => {
  const built = await buildOperationalChannels({
    db: {
      query: async () => ({ rows: [] }),
    },
    tenantId: "tenant-1",
    tenantRow: {
      id: "tenant-1",
      company_name: "Acme",
      default_language: "en",
    },
  });

  assert.equal(built.voice.available, false);
  assert.equal(built.voice.ready, false);
  assert.equal(built.voice.reasonCode, "voice_settings_missing");
});

test("voice tenant config fails closed when tenant voice settings are missing", async () => {
  const db = {
    async query(text) {
      const sql = String(text || "").toLowerCase();
      if (sql.includes("from tenants") && sql.includes("where lower(tenant_key)")) {
        return {
          rows: [
            {
              id: "tenant-1",
              tenant_key: "acme",
              company_name: "Acme Clinic",
              default_language: "en",
              meta: {},
            },
          ],
        };
      }
      if (sql.includes("from tenant_voice_settings")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const result = await processVoiceTenantConfig({
    db,
    tenantKey: "acme",
    getRuntime: async () => ({
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
        runtimeProjectionId: "projection-1",
      },
      raw: {
        projection: {
          identity_json: {
            tenantId: "tenant-1",
            tenantKey: "acme",
            companyName: "Acme Clinic",
            mainLanguage: "en",
          },
          profile_json: {},
          contacts_json: [],
          services_json: [],
          voice_json: {
            enabled: true,
            supportsCalls: true,
          },
          lead_capture_json: {},
          handoff_json: {},
          inbox_json: {},
          comments_json: {},
          channels_json: [],
        },
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "voice_operational_unavailable");
  assert.equal(result.details?.reasonCode, "voice_settings_missing");
});

test("strict runtime authority failures return structured fail-closed payloads", () => {
  const error = runtimeAuthorityTest.createRuntimeAuthorityError({
    mode: "strict",
    tenantKey: "acme",
    reasonCode: "runtime_projection_missing",
    reason: "runtime_projection_missing",
    message: "No fresh runtime projection exists.",
  });

  const payload = buildRuntimeAuthorityFailurePayload(error, {
    service: "comments.ingest",
    tenantKey: "acme",
  });

  assert.equal(payload.ok, false);
  assert.equal(payload.error, "runtime_authority_unavailable");
  assert.equal(payload.details.code, "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE");
  assert.equal(payload.details.authority.required, true);
  assert.equal(payload.details.authority.reasonCode, "runtime_projection_missing");
});

test("comments ingest fails closed when strict runtime authority is unavailable", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const handler = ingestCommentHandler({
      db: {
        query: async () => ({ rows: [] }),
      },
      wsHub: null,
      getRuntime: async () => {
        throw runtimeAuthorityTest.createRuntimeAuthorityError({
          mode: "strict",
          tenantKey: "acme",
          reasonCode: "runtime_projection_missing",
          reason: "runtime_projection_missing",
        });
      },
    });

    const req = {
      headers: {
        "x-internal-token": "internal-secret",
        "x-tenant-key": "acme",
      },
      body: {
        externalCommentId: "comment-1",
        text: "hello",
        channel: "instagram",
      },
      query: {},
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, false);
    assert.equal(res.body?.error, "runtime_authority_unavailable");
    assert.equal(res.body?.details?.service, "comments.ingest");
    assert.equal(
      res.body?.details?.authority?.reasonCode,
      "runtime_projection_missing"
    );
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("comments ingest succeeds when approved projected runtime is available", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const db = {
      async query(text) {
        const sql = String(text || "").toLowerCase();

        if (sql.includes("from comments") && sql.includes("external_comment_id")) {
          return { rows: [] };
        }

        if (sql.includes("insert into comments")) {
          return {
            rows: [
              {
                id: "comment-1",
                tenant_key: "acme",
                channel: "instagram",
                source: "meta",
                external_comment_id: "comment-1",
                external_parent_comment_id: null,
                external_post_id: "post-1",
                external_user_id: "user-1",
                external_username: "customer-one",
                customer_name: "Customer One",
                text: "thanks",
                classification: {
                  category: "normal",
                  priority: "low",
                  sentiment: "positive",
                  requiresHuman: false,
                  shouldCreateLead: false,
                  shouldReply: false,
                  shouldPrivateReply: false,
                  shouldHandoff: false,
                  reason: "gratitude",
                },
                raw: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          };
        }

        return { rows: [] };
      },
    };

    const handler = ingestCommentHandler({
      db,
      wsHub: null,
      getRuntime: async () => buildApprovedRuntimePack(),
    });

    const req = {
      headers: {
        "x-internal-token": "internal-secret",
        "x-tenant-key": "acme",
      },
      body: {
        externalCommentId: "comment-1",
        externalPostId: "post-1",
        externalUserId: "user-1",
        externalUsername: "customer-one",
        customerName: "Customer One",
        text: "thanks",
        channel: "instagram",
      },
      query: {},
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.duplicate, false);
    assert.equal(res.body?.error, undefined);
    assert.equal(res.body?.tenant?.tenant_key, "acme");
    assert.equal(res.body?.comment?.external_comment_id, "comment-1");
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("inbox ingest fails closed when strict runtime authority is unavailable", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const mockThread = {
      id: "11111111-1111-4111-8111-111111111111",
      tenant_id: "22222222-2222-4222-8222-222222222222",
      tenant_key: "acme",
      channel: "instagram",
      external_thread_id: "ext-thread-1",
      external_user_id: "ext-user-1",
      external_username: "user1",
      customer_name: "Customer One",
      status: "open",
      last_message_at: new Date().toISOString(),
      last_inbound_at: new Date().toISOString(),
      last_outbound_at: null,
      unread_count: 1,
      assigned_to: null,
      labels: [],
      meta: {},
      handoff_active: false,
      handoff_reason: "",
      handoff_priority: "normal",
      handoff_at: null,
      handoff_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockClient = {
      async query(text) {
        const sql = String(text || "").toLowerCase();

        if (
          sql.includes("current_database()") ||
          sql === "begin" ||
          sql === "rollback" ||
          sql === "commit"
        ) {
          return { rows: [{}] };
        }

        if (sql.includes("from tenants")) {
          return {
            rows: [
              {
                id: "22222222-2222-4222-8222-222222222222",
                tenant_key: "acme",
                company_name: "Acme",
                timezone: "Asia/Baku",
                inbox_policy: {},
              },
            ],
          };
        }

        if (sql.includes("from inbox_threads") && sql.includes("select")) {
          return { rows: [] };
        }

        if (sql.includes("insert into inbox_threads")) {
          return { rows: [mockThread] };
        }

        if (sql.includes("insert into inbox_messages")) {
          return {
            rows: [
              {
                id: "33333333-3333-4333-8333-333333333333",
                thread_id: mockThread.id,
                tenant_key: "acme",
                direction: "inbound",
                sender_type: "customer",
                external_message_id: null,
                message_type: "text",
                text: "hello",
                attachments: [],
                meta: {},
                sent_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
            ],
          };
        }

        if (sql.includes("from inbox_messages")) {
          return { rows: [] };
        }

        return { rows: [] };
      },
      release() {},
    };

    const router = inboxInternalRoutes({
      db: {
        query: async () => ({ rows: [] }),
        connect: async () => mockClient,
      },
      wsHub: null,
      getRuntime: async () => {
        throw runtimeAuthorityTest.createRuntimeAuthorityError({
          mode: "strict",
          tenantKey: "acme",
          reasonCode: "runtime_projection_missing",
          reason: "runtime_projection_missing",
        });
      },
    });

    const { res } = await invokeRouter(router, "post", "/inbox/ingest", {
      headers: {
        "x-internal-token": "internal-secret",
        "x-tenant-key": "acme",
      },
      body: {
        externalThreadId: "ext-thread-1",
        externalUserId: "ext-user-1",
        text: "hello",
        channel: "instagram",
        timestamp: Date.now(),
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, false);
    assert.equal(res.body?.error, "runtime_authority_unavailable");
    assert.equal(res.body?.details?.service, "inbox.ingest");
    assert.equal(
      res.body?.details?.authority?.reasonCode,
      "runtime_projection_missing"
    );
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("inbox ingest succeeds when approved projected runtime is available", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const mockThread = {
      id: "11111111-1111-4111-8111-111111111111",
      tenant_id: "22222222-2222-4222-8222-222222222222",
      tenant_key: "acme",
      channel: "instagram",
      external_thread_id: "ext-thread-1",
      external_user_id: "ext-user-1",
      external_username: "user1",
      customer_name: "Customer One",
      status: "open",
      last_message_at: new Date().toISOString(),
      last_inbound_at: new Date().toISOString(),
      last_outbound_at: null,
      unread_count: 1,
      assigned_to: null,
      labels: [],
      meta: {},
      handoff_active: false,
      handoff_reason: "",
      handoff_priority: "normal",
      handoff_at: null,
      handoff_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockClient = {
      async query(text) {
        const sql = String(text || "").toLowerCase();

        if (
          sql.includes("current_database()") ||
          sql === "begin" ||
          sql === "rollback" ||
          sql === "commit"
        ) {
          return { rows: [{}] };
        }

        if (sql.includes("from tenants")) {
          return {
            rows: [
              {
                id: "22222222-2222-4222-8222-222222222222",
                tenant_key: "acme",
                company_name: "Acme",
                timezone: "Asia/Baku",
                inbox_policy: {},
              },
            ],
          };
        }

        if (sql.includes("from inbox_threads") && sql.includes("select")) {
          return { rows: [] };
        }

        if (sql.includes("insert into inbox_threads")) {
          return { rows: [mockThread] };
        }

        if (sql.includes("insert into inbox_messages")) {
          return {
            rows: [
              {
                id: "33333333-3333-4333-8333-333333333333",
                thread_id: mockThread.id,
                tenant_key: "acme",
                direction: "inbound",
                sender_type: "customer",
                external_message_id: null,
                message_type: "text",
                text: "thanks",
                attachments: [],
                meta: {},
                sent_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
            ],
          };
        }

        if (sql.includes("from inbox_messages")) {
          return { rows: [] };
        }

        if (sql.includes("update inbox_threads")) {
          return { rows: [mockThread] };
        }

        if (sql.includes("insert into inbox_thread_state")) {
          return {
            rows: [
              {
                thread_id: mockThread.id,
                tenant_id: mockThread.tenant_id,
                tenant_key: "acme",
                last_customer_intent: "ack",
                last_customer_service_key: "",
                last_ai_intent: "",
                last_ai_service_key: "",
                last_ai_reply_hash: "",
                last_ai_reply_text: "",
                last_ai_cta_type: "",
                last_response_mode: "no_reply",
                contact_requested_at: null,
                contact_shared_at: null,
                pricing_explained_at: null,
                lead_created_at: null,
                handoff_announced_at: null,
                handoff_message_id: "",
                suppressed_until_operator_reply: false,
                repeat_intent_count: 1,
                repeat_service_count: 0,
                awaiting_customer_answer_to: "",
                last_decision_meta: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          };
        }

        return { rows: [] };
      },
      release() {},
    };

    const router = inboxInternalRoutes({
      db: {
        query: async () => ({ rows: [] }),
        connect: async () => mockClient,
      },
      wsHub: null,
      getRuntime: async () =>
        buildApprovedRuntimePack({
          threadState: null,
        }),
    });

    const { res } = await invokeRouter(router, "post", "/inbox/ingest", {
      headers: {
        "x-internal-token": "internal-secret",
        "x-tenant-key": "acme",
      },
      body: {
        externalThreadId: "ext-thread-1",
        externalUserId: "ext-user-1",
        text: "thanks",
        channel: "instagram",
        timestamp: Date.now(),
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.error, undefined);
    assert.equal(res.body?.thread?.tenant_key, "acme");
    assert.equal(res.body?.tenant?.tenant_key, "acme");
    assert.equal(Array.isArray(res.body?.executionResults), true);
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("inbox tenant lookup returns no authoritative tenant when approved runtime is unavailable", async () => {
  let legacyTenantQueryCount = 0;

  const db = {
    async query(text) {
      const sql = String(text || "").toLowerCase();

      if (sql.includes("from tenants t") && sql.includes("left join tenant_profiles")) {
        legacyTenantQueryCount += 1;
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

      if (sql.includes("from tenants") && sql.includes("order by created_at desc")) {
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

      if (sql.includes("from tenant_business_runtime_projection")) {
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  const tenant = await getInboxTenantByKey(db, "acme");

  assert.equal(tenant, null);
  assert.equal(legacyTenantQueryCount, 1);
});

test("comments tenant lookup returns no authoritative tenant when approved runtime is unavailable", async () => {
  let legacyTenantQueryCount = 0;

  const db = {
    async query(text) {
      const sql = String(text || "").toLowerCase();

      if (sql.includes("from tenants t") && sql.includes("left join tenant_profiles")) {
        legacyTenantQueryCount += 1;
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

      if (sql.includes("from tenants") && sql.includes("order by created_at desc")) {
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

      if (sql.includes("from tenant_business_runtime_projection")) {
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  const tenant = await getCommentTenantByKey(db, "acme");

  assert.equal(tenant, null);
  assert.equal(legacyTenantQueryCount, 1);
});

test("strict inbox brain context fails closed when approved projection is unavailable", async () => {
  const db = {
    async query(text) {
      const sql = String(text || "").toLowerCase();

      if (sql.includes("from tenants t") && sql.includes("left join tenant_profiles")) {
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

      if (sql.includes("from tenants") && sql.includes("order by created_at desc")) {
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

      if (sql.includes("from tenant_business_runtime_projection")) {
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  await assert.rejects(
    () => getTenantInboxBrainContext(db, "acme"),
    (error) => {
      assert.equal(error?.code, "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE");
      assert.equal(error?.runtimeAuthority?.required, true);
      assert.equal(error?.runtimeAuthority?.reasonCode, "runtime_projection_missing");
      return true;
    }
  );
});

test("authoritative tenant lookups and inbox context succeed when an approved projection exists", async () => {
  const rows = buildProjectionRows();
  const db = createProjectionDb(rows);
  const graph = await loadTenantCanonicalGraph(
    { tenantId: rows.tenant.id, tenantKey: rows.tenant.tenant_key },
    db
  );
  const projection = buildTenantRuntimeProjection(graph);

  db.state.projectionRow = {
    id: "projection-1",
    tenant_id: rows.tenant.id,
    tenant_key: rows.tenant.tenant_key,
    status: "ready",
    source_snapshot_id: graph.synthesis.id,
    source_profile_id: graph.profile.id,
    source_capabilities_id: graph.capabilities.id,
    ...projection,
  };

  const inboxTenant = await getInboxTenantByKey(db, "acme");
  const commentTenant = await getCommentTenantByKey(db, "acme");
  const inboxContext = await getTenantInboxBrainContext(db, "acme");

  assert.equal(inboxTenant?.tenant_key, "acme");
  assert.equal(commentTenant?.tenant_key, "acme");
  assert.equal(inboxContext?.tenant?.tenant_key, "acme");
  assert.equal(Array.isArray(inboxContext?.services), true);
  assert.equal(inboxContext.services.length > 0, true);
});

test("runtime projection repair restores strict consumer usability without legacy fallback", async () => {
  const rows = buildProjectionRows();
  const db = createProjectionDb(rows);

  const beforeRepairProjection = await getCurrentTenantRuntimeProjection(
    {
      tenantId: rows.tenant.id,
      tenantKey: rows.tenant.tenant_key,
    },
    db
  );

  assert.equal(beforeRepairProjection, null);

  const refreshed = await refreshTenantRuntimeProjectionStrict(
    {
      tenantId: rows.tenant.id,
      tenantKey: rows.tenant.tenant_key,
      triggerType: "manual_repair",
      requestedBy: "operator@aihq.test",
      runnerKey: "tests.runtime_projection_repair",
      generatedBy: "operator@aihq.test",
      approvedBy: "operator@aihq.test",
      metadata: {
        source: "truth-authority-enforcement.test",
      },
    },
    db
  );

  assert.equal(refreshed.ok, true);
  assert.equal(refreshed.projection?.status, "ready");
  assert.equal(refreshed.freshness?.stale, false);

  const repairedProjection = await getCurrentTenantRuntimeProjection(
    {
      tenantId: rows.tenant.id,
      tenantKey: rows.tenant.tenant_key,
    },
    db
  );
  const repairedRuntime = await getTenantBrainRuntime({
    db,
    tenantKey: "acme",
    authorityMode: "strict",
  });
  const inboxContext = await getTenantInboxBrainContext(db, "acme");

  assert.equal(repairedRuntime?.authority?.available, true);
  assert.equal(
    repairedRuntime?.authority?.source,
    "approved_runtime_projection"
  );
  assert.equal(repairedProjection?.id, refreshed.projection?.id);
  assert.equal(repairedProjection?.status, "ready");
  assert.equal(repairedRuntime?.tenant?.tenant_key, "acme");
  assert.equal(inboxContext?.tenant?.tenant_key, "acme");
  assert.equal(Array.isArray(inboxContext?.services), true);
  assert.equal(inboxContext.services.length > 0, true);
  assert.equal(db.state.legacyTenantQueryCount >= 1, true);
});
