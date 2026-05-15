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

  let projectedRuntime = null;
  try {
    projectedRuntime = buildVoiceProjectedRuntime({
      runtime,
      tenant: stableTenant,
      operationalChannels,
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
        authority: obj(stableProjectedRuntime?.authority || runtime?.authority),
        tenant: stableTenant,
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
    operationalChannels,
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


