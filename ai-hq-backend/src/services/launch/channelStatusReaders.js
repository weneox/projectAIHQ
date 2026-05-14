import crypto from "crypto";

import { cfg } from "../../config.js";
import {
  dbDeleteTenantSecret,
  dbGetTenantProviderSecrets,
} from "../../db/helpers/tenantSecrets.js";
import { dbUpsertTenantChannel } from "../../db/helpers/settings.js";
import { dbAudit } from "../../db/helpers/audit.js";
import { createTenantSourcesHelpers } from "../../db/helpers/tenantSources.js";
import { createTenantKnowledgeHelpers } from "../../db/helpers/tenantKnowledge.js";
import {
  dbGetLatestTenantDomainVerification,
  dbGetTenantDomainVerification,
} from "../../db/helpers/tenantDomainVerifications.js";
import { refreshTenantRuntimeProjectionStrict } from "../../db/helpers/tenantRuntimeProjection.js";
import { runWithSystemDbContext } from "../../db/tenantContext.js";
import { getTenantByKey } from "../../platform/tenancy/repository.js";
import {
  getPrimaryTelegramChannel,
  getTelegramSecrets,
  TELEGRAM_BOT_TOKEN_SECRET_KEY,
} from "../../platform/channels/telegramRepository.js";
import {
  buildOperationalRepairGuidance,
  buildReadinessSurface,
} from "../operationalReadiness.js";
import { getTenantCapability } from "../tenantEntitlements.js";
import { getTenantBrainRuntime } from "../businessBrain/getTenantBrainRuntime.js";
import { getInboxPolicy } from "../inboxPolicy.js";
import {
  emitRuntimeProjectionBlockedConsumer,
  emitRuntimeProjectionHealthTransition,
  emitRuntimeProjectionRepairFailed,
  emitRuntimeProjectionRepairSkipped,
  emitRuntimeProjectionRepairStarted,
  emitRuntimeProjectionRepairSucceeded,
} from "../runtimeProjectionObservability.js";
import {
  getTelegramBotMe,
  getTelegramWebhookInfo,
  maskTelegramToken,
  redactTelegramWebhookUrl,
} from "../../utils/telegram.js";
import { getNormalizedAuthRole } from "../../utils/auth.js";
import { canManageSettings } from "../../utils/roles.js";
import { normalizeOriginValue } from "../../utils/securitySurface.js";
import {
  buildWebsiteChatInstallPlan,
} from "../websiteChatInstallMethods.js";
import {
  buildWebsiteDomainVerificationPayload,
  WEBSITE_DOMAIN_VERIFICATION_ENFORCEMENT,
  normalizeWebsiteVerificationDomain,
  shouldAllowUnverifiedWebsiteWidgetHandoffs,
  WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
} from "../websiteDomainVerification.js";

const META_PROVIDER = "meta";
const INSTAGRAM_CHANNEL = "instagram";
const TELEGRAM_CHANNEL_TYPE = "telegram";
const TELEGRAM_DEFAULT_NAME = "Telegram";
const TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY = "webhook_route_token";
const TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY = "webhook_secret_token";
const WEBSITE_WIDGET_CHANNEL = "webchat";
const WEBSITE_WIDGET_PROVIDER = "website_widget";
const ACTIVE_WIDGET_STATUSES = new Set(["active", "connected"]);

const META_DM_LAUNCH_SCOPES = Object.freeze([
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
  "instagram_basic",
  "instagram_manage_messages",
]);
const META_DM_EXCLUDED_SCOPES = Object.freeze([
  "instagram_manage_comments",
  "instagram_content_publish",
]);
const META_PHASE_TWO_CAPABILITIES = Object.freeze([
  "comments",
  "content_publish",
]);
const META_CONNECT_SELECTION_SECRET_KEY = "connect_selection_pending";
const META_CONNECT_SELECTION_KIND = "meta_connect_selection";
const META_CONNECT_DIAGNOSTIC_SECRET_KEY = "connect_diagnostic_pending";
const META_CONNECT_DIAGNOSTIC_KIND = "meta_connect_diagnostic";
const META_CONNECT_SELECTION_TTL_MS = 15 * 60 * 1000;
const META_CONNECT_DIAGNOSTIC_TTL_MS = 15 * 60 * 1000;
const META_USER_TOKEN_EXPIRING_SOON_MS = 10 * 60 * 1000;
const META_DM_LAUNCH_REVIEW_STORY =
  "Businesses connect their own Instagram Business / Professional account and the platform helps them manage inbound customer conversations using tenant-specific business settings and runtime.";
const META_DM_WEBHOOK_SUBSCRIPTION_MISSING_REASON =
  "meta_instagram_subscription_missing";
