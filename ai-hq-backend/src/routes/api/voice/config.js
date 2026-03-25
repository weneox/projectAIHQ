import { s, isObj, toArray } from "./shared.js";

export function normalizeDepartmentMap(input) {
  const src = isObj(input) ? input : {};
  const out = {};

  for (const [rawKey, rawValue] of Object.entries(src)) {
    const key = s(rawKey).toLowerCase();
    if (!key) continue;

    const item = isObj(rawValue) ? rawValue : {};
    out[key] = {
      enabled: String(item.enabled ?? "true").trim() !== "false",
      label: s(item.label || key),
      phone: s(item.phone),
      callerId: s(item.callerId),
      fallbackDepartment: s(item.fallbackDepartment).toLowerCase(),
      keywords: toArray(item.keywords).map((x) => s(x)).filter(Boolean),
      businessHours: isObj(item.businessHours) ? item.businessHours : {},
      meta: isObj(item.meta) ? item.meta : {},
    };
  }

  return out;
}

export function buildOperatorRouting(meta = {}, operator = {}, voiceProfile = {}) {
  const routing = isObj(operator.routing)
    ? operator.routing
    : isObj(meta.operatorRouting)
      ? meta.operatorRouting
      : isObj(meta.operator_routing)
        ? meta.operator_routing
        : {};

  const departments = normalizeDepartmentMap(
    routing.departments ||
      operator.departments ||
      operator.department ||
      meta.operatorDepartments ||
      meta.operator_departments ||
      {}
  );

  const defaultDepartment = s(
    routing.defaultDepartment ||
      operator.defaultDepartment ||
      meta.defaultOperatorDepartment ||
      meta.default_operator_department
  ).toLowerCase();

  const mode = s(
    routing.mode || operator.mode || voiceProfile.transferMode || "manual"
  ).toLowerCase();

  return {
    mode: mode || "manual",
    defaultDepartment: defaultDepartment || "",
    departments,
  };
}

export function buildVoiceConfigFromTenantRow(row, { tenantKey, toNumber }) {
  const meta = isObj(row?.meta) ? row.meta : {};
  const voice = isObj(meta.voice) ? meta.voice : {};
  const contact = isObj(meta.contact) ? meta.contact : {};
  const operator = isObj(meta.operator) ? meta.operator : {};
  const realtime = isObj(meta.realtime) ? meta.realtime : {};

  const voiceProfile = isObj(voice.voiceProfile)
    ? voice.voiceProfile
    : isObj(meta.voiceProfile)
      ? meta.voiceProfile
      : {};

  const resolvedTenantKey = s(row?.tenant_key || tenantKey || "default");
  const companyName = s(
    row?.company_name || voiceProfile.companyName || resolvedTenantKey || "Company"
  );
  const defaultLanguage = s(
    row?.default_language || voiceProfile.defaultLanguage || "en"
  ).toLowerCase();

  const operatorRouting = buildOperatorRouting(meta, operator, voiceProfile);

  return {
    ok: true,
    tenantId: s(row?.id),
    tenantKey: resolvedTenantKey,
    companyName,
    defaultLanguage,
    match: {
      tenantKey: s(tenantKey),
      toNumber: s(toNumber),
    },
    contact: {
      phoneLocal: s(contact.phoneLocal || meta.phone_local || ""),
      phoneIntl: s(contact.phoneIntl || meta.phone_intl || meta.phone || ""),
      emailLocal: s(contact.emailLocal || meta.email_local || ""),
      emailIntl: s(contact.emailIntl || meta.email_intl || meta.email || ""),
      website: s(contact.website || meta.website || ""),
    },
    operator: {
      phone: s(operator.phone || meta.operator_phone || ""),
      callerId: s(operator.callerId || meta.twilio_caller_id || ""),
      mode: s(operator.mode || "manual").toLowerCase(),
    },
    operatorRouting,
    realtime: {
      model: s(realtime.model || voice.realtimeModel || "gpt-4o-realtime-preview"),
      voice: s(realtime.voice || voice.realtimeVoice || "alloy"),
      instructions: s(realtime.instructions || ""),
    },
    voiceProfile: {
      companyName,
      assistantName: s(voiceProfile.assistantName || "Virtual Assistant"),
      roleLabel: s(voiceProfile.roleLabel || "virtual assistant"),
      defaultLanguage,
      purpose: s(voiceProfile.purpose || "general"),
      tone: s(voiceProfile.tone || "professional"),
      answerStyle: s(voiceProfile.answerStyle || "short_clear"),
      askStyle: s(voiceProfile.askStyle || "single_question"),
      businessSummary: s(
        voiceProfile.businessSummary ||
          meta.business_summary ||
          "Help callers clearly and accurately using only the configured company information."
      ),
      allowedTopics: toArray(voiceProfile.allowedTopics),
      forbiddenTopics: toArray(voiceProfile.forbiddenTopics),
      leadCaptureMode: s(voiceProfile.leadCaptureMode || "none"),
      transferMode: s(voiceProfile.transferMode || operatorRouting.mode || "manual"),
      contactPolicy: isObj(voiceProfile.contactPolicy)
        ? voiceProfile.contactPolicy
        : {
            sharePhone: false,
            shareEmail: false,
            shareWebsite: false,
          },
      texts: isObj(voiceProfile.texts) ? voiceProfile.texts : {},
    },
  };
}