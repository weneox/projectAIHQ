import test from "node:test";
import assert from "node:assert/strict";

import {
  buildKnowledgeEntries,
  buildResponsePlaybooks,
  buildServices,
  dedupeKnowledgeEntries,
  dedupePlaybooks,
  firstFact,
  listFactsByCategory,
  normalizeProjectionChannelsPolicies,
  normalizeProjectionFacts,
} from "../src/services/businessBrain/runtimeCatalog.js";
import {
  buildRuntimeOutput,
} from "../src/services/businessBrain/runtimeOutputShape.js";
import {
  buildTenantFromProjection,
  mergeTenantRuntime,
} from "../src/services/businessBrain/runtimeTenantShape.js";

function buildLegacyTenant() {
  return {
    id: "tenant-1",
    tenant_key: "acme",
    company_name: "Acme Clinic",
    legal_name: "Acme Clinic LLC",
    industry_key: "clinic",
    timezone: "Asia/Baku",
    default_language: "en",
    supported_languages: ["en", "az"],
    enabled_languages: ["en", "az"],
    profile: {
      brand_name: "Acme Clinic",
      services_summary: "Consultation",
      tone_of_voice: "professional",
      preferred_cta: "Book a visit",
      banned_phrases: ["No guarantees."],
      communication_rules: {},
      extra_context: {},
    },
    ai_policy: {
      auto_reply_enabled: true,
      create_lead_enabled: true,
    },
    inbox_policy: {},
    comment_policy: {},
    meta: {},
  };
}

test("catalog builders normalize and compose services, knowledge, and generated playbooks", () => {
  const tenant = buildLegacyTenant();
  const services = buildServices({
    incomingServices: [{ title: "Consultation", visibleInAi: true }],
    tenantServices: [{ title: "Consultation", serviceKey: "consultation" }],
    facts: [{ category: "product", value_text: "Whitening" }],
    activeKnowledge: [{ category: "service", value_text: "Consultation" }],
    tenant,
    legacy: tenant,
  });
  const knowledgeEntries = buildKnowledgeEntries({
    incomingKnowledgeEntries: [{ question: "Do you work weekends?", answer: "Yes." }],
    facts: [{ category: "support", value_text: "Message us anytime." }],
    activeKnowledge: [{ category: "faq", question: "Where are you?", answer: "Baku." }],
    tenant,
  });
  const playbooks = buildResponsePlaybooks({
    incomingResponsePlaybooks: [],
    storedResponsePlaybooks: [],
    facts: [{ category: "booking", value_text: "Send your preferred day." }],
    activeKnowledge: [{ category: "support", value_text: "We can help with that." }],
    capabilities: { replyStyle: "professional" },
    tenant,
  });

  assert.deepEqual(
    services.map((item) => item.title),
    ["Consultation"]
  );
  assert.equal(knowledgeEntries.length, 3);
  assert.ok(playbooks.some((item) => item.intent_key === "booking"));
  assert.ok(playbooks.some((item) => item.intent_key === "support"));
});

test("catalog dedupe and fact selection helpers preserve current compatibility behavior", () => {
  const tenant = buildLegacyTenant();
  const knowledge = dedupeKnowledgeEntries(
    [
      { question: "Where are you?", answer: "Baku.", enabled: true },
      { question: "Where are you?", answer: "Baku.", enabled: true },
      { question: "Do you work weekends?", answer: "Yes.", enabled: true },
    ],
    tenant
  );
  const playbooks = dedupePlaybooks(
    [
      { intent_key: "booking", ideal_reply: "Send your preferred day.", enabled: true },
      { intent_key: "booking", ideal_reply: "Send your preferred day.", enabled: true },
      { intent_key: "support", ideal_reply: "Message us anytime.", enabled: true },
    ],
    tenant
  );
  const facts = [
    { category: "pricing", value_text: "From 20 AZN" },
    { category: "pricing", value_text: "Custom quote" },
    { category: "support", value_text: "Message us anytime." },
  ];

  assert.equal(knowledge.length, 2);
  assert.equal(playbooks.length, 2);
  assert.equal(firstFact(facts, ["support"]), "Message us anytime.");
  assert.deepEqual(listFactsByCategory(facts, ["pricing"]), ["From 20 AZN", "Custom quote"]);
});