const META_DM_WEBHOOK_SUBSCRIPTION_FAILED_REASON =
  "meta_instagram_subscription_failed";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function cleanNullable(value) {
  const text = s(value);
  return text || null;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniq(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function truncate(value, limit = 280) {
  const text = s(value);
  if (!text || text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function getReqTenantKey(req) {
  return lower(req?.auth?.tenantKey || "");
}

function getReqActor(req) {
  return s(req?.auth?.email || req?.auth?.userId || "system");
}

function createHttpError(message, status = 400, reasonCode = "") {
  const error = new Error(message);
  error.status = status;
  if (reasonCode) error.reasonCode = reasonCode;
  return error;
}

function stateSecret() {
  return s(
    cfg.auth.userSessionSecret ||
      cfg.auth.adminSessionSecret ||
      cfg.meta.appSecret,
    ""
  );
}

function signState(payload) {
  const json = JSON.stringify(payload || {});
  const body = Buffer.from(json, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", stateSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function metaGraphBase() {
  return `https://graph.facebook.com/${s(cfg.meta.apiVersion, "v23.0")}`;
}

async function getProviderSecrets(db, tenantId, provider) {
  return dbGetTenantProviderSecrets(db, tenantId, provider);
}

async function deleteProviderSecretKeys(db, tenantId, provider, secretKeys = []) {
  let deleted = 0;

  for (const secretKey of Array.isArray(secretKeys) ? secretKeys : []) {
    const ok = await dbDeleteTenantSecret(db, tenantId, provider, secretKey);
    if (ok) deleted += 1;
  }

  return deleted;
}

async function getPrimaryChannel(db, tenantId, channelType) {
  const safeChannelType = s(channelType).toLowerCase();
  if (!safeChannelType || !/^[a-z_]+$/.test(safeChannelType)) {
    return null;
  }

  const q = await db.query(
    `
      select *
      from tenant_channels
      where tenant_id = $1
        and channel_type = '${safeChannelType}'
      order by is_primary desc, updated_at desc
      limit 1
    `,
    [tenantId]
  );

  return q?.rows?.[0] || null;
}

async function upsertChannel(db, tenantId, channelType, payload) {
  return dbUpsertTenantChannel(db, tenantId, channelType, payload);
}

async function getMetaSecrets(db, tenantId) {
  return getProviderSecrets(db, tenantId, META_PROVIDER);
}

async function deleteMetaSecretKeys(
  db,
  tenantId,
  secretKeys = ["page_access_token"]
) {
  return deleteProviderSecretKeys(db, tenantId, META_PROVIDER, secretKeys);
}

async function getPrimaryInstagramChannel(db, tenantId) {
  return getPrimaryChannel(db, tenantId, INSTAGRAM_CHANNEL);
}

async function markInstagramDisconnected(
  db,
  tenantId,
  {
    displayName = "Instagram",
    status = "disconnected",
    config = {},
    health = {},
    isPrimary = true,
    lastSyncAt = null,
  } = {}
) {
  return upsertChannel(db, tenantId, INSTAGRAM_CHANNEL, {
    provider: META_PROVIDER,
    display_name: s(displayName, "Instagram"),
    external_account_id: null,
    external_page_id: null,
    external_user_id: null,
    external_username: null,
    status: s(status, "disconnected"),
    is_primary: Boolean(isPrimary),
    config,
    secrets_ref: null,
    health,
    last_sync_at: lastSyncAt,
  });
}

async function auditSafe(
  db,
  actor,
  tenant,
  action,
  objectType,
  objectId,
  meta = {}
) {
  try {
    await dbAudit(db, s(actor, "system"), action, objectType, objectId, {
      tenantId: tenant?.id || null,
      tenantKey: tenant?.tenant_key || null,
      ...meta,
    });
  } catch {}
}

function normalizeScopeList(values = []) {
  return uniq(values);
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

function buildRequestedScopeList(values = []) {
  const requested = normalizeScopeList(values);
  return requested.length ? requested : [...META_DM_LAUNCH_SCOPES];
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

function readPendingMetaSelection(secrets = {}) {
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

function readPendingMetaConnectDiagnostic(secrets = {}) {
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
  const webhookSubscriptionRequired =
    health.webhook_subscription_required === false ||
    config.webhook_subscription_required === false
      ? false
      : true;
  const webhookSubscriptionOk =
    !webhookSubscriptionRequired ||
    health.webhook_subscription_ok === true ||
    config.webhook_subscription_ok === true;

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
    excludedScopes: uniq(
      arr(config.excluded_scopes).length
        ? config.excluded_scopes
        : META_DM_EXCLUDED_SCOPES
    ),
    phaseTwoCapabilities: uniq(
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
    webhookSubscriptionRequired,
    webhookSubscriptionMode: s(
      health.webhook_subscription_mode || config.webhook_subscription_mode
    ),
    webhookSubscriptionOk,
    webhookSubscriptionAt: s(
      health.webhook_subscription_at || config.webhook_subscription_at
    ),
    webhookSubscriptionPageId: s(
      health.webhook_subscription_page_id ||
        config.webhook_subscription_page_id
    ),
    webhookSubscriptionSource: s(
      health.webhook_subscription_source ||
        config.webhook_subscription_source
    ),
    webhookSubscriptionReason: s(
      health.webhook_subscription_reason ||
        config.webhook_subscription_reason
    ),
  };
}

function buildInstagramLifecycleChannelPayload({
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

async function markInstagramSourceDisconnected({
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
    await deleteMetaSecretKeys(db, tenantId, [
      META_CONNECT_DIAGNOSTIC_SECRET_KEY,
    ]);
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
  hasSubscription = false,
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
        "META_APP_ID, META_CONNECT_APP_SECRET (or legacy META_APP_SECRET), and META_REDIRECT_URI must all be configured before connect or reconnect can start.",
      reasonCode,
      envKeys: [
        "META_APP_ID",
        "META_CONNECT_APP_SECRET",
        "META_APP_SECRET",
        "META_REDIRECT_URI",
      ],
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

  if (
    (reasonCode === META_DM_WEBHOOK_SUBSCRIPTION_MISSING_REASON ||
      reasonCode === META_DM_WEBHOOK_SUBSCRIPTION_FAILED_REASON) &&
    !hasSubscription
  ) {
    blockers.push({
      title: "Instagram webhook subscription is not active.",
      subtitle:
        "Instagram DM automation stays fail-closed until the connected Instagram professional account is subscribed to this app webhook.",
      reasonCode,
      target: {
        section: "channels",
        channelType: "instagram",
        provider: "meta",
      },
    });
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
        "The current tenant channel is connected, but META_APP_ID, META_CONNECT_APP_SECRET (or legacy META_APP_SECRET), and META_REDIRECT_URI are required before a future reconnect can start.",
      reasonCode: "meta_oauth_env_missing",
      envKeys: [
        "META_APP_ID",
        "META_CONNECT_APP_SECRET",
        "META_APP_SECRET",
        "META_REDIRECT_URI",
      ],
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
  const hasSubscription = snapshot.webhookSubscriptionOk === true;
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
  } else if (connectedByRow && !hasSubscription) {
    state = oauthEnvReady ? "reconnect_required" : "blocked";
    reasonCode = oauthEnvReady
      ? s(
          snapshot.webhookSubscriptionReason ||
            META_DM_WEBHOOK_SUBSCRIPTION_MISSING_REASON
        )
      : "meta_oauth_env_missing";
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

  const webhookReady = state === "connected" && hasIds && hasSubscription;
  const deliveryReady =
    state === "connected" &&
    hasIds &&
    hasToken &&
    hasSubscription &&
    gatewayReady;
  const blockers = buildMetaStatusBlockers({
    state,
    reasonCode,
    channel,
    hasToken,
    hasSubscription,
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
      hasWebhookSubscription: hasSubscription,
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

function trimSlash(value) {
  return s(value).replace(/\/+$/, "");
}

function epochSecondsToIso(value) {
  const seconds = Number(value || 0);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null;
}

function isTelegramWebhookDeliveryFailing(webhookInfo = null) {
  const info = obj(webhookInfo);
  const pendingUpdateCount = Number(info?.pending_update_count || 0);
  const lastErrorMessage = s(info?.last_error_message);

  return (
    pendingUpdateCount > 0 &&
    /wrong response from the webhook:\s*403\b/i.test(lastErrorMessage)
  );
}

function normalizeUrlForCompare(value = "") {
  const raw = s(value);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    if (
      (parsed.protocol === "https:" && parsed.port === "443") ||
      (parsed.protocol === "http:" && parsed.port === "80")
    ) {
      parsed.port = "";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function hasUsableTelegramWebhookBaseUrl() {
  const baseUrl = s(cfg.telegram.webhookBaseUrl);
  if (!baseUrl) return false;

  try {
    return lower(new URL(baseUrl).protocol) === "https:";
  } catch {
    return false;
  }
}

function buildTelegramError(message, status = 500, reasonCode = "") {
  const err = new Error(s(message || "Telegram operation failed"));
  err.status = Number(status || 500);
  err.reasonCode = s(reasonCode);
  return err;
}

function buildTelegramDisplayName(bot = {}, fallback = TELEGRAM_DEFAULT_NAME) {
  const username = s(bot?.username);
  if (username) return `Telegram @${username}`;

  const firstName = s(bot?.first_name);
  if (firstName) return `Telegram ${firstName}`;

  return s(fallback || TELEGRAM_DEFAULT_NAME);
}

function sanitizeLastConnectFailure(value = null) {
  const failure = obj(value);
  if (!s(failure.reasonCode)) return null;

  return {
    reasonCode: s(failure.reasonCode),
    message: s(failure.message),
    stage: s(failure.stage),
    occurredAt: s(failure.occurredAt),
  };
}

function getTelegramSnapshot(channel = {}) {
  const config = obj(channel?.config);
  const health = obj(channel?.health);

  return {
    displayName: s(
      channel?.display_name ||
        config.last_connected_display_name ||
        TELEGRAM_DEFAULT_NAME
    ),
    botUserId: s(channel?.external_user_id || config.bot_user_id),
    botUsername: s(channel?.external_username || config.bot_username),
    botFirstName: s(config.bot_first_name),
    botLastName: s(config.bot_last_name),
    botCanJoinGroups: config.bot_can_join_groups === true,
    botCanReadAllGroupMessages:
      config.bot_can_read_all_group_messages === true,
    botSupportsInlineQueries: config.bot_supports_inline_queries === true,
    lastConnectedAt: s(config.last_connected_at || health.last_connected_at),
    expectedWebhookUrl: s(config.expected_webhook_url || health.webhook_url),
    connectionState: s(health.connection_state || channel?.status),
    authStatus: s(health.auth_status),
    disconnectReason: s(config.disconnect_reason || health.disconnect_reason),
    disconnectedAt: s(health.disconnected_at),
    lastVerifiedAt: s(health.last_verified_at),
    lastConnectFailure: sanitizeLastConnectFailure(health?.last_connect_failure),
  };
}

function buildTelegramWebhookUrl({
  tenantKey = "",
  routeToken = "",
  webhookBaseUrl = cfg.telegram.webhookBaseUrl,
} = {}) {
  const baseUrl = trimSlash(webhookBaseUrl);
  const safeTenantKey = s(tenantKey);
  const safeRouteToken = s(routeToken);

  if (!baseUrl || !safeTenantKey || !safeRouteToken) return "";

  return `${baseUrl}/api/channels/telegram/webhook/${encodeURIComponent(
    safeTenantKey
  )}/${encodeURIComponent(safeRouteToken)}`;
}

async function getScopedTelegramTenant(db, req) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    throw buildTelegramError("Missing tenant context", 401);
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    throw buildTelegramError("Tenant not found", 400);
  }

  return tenant;
}

async function loadTelegramStatusContext(db, tenantId = "") {
  const [channel, secrets] = await Promise.all([
    getPrimaryTelegramChannel(db, tenantId),
    getTelegramSecrets(db, tenantId),
  ]);

  return {
    channel,
    secrets,
  };
}

function getTelegramFeatureState() {
  const enabled = Boolean(cfg.telegram.enabled);
  const webhookBaseReady = hasUsableTelegramWebhookBaseUrl();

  return {
    enabled,
    webhookBaseReady,
    ready: enabled && webhookBaseReady,
    reasonCode: !enabled
      ? "telegram_disabled"
      : !webhookBaseReady
        ? "telegram_webhook_base_url_missing"
        : "",
  };
}

function normalizeTelegramReasonCodes(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => lower(item))
        .filter(Boolean)
    ),
  ];
}

function buildTelegramFailureFreshness(failure = {}, tenantKey = "") {
  const authority = obj(failure?.authority);
  return {
    stale: failure?.reasonCode !== "approved_truth_unavailable",
    reasons: normalizeTelegramReasonCodes(failure?.freshnessReasonCodes),
    tenantId: s(authority?.tenantId),
    tenantKey: s(authority?.tenantKey || tenantKey),
    runtimeProjectionId: s(authority?.runtimeProjectionId),
    runtimeStatus: s(authority?.runtimeProjectionStatus),
  };
}

function buildTelegramFailureHealth(failure = {}) {
  const authority = obj(failure?.authority);
  const health = obj(authority?.health);
  if (s(health?.status)) return health;

  const primaryReasonCode =
    s(failure?.healthPrimaryReasonCode) ||
    s(failure?.healthReasonCodes?.[0]) ||
    s(failure?.reasonCode || "runtime_authority_unavailable");
  const reasonCodes = normalizeTelegramReasonCodes([
    primaryReasonCode,
    ...(Array.isArray(failure?.healthReasonCodes)
      ? failure.healthReasonCodes
      : []),
  ]);
  const status =
    primaryReasonCode === "approved_truth_unavailable" ? "blocked" : "stale";

  return {
    status,
    primaryReasonCode,
    reasonCodes,
    autonomousOperation: status === "healthy" ? "continue" : "stop",
    repairActions:
      status === "blocked"
        ? [{ action: "verify_truth_publish" }]
        : [{ action: "refresh_projection" }],
  };
}

function buildTelegramHealthyHealth(authority = null) {
  const health = obj(obj(authority).health);
  if (s(health.status)) return health;
  return {
    status: "healthy",
    primaryReasonCode: "",
    reasonCodes: [],
    autonomousOperation: "continue",
    repairActions: [],
  };
}

function extractTelegramRuntimeAuthorityPayload(error = {}) {
  const authority = obj(error?.runtimeAuthority || error?.authority);
  const health = obj(authority?.health);
  const wrapperReasonCode = lower(
    authority?.reasonCode ||
      authority?.reason ||
      error?.reasonCode ||
      error?.reason ||
      "runtime_authority_unavailable"
  );
  const healthPrimaryReasonCode = lower(
    health?.primaryReasonCode || health?.reasonCode
  );
  const healthReasonCodes = normalizeTelegramReasonCodes(health?.reasonCodes);
  const freshnessReasonCodes = normalizeTelegramReasonCodes(
    authority?.freshnessReasons || authority?.reasons || error?.freshness?.reasons
  );

  const reasonCode =
    healthPrimaryReasonCode ||
    healthReasonCodes[0] ||
    freshnessReasonCodes[0] ||
    wrapperReasonCode ||
    "runtime_authority_unavailable";

  return {
    reasonCode,
    wrapperReasonCode,
    healthPrimaryReasonCode,
    healthReasonCodes,
    freshnessReasonCodes,
    authority: Object.keys(authority).length ? authority : null,
    error: s(error?.message || error),
  };
}

function shouldAttemptTelegramRuntimeRepair(failure = {}, error = {}) {
  const repairableReasonCodes = new Set([
    "projection_missing",
    "runtime_projection_missing",
    "projection_stale",
    "runtime_projection_stale",
    "truth_version_drift",
    "projection_build_failed",
    "runtime_status_not_ready",
    "published_truth_version_mismatch",
    "source_snapshot_mismatch",
    "source_profile_mismatch",
    "source_capabilities_mismatch",
    "authority_invalid",
  ]);

  const candidateReasonCodes = normalizeTelegramReasonCodes([
    failure?.reasonCode,
    failure?.wrapperReasonCode,
    failure?.healthPrimaryReasonCode,
    ...(Array.isArray(failure?.healthReasonCodes)
      ? failure.healthReasonCodes
      : []),
    ...(Array.isArray(failure?.freshnessReasonCodes)
      ? failure.freshnessReasonCodes
      : []),
  ]);

  if (s(error?.code).toUpperCase() === "TENANT_RUNTIME_PROJECTION_STALE") {
    return true;
  }

  return candidateReasonCodes.some((code) =>
    repairableReasonCodes.has(code)
  );
}

function buildTelegramRuntimeSurfaceFromRuntime({
  runtime = null,
  tenantKey = "",
  getInboxPolicyFn = getInboxPolicy,
} = {}) {
  const authority = runtime?.authority || null;
  const tenant = runtime?.tenant || null;
  const authorityAvailable = Boolean(authority?.available !== false && tenant);
  const policy = tenant
    ? getInboxPolicyFn({
        tenantKey,
        channel: TELEGRAM_CHANNEL_TYPE,
        tenant,
      })
    : null;
  const channelAllowed = Boolean(policy?.channelAllowed);

  return {
    ready: authorityAvailable,
    authorityAvailable,
    channelAllowed,
    deliveryReady: authorityAvailable && channelAllowed,
    reasonCode: authorityAvailable
      ? channelAllowed
        ? ""
        : "channel_not_allowed"
      : s(
          authority?.reasonCode ||
            authority?.reason ||
            "runtime_authority_unavailable"
        ),
    authority,
  };
}

async function getTelegramRuntimeSurface({
  db,
  tenantKey = "",
  allowRepair = false,
  repairTrigger = "telegram_status",
  requestedBy = "system",
  getRuntime = getTenantBrainRuntime,
  refreshRuntimeProjection = refreshTenantRuntimeProjectionStrict,
  getInboxPolicyFn = getInboxPolicy,
  logger = null,
} = {}) {
  if (!db?.query || !tenantKey) {
    return {
      ready: false,
      authorityAvailable: false,
      channelAllowed: false,
      deliveryReady: false,
      reasonCode: "runtime_authority_unavailable",
      authority: null,
    };
  }

  try {
    const runtime = await getRuntime({
      db,
      tenantKey,
      authorityMode: "strict",
    });

    return buildTelegramRuntimeSurfaceFromRuntime({
      runtime,
      tenantKey,
      getInboxPolicyFn,
    });
  } catch (error) {
    const failure = extractTelegramRuntimeAuthorityPayload(error);
    const failureFreshness = buildTelegramFailureFreshness(failure, tenantKey);
    const failureHealth = buildTelegramFailureHealth(failure);

    emitRuntimeProjectionHealthTransition({
      logger,
      health: failureHealth,
      freshness: failureFreshness,
      runtimeProjection: {
        id: s(failure?.authority?.runtimeProjectionId),
        status: s(failure?.authority?.runtimeProjectionStatus),
      },
      tenantId: s(failure?.authority?.tenantId),
      tenantKey: s(failure?.authority?.tenantKey || tenantKey),
      triggerSource: "channelConnect.telegram",
      repairTrigger: s(repairTrigger || "telegram_status"),
      requestedBy: s(requestedBy || "system"),
    });

    if (
      allowRepair &&
      shouldAttemptTelegramRuntimeRepair(failure, error) &&
      typeof refreshRuntimeProjection === "function"
    ) {
      const startedAt = Date.now();
      emitRuntimeProjectionRepairStarted({
        logger,
        previousHealth: failureHealth,
        freshness: failureFreshness,
        runtimeProjection: {
          id: s(failure?.authority?.runtimeProjectionId),
          status: s(failure?.authority?.runtimeProjectionStatus),
        },
        tenantId: s(failure?.authority?.tenantId),
        tenantKey: s(failure?.authority?.tenantKey || tenantKey),
        triggerSource: "channelConnect.telegram",
        repairTrigger: s(repairTrigger || "telegram_status"),
        requestedBy: s(requestedBy || "system"),
      });

      try {
        await refreshRuntimeProjection(
          {
            tenantKey,
            triggerType: "channel_connect_telegram",
            requestedBy: s(requestedBy || "system"),
            runnerKey: "channelConnect.telegram.runtimeRepair",
            generatedBy: s(requestedBy || "system"),
            metadata: {
              source: "channelConnect.telegram",
              repairTrigger: s(repairTrigger || "telegram_status"),
              previousWrapperReasonCode: s(failure.wrapperReasonCode),
              previousReasonCode: s(failure.reasonCode),
              previousHealthReasonCodes: failure.healthReasonCodes || [],
              previousFreshnessReasonCodes: failure.freshnessReasonCodes || [],
            },
          },
          db
        );

        const runtime = await getRuntime({
          db,
          tenantKey,
          authorityMode: "strict",
        });
        const runtimeSurface = buildTelegramRuntimeSurfaceFromRuntime({
          runtime,
          tenantKey,
          getInboxPolicyFn,
        });
        const recoveredAuthority = runtimeSurface?.authority || runtime?.authority;
        const recoveredFreshness = {
          stale: false,
          reasons: [],
          tenantId: s(recoveredAuthority?.tenantId),
          tenantKey: s(recoveredAuthority?.tenantKey || tenantKey),
          runtimeProjectionId: s(recoveredAuthority?.runtimeProjectionId),
          runtimeStatus: s(recoveredAuthority?.runtimeProjectionStatus),
        };
        const recoveredHealth = buildTelegramHealthyHealth(recoveredAuthority);

        emitRuntimeProjectionHealthTransition({
          logger,
          health: recoveredHealth,
          freshness: recoveredFreshness,
          runtimeProjection: {
            id: s(recoveredAuthority?.runtimeProjectionId),
            status: s(recoveredAuthority?.runtimeProjectionStatus || "ready"),
          },
          tenantId: s(recoveredAuthority?.tenantId),
          tenantKey: s(recoveredAuthority?.tenantKey || tenantKey),
          triggerSource: "channelConnect.telegram",
          repairTrigger: s(repairTrigger || "telegram_status"),
          requestedBy: s(requestedBy || "system"),
          durationMs: Date.now() - startedAt,
        });

        emitRuntimeProjectionRepairSucceeded({
          logger,
          previousHealth: failureHealth,
          nextHealth: recoveredHealth,
          freshness: recoveredFreshness,
          runtimeProjection: {
            id: s(recoveredAuthority?.runtimeProjectionId),
            status: s(recoveredAuthority?.runtimeProjectionStatus || "ready"),
            projection_hash: s(recoveredAuthority?.projectionHash),
          },
          previousRuntimeProjectionId: s(failure?.authority?.runtimeProjectionId),
          previousProjectionHash: s(failure?.authority?.projectionHash),
          tenantId: s(recoveredAuthority?.tenantId),
          tenantKey: s(recoveredAuthority?.tenantKey || tenantKey),
          triggerSource: "channelConnect.telegram",
          repairTrigger: s(repairTrigger || "telegram_status"),
          requestedBy: s(requestedBy || "system"),
          durationMs: Date.now() - startedAt,
        });

        return runtimeSurface;
      } catch (repairError) {
        const repairFailure = extractTelegramRuntimeAuthorityPayload(repairError);
        const repairFailureFreshness = buildTelegramFailureFreshness(
          repairFailure,
          tenantKey
        );

        emitRuntimeProjectionRepairFailed({
          logger,
          previousHealth: failureHealth,
          nextHealth: buildTelegramFailureHealth(repairFailure),
          freshness: repairFailureFreshness,
          runtimeProjection: {
            id: s(repairFailure?.authority?.runtimeProjectionId),
            status: s(repairFailure?.authority?.runtimeProjectionStatus),
          },
          tenantId: s(repairFailure?.authority?.tenantId),
          tenantKey: s(repairFailure?.authority?.tenantKey || tenantKey),
          triggerSource: "channelConnect.telegram",
          repairTrigger: s(repairTrigger || "telegram_status"),
          requestedBy: s(requestedBy || "system"),
          durationMs: Date.now() - startedAt,
          reasonCode: s(repairFailure.reasonCode),
          error: repairError,
        });

        emitRuntimeProjectionBlockedConsumer({
          logger,
          consumer: s(repairTrigger || "telegram_status"),
          tenantId: s(repairFailure?.authority?.tenantId),
          tenantKey: s(repairFailure?.authority?.tenantKey || tenantKey),
          authority: repairFailure.authority,
        });

        return {
          ready: false,
          authorityAvailable: false,
          channelAllowed: false,
          deliveryReady: false,
          reasonCode: repairFailure.reasonCode,
          authority: repairFailure.authority,
          error: repairFailure.error,
        };
      }
    }

    emitRuntimeProjectionRepairSkipped({
      logger,
      previousHealth: failureHealth,
      freshness: failureFreshness,
      runtimeProjection: {
        id: s(failure?.authority?.runtimeProjectionId),
        status: s(failure?.authority?.runtimeProjectionStatus),
      },
      tenantId: s(failure?.authority?.tenantId),
      tenantKey: s(failure?.authority?.tenantKey || tenantKey),
      triggerSource: "channelConnect.telegram",
      repairTrigger: s(repairTrigger || "telegram_status"),
      requestedBy: s(requestedBy || "system"),
      reasonCode:
        !allowRepair
          ? "repair_disabled"
          : typeof refreshRuntimeProjection !== "function"
            ? "repair_unavailable"
            : s(failure.reasonCode || "repair_skipped"),
    });

    emitRuntimeProjectionBlockedConsumer({
      logger,
      consumer: s(repairTrigger || "telegram_status"),
      tenantId: s(failure?.authority?.tenantId),
      tenantKey: s(failure?.authority?.tenantKey || tenantKey),
      authority: failure.authority,
    });

    return {
      ready: false,
      authorityAvailable: false,
      channelAllowed: false,
      deliveryReady: false,
      reasonCode: failure.reasonCode,
      authority: failure.authority,
      error: failure.error,
    };
  }
}

function buildTelegramStatusBlockers({
  feature = null,
  channel = null,
  botToken = "",
  routeToken = "",
  secretToken = "",
  expectedWebhookUrl = "",
  botResult = null,
  webhookResult = null,
  webhookUrlMatches = false,
  webhookDeliveryFailing = false,
  runtime = null,
} = {}) {
  const blockers = [];
  const featureState = feature || getTelegramFeatureState();

  if (!featureState.enabled) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "telegram_disabled",
        title: "Telegram integration is disabled",
        subtitle:
          "Enable TELEGRAM_ENABLED before relying on Telegram channel operations.",
        missingFields: ["TELEGRAM_ENABLED"],
      })
    );
  }

  if (featureState.enabled && !featureState.webhookBaseReady) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "telegram_webhook_base_url_missing",
        title: "Telegram webhook base URL is not configured",
        subtitle:
          "Set TELEGRAM_WEBHOOK_BASE_URL or PUBLIC_BASE_URL to a public HTTPS backend URL before connecting Telegram.",
        missingFields: ["TELEGRAM_WEBHOOK_BASE_URL_or_PUBLIC_BASE_URL"],
      })
    );
  }

  if (!channel?.id && !botToken) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "tenant_channel_missing",
        title: "Telegram channel is not connected",
        subtitle:
          "No tenant Telegram channel row or bot token is available for this tenant.",
        missingFields: ["tenant_channels", TELEGRAM_BOT_TOKEN_SECRET_KEY],
      })
    );
  } else if (!botToken) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "telegram_bot_token_missing",
        title: "Telegram bot token is missing",
        subtitle:
          "Reconnect Telegram so the tenant bot token can be validated and stored again.",
        missingFields: [TELEGRAM_BOT_TOKEN_SECRET_KEY],
      })
    );
  } else if (botResult && botResult.ok === false) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: botResult.reasonCode || "telegram_bot_token_invalid",
        title: "Telegram bot validation failed",
        subtitle: s(botResult.error || "Telegram rejected the stored bot token."),
        missingFields: [TELEGRAM_BOT_TOKEN_SECRET_KEY],
      })
    );
  }

  if (botToken) {
    if (!routeToken) {
      blockers.push(
        buildOperationalRepairGuidance({
          reasonCode: "telegram_webhook_route_missing",
          title: "Telegram webhook route token is missing",
          subtitle:
            "Reconnect Telegram so the tenant-bound webhook route can be restored.",
          missingFields: [TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY],
        })
      );
    }

    if (!secretToken) {
      blockers.push(
        buildOperationalRepairGuidance({
          reasonCode: "telegram_webhook_secret_missing",
          title: "Telegram webhook secret is missing",
          subtitle:
            "Reconnect Telegram so webhook secret verification can be enforced again.",
          missingFields: [TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY],
        })
      );
    }

    if (!expectedWebhookUrl) {
      blockers.push(
        buildOperationalRepairGuidance({
          reasonCode: "telegram_webhook_base_url_missing",
          title: "Telegram webhook URL cannot be built",
          subtitle:
            "The backend does not have a valid public HTTPS base URL for Telegram callbacks.",
          missingFields: ["TELEGRAM_WEBHOOK_BASE_URL_or_PUBLIC_BASE_URL"],
        })
      );
    } else if (webhookResult && webhookResult.ok === false) {
      blockers.push(
        buildOperationalRepairGuidance({
          reasonCode: webhookResult.reasonCode || "telegram_webhook_invalid",
          title: "Telegram webhook status could not be verified",
          subtitle: s(
            webhookResult.error ||
              "Telegram webhook health verification failed for this bot."
          ),
          missingFields: ["telegram_webhook"],
        })
      );
    } else if (webhookResult?.ok && !webhookUrlMatches) {
      blockers.push(
        buildOperationalRepairGuidance({
          reasonCode: "telegram_webhook_mismatch",
          title: "Telegram webhook does not point to this tenant route",
          subtitle:
            "Telegram is configured with a different webhook URL than the expected tenant-bound webhook path.",
          missingFields: ["telegram_webhook_url"],
        })
      );
    } else if (webhookDeliveryFailing) {
      blockers.push(
        buildOperationalRepairGuidance({
          reasonCode: "telegram_webhook_secret_invalid",
          title: "Telegram webhook is rejecting live deliveries",
          subtitle:
            "Telegram is still pointing at this tenant route, but the webhook is returning 403 to Telegram. Reconnect Telegram or relax strict secret-header verification if a proxy strips the Telegram secret header.",
          missingFields: ["telegram_webhook_secret_header_verification"],
        })
      );
    }
  }

  if (!runtime?.authorityAvailable) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: runtime?.reasonCode || "runtime_authority_unavailable",
        title: "Tenant runtime is unavailable",
        subtitle:
          "Inbound Telegram messages cannot reach the AI reply path until the approved runtime projection is ready.",
        missingFields: ["tenant_runtime_projection"],
      })
    );
  } else if (runtime?.channelAllowed === false) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "channel_not_allowed",
        title: "Telegram is blocked by inbox policy",
        subtitle:
          "The tenant runtime is loaded, but Telegram is not currently allowed by inbox policy.",
        missingFields: ["inbox_policy.allowedChannels"],
      })
    );
  }

  return blockers;
}

