import { db } from "../../index.js";
import { s, pickDb, one, many, parseObject } from "./shared.js";
import {
  normalizeContacts,
  normalizeLocations,
  normalizeHours,
  normalizeServices,
  normalizeProducts,
  normalizeFaq,
  normalizePolicies,
  normalizeSocialAccounts,
  normalizeChannels,
  normalizeMediaAssets,
  normalizeKnowledge,
  normalizeFacts,
  normalizeChannelPolicies,
} from "./normalizers.js";

export async function resolveTenant(client, { tenantId = "", tenantKey = "" } = {}) {
  if (!s(tenantId) && !s(tenantKey)) {
    throw new Error("tenantId or tenantKey is required");
  }

  return await one(
    client,
    `
      select
        id,
        tenant_key,
        company_name,
        legal_name,
        industry_key,
        default_language,
        enabled_languages
      from tenants
      where ($1::uuid is not null and id = $1::uuid)
         or ($2::text <> '' and tenant_key = $2::text)
      order by created_at desc
      limit 1
    `,
    [s(tenantId) || null, s(tenantKey)]
  );
}

export async function loadTenantCanonicalGraph(
  { tenantId = "", tenantKey = "" } = {},
  dbOrClient = db
) {
  const client = pickDb(dbOrClient);
  const tenant = await resolveTenant(client, { tenantId, tenantKey });
  if (!tenant) throw new Error("tenant_not_found");

  const [
    profile,
    capabilities,
    synthesis,
    contactsRows,
    locationsRows,
    hoursRows,
    servicesRows,
    productsRows,
    faqRows,
    policiesRows,
    socialRows,
    channelRows,
    mediaRows,
    knowledgeRows,
    factsRows,
    channelPolicyRows,
    latestTruthVersion,
  ] = await Promise.all([
    one(client, `select * from tenant_business_profile where tenant_id = $1 limit 1`, [tenant.id]),
    one(client, `select * from tenant_business_capabilities where tenant_id = $1 limit 1`, [tenant.id]),
    one(
      client,
      `
      select *
      from tenant_business_synthesis_snapshots
      where tenant_id = $1
      order by is_current desc, created_at desc
      limit 1
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_contacts
      where tenant_id = $1 and enabled = true
      order by is_primary desc, sort_order asc, updated_at desc
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_locations
      where tenant_id = $1 and enabled = true
      order by is_primary desc, sort_order asc, updated_at desc
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_business_hours
      where tenant_id = $1 and is_active = true
      order by sort_order asc, day_of_week asc, updated_at desc
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_services
      where tenant_id = $1 and is_active = true
      order by sort_order asc, updated_at desc
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_business_products
      where tenant_id = $1 and is_active = true
      order by sort_order asc, updated_at desc
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_business_faq
      where tenant_id = $1 and is_active = true
      order by sort_order asc, updated_at desc
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_business_policies
      where tenant_id = $1 and is_active = true
      order by priority asc, updated_at desc
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_business_social_accounts
      where tenant_id = $1 and is_active = true
      order by is_primary desc, updated_at desc
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_business_channels
      where tenant_id = $1 and is_active = true
      order by is_primary desc, updated_at desc
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_business_media_assets
      where tenant_id = $1 and is_active = true
      order by is_primary desc, updated_at desc
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_knowledge_items
      where tenant_id = $1
        and status in ('approved', 'active')
      order by priority asc, updated_at desc
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_business_facts
      where tenant_id = $1
        and enabled = true
      order by priority asc, updated_at desc
      `,
      [tenant.id]
    ),
    many(
      client,
      `
      select *
      from tenant_channel_policies
      where tenant_id = $1
        and enabled = true
      order by channel asc, subchannel asc, updated_at desc
      `,
      [tenant.id]
    ),
    one(
      client,
      `
      select *
      from tenant_business_profile_versions
      where tenant_id = $1
      order by approved_at desc, created_at desc
      limit 1
      `,
      [tenant.id]
    ),
  ]);

  const publishedTruthMetadata = latestTruthVersion
    ? parseObject(latestTruthVersion.metadata_json)
    : null;
  const publishedTruthVersion = latestTruthVersion
    ? {
        ...latestTruthVersion,
        profile_snapshot_json: parseObject(latestTruthVersion.profile_snapshot_json),
        capabilities_snapshot_json: parseObject(
          latestTruthVersion.capabilities_snapshot_json
        ),
        source_summary_json: parseObject(latestTruthVersion.source_summary_json),
        field_provenance_json: parseObject(latestTruthVersion.field_provenance_json),
        metadata_json: publishedTruthMetadata,
        has_services_snapshot:
          Object.prototype.hasOwnProperty.call(publishedTruthMetadata || {}, "servicesSnapshot") ||
          Object.prototype.hasOwnProperty.call(
            publishedTruthMetadata || {},
            "services_snapshot_json"
          ),
        services_snapshot_json: Array.isArray(publishedTruthMetadata?.servicesSnapshot)
          ? publishedTruthMetadata.servicesSnapshot
          : Array.isArray(publishedTruthMetadata?.services_snapshot_json)
            ? publishedTruthMetadata.services_snapshot_json
            : [],
        has_contacts_snapshot:
          Object.prototype.hasOwnProperty.call(publishedTruthMetadata || {}, "contactsSnapshot") ||
          Object.prototype.hasOwnProperty.call(
            publishedTruthMetadata || {},
            "contacts_snapshot_json"
          ),
        contacts_snapshot_json: Array.isArray(publishedTruthMetadata?.contactsSnapshot)
          ? publishedTruthMetadata.contactsSnapshot
          : Array.isArray(publishedTruthMetadata?.contacts_snapshot_json)
            ? publishedTruthMetadata.contacts_snapshot_json
            : [],
        has_locations_snapshot:
          Object.prototype.hasOwnProperty.call(publishedTruthMetadata || {}, "locationsSnapshot") ||
          Object.prototype.hasOwnProperty.call(
            publishedTruthMetadata || {},
            "locations_snapshot_json"
          ),
        locations_snapshot_json: Array.isArray(publishedTruthMetadata?.locationsSnapshot)
          ? publishedTruthMetadata.locationsSnapshot
          : Array.isArray(publishedTruthMetadata?.locations_snapshot_json)
            ? publishedTruthMetadata.locations_snapshot_json
            : [],
      }
    : null;

  return {
    tenant,
    profile,
    capabilities,
    synthesis,
    contacts:
      publishedTruthVersion?.has_contacts_snapshot
        ? normalizeContacts(publishedTruthVersion.contacts_snapshot_json)
        : normalizeContacts(contactsRows),
    locations:
      publishedTruthVersion?.has_locations_snapshot
        ? normalizeLocations(publishedTruthVersion.locations_snapshot_json)
        : normalizeLocations(locationsRows),
    hours: normalizeHours(hoursRows),
    services:
      publishedTruthVersion?.has_services_snapshot
        ? normalizeServices(publishedTruthVersion.services_snapshot_json)
        : normalizeServices(servicesRows),
    products: normalizeProducts(productsRows),
    faq: normalizeFaq(faqRows),
    policies: normalizePolicies(policiesRows),
    socialAccounts: normalizeSocialAccounts(socialRows),
    channels: normalizeChannels(channelRows),
    mediaAssets: normalizeMediaAssets(mediaRows),
    knowledge: normalizeKnowledge(knowledgeRows),
    facts: normalizeFacts(factsRows),
    channelPolicies: normalizeChannelPolicies(channelPolicyRows),
    publishedTruthVersion,
  };
}