test("projection catalog helpers preserve fact and channel policy compatibility", () => {
  const normalizedFacts = normalizeProjectionFacts([
    { fact_group: "pricing", factKey: "pricing_1", valueText: "From 20 AZN" },
  ]);
  const normalizedPolicies = normalizeProjectionChannelsPolicies([
    {
      channel: "instagram",
      aiReplyEnabled: true,
      humanHandoffEnabled: false,
      pricingVisibility: "public",
      publicReplyMode: "allowed",
      contactCaptureMode: "guided",
      escalationMode: "manual",
      replyStyle: "professional",
      maxReplySentences: 3,
    },
  ]);

  assert.deepEqual(normalizedFacts[0], {
    fact_group: "pricing",
    factKey: "pricing_1",
    valueText: "From 20 AZN",
    category: "pricing",
    entry_type: "pricing",
    fact_key: "pricing_1",
    value_text: "From 20 AZN",
  });
  assert.equal(normalizedPolicies[0].ai_reply_enabled, true);
  assert.equal(normalizedPolicies[0].human_handoff_enabled, false);
  assert.equal(normalizedPolicies[0].pricing_visibility, "public");
  assert.equal(normalizedPolicies[0].max_reply_sentences, 3);
});

test("legacy tenant merge shaping preserves metadata and policy compatibility", () => {
  const merged = mergeTenantRuntime({
    legacy: buildLegacyTenant(),
    businessProfile: {
      company_name: "Acme Clinic",
      summary_short: "Premium clinic care",
      summary_long: "Same-day consultations.",
      target_audience: "Families",
      value_proposition: "Fast, careful treatment",
      primary_email: "hello@acme.example",
      primary_phone: "+15550001111",
      main_language: "en",
      supported_languages: ["en", "az"],
    },
    capabilities: {
      reply_style: "professional",
      reply_length: "detailed",
      cta_style: "soft",
      handoff_enabled: true,
    },
    facts: [{ category: "booking", value_text: "Book a visit" }],
    contacts: [],
    locations: [{ title: "Baku" }],
    channelPolicies: [{ channel: "instagram", subchannel: "default", pricing_visibility: "public" }],
    services: [{ title: "Consultation" }],
    activeKnowledge: [{ category: "support", value_text: "Message us anytime." }],
  });

  assert.equal(merged.profile.public_email, "hello@acme.example");
  assert.equal(merged.profile.communication_rules.maxSentences, 3);
  assert.equal(merged.inbox_policy.pricing_visibility, "public");
  assert.equal(merged.meta.contactPhones[0], "+15550001111");
});

test("projection-backed tenant merge shaping preserves projection metadata and policy fields", () => {
  const merged = buildTenantFromProjection({
    legacy: buildLegacyTenant(),
    projection: {
      id: "projection-1",
      status: "ready",
      readiness_label: "ready",
      confidence_label: "high",
      identity_json: {
        tenantId: "tenant-1",
        tenantKey: "acme",
        companyName: "Acme Clinic",
        displayName: "Acme Clinic",
        mainLanguage: "en",
        supportedLanguages: ["en", "az"],
      },
      profile_json: {
        companyName: "Acme Clinic",
        summaryShort: "Premium clinic care",
        summaryLong: "Same-day consultations.",
        targetAudience: "Families",
        valueProposition: "Fast, careful treatment",
        primaryEmail: "hello@acme.example",
        primaryPhone: "+15550001111",
      },
      capabilities_json: {
        replyStyle: "professional",
        replyLength: "medium",
        ctaStyle: "soft",
      },
      comments_json: {
        replyStyle: "professional",
        publicReplyMode: "allowed",
      },
      content_json: {
        ctaStyle: "soft",
      },
      lead_capture_json: {
        enabled: true,
      },
      handoff_json: {
        enabled: true,
      },
      inbox_json: {
        enabled: true,
      },
    },
    services: [{ title: "Consultation" }],
    facts: [],
    contacts: [{ channel: "phone", value: "+15550001111", isPrimary: true }],
    locations: [{ title: "Baku" }],
    channelPolicies: [{ channel: "instagram", pricing_visibility: "public", public_reply_mode: "allowed" }],
    activeKnowledge: [],
  });

  assert.equal(merged.meta.runtimeProjectionId, "projection-1");
  assert.equal(merged.comment_policy.public_reply_mode, "allowed");
  assert.equal(merged.ai_policy.auto_reply_enabled, true);
  assert.equal(merged.meta.confidenceLabel, "high");
});

