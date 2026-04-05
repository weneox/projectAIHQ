import crypto from "crypto";

import { cfg } from "../../../config.js";
import { createTenantSourcesHelpers } from "../../../db/helpers/tenantSources.js";
import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import {
  buildOperationalRepairGuidance,
  buildReadinessSurface,
} from "../../../services/operationalReadiness.js";
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
  saveMetaSecretValue,
  deleteMetaSecretKeys,
  getMetaSecrets,
  upsertInstagramChannel,
  getPrimaryInstagramChannel,
  markInstagramDisconnected,
  auditSafe,
} from "./repository.js";
import { getTenantCapability } from "../../../services/tenantEntitlements.js";

export const META_DM_LAUNCH_SCOPES = Object.freeze([
  "pages_show_list",
  "instagram_basic",
  "instagram_manage_messages",
]);

export const META_DM_EXCLUDED_SCOPES = Object.freeze([
  "business_management",
  "instagram_manage_comments",
  "instagram_content_publish",
]);

export const META_PHASE_TWO_CAPABILITIES = Object.freeze([
  "comments",
  "content_publish",
]);

export const META_CONNECT_SELECTION_SECRET_KEY = "connect_selection_pending";
export const META_CONNECT_SELECTION_KIND = "meta_connect_selection";
export const META_CONNECT_SELECTION_TTL_MS = 15 * 60 * 1000;
export const META_USER_TOKEN_EXPIRING_SOON_MS = 10 * 60 * 1000;

export const META_DM_LAUNCH_REVIEW_STORY =
  "Businesses connect their own Instagram Business / Professional account and the platform helps them manage inbound customer conversations using tenant-specific business settings and runtime.";

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((value) => s(value)).filter(Boolean))];
}

function asIsoIfPresent(value) {
  const text = s(value);
  return text || null;
}

