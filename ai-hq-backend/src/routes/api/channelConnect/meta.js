// src/routes/api/channelConnect/meta.js
// FINAL v2.0 — Meta connect + tenant_sources intelligence sync

import { cfg } from "../../../config.js";
import { createTenantSourcesHelpers } from "../../../db/helpers/tenantSources.js";
import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import {
  s,
  cleanNullable,
  signState,
  verifyState,
  buildRedirectUrl,
  metaGraphBase,
  fetchJson,
  getReqTenantKey,
  getReqActor,
} from "./utils.js";
import {
  getTenantByKey,
  saveMetaPageAccessToken,
  deleteMetaPageAccessToken,
  getMetaSecrets,
  upsertInstagramChannel,
  getPrimaryInstagramChannel,
  markInstagramDisconnected,
  auditSafe,
} from "./repository.js";

function buildInstagramSourcePayload(selected = {}) {
  const igUsername = s(selected?.igUsername);
  const pageId = s(selected?.pageId);
  const igUserId = s(selected?.igUserId);

  return {
    sourceType: "instagram",
    sourceKey: igUserId
      ? `instagram:${igUserId}`
      : pageId
      ? `instagram:page:${pageId}`
      : "instagram",
    displayName: igUsername
      ? `Instagram · @${igUsername}`
      : s(selected?.pageName) || "Instagram",
    status: "connected",
    authStatus: "authorized",
    syncStatus: "idle",
    connectionMode: "oauth",
    accessScope: "hybrid",
    sourceUrl: igUsername ? `https://instagram.com/${igUsername}` : "",
    externalAccountId: igUserId,
    externalPageId: pageId,
    externalUsername: cleanNullable(igUsername),
    isEnabled: true,
    isPrimary: true,
    permissionsJson: {
      allowProfileRead: true,
      allowFutureSync: true,
      allowBusinessInference: true,
      requireApprovalForCriticalFacts: true,
      allowBioIngestion: true,
      allowPublicContentSignals: true,
      allowChannelMetadata: true,
    },
    settingsJson: {
      syncProfile: true,
      syncPublicMetadata: true,
      syncBusinessContext: true,
      sourceRole: "primary_social_channel",
    },
    metadataJson: {
      provider: "meta",
      channel_type: "instagram",
      connected_via: "oauth",
      pageName: s(selected?.pageName),
      oauthScopes: [
        "pages_show_list",
        "instagram_basic",
        "instagram_manage_messages",
        "business_management",
      ],
    },
  };
}

async function syncInstagramSourceLayer({ db, tenant, actor, selected }) {
  const sources = createTenantSourcesHelpers({ db });
  const knowledge = createTenantKnowledgeHelpers({ db });

  const payload = buildInstagramSourcePayload(selected);

  const source = await sources.connectOrUpdateSource({
    tenantId: tenant.id,
    tenantKey: tenant.tenant_key,
    ...payload,
    createdBy: actor || "system",
    updatedBy: actor || "system",
  });

  await knowledge.refreshChannelCapabilitiesFromSources({
    tenantId: tenant.id,
    tenantKey: tenant.tenant_key,
    approvedBy: actor || "system",
  });

  return source;
}

async function markInstagramSourceDisconnected({ db, tenant, actor }) {
  const sources = createTenantSourcesHelpers({ db });
  const knowledge = createTenantKnowledgeHelpers({ db });

  const existing = await sources.listSources({
    tenantId: tenant.id,
    tenantKey: tenant.tenant_key,
    sourceType: "instagram",
    limit: 20,
    offset: 0,
  });

  for (const item of existing) {
    await sources.markSourceDisconnected(item.id, {
      status: "disconnected",
      authStatus: "revoked",
      syncStatus: "idle",
      updatedBy: actor || "system",
    });
  }

  await knowledge.refreshChannelCapabilitiesFromSources({
    tenantId: tenant.id,
    tenantKey: tenant.tenant_key,
    approvedBy: actor || "system",
  });
}

export async function exchangeCodeForUserToken(code) {
  const url = new URL("https://graph.facebook.com/oauth/access_token");
  url.searchParams.set("client_id", s(cfg.meta.appId));
  url.searchParams.set("client_secret", s(cfg.meta.appSecret));
  url.searchParams.set("redirect_uri", s(cfg.meta.redirectUri));
  url.searchParams.set("code", s(code));
  return fetchJson(url.toString());
}

export async function getPagesForUserToken(userAccessToken) {
  const url = new URL(`${metaGraphBase()}/me/accounts`);
  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id,username},connected_instagram_account{id,username}"
  );
  url.searchParams.set("access_token", s(userAccessToken));

  const json = await fetchJson(url.toString());
  return Array.isArray(json?.data) ? json.data : [];
}

export function pickBestInstagramPage(pages = []) {
  for (const page of pages) {
    const ig =
      page?.instagram_business_account ||
      page?.connected_instagram_account ||
      null;

    if (page?.id && ig?.id && page?.access_token) {
      return {
        pageId: s(page.id),
        pageName: s(page.name),
        pageAccessToken: s(page.access_token),
        igUserId: s(ig.id),
        igUsername: s(ig.username),
      };
    }
  }

  return null;
}