test("projection-backed tenant merge does not silently fall back to legacy business fields", () => {
  const merged = buildTenantFromProjection({
    legacy: {
      ...buildLegacyTenant(),
      company_name: "Legacy Clinic",
      legal_name: "Legacy Clinic LLC",
      industry_key: "legacy-clinic",
      profile: {
        ...buildLegacyTenant().profile,
        website_url: "https://legacy.example",
        public_email: "legacy@acme.example",
        public_phone: "+15559990000",
        tone_of_voice: "legacy tone",
        banned_phrases: ["Legacy phrase"],
      },
      ai_policy: {
        auto_reply_enabled: true,
        create_lead_enabled: true,
      },
    },
    projection: {
      id: "projection-2",
      status: "ready",
      identity_json: {
        tenantId: "tenant-1",
        tenantKey: "acme",
        companyName: "Acme Clinic",
        displayName: "Acme Clinic",
        mainLanguage: "en",
        supportedLanguages: ["en"],
      },
      profile_json: {
        companyName: "Acme Clinic",
      },
      capabilities_json: {},
      inbox_json: {},
      comments_json: {},
      content_json: {},
      lead_capture_json: {},
      handoff_json: {},
    },
    services: [],
    facts: [],
    contacts: [],
    locations: [],
    channelPolicies: [],
    activeKnowledge: [],
  });

  assert.equal(merged.company_name, "Acme Clinic");
  assert.equal(merged.profile.website_url, "");
  assert.equal(merged.profile.public_email, "");
  assert.equal(merged.profile.public_phone, "");
  assert.equal(merged.profile.tone_of_voice, "professional, warm, concise");
  assert.deepEqual(merged.profile.banned_phrases, []);
  assert.equal(merged.ai_policy.auto_reply_enabled, undefined);
  assert.equal(merged.ai_policy.create_lead_enabled, undefined);
});

test("final runtime output shaping keeps the public compatibility surface", () => {
  const runtime = buildRuntimeOutput({
    tenant: {
      ...buildLegacyTenant(),
      profile: {
        ...buildLegacyTenant().profile,
        brand_summary: "Premium clinic care",
      },
      meta: {
        services: ["Consultation"],
        businessSummary: "Premium clinic care",
      },
    },
    services: [{ title: "Consultation", visibleInAi: true, enabled: true }],
    knowledgeEntries: [{ question: "Where are you?", answer: "Baku.", enabled: true }],
    responsePlaybooks: [{ intent_key: "booking", ideal_reply: "Send your preferred day.", enabled: true }],
    authority: {
      mode: "strict",
      required: true,
      available: true,
      source: "approved_runtime_projection",
    },
    raw: {
      mode: "projection_first",
    },
  });

  assert.equal(runtime.companyName, "Acme Clinic");
  assert.deepEqual(runtime.services, ["Consultation"]);
  assert.equal(runtime.authority.source, "approved_runtime_projection");
  assert.equal(runtime.raw.mode, "projection_first");
  assert.ok(Array.isArray(runtime.leadPrompts));
});