function asTimestamp(value) {
  const text = s(value);
  if (!text) return 0;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJsonObject(value) {
  const text = s(value);
  if (!text) return {};

  try {
    return obj(JSON.parse(text));
  } catch {
    return {};
  }
}

function buildConnectedInstagramDisplayName(selected = {}) {
  const username = s(selected?.igUsername);
  if (username) return `Instagram @${username}`;
  return s(selected?.pageName) || "Instagram";
}

function buildSelectionCandidateId(candidate = {}) {
  return s(candidate?.pageId || candidate?.igUserId);
}

function normalizeSelectionCandidate(candidate = {}) {
  const pageId = s(candidate?.pageId);
  const igUserId = s(candidate?.igUserId);
  const pageAccessToken = s(candidate?.pageAccessToken);

  if (!pageId || !igUserId || !pageAccessToken) {
    return null;
  }

  const pageName = s(candidate?.pageName);
  const igUsername = s(candidate?.igUsername);

  return {
    id: buildSelectionCandidateId({ pageId, igUserId }),
    pageId,
    pageName,
    pageAccessToken,
    igUserId,
    igUsername,
    displayName: buildConnectedInstagramDisplayName({
      pageName,
      igUsername,
    }),
  };
}

function buildPendingMetaSelectionPayload({
  actor = "system",
  createdAt = new Date().toISOString(),
  expiresAt = new Date(Date.now() + META_CONNECT_SELECTION_TTL_MS).toISOString(),
  metaUserProfile = {},
  tokenJson = {},
  requestedScopes = META_DM_LAUNCH_SCOPES,
  grantedScopes = META_DM_LAUNCH_SCOPES,
  candidates = [],
} = {}) {
  const normalizedCandidates = arr(candidates)
    .map((candidate) => normalizeSelectionCandidate(candidate))
    .filter(Boolean);

  if (!normalizedCandidates.length) {
    return null;
  }

  return {
    selectionId: crypto.randomUUID(),
    actor: s(actor || "system"),
    createdAt,
    expiresAt,
    metaUserId: s(metaUserProfile?.id),
    metaUserName: s(metaUserProfile?.name),
    tokenType: s(tokenJson?.token_type),
    userTokenExpiresAt: buildUserTokenExpiresAt(tokenJson),
    requestedScopes: buildRequestedScopeList(requestedScopes),
    grantedScopes: buildRequestedScopeList(grantedScopes),
    candidates: normalizedCandidates,
  };
}

export function readPendingMetaSelection(secrets = {}) {
  const parsed = parseJsonObject(secrets?.[META_CONNECT_SELECTION_SECRET_KEY]);
  const selectionId = s(parsed.selectionId);
  const candidates = arr(parsed.candidates)
    .map((candidate) => normalizeSelectionCandidate(candidate))
    .filter(Boolean);

  if (!selectionId || !candidates.length) {
    return null;
  }

  return {
    selectionId,
    actor: s(parsed.actor || "system"),
    createdAt: asIsoIfPresent(parsed.createdAt),
    expiresAt: asIsoIfPresent(parsed.expiresAt),
    metaUserId: s(parsed.metaUserId),
    metaUserName: s(parsed.metaUserName),
    tokenType: s(parsed.tokenType),
    userTokenExpiresAt: asIsoIfPresent(parsed.userTokenExpiresAt),
    requestedScopes: buildRequestedScopeList(parsed.requestedScopes),
    grantedScopes: buildRequestedScopeList(parsed.grantedScopes),
    candidates,
  };
}

function hasPendingMetaSelectionExpired(pendingSelection = {}) {
  const expiresAtMs = asTimestamp(pendingSelection?.expiresAt);
  return Boolean(expiresAtMs && expiresAtMs <= Date.now());
}

function buildPendingMetaSelectionView({
  pendingSelection = null,
  tenantKey = "",
} = {}) {
  if (!pendingSelection?.selectionId) return null;

  const expiryMs = asTimestamp(pendingSelection.expiresAt);
  const tokenExp = expiryMs
    ? Math.min(expiryMs, Date.now() + 10 * 60 * 1000)
    : Date.now() + 10 * 60 * 1000;

  return {
    required: true,
    selectionId: pendingSelection.selectionId,
    createdAt: cleanNullable(pendingSelection.createdAt),
    expiresAt: cleanNullable(pendingSelection.expiresAt),
    candidateCount: arr(pendingSelection.candidates).length,
    metaUserId: cleanNullable(pendingSelection.metaUserId),
    metaUserName: cleanNullable(pendingSelection.metaUserName),
    requestedScopes: pendingSelection.requestedScopes,
    grantedScopes: pendingSelection.grantedScopes,
    selectionToken: signState({
      kind: META_CONNECT_SELECTION_KIND,
      tenantKey,
      selectionId: pendingSelection.selectionId,
      exp: tokenExp,
    }),
    candidates: arr(pendingSelection.candidates).map((candidate) => ({
      id: candidate.id,
      displayName: candidate.displayName,
      pageId: candidate.pageId,
      pageName: candidate.pageName,
      igUserId: candidate.igUserId,
      igUsername: candidate.igUsername || null,
    })),
  };
}

function verifyPendingMetaSelectionToken(raw = "", tenantKey = "") {
  const checked = verifyState(raw);
  if (!checked || s(checked.kind) !== META_CONNECT_SELECTION_KIND) {
    return null;
  }

  if (s(checked.tenantKey).toLowerCase() !== s(tenantKey).toLowerCase()) {
    return null;
  }

  if (!s(checked.selectionId)) {
    return null;
  }

  return checked;
}

function findSelectionCandidate(pendingSelection = {}, candidateId = "") {
  const safeCandidateId = s(candidateId);
  if (!safeCandidateId) return null;

  return (
    arr(pendingSelection?.candidates).find(
      (candidate) => s(candidate.id) === safeCandidateId
    ) || null
  );
}

function hasMetaOauthEnv() {
  return Boolean(
    s(cfg?.meta?.appId) && s(cfg?.meta?.appSecret) && s(cfg?.meta?.redirectUri)
  );
}

function hasMetaGatewayEnv() {
  return Boolean(
    s(cfg?.gateway?.metaGatewayBaseUrl) &&
      s(cfg?.gateway?.metaGatewayInternalToken)
  );
}

function buildRequestedScopeList(values = []) {
  const requested = uniqStrings(values);
  return requested.length ? requested : [...META_DM_LAUNCH_SCOPES];
}

function buildUserTokenExpiresAt(tokenJson = {}) {
  const explicit = asIsoIfPresent(
    tokenJson?.userTokenExpiresAt || tokenJson?.user_token_expires_at
  );
  if (explicit) return explicit;

  const expiresIn = Number(tokenJson?.expires_in || 0);
  return Number.isFinite(expiresIn) && expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;
}

function readMetaChannelSnapshot(channel = {}) {
  const config = obj(channel?.config);
  const health = obj(channel?.health);

  return {
    displayName: s(
      channel?.display_name || config.last_connected_display_name || "Instagram"
    ),
    pageName: s(config.last_connected_page_name),
    igUsername: s(channel?.external_username || config.last_connected_username),
    lastKnownPageId: s(
      channel?.external_page_id || config.last_known_page_id || config.page_id
    ),
    lastKnownIgUserId: s(
      channel?.external_user_id || config.last_known_ig_user_id || config.ig_user_id
    ),
    metaUserId: s(config.meta_user_id || health.meta_user_id),
    metaUserName: s(config.meta_user_name),
    requestedScopes: buildRequestedScopeList(config.requested_scopes),
    grantedScopes: buildRequestedScopeList(
      arr(config.granted_scopes).length ? config.granted_scopes : config.requested_scopes
    ),
    excludedScopes: uniqStrings(
      arr(config.excluded_scopes).length
        ? config.excluded_scopes
        : META_DM_EXCLUDED_SCOPES
    ),
    phaseTwoCapabilities: uniqStrings(
      arr(config.phase_two_capabilities).length
        ? config.phase_two_capabilities
        : META_PHASE_TWO_CAPABILITIES
    ),
    reviewStory: s(config.review_story || META_DM_LAUNCH_REVIEW_STORY),
    launchSurface: s(config.launch_surface || "instagram_direct_messages"),
    lastOauthExchangeAt: s(health.last_oauth_exchange_at),
    userTokenExpiresAt: s(health.user_token_expires_at),
    tokenType: s(health.token_type),
    deauthorizedAt: s(health.deauthorized_at),
    disconnectedAt: s(health.disconnected_at),
    disconnectReason: s(health.disconnect_reason || config.disconnect_reason),
    manualReconnectRequired: health.manual_reconnect_required === true,
    connectionState: s(health.connection_state),
    authStatus: s(health.auth_status),
  };
}

function buildConnectedChannelConfig({
  selected = {},
  requestedScopes = META_DM_LAUNCH_SCOPES,
  grantedScopes = META_DM_LAUNCH_SCOPES,
  metaUserProfile = {},
  connectedAt = new Date().toISOString(),
} = {}) {
  return {
    connected_via: "oauth",
    auth_model: "instagram_dm_page_access",
    meta_user_id: cleanNullable(metaUserProfile?.id),
    meta_user_name: cleanNullable(metaUserProfile?.name),
    requested_scopes: buildRequestedScopeList(requestedScopes),
    granted_scopes: buildRequestedScopeList(grantedScopes),
    excluded_scopes: [...META_DM_EXCLUDED_SCOPES],
    phase_two_capabilities: [...META_PHASE_TWO_CAPABILITIES],
    review_story: META_DM_LAUNCH_REVIEW_STORY,
    launch_surface: "instagram_direct_messages",
    last_connected_display_name: cleanNullable(
      buildConnectedInstagramDisplayName(selected)
    ),
    last_connected_page_name: cleanNullable(selected?.pageName),
    last_connected_username: cleanNullable(selected?.igUsername),
    last_known_page_id: cleanNullable(selected?.pageId),
    last_known_ig_user_id: cleanNullable(selected?.igUserId),
    manual_reconnect_mode: "oauth",
    last_connected_at: connectedAt,
  };
}

function buildConnectedChannelHealth({
  tokenJson = {},
  metaUserProfile = {},
  connectedAt = new Date().toISOString(),
} = {}) {
  const userTokenExpiresAt = buildUserTokenExpiresAt(tokenJson);

  return {
    oauth_connected: true,
    connection_state: "connected",
    auth_status: "authorized",
    last_oauth_exchange_at: connectedAt,
    user_token_expires_at: userTokenExpiresAt,
    token_type: cleanNullable(tokenJson?.token_type),
    reason_code: null,
    deauthorized_at: null,
    disconnected_at: null,
    disconnect_reason: null,
    manual_reconnect_required: false,
    meta_user_id: cleanNullable(metaUserProfile?.id),
    oauth_env_ready: hasMetaOauthEnv(),
    gateway_ready: hasMetaGatewayEnv(),
  };
}

export function buildInstagramLifecycleChannelPayload({
  channel = {},
  transition = "disconnected",
  reasonCode = "",
  occurredAt = new Date().toISOString(),
} = {}) {
  const snapshot = readMetaChannelSnapshot(channel);
  const state = lower(transition, "disconnected");
  const disconnectReason = s(reasonCode || transition);
  const isDeauthorized = state === "deauthorized";
  const needsReconnect = isDeauthorized || state === "reconnect_required";

  return {
    provider: "meta",
    display_name: snapshot.displayName || "Instagram",
    external_account_id: null,
    external_page_id: null,
    external_user_id: null,
    external_username: null,
    status: needsReconnect ? "error" : "disconnected",
    is_primary: channel?.is_primary !== false,
    config: {
      connected_via: "oauth",
      auth_model: "instagram_dm_page_access",
      meta_user_id: cleanNullable(snapshot.metaUserId),
      meta_user_name: cleanNullable(snapshot.metaUserName),
      requested_scopes: snapshot.requestedScopes,
      granted_scopes: snapshot.grantedScopes,
      excluded_scopes: snapshot.excludedScopes,
      phase_two_capabilities: snapshot.phaseTwoCapabilities,
      review_story: snapshot.reviewStory || META_DM_LAUNCH_REVIEW_STORY,
      launch_surface: snapshot.launchSurface || "instagram_direct_messages",
      last_connected_display_name: cleanNullable(snapshot.displayName || "Instagram"),
      last_connected_page_name: cleanNullable(snapshot.pageName),
      last_connected_username: cleanNullable(snapshot.igUsername),
      last_known_page_id: cleanNullable(snapshot.lastKnownPageId),
      last_known_ig_user_id: cleanNullable(snapshot.lastKnownIgUserId),
      manual_reconnect_mode: "oauth",
      disconnect_reason: disconnectReason,
    },
    secrets_ref: null,
    health: {
      oauth_connected: false,
      connection_state: state,
      auth_status: isDeauthorized
        ? "revoked"
        : needsReconnect
        ? "reconnect_required"
        : "disconnected",
      last_oauth_exchange_at: asIsoIfPresent(snapshot.lastOauthExchangeAt),
      user_token_expires_at: asIsoIfPresent(snapshot.userTokenExpiresAt),
      token_type: cleanNullable(snapshot.tokenType),
      reason_code: cleanNullable(disconnectReason),
      deauthorized_at: isDeauthorized
        ? occurredAt
        : asIsoIfPresent(snapshot.deauthorizedAt),
      disconnected_at: occurredAt,
      disconnect_reason: disconnectReason,
      manual_reconnect_required: needsReconnect,
      meta_user_id: cleanNullable(snapshot.metaUserId),
      oauth_env_ready: hasMetaOauthEnv(),
      gateway_ready: hasMetaGatewayEnv(),
    },
    last_sync_at: null,
  };
}

function buildInstagramSourcePayload(
  selected = {},
  { oauthScopes = META_DM_LAUNCH_SCOPES } = {}
) {
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
    displayName: buildConnectedInstagramDisplayName(selected),
    status: "connected",
    authStatus: "authorized",
    syncStatus: "idle",
    connectionMode: "oauth",
    accessScope: "instagram_dm_page_access",
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
      launchMode: "dm_first",
    },
    metadataJson: {
      provider: "meta",
      channel_type: "instagram",
      connected_via: "oauth",
      authModel: "instagram_dm_page_access",
      launchSurface: "instagram_direct_messages",
      reviewStory: META_DM_LAUNCH_REVIEW_STORY,
      excludedScopes: [...META_DM_EXCLUDED_SCOPES],
      phaseTwoCapabilities: [...META_PHASE_TWO_CAPABILITIES],
      pageName: s(selected?.pageName),
      oauthScopes: buildRequestedScopeList(oauthScopes),
    },
  };
}

