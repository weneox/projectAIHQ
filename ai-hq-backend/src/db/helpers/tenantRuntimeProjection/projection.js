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
  buildBehaviorJson,
} from "./builders.js";

export function buildTenantRuntimeProjection(graph) {
  const publishedTruthVersion = graph?.publishedTruthVersion || null;
  const publishedTruthVersionId = s(publishedTruthVersion?.id);
  const publishedProfile = publishedTruthVersion?.profile_snapshot_json || null;
  const publishedCapabilities =
    publishedTruthVersion?.capabilities_snapshot_json || null;

  const profileSource = publishedProfile || graph.profile;
  const capabilitiesSource = publishedCapabilities || graph.capabilities;

  const profile = normalizeProfile(graph.tenant, profileSource);
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

  const publishedTruthFacts = arr(graph.publishedTruthFacts);
  const operationalFacts = arr(graph.operationalFacts ?? graph.facts);
  const combinedFacts = [...publishedTruthFacts, ...operationalFacts];

  const operationalChannelPolicies = arr(
    graph.operationalChannelPolicies ?? graph.channelPolicies
  );

  const retrievalCorpus = buildRetrievalCorpus({
    profile,
    services: graph.services,
    products: graph.products,
    faq: graph.faq,
    policies: graph.policies,
    knowledge: graph.knowledge,
    facts: combinedFacts,
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
    facts: combinedFacts,
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
    facts: combinedFacts,
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
    operationalChannelPolicies
  );

  const commentsJson = buildCommentsJson(
    capabilities,
    graph.faq,
    operationalChannelPolicies
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
    operationalChannelPolicies,
    graph.contacts
  );

  const handoffJson = buildHandoffJson(
    capabilities,
    operationalChannelPolicies
  );

  const behaviorJson = buildBehaviorJson(
    profile,
    capabilities,
    operationalChannelPolicies
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
    active_facts_json: operationalFacts,
    channel_policies_json: operationalChannelPolicies,

    inbox_json: inboxJson,
    comments_json: commentsJson,
    content_json: contentJson,
    voice_json: voiceJson,
    lead_capture_json: leadCaptureJson,
    handoff_json: handoffJson,
    behavior_json: behaviorJson,

    retrieval_corpus_json: retrievalCorpus,
    runtime_context_text: runtimeContextText,

    readiness_score: readiness.score,
    readiness_label: readiness.label,
    confidence: confidence.score,
    confidence_label: confidence.label,

    metadata_json: {
      publishedTruthVersionId,
      truthSource: publishedTruthVersionId
        ? "published_truth_version"
        : "canonical_live_rows",
      sourceRefs: {
        synthesisId: s(graph.synthesis?.id),
        profileId:
          s(publishedTruthVersion?.business_profile_id) || s(graph.profile?.id),
        capabilitiesId:
          s(publishedTruthVersion?.business_capabilities_id) ||
          s(graph.capabilities?.id),
      },
      coverage: {
        contacts: arr(graph.contacts).length,
        locations: arr(graph.locations).length,
        services: arr(graph.services).length,
        products: arr(graph.products).length,
        faq: arr(graph.faq).length,
        policies: arr(graph.policies).length,
        channels: arr(graph.channels).length,
        knowledge: arr(graph.knowledge).length,
        publishedTruthFacts: publishedTruthFacts.length,
        operationalFacts: operationalFacts.length,
        retrievalCorpus: retrievalCorpus.length,
      },
      confidenceInputs: {
        synthesisConfidence:
          typeof graph?.synthesis?.confidence === "number"
            ? graph.synthesis.confidence
            : null,
        profileConfidence:
          typeof profileSource?.confidence === "number"
            ? profileSource.confidence
            : null,
      },
      publishedTruthFacts,
      operationalFactsCount: operationalFacts.length,
      operationalConfig: {
        channelPolicies: {
          source: "tenant_channel_policies",
          governanceModel: "operational_runtime_config",
          count: operationalChannelPolicies.length,
        },
      },
      behaviorContractVersion: 1,
    },
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