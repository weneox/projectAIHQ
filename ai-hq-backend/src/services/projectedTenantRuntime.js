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
  behavior = {},
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
    purpose: s(behavior.conversionGoal || behavior.bookingFlowType || "general"),
    tone: s(behavior.toneProfile || profile.toneProfile || "professional"),
    answerStyle: "short_clear",
    askStyle: "single_question",
    businessSummary,
    allowedTopics: arr(services)
      .map((item) => s(item.title || item.name))
      .filter(Boolean),
    forbiddenTopics: [],
    leadCaptureMode: leadCapture.enabled
      ? s(
          behavior.leadQualificationMode ||
            leadCapture.contactCaptureMode ||
            "guided"
        )
      : "none",
    transferMode: handoff.enabled
      ? s(
          obj(behavior.channelBehavior).voice?.handoffBias ||
            handoff.escalationMode ||
            "manual"
        )
      : "manual",
    contactPolicy: {
      sharePhone: Boolean(s(voice.primaryPhone)),
      shareEmail: false,
      shareWebsite: Boolean(s(identity.websiteUrl || profile.websiteUrl)),
    },
    texts: {},
  };
}

function buildProjectedBehavior({
  identity = {},
  profile = {},
  voice = {},
  leadCapture = {},
  handoff = {},
  behavior = {},
} = {}) {
  const provided = obj(behavior);
  if (Object.keys(provided).length > 0) {
    return provided;
  }

  const niche = lower(identity.industryKey || "general_business");
  const conversionGoal =
    voice.supportsCalls === true
      ? "capture_qualified_lead"
      : "answer_and_route";

  return {
    businessType: niche,
    niche,
    subNiche: "",
    conversionGoal,
    primaryCta: conversionGoal === "capture_qualified_lead" ? "contact_us" : "",
    leadQualificationMode: leadCapture.enabled
      ? "guided_contact_capture"
      : "basic_contact_capture",
    qualificationQuestions: [],
    bookingFlowType: "manual",
    handoffTriggers: handoff.enabled ? ["human_request", "low_confidence"] : [],
    disallowedClaims: [],
    toneProfile: s(profile.toneProfile || "professional"),
    channelBehavior: {
      inbox: {
        primaryAction: conversionGoal,
        qualificationDepth: "guided",
        handoffBias: handoff.enabled ? "conditional" : "minimal",
      },
      comments: {
        primaryAction: "qualify_then_move_to_dm",
        qualificationDepth: "light",
        handoffBias: "minimal",
      },
      voice: {
        primaryAction: "route_or_capture_callback",
        qualificationDepth: "guided",
        handoffBias: handoff.enabled ? "conditional" : "manual",
      },
    },
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

function collectReasonCodes(authority = {}, health = {}) {
  const merged = [
    s(health.primaryReasonCode),
    s(health.reasonCode),
    s(health.primary_reason_code),
    s(health.reason_code),
    s(authority.reasonCode),
    s(authority.reason),
    ...arr(health.reasonCodes),
    ...arr(health.reason_codes),
    ...arr(health.blockerReasonCodes),
    ...arr(health.blocker_reason_codes),
  ];

  return [...new Set(merged.map((item) => lower(item)).filter(Boolean))];
}

function getProviderSecretKeySet(providerSecrets = {}) {
  const value = obj(providerSecrets);
  return new Set(
    [
      ...arr(value.secretKeys),
      ...arr(value.secret_keys),
      ...Object.keys(obj(value)),
    ]
      .map((item) => lower(item))
      .filter(Boolean)
  );
}

function hasMetaProviderAccess(providerSecrets = {}) {
  const value = obj(providerSecrets);
  const secretKeySet = getProviderSecretKeySet(value);

  return (
    Boolean(s(value.pageAccessToken || value.page_access_token)) ||
    secretKeySet.has("page_access_token") ||
    secretKeySet.has("access_token") ||
    secretKeySet.has("meta_page_access_token")
  );
}

const VOICE_OPERATIONAL_REASON_CODES = new Set([
  "voice_settings_missing",
  "voice_disabled",
  "voice_phone_number_missing",
  "voice_provider_unsupported",
]);

const META_OPERATIONAL_REASON_CODES = new Set([
  "channel_not_connected",
  "channel_identifiers_missing",
  "provider_secret_missing",
]);

const NON_FATAL_GOVERNANCE_REVIEW_REASON_CODES = new Set([
  "approval_required",
  "review_required",
  "candidate_review_required",
  "maintenance_review_required",
  "governance_review_required",
]);

function resolveConsumerSurface({
  matchedChannel = null,
  providerSecrets = null,
  operationalChannels = null,
} = {}) {
  const match = obj(matchedChannel);
  const providerSecretValue = obj(providerSecrets);
  const ops = obj(operationalChannels);
  const meta = obj(ops.meta);
  const voice = obj(ops.voice);
  const voiceTelephony = obj(voice.telephony);
  const voiceOperator = obj(voice.operator);

  const explicitProvider = lower(match.provider || providerSecretValue.provider);
  const explicitChannelType = lower(match.channel_type || match.channelType);

  const metaHasOperationalIdentity =
    meta.available === true ||
    meta.ready === true ||
    Boolean(
      s(match.id) ||
        s(match.external_page_id || match.pageId) ||
        s(match.external_user_id || match.igUserId) ||
        s(match.external_account_id || match.accountId) ||
        s(meta.pageId) ||
        s(meta.igUserId) ||
        s(meta.accountId) ||
        explicitChannelType
    );

  const metaRequested =
    explicitProvider === "meta" ||
    ["instagram", "facebook", "messenger"].includes(explicitChannelType) ||
    hasMetaProviderAccess(providerSecrets) ||
    metaHasOperationalIdentity;

  const voiceHasOperationalIdentity =
    voice.available === true ||
    voice.ready === true ||
    Boolean(
      s(voice.provider) ||
        s(voiceTelephony.phoneNumber || voiceTelephony.phone_number) ||
        s(
          voice.twilioPhoneNumber ||
            voice.twilio_phone_number ||
            voice.phoneNumber
        ) ||
        s(voiceOperator.phone) ||
        s(voiceOperator.callerId || voiceOperator.caller_id)
    );

  const voiceProvider = lower(voice.provider);

  if (explicitProvider === "twilio") {
    return "twilio";
  }

  if (voiceHasOperationalIdentity && !metaRequested) {
    return voiceProvider === "twilio" ? "twilio" : "voice";
  }

  if (metaRequested) {
    return "meta";
  }

  if (voiceHasOperationalIdentity) {
    return voiceProvider === "twilio" ? "twilio" : "voice";
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

function shouldAllowGovernanceReviewBlockedHealth({
  authority = {},
  projectionId = "",
  health = {},
  consumerSurface = "",
  operationalChannels = null,
  providerSecrets = null,
} = {}) {
  const status = lower(health.status);
  const reasonCodes = collectReasonCodes(authority, health);

  if (status !== "blocked") return false;
  if (!projectionId) return false;
  if (authority.available !== true) return false;
  if (s(authority.source) !== "approved_runtime_projection") return false;
  if (reasonCodes.length === 0) return false;

  const governanceOnly = reasonCodes.every((code) =>
    NON_FATAL_GOVERNANCE_REVIEW_REASON_CODES.has(code)
  );

  if (!governanceOnly) return false;

  if (consumerSurface === "voice" || consumerSurface === "twilio") {
    const voiceOperational = obj(obj(operationalChannels).voice);
    return voiceOperational.ready === true;
  }

  if (consumerSurface === "meta") {
    const metaOperational = obj(obj(operationalChannels).meta);
    const metaReady =
      metaOperational.ready === true ||
      Boolean(s(metaOperational.pageId) || s(metaOperational.igUserId));

    return metaReady && hasMetaProviderAccess(providerSecrets);
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
    (consumerSurface === "voice" || consumerSurface === "twilio") &&
    authority.available === true &&
    s(authority.source) === "approved_runtime_projection" &&
    voiceOperational.ready === true &&
    ["projection_stale", "truth_version_drift"].includes(
      normalizedReasonCode
    )
  );
}

function shouldAllowConsumerDespiteBlockedHealth({
  authority = {},
  health = {},
  consumerSurface = "",
  operationalChannels = null,
  providerSecrets = null,
} = {}) {
  const reasonCodes = collectReasonCodes(authority, health);
  if (reasonCodes.length === 0) return false;

  if (consumerSurface === "voice" || consumerSurface === "twilio") {
    const voiceOperational = obj(obj(operationalChannels).voice);
    if (voiceOperational.ready !== true) return false;
    return reasonCodes.every((code) => VOICE_OPERATIONAL_REASON_CODES.has(code));
  }

  if (consumerSurface === "meta") {
    const metaOperational = obj(obj(operationalChannels).meta);
    const metaReady =
      metaOperational.ready === true ||
      Boolean(s(metaOperational.pageId) || s(metaOperational.igUserId));

    if (!metaReady) return false;
    if (!hasMetaProviderAccess(providerSecrets)) return false;

    return reasonCodes.every((code) => META_OPERATIONAL_REASON_CODES.has(code));
  }

  return false;
}

function shouldBlockForProjectionHealth({
  authority = {},
  projectionId = "",
  health = {},
  consumerSurface = "",
  operationalChannels = null,
  providerSecrets = null,
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
    if (
      shouldAllowGovernanceReviewBlockedHealth({
        authority,
        projectionId,
        health,
        consumerSurface,
        operationalChannels,
        providerSecrets,
      })
    ) {
      return false;
    }

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

    if (
      shouldAllowConsumerDespiteBlockedHealth({
        authority,
        health,
        consumerSurface,
        operationalChannels,
        providerSecrets,
      })
    ) {
      return false;
    }
  }

  if (
    (consumerSurface === "voice" || consumerSurface === "twilio") &&
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
  const authorityMode = lower(authority.mode || "strict") || "strict";
  const authorityRequired =
    typeof authority.required === "boolean" ? authority.required : true;
  const authorityAvailable = authority.available === true;
  const authoritySource = s(authority.source || "");
  const normalizedAuthority = {
    ...authority,
    mode: authorityMode,
    required: authorityRequired,
    available: authorityAvailable,
    source: authoritySource,
  };

  const projection = obj(
    raw.projection || raw.runtimeProjection || raw.currentProjection
  );
  const projectionId = s(
    projection.id || normalizedAuthority.runtimeProjectionId
  );
  const health = obj(
    normalizedAuthority.health ||
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
      authority: normalizedAuthority,
      health,
      consumerSurface,
      operationalChannels,
    });

  if (authorityMode !== "strict" || authorityRequired !== true) {
    throw createProjectedRuntimeAuthorityError(
      normalizedAuthority,
      "runtime_authority_mode_invalid"
    );
  }

  if (!authorityAvailable) {
    throw createProjectedRuntimeAuthorityError(normalizedAuthority);
  }

  if (authoritySource !== "approved_runtime_projection") {
    throw createProjectedRuntimeAuthorityError(
      normalizedAuthority,
      "runtime_authority_source_invalid"
    );
  }

  if (normalizedAuthority.stale === true && !allowVoiceDespiteAuthorityStale) {
    throw createProjectedRuntimeAuthorityError(
      normalizedAuthority,
      s(
        normalizedAuthority.reasonCode ||
          normalizedAuthority.reason ||
          "runtime_projection_stale"
      )
    );
  }

  if (!projectionId) {
    throw createProjectedRuntimeAuthorityError(
      normalizedAuthority,
      "runtime_projection_missing"
    );
  }

  if (
    shouldBlockForProjectionHealth({
      authority: normalizedAuthority,
      projectionId,
      health,
      consumerSurface,
      operationalChannels,
      providerSecrets,
    })
  ) {
    throw createProjectedRuntimeAuthorityError(
      normalizedAuthority,
      s(
        health.primaryReasonCode ||
          health.reasonCode ||
          normalizedAuthority.reasonCode ||
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
  const behavior = buildProjectedBehavior({
    identity,
    profile,
    voice,
    leadCapture,
    handoff,
    behavior: projection.behavior_json,
  });
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
    behavior,
  });

  const projectedRuntime = {
    authority: {
      ...normalizedAuthority,
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
          normalizedAuthority.tenantId
      ),
      tenantKey: lower(
        identity.tenantKey ||
          identity.tenant_key ||
          tenantRow?.tenant_key ||
          normalizedAuthority.tenantKey
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
    behavior,
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