async function syncInstagramSourceLayer({
  db,
  tenant,
  actor,
  selected,
  oauthScopes = META_DM_LAUNCH_SCOPES,
}) {
  const sources = createTenantSourcesHelpers({ db });
  const knowledge = createTenantKnowledgeHelpers({ db });

  const payload = buildInstagramSourcePayload(selected, { oauthScopes });

  const source = await sources.connectOrUpdateSource({
    tenantId: tenant.id,
    tenantKey: tenant.tenant_key,
    ...payload,
    createdBy: actor || "system",
    updatedBy: actor || "system",
  });

  const capabilityGovernance = await knowledge.refreshChannelCapabilitiesFromSources({
    tenantId: tenant.id,
    tenantKey: tenant.tenant_key,
    approvedBy: actor || "system",
  });

  return {
    source,
    capabilityGovernance,
  };
}

export async function markInstagramSourceDisconnected({
  db,
  tenant,
  actor,
  authStatus = "revoked",
} = {}) {
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
      authStatus,
      syncStatus: "idle",
      updatedBy: actor || "system",
    });
  }

  return await knowledge.refreshChannelCapabilitiesFromSources({
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

export async function getMetaUserProfile(userAccessToken) {
  const url = new URL(`${metaGraphBase()}/me`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", s(userAccessToken));

  const json = await fetchJson(url.toString());
  return {
    id: s(json?.id),
    name: s(json?.name),
  };
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

export function listInstagramPageCandidates(pages = []) {
  return arr(pages)
    .map((page) => {
      const ig =
        page?.instagram_business_account ||
        page?.connected_instagram_account ||
        null;

      if (!page?.id || !ig?.id || !page?.access_token) return null;

      return {
        pageId: s(page.id),
        pageName: s(page.name),
        pageAccessToken: s(page.access_token),
        igUserId: s(ig.id),
        igUsername: s(ig.username),
      };
    })
    .filter(Boolean);
}

function buildMetaReviewPayload() {
  return {
    authModel: "instagram_dm_page_access",
    launchMode: "dm_first",
    launchSurface: "instagram_direct_messages",
    requestedScopes: [...META_DM_LAUNCH_SCOPES],
    excludedScopes: [...META_DM_EXCLUDED_SCOPES],
    phaseTwoCapabilities: [...META_PHASE_TWO_CAPABILITIES],
    story: META_DM_LAUNCH_REVIEW_STORY,
  };
}

function buildMetaConnectSuccessPayload({
  selected = {},
  metaUserProfile = {},
  source = null,
  capabilityGovernance = null,
} = {}) {
  return {
    connected: true,
    channel: "instagram",
    pageId: selected.pageId,
    igUserId: selected.igUserId,
    igUsername: selected.igUsername || null,
    metaUserId: metaUserProfile.id || null,
    review: buildMetaReviewPayload(),
    sourceId: source?.id || null,
    sourceKey: source?.source_key || null,
    capabilityGovernance,
  };
}

async function savePendingMetaSelection(
  db,
  tenantId,
  pendingSelection,
  actor = "system"
) {
  if (!pendingSelection?.selectionId) return null;

  return saveMetaSecretValue(
    db,
    tenantId,
    META_CONNECT_SELECTION_SECRET_KEY,
    JSON.stringify(pendingSelection),
    actor
  );
}

async function loadMetaSecretsContext(db, tenantId) {
  const secrets = await getMetaSecrets(db, tenantId);
  let pendingSelection = readPendingMetaSelection(secrets);
  let pendingSelectionExpired = false;

  if (pendingSelection && hasPendingMetaSelectionExpired(pendingSelection)) {
    await deleteMetaSecretKeys(db, tenantId, [META_CONNECT_SELECTION_SECRET_KEY]);
    delete secrets[META_CONNECT_SELECTION_SECRET_KEY];
    pendingSelection = null;
    pendingSelectionExpired = true;
  }

  return {
    secrets,
    pendingSelection,
    pendingSelectionExpired,
  };
}

function buildMetaUserTokenLifecycle(expiresAt = "") {
  const normalizedExpiresAt = asIsoIfPresent(expiresAt);
  const expiresAtMs = asTimestamp(normalizedExpiresAt);

  if (!normalizedExpiresAt || !expiresAtMs) {
    return {
      known: false,
      status: "unknown",
      expiresAt: null,
      expired: false,
      expiresSoon: false,
      reconnectRecommended: false,
    };
  }

  const remainingMs = expiresAtMs - Date.now();
  const expired = remainingMs <= 0;
  const expiresSoon =
    !expired && remainingMs <= META_USER_TOKEN_EXPIRING_SOON_MS;

  return {
    known: true,
    status: expired ? "expired" : expiresSoon ? "expiring_soon" : "valid",
    expiresAt: normalizedExpiresAt,
    expired,
    expiresSoon,
    reconnectRecommended: expired || expiresSoon,
  };
}

async function connectInstagramChannel({
  db,
  tenant,
  actor = "system",
  selected = {},
  metaUserProfile = {},
  tokenJson = {},
  requestedScopes = META_DM_LAUNCH_SCOPES,
  grantedScopes = META_DM_LAUNCH_SCOPES,
  syncInstagramSourceLayerFn = syncInstagramSourceLayer,
} = {}) {
  const connectedAt = new Date().toISOString();

  await deleteMetaSecretKeys(db, tenant.id, [META_CONNECT_SELECTION_SECRET_KEY]);
  await saveMetaPageAccessToken(
    db,
    tenant.id,
    selected.pageAccessToken,
    actor || "system"
  );

  await upsertInstagramChannel(db, tenant.id, {
    provider: "meta",
    display_name: buildConnectedInstagramDisplayName(selected),
    external_page_id: selected.pageId,
    external_user_id: selected.igUserId,
    external_username: cleanNullable(selected.igUsername),
    status: "connected",
    is_primary: true,
    config: buildConnectedChannelConfig({
      selected,
      requestedScopes,
      grantedScopes,
      metaUserProfile,
      connectedAt,
    }),
    secrets_ref: "meta",
    health: buildConnectedChannelHealth({
      tokenJson,
      metaUserProfile,
      connectedAt,
    }),
    last_sync_at: connectedAt,
  });

  const syncResult = await syncInstagramSourceLayerFn({
    db,
    tenant,
    actor,
    selected,
    oauthScopes: requestedScopes,
  });
  const source = syncResult?.source || null;
  const capabilityGovernance = syncResult?.capabilityGovernance || null;
  const payload = buildMetaConnectSuccessPayload({
    selected,
    metaUserProfile,
    source,
    capabilityGovernance,
  });

  await auditSafe(
    db,
    actor,
    tenant,
    "settings.channel.meta.connected",
    "tenant_channel",
    "instagram",
    {
      pageId: selected.pageId,
      igUserId: selected.igUserId,
      igUsername: selected.igUsername || null,
      metaUserId: metaUserProfile.id || null,
      scopeModel: "instagram_dm_page_access",
      requestedScopes: buildRequestedScopeList(requestedScopes),
      grantedScopes: buildRequestedScopeList(grantedScopes),
      phaseTwoCapabilities: [...META_PHASE_TWO_CAPABILITIES],
      sourceId: source?.id || null,
      sourceKey: source?.source_key || null,
      capabilityGovernance: {
        publishStatus: s(capabilityGovernance?.publishStatus),
        reviewRequired: !!capabilityGovernance?.reviewRequired,
        maintenanceSessionId: s(capabilityGovernance?.maintenanceSession?.id),
        blockedReason: s(capabilityGovernance?.blockedReason),
      },
    }
  );

  return {
    source,
    capabilityGovernance,
    payload,
  };
}

function buildMetaStatusBlockers({
  state = "",
  reasonCode = "",
  channel = null,
  hasToken = false,
  oauthEnvReady = false,
  gatewayReady = false,
  capability = {},
  pendingSelection = null,
} = {}) {
  const blockers = [];
  const hasIds = Boolean(
    s(channel?.external_page_id) || s(channel?.external_user_id)
  );

  if (pendingSelection?.required) {
    blockers.push({
      title: "Choose which Instagram Business account to bind to this tenant.",
      subtitle: `Meta returned ${pendingSelection.candidateCount} eligible Instagram Business / Professional asset${pendingSelection.candidateCount === 1 ? "" : "s"}. The tenant remains unbound until one account is explicitly selected.`,
      reasonCode: "instagram_account_selection_required",
      candidateCount: pendingSelection.candidateCount,
      expiresAt: pendingSelection.expiresAt,
    });
  }

  if (state === "blocked" && reasonCode === "plan_capability_restricted") {
    blockers.push({
      title: "Self-serve Instagram connect is unavailable on this plan.",
      subtitle: s(
        capability?.message ||
          "Upgrade the tenant plan before starting a new Instagram connection."
      ),
      reasonCode,
    });
  }

  if (
    (state === "blocked" || state === "reconnect_required") &&
    reasonCode === "meta_oauth_env_missing"
  ) {
    blockers.push({
      title: "Meta OAuth is not configured.",
      subtitle:
        "META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI must all be configured before connect or reconnect can start.",
      reasonCode,
      envKeys: ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"],
    });
  }

  if (
    reasonCode === "channel_not_connected" ||
    reasonCode === "channel_identifiers_missing" ||
    reasonCode === "provider_secret_missing"
  ) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode,
        viewerRole: "admin",
        missingFields: [
          !channel ? "tenant_channels" : "",
          channel && !hasIds ? "external_page_id_or_external_user_id" : "",
          channel && !hasToken ? "page_access_token" : "",
        ].filter(Boolean),
        title: "Instagram DM connection blocker",
        subtitle:
          "Instagram DM automation stays fail-closed until the tenant channel, operational identifiers, and page access token are aligned.",
        target: {
          section: "channels",
          channelType: "instagram",
          provider: "meta",
        },
      })
    );
  }

  if (state === "deauthorized") {
    blockers.push({
      title: "Meta revoked the app connection for this tenant.",
      subtitle:
        "Reconnect the tenant's Instagram Business account before inbound or outbound DM automation can resume.",
      reasonCode: reasonCode || "meta_app_deauthorized",
    });
  }

  if (state === "disconnected") {
    blockers.push({
      title: "Instagram is disconnected for this tenant.",
      subtitle:
        "Reconnect the tenant's Instagram Business account before DM automation can resume.",
      reasonCode: reasonCode || "user_disconnect",
    });
  }

  if (
    state === "reconnect_required" &&
    !blockers.some(
      (item) =>
        s(item?.reasonCode) === "channel_identifiers_missing" ||
        s(item?.reasonCode) === "provider_secret_missing" ||
        s(item?.reasonCode) === "meta_oauth_env_missing"
    )
  ) {
    blockers.push({
      title: "Instagram reconnect is required for this tenant.",
      subtitle:
        "The tenant mapping still exists, but the DM-first launch path needs an explicit reconnect before this connection should be trusted again.",
      reasonCode: reasonCode || "channel_reconnect_required",
    });
  }

  if (state === "connected" && !gatewayReady) {
    blockers.push({
      title: "Meta gateway delivery is not configured.",
      subtitle:
        "META_GATEWAY_BASE_URL and META_GATEWAY_INTERNAL_TOKEN must be configured before AI replies can be delivered.",
      reasonCode: "meta_gateway_env_missing",
      envKeys: ["META_GATEWAY_BASE_URL", "META_GATEWAY_INTERNAL_TOKEN"],
    });
  }

  if (
    state === "connected" &&
    !oauthEnvReady &&
    !blockers.some((item) => item.reasonCode === "meta_oauth_env_missing")
  ) {
    blockers.push({
      title: "Reconnect is currently unavailable.",
      subtitle:
        "The current tenant channel is connected, but META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI are required before a future reconnect can start.",
      reasonCode: "meta_oauth_env_missing",
      envKeys: ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"],
    });
  }

  return blockers.filter(Boolean);
}

