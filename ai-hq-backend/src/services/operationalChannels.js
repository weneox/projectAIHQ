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
    telephony: {
      phoneNumber: "",
      phoneSid: "",
    },
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
  const phoneNumber = s(normalized.twilioPhoneNumber);
  const provider = lower(normalized.provider || "twilio");
  let reasonCode = "";

  if (!enabled) {
    reasonCode = "voice_disabled";
  } else if (!phoneNumber) {
    reasonCode = "voice_phone_number_missing";
  } else if (provider !== "twilio") {
    reasonCode = "voice_provider_unsupported";
  }

  return {
    available: true,
    ready: !reasonCode,
    reasonCode,
    provider,
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
    operatorRouting: {
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
    },
    realtime: {
      model: s(meta.realtimeModel || meta.model || "gpt-4o-realtime-preview"),
      voice: s(meta.realtimeVoice || meta.voice || "alloy"),
      instructions: s(normalized.instructions || meta.instructions || ""),
    },
    telephony: {
      phoneNumber,
      phoneSid: s(normalized.twilioPhoneSid),
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
