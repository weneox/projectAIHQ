import { validateVoiceOperationalResponse } from "@aihq/shared-contracts/operations";
import { validateVoiceProjectedRuntimeResponse } from "@aihq/shared-contracts/runtime";
import {
  buildCorrelationHeaders,
  createStructuredLogger,
} from "@aihq/shared-contracts/logger";
import { cfg } from "../config.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function getRuntimeAuthorityFailure(projectedRuntime) {
  const authority = obj(obj(projectedRuntime).authority);
  const source = s(authority.source);
  const available = authority.available === true;
  const reasonCode = s(authority.reasonCode || authority.reason || "");

  if (available && source === "approved_runtime_projection") {
    return null;
  }

  return {
    error: "runtime_authority_unavailable",
    reasonCode: reasonCode || (!available ? "runtime_authority_unavailable" : "runtime_authority_source_invalid"),
    authority,
  };
}

function isDevLikeEnv() {
  return ["", "development", "dev", "test"].includes(
    lower(cfg.APP_ENV, "development")
  );
}

const baseLogger = createStructuredLogger({
  service: "twilio-voice-backend",
  component: "tenant-config",
});

function buildVoiceConfigFromContracts(projectedRuntime, operationalChannels) {
  const runtime = obj(projectedRuntime);
  const authority = obj(runtime.authority);
  const tenant = obj(runtime.tenant);
  const voice = obj(obj(runtime.channels).voice);
  const operationalVoice = obj(obj(operationalChannels).voice);
  const voiceProfile = obj(voice.profile);
  const contact = obj(voice.contact);
  const operator = obj(operationalVoice.operator);
  const operatorRouting = obj(operationalVoice.operatorRouting);
  const realtime = obj(operationalVoice.realtime);
  const defaultLanguage = lower(
    voiceProfile.defaultLanguage || tenant.mainLanguage || cfg.DEFAULT_LANGUAGE || "en"
  );

  return {
    ok: true,
    tenantId: s(tenant.tenantId || authority.tenantId),
    tenantKey: lower(tenant.tenantKey || authority.tenantKey),
    companyName: s(tenant.companyName || tenant.displayName || "Company"),
    defaultLanguage,
    authority,
    projectedRuntime: runtime,
    operationalChannels: obj(operationalChannels),
    contact: {
      phoneLocal: "",
      phoneIntl: s(contact.phoneIntl),
      emailLocal: "",
      emailIntl: s(contact.emailIntl),
      website: s(contact.website),
    },
    operator: {
      phone: s(operator.phone || cfg.OPERATOR_PHONE),
      callerId: s(operator.callerId || cfg.TWILIO_CALLER_ID),
      mode: lower(operator.mode || "manual"),
    },
    operatorRouting,
    realtime: {
      model: s(realtime.model || cfg.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview"),
      voice: s(realtime.voice || cfg.OPENAI_REALTIME_VOICE || "alloy"),
      instructions: s(realtime.instructions || cfg.OPENAI_REALTIME_INSTRUCTIONS),
      reconnectMax: Number(cfg.OPENAI_REALTIME_RECONNECT_MAX || 2) || 2,
    },
    voiceProfile: {
      companyName: s(voiceProfile.companyName || tenant.companyName || "Company"),
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
          : {
              greeting: {},
            },
    },
  };
}

async function tryFetchTenantFromAiHq({ tenantKey, toNumber, requestContext = {} }) {
  if (!cfg.AIHQ_BASE_URL || !cfg.AIHQ_INTERNAL_TOKEN) {
    return {
      ok: false,
      error: "aihq_unconfigured",
      status: 0,
      json: null,
    };
  }

  try {
    const url = `${s(cfg.AIHQ_BASE_URL).replace(/\/+$/, "")}/api/internal/voice/tenant-config`;

    const resp = await fetch(url, {
      method: "POST",
      headers: buildCorrelationHeaders({
        requestId: s(requestContext?.requestId),
        correlationId: s(requestContext?.correlationId),
        headers: {
        "x-internal-token": s(cfg.AIHQ_INTERNAL_TOKEN),
        "Content-Type": "application/json; charset=utf-8",
        },
      }),
      body: JSON.stringify({
        tenantKey: s(tenantKey),
        toNumber: s(toNumber),
      }),
    });

    const text = await resp.text().catch(() => "");
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!resp.ok) {
      baseLogger.warn("voice.tenant_config.fetch_failed", {
        status: Number(resp.status || 0),
        tenantKey: s(tenantKey).toLowerCase(),
        toNumber: s(toNumber),
        requestId: s(requestContext?.requestId),
        correlationId: s(requestContext?.correlationId),
        error: s(json?.error || "tenant_config_fetch_failed"),
      });
      return {
        ok: false,
        error: s(json?.error || "tenant_config_fetch_failed"),
        status: resp.status,
        json,
      };
    }

    const checked = validateVoiceProjectedRuntimeResponse(json || {});
    if (!checked.ok) {
      baseLogger.warn("voice.tenant_config.contract_invalid", {
        status: Number(resp.status || 0),
        tenantKey: s(tenantKey).toLowerCase(),
        toNumber: s(toNumber),
        requestId: s(requestContext?.requestId),
        correlationId: s(requestContext?.correlationId),
        error: checked.error,
      });
      return {
        ok: false,
        error: checked.error,
        status: resp.status,
        json,
      };
    }

    const operationalChecked = validateVoiceOperationalResponse(json || {});
    if (!operationalChecked.ok) {
      baseLogger.warn("voice.tenant_config.operational_contract_invalid", {
        status: Number(resp.status || 0),
        tenantKey: s(tenantKey).toLowerCase(),
        toNumber: s(toNumber),
        requestId: s(requestContext?.requestId),
        correlationId: s(requestContext?.correlationId),
        error: operationalChecked.error,
      });
      return {
        ok: false,
        error: operationalChecked.error,
        status: resp.status,
        json,
      };
    }

    baseLogger.info("voice.tenant_config.fetch_succeeded", {
      status: Number(resp.status || 0),
      tenantKey: s(tenantKey).toLowerCase(),
      toNumber: s(toNumber),
      requestId: s(requestContext?.requestId),
      correlationId: s(requestContext?.correlationId),
      authoritySource: s(checked.value?.projectedRuntime?.authority?.source),
      operationalReasonCode: s(operationalChecked.value?.operationalChannels?.voice?.reasonCode),
    });

    return {
      ok: true,
      status: resp.status,
      json: {
        ...checked.value,
        operationalChannels: operationalChecked.value.operationalChannels,
      },
    };
  } catch (err) {
    baseLogger.warn("voice.tenant_config.fetch_exception", {
      tenantKey: s(tenantKey).toLowerCase(),
      toNumber: s(toNumber),
      requestId: s(requestContext?.requestId),
      correlationId: s(requestContext?.correlationId),
      error: s(err?.message || err),
    });
    return {
      ok: false,
      error: "tenant_config_fetch_exception",
      status: 0,
      json: null,
      details: s(err?.message || err),
    };
  }
}