function buildMetaStatusAttentionItems({ state = "", userToken = {} } = {}) {
  if (state !== "connected") return [];

  if (userToken?.status === "expired") {
    return [
      {
        title: "The stored Meta user token has expired.",
        subtitle:
          "Current page-backed DM delivery can remain live, but this launch path does not auto-refresh user tokens. Reconnect this tenant to renew the operator-granted auth context.",
        reasonCode: "user_token_expired",
        expiresAt: cleanNullable(userToken?.expiresAt),
      },
    ];
  }

  if (userToken?.status === "expiring_soon") {
    return [
      {
        title: "The stored Meta user token will expire soon.",
        subtitle:
          "This launch path does not auto-refresh user tokens. Reconnect this tenant soon so recovery stays explicit and operator-initiated.",
        reasonCode: "user_token_expiring_soon",
        expiresAt: cleanNullable(userToken?.expiresAt),
      },
    ];
  }

  return [];
}

function buildMetaReadyMessage({
  selectionRequired = false,
  blockers = [],
  attentionItems = [],
} = {}) {
  if (selectionRequired) {
    return "Instagram connect is waiting for an explicit account selection before this tenant can be bound.";
  }

  if (blockers.length) {
    return "Instagram DM automation is blocked until the tenant connection and runtime prerequisites are repaired.";
  }

  if (attentionItems.length) {
    return "Instagram DM automation is currently live, but reconnect is recommended soon because the stored Meta user token is no longer comfortably fresh.";
  }

  return "Instagram DM automation is ready.";
}

