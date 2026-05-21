import { buildOperationalChannels } from "../../../services/operationalChannels.js";
import { getTenantBrainRuntime, isRuntimeAuthorityError } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { buildVoiceConfigFromProjectedRuntime } from "../config.js";
import { s } from "../shared.js";
import { buildVoiceAuthorityDetails } from "./authority.js";
import {
  buildVoiceInternalOkResult,
} from "./response.js";
import {
  firstNonEmpty,
  obj,
} from "./primitives.js";
import {
  buildStableTenantScope,
  normalizedRuntimeTenantId,
} from "./tenant.js";
import { resolveVoiceTenantContext } from "./tenantContext.js";
import {
  buildVoiceProjectedRuntime,
  normalizeProjectedRuntimeForVoice,
} from "./projectedRuntime.js";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function lower(value = "") {
  return s(value).toLowerCase();
}

function isBrowserAdapterProvider(provider = "") {
  const normalized = lower(provider).replace(/[\s-]+/g, "_");
  return (
    normalized === "browser_lab" ||
    normalized === "browser_adapter" ||
    normalized === "pre_sip_browser" ||
    normalized === "browser" ||
    normalized === "browserlab"
  );
}

function buildBrowserAdapterOperationalChannels(operationalChannels = {}, tenant = {}) {
  const current = obj(operationalChannels);
  const currentVoice = obj(current.voice);
  const tenantDefaultLanguage = lower(
    tenant.default_language || tenant.defaultLanguage || "az"
  );
  const supportedLanguages = arr(
    tenant.enabled_languages || tenant.enabledLanguages
  )
    .map((entry) => lower(entry))
    .filter(Boolean);
  const browserLabChannel = {
    id: "browser_lab",
    provider: "browser_lab",
    label: "Browser voice adapter",
    externalNumber: "browser_lab",
    routeKey: "browser_lab",
    enabled: true,
    ready: true,
    reasonCode: "",
    ownershipStatus: "verified",
    routingStatus: "live",
    activationMode: "browser_lab",
    verificationMethod: "system_import",
    connectionStatus: "live",
    connectionNextAction: "",
    connectionReady: true,
    verification: {
      status: "verified",
      method: "system_import",
      verified: true,
    },
    routing: {
      status: "live",
      activationMode: "browser_lab",
      live: true,
    },
    connection: {
      status: "live",
      nextAction: "",
      verified: true,
      live: true,
      connected: true,
    },
    defaultLanguage: tenantDefaultLanguage,
    supportedLanguages,
    providerConfig: {},
    operatorRouting: obj(currentVoice.operatorRouting),
    voiceProfileOverride: {},
    meta: {
      adapterType: "pre_sip_browser",
      compatibilityProvider: "browser_lab",
    },
    source: "browser_adapter_runtime",
    updatedAt: s(current.generatedAt),
  };
  const otherChannels = arr(currentVoice.channels).filter(
    (channel) => s(obj(channel).id) !== "browser_lab"
  );
  const channels = [browserLabChannel, ...otherChannels];

  return {
    ...current,
    voice: {
      ...currentVoice,
      available: true,
      ready: true,
      reasonCode: "",
      provider: "browser_lab",
      mode: s(currentVoice.mode || "assistant"),
      displayName: s(
        currentVoice.displayName || tenant.company_name || "Browser voice adapter"
      ),
      defaultLanguage: s(currentVoice.defaultLanguage || tenantDefaultLanguage),
      supportedLanguages,
      operator: {
        enabled: true,
        phone: "",
        callerId: "",
        label: "operator",
        mode: "manual",
        ...obj(currentVoice.operator),
      },
      operatorRouting: {
        mode: "handoff",
        defaultDepartment: "",
        departments: {},
        ...obj(currentVoice.operatorRouting),
      },
      realtime: {
        model: "gpt-4o-realtime-preview",
        voice: "alloy",
        instructions: "",
        ...obj(currentVoice.realtime),
      },
      actions: obj(currentVoice.actions || currentVoice.voiceActions),
      telephony: {
        ...obj(currentVoice.telephony),
        phoneNumber: "browser_lab",
        channelId: "browser_lab",
      },
      channels,
      defaultChannelId: "browser_lab",
      activeChannelId: "browser_lab",
      channelCount: channels.length,
      readyChannelCount: channels.filter((channel) => obj(channel).ready === true)
        .length,
      providers: [
        ...new Set(
          channels.map((channel) => s(obj(channel).provider)).filter(Boolean)
        ),
      ],
      callback: {
        enabled: true,
        mode: "lead_only",
        ...obj(currentVoice.callback),
      },
      transfer: {
        strategy: "handoff",
        ...obj(currentVoice.transfer),
      },
      source: "browser_adapter_runtime",
      updatedAt: s(currentVoice.updatedAt || current.generatedAt),
    },
  };
}

