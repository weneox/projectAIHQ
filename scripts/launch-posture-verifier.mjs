function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeBaseUrl(value = "") {
  return s(value).replace(/\/+$/, "");
}

function uniqStrings(values = []) {
  return [
    ...new Set(
      arr(values)
        .map((item) => s(item).toLowerCase())
        .filter(Boolean)
    ),
  ];
}

const REQUIRED_SCOPE_SURFACES = [
  "home",
  "channels",
  "truth",
  "inbox",
  "website_chat",
  "instagram_dm",
  "telegram_private_bot_chat",
];

const PHASE_TWO_SURFACES = [
  "voice",
  "comments",
  "publish",
  "proposals",
  "media",
  "gmail",
  "whatsapp",
];

export function buildLaunchPostureUrl(
  baseUrl = "",
  { internal = true, tenantKey = "", tenantId = "" } = {}
) {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) return "";

  const path = internal
    ? "/api/internal/launch/posture"
    : "/api/launch/posture";
  const search = new URLSearchParams();
  if (internal && s(tenantKey)) search.set("tenantKey", s(tenantKey));
  if (internal && s(tenantId)) search.set("tenantId", s(tenantId));
  const query = search.toString();

  return `${root}${path}${query ? `?${query}` : ""}`;
}

export function resolveLaunchPostureTenantKey(env = process.env) {
  return s(
    env.AIHQ_LAUNCH_POSTURE_TENANT_KEY ||
      env.LAUNCH_POSTURE_TENANT_KEY ||
      env.WEBSITE_LANE_TENANT_KEY
  );
}

export function resolveLaunchPostureSessionCookie(env = process.env) {
  const explicitCookie = s(
    env.AIHQ_USER_SESSION_COOKIE ||
      env.AIHQ_SMOKE_USER_SESSION_COOKIE ||
      env.AIHQ_SESSION_COOKIE
  );
  if (explicitCookie) {
    return explicitCookie.includes("=")
      ? explicitCookie
      : `aihq_user=${encodeURIComponent(explicitCookie)}`;
  }

  const token = s(env.AIHQ_USER_SESSION_TOKEN || env.AIHQ_SMOKE_USER_SESSION_TOKEN);
  return token ? `aihq_user=${encodeURIComponent(token)}` : "";
}

export function buildLaunchPostureHeaders({
  internalToken = "",
  sessionCookie = "",
  audience = "aihq-backend.launch-posture",
  internal = true,
} = {}) {
  const headers = {
    accept: "application/json",
  };

  if (internal && s(internalToken)) {
    headers["x-internal-token"] = s(internalToken);
  }

  if (internal && s(audience)) {
    headers["x-internal-audience"] = s(audience);
  }

  if (s(sessionCookie)) {
    headers.cookie = s(sessionCookie);
  }

  return headers;
}

function hasObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function collectSurfaceLeaks(posture = {}) {
  const scopeSurfaces = uniqStrings(posture?.scope?.surfaces);
  const channelIds = uniqStrings(Object.keys(obj(posture?.channels)));
  const topLevelKeys = uniqStrings(Object.keys(obj(posture)));
  const deliveryReadyChannelIds = uniqStrings(
    posture?.channelSummary?.deliveryReadyChannelIds
  );
  const unavailableSurfaces = uniqStrings(
    arr(posture?.unavailable).map((item) => item?.surface)
  );
  const blockerSurfaces = uniqStrings(
    arr(posture?.blockers).map((item) => item?.surface)
  );

  return PHASE_TWO_SURFACES.filter((surface) =>
    [
      scopeSurfaces,
      channelIds,
      topLevelKeys,
      deliveryReadyChannelIds,
      unavailableSurfaces,
      blockerSurfaces,
    ].some((values) => values.includes(surface))
  );
}

function collectReasonCodes(items = []) {
  return uniqStrings(
    arr(items).map((item) =>
      typeof item === "string"
        ? item
        : item?.reasonCode || item?.reason_code || item?.code
    )
  );
}

export function classifyLaunchPosture(posture = {}) {
  const payload = obj(posture);
  const scope = obj(payload.scope);
  const scopeSurfaces = uniqStrings(scope.surfaces);
  const channels = obj(payload.channels);

  const missingSurfaces = REQUIRED_SCOPE_SURFACES.filter(
    (surface) => !scopeSurfaces.includes(surface)
  );
  const leakedSurfaces = collectSurfaceLeaks(payload);

  const malformed = [];
  if (payload.ok !== true) malformed.push("ok_not_true");
  if (payload.version !== "launch_posture_v1") malformed.push("version_mismatch");
  if (scope.id !== "aihq_launch_v1_narrow") malformed.push("scope_id_mismatch");
  if (missingSurfaces.length) malformed.push("scope_surfaces_missing");
  if (leakedSurfaces.length) malformed.push("phase_two_surface_leak");
  if (!s(payload.overall?.status)) malformed.push("overall_status_missing");
  if (typeof payload.overall?.launchReady !== "boolean") {
    malformed.push("overall_launch_ready_not_boolean");
  }
  if (!hasObject(payload.truth)) malformed.push("truth_missing");
  if (!hasObject(payload.runtime)) malformed.push("runtime_missing");
  if (!hasObject(channels.website)) malformed.push("website_channel_missing");
  if (!hasObject(channels.instagram)) malformed.push("instagram_channel_missing");
  if (!hasObject(channels.telegram)) malformed.push("telegram_channel_missing");
  if (!hasObject(payload.channelSummary)) malformed.push("channel_summary_missing");
  if (!hasObject(payload.inbox)) malformed.push("inbox_missing");

  return {
    ok: malformed.length === 0,
    details: {
      version: s(payload.version),
      scopeId: s(scope.id),
      missingSurfaces,
      leakedSurfaces,
      malformed,
      overallStatus: s(payload.overall?.status),
      launchReady: payload.overall?.launchReady,
      truthStatus: s(payload.truth?.status),
      truthReasonCode: s(payload.truth?.reasonCode),
      runtimeStatus: s(payload.runtime?.status),
      runtimeReasonCode: s(payload.runtime?.reasonCode),
      channelSummary: {
        readyCount: n(payload.channelSummary?.readyCount),
        connectedCount: n(payload.channelSummary?.connectedCount),
        deliveryReadyChannelIds: uniqStrings(
          payload.channelSummary?.deliveryReadyChannelIds
        ),
        selectedChannelId: s(payload.channelSummary?.selectedChannelId),
      },
      channels: {
        website: {
          status: s(channels.website?.status),
          reasonCode: s(channels.website?.reasonCode),
          connected: channels.website?.connected === true,
          deliveryReady: channels.website?.deliveryReady === true,
          available: channels.website?.available !== false,
        },
        instagram: {
          status: s(channels.instagram?.status),
          reasonCode: s(channels.instagram?.reasonCode),
          connected: channels.instagram?.connected === true,
          deliveryReady: channels.instagram?.deliveryReady === true,
          available: channels.instagram?.available !== false,
        },
        telegram: {
          status: s(channels.telegram?.status),
          reasonCode: s(channels.telegram?.reasonCode),
          connected: channels.telegram?.connected === true,
          deliveryReady: channels.telegram?.deliveryReady === true,
          available: channels.telegram?.available !== false,
        },
      },
      blockerReasonCodes: collectReasonCodes(payload.blockers),
      unavailableReasonCodes: collectReasonCodes(payload.unavailable),
    },
  };
}
