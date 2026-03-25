import { cfg } from "../../config.js";
import { dbGetTenantSecretValue } from "../../db/helpers/tenantSecrets.js";
import { arr, obj, s } from "./shared.js";

function metaGraphBase() {
  return `https://graph.facebook.com/${s(cfg?.meta?.apiVersion, "v23.0")}`;
}

function buildGraphUrl(path = "", params = {}) {
  const cleanPath = s(path).replace(/^\/+/, "");
  const url = new URL(`${metaGraphBase()}/${cleanPath}`);

  for (const [key, value] of Object.entries(obj(params))) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function readJsonSafe(res) {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function fetchMetaJson(path = "", { accessToken = "", params = {} } = {}) {
  const url = buildGraphUrl(path, {
    ...obj(params),
    access_token: s(accessToken),
  });

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const json = await readJsonSafe(res);

  if (!res.ok || json?.error) {
    const err = new Error(
      s(
        json?.error?.message ||
          json?.message ||
          `Meta Graph request failed with HTTP ${res.status}`
      )
    );

    err.status = Number(res.status || json?.error?.code || 0);
    err.code = s(json?.error?.type || json?.error?.code || "META_GRAPH_REQUEST_FAILED");
    err.responseJson = json;

    throw err;
  }

  return json;
}

async function resolveInstagramIdentity({
  accessToken = "",
  pageId = "",
  igUserId = "",
  igUsername = "",
} = {}) {
  let resolvedPageId = s(pageId);
  let resolvedIgUserId = s(igUserId);
  let resolvedIgUsername = s(igUsername);
  let resolvedPageName = "";
  let resolvedPageProfile = {};

  if (resolvedPageId) {
    const fieldAttempts = [
      "id,name,about,category,category_list,emails,phone,website,location,link,instagram_business_account{id,username},connected_instagram_account{id,username}",
      "id,name,about,category,emails,phone,website,location,link,instagram_business_account{id,username},connected_instagram_account{id,username}",
      "id,name,instagram_business_account{id,username},connected_instagram_account{id,username}",
    ];

    for (const fields of fieldAttempts) {
      try {
        const page = await fetchMetaJson(resolvedPageId, {
          accessToken,
          params: { fields },
        });

        const ig =
          obj(page?.instagram_business_account).id
            ? obj(page.instagram_business_account)
            : obj(page?.connected_instagram_account).id
              ? obj(page.connected_instagram_account)
              : {};

        resolvedPageId = s(page?.id || resolvedPageId);
        resolvedPageName = s(page?.name);
        resolvedIgUserId = s(ig?.id || resolvedIgUserId);
        resolvedIgUsername = s(ig?.username || resolvedIgUsername);
        resolvedPageProfile = {
          id: s(page?.id || resolvedPageId),
          name: s(page?.name),
          about: s(page?.about),
          category: s(page?.category),
          categoryList: arr(page?.category_list)
            .map((item) => ({
              id: s(item?.id),
              name: s(item?.name),
            }))
            .filter((item) => item.id || item.name),
          emails: arr(page?.emails).map((item) => s(item)).filter(Boolean),
          phone: s(page?.phone),
          website: s(page?.website),
          link: s(page?.link),
          location: obj(page?.location),
        };
        break;
      } catch {
        // soft fallback to already stored ids
      }
    }
  }

  return {
    pageId: resolvedPageId,
    pageName: resolvedPageName,
    igUserId: resolvedIgUserId,
    igUsername: resolvedIgUsername,
    pageProfile: resolvedPageProfile,
  };
}

async function fetchInstagramProfile({ accessToken = "", igUserId = "" } = {}) {
  const fieldAttempts = [
    "biography,followers_count,follows_count,media_count,name,profile_picture_url,username,website",
    "biography,followers_count,follows_count,media_count,username,website",
  ];

  let lastErr = null;

  for (const fields of fieldAttempts) {
    try {
      return await fetchMetaJson(igUserId, {
        accessToken,
        params: { fields },
      });
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Instagram profile fetch failed");
}

async function fetchInstagramMedia({ accessToken = "", igUserId = "", limit = 12 } = {}) {
  try {
    const json = await fetchMetaJson(`${igUserId}/media`, {
      accessToken,
      params: {
        fields: "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp",
        limit: Math.max(1, Math.min(24, Number(limit) || 12)),
      },
    });

    return arr(json?.data)
      .map((item) => ({
        id: s(item?.id),
        caption: s(item?.caption),
        mediaType: s(item?.media_type),
        mediaUrl: s(item?.media_url),
        permalink: s(item?.permalink),
        thumbnailUrl: s(item?.thumbnail_url),
        timestamp: s(item?.timestamp),
      }))
      .filter((item) => item.id || item.caption || item.permalink);
  } catch {
    return [];
  }
}

function buildInstagramUrl(username = "", fallbackUrl = "") {
  const handle = s(username).replace(/^@+/, "");
  if (handle) return `https://instagram.com/${handle}`;
  return s(fallbackUrl);
}

export async function extractInstagramSource(source = {}, { db } = {}) {
  if (!db || typeof db.query !== "function") {
    throw new Error("extractInstagramSource: db.query(...) is required");
  }

  const tenantId = s(source?.tenant_id);
  const sourceUrl = s(source?.source_url || source?.url);
  const storedIgUserId = s(source?.external_account_id || source?.external_user_id);
  const storedPageId = s(source?.external_page_id);
  const storedUsername = s(source?.external_username);

  if (!tenantId) {
    throw new Error("extractInstagramSource: tenant_id is required");
  }

  const accessToken = await dbGetTenantSecretValue(
    db,
    tenantId,
    "meta",
    "page_access_token"
  );

  if (!s(accessToken)) {
    const err = new Error("Meta page access token missing");
    err.code = "META_PAGE_ACCESS_TOKEN_MISSING";
    throw err;
  }

  const identity = await resolveInstagramIdentity({
    accessToken,
    pageId: storedPageId,
    igUserId: storedIgUserId,
    igUsername: storedUsername,
  });

  if (!s(identity?.igUserId)) {
    const err = new Error("Connected Instagram user id is missing");
    err.code = "INSTAGRAM_CONNECTED_USER_MISSING";
    throw err;
  }

  const profile = await fetchInstagramProfile({
    accessToken,
    igUserId: identity.igUserId,
  });

  const media = await fetchInstagramMedia({
    accessToken,
    igUserId: identity.igUserId,
    limit: 12,
  });

  const finalUsername = s(profile?.username || identity?.igUsername || storedUsername);
  const finalUrl = buildInstagramUrl(finalUsername, sourceUrl);

  return {
    kind: "instagram_graph_v1",
    provider: "meta_graph",
    fetchedAt: new Date().toISOString(),
    sourceUrl,
    finalUrl,
    page: {
      id: s(identity?.pageProfile?.id || identity?.pageId || storedPageId),
      name: s(identity?.pageProfile?.name || identity?.pageName),
      about: s(identity?.pageProfile?.about),
      category: s(identity?.pageProfile?.category),
      categoryList: arr(identity?.pageProfile?.categoryList),
      emails: arr(identity?.pageProfile?.emails),
      phone: s(identity?.pageProfile?.phone),
      website: s(identity?.pageProfile?.website),
      link: s(identity?.pageProfile?.link),
      location: obj(identity?.pageProfile?.location),
    },
    account: {
      id: s(profile?.id || identity?.igUserId || storedIgUserId),
      username: finalUsername,
      name: s(profile?.name),
      biography: s(profile?.biography),
      website: s(profile?.website),
      profilePictureUrl: s(profile?.profile_picture_url),
      followersCount: Number(profile?.followers_count || 0),
      followsCount: Number(profile?.follows_count || 0),
      mediaCount: Number(profile?.media_count || media.length || 0),
    },
    media,
    warnings: [],
  };
}
