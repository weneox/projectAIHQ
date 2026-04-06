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
export const META_CONNECT_DIAGNOSTIC_SECRET_KEY = "connect_diagnostic_pending";
export const META_CONNECT_DIAGNOSTIC_KIND = "meta_connect_diagnostic";
export const META_CONNECT_DIAGNOSTIC_TTL_MS = 15 * 60 * 1000;
export const META_USER_TOKEN_EXPIRING_SOON_MS = 10 * 60 * 1000;

export const META_DM_LAUNCH_REVIEW_STORY =
  "Businesses connect their own Instagram Business / Professional account and the platform helps them manage inbound customer conversations using tenant-specific business settings and runtime.";

const META_PAGE_DISCOVERY_FIELDS = [
  "id",
  "name",
  "access_token",
  "instagram_business_account{id,username}",
  "connected_instagram_account{id,username}",
  "instagram_accounts{id,username}",
  "page_backed_instagram_accounts{id,username}",
].join(",");

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

function normalizeScopeList(values = []) {
  return uniqStrings(values);
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

function epochSecondsToIso(value) {
  const seconds = Number(value || 0);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null;
}

function createSafeLogger(baseLogger, childContext = null) {
  const root = baseLogger && typeof baseLogger === "object" ? baseLogger : null;

  let active = root;
  if (childContext && root && typeof root.child === "function") {
    try {
      active = root.child(childContext) || root;
    } catch {
      active = root;
    }
  }

  function call(method, ...args) {
    try {
      const fn =
        (active && typeof active[method] === "function" && active[method]) ||
        (root && typeof root[method] === "function" && root[method]) ||
        null;
      if (fn) {
        return fn.apply(active || root, args);
      }
    } catch {
      // noop
    }
    return undefined;
  }

  return {
    child(context = {}) {
      return createSafeLogger(active || root, context);
    },
    debug(...args) {
      return call("debug", ...args);
    },
    info(...args) {
      return call("info", ...args);
    },
    warn(...args) {
      return call("warn", ...args);
    },
    error(...args) {
      return call("error", ...args);
    },
  };
}

function buildMetaConnectFailureError(
  reasonCode = "meta_connect_failed",
  message = "Meta connect failed",
  { status = 409, details = null } = {}
) {
  const err = new Error(message);
  err.status = Number(status || 409);
  err.reasonCode = s(reasonCode || "meta_connect_failed");
  if (details && typeof details === "object") {
    err.details = details;
  }
  return err;
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

  if (!pageId || !igUserId) {
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
  grantedScopes = [],
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
    userAccessToken: s(tokenJson?.access_token),
    tokenType: s(tokenJson?.token_type),
    userTokenExpiresAt: buildUserTokenExpiresAt(tokenJson),
    requestedScopes: buildRequestedScopeList(requestedScopes),
    grantedScopes: normalizeScopeList(grantedScopes),
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
    userAccessToken: s(parsed.userAccessToken),
    tokenType: s(parsed.tokenType),
    userTokenExpiresAt: asIsoIfPresent(parsed.userTokenExpiresAt),
    requestedScopes: buildRequestedScopeList(parsed.requestedScopes),
    grantedScopes: normalizeScopeList(parsed.grantedScopes),
    candidates,
  };
}

function buildPendingMetaConnectDiagnosticPayload({
  actor = "system",
  stage = "callback",
  reasonCode = "meta_connect_failed",
  message = "Meta connect failed",
  createdAt = new Date().toISOString(),
  expiresAt = new Date(Date.now() + META_CONNECT_DIAGNOSTIC_TTL_MS).toISOString(),
  metaUserProfile = {},
  requestedScopes = META_DM_LAUNCH_SCOPES,
  grantedScopes = [],
  missingGrantedScopes = [],
  declinedScopes = [],
  expiredScopes = [],
  permissionSummary = {},
  pageDiscovery = {},
  candidateCount = 0,
} = {}) {
  return {
    diagnosticId: crypto.randomUUID(),
    actor: s(actor || "system"),
    stage: s(stage || "callback"),
    reasonCode: s(reasonCode || "meta_connect_failed"),
    message: s(message || "Meta connect failed"),
    createdAt,
    expiresAt,
    metaUserId: s(metaUserProfile?.id),
    metaUserName: s(metaUserProfile?.name),
    requestedScopes: buildRequestedScopeList(requestedScopes),
    grantedScopes: normalizeScopeList(
      arr(grantedScopes).length
        ? grantedScopes
        : permissionSummary?.grantedScopes || []
    ),
    missingGrantedScopes: normalizeScopeList(
      arr(missingGrantedScopes).length
        ? missingGrantedScopes
        : permissionSummary?.missingRequiredScopes || []
    ),
    declinedScopes: normalizeScopeList(
      arr(declinedScopes).length
        ? declinedScopes
        : permissionSummary?.declinedScopes || []
    ),
    expiredScopes: normalizeScopeList(
      arr(expiredScopes).length
        ? expiredScopes
        : permissionSummary?.expiredScopes || []
    ),
    permissionVerificationStatus: s(permissionSummary?.verificationStatus),
    permissionSource: s(permissionSummary?.source),
    pageDiscovery: obj(pageDiscovery),
    candidateCount: Math.max(0, Number(candidateCount || 0)),
  };
}

export function readPendingMetaConnectDiagnostic(secrets = {}) {
  const parsed = parseJsonObject(secrets?.[META_CONNECT_DIAGNOSTIC_SECRET_KEY]);
  const diagnosticId = s(parsed.diagnosticId);
  const reasonCode = s(parsed.reasonCode);

  if (!diagnosticId || !reasonCode) {
    return null;
  }

  return {
    diagnosticId,
    actor: s(parsed.actor || "system"),
    stage: s(parsed.stage || "callback"),
    reasonCode,
    message: s(parsed.message || "Meta connect failed"),
    createdAt: asIsoIfPresent(parsed.createdAt),
    expiresAt: asIsoIfPresent(parsed.expiresAt),
    metaUserId: s(parsed.metaUserId),
    metaUserName: s(parsed.metaUserName),
    requestedScopes: buildRequestedScopeList(parsed.requestedScopes),
    grantedScopes: normalizeScopeList(parsed.grantedScopes),
    missingGrantedScopes: normalizeScopeList(parsed.missingGrantedScopes),
    declinedScopes: normalizeScopeList(parsed.declinedScopes),
    expiredScopes: normalizeScopeList(parsed.expiredScopes),
    permissionVerificationStatus: s(parsed.permissionVerificationStatus),
    permissionSource: s(parsed.permissionSource),
    pageDiscovery: obj(parsed.pageDiscovery),
    candidateCount: Math.max(0, Number(parsed.candidateCount || 0)),
  };
}

function hasPendingMetaSelectionExpired(pendingSelection = {}) {
  const expiresAtMs = asTimestamp(pendingSelection?.expiresAt);
  return Boolean(expiresAtMs && expiresAtMs <= Date.now());
}

function hasPendingMetaConnectDiagnosticExpired(connectDiagnostic = {}) {
  const expiresAtMs = asTimestamp(connectDiagnostic?.expiresAt);
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

function buildPendingMetaConnectDiagnosticView(connectDiagnostic = null) {
  if (!connectDiagnostic?.diagnosticId) return null;

  return {
    diagnosticId: connectDiagnostic.diagnosticId,
    stage: connectDiagnostic.stage,
    reasonCode: connectDiagnostic.reasonCode,
    message: connectDiagnostic.message,
    createdAt: cleanNullable(connectDiagnostic.createdAt),
    expiresAt: cleanNullable(connectDiagnostic.expiresAt),
    metaUserId: cleanNullable(connectDiagnostic.metaUserId),
    metaUserName: cleanNullable(connectDiagnostic.metaUserName),
    requestedScopes: connectDiagnostic.requestedScopes,
    grantedScopes: connectDiagnostic.grantedScopes,
    missingGrantedScopes: connectDiagnostic.missingGrantedScopes,
    declinedScopes: connectDiagnostic.declinedScopes,
    expiredScopes: connectDiagnostic.expiredScopes,
    permissionVerificationStatus: cleanNullable(
      connectDiagnostic.permissionVerificationStatus
    ),
    permissionSource: cleanNullable(connectDiagnostic.permissionSource),
    pageDiscovery: obj(connectDiagnostic.pageDiscovery),
    candidateCount: connectDiagnostic.candidateCount,
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
  const requested = normalizeScopeList(values);
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

function readMetaPageAccessToken(secrets = {}) {
  return s(
    secrets?.page_access_token ||
      secrets?.meta_page_access_token ||
      secrets?.access_token
  );
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
      channel?.external_user_id ||
        config.last_known_ig_user_id ||
        config.ig_user_id
    ),
    metaUserId: s(config.meta_user_id || health.meta_user_id),
    metaUserName: s(config.meta_user_name),
    requestedScopes: buildRequestedScopeList(config.requested_scopes),
    grantedScopes: normalizeScopeList(config.granted_scopes),
    missingGrantedScopes: normalizeScopeList(config.missing_granted_scopes),
    declinedScopes: normalizeScopeList(config.declined_scopes),
    expiredScopes: normalizeScopeList(config.expired_scopes),
    permissionVerificationStatus: s(config.permission_verification_status),
    permissionScopeSource: s(config.permission_scope_source),
    permissionVerifiedAt: s(config.permission_verified_at),
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
  grantedScopes = [],
  permissionSummary = {},
  metaUserProfile = {},
  connectedAt = new Date().toISOString(),
} = {}) {
  return {
    connected_via: "oauth",
    auth_model: "instagram_dm_page_access",
    meta_user_id: cleanNullable(metaUserProfile?.id),
    meta_user_name: cleanNullable(metaUserProfile?.name),
    requested_scopes: buildRequestedScopeList(requestedScopes),
    granted_scopes: normalizeScopeList(grantedScopes),
    missing_granted_scopes: normalizeScopeList(
      permissionSummary?.missingRequiredScopes
    ),
    declined_scopes: normalizeScopeList(permissionSummary?.declinedScopes),
    expired_scopes: normalizeScopeList(permissionSummary?.expiredScopes),
    permission_verification_status: cleanNullable(
      permissionSummary?.verificationStatus
    ),
    permission_scope_source: cleanNullable(permissionSummary?.source),
    permission_verified_at: cleanNullable(permissionSummary?.verifiedAt),
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
      last_connected_display_name: cleanNullable(
        snapshot.displayName || "Instagram"
      ),
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

  const capabilityGovernance =
    await knowledge.refreshChannelCapabilitiesFromSources({
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

export async function getMetaPermissionsForUserToken(userAccessToken) {
  const url = new URL(`${metaGraphBase()}/me/permissions`);
  url.searchParams.set("access_token", s(userAccessToken));
  return fetchJson(url.toString());
}

export async function debugMetaUserToken(userAccessToken) {
  const url = new URL(`${metaGraphBase()}/debug_token`);
  url.searchParams.set("input_token", s(userAccessToken));
  url.searchParams.set(
    "access_token",
    `${s(cfg.meta.appId)}|${s(cfg.meta.appSecret)}`
  );
  return fetchJson(url.toString());
}

export async function getPagesForUserToken(userAccessToken) {
  const pages = [];
  let nextUrl = new URL(`${metaGraphBase()}/me/accounts`);
  nextUrl.searchParams.set("fields", META_PAGE_DISCOVERY_FIELDS);
  nextUrl.searchParams.set("access_token", s(userAccessToken));

  while (nextUrl) {
    const json = await fetchJson(nextUrl.toString());
    const batch = Array.isArray(json?.data) ? json.data : [];
    pages.push(...batch);

    const next = s(json?.paging?.next);
    nextUrl = next ? new URL(next) : null;
  }

  return pages;
}

export async function getAssignedPagesForUserToken(userAccessToken) {
  const pages = [];
  let nextUrl = new URL(`${metaGraphBase()}/me/assigned_pages`);
  nextUrl.searchParams.set("fields", META_PAGE_DISCOVERY_FIELDS);
  nextUrl.searchParams.set("access_token", s(userAccessToken));

  while (nextUrl) {
    const json = await fetchJson(nextUrl.toString());
    const batch = Array.isArray(json?.data) ? json.data : [];
    pages.push(...batch);

    const next = s(json?.paging?.next);
    nextUrl = next ? new URL(next) : null;
  }

  return pages;
}

function normalizeMetaPermissionEntry(entry = {}) {
  const permission = s(entry?.permission);
  const status = lower(entry?.status);

  if (!permission || !status) return null;

  return {
    permission,
    status,
  };
}

function summarizeMetaDebugGranularScope(entry = {}) {
  const scope = s(entry?.scope);
  if (!scope) return null;

  return {
    scope,
    targetCount: arr(entry?.target_ids).length,
  };
}

function buildMetaPermissionSummary({
  requestedScopes = META_DM_LAUNCH_SCOPES,
  permissionsPayload = {},
  debugTokenPayload = {},
  permissionsError = null,
  debugTokenError = null,
  verifiedAt = new Date().toISOString(),
} = {}) {
  const requested = buildRequestedScopeList(requestedScopes);
  const permissionRows = arr(permissionsPayload?.data)
    .map((entry) => normalizeMetaPermissionEntry(entry))
    .filter(Boolean);
  const permissionStatusByName = new Map(
    permissionRows.map((entry) => [entry.permission, entry.status])
  );

  const debugData = obj(debugTokenPayload?.data);
  const debugScopes = normalizeScopeList(debugData?.scopes);
  const debugGranularScopes = arr(debugData?.granular_scopes)
    .map((entry) => summarizeMetaDebugGranularScope(entry))
    .filter(Boolean);

  const grantedScopes = requested.filter((scope) => {
    const explicit = permissionStatusByName.get(scope);
    if (explicit) return explicit === "granted";
    return debugScopes.includes(scope);
  });
  const declinedScopes = requested.filter(
    (scope) => permissionStatusByName.get(scope) === "declined"
  );
  const expiredScopes = requested.filter(
    (scope) => permissionStatusByName.get(scope) === "expired"
  );

  const verificationAvailable =
    permissionRows.length > 0 || debugScopes.length > 0;
  const missingRequiredScopes = verificationAvailable
    ? requested.filter((scope) => !grantedScopes.includes(scope))
    : [];

  let source = "unavailable";
  if (permissionRows.length && debugScopes.length) {
    source = "me_permissions_and_debug_token";
  } else if (permissionRows.length) {
    source = "me_permissions";
  } else if (debugScopes.length) {
    source = "debug_token";
  }

  let verificationStatus = "unverified";
  if (verificationAvailable && missingRequiredScopes.length) {
    verificationStatus = "missing_required_scopes";
  } else if (verificationAvailable) {
    verificationStatus = "verified";
  }

  return {
    requestedScopes: requested,
    grantedScopes,
    missingRequiredScopes,
    declinedScopes,
    expiredScopes,
    verificationAvailable,
    verificationStatus,
    source,
    verifiedAt: verificationAvailable ? verifiedAt : null,
    permissions: {
      available: permissionRows.length > 0,
      error: s(permissionsError?.message),
      rows: requested.map((scope) => ({
        scope,
        status: s(permissionStatusByName.get(scope)),
      })),
    },
    debugToken: {
      available:
        Boolean(debugData?.is_valid === true) ||
        debugScopes.length > 0 ||
        debugGranularScopes.length > 0,
      error: s(debugTokenError?.message),
      isValid: debugData?.is_valid === true,
      appId: s(debugData?.app_id),
      userId: s(debugData?.user_id),
      expiresAt: epochSecondsToIso(debugData?.expires_at),
      dataAccessExpiresAt: epochSecondsToIso(debugData?.data_access_expires_at),
      scopes: debugScopes,
      granularScopes: debugGranularScopes,
    },
  };
}

function summarizeMetaDiscoveredPage(page = {}) {
  const ig = extractInstagramAccountFromPage(page);

  return {
    pageId: s(page?.id),
    pageName: s(page?.name),
    hasPageAccessToken: Boolean(s(page?.access_token)),
    hasInstagramAccount: Boolean(s(ig?.id)),
    instagramSource: cleanNullable(ig?.source),
  };
}

function buildMetaPageDiscoverySummary({
  sourceResults = [],
  pages = [],
  enrichedPages = [],
  candidates = [],
} = {}) {
  const combinedPages = arr(pages);
  const enriched = arr(enrichedPages);

  return {
    sources: arr(sourceResults).map((source) => ({
      source: s(source?.source),
      count: arr(source?.pages).length,
      error: cleanNullable(source?.error?.message),
      sample: arr(source?.pages).slice(0, 5).map((page) => summarizeMetaDiscoveredPage(page)),
    })),
    pageCount: combinedPages.length,
    withAccessTokenCount: combinedPages.filter((page) => s(page?.access_token)).length,
    withInstagramAccountCount: enriched.filter((page) => hasInstagramAccountOnPage(page)).length,
    candidateCount: arr(candidates).length,
    samplePages: enriched.slice(0, 5).map((page) => summarizeMetaDiscoveredPage(page)),
  };
}

function mergeMetaDiscoveredPages(existingPages = [], nextPages = []) {
  const byPageId = new Map();

  for (const page of arr(existingPages)) {
    const pageId = s(page?.id);
    if (!pageId) continue;
    byPageId.set(pageId, obj(page));
  }

  for (const page of arr(nextPages)) {
    const pageId = s(page?.id);
    if (!pageId) continue;

    const current = byPageId.get(pageId);
    byPageId.set(
      pageId,
      current
        ? mergeMetaPageDiscoveryPayload(current, obj(page))
        : obj(page)
    );
  }

  return [...byPageId.values()];
}

async function discoverMetaPagesForUserToken({
  userAccessToken = "",
  getPagesForUserTokenFn = getPagesForUserToken,
  getAssignedPagesForUserTokenFn = getAssignedPagesForUserToken,
} = {}) {
  const accountsPages = await getPagesForUserTokenFn(userAccessToken);
  const sourceResults = [
    {
      source: "me/accounts",
      pages: accountsPages,
    },
  ];
  let combinedPages = arr(accountsPages);

  if (!combinedPages.length) {
    try {
      const assignedPages = await getAssignedPagesForUserTokenFn(userAccessToken);
      sourceResults.push({
        source: "me/assigned_pages",
        pages: assignedPages,
      });
      combinedPages = mergeMetaDiscoveredPages(accountsPages, assignedPages);
    } catch (error) {
      sourceResults.push({
        source: "me/assigned_pages",
        pages: [],
        error,
      });
    }
  }

  return {
    pages: combinedPages,
    sourceResults,
  };
}

async function getMetaPageInstagramContextForUserToken(pageId, userAccessToken) {
  const url = new URL(`${metaGraphBase()}/${s(pageId)}`);
  url.searchParams.set("fields", META_PAGE_DISCOVERY_FIELDS);
  url.searchParams.set("access_token", s(userAccessToken));

  return fetchJson(url.toString());
}

async function getMetaPageInstagramContextForPageToken(pageId, pageAccessToken) {
  const url = new URL(`${metaGraphBase()}/${s(pageId)}`);
  url.searchParams.set("fields", META_PAGE_DISCOVERY_FIELDS);
  url.searchParams.set("access_token", s(pageAccessToken));

  return fetchJson(url.toString());
}

async function getMetaPageAccessContextForUserToken(pageId, userAccessToken) {
  const url = new URL(`${metaGraphBase()}/${s(pageId)}`);
  url.searchParams.set("fields", "id,name,access_token");
  url.searchParams.set("access_token", s(userAccessToken));

  return fetchJson(url.toString());
}

function firstInstagramNodeFromCollection(value) {
  return (
    arr(value?.data).find((item) => s(item?.id) || s(item?.username)) || null
  );
}

function extractInstagramAccountFromPage(page = {}) {
  const directBusiness = obj(page?.instagram_business_account);
  if (s(directBusiness?.id) || s(directBusiness?.username)) {
    return {
      id: s(directBusiness.id),
      username: s(directBusiness.username),
      source: "instagram_business_account",
    };
  }

  const directConnected = obj(page?.connected_instagram_account);
  if (s(directConnected?.id) || s(directConnected?.username)) {
    return {
      id: s(directConnected.id),
      username: s(directConnected.username),
      source: "connected_instagram_account",
    };
  }

  const collectionInstagram = firstInstagramNodeFromCollection(
    page?.instagram_accounts
  );
  if (collectionInstagram) {
    return {
      id: s(collectionInstagram.id),
      username: s(collectionInstagram.username),
      source: "instagram_accounts",
    };
  }

  const pageBackedInstagram = firstInstagramNodeFromCollection(
    page?.page_backed_instagram_accounts
  );
  if (pageBackedInstagram) {
    return {
      id: s(pageBackedInstagram.id),
      username: s(pageBackedInstagram.username),
      source: "page_backed_instagram_accounts",
    };
  }

  return null;
}

function hasInstagramAccountOnPage(page = {}) {
  return Boolean(extractInstagramAccountFromPage(page)?.id);
}

function mergeMetaPageDiscoveryPayload(basePage = {}, enrichedPage = {}) {
  const merged = {
    ...basePage,
    ...enrichedPage,
  };

  const accessToken = s(enrichedPage?.access_token || basePage?.access_token);
  if (accessToken) {
    merged.access_token = accessToken;
  }

  for (const field of [
    "instagram_business_account",
    "connected_instagram_account",
  ]) {
    const enrichedValue = obj(enrichedPage?.[field]);
    const baseValue = obj(basePage?.[field]);
    if (s(enrichedValue?.id) || s(enrichedValue?.username)) {
      merged[field] = enrichedValue;
    } else if (s(baseValue?.id) || s(baseValue?.username)) {
      merged[field] = baseValue;
    }
  }

  for (const field of [
    "instagram_accounts",
    "page_backed_instagram_accounts",
  ]) {
    const enrichedCollection = arr(enrichedPage?.[field]?.data);
    const baseCollection = arr(basePage?.[field]?.data);

    if (enrichedCollection.length) {
      merged[field] = { data: enrichedCollection };
    } else if (baseCollection.length) {
      merged[field] = { data: baseCollection };
    }
  }

  return merged;
}

async function enrichMetaPageForCandidateDiscovery({
  page = {},
  userAccessToken = "",
  getMetaPageInstagramContextForUserTokenFn = getMetaPageInstagramContextForUserToken,
  getMetaPageInstagramContextForPageTokenFn = getMetaPageInstagramContextForPageToken,
  log = createSafeLogger(),
} = {}) {
  const basePage = obj(page);
  const pageId = s(basePage?.id);
  const pageAccessToken = s(basePage?.access_token);

  if (!pageId) {
    return basePage;
  }

  let mergedPage = basePage;

  if (hasInstagramAccountOnPage(mergedPage) && pageAccessToken) {
    log.info("meta.connect.page_enrichment.skipped", {
      pageId,
      strategy: "raw_page_has_instagram_and_token",
      hasInstagramAccount: true,
      hasPageAccessToken: true,
    });
    return mergedPage;
  }

  if (s(userAccessToken)) {
    log.info("meta.connect.page_enrichment.attempt", {
      pageId,
      strategy: "user_token",
      hasInstagramAccount: hasInstagramAccountOnPage(mergedPage),
      hasPageAccessToken: Boolean(s(mergedPage?.access_token)),
    });
    try {
      const enrichedByUserToken = obj(
        await getMetaPageInstagramContextForUserTokenFn(pageId, userAccessToken)
      );
      mergedPage = mergeMetaPageDiscoveryPayload(
        mergedPage,
        enrichedByUserToken
      );
      log.info("meta.connect.page_enrichment.result", {
        pageId,
        strategy: "user_token",
        success: true,
        hasInstagramAccount: hasInstagramAccountOnPage(mergedPage),
        hasPageAccessToken: Boolean(s(mergedPage?.access_token)),
      });
    } catch (error) {
      log.warn("meta.connect.page_enrichment.result", {
        pageId,
        strategy: "user_token",
        success: false,
        error: cleanNullable(error?.message),
      });
    }
  }

  if (hasInstagramAccountOnPage(mergedPage) && s(mergedPage?.access_token)) {
    return mergedPage;
  }

  if (pageAccessToken) {
    log.info("meta.connect.page_enrichment.attempt", {
      pageId,
      strategy: "page_token",
      hasInstagramAccount: hasInstagramAccountOnPage(mergedPage),
      hasPageAccessToken: true,
    });
    try {
      const enrichedByPageToken = obj(
        await getMetaPageInstagramContextForPageTokenFn(pageId, pageAccessToken)
      );
      mergedPage = mergeMetaPageDiscoveryPayload(
        mergedPage,
        enrichedByPageToken
      );
      log.info("meta.connect.page_enrichment.result", {
        pageId,
        strategy: "page_token",
        success: true,
        hasInstagramAccount: hasInstagramAccountOnPage(mergedPage),
        hasPageAccessToken: Boolean(s(mergedPage?.access_token)),
      });
    } catch (error) {
      log.warn("meta.connect.page_enrichment.result", {
        pageId,
        strategy: "page_token",
        success: false,
        error: cleanNullable(error?.message),
      });
    }
  }

  return mergedPage;
}

async function enrichMetaPagesForCandidateDiscovery({
  pages = [],
  userAccessToken = "",
  getMetaPageInstagramContextForUserTokenFn = getMetaPageInstagramContextForUserToken,
  getMetaPageInstagramContextForPageTokenFn = getMetaPageInstagramContextForPageToken,
  log = createSafeLogger(),
} = {}) {
  return Promise.all(
    arr(pages).map((page) =>
      enrichMetaPageForCandidateDiscovery({
        page,
        userAccessToken,
        getMetaPageInstagramContextForUserTokenFn,
        getMetaPageInstagramContextForPageTokenFn,
        log,
      })
    )
  );
}

async function readMetaVerificationPayload(res) {
  const text = await res.text().catch(() => "");
  if (!text) return {};

  try {
    return obj(JSON.parse(text));
  } catch {
    return { raw: text };
  }
}

function classifyMetaVerificationFailure({ status = 0, payload = {} } = {}) {
  const error = obj(payload?.error);
  const code = Number(error.code || payload.code || 0);
  const subcode = Number(error.error_subcode || payload.error_subcode || 0);
  const type = s(error.type || payload.type);
  const message = s(error.message || payload.message || payload.raw);
  const lowerMessage = lower(message);
  const isAuthLikeMessage =
    lowerMessage.includes("access token") ||
    lowerMessage.includes("oauth") ||
    lowerMessage.includes("session") ||
    lowerMessage.includes("deauthorized") ||
    lowerMessage.includes("revoked");
  const revoked =
    code === 190 ||
    lower(type) === "oauthexception" ||
    (status === 401 && isAuthLikeMessage);

  return {
    revoked,
    reasonCode: revoked ? "meta_app_deauthorized" : "",
    metaError: {
      status: Number.isFinite(status) ? status : 0,
      code: Number.isFinite(code) ? code : 0,
      subcode: Number.isFinite(subcode) ? subcode : 0,
      type: type || null,
      message: message || null,
    },
  };
}

async function verifyLiveMetaChannelAccess({
  channel = null,
  secrets = {},
  fetchFn = fetch,
} = {}) {
  const snapshot = readMetaChannelSnapshot(channel || {});
  const pageAccessToken = readMetaPageAccessToken(secrets);
  const pageId = s(channel?.external_page_id || snapshot.lastKnownPageId);
  const igUserId = s(channel?.external_user_id || snapshot.lastKnownIgUserId);
  const targetId = s(pageId || igUserId);

  if (!pageAccessToken || !targetId) {
    return {
      ok: false,
      skipped: true,
      revoked: false,
    };
  }

  const url = new URL(`${metaGraphBase()}/${targetId}`);
  url.searchParams.set(
    "fields",
    pageId ? "id,instagram_business_account{id}" : "id"
  );
  url.searchParams.set("access_token", pageAccessToken);

  let res = null;
  try {
    res = await fetchFn(url.toString());
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      revoked: false,
      transient: true,
      error,
    };
  }

  const payload = await readMetaVerificationPayload(res);
  if (res.ok) {
    return {
      ok: true,
      revoked: false,
      payload,
    };
  }

  return {
    ok: false,
    skipped: false,
    ...classifyMetaVerificationFailure({
      status: res.status,
      payload,
    }),
    payload,
  };
}

export function listInstagramPageCandidates(pages = []) {
  return arr(pages)
    .map((page) => {
      const ig = extractInstagramAccountFromPage(page);
      if (!page?.id || !ig?.id) return null;

      return {
        pageId: s(page.id),
        pageName: s(page.name),
        pageAccessToken: s(page.access_token),
        igUserId: s(ig.id),
        igUsername: s(ig.username),
        igSource: s(ig.source),
      };
    })
    .filter(Boolean);
}

function buildMissingMetaPageAccessTokenError() {
  return buildMetaConnectFailureError(
    "meta_page_access_token_missing",
    "Instagram/Page asset found, but page access token could not be obtained",
    { status: 409 }
  );
}

async function resolveInstagramPageAccessToken({
  selected = {},
  userAccessToken = "",
  getMetaPageAccessContextForUserTokenFn = getMetaPageAccessContextForUserToken,
} = {}) {
  const normalized = normalizeSelectionCandidate(selected);
  if (!normalized) {
    throw new Error("Instagram/Page asset is incomplete");
  }

  if (normalized.pageAccessToken) {
    return normalized;
  }

  if (!s(userAccessToken)) {
    throw buildMissingMetaPageAccessTokenError();
  }

  let page = null;
  try {
    page = await getMetaPageAccessContextForUserTokenFn(
      normalized.pageId,
      userAccessToken
    );
  } catch {
    throw buildMissingMetaPageAccessTokenError();
  }

  const pageAccessToken = s(page?.accessToken || page?.access_token);
  if (!pageAccessToken) {
    throw buildMissingMetaPageAccessTokenError();
  }

  const pageName = normalized.pageName || s(page?.name);

  return {
    ...normalized,
    pageName,
    pageAccessToken,
    displayName: buildConnectedInstagramDisplayName({
      pageName,
      igUsername: normalized.igUsername,
    }),
  };
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

async function savePendingMetaConnectDiagnostic(
  db,
  tenantId,
  connectDiagnostic,
  actor = "system"
) {
  if (!connectDiagnostic?.diagnosticId) return null;

  return saveMetaSecretValue(
    db,
    tenantId,
    META_CONNECT_DIAGNOSTIC_SECRET_KEY,
    JSON.stringify(connectDiagnostic),
    actor
  );
}

function findMetaDebugGranularScope(permissionSummary = {}, scope = "") {
  return (
    arr(permissionSummary?.debugToken?.granularScopes).find(
      (entry) => s(entry?.scope) === s(scope)
    ) || null
  );
}

function buildMissingPermissionsMessage(permissionSummary = {}) {
  const missing = normalizeScopeList(permissionSummary?.missingRequiredScopes);
  const granted = normalizeScopeList(permissionSummary?.grantedScopes);
  const missingText = missing.length ? missing.join(", ") : "unknown";
  const grantedText = granted.length ? granted.join(", ") : "none";

  return `Meta login succeeded, but the app was not granted every required permission. Missing: ${missingText}. Granted: ${grantedText}.`;
}

function buildMetaNoPagesReturnedMessage(permissionSummary = {}) {
  const pageScopeGrant = findMetaDebugGranularScope(
    permissionSummary,
    "pages_show_list"
  );

  if (pageScopeGrant && Number(pageScopeGrant.targetCount || 0) === 0) {
    return "Meta login succeeded, but the current app authorization contains zero selected Facebook Pages, so page discovery returned nothing. Reconnect and reselect the correct Page in Facebook Business Integrations.";
  }

  return "Meta login succeeded, but Meta returned no Facebook Pages for this app/user grant. Reconnect and make sure the correct Facebook Page is selected for this app.";
}

function buildMetaVerificationUnavailableMessage(permissionSummary = {}) {
  const permissionsError = s(permissionSummary?.permissions?.error);
  const debugError = s(permissionSummary?.debugToken?.error);
  const sources = [permissionsError, debugError].filter(Boolean);

  return sources.length
    ? `Meta login succeeded, but granted permissions could not be verified. ${sources.join(" | ")}`
    : "Meta login succeeded, but granted permissions could not be verified.";
}

async function recordMetaConnectFailure({
  db,
  tenant = {},
  actor = "system",
  reasonCode = "meta_connect_failed",
  message = "Meta connect failed",
  status = 409,
  stage = "callback",
  metaUserProfile = {},
  requestedScopes = META_DM_LAUNCH_SCOPES,
  grantedScopes = [],
  permissionSummary = {},
  pageDiscovery = {},
  candidateCount = 0,
  log = createSafeLogger(),
} = {}) {
  const connectDiagnostic = buildPendingMetaConnectDiagnosticPayload({
    actor,
    stage,
    reasonCode,
    message,
    metaUserProfile,
    requestedScopes,
    grantedScopes,
    permissionSummary,
    pageDiscovery,
    candidateCount,
  });

  await savePendingMetaConnectDiagnostic(
    db,
    tenant.id,
    connectDiagnostic,
    actor || "system"
  );

  await auditSafe(
    db,
    actor,
    tenant,
    "settings.channel.meta.connect_failed",
    "tenant_channel",
    "instagram",
    {
      reasonCode: connectDiagnostic.reasonCode,
      stage: connectDiagnostic.stage,
      message: connectDiagnostic.message,
      metaUserId: connectDiagnostic.metaUserId || null,
      requestedScopes: connectDiagnostic.requestedScopes,
      grantedScopes: connectDiagnostic.grantedScopes,
      missingGrantedScopes: connectDiagnostic.missingGrantedScopes,
      declinedScopes: connectDiagnostic.declinedScopes,
      expiredScopes: connectDiagnostic.expiredScopes,
      permissionVerificationStatus:
        connectDiagnostic.permissionVerificationStatus || null,
      permissionSource: connectDiagnostic.permissionSource || null,
      pageDiscovery: connectDiagnostic.pageDiscovery,
      candidateCount: connectDiagnostic.candidateCount,
    }
  );

  log.warn("meta.connect.failed", {
    tenantKey: s(tenant?.tenant_key),
    reasonCode: connectDiagnostic.reasonCode,
    stage: connectDiagnostic.stage,
    metaUserId: connectDiagnostic.metaUserId || null,
    requestedScopes: connectDiagnostic.requestedScopes,
    grantedScopes: connectDiagnostic.grantedScopes,
    missingGrantedScopes: connectDiagnostic.missingGrantedScopes,
    permissionVerificationStatus:
      connectDiagnostic.permissionVerificationStatus || null,
    permissionSource: connectDiagnostic.permissionSource || null,
    pageDiscovery: connectDiagnostic.pageDiscovery,
    candidateCount: connectDiagnostic.candidateCount,
  });

  throw buildMetaConnectFailureError(reasonCode, message, {
    status,
    details: {
      stage,
    },
  });
}

async function loadMetaSecretsContext(db, tenantId) {
  const secrets = await getMetaSecrets(db, tenantId);
  let pendingSelection = readPendingMetaSelection(secrets);
  let pendingSelectionExpired = false;
  let connectDiagnostic = readPendingMetaConnectDiagnostic(secrets);
  let connectDiagnosticExpired = false;

  if (pendingSelection && hasPendingMetaSelectionExpired(pendingSelection)) {
    await deleteMetaSecretKeys(db, tenantId, [META_CONNECT_SELECTION_SECRET_KEY]);
    delete secrets[META_CONNECT_SELECTION_SECRET_KEY];
    pendingSelection = null;
    pendingSelectionExpired = true;
  }

  if (
    connectDiagnostic &&
    hasPendingMetaConnectDiagnosticExpired(connectDiagnostic)
  ) {
    await deleteMetaSecretKeys(db, tenantId, [META_CONNECT_DIAGNOSTIC_SECRET_KEY]);
    delete secrets[META_CONNECT_DIAGNOSTIC_SECRET_KEY];
    connectDiagnostic = null;
    connectDiagnosticExpired = true;
  }

  return {
    secrets,
    pendingSelection,
    pendingSelectionExpired,
    connectDiagnostic,
    connectDiagnosticExpired,
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
  userAccessToken = "",
  requestedScopes = META_DM_LAUNCH_SCOPES,
  grantedScopes = [],
  permissionSummary = {},
  getMetaPageAccessContextForUserTokenFn = getMetaPageAccessContextForUserToken,
  syncInstagramSourceLayerFn = syncInstagramSourceLayer,
  log = createSafeLogger(),
} = {}) {
  const connectedAt = new Date().toISOString();
  const resolvedSelected = await resolveInstagramPageAccessToken({
    selected,
    userAccessToken,
    getMetaPageAccessContextForUserTokenFn,
  });

  log.info("meta.connect.page_access_token.resolved", {
    tenantKey: s(tenant?.tenant_key),
    pageId: resolvedSelected.pageId,
    igUserId: resolvedSelected.igUserId,
    pageAccessTokenPresent: Boolean(s(resolvedSelected.pageAccessToken)),
  });

  await deleteMetaSecretKeys(db, tenant.id, [
    META_CONNECT_SELECTION_SECRET_KEY,
    META_CONNECT_DIAGNOSTIC_SECRET_KEY,
  ]);
  const savedPageToken = await saveMetaPageAccessToken(
    db,
    tenant.id,
    resolvedSelected.pageAccessToken,
    actor || "system"
  );
  log.info("meta.connect.secret_saved", {
    tenantKey: s(tenant?.tenant_key),
    secretKey: "page_access_token",
    saved: Boolean(savedPageToken),
  });
  await deleteMetaSecretKeys(db, tenant.id, [
    "access_token",
    "meta_page_access_token",
    "page_id",
    "ig_user_id",
  ]);

  const channel = await upsertInstagramChannel(db, tenant.id, {
    provider: "meta",
    display_name: buildConnectedInstagramDisplayName(resolvedSelected),
    external_page_id: resolvedSelected.pageId,
    external_user_id: resolvedSelected.igUserId,
    external_username: cleanNullable(resolvedSelected.igUsername),
    status: "connected",
    is_primary: true,
    config: buildConnectedChannelConfig({
      selected: resolvedSelected,
      requestedScopes,
      grantedScopes,
      permissionSummary,
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
  log.info("meta.connect.channel_upserted", {
    tenantKey: s(tenant?.tenant_key),
    channelId: s(channel?.id),
    pageId: resolvedSelected.pageId,
    igUserId: resolvedSelected.igUserId,
    grantedScopes: normalizeScopeList(grantedScopes),
  });

  const syncResult = await syncInstagramSourceLayerFn({
    db,
    tenant,
    actor,
    selected: resolvedSelected,
    oauthScopes: requestedScopes,
  });
  const source = syncResult?.source || null;
  const capabilityGovernance = syncResult?.capabilityGovernance || null;
  const payload = buildMetaConnectSuccessPayload({
    selected: resolvedSelected,
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
      pageId: resolvedSelected.pageId,
      igUserId: resolvedSelected.igUserId,
      igUsername: resolvedSelected.igUsername || null,
      metaUserId: metaUserProfile.id || null,
      scopeModel: "instagram_dm_page_access",
      requestedScopes: buildRequestedScopeList(requestedScopes),
      grantedScopes: normalizeScopeList(grantedScopes),
      missingGrantedScopes: normalizeScopeList(
        permissionSummary?.missingRequiredScopes
      ),
      permissionVerificationStatus: s(permissionSummary?.verificationStatus),
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
    channel,
    source,
    capabilityGovernance,
    payload,
  };
}

async function persistMetaStatusDeauthorization({
  db,
  tenant,
  actor = "system",
  channel = null,
  reasonCode = "meta_app_deauthorized",
  verification = null,
  occurredAt = new Date().toISOString(),
  markInstagramSourceDisconnectedFn = markInstagramSourceDisconnected,
} = {}) {
  const snapshot = readMetaChannelSnapshot(channel || {});
  const safeReasonCode = s(reasonCode || "meta_app_deauthorized");

  await deleteMetaSecretKeys(db, tenant.id, [
    META_CONNECT_SELECTION_SECRET_KEY,
    META_CONNECT_DIAGNOSTIC_SECRET_KEY,
    "page_access_token",
    "access_token",
    "meta_page_access_token",
    "page_id",
    "ig_user_id",
  ]);

  const updatedChannel = await markInstagramDisconnected(
    db,
    tenant.id,
    buildInstagramLifecycleChannelPayload({
      channel,
      transition: "deauthorized",
      reasonCode: safeReasonCode,
      occurredAt,
    })
  );

  let capabilityGovernance = null;
  try {
    capabilityGovernance = await markInstagramSourceDisconnectedFn({
      db,
      tenant,
      actor,
      authStatus: "revoked",
    });
  } catch {}

  await auditSafe(
    db,
    actor,
    tenant,
    "settings.channel.meta.deauthorized",
    "tenant_channel",
    "instagram",
    {
      reasonCode: safeReasonCode,
      occurredAt,
      metaUserId: snapshot.metaUserId || null,
      pageId: snapshot.lastKnownPageId || null,
      igUserId: snapshot.lastKnownIgUserId || null,
      verification: verification?.metaError
        ? {
            status: verification.metaError.status,
            code: verification.metaError.code,
            subcode: verification.metaError.subcode,
            type: verification.metaError.type,
            message: verification.metaError.message,
          }
        : null,
      capabilityGovernance: {
        publishStatus: s(capabilityGovernance?.publishStatus),
        reviewRequired: !!capabilityGovernance?.reviewRequired,
        maintenanceSessionId: s(capabilityGovernance?.maintenanceSession?.id),
        blockedReason: s(capabilityGovernance?.blockedReason),
      },
    }
  );

  return updatedChannel;
}

function shouldVerifyLiveMetaStatus({ channel = null, secrets = {} } = {}) {
  if (!channel) return false;
  if (lower(channel?.status) !== "connected") return false;

  const snapshot = readMetaChannelSnapshot(channel);
  if (snapshot.connectionState && snapshot.connectionState !== "connected") {
    return false;
  }
  if (snapshot.authStatus && snapshot.authStatus !== "authorized") {
    return false;
  }

  return Boolean(
    readMetaPageAccessToken(secrets) &&
      s(channel?.external_page_id || snapshot.lastKnownPageId)
  );
}

async function refreshMetaStatusFromLiveVerification({
  db,
  tenant,
  actor = "system",
  channel = null,
  secrets = {},
  verifyMetaChannelAccessFn = verifyLiveMetaChannelAccess,
  markInstagramSourceDisconnectedFn = markInstagramSourceDisconnected,
} = {}) {
  if (!shouldVerifyLiveMetaStatus({ channel, secrets })) {
    return {
      channel,
      secrets,
    };
  }

  let verification = null;
  try {
    verification = await verifyMetaChannelAccessFn({
      channel,
      secrets,
    });
  } catch {
    return {
      channel,
      secrets,
    };
  }

  if (!verification?.revoked) {
    return {
      channel,
      secrets,
    };
  }

  const updatedChannel = await persistMetaStatusDeauthorization({
    db,
    tenant,
    actor,
    channel,
    reasonCode: verification.reasonCode || "meta_app_deauthorized",
    verification,
    markInstagramSourceDisconnectedFn,
  });

  const nextSecrets = { ...secrets };
  for (const key of [
    META_CONNECT_SELECTION_SECRET_KEY,
    META_CONNECT_DIAGNOSTIC_SECRET_KEY,
    "page_access_token",
    "access_token",
    "meta_page_access_token",
    "page_id",
    "ig_user_id",
  ]) {
    delete nextSecrets[key];
  }

  return {
    channel: updatedChannel,
    secrets: nextSecrets,
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
  connectDiagnostic = null,
} = {}) {
  const blockers = [];
  const hasIds = Boolean(
    s(channel?.external_page_id) || s(channel?.external_user_id)
  );

  if (pendingSelection?.required) {
    blockers.push({
      title:
        "Choose which Instagram Business account to bind to this tenant.",
      subtitle: `Meta returned ${pendingSelection.candidateCount} eligible Instagram Business / Professional asset${
        pendingSelection.candidateCount === 1 ? "" : "s"
      }. The tenant remains unbound until one account is explicitly selected.`,
      reasonCode: "instagram_account_selection_required",
      candidateCount: pendingSelection.candidateCount,
      expiresAt: pendingSelection.expiresAt,
    });
  }

  if (connectDiagnostic?.reasonCode) {
    const missingScopes = normalizeScopeList(
      connectDiagnostic?.missingGrantedScopes
    );
    const grantedScopes = normalizeScopeList(connectDiagnostic?.grantedScopes);
    const discoveredPageCount = Number(
      connectDiagnostic?.pageDiscovery?.pageCount || 0
    );

    let title = "The latest Instagram connect attempt failed.";
    let subtitle = s(connectDiagnostic?.message);

    if (connectDiagnostic.reasonCode === "meta_missing_granted_permissions") {
      title = "Meta did not grant every required permission for the latest connect attempt.";
      subtitle = `Missing: ${
        missingScopes.length ? missingScopes.join(", ") : "unknown"
      }. Granted: ${grantedScopes.length ? grantedScopes.join(", ") : "none"}.`;
    } else if (
      connectDiagnostic.reasonCode === "meta_permissions_verification_failed"
    ) {
      title =
        "Meta login succeeded, but the app could not verify which permissions were granted.";
    } else if (connectDiagnostic.reasonCode === "meta_pages_not_returned") {
      title = "Meta authorized the user, but page discovery returned zero Facebook Pages.";
      if (
        s(connectDiagnostic?.permissionVerificationStatus) === "verified" &&
        discoveredPageCount === 0
      ) {
        subtitle =
          "The latest reconnect produced no page assets for this app grant. Reconnect and reselect the correct Facebook Page in Business Integrations.";
      }
    } else if (
      connectDiagnostic.reasonCode === "meta_no_instagram_business_account"
    ) {
      title =
        "Meta returned Facebook Pages, but none exposed a linked Instagram Business account.";
    } else if (
      connectDiagnostic.reasonCode === "meta_page_access_token_missing"
    ) {
      title =
        "Meta exposed the page/Instagram asset, but page access token resolution failed.";
    }

    blockers.push({
      title,
      subtitle: subtitle || "Inspect the latest connect diagnostic and retry.",
      reasonCode: connectDiagnostic.reasonCode,
      createdAt: connectDiagnostic.createdAt,
      expiresAt: connectDiagnostic.expiresAt,
      missingGrantedScopes: missingScopes,
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
  connectDiagnostic = null,
} = {}) {
  if (selectionRequired) {
    return "Instagram connect is waiting for an explicit account selection before this tenant can be bound.";
  }

  if (connectDiagnostic?.reasonCode) {
    return "The latest Instagram connect attempt failed before this tenant could be rebound.";
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
  connectDiagnostic = null,
} = {}) {
  const capability = getTenantCapability(tenant, "metaChannelConnect");
  const oauthEnvReady = hasMetaOauthEnv();
  const gatewayReady = hasMetaGatewayEnv();
  const snapshot = readMetaChannelSnapshot(channel || {});
  const pendingSelectionView = buildPendingMetaSelectionView({
    pendingSelection: pendingSelection || readPendingMetaSelection(secrets),
    tenantKey: tenant?.tenant_key,
  });
  const connectDiagnosticView = buildPendingMetaConnectDiagnosticView(
    connectDiagnostic || readPendingMetaConnectDiagnostic(secrets)
  );
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
    } else if (connectDiagnosticView?.reasonCode) {
      state = "not_connected";
      reasonCode = connectDiagnosticView.reasonCode;
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
    reasonCode = oauthEnvReady
      ? "user_disconnect"
      : "meta_oauth_env_missing";
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
  const deliveryReady =
    state === "connected" && hasIds && hasToken && gatewayReady;
  const blockers = buildMetaStatusBlockers({
    state,
    reasonCode,
    channel,
    hasToken,
    oauthEnvReady,
    gatewayReady,
    capability,
    pendingSelection: pendingSelectionView,
    connectDiagnostic: connectDiagnosticView,
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
      username:
        snapshot.igUsername || cleanNullable(channel?.external_username),
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
    lastConnectFailure: connectDiagnosticView,
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
      missingGrantedScopes: snapshot.missingGrantedScopes,
      declinedScopes: snapshot.declinedScopes,
      expiredScopes: snapshot.expiredScopes,
      permissionVerificationStatus: cleanNullable(
        snapshot.permissionVerificationStatus
      ),
      permissionScopeSource: cleanNullable(snapshot.permissionScopeSource),
      permissionVerifiedAt: cleanNullable(snapshot.permissionVerifiedAt),
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
      primary: selectionRequired
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
      nextAction: selectionRequired
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
        connectDiagnostic: connectDiagnosticView,
      }),
      blockers,
    }),
  };
}

export async function buildMetaOAuthUrl({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  const actor = getReqActor(req);
  const log = createSafeLogger(req?.log, {
    flow: "meta_connect",
    stage: "build_oauth_url",
    tenantKey,
  });
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

  await deleteMetaSecretKeys(db, tenant.id, [
    META_CONNECT_SELECTION_SECRET_KEY,
    META_CONNECT_DIAGNOSTIC_SECRET_KEY,
  ]);

  const state = signState({
    tenantKey,
    actor,
    exp: Date.now() + 10 * 60 * 1000,
  });

  const url = new URL("https://www.facebook.com/v23.0/dialog/oauth");
  url.searchParams.set("client_id", s(cfg.meta.appId));
  url.searchParams.set("redirect_uri", s(cfg.meta.redirectUri));
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_DM_LAUNCH_SCOPES.join(","));

  log.info("meta.connect.oauth_url_built", {
    tenantKey,
    actor,
    requestedScopes: [...META_DM_LAUNCH_SCOPES],
    clearedTransientSecrets: [
      META_CONNECT_SELECTION_SECRET_KEY,
      META_CONNECT_DIAGNOSTIC_SECRET_KEY,
    ],
  });

  return url.toString();
}

export async function handleMetaCallback({
  db,
  req,
  exchangeCodeForUserTokenFn = exchangeCodeForUserToken,
  getMetaUserProfileFn = getMetaUserProfile,
  getMetaPermissionsForUserTokenFn = getMetaPermissionsForUserToken,
  debugMetaUserTokenFn = debugMetaUserToken,
  getPagesForUserTokenFn = getPagesForUserToken,
  getAssignedPagesForUserTokenFn = getAssignedPagesForUserToken,
  getMetaPageInstagramContextForUserTokenFn = getMetaPageInstagramContextForUserToken,
  getMetaPageInstagramContextForPageTokenFn = getMetaPageInstagramContextForPageToken,
  getMetaPageAccessContextForUserTokenFn = getMetaPageAccessContextForUserToken,
  syncInstagramSourceLayerFn = syncInstagramSourceLayer,
} = {}) {
  const code = s(req.query.code);
  const error = s(req.query.error);
  const errorCode = s(req.query.error_code);
  const errorMessage = s(req.query.error_message);
  const stateRaw = s(req.query.state);
  const callbackLog = createSafeLogger(req?.log, {
    flow: "meta_connect",
    stage: "callback",
  });

  callbackLog.info("meta.connect.callback_entered", {
    hasCode: Boolean(code),
    hasErrorQuery: Boolean(error || errorCode || errorMessage),
    errorCode: cleanNullable(errorCode),
  });

  if (error || errorCode || errorMessage) {
    callbackLog.warn("meta.connect.callback_meta_error", {
      error: cleanNullable(error || errorMessage),
      errorCode: cleanNullable(errorCode),
    });
    return {
      type: "redirect_or_error",
      redirectUrl: buildRedirectUrl({
        section: "channels",
        meta_error: errorMessage || error || "Meta connect failed",
        meta_reason: "meta_oauth_error",
      }),
      error: errorMessage || error || "Meta connect failed",
      reasonCode: "meta_oauth_error",
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

  const actorLog = createSafeLogger(req?.log, {
    flow: "meta_connect",
    stage: "callback",
    tenantKey: state.tenantKey,
    actor,
  });

  await deleteMetaSecretKeys(db, tenant.id, [
    META_CONNECT_SELECTION_SECRET_KEY,
    META_CONNECT_DIAGNOSTIC_SECRET_KEY,
  ]);

  const tokenJson = await exchangeCodeForUserTokenFn(code);
  const userAccessToken = s(tokenJson?.access_token);
  actorLog.info("meta.connect.token_exchanged", {
    tenantKey: tenant.tenant_key,
    hasUserAccessToken: Boolean(userAccessToken),
    tokenType: cleanNullable(tokenJson?.token_type),
    expiresIn:
      Number.isFinite(Number(tokenJson?.expires_in))
        ? Number(tokenJson?.expires_in)
        : null,
  });

  if (!userAccessToken) {
    await recordMetaConnectFailure({
      db,
      tenant,
      actor,
      reasonCode: "meta_user_access_token_missing",
      message: "Meta user access token missing",
      status: 409,
      stage: "token_exchange",
      requestedScopes: META_DM_LAUNCH_SCOPES,
      log: actorLog,
    });
  }

  const permissionCheckedAt = new Date().toISOString();
  const [
    metaUserProfile,
    permissionsResult,
    debugTokenResult,
    pageDiscoveryResult,
  ] = await Promise.all([
    getMetaUserProfileFn(userAccessToken),
    getMetaPermissionsForUserTokenFn(userAccessToken)
      .then((payload) => ({ payload }))
      .catch((error) => ({ error })),
    debugMetaUserTokenFn(userAccessToken)
      .then((payload) => ({ payload }))
      .catch((error) => ({ error })),
    discoverMetaPagesForUserToken({
      userAccessToken,
      getPagesForUserTokenFn,
      getAssignedPagesForUserTokenFn,
    }),
  ]);
  const permissionSummary = buildMetaPermissionSummary({
    requestedScopes: META_DM_LAUNCH_SCOPES,
    permissionsPayload: permissionsResult?.payload,
    debugTokenPayload: debugTokenResult?.payload,
    permissionsError: permissionsResult?.error,
    debugTokenError: debugTokenResult?.error,
    verifiedAt: permissionCheckedAt,
  });
  const rawPageDiscovery = buildMetaPageDiscoverySummary({
    sourceResults: pageDiscoveryResult?.sourceResults,
    pages: pageDiscoveryResult?.pages,
  });

  actorLog.info("meta.connect.permissions_verified", {
    tenantKey: tenant.tenant_key,
    requestedScopes: permissionSummary.requestedScopes,
    grantedScopes: permissionSummary.grantedScopes,
    missingGrantedScopes: permissionSummary.missingRequiredScopes,
    declinedScopes: permissionSummary.declinedScopes,
    expiredScopes: permissionSummary.expiredScopes,
    verificationStatus: permissionSummary.verificationStatus,
    permissionSource: permissionSummary.source,
    debugToken: {
      available: permissionSummary.debugToken.available,
      isValid: permissionSummary.debugToken.isValid,
      appId: permissionSummary.debugToken.appId || null,
      userId: permissionSummary.debugToken.userId || null,
      scopes: permissionSummary.debugToken.scopes,
      granularScopes: permissionSummary.debugToken.granularScopes,
    },
  });
  actorLog.info("meta.connect.meta_user_loaded", {
    tenantKey: tenant.tenant_key,
    metaUserId: cleanNullable(metaUserProfile?.id),
    metaUserName: cleanNullable(metaUserProfile?.name),
  });
  actorLog.info("meta.connect.page_discovery.completed", {
    tenantKey: tenant.tenant_key,
    pageDiscovery: rawPageDiscovery,
  });

  if (!s(metaUserProfile?.id)) {
    await recordMetaConnectFailure({
      db,
      tenant,
      actor,
      reasonCode: "meta_user_profile_missing",
      message: "Meta app user id missing",
      status: 409,
      stage: "profile",
      metaUserProfile,
      requestedScopes: META_DM_LAUNCH_SCOPES,
      grantedScopes: permissionSummary.grantedScopes,
      permissionSummary,
      pageDiscovery: rawPageDiscovery,
      log: actorLog,
    });
  }

  if (!permissionSummary.verificationAvailable) {
    await recordMetaConnectFailure({
      db,
      tenant,
      actor,
      reasonCode: "meta_permissions_verification_failed",
      message: buildMetaVerificationUnavailableMessage(permissionSummary),
      status: 409,
      stage: "permissions",
      metaUserProfile,
      requestedScopes: META_DM_LAUNCH_SCOPES,
      grantedScopes: permissionSummary.grantedScopes,
      permissionSummary,
      pageDiscovery: rawPageDiscovery,
      log: actorLog,
    });
  }

  if (permissionSummary.missingRequiredScopes.length) {
    await recordMetaConnectFailure({
      db,
      tenant,
      actor,
      reasonCode: "meta_missing_granted_permissions",
      message: buildMissingPermissionsMessage(permissionSummary),
      status: 409,
      stage: "permissions",
      metaUserProfile,
      requestedScopes: META_DM_LAUNCH_SCOPES,
      grantedScopes: permissionSummary.grantedScopes,
      permissionSummary,
      pageDiscovery: rawPageDiscovery,
      log: actorLog,
    });
  }

  if (!arr(pageDiscoveryResult?.pages).length) {
    await recordMetaConnectFailure({
      db,
      tenant,
      actor,
      reasonCode: "meta_pages_not_returned",
      message: buildMetaNoPagesReturnedMessage(permissionSummary),
      status: 409,
      stage: "page_discovery",
      metaUserProfile,
      requestedScopes: META_DM_LAUNCH_SCOPES,
      grantedScopes: permissionSummary.grantedScopes,
      permissionSummary,
      pageDiscovery: rawPageDiscovery,
      log: actorLog,
    });
  }

  const enrichedPages = await enrichMetaPagesForCandidateDiscovery({
    pages: pageDiscoveryResult.pages,
    userAccessToken,
    getMetaPageInstagramContextForUserTokenFn,
    getMetaPageInstagramContextForPageTokenFn,
    log: actorLog,
  });

  const candidates = listInstagramPageCandidates(enrichedPages);
  const enrichedPageDiscovery = buildMetaPageDiscoverySummary({
    sourceResults: pageDiscoveryResult?.sourceResults,
    pages: pageDiscoveryResult?.pages,
    enrichedPages,
    candidates,
  });
  actorLog.info("meta.connect.page_enrichment.completed", {
    tenantKey: tenant.tenant_key,
    pageDiscovery: enrichedPageDiscovery,
  });

  if (!candidates.length) {
    await recordMetaConnectFailure({
      db,
      tenant,
      actor,
      reasonCode: "meta_no_instagram_business_account",
      message:
        "Facebook Pages were returned, but no linked Instagram Business account could be found",
      status: 409,
      stage: "page_enrichment",
      metaUserProfile,
      requestedScopes: META_DM_LAUNCH_SCOPES,
      grantedScopes: permissionSummary.grantedScopes,
      permissionSummary,
      pageDiscovery: enrichedPageDiscovery,
      candidateCount: 0,
      log: actorLog,
    });
  }

  if (candidates.length > 1) {
    const pendingSelection = buildPendingMetaSelectionPayload({
      actor,
      metaUserProfile,
      tokenJson,
      requestedScopes: META_DM_LAUNCH_SCOPES,
      grantedScopes: permissionSummary.grantedScopes,
      candidates,
    });

    await savePendingMetaSelection(db, tenant.id, pendingSelection, actor);
    await deleteMetaSecretKeys(db, tenant.id, [META_CONNECT_DIAGNOSTIC_SECRET_KEY]);

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
          igSource: candidate.igSource || null,
        })),
        metaUserId: metaUserProfile.id || null,
      }
    );
    actorLog.info("meta.connect.selection_required", {
      tenantKey: tenant.tenant_key,
      candidateCount: candidates.length,
      grantedScopes: permissionSummary.grantedScopes,
    });

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
  let connectResult = null;
  try {
    connectResult = await connectInstagramChannel({
      db,
      tenant,
      actor,
      selected,
      metaUserProfile,
      tokenJson,
      userAccessToken,
      requestedScopes: META_DM_LAUNCH_SCOPES,
      grantedScopes: permissionSummary.grantedScopes,
      permissionSummary,
      getMetaPageAccessContextForUserTokenFn,
      syncInstagramSourceLayerFn,
      log: actorLog,
    });
  } catch (error) {
    await recordMetaConnectFailure({
      db,
      tenant,
      actor,
      reasonCode: s(error?.reasonCode || "meta_connect_persistence_failed"),
      message: s(error?.message || "Failed to complete Meta connect"),
      status: Number(error?.status || 409),
      stage: "connect",
      metaUserProfile,
      requestedScopes: META_DM_LAUNCH_SCOPES,
      grantedScopes: permissionSummary.grantedScopes,
      permissionSummary,
      pageDiscovery: enrichedPageDiscovery,
      candidateCount: candidates.length,
      log: actorLog,
    });
  }

  actorLog.info("meta.connect.redirecting", {
    tenantKey: tenant.tenant_key,
    outcome: "success",
    reasonCode: null,
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
  getMetaPageAccessContextForUserTokenFn = getMetaPageAccessContextForUserToken,
  syncInstagramSourceLayerFn = syncInstagramSourceLayer,
} = {}) {
  const tenantKey = getReqTenantKey(req);
  const actor = getReqActor(req);
  const log = createSafeLogger(req?.log, {
    flow: "meta_connect",
    stage: "selection_complete",
    tenantKey,
    actor,
  });
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

  const { pendingSelection, pendingSelectionExpired } =
    await loadMetaSecretsContext(db, tenant.id);

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
    const err = new Error(
      "Instagram selection has been replaced by a newer connect attempt"
    );
    err.status = 409;
    throw err;
  }

  const selected = findSelectionCandidate(pendingSelection, candidateId);
  if (!selected) {
    const err = new Error(
      "Selected Instagram account was not found in the pending connect session"
    );
    err.status = 400;
    throw err;
  }

  const metaUserProfile = {
    id: pendingSelection.metaUserId,
    name: pendingSelection.metaUserName,
  };

  let connectResult = null;
  try {
    connectResult = await connectInstagramChannel({
      db,
      tenant,
      actor,
      selected,
      metaUserProfile,
      tokenJson: {
        token_type: pendingSelection.tokenType,
        userTokenExpiresAt: pendingSelection.userTokenExpiresAt,
      },
      userAccessToken: pendingSelection.userAccessToken,
      requestedScopes: pendingSelection.requestedScopes,
      grantedScopes: pendingSelection.grantedScopes,
      permissionSummary: {
        grantedScopes: pendingSelection.grantedScopes,
        missingRequiredScopes: [],
        declinedScopes: [],
        expiredScopes: [],
        verificationStatus: "verified",
        source: "pending_selection",
        verifiedAt: pendingSelection.createdAt,
      },
      getMetaPageAccessContextForUserTokenFn,
      syncInstagramSourceLayerFn,
      log,
    });
  } catch (error) {
    await recordMetaConnectFailure({
      db,
      tenant,
      actor,
      reasonCode: s(error?.reasonCode || "meta_selection_connect_failed"),
      message: s(
        error?.message || "Failed to finalize Instagram account selection"
      ),
      status: Number(error?.status || 409),
      stage: "selection_connect",
      metaUserProfile,
      requestedScopes: pendingSelection.requestedScopes,
      grantedScopes: pendingSelection.grantedScopes,
      permissionSummary: {
        grantedScopes: pendingSelection.grantedScopes,
        verificationStatus: "verified",
        source: "pending_selection",
        verifiedAt: pendingSelection.createdAt,
      },
      pageDiscovery: {
        sources: [
          {
            source: "pending_selection",
            count: pendingSelection.candidates.length,
            error: null,
            sample: pendingSelection.candidates.slice(0, 5).map((candidate) => ({
              pageId: candidate.pageId,
              pageName: candidate.pageName,
              hasPageAccessToken: Boolean(s(candidate.pageAccessToken)),
              hasInstagramAccount: true,
              instagramSource: null,
            })),
          },
        ],
        pageCount: pendingSelection.candidates.length,
        withAccessTokenCount: pendingSelection.candidates.filter((candidate) =>
          s(candidate.pageAccessToken)
        ).length,
        withInstagramAccountCount: pendingSelection.candidates.length,
        candidateCount: pendingSelection.candidates.length,
        samplePages: pendingSelection.candidates.slice(0, 5).map((candidate) => ({
          pageId: candidate.pageId,
          pageName: candidate.pageName,
          hasPageAccessToken: Boolean(s(candidate.pageAccessToken)),
          hasInstagramAccount: true,
          instagramSource: null,
        })),
      },
      candidateCount: pendingSelection.candidates.length,
      log,
    });
  }
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
  log.info("meta.connect.selection_completed", {
    tenantKey: tenant.tenant_key,
    selectionId: pendingSelection.selectionId,
    candidateId: selected.id,
    sourceId: source?.id || null,
  });

  return connectResult?.payload;
}

export async function getMetaStatus({
  db,
  req,
  verifyMetaChannelAccessFn = verifyLiveMetaChannelAccess,
  markInstagramSourceDisconnectedFn = markInstagramSourceDisconnected,
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

  const [channel, secretsContext] = await Promise.all([
    getPrimaryInstagramChannel(db, tenant.id),
    loadMetaSecretsContext(db, tenant.id),
  ]);
  const refreshed = await refreshMetaStatusFromLiveVerification({
    db,
    tenant,
    actor: getReqActor(req),
    channel,
    secrets: secretsContext.secrets,
    verifyMetaChannelAccessFn,
    markInstagramSourceDisconnectedFn,
  });

  return buildMetaStatusPayload({
    tenant,
    channel: refreshed.channel,
    secrets: refreshed.secrets,
    pendingSelection:
      readPendingMetaSelection(refreshed.secrets) ||
      secretsContext.pendingSelection,
    connectDiagnostic:
      readPendingMetaConnectDiagnostic(refreshed.secrets) ||
      secretsContext.connectDiagnostic,
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
  const { pendingSelection, connectDiagnostic } = await loadMetaSecretsContext(
    db,
    tenant.id
  );
  const disconnectedAt = new Date().toISOString();

  await deleteMetaSecretKeys(db, tenant.id, [
    META_CONNECT_SELECTION_SECRET_KEY,
    META_CONNECT_DIAGNOSTIC_SECRET_KEY,
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

  if (!currentChannel?.id) {
    if (connectDiagnostic?.diagnosticId) {
      await auditSafe(
        db,
        actor,
        tenant,
        "settings.channel.meta.diagnostic_cleared",
        "tenant_channel",
        "instagram",
        {
          diagnosticId: connectDiagnostic.diagnosticId,
          reasonCode: connectDiagnostic.reasonCode,
          clearedAt: disconnectedAt,
          preservedState: "not_connected",
        }
      );
    }

    return {
      disconnected: true,
      clearedPendingSelection: Boolean(pendingSelection?.selectionId),
      clearedConnectDiagnostic: Boolean(connectDiagnostic?.diagnosticId),
      channel: "instagram",
      disconnectedAt,
      preservedState: "not_connected",
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