export async function processVoiceTenantConfig({
  db,
  tenantKey,
  toNumber,  provider = "twilio",

  getRuntime = getTenantBrainRuntime,
}) {
  const context = await resolveVoiceTenantContext({
    db,
    tenantKey,
    toNumber,
    getRuntime,
  });

  const runtime = context.runtime;
  const runtimeAuthorityError = context.runtimeAuthorityError;

  const tenant = buildStableTenantScope({
    tenant: context.tenant,
    runtime,
    tenantKey,
    toNumber,
  });

  const resolvedTenantKey = s(
    tenant?.tenant_key || tenant?.tenantKey || tenantKey
  );
  const resolvedTenantId = firstNonEmpty(
    tenant?.id,
    tenant?.tenant_id,
    normalizedRuntimeTenantId(runtime)
  );

  if (!resolvedTenantId && !resolvedTenantKey) {
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

  const stableTenant = {
    ...tenant,
    id: resolvedTenantId,
    tenant_id: resolvedTenantId,
    tenant_key: resolvedTenantKey,
    tenantKey: resolvedTenantKey,
  };

  const operationalChannels = await buildOperationalChannels({
    db,
    tenantId: resolvedTenantId,
    tenantRow: stableTenant,
  });
  const effectiveOperationalChannels = isBrowserAdapterProvider(provider)
    ? buildBrowserAdapterOperationalChannels(operationalChannels, stableTenant)
    : operationalChannels;

  let projectedRuntime = null;
  try {
    projectedRuntime = buildVoiceProjectedRuntime({
      runtime,
      tenant: stableTenant,
      operationalChannels: effectiveOperationalChannels,
      tenantKey: resolvedTenantKey,
      toNumber,
    });
  } catch (error) {
    if (isRuntimeAuthorityError(error)) {
      return {
        ok: false,
        statusCode: Number(error?.statusCode || 409),
        error: "runtime_authority_unavailable",
        tenantKey: resolvedTenantKey,
        toNumber,
        details: buildVoiceAuthorityDetails(error, runtime),
      };
    }
    throw error;
  }

  const stableProjectedRuntime = normalizeProjectedRuntimeForVoice(
    projectedRuntime,
    stableTenant
  );

  if (effectiveOperationalChannels?.voice?.ready !== true) {
    return {
      ok: false,
      statusCode: 409,
      error: "voice_operational_unavailable",
      tenantKey: resolvedTenantKey,
      toNumber,
      details: {
        unavailable: true,
        strict: true,
        authority: obj(stableProjectedRuntime?.authority || runtime?.authority),
        tenant: stableTenant,
        operationalChannels: effectiveOperationalChannels,
        reasonCode: s(
          effectiveOperationalChannels?.voice?.reasonCode ||
            "voice_settings_missing"
        ),
        reason_code: s(
          effectiveOperationalChannels?.voice?.reasonCode ||
            "voice_settings_missing"
        ),
      },
    };
  }

  const builtPayload = obj(
    buildVoiceConfigFromProjectedRuntime(stableProjectedRuntime, {
      tenantKey: resolvedTenantKey,
      toNumber,
      provider,
    })
  );

  const payload = {
    ...builtPayload,
    tenantKey: s(builtPayload.tenantKey || resolvedTenantKey),
    tenantId: firstNonEmpty(builtPayload.tenantId, resolvedTenantId),
    toNumber: s(builtPayload.toNumber || toNumber),
    tenant: stableTenant,
    projectedRuntime: obj(builtPayload.projectedRuntime).authority
      ? normalizeProjectedRuntimeForVoice(
          builtPayload.projectedRuntime,
          stableTenant
        )
      : stableProjectedRuntime,
    operationalChannels: effectiveOperationalChannels,
    authority: {
      ...obj(
        builtPayload.authority ||
          stableProjectedRuntime?.authority ||
          runtime?.authority
      ),
      strict: true,
      unavailable: false,
      tenantId: resolvedTenantId,
      tenant_id: resolvedTenantId,
      tenantKey: resolvedTenantKey,
      tenant_key: resolvedTenantKey,
    },
  };

  return buildVoiceInternalOkResult(payload);
}


