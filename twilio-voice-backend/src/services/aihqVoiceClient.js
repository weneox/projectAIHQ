import {
  validateDurableExecutionResponse,
  validateDurableVoiceSyncRequest,
  validateVoiceOperatorJoinRequest,
  validateVoiceSessionStateRequest,
  validateVoiceSessionUpsertRequest,
  validateVoiceTenantConfigRequest,
  validateVoiceTranscriptRequest,
} from "@aihq/shared-contracts/critical";
import { validateVoiceOperationalResponse } from "@aihq/shared-contracts/operations";
import { validateVoiceProjectedRuntimeResponse } from "@aihq/shared-contracts/runtime";
import { createStructuredLogger } from "@aihq/shared-contracts/logger";
import { buildCorrelationHeaders } from "@aihq/shared-contracts/logger";
import { buildVoiceSyncKey } from "./voiceSyncReliability.js";
import {
  incrementRuntimeMetric,
  recordRuntimeSignal,
} from "./runtimeObservability.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

async function postJson(fetchFn, url, token, payload, timeoutMs = 8000, requestContext = {}) {
  if (!url) {
    return { ok: false, status: 0, data: null, text: "missing_url" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetchFn(url, {
      method: "POST",
      headers: buildCorrelationHeaders({
        requestId: s(requestContext?.requestId),
        correlationId: s(requestContext?.correlationId),
        headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-internal-token": s(token),
        },
      }),
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    });

    const text = await resp.text().catch(() => "");
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    return {
      ok: resp.ok,
      status: resp.status,
      data,
      text,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      text: String(err?.message || err || "request_failed"),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function createAihqVoiceClient({
  fetchFn,
  baseUrl,
  internalToken,
  timeoutMs = 8000,
  debug = false,
}) {
  const root = s(baseUrl).replace(/\/+$/, "");
  const token = s(internalToken);
  const logger = createStructuredLogger({
    service: "twilio-voice-backend",
    component: "aihq-voice-client",
  });

  function debugLog(event, data = {}) {
    if (!debug) return;
    logger.info(event, data);
  }

  function canUse() {
    return !!(root && token && fetchFn);
  }

  async function call(
    path,
    payload = {},
    validateResponse = validateDurableExecutionResponse,
    requestContext = {}
  ) {
    if (!canUse()) {
      debugLog("voice.sync.client_skipped", {
        hasBaseUrl: !!root,
        hasToken: !!token,
        hasFetch: !!fetchFn,
        path,
      });

      return {
        ok: false,
        skipped: true,
        status: 0,
        data: null,
        text: "client_not_configured",
      };
    }

    const url = `${root}${path.startsWith("/") ? path : `/${path}`}`;
    const result = await postJson(fetchFn, url, token, payload, timeoutMs, requestContext);
    const checked = result.ok
      ? validateResponse(result.data || { ok: false })
      : { ok: false, error: result.text || "request_failed" };
    const dedupeKey = buildVoiceSyncKey(path, payload?.payload || payload);
    const providerCallSid = s(
      payload?.providerCallSid ||
        payload?.callSid ||
        payload?.payload?.providerCallSid ||
        payload?.payload?.callSid
    );

    if (!result.ok || !checked.ok) {
      incrementRuntimeMetric("voice_sync_failures_total");
      recordRuntimeSignal({
        level: "warn",
        category: "voice_sync",
        code: "voice_sync_request_failed",
        reasonCode: result.ok ? "contract_invalid" : "request_failed",
        status: Number(result.status || 0),
        callSid: providerCallSid,
        error: result.ok ? checked.error : s(result.text).slice(0, 300),
      });
      logger.warn("voice.sync.request_failed", {
        path,
        status: Number(result.status || 0),
        providerCallSid,
        requestId: s(requestContext?.requestId),
        correlationId: s(requestContext?.correlationId),
        error: result.ok ? checked.error : s(result.text).slice(0, 300),
        dedupeKey,
      });
    } else {
      incrementRuntimeMetric("voice_sync_successes_total");
      logger.info("voice.sync.request_succeeded", {
        path,
        status: Number(result.status || 0),
        providerCallSid,
        requestId: s(requestContext?.requestId),
        correlationId: s(requestContext?.correlationId),
        dedupeKey,
        executionId: s(result?.data?.execution?.id),
        executionStatus: s(result?.data?.execution?.status),
      });
    }

    return result.ok && checked.ok
      ? result
      : {
          ...result,
          ok: false,
          text: result.ok ? checked.error : result.text,
        };
  }

  async function upsertSession(payload = {}, requestContext = {}) {
    const checked = validateVoiceSessionUpsertRequest(payload);
    if (!checked.ok) {
      return {
        ok: false,
        skipped: true,
        status: 0,
        data: null,
        text: checked.error,
      };
    }
    return enqueueVoiceSync("voice.sync.session_upsert", payload, requestContext);
  }

  async function appendTranscript(payload = {}, requestContext = {}) {
    const checked = validateVoiceTranscriptRequest(payload);
    if (!checked.ok) {
      return {
        ok: false,
        skipped: true,
        status: 0,
        data: null,
        text: checked.error,
      };
    }
    return enqueueVoiceSync("voice.sync.transcript", payload, requestContext);
  }

  async function updateSessionState(payload = {}, requestContext = {}) {
    const checked = validateVoiceSessionStateRequest(payload);
    if (!checked.ok) {
      return {
        ok: false,
        skipped: true,
        status: 0,
        data: null,
        text: checked.error,
      };
    }
    return enqueueVoiceSync("voice.sync.state", payload, requestContext);
  }

  async function markOperatorJoin(payload = {}, requestContext = {}) {
    const checked = validateVoiceOperatorJoinRequest(payload);
    if (!checked.ok) {
      return {
        ok: false,
        skipped: true,
        status: 0,
        data: null,
        text: checked.error,
      };
    }
    return enqueueVoiceSync("voice.sync.operator_join", payload, requestContext);
  }

  async function fetchTenantConfig(payload = {}, requestContext = {}) {
    const checked = validateVoiceTenantConfigRequest(payload);
    if (!checked.ok) {
      return {
        ok: false,
        skipped: true,
        status: 0,
        data: null,
        text: checked.error,
      };
    }
    return call("/api/internal/voice/tenant-config", payload, (input) => {
      const runtimeChecked = validateVoiceProjectedRuntimeResponse(input);
      if (!runtimeChecked.ok) return runtimeChecked;
      return validateVoiceOperationalResponse(input);
    }, requestContext);
  }

  async function enqueueVoiceSync(actionType, payload = {}, requestContext = {}) {
    // AI HQ's durable ledger is the control-plane source of truth for these
    // voice sync mutations. This client only enqueues idempotent work.
    const request = {
      actionType,
      tenantKey: s(payload?.tenantKey).toLowerCase(),
      tenantId: s(payload?.tenantId),
      idempotencyKey: buildVoiceSyncKey(actionType, payload),
      payload,
    };

    const checked = validateDurableVoiceSyncRequest(request);
    if (!checked.ok) {
      return {
        ok: false,
        skipped: true,
        status: 0,
        data: null,
        text: checked.error,
      };
    }

    return call(
      "/api/internal/executions/voice-sync",
      checked.value,
      validateDurableExecutionResponse,
      requestContext
    );
  }

  return {
    canUse,
    upsertSession,
    appendTranscript,
    updateSessionState,
    markOperatorJoin,
    fetchTenantConfig,
  };
}