function buildMetaStatusPayload({
  tenant = {},
  channel = null,
  secrets = {},
  pendingSelection = null,
} = {}) {
  const capability = getTenantCapability(tenant, "metaChannelConnect");
  const oauthEnvReady = hasMetaOauthEnv();
  const gatewayReady = hasMetaGatewayEnv();
  const snapshot = readMetaChannelSnapshot(channel || {});
  const pendingSelectionView = buildPendingMetaSelectionView({
    pendingSelection: pendingSelection || readPendingMetaSelection(secrets),
    tenantKey: tenant?.tenant_key,
  });
  const selectionRequired = pendingSelectionView?.required === true;
  const hasToken = Boolean(s(secrets?.page_access_token));
  const hasIds = Boolean(
    s(channel?.external_page_id) || s(channel?.external_user_id)
  );
  const explicitDeauthorized =
    Boolean(snapshot.deauthorizedAt) ||
    snapshot.connectionState === "deauthorized" ||
    snapshot.authStatus === "revoked";
  const explicitDisconnected =
    snapshot.disconnectReason === "user_disconnect" ||
    lower(channel?.status) === "disconnected" ||
    snapshot.connectionState === "disconnected" ||
    snapshot.authStatus === "disconnected";
  const explicitReconnectRequired =
    snapshot.manualReconnectRequired ||
    snapshot.connectionState === "reconnect_required" ||
    snapshot.authStatus === "reconnect_required";
  const connectedByRow =
    Boolean(channel) &&
    lower(channel?.status) === "connected" &&
    hasIds &&
    hasToken &&
    !explicitReconnectRequired &&
    !explicitDeauthorized;

  let state = "not_connected";
  let reasonCode = "channel_not_connected";

  if (!channel) {
    if (selectionRequired) {
      state = "not_connected";
      reasonCode = "instagram_account_selection_required";
    } else if (capability?.allowed === false) {
      state = "blocked";
      reasonCode = "plan_capability_restricted";
    } else if (!oauthEnvReady) {
      state = "blocked";
      reasonCode = "meta_oauth_env_missing";
    }
  } else if (connectedByRow) {
    state = "connected";
    reasonCode = "";
  } else if (explicitDeauthorized) {
    state = "deauthorized";
    reasonCode = s(snapshot.disconnectReason || "meta_app_deauthorized");
  } else if (explicitDisconnected) {
    state = oauthEnvReady ? "disconnected" : "blocked";
    reasonCode = oauthEnvReady ? "user_disconnect" : "meta_oauth_env_missing";
  } else if (explicitReconnectRequired) {
    state = oauthEnvReady ? "reconnect_required" : "blocked";
    reasonCode = oauthEnvReady
      ? s(snapshot.disconnectReason || "channel_reconnect_required")
      : "meta_oauth_env_missing";
  } else if (!hasIds) {
    state = oauthEnvReady ? "reconnect_required" : "blocked";
    reasonCode = oauthEnvReady
      ? "channel_identifiers_missing"
      : "meta_oauth_env_missing";
  } else if (!hasToken) {
    state = oauthEnvReady ? "reconnect_required" : "blocked";
    reasonCode = oauthEnvReady
      ? "provider_secret_missing"
      : "meta_oauth_env_missing";
  } else {
    state = oauthEnvReady ? "reconnect_required" : "blocked";
    reasonCode = oauthEnvReady
      ? s(snapshot.disconnectReason || "channel_reconnect_required")
      : "meta_oauth_env_missing";
  }

  const webhookReady = state === "connected" && hasIds;
  const deliveryReady = state === "connected" && hasIds && hasToken && gatewayReady;
  const blockers = buildMetaStatusBlockers({
    state,
    reasonCode,
    channel,
    hasToken,
    oauthEnvReady,
    gatewayReady,
    capability,
    pendingSelection: pendingSelectionView,
  });
  const userToken = buildMetaUserTokenLifecycle(snapshot.userTokenExpiresAt);
  const attentionItems = buildMetaStatusAttentionItems({
    state,
    userToken,
  });
  const reconnectRecommended =
    state === "connected" &&
    capability?.allowed !== false &&
    oauthEnvReady &&
    !selectionRequired &&
    userToken.reconnectRecommended;

  return {
    connected: state === "connected",
    state,
    reasonCode,
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
          config: obj(channel.config),
          health: obj(channel.health),
          last_sync_at: channel.last_sync_at,
        }
      : null,
    account: {
      displayName: snapshot.displayName || "Instagram",
      pageName: snapshot.pageName || null,
      username: snapshot.igUsername || cleanNullable(channel?.external_username),
      pageId: cleanNullable(
        channel?.external_page_id || snapshot.lastKnownPageId
      ),
      igUserId: cleanNullable(
        channel?.external_user_id || snapshot.lastKnownIgUserId
      ),
      metaUserId: cleanNullable(snapshot.metaUserId),
      metaUserName: cleanNullable(snapshot.metaUserName),
    },
    pendingSelection: pendingSelectionView,
    runtime: {
      ready: deliveryReady,
      webhookReady,
      deliveryReady,
      oauthEnvReady,
      gatewayReady,
      hasPageAccessToken: hasToken,
      hasOperationalIds: hasIds,
      reasonCode:
        state !== "connected"
          ? reasonCode
          : !gatewayReady
          ? "meta_gateway_env_missing"
          : "",
    },
    lifecycle: {
      authModel: "instagram_dm_page_access",
      requestedScopes: snapshot.requestedScopes,
      grantedScopes: snapshot.grantedScopes,
      excludedScopes: snapshot.excludedScopes,
      phaseTwoCapabilities: snapshot.phaseTwoCapabilities,
      manualReconnectMode: "oauth",
      lastOauthExchangeAt: cleanNullable(snapshot.lastOauthExchangeAt),
      userTokenExpiresAt: cleanNullable(snapshot.userTokenExpiresAt),
      tokenType: cleanNullable(snapshot.tokenType),
      deauthorizedAt: cleanNullable(snapshot.deauthorizedAt),
      disconnectedAt: cleanNullable(snapshot.disconnectedAt),
      disconnectReason: cleanNullable(snapshot.disconnectReason),
      authStatus: cleanNullable(snapshot.authStatus),
      userToken: {
        known: userToken.known,
        status: userToken.status,
        expiresAt: cleanNullable(userToken.expiresAt),
        expired: userToken.expired,
        expiresSoon: userToken.expiresSoon,
        reconnectRecommended: userToken.reconnectRecommended,
      },
    },
    attention: {
      hasItems: attentionItems.length > 0,
      reconnectRecommended,
      items: attentionItems,
    },
    actions: {
      primary:
        selectionRequired
          ? "select_account"
          : state === "connected"
          ? "open_inbox"
          : state === "blocked"
          ? "resolve_blocker"
          : "connect",
      connectAvailable:
        capability?.allowed !== false && oauthEnvReady && !selectionRequired,
      reconnectAvailable:
        capability?.allowed !== false && oauthEnvReady && !selectionRequired,
      reconnectRecommended,
      reconnectReasonCode:
        reconnectRecommended && attentionItems[0]?.reasonCode
          ? attentionItems[0].reasonCode
          : "",
      selectionAvailable: selectionRequired,
      disconnectAvailable: Boolean(channel) || selectionRequired,
      nextAction:
        selectionRequired
          ? "select_account"
          : state === "connected"
          ? "open_inbox"
          : capability?.allowed === false
          ? "upgrade_plan"
          : !oauthEnvReady
          ? "configure_oauth"
          : "connect",
    },
    review: buildMetaReviewPayload(),
    readiness: buildReadinessSurface({
      status: blockers.length ? "blocked" : "ready",
      message: buildMetaReadyMessage({
        selectionRequired,
        blockers,
        attentionItems,
      }),
      blockers,
    }),
  };
}

