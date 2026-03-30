import { buildRuntimeAuthority } from "../runtimeAuthority.js";
import {
  buildKnowledgeEntries,
  buildResponsePlaybooks,
  buildServices,
  normalizeProjectionChannelsPolicies,
  normalizeProjectionFacts,
} from "../runtimeCatalog.js";
import { buildRuntimeOutput } from "../runtimeOutputShape.js";
import { buildTenantFromProjection } from "../runtimeTenantShape.js";
import { arr, obj } from "../runtimeShared.js";

function buildProjectionFirstRuntime({
  legacyTenant,
  input,
  projection,
  freshness = null,
}) {
  const projectionServices = arr(projection?.services_json);
  const projectionKnowledge = arr(projection?.approved_knowledge_json);
  const projectionOperationalFacts = normalizeProjectionFacts(projection?.active_facts_json);
  const projectionTruthFacts = normalizeProjectionFacts(
    projection?.metadata_json?.publishedTruthFacts
  );
  const projectionContacts = arr(projection?.contacts_json);
  const projectionLocations = arr(projection?.locations_json);
  const projectionOperationalChannelPolicies = normalizeProjectionChannelsPolicies(
    projection?.channel_policies_json
  );
  const selectedFacts = [...projectionTruthFacts, ...projectionOperationalFacts];
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
    channelPolicies: projectionOperationalChannelPolicies,
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
      publishedTruthFacts: projectionTruthFacts,
      operationalFacts: projectionOperationalFacts,
      operationalConfig: obj(projection?.metadata_json?.operationalConfig),
      contacts: projectionContacts,
      locations: projectionLocations,
      channelPolicies: projectionOperationalChannelPolicies,
      operationalChannelPolicies: projectionOperationalChannelPolicies,
      activeKnowledge: selectedKnowledge,
      tenantServices: projectionServices,
      storedResponsePlaybooks: [],
    },
  });
}

export { buildProjectionFirstRuntime };
