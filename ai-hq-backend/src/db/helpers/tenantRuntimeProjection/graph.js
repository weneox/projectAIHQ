import { db } from "../../index.js";
import { dbListTenantChannels } from "../settings.js";
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

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function lower(v) {
  return s(v).toLowerCase();
}

function normalizeOperationalChannelType(value = "") {
  const x = lower(value);

  if (!x) return "";
  if (x === "ig") return "instagram";
  if (x === "insta") return "instagram";
  if (x === "messenger") return "facebook";
  if (x === "fb") return "facebook";
  if (x === "wa") return "whatsapp";
  if (x === "tg") return "telegram";
  if (x === "telegram_dm" || x === "telegram-dm") return "telegram";
  if (x === "telegram_bot" || x === "telegram-bot") return "telegram";
  if (x === "website" || x === "web") return "website_widget";
  if (x === "website_widget" || x === "website-widget") return "website_widget";
  if (x === "website_chat" || x === "website-chat") return "website_widget";
  if (x === "webchat") return "website_widget";
  if (x === "widget") return "website_widget";
  if (x === "mail") return "email";
  if (x === "email_inbox" || x === "email-inbox") return "email";
  if (x === "linkedin_dm" || x === "linkedin-dm") return "linkedin";

  return x;
}

function isConnectedStatus(status = "") {
  const x = lower(status);
  return ["connected", "active", "ready", "live"].includes(x);
}

function operationalChannelsToProjectionRows(rows = []) {
  return rows.map((row) => {
    const safe = obj(row);
    const channelType = normalizeOperationalChannelType(
      safe.channel_type || safe.channelType
    );
    const status = lower(safe.status || "disconnected");
    const config = obj(safe.config);
    const health = obj(safe.health);

    const endpoint =
      s(config.webhook_url) ||
      s(config.endpoint) ||
      s(config.url) ||
      "";

    const externalChannelId =
      s(safe.external_page_id) ||
      s(safe.external_user_id) ||
      s(safe.external_account_id) ||
      "";

    return {
      id: s(safe.id),
      source_id: "",
      social_account_id: "",
      channel_key: s(
        safe.channel_key || safe.channel_type || safe.channelType || channelType
      ),
      channel_type: channelType,
      label: s(safe.display_name || channelType),
      endpoint,
      external_channel_id: externalChannelId,
      is_primary: Boolean(safe.is_primary),
      is_connected: isConnectedStatus(status),
      is_active: status !== "disconnected",
      supports_inbound: true,
      supports_outbound: [
        "instagram",
        "facebook",
        "whatsapp",
        "telegram",
        "website_widget",
        "email",
        "linkedin",
      ].includes(channelType),
      supports_comments: channelType === "facebook" || channelType === "instagram",
      supports_calls: channelType === "voice",
      supports_handoff: true,
      status,
      config_json: config,
      metadata_json: {
        source: "tenant_channels",
        provider: s(safe.provider),
        secretsRef: s(safe.secrets_ref),
        externalUsername: s(safe.external_username),
        externalAccountId: s(safe.external_account_id),
        externalPageId: s(safe.external_page_id),
        externalUserId: s(safe.external_user_id),
        health,
        lastSyncAt: safe.last_sync_at || null,
      },
    };
  });
}

function mergeProjectionChannels(primary = [], supplemental = []) {
  const byKey = new Map();

  for (const item of [...supplemental, ...primary]) {
    const row = obj(item);
    const key = lower(
      row.channelType || row.channel_type || row.channelKey || row.channel_key
    );
    if (!key) continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    const existingConnected =
      existing.isConnected === true || existing.is_connected === true;
    const nextConnected =
      row.isConnected === true || row.is_connected === true;

    if (!existingConnected && nextConnected) {
      byKey.set(key, row);
      continue;
    }

    const existingPrimary =
      existing.isPrimary === true || existing.is_primary === true;
    const nextPrimary =
      row.isPrimary === true || row.is_primary === true;

    if (!existingPrimary && nextPrimary) {
      byKey.set(key, row);
    }
  }

  return Array.from(byKey.values());
}

function chooseSnapshotOrCanonical({
  snapshotEnabled = false,
  snapshotRows = [],
  canonicalRows = [],
  normalize = (x) => x,
} = {}) {
  const normalizedSnapshot = snapshotEnabled ? normalize(snapshotRows) : [];
  const normalizedCanonical = normalize(canonicalRows);

  if (!snapshotEnabled) return normalizedCanonical;

  // Critical rule:
  // if approved snapshot exists but is empty while canonical rows are present,
  // do NOT let the empty snapshot blind runtime.
  if (normalizedSnapshot.length > 0) return normalizedSnapshot;
  if (normalizedCanonical.length > 0) return normalizedCanonical;

  return normalizedSnapshot;
}

