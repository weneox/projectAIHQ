import { META_API_VERSION, META_REPLY_TIMEOUT_MS } from "../config.js";
import { getTenantMetaConfigByChannel } from "./tenantProviderSecrets.js";
import { createStructuredLogger } from "@aihq/shared-contracts/logger";

function s(v) {
  return String(v ?? "").trim();
}

function lower(v) {
  return s(v).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function normalizeUrlLike(value = "") {
  const next = s(value);
  if (!next) return "";
  if (
    next.startsWith("https://") ||
    next.startsWith("http://") ||
    next.startsWith("/")
  ) {
    return next;
  }
  return "";
}

function pickFirst(...values) {
  for (const value of values) {
    const next = s(value);
    if (next) return next;
  }
  return "";
}

function pickFirstUrl(...values) {
  for (const value of values) {
    const next = normalizeUrlLike(value);
    if (next) return next;
  }
  return "";
}

function normalizeUsername(value = "") {
  return s(value).replace(/^@+/, "");
}

function graphBase() {
  const version = s(META_API_VERSION || "v23.0") || "v23.0";
  return `https://graph.facebook.com/${version}`;
}

function graphNode(nodeId, edge = "") {
  const id = encodeURIComponent(s(nodeId));
  const cleanEdge = s(edge).replace(/^\/+/, "");
  return cleanEdge ? `${graphBase()}/${id}/${cleanEdge}` : `${graphBase()}/${id}`;
}

async function safeReadJson(res) {
  const text = await res.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const logger = createStructuredLogger({
  service: "meta-bot-backend",
  component: "meta-profile-lookup",
});

async function getAccessContext({
  channel = "instagram",
  recipientId = "",
  pageId = "",
  igUserId = "",
}) {
  const cfg = await getTenantMetaConfigByChannel({
    channel,
    recipientId,
    pageId,
    igUserId,
  });

  return {
    accessToken: s(cfg?.pageAccessToken),
    tenantKey: s(cfg?.tenantKey),
    pageId: s(cfg?.pageId || pageId),
    igUserId: s(cfg?.igUserId || igUserId),
    source: s(cfg?.source),
    error: s(cfg?.error),
    status: Number(cfg?.status || 0),
  };
}

async function graphGetJson(url, accessToken) {
  const token = s(accessToken);
  if (!token) {
    return {
      ok: false,
      status: 0,
      error: "tenant meta access token missing",
      json: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number(META_REPLY_TIMEOUT_MS || 15000)
  );

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const json = await safeReadJson(res);

    return {
      ok: res.ok,
      status: res.status,
      error: res.ok
        ? ""
        : s(json?.error?.message || json?.message || "Meta request failed"),
      json,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error:
        err?.name === "AbortError"
          ? "Meta timeout"
          : s(err?.message || err),
      json: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractInstagramProfile(payload = {}) {
  const json = obj(payload);
  return {
    username: normalizeUsername(
      pickFirst(json?.username, json?.user_name, json?.handle)
    ),
    fullName: pickFirst(json?.name, json?.full_name),
    avatarUrl: pickFirstUrl(
      json?.profile_pic,
      json?.profile_picture_url,
      json?.avatar_url,
      json?.avatarUrl
    ),
  };
}

function extractFacebookProfile(payload = {}) {
  const json = obj(payload);
  return {
    username: normalizeUsername(
      pickFirst(json?.username, json?.handle, json?.name)
    ),
    fullName: pickFirst(
      [s(json?.first_name), s(json?.last_name)].filter(Boolean).join(" "),
      json?.name,
      json?.full_name
    ),
    avatarUrl: pickFirstUrl(
      json?.profile_pic,
      json?.profile_picture_url,
      json?.avatar_url,
      json?.avatarUrl
    ),
  };
}

async function fetchInstagramProfile({
  userId = "",
  accessToken = "",
}) {
  const safeUserId = s(userId);
  if (!safeUserId) {
    return {
      ok: false,
      status: 0,
      error: "instagram userId missing",
      profile: null,
    };
  }

  const attempts = [
    `${graphNode(safeUserId)}?fields=name,username,profile_pic`,
    `${graphNode(safeUserId)}?fields=username,name`,
  ];

  let best = {
    username: "",
    fullName: "",
    avatarUrl: "",
  };
  let lastError = "";
  let lastStatus = 0;

  for (const url of attempts) {
    const out = await graphGetJson(url, accessToken);
    lastError = s(out?.error);
    lastStatus = Number(out?.status || 0);

    if (!out.ok) continue;

    const extracted = extractInstagramProfile(out.json);
    best = {
      username: pickFirst(best.username, extracted.username),
      fullName: pickFirst(best.fullName, extracted.fullName),
      avatarUrl: pickFirstUrl(best.avatarUrl, extracted.avatarUrl),
    };

    if (best.username || best.fullName || best.avatarUrl) {
      break;
    }
  }

  if (!best.avatarUrl) {
    const pictureOut = await graphGetJson(
      `${graphNode(safeUserId, "picture")}?redirect=false`,
      accessToken
    );

    if (pictureOut.ok) {
      best.avatarUrl = pickFirstUrl(
        pictureOut?.json?.data?.url,
        pictureOut?.json?.url
      );
    } else {
      lastError = s(pictureOut?.error || lastError);
      lastStatus = Number(pictureOut?.status || lastStatus || 0);
    }
  }

  return {
    ok: Boolean(best.username || best.fullName || best.avatarUrl),
    status: lastStatus,
    error: best.username || best.fullName || best.avatarUrl ? "" : lastError,
    profile: best,
  };
}

async function fetchFacebookProfile({
  userId = "",
  accessToken = "",
}) {
  const safeUserId = s(userId);
  if (!safeUserId) {
    return {
      ok: false,
      status: 0,
      error: "facebook userId missing",
      profile: null,
    };
  }

  const out = await graphGetJson(
    `${graphNode(safeUserId)}?fields=first_name,last_name,name,profile_pic`,
    accessToken
  );

  if (!out.ok) {
    return {
      ok: false,
      status: Number(out?.status || 0),
      error: s(out?.error),
      profile: null,
    };
  }

  const extracted = extractFacebookProfile(out.json);

  if (!extracted.avatarUrl) {
    const pictureOut = await graphGetJson(
      `${graphNode(safeUserId, "picture")}?redirect=false`,
      accessToken
    );

    if (pictureOut.ok) {
      extracted.avatarUrl = pickFirstUrl(
        pictureOut?.json?.data?.url,
        pictureOut?.json?.url
      );
    }
  }

  return {
    ok: Boolean(extracted.username || extracted.fullName || extracted.avatarUrl),
    status: Number(out?.status || 0),
    error: "",
    profile: extracted,
  };
}

export async function resolveMetaProfileForInbound({
  channel = "instagram",
  userId = "",
  recipientId = "",
  pageId = "",
  igUserId = "",
}) {
  const safeChannel = lower(channel || "instagram") || "instagram";
  const safeUserId = s(userId);

  if (!safeUserId) {
    return {
      ok: false,
      status: 0,
      error: "meta inbound userId missing",
      profile: null,
    };
  }

  const access = await getAccessContext({
    channel: safeChannel,
    recipientId,
    pageId,
    igUserId,
  });

  if (!access.accessToken) {
    logger.warn("meta.profile_lookup.access_missing", {
      channel: safeChannel,
      userId: safeUserId,
      recipientId: s(recipientId),
      pageId: s(pageId),
      igUserId: s(igUserId),
      tenantKey: access.tenantKey,
      source: access.source,
      error: access.error,
      status: access.status,
    });

    return {
      ok: false,
      status: access.status,
      error: access.error || "meta access token unavailable",
      profile: null,
    };
  }

  const result =
    safeChannel === "facebook" || safeChannel === "messenger"
      ? await fetchFacebookProfile({
          userId: safeUserId,
          accessToken: access.accessToken,
        })
      : await fetchInstagramProfile({
          userId: safeUserId,
          accessToken: access.accessToken,
        });

  logger.info("meta.profile_lookup.result", {
    channel: safeChannel,
    userId: safeUserId,
    recipientId: s(recipientId),
    pageId: s(pageId),
    igUserId: s(igUserId),
    tenantKey: access.tenantKey,
    ok: result.ok,
    status: result.status,
    hasUsername: Boolean(s(result?.profile?.username)),
    hasFullName: Boolean(s(result?.profile?.fullName)),
    hasAvatarUrl: Boolean(s(result?.profile?.avatarUrl)),
    error: s(result?.error),
  });

  return {
    ok: Boolean(result?.ok),
    status: Number(result?.status || 0),
    error: s(result?.error),
    profile: result?.profile
      ? {
          username: normalizeUsername(result.profile.username),
          fullName: s(result.profile.fullName),
          avatarUrl: pickFirstUrl(result.profile.avatarUrl),
        }
      : null,
  };
}