export async function buildMetaOAuthUrl({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    const err = new Error("Missing tenant context");
    err.status = 401;
    throw err;
  }

  if (
    !s(cfg.meta.appId) ||
    !s(cfg.meta.appSecret) ||
    !s(cfg.meta.redirectUri)
  ) {
    const err = new Error("Meta OAuth env missing");
    err.status = 400;
    throw err;
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    const err = new Error("Tenant not found");
    err.status = 400;
    throw err;
  }

  const state = signState({
    tenantKey,
    actor: getReqActor(req),
    exp: Date.now() + 10 * 60 * 1000,
  });

  const url = new URL("https://www.facebook.com/v23.0/dialog/oauth");
  url.searchParams.set("client_id", s(cfg.meta.appId));
  url.searchParams.set("redirect_uri", s(cfg.meta.redirectUri));
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    [
      "pages_show_list",
      "instagram_basic",
      "instagram_manage_messages",
      "business_management",
    ].join(",")
  );

  return url.toString();
}

export async function handleMetaCallback({ db, req }) {
  const code = s(req.query.code);
  const error = s(req.query.error);
  const errorCode = s(req.query.error_code);
  const errorMessage = s(req.query.error_message);
  const stateRaw = s(req.query.state);

  if (error || errorCode || errorMessage) {
    return {
      type: "redirect_or_error",
      redirectUrl: buildRedirectUrl({
        section: "channels",
        meta_error: errorMessage || error || "Meta connect failed",
      }),
      error: errorMessage || error || "Meta connect failed",
    };
  }

  const state = verifyState(stateRaw);
  if (!state?.tenantKey) {
    const err = new Error("Invalid connect state");
    err.status = 400;
    throw err;
  }

  if (!code) {
    const err = new Error("Missing code");
    err.status = 400;
    throw err;
  }

  const tenant = await getTenantByKey(db, state.tenantKey);
  if (!tenant?.id) {
    const err = new Error("Tenant not found");
    err.status = 400;
    throw err;
  }

  const tokenJson = await exchangeCodeForUserToken(code);
  const userAccessToken = s(tokenJson?.access_token);
  if (!userAccessToken) {
    throw new Error("Meta user access token missing");
  }

  const pages = await getPagesForUserToken(userAccessToken);
  const selected = pickBestInstagramPage(pages);

  if (
    !selected?.pageAccessToken ||
    !selected?.pageId ||
    !selected?.igUserId
  ) {
    throw new Error(
      "No Instagram Business page found on connected Meta account"
    );
  }

  await saveMetaPageAccessToken(
    db,
    tenant.id,
    selected.pageAccessToken,
    state.actor || "system"
  );

  await upsertInstagramChannel(db, tenant.id, {
    provider: "meta",
    display_name: selected.igUsername
      ? `Instagram · @${selected.igUsername}`
      : selected.pageName || "Instagram",
    external_page_id: selected.pageId,
    external_user_id: selected.igUserId,
    external_username: cleanNullable(selected.igUsername),
    status: "connected",
    is_primary: true,
    config: {
      connected_via: "oauth",
    },
    secrets_ref: "meta",
    health: {
      oauth_connected: true,
    },
    last_sync_at: new Date().toISOString(),
  });

  const source = await syncInstagramSourceLayer({
    db,
    tenant,
    actor: state.actor || "system",
    selected,
  });

  await auditSafe(
    db,
    state.actor || "system",
    tenant,
    "settings.channel.meta.connected",
    "tenant_channel",
    "instagram",
    {
      pageId: selected.pageId,
      igUserId: selected.igUserId,
      igUsername: selected.igUsername || null,
      sourceId: source?.id || null,
      sourceKey: source?.source_key || null,
    }
  );

  return {
    type: "success",
    redirectUrl: buildRedirectUrl({
      section: "channels",
      meta_connected: "1",
      channel: "instagram",
    }),
    payload: {
      connected: true,
      channel: "instagram",
      pageId: selected.pageId,
      igUserId: selected.igUserId,
      igUsername: selected.igUsername || null,
      sourceId: source?.id || null,
      sourceKey: source?.source_key || null,
    },
  };
}

export async function getMetaStatus({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    const err = new Error("Missing tenant context");
    err.status = 401;
    throw err;
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    const err = new Error("Tenant not found");
    err.status = 400;
    throw err;
  }

  const channel = await getPrimaryInstagramChannel(db, tenant.id);
  const secrets = await getMetaSecrets(db, tenant.id);
  const hasToken = Boolean(s(secrets?.page_access_token));

  return {
    connected:
      Boolean(channel) &&
      s(channel?.status).toLowerCase() === "connected" &&
      hasToken,
    channel: channel
      ? {
          id: channel.id,
          channel_type: channel.channel_type,
          provider: channel.provider,
          display_name: channel.display_name,
          external_page_id: channel.external_page_id,
          external_user_id: channel.external_user_id,
          external_username: channel.external_username,
          status: channel.status,
          is_primary: channel.is_primary,
          last_sync_at: channel.last_sync_at,
        }
      : null,
    hasToken,
  };
}

export async function disconnectMeta({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    const err = new Error("Missing tenant context");
    err.status = 401;
    throw err;
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    const err = new Error("Tenant not found");
    err.status = 400;
    throw err;
  }

  const actor = getReqActor(req);

  await deleteMetaPageAccessToken(db, tenant.id);
  await markInstagramDisconnected(db, tenant.id);

  await markInstagramSourceDisconnected({
    db,
    tenant,
    actor,
  });

  await auditSafe(
    db,
    actor,
    tenant,
    "settings.channel.meta.disconnected",
    "tenant_channel",
    "instagram"
  );

  return {
    disconnected: true,
    channel: "instagram",
  };
}