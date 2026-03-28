import { buildRuntimeAuthority } from "./runtimeAuthority.js";
import {
  buildKnowledgeEntries,
  buildResponsePlaybooks,
  buildServices,
  normalizeProjectionChannelsPolicies,
  normalizeProjectionFacts,
} from "./runtimeCatalog.js";
import { buildRuntimeOutput, buildUnresolvedTenantFallback } from "./runtimeOutputShape.js";
import { buildTenantFromProjection, mergeTenantRuntime } from "./runtimeTenantShape.js";
import { arr, obj } from "./runtimeShared.js";

function buildProjectionFirstRuntime({
  legacyTenant,
  input,
  projection,
  freshness = null,
}) {
  const projectionServices = arr(projection?.services_json);
  const projectionKnowledge = arr(projection?.approved_knowledge_json);
  const projectionFacts = normalizeProjectionFacts(projection?.active_facts_json);
  const projectionContacts = arr(projection?.contacts_json);
  const projectionLocations = arr(projection?.locations_json);
  const projectionChannelPolicies = normalizeProjectionChannelsPolicies(
    projection?.channel_policies_json
  );
  const selectedFacts = projectionFacts;
  const selectedKnowledge = projectionKnowledge;

  const services = buildServices({
    incomingServices: input?.services,
    tenantServices: projectionServices,
    facts: selectedFacts,
    activeKnowledge: selectedKnowledge,
    tenant: legacyTenant,
    legacy: null,
  });
  const knowledgeEntries = buildKnowledgeEntries({
    incomingKnowledgeEntries: input?.knowledgeEntries,
    facts: selectedFacts,
    activeKnowledge: selectedKnowledge,
    tenant: legacyTenant,
  });
  const responsePlaybooks = buildResponsePlaybooks({
    incomingResponsePlaybooks: input?.responsePlaybooks,
    storedResponsePlaybooks: [],
    facts: selectedFacts,
    activeKnowledge: selectedKnowledge,
    capabilities: obj(projection?.capabilities_json),
    tenant: legacyTenant,
  });
  const mergedTenant = buildTenantFromProjection({
    legacy: legacyTenant,
    projection,
    services,
    facts: selectedFacts,
    contacts: projectionContacts,
    locations: projectionLocations,
    channelPolicies: projectionChannelPolicies,
    activeKnowledge: selectedKnowledge,
  });

  return buildRuntimeOutput({
    tenant: mergedTenant,
    services,
    knowledgeEntries,
    responsePlaybooks,
    threadState: input?.threadState || null,
    policyControls: input?.policyControls || {},
    authority: buildRuntimeAuthority({
      mode: input?.authorityMode,
      available: true,
      tenantId: legacyTenant?.id,
      tenantKey: legacyTenant?.tenant_key,
      runtimeProjection: projection,
      freshness,
    }),
    raw: {
      mode: "projection_first",
      projection,
      facts: selectedFacts,
      contacts: projectionContacts,
      locations: projectionLocations,
      channelPolicies: projectionChannelPolicies,
      activeKnowledge: selectedKnowledge,
      tenantServices: projectionServices,
      storedResponsePlaybooks: [],
    },
  });
}

function buildInspectionFallbackRuntime({ legacyTenant, input, dbData, authorityMode }) {
  const services = buildServices({
    incomingServices: input?.services,
    tenantServices: dbData.tenantServices,
    facts: dbData.facts,
    activeKnowledge: dbData.activeKnowledge,
    tenant: legacyTenant,
    legacy: legacyTenant,
  });
  const knowledgeEntries = buildKnowledgeEntries({
    incomingKnowledgeEntries: input?.knowledgeEntries,
    facts: dbData.facts,
    activeKnowledge: dbData.activeKnowledge,
    tenant: legacyTenant,
  });
  const responsePlaybooks = buildResponsePlaybooks({
    incomingResponsePlaybooks: input?.responsePlaybooks,
    storedResponsePlaybooks: dbData.storedResponsePlaybooks,
    facts: dbData.facts,
    activeKnowledge: dbData.activeKnowledge,
    capabilities: obj(dbData.capabilities),
    tenant: legacyTenant,
  });
  const mergedTenant = mergeTenantRuntime({
    legacy: legacyTenant,
    businessProfile: obj(dbData.businessProfile),
    capabilities: obj(dbData.capabilities),
    facts: dbData.facts,
    contacts: dbData.contacts,
    locations: dbData.locations,
    channelPolicies: dbData.channelPolicies,
    services,
    activeKnowledge: dbData.activeKnowledge,
  });

  return buildRuntimeOutput({
    tenant: mergedTenant,
    services,
    knowledgeEntries,
    responsePlaybooks,
    threadState: input?.threadState || null,
    policyControls: input?.policyControls || {},
    authority: buildRuntimeAuthority({
      mode: authorityMode,
      available: false,
      tenantId: legacyTenant.id,
      tenantKey: legacyTenant.tenant_key,
      reasonCode: "inspection_legacy_runtime_fallback",
      reason: "inspection_legacy_runtime_fallback",
    }),
    raw: {
      mode: "inspection_fallback",
      businessProfile: dbData.businessProfile,
      capabilities: dbData.capabilities,
      facts: dbData.facts,
      contacts: dbData.contacts,
      locations: dbData.locations,
      channelPolicies: dbData.channelPolicies,
      activeKnowledge: dbData.activeKnowledge,
      tenantServices: dbData.tenantServices,
      storedResponsePlaybooks: dbData.storedResponsePlaybooks,
    },
  });
}

export {
  buildInspectionFallbackRuntime,
  buildProjectionFirstRuntime,
  buildUnresolvedTenantFallback,
};

export const buildLegacyFallbackRuntime = buildInspectionFallbackRuntime;
