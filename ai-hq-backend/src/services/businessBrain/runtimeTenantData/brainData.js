import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import {
  dbListTenantBusinessFacts,
  dbListTenantChannelPolicies,
  dbListTenantContacts,
  dbListTenantLocations,
} from "../../../db/helpers/tenantBusinessBrain.js";
import { arr, hasDb } from "../runtimeShared.js";
import { logDbStepError, runDbStep } from "./logging.js";
import { isMissingRelationError, runOptionalDbStep } from "./optionalSteps.js";
import { sortRowsByPriority } from "./shared.js";

async function loadTenantServices({ db, tenantId }) {
  if (!hasDb(db) || !tenantId) return [];

  const result = await db.query(
    `
    select *
    from tenant_services
    where tenant_id = $1::uuid
    `,
    [tenantId]
  );

  return sortRowsByPriority(arr(result?.rows));
}

async function loadTenantResponsePlaybooks({ db, tenantId }) {
  if (!hasDb(db) || !tenantId) return [];

  const candidateTables = ["tenant_response_playbooks", "response_playbooks"];

  for (const tableName of candidateTables) {
    try {
      const result = await db.query(
        `
        select *
        from ${tableName}
        where tenant_id = $1::uuid
        `,
        [tenantId]
      );

      const rows = sortRowsByPriority(arr(result?.rows));
      if (rows.length) return rows;
    } catch (error) {
      if (isMissingRelationError(error)) {
        continue;
      }

      logDbStepError(
        `loadTenantResponsePlaybooks:${tableName}`,
        { id: tenantId },
        error
      );
      throw error;
    }
  }

  return [];
}

async function loadStoredResponsePlaybooks({ db, tenant, knowledge }) {
  return runOptionalDbStep(
    "loadStoredResponsePlaybooks",
    tenant,
    db,
    async () => {
      if (typeof knowledge.listResponsePlaybooks === "function") {
        return knowledge.listResponsePlaybooks({
          tenantId: tenant.id,
          tenantKey: tenant.tenant_key,
        });
      }

      if (typeof knowledge.listTenantResponsePlaybooks === "function") {
        return knowledge.listTenantResponsePlaybooks({
          tenantId: tenant.id,
          tenantKey: tenant.tenant_key,
        });
      }

      if (typeof knowledge.listActiveResponsePlaybooks === "function") {
        return knowledge.listActiveResponsePlaybooks({
          tenantId: tenant.id,
          tenantKey: tenant.tenant_key,
        });
      }

      return loadTenantResponsePlaybooks({ db, tenantId: tenant.id });
    },
    []
  );
}

async function loadDbBrainData({ db, tenant }) {
  if (!hasDb(db) || !tenant?.id) {
    return {
      businessProfile: null,
      capabilities: null,
      activeKnowledge: [],
      facts: [],
      contacts: [],
      locations: [],
      channelPolicies: [],
      tenantServices: [],
      storedResponsePlaybooks: [],
    };
  }

  const knowledge = createTenantKnowledgeHelpers({ db });

  const businessProfile = await runDbStep(
    "knowledge.getBusinessProfile",
    tenant,
    () =>
      knowledge.getBusinessProfile({
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
      })
  );

  const capabilities = await runDbStep(
    "knowledge.getBusinessCapabilities",
    tenant,
    () =>
      knowledge.getBusinessCapabilities({
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
      })
  );

  const activeKnowledge = await runDbStep(
    "knowledge.listActiveKnowledge",
    tenant,
    () =>
      knowledge.listActiveKnowledge({
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
      })
  );

  const facts = await runDbStep("dbListTenantBusinessFacts", tenant, () =>
    dbListTenantBusinessFacts(db, tenant.id, { enabledOnly: true })
  );

  const contacts = await runDbStep("dbListTenantContacts", tenant, () =>
    dbListTenantContacts(db, tenant.id)
  );

  const locations = await runDbStep("dbListTenantLocations", tenant, () =>
    dbListTenantLocations(db, tenant.id)
  );

  const channelPolicies = await runDbStep(
    "dbListTenantChannelPolicies",
    tenant,
    () => dbListTenantChannelPolicies(db, tenant.id)
  );

  const tenantServices = await runDbStep("loadTenantServices", tenant, () =>
    loadTenantServices({ db, tenantId: tenant.id })
  );

  const storedResponsePlaybooks = await loadStoredResponsePlaybooks({
    db,
    tenant,
    knowledge,
  });

  return {
    businessProfile,
    capabilities,
    activeKnowledge,
    facts,
    contacts,
    locations,
    channelPolicies,
    tenantServices,
    storedResponsePlaybooks,
  };
}

export {
  loadDbBrainData,
  loadStoredResponsePlaybooks,
  loadTenantResponsePlaybooks,
  loadTenantServices,
};