function buildTelegramStatusPayload({
  tenant = {},
  channel = null,
  secrets = {},
  botResult = null,
  webhookResult = null,
  runtime = null,
} = {}) {
  const snapshot = getTelegramSnapshot(channel);
  const botToken = s(secrets?.[TELEGRAM_BOT_TOKEN_SECRET_KEY]);
  const routeToken = s(secrets?.[TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY]);
  const secretToken = s(secrets?.[TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY]);
  const expectedWebhookUrl = buildTelegramWebhookUrl({
    tenantKey: tenant?.tenant_key,
    routeToken,
  });
  const webhookInfo = obj(webhookResult?.result);
  const actualWebhookUrl = s(webhookInfo?.url);

  const webhookUrlMatches =
    Boolean(expectedWebhookUrl) &&
    Boolean(actualWebhookUrl) &&
    normalizeUrlForCompare(expectedWebhookUrl) ===
      normalizeUrlForCompare(actualWebhookUrl);

  const webhookDeliveryFailing =
    webhookResult?.ok === true && isTelegramWebhookDeliveryFailing(webhookInfo);

  const feature = getTelegramFeatureState();
  const botIdentity = botResult?.ok ? obj(botResult.result) : {};
  const lastConnectFailure = sanitizeLastConnectFailure(snapshot.lastConnectFailure);

  const connected =
    Boolean(channel?.id) &&
    Boolean(botToken) &&
    botResult?.ok === true &&
    webhookResult?.ok === true &&
    webhookUrlMatches &&
    Boolean(secretToken) &&
    !webhookDeliveryFailing;

  let state = "not_connected";
  if (connected) {
    state = "connected";
  } else if (lower(channel?.status) === "connecting") {
    state = "connecting";
  } else if (
    lower(channel?.status) === "disconnected" &&
    !botToken &&
    !lastConnectFailure?.reasonCode
  ) {
    state = "disconnected";
  } else if (channel?.id || botToken || lastConnectFailure?.reasonCode) {
    state = "error";
  }

  const connectionReasonCode = connected
    ? ""
    : s(
        !feature.ready
          ? feature.reasonCode
          : !channel?.id && botToken
            ? "tenant_channel_missing"
            : !botToken
              ? lastConnectFailure?.reasonCode || "telegram_bot_token_missing"
              : botResult?.ok === false
                ? botResult.reasonCode
                : !routeToken
                  ? "telegram_webhook_route_missing"
                  : !secretToken
                    ? "telegram_webhook_secret_missing"
                    : !expectedWebhookUrl
                      ? "telegram_webhook_base_url_missing"
                      : webhookResult?.ok === false
                        ? webhookResult.reasonCode
                        : !webhookUrlMatches
                          ? "telegram_webhook_mismatch"
                          : webhookDeliveryFailing
                            ? "telegram_webhook_secret_invalid"
                            : lastConnectFailure?.reasonCode
      );

  const blockers = buildTelegramStatusBlockers({
    feature,
    channel,
    botToken,
    routeToken,
    secretToken,
    expectedWebhookUrl,
    botResult,
    webhookResult,
    webhookUrlMatches,
    webhookDeliveryFailing,
    runtime,
  });

  return {
    connected,
    state,
    reasonCode: cleanNullable(connectionReasonCode),
    channel: channel
      ? {
          id: channel.id,
          provider: channel.provider,
          channel_type: channel.channel_type,
          status: channel.status,
          displayName: snapshot.displayName,
          isPrimary: channel.is_primary === true,
          updatedAt: channel.updated_at || null,
          lastSyncAt: channel.last_sync_at || null,
        }
      : null,
    account: {
      displayName: buildTelegramDisplayName(botIdentity, snapshot.displayName),
      botUserId: cleanNullable(botIdentity?.id || snapshot.botUserId),
      botUsername: cleanNullable(botIdentity?.username || snapshot.botUsername),
      firstName: cleanNullable(botIdentity?.first_name || snapshot.botFirstName),
      lastName: cleanNullable(botIdentity?.last_name || snapshot.botLastName),
      canJoinGroups:
        botIdentity?.can_join_groups === true || snapshot.botCanJoinGroups,
      canReadAllGroupMessages:
        botIdentity?.can_read_all_group_messages === true ||
        snapshot.botCanReadAllGroupMessages,
      supportsInlineQueries:
        botIdentity?.supports_inline_queries === true ||
        snapshot.botSupportsInlineQueries,
      verified: botResult?.ok === true,
      botTokenMasked: cleanNullable(maskTelegramToken(botToken)),
    },
    webhook: {
      configured: Boolean(expectedWebhookUrl),
      verified:
        botResult?.ok === true &&
        webhookResult?.ok === true &&
        webhookUrlMatches &&
        Boolean(secretToken) &&
        !webhookDeliveryFailing,
      expectedUrl: cleanNullable(redactTelegramWebhookUrl(expectedWebhookUrl)),
      actualUrl: cleanNullable(redactTelegramWebhookUrl(actualWebhookUrl)),
      secretHeaderConfigured: Boolean(secretToken),
      pendingUpdateCount: Number(webhookInfo?.pending_update_count || 0),
      lastErrorAt: cleanNullable(
        epochSecondsToIso(webhookInfo?.last_error_date)
      ),
      lastErrorMessage: cleanNullable(webhookInfo?.last_error_message),
      ipAddress: cleanNullable(webhookInfo?.ip_address),
      reasonCode:
        webhookResult?.ok === false
          ? s(webhookResult.reasonCode || "")
          : !webhookUrlMatches && expectedWebhookUrl
            ? "telegram_webhook_mismatch"
            : webhookDeliveryFailing
              ? "telegram_webhook_secret_invalid"
              : "",
    },
    runtime: {
      ready: Boolean(runtime?.ready),
      authorityAvailable: Boolean(runtime?.authorityAvailable),
      channelAllowed: Boolean(runtime?.channelAllowed),
      deliveryReady: Boolean(connected && runtime?.deliveryReady),
      reasonCode: cleanNullable(runtime?.reasonCode),
      authority: runtime?.authority || null,
    },
    lifecycle: {
      connectedAt: cleanNullable(snapshot.lastConnectedAt),
      disconnectedAt: cleanNullable(snapshot.disconnectedAt),
      disconnectReason: cleanNullable(snapshot.disconnectReason),
      authStatus: cleanNullable(snapshot.authStatus),
      connectionState: cleanNullable(snapshot.connectionState),
      lastVerifiedAt: cleanNullable(snapshot.lastVerifiedAt),
      lastConnectFailure,
    },
    actions: {
      connectAvailable: !connected && feature.enabled,
      reconnectAvailable:
        !connected && Boolean(channel?.id || botToken) && feature.enabled,
      disconnectAvailable: Boolean(
        channel?.id || botToken || routeToken || secretToken
      ),
      webhookRetryAvailable:
        Boolean(botToken) &&
        botResult?.ok === true &&
        connected === false &&
        feature.ready,
    },
    readiness: buildReadinessSurface({
      status: blockers.length ? "blocked" : "ready",
      message: blockers.length
        ? connected
          ? "Telegram is connected to the bot, but delivery is blocked until the remaining blockers are repaired."
          : "Telegram is not fully connected for this tenant. Review the blockers before relying on live delivery."
        : "Telegram bot, webhook, and tenant runtime are ready for live delivery.",
      blockers,
    }),
  };
}

