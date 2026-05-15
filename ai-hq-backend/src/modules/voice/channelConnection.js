function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeVoiceProvider(value = "") {
  const provider = lower(value || "sip");
  if (provider === "browser" || provider === "browserlab") return "browser_lab";
  return provider || "sip";
}

function normalizeChannelId(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9:+._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
}

function digits(value = "") {
  return s(value).replace(/[^0-9]/g, "");
}

function buildVoiceChannelId({ provider = "", externalNumber = "", routeKey = "" } = {}) {
  const safeProvider = normalizeVoiceProvider(provider);
  const safeNumber = normalizeChannelId(externalNumber || digits(externalNumber));
  const safeRoute = normalizeChannelId(routeKey);
  return normalizeChannelId(
    `${safeProvider}:${safeNumber || safeRoute || `channel_${Date.now()}`}`
  );
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeActivationMode(value = "", provider = "") {
  const raw = lower(value);
  if (
    [
      "sip_trunk",
      "call_forwarding",
      "hosted_number",
      "ported_number",
      "twilio_number",
      "browser_lab",
      "manual",
    ].includes(raw)
  ) {
    return raw;
  }

  const normalizedProvider = normalizeVoiceProvider(provider);
  if (normalizedProvider === "sip") return "sip_trunk";
  if (normalizedProvider === "twilio") return "twilio_number";
  if (normalizedProvider === "browser_lab") return "browser_lab";
  return "manual";
}

function normalizeOwnershipStatus(value = "") {
  const raw = lower(value);
  return ["unverified", "pending", "verified", "failed", "manual_review"].includes(raw)
    ? raw
    : "unverified";
}

function normalizeRoutingStatus(value = "") {
  const raw = lower(value);
  return [
    "not_connected",
    "instructions_pending",
    "test_pending",
    "testing",
    "live",
    "failed",
    "paused",
  ].includes(raw)
    ? raw
    : "not_connected";
}

function normalizeVerificationMethod(value = "") {
  const raw = lower(value);
  return [
    "sms_code",
    "voice_code",
    "test_call",
    "provider_document",
    "manual_admin",
    "system_import",
  ].includes(raw)
    ? raw
    : "voice_code";
}

function deriveConnection(channel = {}) {
  const item = obj(channel);
  const enabled = item.enabled !== false;
  const externalNumber = s(item.externalNumber || item.external_number);
  const ownershipStatus = normalizeOwnershipStatus(
    item.ownershipStatus || item.ownership_status || obj(item.verification).status
  );
  const routingStatus = normalizeRoutingStatus(
    item.routingStatus || item.routing_status || obj(item.routing).status
  );
  const failureReason = s(obj(item.routing).failureReason || item.failureReason);

  let status = "disabled";
  let nextAction = "enable_channel";

  if (enabled) {
    if (!externalNumber && normalizeVoiceProvider(item.provider) !== "browser_lab") {
      status = "number_required";
      nextAction = "add_number";
    } else if (ownershipStatus !== "verified") {
      status = "verify_number";
      nextAction = "verify_ownership";
    } else if (routingStatus !== "live") {
      status = "connect_routing";
      nextAction = "test_call_routing";
    } else {
      status = "live";
      nextAction = "";
    }
  }

  if (failureReason) {
    status = "failed";
    nextAction = "review_connection";
  }

  return {
    status,
    nextAction,
    verified: ownershipStatus === "verified",
    live: routingStatus === "live",
    connected: status === "live",
  };
}

export function listVoiceChannelsFromSettings(settings = {}) {
  return arr(obj(settings).meta?.voiceChannels || obj(settings).meta?.voice_channels);
}

export function buildVoiceSettingsInputWithChannels(settings = {}, channels = []) {
  const current = obj(settings);
  const meta = obj(current.meta);

  return {
    enabled: current.enabled ?? true,
    provider: s(current.provider || "twilio"),
    mode: s(current.mode || "assistant"),
    displayName: s(current.displayName || current.display_name),
    defaultLanguage: s(current.defaultLanguage || current.default_language || "en"),
    supportedLanguages: arr(current.supportedLanguages || current.supported_languages).length
      ? arr(current.supportedLanguages || current.supported_languages)
      : ["en"],
    greeting: obj(current.greeting),
    fallbackGreeting: obj(current.fallbackGreeting || current.fallback_greeting),
    businessContext: s(current.businessContext || current.business_context),
    instructions: s(current.instructions),
    businessHoursEnabled: current.businessHoursEnabled ?? current.business_hours_enabled ?? false,
    businessHours: obj(current.businessHours || current.business_hours),
    operatorEnabled: current.operatorEnabled ?? current.operator_enabled ?? true,
    operatorPhone: s(current.operatorPhone || current.operator_phone),
    operatorLabel: s(current.operatorLabel || current.operator_label),
    transferStrategy: s(current.transferStrategy || current.transfer_strategy || "handoff"),
    callbackEnabled: current.callbackEnabled ?? current.callback_enabled ?? true,
    callbackMode: s(current.callbackMode || current.callback_mode || "lead_only"),
    maxCallSeconds: Number(current.maxCallSeconds || current.max_call_seconds || 180),
    silenceHangupSeconds: Number(
      current.silenceHangupSeconds || current.silence_hangup_seconds || 12
    ),
    captureRules: obj(current.captureRules || current.capture_rules),
    leadRules: obj(current.leadRules || current.lead_rules),
    escalationRules: obj(current.escalationRules || current.escalation_rules),
    reportingRules: obj(current.reportingRules || current.reporting_rules),
    twilioPhoneNumber: s(current.twilioPhoneNumber || current.twilio_phone_number),
    twilioPhoneSid: s(current.twilioPhoneSid || current.twilio_phone_sid),
    twilioConfig: obj(current.twilioConfig || current.twilio_config),
    costControl: obj(current.costControl || current.cost_control),
    meta: {
      ...meta,
      voiceChannels: channels,
    },
  };
}

export function normalizeVoiceChannelDraft(input = {}, existingChannels = []) {
  const item = obj(input);
  const provider = normalizeVoiceProvider(item.provider);
  const externalNumber = s(item.externalNumber || item.external_number || item.number);
  const routeKey = lower(item.routeKey || item.route_key || "default");
  const activationMode = normalizeActivationMode(item.activationMode || item.activation_mode, provider);
  const id =
    normalizeChannelId(item.id || item.channelId || item.channel_id) ||
    buildVoiceChannelId({ provider, externalNumber, routeKey });

  const duplicate = arr(existingChannels).find((channel) => {
    const sameId = normalizeChannelId(channel?.id) === id;
    const sameNumber =
      digits(channel?.externalNumber || channel?.external_number) &&
      digits(channel?.externalNumber || channel?.external_number) === digits(externalNumber) &&
      normalizeVoiceProvider(channel?.provider) === provider;
    return sameId || sameNumber;
  });

  if (duplicate) {
    const err = new Error("voice_channel_already_exists");
    err.code = "voice_channel_already_exists";
    throw err;
  }

  const ownershipStatus = normalizeOwnershipStatus(item.ownershipStatus || item.ownership_status);
  const routingStatus = normalizeRoutingStatus(item.routingStatus || item.routing_status);
  const verificationMethod = normalizeVerificationMethod(
    item.verificationMethod || item.verification_method
  );
  const base = {
    id,
    provider,
    label: s(item.label || item.displayName || item.display_name || "Voice number"),
    externalNumber,
    routeKey,
    enabled: item.enabled !== false,
    defaultLanguage: lower(item.defaultLanguage || item.default_language || "az"),
    supportedLanguages: arr(item.supportedLanguages || item.supported_languages)
      .map((entry) => lower(entry))
      .filter(Boolean),
    activationMode,
    ownershipStatus,
    routingStatus,
    verificationMethod,
    providerConfig: obj(item.providerConfig || item.provider_config),
    operatorRouting: obj(item.operatorRouting || item.operator_routing),
    voiceProfileOverride: obj(item.voiceProfileOverride || item.voice_profile_override),
    verification: {
      status: ownershipStatus,
      method: verificationMethod,
      verified: ownershipStatus === "verified",
    },
    routing: {
      status: routingStatus,
      activationMode,
      lastTestCallAt: "",
      lastInboundSeenAt: "",
      failureReason: "",
      live: routingStatus === "live",
    },
    meta: obj(item.meta),
    source: "voice_channel_connection_api",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const connection = deriveConnection(base);

  return {
    ...base,
    connectionStatus: connection.status,
    connectionNextAction: connection.nextAction,
    connectionReady: connection.connected,
    connection,
  };
}

export function createVoiceChannelConnection(settings = {}, input = {}) {
  const channels = listVoiceChannelsFromSettings(settings);
  const channel = normalizeVoiceChannelDraft(input, channels);
  return {
    channel,
    channels: [...channels, channel],
  };
}

export function updateVoiceChannelConnection(settings = {}, channelId = "", updater = null) {
  const channels = listVoiceChannelsFromSettings(settings);
  const wanted = normalizeChannelId(channelId);
  const index = channels.findIndex((channel) => normalizeChannelId(channel?.id) === wanted);

  if (index < 0) {
    const err = new Error("voice_channel_not_found");
    err.code = "voice_channel_not_found";
    throw err;
  }

  const current = obj(channels[index]);
  const next = typeof updater === "function" ? updater(current) : current;
  const connection = deriveConnection(next);
  const updated = {
    ...next,
    connectionStatus: connection.status,
    connectionNextAction: connection.nextAction,
    connectionReady: connection.connected,
    connection,
    updatedAt: nowIso(),
  };

  const nextChannels = channels.slice();
  nextChannels[index] = updated;

  return {
    channel: updated,
    channels: nextChannels,
  };
}

export function startVoiceChannelVerification(settings = {}, channelId = "", input = {}) {
  const method = normalizeVerificationMethod(input.method || input.verificationMethod);
  return updateVoiceChannelConnection(settings, channelId, (channel) => ({
    ...channel,
    ownershipStatus: "pending",
    verificationMethod: method,
    verification: {
      ...obj(channel.verification),
      status: "pending",
      method,
      verified: false,
      requestedAt: nowIso(),
      deliveryStatus: "stub_not_sent",
    },
  }));
}

export function confirmVoiceChannelVerification(settings = {}, channelId = "", input = {}) {
  const manualConfirmed = input.confirmed === true || input.confirmOwnership === true;
  const devCodeConfirmed = process.env.NODE_ENV !== "production" && s(input.code) === "000000";

  if (!manualConfirmed && !devCodeConfirmed) {
    const err = new Error("voice_channel_verification_not_confirmed");
    err.code = "voice_channel_verification_not_confirmed";
    throw err;
  }

  return updateVoiceChannelConnection(settings, channelId, (channel) => ({
    ...channel,
    ownershipStatus: "verified",
    verification: {
      ...obj(channel.verification),
      status: "verified",
      verified: true,
      verifiedAt: nowIso(),
    },
  }));
}

export function startVoiceChannelRoutingTest(settings = {}, channelId = "", input = {}) {
  return updateVoiceChannelConnection(settings, channelId, (channel) => ({
    ...channel,
    routingStatus: "test_pending",
    routing: {
      ...obj(channel.routing),
      status: "test_pending",
      activationMode: normalizeActivationMode(
        input.activationMode || channel.activationMode || obj(channel.routing).activationMode,
        channel.provider
      ),
      lastTestCallAt: nowIso(),
      lastInboundSeenAt: s(obj(channel.routing).lastInboundSeenAt),
      failureReason: "",
      live: false,
    },
  }));
}
