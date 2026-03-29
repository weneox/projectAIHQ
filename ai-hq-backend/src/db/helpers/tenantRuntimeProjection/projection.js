import { s, arr, sha256Json } from "./shared.js";
import { normalizeProfile, normalizeCapabilities } from "./normalizers.js";
import {
  buildReadiness,
  buildConfidence,
  buildRetrievalCorpus,
  buildRuntimeContextText,
  buildInboxJson,
  buildCommentsJson,
  buildContentJson,
  buildVoiceJson,
  buildLeadCaptureJson,
  buildHandoffJson,
} from "./builders.js";

export function buildTenantRuntimeProjection(graph) {
  const publishedTruthVersion = graph?.publishedTruthVersion || null;
  const publishedProfile =
    publishedTruthVersion?.profile_snapshot_json || null;
  const publishedCapabilities =
    publishedTruthVersion?.capabilities_snapshot_json || null;
  const profileSource = publishedProfile || graph.profile;
  const capabilitiesSource = publishedCapabilities || graph.capabilities;
  const profile = normalizeProfile(
    graph.tenant,
    profileSource
  );
  const capabilities = normalizeCapabilities(
    capabilitiesSource,
    publishedProfile || profile
  );

  const identity = {
    tenantId: s(graph.tenant?.id),
    tenantKey: s(profile.tenantKey),
    companyName: s(profile.companyName),
    displayName: s(profile.displayName || profile.companyName),
    legalName: s(profile.legalName),
    industryKey: s(profile.industryKey),
    subindustryKey: s(profile.subindustryKey),
    websiteUrl: s(profile.websiteUrl),
    mainLanguage: s(profile.mainLanguage || "az"),
    supportedLanguages: arr(profile.supportedLanguages),
  };

  const retrievalCorpus = buildRetrievalCorpus({
    profile,
    services: graph.services,
    products: graph.products,
    faq: graph.faq,
    policies: graph.policies,
    knowledge: graph.knowledge,
    facts: graph.facts,
  });

  const runtimeContextText = buildRuntimeContextText({
    identity,
    profile,
    contacts: graph.contacts,
    locations: graph.locations,
    services: graph.services,
    products: graph.products,
    faq: graph.faq,
    policies: graph.policies,
    knowledge: graph.knowledge,
    facts: graph.facts,
  });

  const readiness = buildReadiness({
    profile,
    contacts: graph.contacts,
    locations: graph.locations,
    services: graph.services,
    products: graph.products,
    faq: graph.faq,
    policies: graph.policies,
    channels: graph.channels,
    knowledge: graph.knowledge,
    facts: graph.facts,
  });

  const confidence = buildConfidence({
    synthesis: graph.synthesis,
    profile: profileSource,
    capabilities: capabilitiesSource,
    services: graph.services,
    contacts: graph.contacts,
    faq: graph.faq,
    policies: graph.policies,
  });

  const inboxJson = buildInboxJson(
    capabilities,
    graph.services,
    graph.contacts,
    graph.channelPolicies
  );

  const commentsJson = buildCommentsJson(
    capabilities,
    graph.faq,
    graph.channelPolicies
  );

  const contentJson = buildContentJson(
    profile,
    capabilities,
    graph.services,
    graph.products,
    graph.socialAccounts
  );

  const voiceJson = buildVoiceJson(
    capabilities,
    graph.channels,
    graph.contacts
  );

  const leadCaptureJson = buildLeadCaptureJson(
    capabilities,
    graph.channelPolicies,
    graph.contacts
  );

  const handoffJson = buildHandoffJson(
    capabilities,
    graph.channelPolicies
  );

  const projectionPayload = {
    identity_json: identity,
    profile_json: profile,
    capabilities_json: capabilities,

    contacts_json: graph.contacts,
    locations_json: graph.locations,
    hours_json: graph.hours,
    services_json: graph.services,
    products_json: graph.products,
    faq_json: graph.faq,
    policies_json: graph.policies,
    social_accounts_json: graph.socialAccounts,
    channels_json: graph.channels,
    media_assets_json: graph.mediaAssets,

    approved_knowledge_json: graph.knowledge,
    active_facts_json: graph.facts,
    channel_policies_json: graph.channelPolicies,

    inbox_json: inboxJson,
    comments_json: commentsJson,
    content_json: contentJson,
    voice_json: voiceJson,
    lead_capture_json: leadCaptureJson,
    handoff_json: handoffJson,

    retrieval_corpus_json: retrievalCorpus,
    runtime_context_text: runtimeContextText,

    readiness_score: readiness.score,
    readiness_label: readiness.label,
    confidence: confidence.score,
    confidence_label: confidence.label,
  };

  return {
    ...projectionPayload,
    projection_hash: sha256Json(projectionPayload),
    status:
      readiness.score >= 0.65
        ? "ready"
        : readiness.score >= 0.35
        ? "draft"
        : "draft",
  };
}
