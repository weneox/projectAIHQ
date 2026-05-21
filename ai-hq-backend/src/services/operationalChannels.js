import crypto from "crypto";
import { getTenantVoiceSettings } from "../db/helpers/voice.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function bool(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function isConnectedStatus(status = "") {
  return ["connected", "active"].includes(lower(status));
}

function sha256Json(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value || {}), "utf8")
    .digest("hex");
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = s(value);
    if (normalized) return normalized;
  }
  return "";
}

function pickBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return false;
}

function pickArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function pickNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function normalizeDepartmentMap(input = {}) {
  const source = obj(input);
  const out = {};

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = lower(rawKey);
    if (!key) continue;

    const item = obj(rawValue);
    out[key] = {
      enabled: item.enabled !== false,
      label: s(item.label || key),
      phone: s(item.phone),
      callerId: s(item.callerId || item.caller_id),
      fallbackDepartment: lower(
        item.fallbackDepartment || item.fallback_department
      ),
      keywords: arr(item.keywords).map((entry) => s(entry)).filter(Boolean),
      businessHours: obj(item.businessHours || item.business_hours),
      meta: obj(item.meta),
    };
  }

  return out;
}

function normalizeVoiceProvider(value = "") {
  const provider = lower(value || "twilio");
  if (provider === "browser") return "browser_lab";
  if (provider === "browserlab") return "browser_lab";
  return provider || "twilio";
}

function normalizeVoiceChannelId(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9:+._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
}

function buildVoiceChannelId({ provider = "", externalNumber = "", routeKey = "", index = 0 } = {}) {
  const safeProvider = normalizeVoiceProvider(provider);
  const safeNumber = normalizeVoiceChannelId(externalNumber);
  const safeRoute = normalizeVoiceChannelId(routeKey);
  return normalizeVoiceChannelId(
    `${safeProvider}:${safeNumber || safeRoute || `channel_${index + 1}`}`
  );
}

function isVoiceProviderAdapterReady(provider = "") {
  return normalizeVoiceProvider(provider) === "twilio";
}