export async function getTelegramStatus({ db, req } = {}) {
  const tenant = await getScopedTelegramTenant(db, req);
  const actor = getReqActor(req);
  const { channel, secrets } = await loadTelegramStatusContext(db, tenant.id);
  const botToken = s(secrets?.[TELEGRAM_BOT_TOKEN_SECRET_KEY]);

  let botResult = null;
  let webhookResult = null;

  if (botToken) {
    botResult = await getTelegramBotMe({
      botToken,
      timeoutMs: cfg.telegram.statusTimeoutMs,
    });

    if (botResult.ok) {
      webhookResult = await getTelegramWebhookInfo({
        botToken,
        timeoutMs: cfg.telegram.statusTimeoutMs,
      });
    }
  }

  return buildTelegramStatusPayload({
    tenant,
    channel,
    secrets,
    botResult,
    webhookResult,
    runtime: await getTelegramRuntimeSurface({
      db,
      tenantKey: tenant.tenant_key,
      allowRepair: true,
      repairTrigger: "telegram_status",
      requestedBy: s(actor || "system"),
    }),
  });
}

function normalizeUrl(raw = "") {
  const value = s(raw);
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return {
      raw: value,
      href: parsed.href,
      origin: `${parsed.protocol}//${parsed.host}`.toLowerCase(),
      hostname: parsed.hostname.toLowerCase().replace(/^www\./, ""),
      host: parsed.host.toLowerCase(),
      pathname: parsed.pathname || "/",
    };
  } catch {
    return null;
  }
}