export async function getTenantVoiceConfig({
  tenant,
  requestContext = {},
  logger: providedLogger = null,
}) {
  const tenantKey = s(tenant?.tenantKey || tenant?.tenant_key).toLowerCase();
  const toNumber = s(tenant?.toNumber || tenant?.to_number);
  const logger = (providedLogger || baseLogger).child?.({
    flow: "voice_tenant_config",
    tenantKey,
    toNumber,
    requestId: s(requestContext?.requestId),
    correlationId: s(requestContext?.correlationId),
  }) || (providedLogger || baseLogger);

  const remote = await tryFetchTenantFromAiHq({
    tenantKey: tenantKey || null,
    toNumber: toNumber || null,
    requestContext,
  });

  if (!remote?.ok) {
    if (cfg.ALLOW_LOCAL_TENANT_CONFIG_FALLBACK && isDevLikeEnv()) {
      return {
        ok: false,
        error: "unsafe_local_voice_config_fallback_blocked",
        status: 503,
        authority: {
          source: "local_dev_fallback_disabled",
          error: s(remote?.error || "tenant_config_fetch_failed"),
        },
      };
    }

    return {
      ok: false,
      error: s(remote?.error || "tenant_config_fetch_failed"),
      status: Number(remote?.status || 503),
      authority: {
        source: "aihq",
        error: s(remote?.error || "tenant_config_fetch_failed"),
      },
    };
  }

  const projectedRuntime = obj(remote.json?.projectedRuntime);
  const operationalChannels = obj(remote.json?.operationalChannels);
  const operationalVoice = obj(operationalChannels.voice);
  const authorityFailure = getRuntimeAuthorityFailure(projectedRuntime);

  if (authorityFailure) {
    logger.warn("voice.tenant_config.authority_blocked", {
      reasonCode: authorityFailure.reasonCode,
      authoritySource: s(authorityFailure?.authority?.source),
      runtimeProjectionId: s(authorityFailure?.authority?.runtimeProjectionId),
    });
    return {
      ok: false,
      error: authorityFailure.error,
      status: 503,
      authority: {
        ...(obj(authorityFailure.authority)),
        reasonCode: authorityFailure.reasonCode,
        source: "aihq_runtime_contract",
      },
    };
  }

  if (operationalVoice.available !== true || operationalVoice.ready !== true) {
    return {
      ok: false,
      error: s(operationalVoice.reasonCode || "voice_operational_unavailable"),
      status: 409,
      authority: {
        ...(obj(projectedRuntime.authority)),
        source: "aihq_operational_contract",
      },
    };
  }

  const config = buildVoiceConfigFromContracts(
    projectedRuntime,
    operationalChannels
  );

  logger.info("voice.tenant_config.resolved", {
    runtimeProjectionId: s(config?.authority?.runtimeProjectionId),
    authoritySource: s(config?.authority?.source),
    operationalReasonCode: s(operationalVoice.reasonCode),
  });

  return {
    ok: true,
    config,
    authority: config.authority,
  };
}

export const __test__ = {
  buildVoiceConfigFromContracts,
};
