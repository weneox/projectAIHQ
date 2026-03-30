import { lower, obj, s } from "./shared.js";
import { hasMetaProviderAccess } from "./meta.js";

export function resolveConsumerSurface({
  matchedChannel = null,
  providerSecrets = null,
  operationalChannels = null,
} = {}) {
  const match = obj(matchedChannel);
  const providerSecretValue = obj(providerSecrets);
  const ops = obj(operationalChannels);
  const meta = obj(ops.meta);
  const voice = obj(ops.voice);
  const voiceTelephony = obj(voice.telephony);
  const voiceOperator = obj(voice.operator);

  const explicitProvider = lower(match.provider || providerSecretValue.provider);
  const explicitChannelType = lower(match.channel_type || match.channelType);

  const metaHasOperationalIdentity =
    meta.available === true ||
    meta.ready === true ||
    Boolean(
      s(match.id) ||
        s(match.external_page_id || match.pageId) ||
        s(match.external_user_id || match.igUserId) ||
        s(match.external_account_id || match.accountId) ||
        s(meta.pageId) ||
        s(meta.igUserId) ||
        s(meta.accountId) ||
        explicitChannelType
    );

  const metaRequested =
    explicitProvider === "meta" ||
    ["instagram", "facebook", "messenger"].includes(explicitChannelType) ||
    hasMetaProviderAccess(providerSecrets) ||
    metaHasOperationalIdentity;

  const voiceHasOperationalIdentity =
    voice.available === true ||
    voice.ready === true ||
    Boolean(
      s(voice.provider) ||
        s(voiceTelephony.phoneNumber || voiceTelephony.phone_number) ||
        s(
          voice.twilioPhoneNumber ||
            voice.twilio_phone_number ||
            voice.phoneNumber
        ) ||
        s(voiceOperator.phone) ||
        s(voiceOperator.callerId || voiceOperator.caller_id)
    );

  const voiceProvider = lower(voice.provider);

  if (explicitProvider === "twilio") {
    return "twilio";
  }

  if (voiceHasOperationalIdentity && !metaRequested) {
    return voiceProvider === "twilio" ? "twilio" : "voice";
  }

  if (metaRequested) {
    return "meta";
  }

  if (voiceHasOperationalIdentity) {
    return voiceProvider === "twilio" ? "twilio" : "voice";
  }

  return "";
}

export function buildSurfaceAliasSet(surface = "") {
  const normalized = lower(surface);
  if (!normalized) return new Set();

  if (normalized === "voice" || normalized === "twilio") {
    return new Set(["voice", "twilio"]);
  }

  if (normalized === "meta") {
    return new Set(["meta", "instagram", "facebook", "messenger"]);
  }

  if (["instagram", "facebook", "messenger"].includes(normalized)) {
    return new Set(["meta", normalized]);
  }

  return new Set([normalized]);
}

export function healthAffectsConsumerSurface(
  affectedSurfaces = [],
  consumerSurface = ""
) {
  const normalizedAffected = affectedSurfaces
    .map((item) => lower(item))
    .filter(Boolean);

  if (
    normalizedAffected.includes("all") ||
    normalizedAffected.includes("global") ||
    normalizedAffected.includes("runtime")
  ) {
    return true;
  }

  if (!consumerSurface) {
    return normalizedAffected.length > 0;
  }

  const aliases = buildSurfaceAliasSet(consumerSurface);
  return normalizedAffected.some((surface) => aliases.has(surface));
}