function normalizeWidgetPublicId(raw = "") {
  const value = lower(raw).replace(/[^a-z0-9_-]/g, "");
  if (!/^[a-z0-9][a-z0-9_-]{5,63}$/.test(value)) return "";
  return value;
}

function normalizeConfiguredList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => s(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n]/)
      .map((item) => s(item))
      .filter(Boolean);
  }

  return [];
}

function normalizeAllowedOrigins(config = {}) {
  return uniq(
    normalizeConfiguredList(
      config.allowedOrigins ||
        config.allowed_origins ||
        config.origins ||
        config.publicOrigins ||
        config.public_origins
    ).map((item) => lower(item))
  );
}

function normalizeAllowedDomains(config = {}) {
  return uniq(
    normalizeConfiguredList(
      config.allowedDomains ||
        config.allowed_domains ||
        config.allowedHosts ||
        config.allowed_hosts ||
        config.domains
    )
      .map((item) => {
        const asUrl = normalizeUrl(item);
        if (asUrl?.hostname) return asUrl.hostname;
        return lower(item).replace(/^www\./, "").replace(/^\*\./, "");
      })
      .filter(Boolean)
  );
}

function normalizeInstallAccessHints(config = {}) {
  const raw = obj(
    config.installAccessHints ||
      config.install_access_hints ||
      config.accessHints ||
      config.access_hints
  );

  const allowed = [
    "cmsAdmin",
    "googleTagManager",
    "cloudflare",
    "developer",
    "unknown",
  ];

  const next = {};

  for (const key of allowed) {
    if (typeof raw[key] === "boolean") {
      next[key] = raw[key];
    }
  }

  if (next.unknown === true) {
    for (const key of allowed) {
      next[key] = key === "unknown";
    }
  } else if (
    next.cmsAdmin === true ||
    next.googleTagManager === true ||
    next.cloudflare === true ||
    next.developer === true
  ) {
    next.unknown = false;
  }

  return next;
}

