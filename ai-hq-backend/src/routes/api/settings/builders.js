import {
  cleanLower,
  cleanNullableString,
  cleanString,
  normalizeBool,
  normalizeJsonDateish,
  normalizeNumber,
  safeJsonArr,
  safeJsonObj,
} from "./utils.js";

export function buildTenantCoreSaveInput(input = {}, role = "member") {
  const out = {
    company_name: cleanString(input.company_name),
    industry_key: cleanLower(input.industry_key || "generic_business"),
    country_code: cleanString(input.country_code || "AZ").toUpperCase(),
    timezone: cleanString(input.timezone || "Asia/Baku"),
    default_language: cleanLower(input.default_language || "az"),
    enabled_languages: safeJsonArr(input.enabled_languages, ["az"])
      .map((x) => cleanLower(x))
      .filter(Boolean),
    market_region: cleanString(input.market_region),
  };

  if (!out.enabled_languages.length) {
    out.enabled_languages = ["az"];
  }

  if (role === "owner") {
    out.legal_name = cleanString(input.legal_name);
  }

  return out;
}

export function buildProfileSaveInput(input = {}) {
  return {
    brand_name: cleanString(input.brand_name),
    website_url: cleanString(input.website_url),
    public_email: cleanString(input.public_email),
    public_phone: cleanString(input.public_phone),
    audience_summary: cleanString(input.audience_summary),
    services_summary: cleanString(input.services_summary),
    value_proposition: cleanString(input.value_proposition),
    brand_summary: cleanString(input.brand_summary),
    tone_of_voice: cleanLower(input.tone_of_voice || "professional"),
    preferred_cta: cleanString(input.preferred_cta),
    banned_phrases: safeJsonArr(input.banned_phrases, []),
    communication_rules: safeJsonObj(input.communication_rules, {}),
    visual_style: safeJsonObj(input.visual_style, {}),
    extra_context: safeJsonObj(input.extra_context, {}),
  };
}

export function normalizeTimeString(input, fallback = "10:00") {
  const raw = cleanString(input, fallback);
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(raw);
  if (!m) return fallback;

  const hh = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));

  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function normalizeAutomationMode(v, fallback = "manual") {
  const x = cleanLower(v, fallback);
  if (x === "full_auto") return "full_auto";
  return "manual";
}

export function buildNormalizedPublishPolicy(input = {}, tenantTimezone = "Asia/Baku") {
  const root = safeJsonObj(input, {});

  const oldDraftSchedule = safeJsonObj(root.draftSchedule, {});
  const rawSchedule = safeJsonObj(root.schedule, {});
  const rawAutomation = safeJsonObj(root.automation, {});

  const fallbackHour = Number.isFinite(Number(oldDraftSchedule.hour))
    ? Math.max(0, Math.min(23, Number(oldDraftSchedule.hour)))
    : 10;

  const fallbackMinute = Number.isFinite(Number(oldDraftSchedule.minute))
    ? Math.max(0, Math.min(59, Number(oldDraftSchedule.minute)))
    : 0;

  const fallbackTime = `${String(fallbackHour).padStart(2, "0")}:${String(
    fallbackMinute
  ).padStart(2, "0")}`;

  const schedule = {
    enabled:
      typeof rawSchedule.enabled === "boolean"
        ? rawSchedule.enabled
        : typeof oldDraftSchedule.enabled === "boolean"
        ? oldDraftSchedule.enabled
        : false,
    time: normalizeTimeString(rawSchedule.time || fallbackTime, fallbackTime),
    timezone: cleanString(
      rawSchedule.timezone || oldDraftSchedule.timezone || tenantTimezone || "Asia/Baku",
      "Asia/Baku"
    ),
  };

  const automationEnabled =
    typeof rawAutomation.enabled === "boolean"
      ? rawAutomation.enabled
      : normalizeAutomationMode(rawAutomation.mode, "manual") === "full_auto";

  const automationMode = normalizeAutomationMode(
    rawAutomation.mode,
    automationEnabled ? "full_auto" : "manual"
  );

  const automation = {
    enabled: automationEnabled,
    mode: automationMode,
  };

  return {
    ...root,
    schedule,
    automation,
    draftSchedule: {
      enabled: schedule.enabled,
      hour: Number(schedule.time.split(":")[0]),
      minute: Number(schedule.time.split(":")[1]),
      timezone: schedule.timezone,
      format: cleanLower(oldDraftSchedule.format || "image", "image"),
    },
  };
}

export function buildAiPolicySaveInput(input = {}, role = "member", tenantInput = {}) {
  const tenantTimezone = cleanString(tenantInput?.timezone || "Asia/Baku", "Asia/Baku");

  const out = {
    auto_reply_enabled: normalizeBool(input.auto_reply_enabled, true),
    suppress_ai_during_handoff: normalizeBool(input.suppress_ai_during_handoff, true),
    mark_seen_enabled: normalizeBool(input.mark_seen_enabled, true),
    typing_indicator_enabled: normalizeBool(input.typing_indicator_enabled, true),
    create_lead_enabled: normalizeBool(input.create_lead_enabled, true),
    approval_required_content: normalizeBool(input.approval_required_content, true),
    approval_required_publish: normalizeBool(input.approval_required_publish, true),
    quiet_hours_enabled: normalizeBool(input.quiet_hours_enabled, false),
    quiet_hours: safeJsonObj(input.quiet_hours, { startHour: 0, endHour: 0 }),
    inbox_policy: safeJsonObj(input.inbox_policy, {}),
    comment_policy: safeJsonObj(input.comment_policy, {}),
    content_policy: safeJsonObj(input.content_policy, {}),
    escalation_rules: safeJsonObj(input.escalation_rules, {}),
  };

  if (role === "owner" || role === "admin" || role === "internal") {
    out.risk_rules = safeJsonObj(input.risk_rules, {});
    out.lead_scoring_rules = safeJsonObj(input.lead_scoring_rules, {});
    out.publish_policy = buildNormalizedPublishPolicy(
      safeJsonObj(input.publish_policy, {}),
      tenantTimezone
    );
  }

  return out;
}