export async function resolveTenant(
  client,
  { tenantId = "", tenantKey = "" } = {}
) {
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
    businessChannelRows,
    operationalChannelRows,
    mediaRows,
    knowledgeRows,
    factsRows,
    channelPolicyRows,
    latestTruthVersion,
  ] = await Promise.all([
    one(client, `select * from tenant_business_profile where tenant_id = $1 limit 1`, [
      tenant.id,
    ]),
    one(
      client,
      `select * from tenant_business_capabilities where tenant_id = $1 limit 1`,
      [tenant.id]
    ),
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
    dbListTenantChannels(client, tenant.id),
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
        and approved_at is not null
      order by approved_at desc nulls last, created_at desc
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
        profile_snapshot_json: parseObject(
          latestTruthVersion.profile_snapshot_json
        ),
        capabilities_snapshot_json: parseObject(
          latestTruthVersion.capabilities_snapshot_json
        ),
        source_summary_json: parseObject(
          latestTruthVersion.source_summary_json
        ),
        field_provenance_json: parseObject(
          latestTruthVersion.field_provenance_json
        ),
        metadata_json: publishedTruthMetadata,
        has_services_snapshot:
          Object.prototype.hasOwnProperty.call(
            publishedTruthMetadata || {},
            "servicesSnapshot"
          ) ||
          Object.prototype.hasOwnProperty.call(
            publishedTruthMetadata || {},
            "services_snapshot_json"
          ),
        services_snapshot_json: Array.isArray(
          publishedTruthMetadata?.servicesSnapshot
        )
          ? publishedTruthMetadata.servicesSnapshot
          : Array.isArray(publishedTruthMetadata?.services_snapshot_json)
            ? publishedTruthMetadata.services_snapshot_json
            : [],
        has_contacts_snapshot:
          Object.prototype.hasOwnProperty.call(
            publishedTruthMetadata || {},
            "contactsSnapshot"
          ) ||
          Object.prototype.hasOwnProperty.call(
            publishedTruthMetadata || {},
            "contacts_snapshot_json"
          ),
        contacts_snapshot_json: Array.isArray(
          publishedTruthMetadata?.contactsSnapshot
        )
          ? publishedTruthMetadata.contactsSnapshot
          : Array.isArray(publishedTruthMetadata?.contacts_snapshot_json)
            ? publishedTruthMetadata.contacts_snapshot_json
            : [],
        has_locations_snapshot:
          Object.prototype.hasOwnProperty.call(
            publishedTruthMetadata || {},
            "locationsSnapshot"
          ) ||
          Object.prototype.hasOwnProperty.call(
            publishedTruthMetadata || {},
            "locations_snapshot_json"
          ),
        locations_snapshot_json: Array.isArray(
          publishedTruthMetadata?.locationsSnapshot
        )
          ? publishedTruthMetadata.locationsSnapshot
          : Array.isArray(publishedTruthMetadata?.locations_snapshot_json)
            ? publishedTruthMetadata.locations_snapshot_json
            : [],
        has_truth_facts_snapshot:
          Object.prototype.hasOwnProperty.call(
            publishedTruthMetadata || {},
            "truthFactsSnapshot"
          ) ||
          Object.prototype.hasOwnProperty.call(
            publishedTruthMetadata || {},
            "truth_facts_snapshot_json"
          ),
        truth_facts_snapshot_json: Array.isArray(
          publishedTruthMetadata?.truthFactsSnapshot
        )
          ? publishedTruthMetadata.truthFactsSnapshot
          : Array.isArray(publishedTruthMetadata?.truth_facts_snapshot_json)
            ? publishedTruthMetadata.truth_facts_snapshot_json
            : [],
      }
    : null;

  const operationalFacts = normalizeFacts(
    factsRows.filter((row) => {
      const meta = parseObject(row.meta);
      return (
        s(meta.factSurface || meta.fact_surface).toLowerCase() ===
        "runtime_retrieval"
      );
    })
  );

  const legacyFacts = normalizeFacts(
    factsRows.filter((row) => {
      const meta = parseObject(row.meta);
      return (
        s(meta.factSurface || meta.fact_surface).toLowerCase() !==
        "runtime_retrieval"
      );
    })
  );

  const publishedTruthFacts = chooseSnapshotOrCanonical({
    snapshotEnabled: publishedTruthVersion?.has_truth_facts_snapshot === true,
    snapshotRows: publishedTruthVersion?.truth_facts_snapshot_json || [],
    canonicalRows: legacyFacts,
    normalize: normalizeFacts,
  });

  const resolvedContacts = chooseSnapshotOrCanonical({
    snapshotEnabled: publishedTruthVersion?.has_contacts_snapshot === true,
    snapshotRows: publishedTruthVersion?.contacts_snapshot_json || [],
    canonicalRows: contactsRows,
    normalize: normalizeContacts,
  });

  const resolvedLocations = chooseSnapshotOrCanonical({
    snapshotEnabled: publishedTruthVersion?.has_locations_snapshot === true,
    snapshotRows: publishedTruthVersion?.locations_snapshot_json || [],
    canonicalRows: locationsRows,
    normalize: normalizeLocations,
  });

  const resolvedServices = chooseSnapshotOrCanonical({
    snapshotEnabled: publishedTruthVersion?.has_services_snapshot === true,
    snapshotRows: publishedTruthVersion?.services_snapshot_json || [],
    canonicalRows: servicesRows,
    normalize: normalizeServices,
  });

  const canonicalBusinessChannels = normalizeChannels(businessChannelRows);
  const operationalConnectivityChannels = normalizeChannels(
    operationalChannelsToProjectionRows(operationalChannelRows)
  );
  const mergedChannels = mergeProjectionChannels(
    canonicalBusinessChannels,
    operationalConnectivityChannels
  );

  return {
    tenant,
    profile,
    capabilities,
    synthesis,
    contacts: resolvedContacts,
    locations: resolvedLocations,
    hours: normalizeHours(hoursRows),
    services: resolvedServices,
    products: normalizeProducts(productsRows),
    faq: normalizeFaq(faqRows),
    policies: normalizePolicies(policiesRows),
    socialAccounts: normalizeSocialAccounts(socialRows),
    channels: mergedChannels,
    mediaAssets: normalizeMediaAssets(mediaRows),
    knowledge: normalizeKnowledge(knowledgeRows),
    facts: [...publishedTruthFacts, ...operationalFacts],
    publishedTruthFacts,
    operationalFacts,
    channelPolicies: normalizeChannelPolicies(channelPolicyRows),
    operationalChannelPolicies: normalizeChannelPolicies(channelPolicyRows),
    publishedTruthVersion,
  };
}