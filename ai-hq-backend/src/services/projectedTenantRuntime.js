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

function createProjectedRuntimeAuthorityError(authority = {}, reasonCode = "") {
  const error = new Error(
    "Approved runtime authority is unavailable for downstream projected runtime consumers."
  );
  error.code = "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE";
  error.statusCode = 409;
  error.reasonCode = s(reasonCode || authority.reasonCode || authority.reason || "runtime_authority_unavailable");
  error.runtimeAuthority = {
    ...obj(authority),
    available: false,
    reasonCode: error.reasonCode,
    reason: error.reasonCode,
  };
  return error;
}

function pickPrimaryContact(contacts = [], channel = "") {
  const safeChannel = lower(channel);
  const list = arr(contacts);

  return (
    list.find(
      (item) => lower(item?.channel) === safeChannel && item?.isPrimary === true
    ) ||
    list.find((item) => lower(item?.channel) === safeChannel) ||
    null
  );
}

function toServiceSummary(service = {}) {
  return {
    serviceKey: s(service.serviceKey || service.service_key || ""),
    title: s(service.title || service.name || ""),
    summary: s(service.description || service.summaryText || service.summary || ""),
  };
}

function normalizeDepartmentMap(input = {}) {
  const source = obj(input);
  const departments = {};

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = lower(rawKey);
    if (!key) continue;

    const item = obj(rawValue);
    departments[key] = {
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

  return departments;
}

function buildVoiceOperationalConfig(
  operationalChannels = {}
) {
  const voiceOperational = obj(obj(operationalChannels).voice);
  const telephony = obj(voiceOperational.telephony);

  return {
    contact: {
      phoneLocal: "",
      phoneIntl: s(telephony.phoneNumber),
      emailLocal: "",
      emailIntl: "",
      website: "",
    },
    operator: obj(voiceOperational.operator),
    operatorRouting: obj(voiceOperational.operatorRouting),
    realtime: obj(voiceOperational.realtime),
    telephony: obj(voiceOperational.telephony),
    callback: obj(voiceOperational.callback),
    transfer: obj(voiceOperational.transfer),
    limits: obj(voiceOperational.limits),
    reasonCode: s(voiceOperational.reasonCode),
    source: s(voiceOperational.source),
    updatedAt: s(voiceOperational.updatedAt),
    contractHash: s(voiceOperational.contractHash),
  };
}

function buildVoiceProfile({
  identity = {},
  profile = {},
  services = [],
  voice = {},
  leadCapture = {},
  handoff = {},
} = {}) {
  const companyName = s(identity.companyName || identity.displayName || "");
  const defaultLanguage = lower(identity.mainLanguage || "en");
  const businessSummary = s(
    profile.summaryShort || profile.summaryLong || profile.valueProposition || ""
  );

  return {
    companyName,
    assistantName: s(identity.displayName || companyName || "Virtual Assistant"),
    roleLabel: "virtual assistant",
    defaultLanguage,
    purpose: "general",
    tone: s(profile.toneProfile || "professional"),
    answerStyle: "short_clear",
    askStyle: "single_question",
    businessSummary,
    allowedTopics: arr(services)
      .map((item) => s(item.title || item.name))
      .filter(Boolean),
    forbiddenTopics: [],
    leadCaptureMode: leadCapture.enabled
      ? s(leadCapture.contactCaptureMode || "guided")
      : "none",
    transferMode: handoff.enabled
      ? s(handoff.escalationMode || "manual")
      : "manual",
    contactPolicy: {
      sharePhone: Boolean(s(voice.primaryPhone)),
      shareEmail: false,
      shareWebsite: Boolean(s(identity.websiteUrl || profile.websiteUrl)),
    },
    texts: {},
  };
}

function buildMetaChannelRuntime({
  projectionChannels = [],
  matchedChannel = null,
} = {}) {
  const match = obj(matchedChannel);
  const projected =
    arr(projectionChannels).find((item) =>
      ["instagram", "facebook", "messenger"].includes(lower(item?.channelType))
    ) || {};

  return {
    enabled:
      lower(projected.channelType) === "instagram" ||
      lower(projected.channelType) === "facebook" ||
      lower(match.channel_type) === "instagram" ||
      lower(match.channel_type) === "facebook",
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

export function buildProjectedTenantRuntime({
  runtime = {},
  tenantRow = null,
  matchedChannel = null,
  providerSecrets = null,
  operationalChannels = null,
} = {}) {
  const raw = obj(runtime.raw);
  const authority = obj(runtime.authority);
  const projection = obj(raw.projection);
  const projectionId = s(projection.id || authority.runtimeProjectionId);
  const health = obj(authority.health);

  if (authority.mode !== "strict" || authority.required !== true) {
    throw createProjectedRuntimeAuthorityError(
      authority,
      "runtime_authority_mode_invalid"
    );
  }

  if (authority.available !== true) {
    throw createProjectedRuntimeAuthorityError(authority);
  }

  if (s(authority.source) !== "approved_runtime_projection") {
    throw createProjectedRuntimeAuthorityError(
      authority,
      "runtime_authority_source_invalid"
    );
  }

  if (authority.stale === true) {
    throw createProjectedRuntimeAuthorityError(
      authority,
      s(authority.reasonCode || authority.reason || "runtime_projection_stale")
    );
  }

  if (!projectionId) {
    throw createProjectedRuntimeAuthorityError(
      authority,
      "runtime_projection_missing"
    );
  }

  if (["missing", "stale", "blocked", "invalid"].includes(lower(health.status))) {
    throw createProjectedRuntimeAuthorityError(
      authority,
      s(health.primaryReasonCode || authority.reasonCode || "runtime_authority_unavailable")
    );
  }

  const identity = obj(projection.identity_json);
  const profile = obj(projection.profile_json);
  const contacts = arr(projection.contacts_json);
  const services = arr(projection.services_json);
  const voice = obj(projection.voice_json);
  const inbox = obj(projection.inbox_json);
  const comments = obj(projection.comments_json);
  const leadCapture = obj(projection.lead_capture_json);
  const handoff = obj(projection.handoff_json);
  const projectionChannels = arr(projection.channels_json);
  const primaryPhone = pickPrimaryContact(contacts, "phone");
  const primaryEmail = pickPrimaryContact(contacts, "email");
  const operationalVoice = buildVoiceOperationalConfig(operationalChannels || {});
  const voiceProfile = buildVoiceProfile({
    identity,
    profile,
    services,
    voice,
    leadCapture,
    handoff,
  });

  return {
    authority: {
      ...authority,
      health,
      runtimeProjectionId: projectionId,
      projectionHash: s(projection.projection_hash),
      sourceSnapshotId: s(projection.source_snapshot_id),
      sourceProfileId: s(projection.source_profile_id),
      sourceCapabilitiesId: s(projection.source_capabilities_id),
      readinessLabel: s(projection.readiness_label),
      readinessScore:
        Number.isFinite(Number(projection.readiness_score))
          ? Number(projection.readiness_score)
          : null,
      confidenceLabel: s(projection.confidence_label),
      confidence:
        Number.isFinite(Number(projection.confidence))
          ? Number(projection.confidence)
          : null,
    },
    projectionHealth: health,
    tenant: {
      tenantId: s(identity.tenantId || authority.tenantId),
      tenantKey: lower(identity.tenantKey || authority.tenantKey),
      companyName: s(identity.companyName),
      displayName: s(identity.displayName || identity.companyName),
      legalName: s(identity.legalName),
      industryKey: s(identity.industryKey),
      websiteUrl: s(identity.websiteUrl || profile.websiteUrl),
      mainLanguage: lower(identity.mainLanguage || "en"),
      supportedLanguages: arr(identity.supportedLanguages)
        .map((item) => lower(item))
        .filter(Boolean),
      profile: {
        summaryShort: s(profile.summaryShort),
        summaryLong: s(profile.summaryLong),
        valueProposition: s(profile.valueProposition),
        targetAudience: s(profile.targetAudience),
        toneProfile: s(profile.toneProfile),
      },
      contacts: {
        primaryPhone: s(primaryPhone?.value || voice.primaryPhone),
        primaryEmail: s(primaryEmail?.value),
        websiteUrl: s(identity.websiteUrl || profile.websiteUrl),
      },
      services: services.map(toServiceSummary).filter((item) => item.title),
    },
    channels: {
      inbox,
      comments,
      voice: {
        enabled: voice.enabled === true,
        supportsCalls: voice.supportsCalls === true,
        primaryPhone: s(voice.primaryPhone || primaryPhone?.value),
        canOfferCallback: voice.canOfferCallback === true,
        canOfferConsultation: voice.canOfferConsultation === true,
        profile: voiceProfile,
        contact: {
          phoneIntl: s(primaryPhone?.value || voice.primaryPhone),
          emailIntl: s(primaryEmail?.value),
          website: s(identity.websiteUrl || profile.websiteUrl),
        },
        handoff,
        leadCapture,
      },
      meta: buildMetaChannelRuntime({
        projectionChannels,
        matchedChannel,
      }),
    },
    operational: {
      voice: operationalVoice,
      matchedChannel: matchedChannel
        ? {
            id: s(matchedChannel.id),
            channelType: s(matchedChannel.channel_type || matchedChannel.channelType),
            provider: s(matchedChannel.provider),
            pageId: s(matchedChannel.external_page_id),
            igUserId: s(matchedChannel.external_user_id),
            accountId: s(matchedChannel.external_account_id),
            username: s(matchedChannel.external_username),
            status: s(matchedChannel.status),
          }
        : null,
      providerSecrets: providerSecrets ? obj(providerSecrets) : {},
    },
  };
}
