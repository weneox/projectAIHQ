function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function buildVoiceConfigFromProjectedRuntime(
  projectedRuntime,
  { tenantKey, toNumber } = {}
) {
  const runtime = obj(projectedRuntime);
  const authority = obj(runtime.authority);
  const tenant = obj(runtime.tenant);
  const voice = obj(obj(runtime.channels).voice);
  const operationalVoice = obj(obj(runtime.operational).voice);
  const contact = obj(voice.contact);
  const operator = obj(operationalVoice.operator);
  const operatorRouting = obj(operationalVoice.operatorRouting);
  const realtime = obj(operationalVoice.realtime);
  const voiceProfile = obj(voice.profile);

  const resolvedTenantKey = lower(
    tenant.tenantKey || authority.tenantKey || tenantKey || "default"
  );
  const companyName = s(tenant.companyName || tenant.displayName || resolvedTenantKey);
  const defaultLanguage = lower(
    voiceProfile.defaultLanguage || tenant.mainLanguage || "en"
  );

  return {
    ok: true,
    tenantId: s(tenant.tenantId || authority.tenantId),
    tenantKey: resolvedTenantKey,
    companyName,
    defaultLanguage,
    authority,
    projectedRuntime: runtime,
    match: {
      tenantKey: s(tenantKey),
      toNumber: s(toNumber),
    },
    contact: {
      phoneLocal: s(obj(operationalVoice.contact).phoneLocal),
      phoneIntl: s(contact.phoneIntl || obj(operationalVoice.contact).phoneIntl),
      emailLocal: s(obj(operationalVoice.contact).emailLocal),
      emailIntl: s(contact.emailIntl || obj(operationalVoice.contact).emailIntl),
      website: s(contact.website || obj(operationalVoice.contact).website),
    },
    operator: {
      phone: s(operator.phone),
      callerId: s(operator.callerId),
      mode: lower(operator.mode || "manual"),
    },
    operatorRouting,
    realtime: {
      model: s(realtime.model || "gpt-4o-realtime-preview"),
      voice: s(realtime.voice || "alloy"),
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
      businessSummary: s(voiceProfile.businessSummary),
      allowedTopics: Array.isArray(voiceProfile.allowedTopics)
        ? voiceProfile.allowedTopics
        : [],
      forbiddenTopics: Array.isArray(voiceProfile.forbiddenTopics)
        ? voiceProfile.forbiddenTopics
        : [],
      leadCaptureMode: s(voiceProfile.leadCaptureMode || "none"),
      transferMode: s(
        voiceProfile.transferMode || operatorRouting.mode || "manual"
      ),
      contactPolicy:
        voiceProfile.contactPolicy &&
        typeof voiceProfile.contactPolicy === "object" &&
        !Array.isArray(voiceProfile.contactPolicy)
          ? voiceProfile.contactPolicy
          : {
              sharePhone: false,
              shareEmail: false,
              shareWebsite: false,
            },
      texts:
        voiceProfile.texts &&
        typeof voiceProfile.texts === "object" &&
        !Array.isArray(voiceProfile.texts)
          ? voiceProfile.texts
          : {},
    },
  };
}
