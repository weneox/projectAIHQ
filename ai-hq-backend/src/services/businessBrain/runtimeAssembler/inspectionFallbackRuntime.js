import { buildRuntimeAuthority } from "../runtimeAuthority.js";
import {
  buildKnowledgeEntries,
  buildResponsePlaybooks,
  buildServices,
} from "../runtimeCatalog.js";
import { buildRuntimeOutput } from "../runtimeOutputShape.js";
import { mergeTenantRuntime } from "../runtimeTenantShape.js";
import { obj } from "../runtimeShared.js";

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

export { buildInspectionFallbackRuntime };