function normalizeInitialPrompts(config = {}) {
  return arr(
    config.initialPrompts || config.initial_prompts || config.quickReplies
  )
    .map((item) => truncate(item, 90))
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeWidgetConfig(raw = {}, { defaultEnabled = false } = {}) {
  const config = obj(raw);
  const explicitEnabled =
    typeof config.enabled === "boolean"
      ? config.enabled
      : typeof config.publicEnabled === "boolean"
        ? config.publicEnabled
        : null;

  return {
    enabled: explicitEnabled ?? Boolean(defaultEnabled),
    publicWidgetId: normalizeWidgetPublicId(
      config.publicWidgetId ||
        config.public_widget_id ||
        config.widgetPublicId ||
        config.widget_public_id ||
        config.widgetId ||
        config.widget_id
    ),
    allowedOrigins: normalizeAllowedOrigins(config),
    allowedDomains: normalizeAllowedDomains(config),
    title: truncate(config.title || config.widgetTitle || config.widget_title, 80),
    subtitle: truncate(
      config.subtitle || config.widgetSubtitle || config.widget_subtitle,
      140
    ),
    accentColor: s(
      config.accentColor || config.accent_color || config.brandColor || config.brand_color
    ),
    initialPrompts: normalizeInitialPrompts(config),
    installAccessHints: normalizeInstallAccessHints(config),
  };
}

function widgetStatusAllowsInstall(status = "") {
  const normalized = lower(status);
  if (!normalized) return true;
  return ACTIVE_WIDGET_STATUSES.has(normalized);
}

function resolveWidgetEnabled(tenant = {}) {
  const statusAllowsInstall = widgetStatusAllowsInstall(tenant.widgetChannelStatus);
  const config = normalizeWidgetConfig(tenant.widgetConfig, {
    defaultEnabled: statusAllowsInstall,
  });

  return config.enabled === true && statusAllowsInstall;
}

function requestHostOrigin(req) {
  const host =
    s(req?.headers?.["x-forwarded-host"]) ||
    s(req?.headers?.host) ||
    s(req?.get?.("host"));
  if (!host) return "";

  const forwardedProto = s(req?.headers?.["x-forwarded-proto"])
    .split(",")[0]
    .trim();
  const protocol = s(req?.protocol || forwardedProto || "").toLowerCase();
  const safeProtocol = protocol === "https" ? "https" : "http";

  return normalizeOriginValue(`${safeProtocol}://${host}`);
}

function buildWebsiteWidgetInstallSurface(req, tenant = {}) {
  const config = normalizeWidgetConfig(tenant.widgetConfig, {
    defaultEnabled: resolveWidgetEnabled(tenant),
  });
  const widgetBaseUrl = s(cfg.urls.publicBaseUrl) || requestHostOrigin(req);
  const apiOrigin = requestHostOrigin(req) || s(cfg.urls.publicBaseUrl);
  const scriptUrl = widgetBaseUrl
    ? `${widgetBaseUrl.replace(/\/+$/, "")}/website-widget-loader.js`
    : "";
  const apiBase = apiOrigin ? `${apiOrigin.replace(/\/+$/, "")}/api` : "/api";
  const snippet = config.publicWidgetId && scriptUrl
    ? `<script src="${scriptUrl}" data-widget-id="${config.publicWidgetId}" data-api-base="${apiBase}" async></script>`
    : "";

  return {
    widgetBaseUrl,
    apiBase,
    scriptUrl,
    iframePath: "/widget/website-chat",
    embedSnippet: snippet,
  };
}

function mapTenantRow(row = {}) {
  return {
    id: s(row.id),
    tenantKey: lower(row.tenant_key),
    companyName: truncate(
      row.company_name || row.widget_display_name || row.tenant_key,
      120
    ),
    timezone: s(row.timezone),
    websiteUrl: s(row.website_url),
    widgetChannelStatus: lower(row.widget_channel_status),
    widgetConfig: obj(row.widget_config),
  };
}

async function resolveWebsiteWidgetStatus(db, tenantKey = "") {
  if (!db?.query || !tenantKey) return null;

  const result = await runWithSystemDbContext(
    "website_widget_status_lookup",
    () => db.query(
    `
    select
      t.id,
      t.tenant_key,
      t.company_name,
      t.timezone,
      coalesce(tp.website_url, '') as website_url,
      coalesce(tc.id::text, '') as widget_channel_id,
      coalesce(tc.status, '') as widget_channel_status,
      coalesce(tc.display_name, '') as widget_display_name,
      coalesce(tc.provider, '') as widget_provider,
      coalesce(tc.config, '{}'::jsonb) as widget_config,
      coalesce(tc.updated_at::text, '') as widget_updated_at
    from tenants t
    left join tenant_profiles tp
      on tp.tenant_id = t.id
    left join lateral (
      select id, status, provider, display_name, config, updated_at
      from tenant_channels
      where tenant_id = t.id
        and channel_type = $2::text
      order by is_primary desc, updated_at desc
      limit 1
    ) tc on true
    where lower(t.tenant_key) = lower($1::text)
    limit 1
    `,
    [tenantKey, WEBSITE_WIDGET_CHANNEL]
  )
  );

  const row = result.rows?.[0] || null;
  if (!row) return null;

  return {
    ...mapTenantRow(row),
    widgetChannelId: s(row.widget_channel_id),
    widgetProvider: lower(row.widget_provider || WEBSITE_WIDGET_PROVIDER),
    widgetUpdatedAt: s(row.widget_updated_at),
  };
}

function buildWebsiteDomainCandidates(status = {}) {
  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(status.widgetChannelStatus),
  });

  const rawCandidates = [
    s(status.websiteUrl),
    ...config.allowedDomains,
    ...config.allowedOrigins
      .map((origin) => normalizeUrl(origin)?.hostname || "")
      .filter(Boolean),
  ];

  const candidates = [];

  for (const rawCandidate of rawCandidates) {
    const normalized = normalizeWebsiteVerificationDomain(rawCandidate);
    if (normalized.ok) {
      candidates.push(normalized.domain);
    }
  }

  return uniq(candidates);
}

function resolveWebsiteDomainSelection(rawDomain = "", status = {}, options = {}) {
  const requireDomain = options?.requireDomain === true;
  const candidateDomains = buildWebsiteDomainCandidates(status);
  const requested = s(rawDomain);

  if (requested) {
    const normalized = normalizeWebsiteVerificationDomain(requested);
    if (!normalized.ok) {
      throw createHttpError(
        normalized.detail,
        400,
        normalized.reasonCode || "website_domain_invalid"
      );
    }

    return {
      domain: normalized.domain,
      candidateDomains,
      requestedExplicitly: true,
    };
  }

  if (candidateDomains.length) {
    return {
      domain: candidateDomains[0],
      candidateDomains,
      requestedExplicitly: false,
    };
  }

  if (requireDomain) {
    throw createHttpError(
      "Add a public website domain or allowed domain before starting ownership verification.",
      400,
      "website_domain_missing"
    );
  }

  return {
    domain: "",
    candidateDomains,
    requestedExplicitly: false,
  };
}

async function loadWebsiteDomainVerificationSurface(
  db,
  status = {},
  { requestedDomain = "" } = {}
) {
  if (!status?.id) {
    return buildWebsiteDomainVerificationPayload(null, {
      candidateDomain: "",
      candidateDomains: [],
      enforcementActive: WEBSITE_DOMAIN_VERIFICATION_ENFORCEMENT,
    });
  }

  const selection = resolveWebsiteDomainSelection(requestedDomain, status);
  let record = null;

  if (selection.domain) {
    record = await dbGetTenantDomainVerification(db, status.id, {
      channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
      normalizedDomain: selection.domain,
    });
  }

  if (!record && !selection.requestedExplicitly) {
    record = await dbGetLatestTenantDomainVerification(db, status.id, {
      channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
    });
  }

  return buildWebsiteDomainVerificationPayload(record, {
    candidateDomain: selection.domain || record?.normalized_domain || "",
    candidateDomains: selection.candidateDomains,
    enforcementActive: WEBSITE_DOMAIN_VERIFICATION_ENFORCEMENT,
  });
}

function isProductionInstallBlocked(domainVerification = null) {
  const verification = obj(domainVerification);
  const readiness = obj(verification.readiness);

  return (
    verification.requiredForProductionInstall === true &&
    readiness.enforcementActive === true &&
    readiness.productionInstallReady !== true
  );
}