export async function buildMetaOAuthUrl({ db, req }) {
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

  const capability = getTenantCapability(tenant, "metaChannelConnect");
  if (capability?.allowed === false) {
    await auditSafe(
      db,
      getReqActor(req),
      tenant,
      "settings.channel.meta.connected",
      "tenant_channel",
      "instagram",
      {
        outcome: "blocked",
        reasonCode: "plan_capability_restricted",
        capabilityKey: capability.key,
        planKey: capability.planKey,
        normalizedPlanKey: capability.normalizedPlanKey,
        requiredPlans: capability.requiredPlans,
      }
    );

    const err = new Error(capability.message);
    err.status = 403;
    throw err;
  }

  if (!hasMetaOauthEnv()) {
    const err = new Error("Meta OAuth env missing");
    err.status = 400;
    throw err;
  }

  await deleteMetaSecretKeys(db, tenant.id, [META_CONNECT_SELECTION_SECRET_KEY]);

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
  url.searchParams.set("scope", META_DM_LAUNCH_SCOPES.join(","));

  return url.toString();
}

export async function handleMetaCallback({
  db,
  req,
  exchangeCodeForUserTokenFn = exchangeCodeForUserToken,
  getMetaUserProfileFn = getMetaUserProfile,
  getPagesForUserTokenFn = getPagesForUserToken,
  syncInstagramSourceLayerFn = syncInstagramSourceLayer,
} = {}) {
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
  const actor = s(state.actor || "system");

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

  const capability = getTenantCapability(tenant, "metaChannelConnect");
  if (capability?.allowed === false) {
    await auditSafe(
      db,
      actor,
      tenant,
      "settings.channel.meta.connected",
      "tenant_channel",
      "instagram",
      {
        outcome: "blocked",
        reasonCode: "plan_capability_restricted",
        capabilityKey: capability.key,
        planKey: capability.planKey,
        normalizedPlanKey: capability.normalizedPlanKey,
        requiredPlans: capability.requiredPlans,
      }
    );

    const err = new Error(capability.message);
    err.status = 403;
    throw err;
  }

  await deleteMetaSecretKeys(db, tenant.id, [META_CONNECT_SELECTION_SECRET_KEY]);

  const tokenJson = await exchangeCodeForUserTokenFn(code);
  const userAccessToken = s(tokenJson?.access_token);
  if (!userAccessToken) {
    throw new Error("Meta user access token missing");
  }

  const [metaUserProfile, pages] = await Promise.all([
    getMetaUserProfileFn(userAccessToken),
    getPagesForUserTokenFn(userAccessToken),
  ]);

  if (!s(metaUserProfile?.id)) {
    throw new Error("Meta app user id missing");
  }

  const candidates = listInstagramPageCandidates(pages);
  if (!candidates.length) {
    throw new Error("No Instagram Business page found on connected Meta account");
  }

  if (candidates.length > 1) {
    const pendingSelection = buildPendingMetaSelectionPayload({
      actor,
      metaUserProfile,
      tokenJson,
      requestedScopes: META_DM_LAUNCH_SCOPES,
      grantedScopes: META_DM_LAUNCH_SCOPES,
      candidates,
    });

    await savePendingMetaSelection(db, tenant.id, pendingSelection, actor);

    await auditSafe(
      db,
      actor,
      tenant,
      "settings.channel.meta.selection_required",
      "tenant_channel",
      "instagram",
      {
        outcome: "selection_required",
        reasonCode: "instagram_account_selection_required",
        selectionId: pendingSelection?.selectionId || null,
        candidateCount: candidates.length,
        candidates: candidates.slice(0, 5).map((candidate) => ({
          pageId: candidate.pageId,
          pageName: candidate.pageName,
          igUserId: candidate.igUserId,
          igUsername: candidate.igUsername || null,
        })),
        metaUserId: metaUserProfile.id || null,
      }
    );

    return {
      type: "selection_required",
      redirectUrl: buildRedirectUrl({
        section: "channels",
        channel: "instagram",
        meta_selection: "1",
      }),
      payload: {
        connected: false,
        selectionRequired: true,
        channel: "instagram",
        review: buildMetaReviewPayload(),
      },
    };
  }

  const selected = candidates[0];
  const connectResult = await connectInstagramChannel({
    db,
    tenant,
    actor,
    selected,
    metaUserProfile,
    tokenJson,
    requestedScopes: META_DM_LAUNCH_SCOPES,
    grantedScopes: META_DM_LAUNCH_SCOPES,
    syncInstagramSourceLayerFn,
  });

  return {
    type: "success",
    redirectUrl: buildRedirectUrl({
      section: "channels",
      meta_connected: "1",
      channel: "instagram",
    }),
    payload: connectResult?.payload,
  };
}