export function buildChannelSaveInput(input = {}, role = "member") {
  const out = {
    provider: cleanLower(input.provider || "meta"),
    display_name: cleanString(input.display_name),
    status: cleanLower(input.status || "disconnected"),
    is_primary: normalizeBool(input.is_primary, false),
    config: safeJsonObj(input.config, {}),
  };

  if (role === "owner" || role === "admin" || role === "internal") {
    out.external_account_id = cleanNullableString(input.external_account_id);
    out.external_page_id = cleanNullableString(input.external_page_id);
    out.external_user_id = cleanNullableString(input.external_user_id);
    out.external_username = cleanNullableString(input.external_username);
    out.secrets_ref = cleanNullableString(input.secrets_ref);
    out.health = safeJsonObj(input.health, {});
    out.last_sync_at = normalizeJsonDateish(input.last_sync_at);
  }

  return out;
}

export function buildOperationalChannelSaveInput(input = {}, role = "member") {
  const out = {
    provider: cleanLower(input.provider || "meta"),
    display_name: cleanString(input.display_name),
    status: cleanLower(input.status || "disconnected"),
    is_primary: normalizeBool(input.is_primary, false),
  };

  if (
    role === "owner" ||
    role === "admin" ||
    role === "operator" ||
    role === "internal"
  ) {
    out.external_account_id = cleanNullableString(input.external_account_id);
    out.external_page_id = cleanNullableString(input.external_page_id);
    out.external_user_id = cleanNullableString(input.external_user_id);
    out.external_username = cleanNullableString(input.external_username);
    out.secrets_ref = cleanNullableString(input.secrets_ref);
    out.last_sync_at = normalizeJsonDateish(input.last_sync_at);
  }

  return out;
}

export function buildVoiceOperationalSaveInput(input = {}) {
  const metaInput = safeJsonObj(input.meta, {});
  const twilioConfigInput = safeJsonObj(input.twilioConfig, {});
  const operatorRoutingInput = safeJsonObj(
    metaInput.operatorRouting || metaInput.operator_routing,
    {}
  );

  const out = {
    enabled: normalizeBool(input.enabled, false),
    provider: cleanLower(input.provider || "twilio"),
    mode: cleanLower(input.mode || "assistant"),
    displayName: cleanString(input.displayName),
    defaultLanguage: cleanLower(input.defaultLanguage || "en"),
    supportedLanguages: safeJsonArr(input.supportedLanguages, ["en"])
      .map((item) => cleanLower(item))
      .filter(Boolean),
    instructions: cleanString(input.instructions),
    operatorEnabled: normalizeBool(input.operatorEnabled, true),
    operatorPhone: cleanString(input.operatorPhone),
    operatorLabel: cleanString(input.operatorLabel || "operator"),
    transferStrategy: cleanLower(input.transferStrategy || "handoff"),
    callbackEnabled: normalizeBool(input.callbackEnabled, true),
    callbackMode: cleanLower(input.callbackMode || "lead_only"),
    maxCallSeconds: Math.max(0, normalizeNumber(input.maxCallSeconds, 180)),
    silenceHangupSeconds: Math.max(
      0,
      normalizeNumber(input.silenceHangupSeconds, 12)
    ),
    twilioPhoneNumber: cleanString(input.twilioPhoneNumber),
    twilioPhoneSid: cleanString(input.twilioPhoneSid),
    twilioConfig: {
      callerId: cleanString(
        twilioConfigInput.callerId || twilioConfigInput.caller_id
      ),
    },
    meta: {
      realtimeModel: cleanString(
        metaInput.realtimeModel || metaInput.model || "gpt-4o-realtime-preview"
      ),
      realtimeVoice: cleanString(
        metaInput.realtimeVoice || metaInput.voice || "alloy"
      ),
      instructions: cleanString(metaInput.instructions || input.instructions),
      operatorRouting: {
        mode: cleanLower(
          operatorRoutingInput.mode || input.transferStrategy || "handoff"
        ),
        defaultDepartment: cleanLower(
          operatorRoutingInput.defaultDepartment ||
            operatorRoutingInput.default_department
        ),
        departments: safeJsonObj(operatorRoutingInput.departments, {}),
      },
    },
  };

  if (!out.supportedLanguages.length) {
    out.supportedLanguages = [out.defaultLanguage || "en"];
  }

  return out;
}

export function buildAgentSaveInput(input = {}, role = "member") {
  const out = {
    display_name: cleanString(input.display_name),
    role_summary: cleanString(input.role_summary),
    enabled: normalizeBool(input.enabled, true),
  };

  if (role === "owner" || role === "admin" || role === "internal") {
    out.model = cleanString(input.model);
    out.temperature = normalizeNumber(input.temperature, 0.2);
    out.prompt_overrides = safeJsonObj(input.prompt_overrides, {});
    out.tool_access = safeJsonObj(input.tool_access, {});
    out.limits = safeJsonObj(input.limits, {});
  }

  return out;
}
