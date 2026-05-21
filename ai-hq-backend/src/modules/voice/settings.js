import {
  getTenantVoiceSettings,
  upsertTenantVoiceSettings,
} from "../../db/helpers/voice.js";
import { b, isObj, n, s } from "./shared.js";

function normalizeVoiceActionMode(value = "") {
  const raw = s(value).toLowerCase();
  return ["live", "request_only", "disabled"].includes(raw) ? raw : "disabled";
}

function normalizeVoiceBusinessFamily(value = "") {
  const raw = s(value).toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  if (raw === "generic" || raw === "general") return "generic_business";

  return ["restaurant", "hotel", "clinic", "salon", "ecommerce", "generic_business"].includes(raw)
    ? raw
    : "generic_business";
}

function normalizeVoiceActionProvider(value = "") {
  return s(value).toLowerCase();
}

function normalizeVoiceActionScope(input = {}, key = "") {
  const item = isObj(input[key]) ? input[key] : {};

  return {
    mode: normalizeVoiceActionMode(
      item.mode ||
        input[`${key}Mode`] ||
        input[`${key}_mode`]
    ),
    provider: normalizeVoiceActionProvider(
      item.provider ||
        input[`${key}Provider`] ||
        input[`${key}_provider`]
    ),
  };
}

function normalizeVoiceActionsInput(value = {}) {
  const input = isObj(value) ? value : {};
  const businessType = normalizeVoiceBusinessFamily(
    input.businessType ||
      input.business_type ||
      input.businessFamily ||
      "generic_business"
  );

  const availability = normalizeVoiceActionScope(input, "availability");
  const ordering = normalizeVoiceActionScope(input, "ordering");
  const reservation = normalizeVoiceActionScope(input, "reservation");
  const appointment = normalizeVoiceActionScope(input, "appointment");
  const handoff = normalizeVoiceActionScope(input, "handoff");

  return {
    businessType,
    businessFamily: businessType,
    availabilityMode: availability.mode,
    orderingMode: ordering.mode,
    reservationMode: reservation.mode,
    appointmentMode: appointment.mode,
    handoffMode: handoff.mode,
    availability,
    ordering,
    reservation,
    appointment,
    handoff,
  };
}

export function normalizeVoiceSettingsInput(body = {}) {
  const bodyMeta = isObj(body.meta) ? body.meta : {};
  const actionInput = isObj(body.actions)
    ? body.actions
    : isObj(body.voiceActions)
      ? body.voiceActions
      : isObj(bodyMeta.actions)
        ? bodyMeta.actions
        : isObj(bodyMeta.voiceActions)
          ? bodyMeta.voiceActions
          : {};
  const actions = normalizeVoiceActionsInput(actionInput);

  return {
    enabled: b(body.enabled, false),
    provider: s(body.provider, "twilio"),
    mode: s(body.mode, "assistant"),

    displayName: s(body.displayName),
    defaultLanguage: s(body.defaultLanguage, "en"),
    supportedLanguages: Array.isArray(body.supportedLanguages)
      ? body.supportedLanguages.map((x) => s(x)).filter(Boolean)
      : ["en"],

    greeting: isObj(body.greeting) ? body.greeting : {},
    fallbackGreeting: isObj(body.fallbackGreeting) ? body.fallbackGreeting : {},
    businessContext: s(body.businessContext),
    instructions: s(body.instructions),

    businessHoursEnabled: b(body.businessHoursEnabled, false),
    businessHours: isObj(body.businessHours) ? body.businessHours : {},

    operatorEnabled: b(body.operatorEnabled, true),
    operatorPhone: s(body.operatorPhone),
    operatorLabel: s(body.operatorLabel),
    transferStrategy: s(body.transferStrategy, "handoff"),

    callbackEnabled: b(body.callbackEnabled, true),
    callbackMode: s(body.callbackMode, "lead_only"),

    maxCallSeconds: Math.max(15, Math.min(3600, n(body.maxCallSeconds, 180))),
    silenceHangupSeconds: Math.max(
      3,
      Math.min(120, n(body.silenceHangupSeconds, 12))
    ),

    captureRules: isObj(body.captureRules) ? body.captureRules : {},
    leadRules: isObj(body.leadRules) ? body.leadRules : {},
    escalationRules: isObj(body.escalationRules) ? body.escalationRules : {},
    reportingRules: isObj(body.reportingRules) ? body.reportingRules : {},

    twilioPhoneNumber: s(body.twilioPhoneNumber),
    twilioPhoneSid: s(body.twilioPhoneSid),
    twilioConfig: isObj(body.twilioConfig) ? body.twilioConfig : {},

    costControl: isObj(body.costControl) ? body.costControl : {},
    actions,
    meta: {
      ...bodyMeta,
      actions,
    },
  };
}

export async function readTenantVoiceSettings({ db, tenantId }) {
  return getTenantVoiceSettings(db, tenantId);
}

export async function saveTenantVoiceSettings({
  db,
  tenantId,
  tenantKey = "",
  body = {},
  audit = null,
  actor = "system",
} = {}) {
  const input = normalizeVoiceSettingsInput(body);
  const settings = await upsertTenantVoiceSettings(db, tenantId, input);

  try {
    if (audit?.log) {
      await audit.log({
        tenantId,
        tenantKey,
        actor,
        action: "voice.settings.updated",
        objectType: "tenant_voice_settings",
        objectId: tenantId,
        meta: {
          enabled: settings?.enabled ?? input.enabled,
          provider: settings?.provider ?? input.provider,
          mode: settings?.mode ?? input.mode,
        },
      });
    }
  } catch {}

  return settings;
}

export async function toggleTenantVoiceSettings({
  db,
  tenantId,
  enabled: requestedEnabled,
} = {}) {
  const current = await getTenantVoiceSettings(db, tenantId);
  const enabled = b(requestedEnabled, !current?.enabled);
  const settings = await upsertTenantVoiceSettings(db, tenantId, {
    ...(current || {}),
    enabled,
  });

  return {
    enabled,
    settings,
  };
}
