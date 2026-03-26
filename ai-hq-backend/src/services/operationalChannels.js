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

  const meta = obj(settings.meta);
  const routing = obj(meta.operatorRouting || meta.operator_routing);
  const twilioConfig = obj(settings.twilioConfig);

  const enabled = bool(settings.enabled, false);
  const phoneNumber = s(settings.twilioPhoneNumber);
  const provider = lower(settings.provider || "twilio");
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
    mode: lower(settings.mode || "assistant"),
    displayName: s(settings.displayName || tenantRow.company_name),
    defaultLanguage: lower(settings.defaultLanguage || tenantRow.default_language || "en"),
    supportedLanguages: arr(settings.supportedLanguages)
      .map((entry) => lower(entry))
      .filter(Boolean),
    operator: {
      enabled: bool(settings.operatorEnabled, true),
      phone: s(settings.operatorPhone),
      callerId: s(
        twilioConfig.callerId || twilioConfig.caller_id || meta.callerId || meta.caller_id
      ),
      label: s(settings.operatorLabel || "operator"),
      mode: lower(meta.operatorMode || "manual"),
    },
    operatorRouting: {
      mode: lower(
        routing.mode ||
          meta.transferMode ||
          settings.transferStrategy ||
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
      instructions: s(settings.instructions || meta.instructions || ""),
    },
    telephony: {
      phoneNumber,
      phoneSid: s(settings.twilioPhoneSid),
    },
    callback: {
      enabled: bool(settings.callbackEnabled, true),
      mode: s(settings.callbackMode || "lead_only"),
    },
    transfer: {
      strategy: lower(settings.transferStrategy || "handoff"),
    },
    limits: {
      maxCallSeconds: Number(settings.maxCallSeconds || 0) || 0,
      silenceHangupSeconds: Number(settings.silenceHangupSeconds || 0) || 0,
    },
    source: "tenant_voice_settings",
    updatedAt: s(settings.updatedAt),
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
    isConnected: s(channel.status).toLowerCase() === "active",
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
  voiceSettings = null,
  matchedChannel = null,
} = {}) {
  const resolvedVoiceSettings =
    voiceSettings || (await loadVoiceOperationalSettings({ db, tenantId, tenantRow }));

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
