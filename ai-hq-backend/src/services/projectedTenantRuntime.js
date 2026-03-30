import {
  createProjectedRuntimeAuthorityError,
  normalizeProjectedRuntimeAuthority,
} from "./projectedRuntime/authority.js";
import { buildProjectedBehavior } from "./projectedRuntime/behavior.js";
import {
  pickPrimaryContact,
  toServiceSummary,
} from "./projectedRuntime/contacts.js";
import { resolveConsumerSurface } from "./projectedRuntime/consumerSurface.js";
import { buildProjectionExecutionPolicy } from "./projectedRuntime/executionPolicy.js";
import {
  shouldAllowVoiceDespiteAuthorityStale,
  shouldBlockForProjectionHealth,
} from "./projectedRuntime/healthPolicy.js";
import { buildMetaChannelRuntime } from "./projectedRuntime/meta.js";
import { arr, obj, lower, s } from "./projectedRuntime/shared.js";
import {
  buildVoiceOperationalConfig,
  buildVoiceProfile,
} from "./projectedRuntime/voice.js";

export function buildProjectedTenantRuntime({
  runtime = {},
  tenantRow = null,
  matchedChannel = null,
  providerSecrets = null,
  operationalChannels = null,
} = {}) {
  const raw = obj(runtime.raw);
  const normalizedAuthority = normalizeProjectedRuntimeAuthority(
    runtime.authority
  );

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

  if (
    normalizedAuthority.mode !== "strict" ||
    normalizedAuthority.required !== true
  ) {
    throw createProjectedRuntimeAuthorityError(
      normalizedAuthority,
      "runtime_authority_mode_invalid"
    );
  }

  if (!normalizedAuthority.available) {
    throw createProjectedRuntimeAuthorityError(normalizedAuthority);
  }

  if (normalizedAuthority.source !== "approved_runtime_projection") {
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