function resolveWebsiteInstallTargetDomain(domainVerification = null) {
  const verification = obj(domainVerification);
  return s(verification.domain || verification.candidateDomain);
}

function buildWebsiteInstallBaseBlockers(status = {}) {
  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(status.widgetChannelStatus),
  });
  const blockers = [];

  if (!config.publicWidgetId) {
    blockers.push({
      reasonCode: "website_widget_public_id_missing",
      title: "Public widget install ID has not been issued yet.",
      subtitle:
        "Save the website chat settings once to generate the publishable widget ID used by the loader install snippet.",
    });
  }

  if (
    !config.allowedOrigins.length &&
    !config.allowedDomains.length &&
    !s(status.websiteUrl)
  ) {
    blockers.push({
      reasonCode: "website_widget_origin_rules_missing",
      title: "No allowed website origin or domain has been configured yet.",
      subtitle:
        "Add exact origins, allowed domains, or a reference website URL before expecting public installs to verify successfully.",
    });
  }

  if (config.enabled !== true) {
    blockers.push({
      reasonCode: "website_widget_disabled",
      title: "Website chat is disabled.",
      subtitle:
        "The public loader will fail closed until this widget is explicitly enabled again.",
    });
  }

  if (config.enabled === true && !resolveWidgetEnabled(status)) {
    blockers.push({
      reasonCode: "website_widget_channel_inactive",
      title: "Website chat cannot launch because the website chat channel is not active.",
      subtitle:
        "Public website launches stay blocked until the website chat channel record is active again.",
    });
  }

  return blockers;
}

function buildWebsitePackageContract(packageType = "developer", contract = {}) {
  return {
    packageType: s(packageType, "developer").toLowerCase(),
    ready: contract.ready === true,
    productionReady: contract.productionReady === true,
    testingOnly: contract.testingOnly === true,
    targetDomain: s(contract.targetDomain),
    verificationState: s(contract.verificationState, "unverified"),
    verificationRequiredForProduction:
      contract.verificationRequiredForProduction !== false,
    blockingReasonCode: s(contract.blockingReasonCode),
    blockingMessage: s(contract.blockingMessage),
    message: s(contract.message),
  };
}

function buildWebsiteLaunchReadiness(
  req,
  status = {},
  domainVerification = null
) {
  const installSurface = buildWebsiteWidgetInstallSurface(req, status);
  const verification = obj(domainVerification);
  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(status.widgetChannelStatus),
  });
  const targetDomain = resolveWebsiteInstallTargetDomain(domainVerification);
  const baseBlockers = buildWebsiteInstallBaseBlockers(status);
  const productionBlocked = isProductionInstallBlocked(domainVerification);
  const unverifiedHandoffsAllowed =
    shouldAllowUnverifiedWebsiteWidgetHandoffs();
  const installSurfaceReady =
    Boolean(s(installSurface.scriptUrl)) &&
    Boolean(s(installSurface.apiBase)) &&
    Boolean(s(installSurface.embedSnippet));
  const channelConfigured = Boolean(s(status.widgetChannelId));
  const widgetEnabled = config.enabled === true;
  const launchEnabled = resolveWidgetEnabled(status);
  const publicWidgetIdPresent = Boolean(config.publicWidgetId);
  const allowedOriginsPresent = config.allowedOrigins.length > 0;
  const allowedDomainsPresent = config.allowedDomains.length > 0;
  const originRulesPresent =
    allowedOriginsPresent ||
    allowedDomainsPresent ||
    Boolean(s(status.websiteUrl));

  if (!targetDomain) {
    baseBlockers.push({
      reasonCode: "website_install_target_domain_missing",
      title: "No handoff target domain is available yet.",
      subtitle:
        "Add a public website URL or allowed domain before preparing a Website Chat install handoff.",
    });
  }

  if (!installSurfaceReady) {
    baseBlockers.push({
      reasonCode: "website_widget_install_surface_unavailable",
      title: "Website chat install assets are not addressable yet.",
      subtitle:
        "Set PUBLIC_BASE_URL or access this control-plane surface through the normal app host before preparing an install handoff.",
    });
  }

  const blockers = [...baseBlockers];

  if (widgetEnabled === true && productionBlocked === true) {
    blockers.push({
      reasonCode: s(
        verification.reasonCode,
        "website_domain_verification_required"
      ),
      title:
        "Website chat production install is blocked until domain ownership is verified.",
      subtitle: s(
        verification.message,
        "Create and verify a DNS TXT challenge for this domain before Website Chat can launch publicly."
      ),
    });
  }

  const configurationReady =
    launchEnabled && publicWidgetIdPresent && originRulesPresent;
  const baseReady = baseBlockers.length === 0;
  const productionLaunchAllowed = baseReady && productionBlocked !== true;
  const testingOnly =
    baseReady && productionBlocked === true && unverifiedHandoffsAllowed === true;

  let statusCode = "blocked";
  if (productionLaunchAllowed) statusCode = "production_ready";
  else if (testingOnly) statusCode = "testing_only";
  else if (!channelConfigured && !widgetEnabled && !publicWidgetIdPresent) {
    statusCode = "not_configured";
  }

  const primaryBlocker = obj(baseBlockers[0] || blockers[0]);
  const verificationBlocker = obj(blockers[blockers.length - 1]);
  const blockingReasonCode =
    baseReady && productionBlocked
      ? s(verification.reasonCode, "website_domain_verification_required")
      : s(primaryBlocker.reasonCode || verificationBlocker.reasonCode);
  const blockingMessage =
    baseReady && productionBlocked
      ? s(
        verification.message,
        "Create and verify a DNS TXT challenge for this domain before Website Chat can be installed on the public website."
      )
      : s(primaryBlocker.subtitle || verificationBlocker.subtitle);
  const message = productionLaunchAllowed
    ? "Website chat is configured with a publishable install ID, trusted origin controls, and verified domain ownership."
    : testingOnly
      ? "Developer, GTM, and WordPress install handoffs are available for local/dev/test only. DNS TXT verification is still required before public launch."
      : widgetEnabled !== true
        ? "Website chat is disabled until you intentionally enable and configure it."
        : launchEnabled !== true
          ? "Website chat is enabled in settings, but public launch is still blocked until the channel becomes active again."
          : configurationReady !== true
            ? "Website chat is enabled, but installation hardening is still incomplete."
            : s(
                primaryBlocker.subtitle || verification.message,
                "Website Chat is not ready for public launch yet."
              );
  const sharedPackageContract = {
    ready: baseReady && (productionBlocked !== true || unverifiedHandoffsAllowed),
    productionReady: productionLaunchAllowed,
    testingOnly,
    targetDomain,
    verificationState: s(verification.state, "unverified"),
    verificationRequiredForProduction: true,
    blockingReasonCode,
    blockingMessage,
    message:
      productionLaunchAllowed
        ? "Website Chat is ready for developer, GTM, and WordPress install handoffs."
        : testingOnly
          ? "Developer, GTM, and WordPress install handoffs are available for local/dev/test only. DNS TXT verification is still required before public launch."
          : s(
              primaryBlocker.subtitle || verification.message,
              "Website Chat is not ready for an install handoff yet."
            ),
  };

  return {
    status: statusCode,
    channelConfigured,
    configurationReady,
    widgetEnabled,
    launchEnabled,
    publicWidgetId: s(config.publicWidgetId),
    publicWidgetIdPresent,
    allowedOriginsPresent,
    allowedOriginCount: config.allowedOrigins.length,
    allowedDomainsPresent,
    allowedDomainCount: config.allowedDomains.length,
    originRulesPresent,
    targetDomain,
    domainVerificationRequired:
      verification.requiredForProductionInstall !== false,
    domainVerificationState: s(verification.state, "unverified"),
    domainVerified: verification.verified === true,
    productionBlocked,
    productionLaunchAllowed,
    productionReady: productionLaunchAllowed,
    testingOnly,
    testReady: productionLaunchAllowed || testingOnly,
    unverifiedHandoffsAllowed,
    installSurfaceReady,
    installSurface: {
      widgetBaseUrl: s(installSurface.widgetBaseUrl),
      apiBase: s(installSurface.apiBase),
      scriptUrl: s(installSurface.scriptUrl),
      iframePath: s(installSurface.iframePath),
      embedSnippetReady: installSurfaceReady,
    },
    reasonCode: blockingReasonCode,
    message,
    blockerReasonCodes: uniq(
      blockers.map((item) => s(item?.reasonCode)).filter(Boolean)
    ),
    blockers,
    handoffs: {
      developer: buildWebsitePackageContract("developer", sharedPackageContract),
      gtm: buildWebsitePackageContract("gtm", sharedPackageContract),
      wordpress: buildWebsitePackageContract("wordpress", sharedPackageContract),
    },
  };
}

