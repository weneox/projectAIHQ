import { arr, lower, obj, s } from "./shared.js";

export function buildMetaChannelRuntime({
  projectionChannels = [],
  matchedChannel = null,
} = {}) {
  const match = obj(matchedChannel);
  const projected =
    arr(projectionChannels).find((item) =>
      ["instagram", "facebook", "messenger"].includes(
        lower(item?.channelType)
      )
    ) || {};

  return {
    enabled:
      lower(projected.channelType) === "instagram" ||
      lower(projected.channelType) === "facebook" ||
      lower(projected.channelType) === "messenger" ||
      lower(match.channel_type) === "instagram" ||
      lower(match.channel_type) === "facebook" ||
      lower(match.channel_type) === "messenger",
    channelType: s(projected.channelType || match.channel_type),
    provider: s(match.provider || "meta"),
    displayName: s(match.display_name || projected.label),
    pageId: s(match.external_page_id),
    igUserId: s(match.external_user_id),
    endpoint: s(projected.endpoint),
    username: s(match.external_username),
    isPrimary:
      typeof match.is_primary === "boolean"
        ? match.is_primary
        : projected.isPrimary === true,
    status: s(match.status || projected.status || ""),
  };
}

export function getProviderSecretKeySet(providerSecrets = {}) {
  const value = obj(providerSecrets);
  return new Set(
    [
      ...arr(value.secretKeys),
      ...arr(value.secret_keys),
      ...Object.keys(obj(value)),
    ]
      .map((item) => lower(item))
      .filter(Boolean)
  );
}

export function hasMetaProviderAccess(providerSecrets = {}) {
  const value = obj(providerSecrets);
  const secretKeySet = getProviderSecretKeySet(value);

  return (
    Boolean(s(value.pageAccessToken || value.page_access_token)) ||
    secretKeySet.has("page_access_token") ||
    secretKeySet.has("access_token") ||
    secretKeySet.has("meta_page_access_token")
  );
}
