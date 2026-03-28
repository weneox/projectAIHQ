import {
  getVoiceCallByProviderSid,
  updateVoiceCall,
  getVoiceCallSessionByProviderCallSid,
  updateVoiceCallSession,
} from "../db/helpers/voice.js";
import { buildVoiceConfigFromProjectedRuntime } from "../routes/api/voice/config.js";
import { upsertCallAndSession } from "../routes/api/voice/mutations.js";
import { findTenantByKeyOrPhone } from "../routes/api/voice/repository.js";
import { appendEventSafe } from "../routes/api/voice/utils.js";
import {
  s,
  b,
  isObj,
  normalizePhone,
  normalizeTranscriptItem,
} from "../routes/api/voice/shared.js";
import {
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "./businessBrain/getTenantBrainRuntime.js";
import { buildOperationalChannels } from "./operationalChannels.js";
import { buildProjectedTenantRuntime } from "./projectedTenantRuntime.js";

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function arr(v) {
  return Array.isArray(v) ? v : [];
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

function buildProjectionContact(channel = "", value = "", extra = {}) {
  const normalizedValue = s(value);
  if (!normalizedValue) return null;

  return {
    channel: s(channel),
    value: normalizedValue,
    isPrimary:
      typeof extra.isPrimary === "boolean" ? extra.isPrimary : true,
    ...extra,
  };
}

function buildServiceProjectionEntry(item, index = 0) {
  if (typeof item === "string") {
    const title = s(item);
    if (!title) return null;

    return {
      serviceKey: `service_${index + 1}`,
      title,
      description: "",
      enabled: true,
    };
  }

  const value = obj(item);
  const title = firstNonEmpty(value.title, value.name, value.label);
  const description = firstNonEmpty(value.description, value.summary);
  const serviceKey = firstNonEmpty(
    value.serviceKey,
    value.service_key,
    value.key,
    title ? title.toLowerCase().replace(/[^a-z0-9]+/gi, "_") : "",
    `service_${index + 1}`
  );

  if (!title && !description) return null;

  return {
    serviceKey,
    title,
    description,
    category: firstNonEmpty(value.category, value.type),
    enabled:
      typeof value.enabled === "boolean" ? value.enabled : true,
  };
}

function normalizeRuntimeTenantRow({
  tenant = null,
  runtime = null,
  tenantKey = "",
  toNumber = "",
} = {}) {
  const tenantRow = obj(tenant);
  const runtimeValue = obj(runtime);
  const authority = obj(runtimeValue.authority);
  const runtimeTenant =
    obj(runtimeValue.tenant) ||
    obj(runtimeValue.tenantRow) ||
    obj(runtimeValue.tenantScope);
  const runtimeProfile = obj(runtimeValue.profile);
  const runtimeIdentity = obj(runtimeValue.identity);
  const rawProjection = obj(obj(runtimeValue.raw).projection);
  const identityJson = obj(rawProjection.identity_json);
  const profileJson = obj(rawProjection.profile_json);

  const resolvedTenantId = firstNonEmpty(
    tenantRow.id,
    tenantRow.tenant_id,
    runtimeTenant.id,
    runtimeTenant.tenant_id,
    identityJson.tenantId,
    identityJson.tenant_id,
    authority.tenantId,
    authority.tenant_id,
    runtimeValue.tenantId,
    runtimeValue.tenant_id
  );

  const resolvedTenantKey = firstNonEmpty(
    tenantRow.tenant_key,
    tenantRow.tenantKey,
    runtimeTenant.tenant_key,
    runtimeTenant.tenantKey,
    identityJson.tenantKey,
    identityJson.tenant_key,
    authority.tenantKey,
    authority.tenant_key,
    runtimeValue.tenantKey,
    runtimeValue.tenant_key,
    tenantKey
  );

  return {
    id: resolvedTenantId || null,
    tenant_id: resolvedTenantId || null,
    tenant_key: resolvedTenantKey,
    tenantKey: resolvedTenantKey,
    company_name: firstNonEmpty(
      profileJson.companyName,
      identityJson.companyName,
      runtimeProfile.companyName,
      runtimeIdentity.companyName,
      runtimeTenant.company_name,
      runtimeTenant.companyName,
      tenantRow.company_name
    ),
    legal_name: firstNonEmpty(
      profileJson.legalName,
      identityJson.legalName,
      runtimeProfile.legalName,
      runtimeIdentity.legalName,
      runtimeTenant.legal_name,
      runtimeTenant.legalName,
      tenantRow.legal_name
    ),
    industry_key: firstNonEmpty(
      identityJson.industryKey,
      runtimeProfile.industryKey,
      runtimeTenant.industry_key,
      tenantRow.industry_key
    ),
    country_code: firstNonEmpty(
      identityJson.countryCode,
      runtimeProfile.countryCode,
      runtimeTenant.country_code,
      tenantRow.country_code
    ),
    timezone: firstNonEmpty(
      profileJson.timezone,
      runtimeProfile.timezone,
      runtimeTenant.timezone,
      tenantRow.timezone
    ),
    default_language: firstNonEmpty(
      identityJson.mainLanguage,
      profileJson.mainLanguage,
      runtimeProfile.defaultLanguage,
      runtimeTenant.default_language,
      tenantRow.default_language
    ),
    enabled_languages: pickArray(
      identityJson.supportedLanguages,
      profileJson.supportedLanguages,
      runtimeProfile.supportedLanguages,
      runtimeTenant.enabled_languages,
      tenantRow.enabled_languages
    ),
    market_region: firstNonEmpty(
      runtimeProfile.marketRegion,
      runtimeTenant.market_region,
      tenantRow.market_region
    ),
    plan_key: firstNonEmpty(runtimeTenant.plan_key, tenantRow.plan_key),
    tenant_status: firstNonEmpty(
      runtimeTenant.status,
      runtimeTenant.tenant_status,
      tenantRow.status,
      tenantRow.tenant_status
    ),
    tenant_active: pickBoolean(
      runtimeTenant.active,
      runtimeTenant.tenant_active,
      tenantRow.active,
      tenantRow.tenant_active
    ),
    to_number: firstNonEmpty(toNumber, tenantRow.to_number),
  };
}

function normalizedRuntimeTenantKey(runtime = null) {
  const value = obj(runtime);
  const authority = obj(value.authority);
  const tenant = obj(value.tenant);
  const rawProjection = obj(obj(value.raw).projection);
  const identityJson = obj(rawProjection.identity_json);

  return firstNonEmpty(
    authority.tenantKey,
    authority.tenant_key,
    value.tenantKey,
    value.tenant_key,
    tenant.tenant_key,
    tenant.tenantKey,
    identityJson.tenantKey,
    identityJson.tenant_key
  );
}

function buildVoiceAuthorityDetails(error = null, runtime = null) {
  const runtimeValue = obj(runtime);
  const authority = obj(runtimeValue.authority);
  const runtimeAuthority = obj(error?.runtimeAuthority);

  const reasonCode = firstNonEmpty(
    runtimeAuthority.reasonCode,
    runtimeAuthority.reason_code,
    authority.reasonCode,
    authority.reason_code,
    error?.code,
    "runtime_authority_unavailable"
  );

  return {
    unavailable: true,
    strict: true,
    reasonCode,
    reason_code: reasonCode,
    authority: {
      ...authority,
      strict: true,
      unavailable: true,
      reasonCode,
      reason_code: reasonCode,
    },
  };
}

function buildCompatibleProjectionRuntime({
  runtime = null,
  tenant = null,
  operationalChannels = {},
  tenantKey = "",
  toNumber = "",
} = {}) {
  const runtimeValue = obj(runtime);
  const tenantRow = obj(tenant);
  const authority = obj(runtimeValue.authority);
  const runtimeTenant =
    obj(runtimeValue.tenant) ||
    obj(runtimeValue.tenantRow) ||
    obj(runtimeValue.tenantScope);
  const runtimeProfile = obj(runtimeValue.profile);
  const runtimeIdentity = obj(runtimeValue.identity);
  const raw = obj(runtimeValue.raw);
  const existingProjection = obj(raw.projection);
  const existingIdentity = obj(existingProjection.identity_json);
  const existingProfile = obj(existingProjection.profile_json);
  const existingVoice = obj(existingProjection.voice_json);
  const existingLeadCapture = obj(existingProjection.lead_capture_json);
  const existingHandoff = obj(existingProjection.handoff_json);
  const existingInbox = obj(existingProjection.inbox_json);
  const existingComments = obj(existingProjection.comments_json);
  const voiceOperational = obj(operationalChannels.voice);
  const metaOperational = obj(operationalChannels.meta);
  const aiPolicy = obj(runtimeValue.aiPolicy || runtimeValue.ai_policy);
  const inboxPolicy = obj(runtimeValue.inboxPolicy || runtimeValue.inbox_policy);
  const commentPolicy = obj(
    runtimeValue.commentPolicy || runtimeValue.comment_policy
  );
  const handoff = obj(runtimeValue.handoff || runtimeValue.handoffPolicy);
  const leadCapture = obj(
    runtimeValue.leadCapture || runtimeValue.lead_capture
  );

  const resolvedTenantId = firstNonEmpty(
    existingIdentity.tenantId,
    authority.tenantId,
    runtimeTenant.id,
    runtimeTenant.tenant_id,
    tenantRow.id,
    tenantRow.tenant_id
  );

  const resolvedTenantKey = firstNonEmpty(
    existingIdentity.tenantKey,
    authority.tenantKey,
    runtimeTenant.tenant_key,
    runtimeTenant.tenantKey,
    tenantRow.tenant_key,
    tenantRow.tenantKey,
    tenantKey
  );

  const supportedLanguages = pickArray(
    existingIdentity.supportedLanguages,
    existingProfile.supportedLanguages,
    runtimeProfile.supportedLanguages,
    runtimeProfile.enabledLanguages,
    runtimeTenant.enabled_languages,
    tenantRow.enabled_languages
  );

  const mainLanguage = firstNonEmpty(
    existingIdentity.mainLanguage,
    existingProfile.mainLanguage,
    runtimeProfile.mainLanguage,
    runtimeProfile.defaultLanguage,
    runtimeTenant.default_language,
    tenantRow.default_language,
    runtimeValue.language,
    "en"
  );

  const companyName = firstNonEmpty(
    existingIdentity.companyName,
    existingProfile.companyName,
    runtimeProfile.companyName,
    runtimeIdentity.companyName,
    runtimeTenant.company_name,
    runtimeTenant.companyName,
    tenantRow.company_name
  );

  const displayName = firstNonEmpty(
    existingIdentity.displayName,
    existingProfile.displayName,
    runtimeProfile.displayName,
    runtimeIdentity.displayName,
    companyName
  );

  const websiteUrl = firstNonEmpty(
    existingIdentity.websiteUrl,
    existingProfile.websiteUrl,
    runtimeProfile.websiteUrl,
    runtimeTenant.website_url,
    tenantRow.website_url
  );

  const primaryPhone = firstNonEmpty(
    existingProfile.primaryPhone,
    runtimeProfile.primaryPhone,
    voiceOperational?.telephony?.phoneNumber,
    tenantRow.primary_phone,
    tenantRow.public_phone,
    toNumber
  );

  const primaryEmail = firstNonEmpty(
    existingProfile.primaryEmail,
    runtimeProfile.primaryEmail,
    tenantRow.primary_email,
    tenantRow.public_email
  );

  const contactsJson = arr(existingProjection.contacts_json).length
    ? arr(existingProjection.contacts_json)
    : [
        buildProjectionContact("phone", primaryPhone, {
          label: "Primary phone",
        }),
        buildProjectionContact("email", primaryEmail, {
          label: "Primary email",
        }),
      ].filter(Boolean);

  const servicesSource = arr(
    runtimeValue.serviceCatalog ||
      runtimeValue.services ||
      runtimeValue.services_json
  );

  const servicesJson = arr(existingProjection.services_json).length
    ? arr(existingProjection.services_json)
    : servicesSource
        .map((item, index) => buildServiceProjectionEntry(item, index))
        .filter(Boolean);

  const channelsJson = arr(existingProjection.channels_json).length
    ? arr(existingProjection.channels_json)
    : [
        s(metaOperational.channelType || "instagram") ||
        s(metaOperational.pageId) ||
        s(metaOperational.igUserId)
          ? {
              channelType: firstNonEmpty(
                metaOperational.channelType,
                "instagram"
              ),
              label: firstNonEmpty(
                metaOperational.displayName,
                metaOperational.channelType,
                "Instagram"
              ),
              endpoint: firstNonEmpty(
                metaOperational.channelType,
                "instagram"
              ),
              pageId: s(metaOperational.pageId) || undefined,
              igUserId: s(metaOperational.igUserId) || undefined,
            }
          : null,
        firstNonEmpty(voiceOperational?.telephony?.phoneNumber, primaryPhone)
          ? {
              channelType: "voice",
              label: firstNonEmpty(
                voiceOperational.displayName,
                "Voice"
              ),
              endpoint: "voice",
              phoneNumber: firstNonEmpty(
                voiceOperational?.telephony?.phoneNumber,
                primaryPhone
              ),
            }
          : null,
      ].filter(Boolean);

  const projection = {
    ...existingProjection,
    projection_hash: firstNonEmpty(
      existingProjection.projection_hash,
      authority.projectionHash,
      authority.projection_hash
    ),
    identity_json: {
      ...existingIdentity,
      tenantId: resolvedTenantId,
      tenantKey: resolvedTenantKey,
      companyName,
      displayName,
      industryKey: firstNonEmpty(
        existingIdentity.industryKey,
        runtimeProfile.industryKey,
        runtimeTenant.industry_key,
        tenantRow.industry_key
      ),
      websiteUrl,
      mainLanguage,
      supportedLanguages,
      countryCode: firstNonEmpty(
        existingIdentity.countryCode,
        runtimeProfile.countryCode,
        runtimeTenant.country_code,
        tenantRow.country_code
      ),
    },
    profile_json: {
      ...existingProfile,
      companyName,
      displayName,
      summaryShort: firstNonEmpty(
        existingProfile.summaryShort,
        runtimeProfile.summaryShort,
        runtimeProfile.companySummaryShort,
        runtimeProfile.description
      ),
      summaryLong: firstNonEmpty(
        existingProfile.summaryLong,
        runtimeProfile.summaryLong,
        runtimeProfile.description
      ),
      toneProfile: firstNonEmpty(
        existingProfile.toneProfile,
        runtimeProfile.toneProfile,
        runtimeValue.tone
      ),
      valueProposition: firstNonEmpty(
        existingProfile.valueProposition,
        runtimeProfile.valueProposition
      ),
      websiteUrl,
      primaryEmail,
      primaryPhone,
      mainLanguage,
      supportedLanguages,
      timezone: firstNonEmpty(
        existingProfile.timezone,
        runtimeProfile.timezone,
        runtimeTenant.timezone,
        tenantRow.timezone
      ),
    },
    contacts_json: contactsJson,
    services_json: servicesJson,
    voice_json: {
      ...existingVoice,
      enabled:
        typeof existingVoice.enabled === "boolean"
          ? existingVoice.enabled
          : voiceOperational.ready === true || voiceOperational.available === true,
      supportsCalls:
        typeof existingVoice.supportsCalls === "boolean"
          ? existingVoice.supportsCalls
          : voiceOperational.ready === true || voiceOperational.available === true,
      primaryPhone: firstNonEmpty(
        existingVoice.primaryPhone,
        voiceOperational?.telephony?.phoneNumber,
        primaryPhone
      ),
      canOfferCallback:
        typeof existingVoice.canOfferCallback === "boolean"
          ? existingVoice.canOfferCallback
          : b(voiceOperational?.callback?.enabled, false),
    },
    lead_capture_json: {
      ...existingLeadCapture,
      enabled:
        typeof existingLeadCapture.enabled === "boolean"
          ? existingLeadCapture.enabled
          : b(leadCapture.enabled, b(aiPolicy.createLeadEnabled, false)),
      contactCaptureMode: firstNonEmpty(
        existingLeadCapture.contactCaptureMode,
        leadCapture.contactCaptureMode,
        leadCapture.mode
      ),
    },
    handoff_json: {
      ...existingHandoff,
      enabled:
        typeof existingHandoff.enabled === "boolean"
          ? existingHandoff.enabled
          : b(handoff.enabled, b(aiPolicy.handoffEnabled, false)),
      escalationMode: firstNonEmpty(
        existingHandoff.escalationMode,
        handoff.escalationMode,
        voiceOperational?.operatorRouting?.mode
      ),
    },
    inbox_json: {
      ...existingInbox,
      enabled:
        typeof existingInbox.enabled === "boolean"
          ? existingInbox.enabled
          : b(inboxPolicy.enabled, true),
    },
    comments_json: {
      ...existingComments,
      enabled:
        typeof existingComments.enabled === "boolean"
          ? existingComments.enabled
          : b(commentPolicy.enabled, true),
    },
    channels_json: channelsJson,
  };

  return {
    ...runtimeValue,
    authority: {
      ...authority,
      strict: true,
      unavailable: false,
    },
    raw: {
      ...raw,
      projection,
    },
  };
}

function buildManualProjectedRuntime({
  runtime = null,
  tenant = null,
  operationalChannels = {},
  tenantKey = "",
  toNumber = "",
} = {}) {
  const compatibleRuntime = buildCompatibleProjectionRuntime({
    runtime,
    tenant,
    operationalChannels,
    tenantKey,
    toNumber,
  });

  const authority = obj(compatibleRuntime.authority);
  const rawProjection = obj(obj(compatibleRuntime.raw).projection);
  const identityJson = obj(rawProjection.identity_json);
  const profileJson = obj(rawProjection.profile_json);
  const voiceJson = obj(rawProjection.voice_json);

  return {
    authority: {
      ...authority,
      strict: true,
      unavailable: false,
    },
    tenant: {
      id: firstNonEmpty(identityJson.tenantId, authority.tenantId),
      tenantId: firstNonEmpty(identityJson.tenantId, authority.tenantId),
      tenant_key: firstNonEmpty(identityJson.tenantKey, authority.tenantKey),
      tenantKey: firstNonEmpty(identityJson.tenantKey, authority.tenantKey),
      company_name: firstNonEmpty(identityJson.companyName, profileJson.companyName),
      companyName: firstNonEmpty(identityJson.companyName, profileJson.companyName),
      displayName: firstNonEmpty(
        identityJson.displayName,
        identityJson.companyName,
        profileJson.displayName
      ),
      industryKey: s(identityJson.industryKey),
      websiteUrl: s(identityJson.websiteUrl),
      timezone: s(profileJson.timezone),
      mainLanguage: s(identityJson.mainLanguage),
      supportedLanguages: arr(identityJson.supportedLanguages),
    },
    profile: {
      ...profileJson,
    },
    contacts: arr(rawProjection.contacts_json),
    services: arr(rawProjection.services_json),
    knowledge: arr(rawProjection.knowledge_json),
    leadCapture: obj(rawProjection.lead_capture_json),
    handoff: obj(rawProjection.handoff_json),
    inbox: obj(rawProjection.inbox_json),
    comments: obj(rawProjection.comments_json),
    channels: {
      voice: {
        ...voiceJson,
        ...obj(operationalChannels.voice),
        primaryPhone: firstNonEmpty(
          voiceJson.primaryPhone,
          obj(operationalChannels.voice).telephony?.phoneNumber,
          toNumber
        ),
      },
      meta: obj(operationalChannels.meta),
      items: arr(rawProjection.channels_json),
    },
    raw: {
      projection: rawProjection,
    },
  };
}

function buildVoiceProjectedRuntime({
  runtime = null,
  tenant = null,
  operationalChannels = {},
  tenantKey = "",
  toNumber = "",
} = {}) {
  try {
    return buildProjectedTenantRuntime({
      runtime,
      tenantRow: tenant,
      operationalChannels,
    });
  } catch (error) {
    const authority = obj(runtime?.authority);

    if (
      authority.available !== true ||
      s(authority.source) !== "approved_runtime_projection"
    ) {
      throw error;
    }

    return buildManualProjectedRuntime({
      runtime,
      tenant,
      operationalChannels,
      tenantKey,
      toNumber,
    });
  }
}

async function resolveVoiceTenantContext({
  db,
  tenantKey,
  toNumber,
  getRuntime = getTenantBrainRuntime,
}) {
  const normalizedTenantKey = s(tenantKey);
  const normalizedToNumber = s(toNumber);

  let tenant = null;
  let runtime = null;
  let runtimeAuthorityError = null;

  if (normalizedTenantKey) {
    try {
      runtime = await getRuntime({
        db,
        tenantKey: normalizedTenantKey,
        authorityMode: "strict",
      });
    } catch (error) {
      if (isRuntimeAuthorityError(error)) {
        runtimeAuthorityError = error;
      } else {
        throw error;
      }
    }
  }

  if (!runtime || !s(normalizedRuntimeTenantKey(runtime))) {
    const resolvedTenant = await findTenantByKeyOrPhone(db, {
      tenantKey: normalizedTenantKey,
      toNumber: normalizedToNumber,
      normalizePhone,
    });

    if (resolvedTenant) {
      tenant = resolvedTenant;
    }
  }

  if (!runtime && tenant) {
    try {
      runtime = await getRuntime({
        db,
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
        authorityMode: "strict",
      });
      runtimeAuthorityError = null;
    } catch (error) {
      if (isRuntimeAuthorityError(error)) {
        runtimeAuthorityError = error;
      } else {
        throw error;
      }
    }
  }

  const normalizedTenant = normalizeRuntimeTenantRow({
    tenant,
    runtime,
    tenantKey: normalizedTenantKey,
    toNumber: normalizedToNumber,
  });

  return {
    tenant: normalizedTenant,
    runtime,
    runtimeAuthorityError,
  };
}

export async function processVoiceTenantConfig({
  db,
  tenantKey,
  toNumber,
  getRuntime = getTenantBrainRuntime,
}) {
  const context = await resolveVoiceTenantContext({
    db,
    tenantKey,
    toNumber,
    getRuntime,
  });

  const tenant = obj(context.tenant);
  const runtime = context.runtime;
  const runtimeAuthorityError = context.runtimeAuthorityError;
  const resolvedTenantKey = s(tenant?.tenant_key || tenantKey);

  if (!s(tenant.id) && !s(tenant.tenant_key)) {
    return {
      ok: false,
      statusCode: 404,
      error: "tenant_not_found",
      tenantKey,
      toNumber,
    };
  }

  if (!runtime) {
    if (runtimeAuthorityError && isRuntimeAuthorityError(runtimeAuthorityError)) {
      return {
        ok: false,
        statusCode: Number(runtimeAuthorityError?.statusCode || 409),
        error: "runtime_authority_unavailable",
        tenantKey: resolvedTenantKey,
        toNumber,
        details: buildVoiceAuthorityDetails(runtimeAuthorityError, runtime),
      };
    }

    return {
      ok: false,
      statusCode: 409,
      error: "runtime_authority_unavailable",
      tenantKey: resolvedTenantKey,
      toNumber,
      details: buildVoiceAuthorityDetails(null, runtime),
    };
  }

  const operationalChannels = await buildOperationalChannels({
    db,
    tenantId: tenant.id,
    tenantRow: tenant,
  });

  const projectedRuntime = buildVoiceProjectedRuntime({
    runtime,
    tenant,
    operationalChannels,
    tenantKey: resolvedTenantKey,
    toNumber,
  });

  if (operationalChannels?.voice?.ready !== true) {
    return {
      ok: false,
      statusCode: 409,
      error: "voice_operational_unavailable",
      tenantKey: resolvedTenantKey,
      toNumber,
      details: {
        unavailable: true,
        strict: true,
        authority: obj(projectedRuntime?.authority || runtime?.authority),
        operationalChannels,
        reasonCode: s(
          operationalChannels?.voice?.reasonCode || "voice_settings_missing"
        ),
        reason_code: s(
          operationalChannels?.voice?.reasonCode || "voice_settings_missing"
        ),
      },
    };
  }

  const builtPayload = obj(
    buildVoiceConfigFromProjectedRuntime(projectedRuntime, {
      tenantKey: resolvedTenantKey,
      toNumber,
    })
  );

  const payload = {
    ...builtPayload,
    tenantKey: s(builtPayload.tenantKey || resolvedTenantKey),
    tenantId: firstNonEmpty(builtPayload.tenantId, tenant.id),
    toNumber: s(builtPayload.toNumber || toNumber),
    projectedRuntime:
      obj(builtPayload.projectedRuntime).authority
        ? builtPayload.projectedRuntime
        : projectedRuntime,
    operationalChannels,
    authority: {
      ...obj(
        builtPayload.authority ||
          projectedRuntime?.authority ||
          runtime?.authority
      ),
      strict: true,
      unavailable: false,
    },
  };

  return {
    ok: true,
    statusCode: 200,
    payload,
  };
}

export async function processVoiceSessionUpsert({ db, body }) {
  const { call, session } = await upsertCallAndSession(db, body);

  await appendEventSafe(db, {
    callId: call.id,
    tenantId: call.tenantId,
    tenantKey: call.tenantKey,
    eventType: "session_upserted",
    actor: "voice_backend",
    payload: {
      callStatus: call.status,
      sessionStatus: session.status,
      conferenceName: session.conferenceName,
    },
  });

  return {
    ok: true,
    statusCode: 200,
    payload: {
      ok: true,
      call,
      session,
    },
  };
}

export async function processVoiceTranscript({
  db,
  providerCallSid,
  text,
  role,
  ts,
}) {
  const session = await getVoiceCallSessionByProviderCallSid(db, providerCallSid);
  if (!session) {
    return {
      ok: false,
      statusCode: 404,
      error: "voice_session_not_found",
    };
  }

  const transcriptLive = Array.isArray(session.transcriptLive)
    ? [...session.transcriptLive]
    : [];

  transcriptLive.push(normalizeTranscriptItem({ ts, role, text }));
  while (transcriptLive.length > 100) transcriptLive.shift();

  const updatedSession = await updateVoiceCallSession(db, session.id, {
    transcriptLive,
  });

  const call = await getVoiceCallByProviderSid(db, providerCallSid);
  let updatedCall = call;

  if (call) {
    const prev = s(call.transcript);
    const nextTranscript = prev
      ? `${prev}\n[${role}] ${text}`
      : `[${role}] ${text}`;

    updatedCall = await updateVoiceCall(db, call.id, {
      transcript: nextTranscript.slice(-30000),
    });

    await appendEventSafe(db, {
      callId: call.id,
      tenantId: call.tenantId,
      tenantKey: call.tenantKey,
      eventType: "transcript_appended",
      actor: "voice_backend",
      payload: { role, text, ts },
    });
  }

  return {
    ok: true,
    statusCode: 200,
    payload: {
      ok: true,
      call: updatedCall,
      session: updatedSession,
    },
  };
}

export async function processVoiceSessionState({
  db,
  providerCallSid,
  body = {},
}) {
  const session = await getVoiceCallSessionByProviderCallSid(db, providerCallSid);
  if (!session) {
    return {
      ok: false,
      statusCode: 404,
      error: "voice_session_not_found",
    };
  }

  const patch = {
    status: s(body?.status || session.status),
    requestedDepartment:
      s(body?.requestedDepartment || session.requestedDepartment) || null,
    resolvedDepartment:
      s(body?.resolvedDepartment || session.resolvedDepartment) || null,
    operatorUserId:
      s(body?.operatorUserId || session.operatorUserId) || null,
    operatorName: s(body?.operatorName || session.operatorName) || null,
    operatorJoinMode: s(
      body?.operatorJoinMode || session.operatorJoinMode || "live"
    ),
    botActive: b(body?.botActive, session.botActive),
    operatorJoinRequested: b(
      body?.operatorJoinRequested,
      session.operatorJoinRequested
    ),
    operatorJoined: b(body?.operatorJoined, session.operatorJoined),
    whisperActive: b(body?.whisperActive, session.whisperActive),
    takeoverActive: b(body?.takeoverActive, session.takeoverActive),
    summary: s(body?.summary || session.summary),
    endedAt: body?.endedAt || session.endedAt || null,
  };

  if (body?.operatorRequestedAt) {
    patch.operatorRequestedAt = body.operatorRequestedAt;
  }
  if (body?.operatorJoinedAt) {
    patch.operatorJoinedAt = body.operatorJoinedAt;
  }
  if (isObj(body?.leadPayload)) {
    patch.leadPayload = body.leadPayload;
  }
  if (isObj(body?.meta)) {
    patch.meta = body.meta;
  }

  const updatedSession = await updateVoiceCallSession(db, session.id, patch);

  const call = await getVoiceCallByProviderSid(db, providerCallSid);
  let updatedCall = call;

  if (call) {
    updatedCall = await updateVoiceCall(db, call.id, {
      status:
        patch.status === "completed"
          ? "completed"
          : patch.status === "failed"
            ? "failed"
            : call.status,
      handoffRequested: patch.operatorJoinRequested,
      handoffCompleted: patch.operatorJoined || patch.takeoverActive,
      handoffTarget: patch.resolvedDepartment || call.handoffTarget || null,
      summary: patch.summary || call.summary,
      endedAt: patch.endedAt || call.endedAt || null,
      meta: isObj(body?.callMeta) ? body.callMeta : call.meta,
    });

    await appendEventSafe(db, {
      callId: call.id,
      tenantId: call.tenantId,
      tenantKey: call.tenantKey,
      eventType: s(body?.eventType || "session_state_updated"),
      actor: "voice_backend",
      payload: {
        sessionStatus: updatedSession.status,
        requestedDepartment: updatedSession.requestedDepartment,
        resolvedDepartment: updatedSession.resolvedDepartment,
        operatorJoinRequested: updatedSession.operatorJoinRequested,
        operatorJoined: updatedSession.operatorJoined,
        whisperActive: updatedSession.whisperActive,
        takeoverActive: updatedSession.takeoverActive,
      },
    });
  }

  return {
    ok: true,
    statusCode: 200,
    payload: {
      ok: true,
      call: updatedCall,
      session: updatedSession,
    },
  };
}

export async function processVoiceOperatorJoin({
  db,
  providerCallSid,
  body = {},
}) {
  const session = await getVoiceCallSessionByProviderCallSid(db, providerCallSid);
  if (!session) {
    return {
      ok: false,
      statusCode: 404,
      error: "voice_session_not_found",
    };
  }

  const joinMode = s(
    body?.operatorJoinMode || body?.joinMode || "live"
  ).toLowerCase();

  const updatedSession = await updateVoiceCallSession(db, session.id, {
    status: joinMode === "whisper" ? "agent_whisper" : "agent_live",
    operatorUserId: s(body?.operatorUserId || session.operatorUserId) || null,
    operatorName: s(body?.operatorName || session.operatorName) || null,
    operatorJoinMode: joinMode,
    operatorJoinRequested: true,
    operatorJoined: true,
    whisperActive: joinMode === "whisper",
    takeoverActive: joinMode === "live" ? b(body?.takeoverActive, false) : false,
    botActive: b(body?.botActive, joinMode !== "live" ? true : false),
    operatorJoinedAt: body?.operatorJoinedAt || new Date().toISOString(),
  });

  const call = await getVoiceCallByProviderSid(db, providerCallSid);
  let updatedCall = call;

  if (call) {
    updatedCall = await updateVoiceCall(db, call.id, {
      handoffRequested: true,
      handoffCompleted: true,
      handoffTarget:
        updatedSession.resolvedDepartment ||
        updatedSession.requestedDepartment ||
        call.handoffTarget ||
        null,
      agentMode: joinMode === "live" ? "human" : "hybrid",
    });

    await appendEventSafe(db, {
      callId: call.id,
      tenantId: call.tenantId,
      tenantKey: call.tenantKey,
      eventType: "operator_joined",
      actor: "operator",
      payload: {
        operatorUserId: updatedSession.operatorUserId,
        operatorName: updatedSession.operatorName,
        operatorJoinMode: updatedSession.operatorJoinMode,
        takeoverActive: updatedSession.takeoverActive,
      },
    });
  }

  return {
    ok: true,
    statusCode: 200,
    payload: {
      ok: true,
      call: updatedCall,
      session: updatedSession,
    },
  };
}

export async function processVoiceReportPing() {
  return {
    ok: true,
    statusCode: 200,
    payload: {
      ok: true,
      accepted: true,
    },
  };
}