function buildWebsiteInstallSurface(
  req,
  status = {},
  domainVerification = null,
  launchReadiness = null
) {
  const install = buildWebsiteWidgetInstallSurface(req, status);
  const launch = obj(
    launchReadiness || buildWebsiteLaunchReadiness(req, status, domainVerification)
  );
  const developerHandoff = obj(obj(launch.handoffs).developer);
  const gtmHandoff = obj(obj(launch.handoffs).gtm);
  const wordpressHandoff = obj(obj(launch.handoffs).wordpress);

  return {
    ...install,
    productionInstallReady: launch.productionLaunchAllowed === true,
    productionBlocked: launch.productionBlocked === true,
    blockReasonCode: s(launch.reasonCode),
    blockMessage: s(
      launch.productionBlocked
        ? developerHandoff.blockingMessage || launch.message
        : ""
    ),
    embedSnippet:
      launch.productionLaunchAllowed === true ? s(install.embedSnippet) : "",
    unverifiedHandoffsAllowed: launch.unverifiedHandoffsAllowed === true,
    handoffReady: developerHandoff.ready === true,
    developerHandoffReady: developerHandoff.ready === true,
    gtmHandoffReady: gtmHandoff.ready === true,
    wordpressHandoffReady: wordpressHandoff.ready === true,
    handoffTestingOnly: developerHandoff.testingOnly === true,
    handoffProductionReady: developerHandoff.productionReady === true,
    handoffTargetDomain: s(launch.targetDomain),
    handoffVerificationState: s(launch.domainVerificationState, "unverified"),
    handoffBlockReasonCode: s(developerHandoff.blockingReasonCode),
    handoffMessage: s(developerHandoff.message || launch.message),
    verificationRequiredForProduction: true,
    handoffs: launch.handoffs,
    launchReadiness: launch,
  };
}

function buildWebsiteGuidedSetupState({
  status = {},
  domainVerification = null,
  launchReadiness = null,
} = {}) {
  const verification = obj(domainVerification);
  const launch = obj(launchReadiness);
  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(status.widgetChannelStatus),
  });

  const hasDomain =
    Boolean(s(verification.domain || verification.candidateDomain)) ||
    Boolean(s(status.websiteUrl)) ||
    arr(config.allowedDomains).length > 0 ||
    arr(config.allowedOrigins).length > 0;

  const hasWidgetId = Boolean(s(config.publicWidgetId));
  const widgetEnabled = config.enabled === true;
  const verified =
    verification.verified === true ||
    s(verification.state).toLowerCase() === "verified";
  const productionReady =
    launch.productionLaunchAllowed === true ||
    launch.productionReady === true ||
    launch.productionInstallReady === true;

  let currentStep = "domain";
  if (hasDomain) currentStep = "ownership";
  if (verified) currentStep = "scan";
  if (verified && !productionReady) currentStep = "review";
  if (productionReady) currentStep = "install";

  function step(id, label, description, statusValue) {
    return { id, label, description, status: statusValue };
  }

  const steps = [
    step(
      "domain",
      "Add website domain",
      "Enter the public website that should power this assistant.",
      hasDomain ? "done" : "current"
    ),
    step(
      "ownership",
      "Verify ownership",
      "Confirm this business controls the domain before public launch.",
      !hasDomain ? "locked" : verified ? "done" : "current"
    ),
    step(
      "scan",
      "Prepare website AI",
      "AIHQ prepares a safe website source and scans content for review.",
      !verified ? "locked" : productionReady ? "done" : "running"
    ),
    step(
      "review",
      "Approve Business Info",
      "Review what the assistant is allowed to say before it goes live.",
      !verified ? "locked" : productionReady ? "done" : "current"
    ),
    step(
      "install",
      "Install widget",
      "Use the recommended WordPress, GTM, or developer install path.",
      productionReady ? "current" : "locked"
    ),
  ];

  let headline = "Connect your website AI";
  let message = "Add your domain and AIHQ will guide the rest.";
  let primaryAction = { label: "Add domain", action: "edit_settings" };

  if (hasDomain && !verified) {
    headline = "Verify your website";
    message =
      "Verification protects the widget and unlocks the guided install flow.";
    primaryAction = { label: "Verify domain", action: "verify_domain" };
  } else if (verified && !productionReady) {
    headline = "Your website AI is being prepared";
    message =
      "The domain is verified. Review Business Info before public launch.";
    primaryAction = {
      label: "Review Business Info",
      action: "open_truth",
      path: "/truth",
    };
  } else if (productionReady) {
    headline = "Website Chat is ready to install";
    message = "Choose the safest install package for this website.";
    primaryAction = { label: "Prepare install", action: "prepare_install" };
  } else if (hasWidgetId && widgetEnabled) {
    headline = "Finish website setup";
    message = "Complete verification to unlock public launch.";
    primaryAction = { label: "Continue setup", action: "verify_domain" };
  }

  return {
    mode: "guided",
    headline,
    message,
    currentStep,
    oneClickGoal:
      "Domain verification prepares website knowledge, Business Info review, and install handoff from one guided flow.",
    hasDomain,
    hasWidgetId,
    widgetEnabled,
    verified,
    productionReady,
    steps,
    primaryAction,
  };
}

function buildBlockers(launchReadiness = null) {
  return arr(obj(launchReadiness).blockers);
}

function buildWebsiteWidgetStatusPayload(
  req,
  status = {},
  viewerRole = "member",
  domainVerification = null
) {
  const verificationSurface =
    domainVerification ||
    buildWebsiteDomainVerificationPayload(null, {
      candidateDomain: "",
      candidateDomains: [],
      enforcementActive: WEBSITE_DOMAIN_VERIFICATION_ENFORCEMENT,
    });
  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(status.widgetChannelStatus),
  });
  const launchReadiness = buildWebsiteLaunchReadiness(
    req,
    status,
    verificationSurface
  );
  const blockers = buildBlockers(launchReadiness);
  const saveAllowed = canManageSettings(viewerRole);
  const ready = launchReadiness.productionLaunchAllowed === true;
  const install = buildWebsiteInstallSurface(
    req,
    status,
    verificationSurface,
    launchReadiness,
  );
  const installPlanBase = buildWebsiteChatInstallPlan({
    websiteUrl: status.websiteUrl,
    hints: [
      status.websiteUrl,
      launchReadiness.targetDomain,
      status.widgetProvider,
      status.widgetDisplayName,
      ...config.allowedOrigins,
      ...config.allowedDomains,
    ],
    access: {
      developer: launchReadiness.handoffs?.developer?.ready === true,
      googleTagManager: launchReadiness.handoffs?.gtm?.ready === true,
      cmsAdmin: launchReadiness.handoffs?.wordpress?.ready === true,
    },
  });
  const installPlan = {
    ...installPlanBase,
    availableHandoffs: launchReadiness.handoffs || {},
    currentReadiness: {
      status: launchReadiness.status,
      productionReady: launchReadiness.productionReady === true,
      testingOnly: launchReadiness.testingOnly === true,
      testReady: launchReadiness.testReady === true,
      reasonCode: launchReadiness.reasonCode || "",
      message: launchReadiness.message || "",
    },
  };

  return {
    tenantId: s(status.id),
    tenantKey: s(status.tenantKey || status.tenant_key),
    state:
      ready
        ? "connected"
        : launchReadiness.status === "not_configured"
          ? "not_connected"
          : config.enabled
            ? "blocked"
            : "not_connected",
    viewerRole,
    permissions: {
      saveAllowed,
      requiredRoles: ["owner", "admin"],
      message: saveAllowed
        ? ""
        : "This control-plane surface is visible here, but only owner/admin can change it.",
    },
    widget: {
      enabled: config.enabled === true,
      publicWidgetId: config.publicWidgetId,
      allowedOrigins: config.allowedOrigins,
      allowedDomains: config.allowedDomains,
      title: config.title,
      subtitle: config.subtitle,
      accentColor: config.accentColor,
      initialPrompts: config.initialPrompts,
      installAccessHints: config.installAccessHints,
      websiteUrl: s(status.websiteUrl),
      channelStatus: s(status.widgetChannelStatus),
      updatedAt: status.widgetUpdatedAt || null,
    },
    install,
    installPlan,
    handoffs: launchReadiness.handoffs,
    domainVerification: verificationSurface,
    launchReadiness,
    readiness: {
      status: ready
        ? "ready"
        : launchReadiness.status === "not_configured"
          ? "attention"
          : config.enabled
          ? "blocked"
          : "attention",
      reasonCode: s(launchReadiness.reasonCode),
      message: s(launchReadiness.message),
      blockers,
    },

    guidedSetup: buildWebsiteGuidedSetupState({
      status,
      domainVerification,
      launchReadiness,
    }),
  };
}

async function loadWebsiteWidgetStatusPayload({
  db,
  req,
  tenantKey = "",
  viewerRole = "member",
  requestedDomain = "",
} = {}) {
  const status = await resolveWebsiteWidgetStatus(db, tenantKey);
  if (!status?.id) {
    return null;
  }

  const domainVerification = await loadWebsiteDomainVerificationSurface(db, status, {
    requestedDomain,
  });

  return buildWebsiteWidgetStatusPayload(
    req,
    status,
    viewerRole,
    domainVerification
  );
}

export async function getWebsiteWidgetStatus({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    throw createHttpError("Missing tenant context", 401);
  }

  const payload = await loadWebsiteWidgetStatusPayload({
    db,
    req,
    tenantKey,
    viewerRole: getNormalizedAuthRole(req),
    requestedDomain: req?.query?.domain || "",
  });

  if (!payload) {
    throw createHttpError("Tenant not found", 404);
  }

  return payload;
}
