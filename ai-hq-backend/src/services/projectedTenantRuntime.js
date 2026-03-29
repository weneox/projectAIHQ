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
  error.reasonCode = s(
    reasonCode ||
      authority.reasonCode ||
      authority.reason ||
      "runtime_authority_unavailable"
  );
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
    summary: s(
      service.description || service.summaryText || service.summary || ""
    ),
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
      keywords: arr(item.keywords)
        .map((entry) => s(entry))
        .filter(Boolean),
      businessHours: obj(item.businessHours || item.business_hours),
      meta: obj(item.meta),
    };
  }

  return departments;
}

function buildVoiceOperationalConfig(operationalChannels = {}) {
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
    ready: voiceOperational.ready === true,
    available: voiceOperational.available === true,
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
    profile.summaryShort ||
      profile.summaryLong ||
      profile.valueProposition ||
      ""
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
      ["instagram", "facebook", "messenger"].includes(
        lower(item?.channelType)
      )
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

function normalizeAffectedSurfaces(health = {}) {
  const value = obj(health);
  const merged = [
    ...arr(value.affectedSurfaces),
    ...arr(value.affected_surfaces),
    ...arr(value.surfaces),
    ...arr(value.surfaceKeys),
  ];

  return [...new Set(merged.map((item) => lower(item)).filter(Boolean))];
}

function resolveConsumerSurface({
  matchedChannel = null,
  providerSecrets = null,
  operationalChannels = null,
} = {}) {
  const match = obj(matchedChannel);
  const ops = obj(operationalChannels);
  const voice = obj(ops.voice);

  if (Object.keys(voice).length > 0) return "voice";

  const provider = lower(match.provider);
  const channelType = lower(match.channel_type || match.channelType);

  if (
    provider === "meta" ||
    ["instagram", "facebook", "messenger"].includes(channelType)
  ) {
    return "meta";
  }

  if (provider === "twilio") return "twilio";

  if (providerSecrets && Object.keys(obj(providerSecrets)).length > 0) {
    return "meta";
  }

  return "";
}

function shouldTreatMissingHealthAsFatal({
  authority = {},
  projectionId = "",
  health = {},
} = {}) {
  const reasonCode = lower(
    health.primaryReasonCode ||
      health.reasonCode ||
      authority.reasonCode ||
      authority.reason
  );

  if (!projectionId) return true;

  if (
    reasonCode === "projection_missing" ||
    reasonCode === "runtime_projection_missing" ||
    reasonCode === "authority_invalid"
  ) {
    return true;
  }

  return false;
}

function shouldAllowVoiceDespiteAuthorityStale({
  authority = {},
  health = {},
  consumerSurface = "",
  operationalChannels = null,
} = {}) {
  const normalizedReasonCode = lower(
    authority.reasonCode ||
      authority.reason_code ||
      health.primaryReasonCode ||
      health.reasonCode
  );
  const voiceOperational = obj(obj(operationalChannels).voice);

  return (
    consumerSurface === "voice" &&
    authority.available === true &&
    s(authority.source) === "approved_runtime_projection" &&
    voiceOperational.ready === true &&
    ["projection_stale", "truth_version_drift"].includes(
      normalizedReasonCode
    )
  );
}

function shouldBlockForProjectionHealth({
  authority = {},
  projectionId = "",
  health = {},
  consumerSurface = "",
  operationalChannels = null,
} = {}) {
  const status = lower(health.status);
  const normalizedReasonCode = lower(
    health.primaryReasonCode || health.reasonCode || authority.reasonCode
  );
  const voiceOperational = obj(obj(operationalChannels).voice);

  if (!["missing", "stale", "blocked", "invalid"].includes(status)) {
    return false;
  }

  if (status === "missing") {
    return shouldTreatMissingHealthAsFatal({
      authority,
      projectionId,
      health,
    });
  }

  if (status === "blocked") {
    const affectedSurfaces = normalizeAffectedSurfaces(health);

    if (consumerSurface && affectedSurfaces.length > 0) {
      const affectsThisSurface =
        affectedSurfaces.includes(consumerSurface) ||
        affectedSurfaces.includes("all") ||
        affectedSurfaces.includes("global") ||
        affectedSurfaces.includes("runtime");

      if (!affectsThisSurface) {
        return false;
      }
    }
  }

  if (
    consumerSurface === "voice" &&
    status === "stale" &&
    voiceOperational.ready === true &&
    ["projection_stale", "truth_version_drift"].includes(normalizedReasonCode)
  ) {
    return false;
  }

  return true;
}

function buildProjectionExecutionPolicy(projection = {}, runtime = {}) {
  const metadata = obj(projection.metadata_json);
  const approvalPolicy = obj(
    metadata.approvalPolicy || metadata.approval_policy
  );
  const policyControls = obj(runtime.policyControls || runtime.policy_controls);

  return {
    approvalPolicy,
    policyControls,
    posture: {
      authorityAvailable: obj(runtime.authority).available === true,
      projectionHealthStatus: s(obj(runtime.projectionHealth).status),
      truthApprovalOutcome: s(
        approvalPolicy.strictestOutcome ||
          approvalPolicy.strictest_outcome ||
          approvalPolicy.outcome
      ),
      truthRiskLevel: s(
        obj(approvalPolicy.risk).level || approvalPolicy.riskLevel
      ),
      affectedSurfaces: arr(
        approvalPolicy.affectedSurfaces ||
          approvalPolicy.affected_surfaces ||
          obj(approvalPolicy.signals).affectedSurfaces
      ),
      policyControlMode: s(
        obj(
          policyControls.tenantDefault || policyControls.tenant_default
        ).controlMode
      ),
    },
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
  const projection = obj(
    raw.projection || raw.runtimeProjection || raw.currentProjection
  );
  const projectionId = s(projection.id || authority.runtimeProjectionId);
  const health = obj(
    authority.health ||
      raw.projectionHealth ||
      projection.health ||
      projection.health_json
  );
  const consumerSurface = resolveConsumerSurface({
    matchedChannel,
    providerSecrets,
    operationalChannels,
  });

  const allowVoiceDespiteAuthorityStale =
    shouldAllowVoiceDespiteAuthorityStale({
      authority,
      health,
      consumerSurface,
      operationalChannels,
    });

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

  if (authority.stale === true && !allowVoiceDespiteAuthorityStale) {
    throw createProjectedRuntimeAuthorityError(
      authority,
      s(
        authority.reasonCode || authority.reason || "runtime_projection_stale"
      )
    );
  }

  if (!projectionId) {
    throw createProjectedRuntimeAuthorityError(
      authority,
      "runtime_projection_missing"
    );
  }

  if (
    shouldBlockForProjectionHealth({
      authority,
      projectionId,
      health,
      consumerSurface,
      operationalChannels,
    })
  ) {
    throw createProjectedRuntimeAuthorityError(
      authority,
      s(
        health.primaryReasonCode ||
          health.reasonCode ||
          authority.reasonCode ||
          "runtime_authority_unavailable"
      )
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

  const projectedRuntime = {
    authority: {
      ...authority,
      health,
      runtimeProjectionId: projectionId,
      projectionHash: s(projection.projection_hash),
      sourceSnapshotId: s(projection.source_snapshot_id),
      sourceProfileId: s(projection.source_profile_id),
      sourceCapabilitiesId: s(projection.source_capabilities_id),
      readinessLabel: s(projection.readiness_label),
      readinessScore: Number.isFinite(Number(projection.readiness_score))
        ? Number(projection.readiness_score)
        : null,
      confidenceLabel: s(projection.confidence_label),
      confidence: Number.isFinite(Number(projection.confidence))
        ? Number(projection.confidence)
        : null,
    },
    projectionHealth: health,
    tenant: {
      tenantId: s(
        identity.tenantId ||
          identity.tenant_id ||
          tenantRow?.tenant_id ||
          tenantRow?.id ||
          authority.tenantId
      ),
      tenantKey: lower(
        identity.tenantKey ||
          identity.tenant_key ||
          tenantRow?.tenant_key ||
          authority.tenantKey
      ),
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
            channelType: s(
              matchedChannel.channel_type || matchedChannel.channelType
            ),
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

  return {
    ...projectedRuntime,
    executionPolicy: buildProjectionExecutionPolicy(projection, projectedRuntime),
  };
}