function normalizeVoiceActivationMode(value = "", provider = "") {
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

function normalizeVoiceOwnershipStatus(value = "", legacyVerified = false) {
  const raw = lower(value);
  if (["unverified", "pending", "verified", "failed", "manual_review"].includes(raw)) {
    return raw;
  }
  return legacyVerified ? "verified" : "unverified";
}

function normalizeVoiceRoutingStatus(value = "", legacyLive = false) {
  const raw = lower(value);
  if (
    [
      "not_connected",
      "instructions_pending",
      "test_pending",
      "testing",
      "live",
      "failed",
      "paused",
    ].includes(raw)
  ) {
    return raw;
  }
  return legacyLive ? "live" : "not_connected";
}

function normalizeVoiceVerificationMethod(value = "", legacyVerified = false) {
  const raw = lower(value);
  if (
    [
      "sms_code",
      "voice_code",
      "test_call",
      "provider_document",
      "manual_admin",
      "system_import",
    ].includes(raw)
  ) {
    return raw;
  }
  return legacyVerified ? "system_import" : "";
}

function buildVoiceNumberConnectionState({
  enabled = false,
  adapterReady = false,
  configured = false,
  ownershipStatus = "",
  routingStatus = "",
  failureReason = "",
} = {}) {
  const verified = ownershipStatus === "verified";
  const live = routingStatus === "live";
  let status = "disabled";
  let nextAction = "enable_channel";

  if (enabled) {
    if (!configured) {
      status = "number_required";
      nextAction = "add_number";
    } else if (!verified) {
      status = "verify_number";
      nextAction = "verify_ownership";
    } else if (!adapterReady) {
      status = "provider_pending";
      nextAction = "connect_provider";
    } else if (!live) {
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
    verified,
    live,
    connected: enabled && configured && verified && adapterReady && live && !failureReason,
  };
}

function normalizeVoiceChannel(input = {}, fallback = {}) {
  const item = obj(input);
  const fallbackItem = obj(fallback);
  const provider = normalizeVoiceProvider(
    item.provider || item.voiceProvider || item.voice_provider || fallbackItem.provider
  );
  const routeKey = lower(
    item.routeKey ||
      item.route_key ||
      item.intentRoute ||
      item.intent_route ||
      fallbackItem.routeKey ||
      "default"
  );
  const externalNumber = firstNonEmpty(
    item.externalNumber,
    item.external_number,
    item.number,
    item.phoneNumber,
    item.phone_number,
    item.twilioPhoneNumber,
    item.twilio_phone_number,
    fallbackItem.externalNumber
  );
  const enabled =
    typeof item.enabled === "boolean"
      ? item.enabled
      : typeof fallbackItem.enabled === "boolean"
        ? fallbackItem.enabled
        : false;
  const adapterReady = isVoiceProviderAdapterReady(provider);
  const requiresNumber = provider !== "browser_lab";
  const configured = requiresNumber ? !!externalNumber : enabled;
  let reasonCode = "";

  if (!enabled) {
    reasonCode = "voice_channel_disabled";
  } else if (!configured) {
    reasonCode = "voice_channel_number_missing";
  } else if (!adapterReady) {
    reasonCode = "voice_provider_adapter_pending";
  }

  const providerConfig = obj(
    item.providerConfig ||
      item.provider_config ||
      item[provider] ||
      fallbackItem.providerConfig
  );

  const legacyReadyChannel =
    s(fallbackItem.source || "tenant_voice_settings") === "tenant_voice_settings" &&
    provider === "twilio" &&
    !!externalNumber;
  const activationMode = normalizeVoiceActivationMode(
    item.activationMode || item.activation_mode || fallbackItem.activationMode,
    provider
  );
  const ownershipStatus = normalizeVoiceOwnershipStatus(
    item.ownershipStatus ||
      item.ownership_status ||
      obj(item.verification).ownershipStatus ||
      obj(item.verification).ownership_status ||
      obj(item.verification).status ||
      fallbackItem.ownershipStatus,
    legacyReadyChannel
  );
  const routingStatus = normalizeVoiceRoutingStatus(
    item.routingStatus ||
      item.routing_status ||
      obj(item.routing).status ||
      fallbackItem.routingStatus,
    legacyReadyChannel && adapterReady
  );
  const verificationMethod = normalizeVoiceVerificationMethod(
    item.verificationMethod ||
      item.verification_method ||
      obj(item.verification).method ||
      fallbackItem.verificationMethod,
    ownershipStatus === "verified"
  );
  const lastTestCallAt = s(
    item.lastTestCallAt ||
      item.last_test_call_at ||
      obj(item.routing).lastTestCallAt ||
      obj(item.routing).last_test_call_at
  );
  const lastInboundSeenAt = s(
    item.lastInboundSeenAt ||
      item.last_inbound_seen_at ||
      obj(item.routing).lastInboundSeenAt ||
      obj(item.routing).last_inbound_seen_at
  );
  const failureReason = s(
    item.failureReason ||
      item.failure_reason ||
      obj(item.routing).failureReason ||
      obj(item.routing).failure_reason
  );
  const connection = buildVoiceNumberConnectionState({
    enabled,
    adapterReady,
    configured,
    ownershipStatus,
    routingStatus,
    failureReason,
  });

  return {
    id:
      normalizeVoiceChannelId(item.id || item.channelId || item.channel_id) ||
      buildVoiceChannelId({
        provider,
        externalNumber,
        routeKey,
        index: Number(fallbackItem.index || 0),
      }),
    provider,
    label: s(item.label || item.displayName || item.display_name || fallbackItem.label),
    externalNumber: s(externalNumber),
    routeKey,
    enabled,
    ready: enabled && configured && adapterReady,
    reasonCode,
    ownershipStatus,
    routingStatus,
    activationMode,
    verificationMethod,
    connectionStatus: connection.status,
    connectionNextAction: connection.nextAction,
    connectionReady: connection.connected,
    verification: {
      status: ownershipStatus,
      method: verificationMethod,
      verified: connection.verified,
    },
    routing: {
      status: routingStatus,
      activationMode,
      lastTestCallAt,
      lastInboundSeenAt,
      failureReason,
      live: connection.live,
    },
    connection,
    defaultLanguage: lower(
      item.defaultLanguage || item.default_language || fallbackItem.defaultLanguage || "en"
    ),
    supportedLanguages: arr(
      item.supportedLanguages ||
        item.supported_languages ||
        fallbackItem.supportedLanguages
    )
      .map((entry) => lower(entry))
      .filter(Boolean),
    providerConfig,
    operatorRouting: obj(
      item.operatorRouting || item.operator_routing || fallbackItem.operatorRouting
    ),
    voiceProfileOverride: obj(
      item.voiceProfileOverride ||
        item.voice_profile_override ||
        item.profile ||
        fallbackItem.voiceProfileOverride
    ),
    meta: obj(item.meta),
    source: s(item.source || fallbackItem.source || "tenant_voice_settings"),
    updatedAt: s(item.updatedAt || item.updated_at || fallbackItem.updatedAt),
  };
}

function normalizeVoiceChannels(rawChannels = [], fallback = {}) {
  return arr(rawChannels)
    .map((item, index) => normalizeVoiceChannel(item, { ...fallback, index }))
    .filter((item) => item.id);
}

function normalizeVoiceSettingsRow(settings = null) {
  const value = obj(settings);
  const meta = obj(value.meta || value.meta_json);
  const twilioConfig = obj(value.twilioConfig || value.twilio_config);
  const routing = obj(
    meta.operatorRouting ||
      meta.operator_routing ||
      value.operatorRouting ||
      value.operator_routing
  );

  return {
    enabled: pickBoolean(value.enabled, value.is_enabled),
    provider: firstNonEmpty(value.provider, value.voice_provider, "twilio"),
    mode: firstNonEmpty(value.mode, value.voice_mode, "assistant"),
    displayName: firstNonEmpty(value.displayName, value.display_name),
    defaultLanguage: firstNonEmpty(
      value.defaultLanguage,
      value.default_language
    ),
    supportedLanguages: pickArray(
      value.supportedLanguages,
      value.supported_languages
    ),
    instructions: firstNonEmpty(value.instructions),
    operatorEnabled: pickBoolean(
      value.operatorEnabled,
      value.operator_enabled
    ),
    operatorPhone: firstNonEmpty(value.operatorPhone, value.operator_phone),
    operatorLabel: firstNonEmpty(value.operatorLabel, value.operator_label),
    transferStrategy: firstNonEmpty(
      value.transferStrategy,
      value.transfer_strategy
    ),
    callbackEnabled: pickBoolean(
      value.callbackEnabled,
      value.callback_enabled
    ),
    callbackMode: firstNonEmpty(value.callbackMode, value.callback_mode),
    maxCallSeconds: pickNumber(value.maxCallSeconds, value.max_call_seconds),
    silenceHangupSeconds: pickNumber(
      value.silenceHangupSeconds,
      value.silence_hangup_seconds
    ),
    twilioPhoneNumber: firstNonEmpty(
      value.twilioPhoneNumber,
      value.twilio_phone_number
    ),
    twilioPhoneSid: firstNonEmpty(value.twilioPhoneSid, value.twilio_phone_sid),
    twilioConfig,
    meta,
    routing,
    actions: obj(value.actions || value.voiceActions || meta.actions || meta.voiceActions),
    voiceChannels: pickArray(
      value.voiceChannels,
      value.voice_channels,
      value.channels,
      meta.voiceChannels,
      meta.voice_channels,
      meta.channels
    ),
    updatedAt: firstNonEmpty(value.updatedAt, value.updated_at),
  };
}

function buildMissingVoiceOperational(reasonCode = "voice_settings_missing") {
  return {
    available: false,
    ready: false,
    reasonCode,
    provider: "twilio",
    mode: "assistant",
    displayName: "",
    defaultLanguage: "en",
    supportedLanguages: [],
    operator: {
      enabled: false,
      phone: "",
      callerId: "",
      label: "",
      mode: "manual",
    },
    operatorRouting: {
      mode: "manual",
      defaultDepartment: "",
      departments: {},
    },
    realtime: {
      model: "",
      voice: "",
      instructions: "",
    },
    actions: {},
    telephony: {
      phoneNumber: "",
      phoneSid: "",
    },
    channels: [],
    defaultChannelId: "",
    activeChannelId: "",
    channelCount: 0,
    readyChannelCount: 0,
    providers: [],
    callback: {
      enabled: false,
      mode: "",
    },
    transfer: {
      strategy: "",
    },
    limits: {},
    source: "missing",
    updatedAt: "",
  };
}

function buildVoiceOperationalFromSettings(settings = null, tenantRow = {}) {
  if (!settings) {
    return buildMissingVoiceOperational("voice_settings_missing");
  }

  const normalized = normalizeVoiceSettingsRow(settings);
  const meta = obj(normalized.meta);
  const routing = obj(normalized.routing);
  const twilioConfig = obj(normalized.twilioConfig);

  const enabled = bool(normalized.enabled, false);
  const legacyPhoneNumber = s(normalized.twilioPhoneNumber);
  const configuredProvider = normalizeVoiceProvider(normalized.provider || "twilio");
  const defaultOperatorRouting = {
    mode: lower(
      routing.mode ||
        meta.transferMode ||
        meta.transfer_mode ||
        normalized.transferStrategy ||
        "handoff"
    ),
    defaultDepartment: lower(
      routing.defaultDepartment || routing.default_department || ""
    ),
    departments: normalizeDepartmentMap(routing.departments),
  };

  const defaultChannel = normalizeVoiceChannel(
    {},
    {
      provider: configuredProvider,
      externalNumber: legacyPhoneNumber,
      routeKey: "default",
      enabled,
      label: s(normalized.displayName || tenantRow.company_name || "Primary voice line"),
      defaultLanguage: lower(
        normalized.defaultLanguage || tenantRow.default_language || "en"
      ),
      supportedLanguages: normalized.supportedLanguages,
      providerConfig: configuredProvider === "twilio" ? twilioConfig : {},
      operatorRouting: defaultOperatorRouting,
      source: "tenant_voice_settings",
      updatedAt: normalized.updatedAt,
    }
  );

  const configuredChannels = normalizeVoiceChannels(normalized.voiceChannels, {
    enabled,
    defaultLanguage: lower(
      normalized.defaultLanguage || tenantRow.default_language || "en"
    ),
    supportedLanguages: normalized.supportedLanguages,
    operatorRouting: defaultOperatorRouting,
    updatedAt: normalized.updatedAt,
  });

  const hasLegacyChannel =
    legacyPhoneNumber &&
    configuredChannels.some(
      (channel) =>
        channel.provider === configuredProvider &&
        s(channel.externalNumber) === legacyPhoneNumber
    );

  const channels = [
    ...(legacyPhoneNumber && !hasLegacyChannel ? [defaultChannel] : []),
    ...configuredChannels,
  ];

  if (!channels.length) {
    channels.push(defaultChannel);
  }

  const readyChannels = channels.filter((channel) => channel.ready);
  const primaryChannel =
    readyChannels[0] ||
    channels.find((channel) => channel.enabled) ||
    channels[0] ||
    null;
  const provider = normalizeVoiceProvider(primaryChannel?.provider || configuredProvider);
  const phoneNumber = s(primaryChannel?.externalNumber || legacyPhoneNumber);
  let reasonCode = "";

  if (!enabled) {
    reasonCode = "voice_disabled";
  } else if (readyChannels.length === 0) {
    const hasAdapterPending = channels.some(
      (channel) => channel.enabled && channel.reasonCode === "voice_provider_adapter_pending"
    );
    const hasNumberMissing = channels.some(
      (channel) => channel.enabled && channel.reasonCode === "voice_channel_number_missing"
    );

    if (hasAdapterPending && configuredProvider !== "twilio") {
      reasonCode = "voice_provider_unsupported";
    } else if (hasAdapterPending) {
      reasonCode = "voice_provider_adapter_pending";
    } else if (hasNumberMissing || !phoneNumber) {
      reasonCode = "voice_phone_number_missing";
    } else {
      reasonCode = "voice_channel_not_ready";
    }
  }

  return {
    available: true,
    ready: !reasonCode,
    reasonCode,
    provider,
    channels,
    defaultChannelId: s(primaryChannel?.id),
    activeChannelId: s(primaryChannel?.id),
    channelCount: channels.length,
    readyChannelCount: readyChannels.length,
    providers: [...new Set(channels.map((channel) => channel.provider).filter(Boolean))],
    mode: lower(normalized.mode || "assistant"),
    displayName: s(normalized.displayName || tenantRow.company_name),
    defaultLanguage: lower(
      normalized.defaultLanguage || tenantRow.default_language || "en"
    ),
    supportedLanguages: arr(normalized.supportedLanguages)
      .map((entry) => lower(entry))
      .filter(Boolean),
    operator: {
      enabled: bool(normalized.operatorEnabled, true),
      phone: s(normalized.operatorPhone),
      callerId: s(
        twilioConfig.callerId ||
          twilioConfig.caller_id ||
          meta.callerId ||
          meta.caller_id
      ),
      label: s(normalized.operatorLabel || "operator"),
      mode: lower(meta.operatorMode || meta.operator_mode || "manual"),
    },
    operatorRouting: defaultOperatorRouting,
    realtime: {
      model: s(meta.realtimeModel || meta.model || "gpt-4o-realtime-preview"),
      voice: s(meta.realtimeVoice || meta.voice || "alloy"),
      instructions: s(normalized.instructions || meta.instructions || ""),
    },
    actions: obj(normalized.actions),
    telephony: {
      phoneNumber,
      phoneSid: s(normalized.twilioPhoneSid),
      channelId: s(primaryChannel?.id),
    },
    callback: {
      enabled: bool(normalized.callbackEnabled, true),
      mode: s(normalized.callbackMode || "lead_only"),
    },
    transfer: {
      strategy: lower(normalized.transferStrategy || "handoff"),
    },
    limits: {
      maxCallSeconds: pickNumber(normalized.maxCallSeconds, 0),
      silenceHangupSeconds: pickNumber(normalized.silenceHangupSeconds, 0),
    },
    source: "tenant_voice_settings",
    updatedAt: s(normalized.updatedAt),
  };
}

function buildMetaOperational({ matchedChannel = null } = {}) {
  const channel = obj(matchedChannel);
  const pageId = s(channel.external_page_id);
  const igUserId = s(channel.external_user_id);
  const connected = isConnectedStatus(channel.status);
  let reasonCode = "";

  if (!channel.id) {
    reasonCode = "channel_not_connected";
  } else if (!pageId && !igUserId) {
    reasonCode = "channel_identifiers_missing";
  } else if (!connected) {
    reasonCode = "channel_not_connected";
  }

  return {
    available: Boolean(channel.id),
    ready: Boolean(channel.id && connected && (pageId || igUserId)),
    reasonCode,
    provider: lower(channel.provider || "meta"),
    channelType: lower(channel.channel_type || channel.channelType || ""),
    pageId,
    igUserId,
    accountId: s(channel.external_account_id),
    username: s(channel.external_username),
    status: s(channel.status),
    isPrimary: channel.is_primary === true || channel.isPrimary === true,
    isConnected: connected,
    source: channel.id ? "tenant_channels" : "",
    updatedAt: s(channel.updated_at),
  };
}

export async function loadVoiceOperationalSettings({
  db,
  tenantId = "",
  tenantRow = null,
} = {}) {
  if (!db?.query || !s(tenantId)) return null;
  return await getTenantVoiceSettings(db, tenantId);
}

export async function buildOperationalChannels({
  db,
  tenantId = "",
  tenantRow = null,
  voiceSettings,
  matchedChannel = null,
} = {}) {
  const resolvedVoiceSettings =
    voiceSettings !== undefined
      ? voiceSettings
      : await loadVoiceOperationalSettings({ db, tenantId, tenantRow });

  const voice = buildVoiceOperationalFromSettings(
    resolvedVoiceSettings,
    tenantRow || {}
  );
  const meta = buildMetaOperational({ matchedChannel });
  const payload = {
    version: "operational_channels_v1",
    generatedAt: new Date().toISOString(),
    voice,
    meta,
  };

  return {
    ...payload,
    contractHash: sha256Json(payload),
  };
}