export async function completeMetaSelection({
  db,
  req,
  syncInstagramSourceLayerFn = syncInstagramSourceLayer,
} = {}) {
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

  const selectionToken = s(
    req.body?.selectionToken || req.body?.selection_token
  );
  const candidateId = s(req.body?.candidateId || req.body?.candidate_id);

  const checked = verifyPendingMetaSelectionToken(selectionToken, tenantKey);
  if (!checked?.selectionId) {
    const err = new Error("Invalid Instagram selection token");
    err.status = 400;
    throw err;
  }

  const {
    pendingSelection,
    pendingSelectionExpired,
  } = await loadMetaSecretsContext(db, tenant.id);

  if (pendingSelectionExpired) {
    const err = new Error("Instagram selection expired. Start connect again.");
    err.status = 409;
    throw err;
  }

  if (!pendingSelection?.selectionId) {
    const err = new Error("Instagram selection is no longer available");
    err.status = 409;
    throw err;
  }

  if (pendingSelection.selectionId !== checked.selectionId) {
    const err = new Error("Instagram selection has been replaced by a newer connect attempt");
    err.status = 409;
    throw err;
  }

  const selected = findSelectionCandidate(pendingSelection, candidateId);
  if (!selected) {
    const err = new Error("Selected Instagram account was not found in the pending connect session");
    err.status = 400;
    throw err;
  }

  const metaUserProfile = {
    id: pendingSelection.metaUserId,
    name: pendingSelection.metaUserName,
  };

  const connectResult = await connectInstagramChannel({
    db,
    tenant,
    actor,
    selected,
    metaUserProfile,
    tokenJson: {
      token_type: pendingSelection.tokenType,
      userTokenExpiresAt: pendingSelection.userTokenExpiresAt,
    },
    requestedScopes: pendingSelection.requestedScopes,
    grantedScopes: pendingSelection.grantedScopes,
    syncInstagramSourceLayerFn,
  });
  const source = connectResult?.source || null;
  const capabilityGovernance = connectResult?.capabilityGovernance || null;

  await auditSafe(
    db,
    actor,
    tenant,
    "settings.channel.meta.selection_completed",
    "tenant_channel",
    "instagram",
    {
      selectionId: pendingSelection.selectionId,
      candidateId: selected.id,
      pageId: selected.pageId,
      igUserId: selected.igUserId,
      igUsername: selected.igUsername || null,
      metaUserId: pendingSelection.metaUserId || null,
      sourceId: source?.id || null,
      sourceKey: source?.source_key || null,
      capabilityGovernance: {
        publishStatus: s(capabilityGovernance?.publishStatus),
        reviewRequired: !!capabilityGovernance?.reviewRequired,
        maintenanceSessionId: s(capabilityGovernance?.maintenanceSession?.id),
        blockedReason: s(capabilityGovernance?.blockedReason),
      },
    }
  );

  return connectResult?.payload;
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

  const [channel, secretsContext] = await Promise.all([
    getPrimaryInstagramChannel(db, tenant.id),
    loadMetaSecretsContext(db, tenant.id),
  ]);

  return buildMetaStatusPayload({
    tenant,
    channel,
    secrets: secretsContext.secrets,
    pendingSelection: secretsContext.pendingSelection,
  });
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
  const currentChannel = await getPrimaryInstagramChannel(db, tenant.id);
  const { pendingSelection } = await loadMetaSecretsContext(db, tenant.id);
  const disconnectedAt = new Date().toISOString();

  await deleteMetaSecretKeys(db, tenant.id, [
    META_CONNECT_SELECTION_SECRET_KEY,
    "page_access_token",
    "access_token",
    "meta_page_access_token",
    "page_id",
    "ig_user_id",
  ]);

  if (
    pendingSelection?.selectionId &&
    lower(currentChannel?.status) !== "connected"
  ) {
    await auditSafe(
      db,
      actor,
      tenant,
      "settings.channel.meta.selection_cleared",
      "tenant_channel",
      "instagram",
      {
        selectionId: pendingSelection.selectionId,
        clearedAt: disconnectedAt,
        reasonCode: "user_disconnect",
        preservedState: cleanNullable(currentChannel?.status),
      }
    );

    return {
      disconnected: true,
      clearedPendingSelection: true,
      channel: "instagram",
      disconnectedAt,
      preservedState: cleanNullable(currentChannel?.status) || "not_connected",
      review: buildMetaReviewPayload(),
      capabilityGovernance: null,
    };
  }

  await markInstagramDisconnected(
    db,
    tenant.id,
    buildInstagramLifecycleChannelPayload({
      channel: currentChannel,
      transition: "disconnected",
      reasonCode: "user_disconnect",
      occurredAt: disconnectedAt,
    })
  );

  const capabilityGovernance = await markInstagramSourceDisconnected({
    db,
    tenant,
    actor,
    authStatus: "revoked",
  });

  await auditSafe(
    db,
    actor,
    tenant,
    "settings.channel.meta.disconnected",
    "tenant_channel",
    "instagram",
    {
      disconnectedAt,
      reasonCode: "user_disconnect",
      capabilityGovernance: {
        publishStatus: s(capabilityGovernance?.publishStatus),
        reviewRequired: !!capabilityGovernance?.reviewRequired,
        maintenanceSessionId: s(capabilityGovernance?.maintenanceSession?.id),
        blockedReason: s(capabilityGovernance?.blockedReason),
      },
    }
  );

  return {
    disconnected: true,
    channel: "instagram",
    disconnectedAt,
    review: buildMetaReviewPayload(),
    capabilityGovernance,
  };
}
