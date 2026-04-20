import { initDb, getDb, closeDb } from "./ai-hq-backend/src/db/index.js";
import { refreshTenantRuntimeProjectionStrict } from "./ai-hq-backend/src/db/helpers/tenantRuntimeProjection/runtime.js";

await initDb();

const result = await refreshTenantRuntimeProjectionStrict(
  {
    tenantId: "6f0a8021-1d10-435b-ba69-97600d8ddabe",
    triggerType: "manual",
    requestedBy: "manual_contact_backfill",
    runnerKey: "manual_contact_backfill",
    generatedBy: "manual_contact_backfill",
    approvedBy: "manual_contact_backfill"
  },
  getDb()
);

console.log(JSON.stringify({
  ok: result?.ok,
  runId: result?.runId,
  projectionId: result?.projection?.id,
  contactsCount: Array.isArray(result?.projection?.contacts_json)
    ? result.projection.contacts_json.length
    : null,
  freshnessStale: result?.freshness?.stale ?? null
}, null, 2));

await closeDb();
