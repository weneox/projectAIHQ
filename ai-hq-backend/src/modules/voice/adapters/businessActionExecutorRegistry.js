import {
  buildBusinessActionAdapterContract,
  normalizeBusinessActionName,
  normalizeBusinessActionProvider,
} from "./businessActionAdapterContracts.js";
import {
  VOICE_ACTIONS,
} from "../actions/voiceActionContracts.js";
import {
  buildBusinessActionRequestRecord,
} from "./businessActionRequestRecord.js";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanPayload(value = {}) {
  const input = obj(value);

  return Object.fromEntries(
    Object.entries(input).filter(([, item]) => {
      if (item === undefined || item === null || item === "") return false;
      if (Array.isArray(item)) return item.length > 0;
      if (typeof item === "object") return Object.keys(item).length > 0;
      return true;
    })
  );
}


export const VOICE_BUSINESS_ACTION_EXECUTOR_REGISTRY_VERSION =
  "voice_business_action_executor_registry.v1";

export const VOICE_BUSINESS_ACTION_EXECUTOR_STATUS = Object.freeze({
  PROVIDER_NOT_CONFIGURED: "provider_not_configured",
  EXECUTOR_NOT_IMPLEMENTED: "executor_not_implemented",
  LIVE_AVAILABLE: "live_available",
  REQUEST_RECORDED: "request_recorded",
  CALL_ENDED: "call_ended",
});

export function buildBusinessActionExecutorKey({
  provider = "",
  actionName = "",
} = {}) {
  return [
    normalizeBusinessActionProvider(provider),
    normalizeBusinessActionName(actionName),
  ].join(":");
}

function buildDemoAvailabilityResult({
  actionName = VOICE_ACTIONS.CHECK_AVAILABILITY,
  args = {},
  runtimeConfig = {},
  businessActionAdapter = {},
} = {}) {
  return {
    ok: true,
    action: normalizeBusinessActionName(actionName),
    status: VOICE_BUSINESS_ACTION_EXECUTOR_STATUS.LIVE_AVAILABLE,
    confirmed: true,
    live: true,
    requestOnly: false,
    provider: "demo",
    available: true,
    criteria: cleanPayload(args),
    businessFamily: s(
      businessActionAdapter.businessFamily ||
        runtimeConfig.businessFamily ||
        runtimeConfig.businessType ||
        "generic_business"
    ),
    businessActionAdapter,
    message: "Demo provider shows availability for the requested criteria.",
  };
}

function buildInternalRequestResult({
  actionName = "",
  args = {},
  call = {},
  scope = {},
  runtimeConfig = {},
  businessActionAdapter = {},
} = {}) {
  const normalizedAction = normalizeBusinessActionName(actionName);
  const requestRecord = buildBusinessActionRequestRecord({
    actionName: normalizedAction,
    args,
    call,
    scope,
    runtimeConfig,
    businessActionAdapter,
  });

  return {
    ok: true,
    action: normalizedAction,
    status: VOICE_BUSINESS_ACTION_EXECUTOR_STATUS.REQUEST_RECORDED,
    confirmed: false,
    live: false,
    requestOnly: true,
    requestId: requestRecord.id,
    idempotencyKey: requestRecord.idempotencyKey,
    provider: s(businessActionAdapter.provider || "internal_request"),
    payload: requestRecord.payload,
    requestRecord,
    callId: requestRecord.callId,
    tenantId: requestRecord.tenantId,
    tenantKey: requestRecord.tenantKey,
    businessActionAdapter,
    message: "Request was recorded for human or operator follow-up.",
  };
}

function buildEndCallResult({
  actionName = VOICE_ACTIONS.END_CALL,
  args = {},
  businessActionAdapter = {},
} = {}) {
  const payload = cleanPayload(args);

  return {
    ok: true,
    action: normalizeBusinessActionName(actionName),
    status: VOICE_BUSINESS_ACTION_EXECUTOR_STATUS.CALL_ENDED,
    confirmed: true,
    live: true,
    requestOnly: false,
    shouldEndCall: true,
    provider: "internal_request",
    payload,
    summary: s(payload.summary || "Caller ended the conversation."),
    businessActionAdapter,
    message: "Call ended.",
  };
}

function defaultExecutors() {
  return {
    [buildBusinessActionExecutorKey({
      provider: "demo",
      actionName: VOICE_ACTIONS.CHECK_AVAILABILITY,
    })]: buildDemoAvailabilityResult,

    [buildBusinessActionExecutorKey({
      provider: "internal_request",
      actionName: VOICE_ACTIONS.CREATE_BUSINESS_REQUEST,
    })]: buildInternalRequestResult,

    [buildBusinessActionExecutorKey({
      provider: "internal_request",
      actionName: VOICE_ACTIONS.CREATE_RESERVATION_REQUEST,
    })]: buildInternalRequestResult,

    [buildBusinessActionExecutorKey({
      provider: "internal_request",
      actionName: VOICE_ACTIONS.CREATE_ORDER_REQUEST,
    })]: buildInternalRequestResult,

    [buildBusinessActionExecutorKey({
      provider: "internal_request",
      actionName: VOICE_ACTIONS.CREATE_APPOINTMENT_REQUEST,
    })]: buildInternalRequestResult,

    [buildBusinessActionExecutorKey({
      provider: "manual",
      actionName: VOICE_ACTIONS.CREATE_HANDOFF_REQUEST,
    })]: buildInternalRequestResult,

    [buildBusinessActionExecutorKey({
      provider: "internal_request",
      actionName: VOICE_ACTIONS.END_CALL,
    })]: buildEndCallResult,
  };
}

export function createBusinessActionExecutorRegistry(customExecutors = {}) {
  return {
    version: VOICE_BUSINESS_ACTION_EXECUTOR_REGISTRY_VERSION,
    executors: {
      ...defaultExecutors(),
      ...obj(customExecutors),
    },
  };
}

export function resolveBusinessActionExecutor({
  registry = createBusinessActionExecutorRegistry(),
  provider = "",
  actionName = "",
} = {}) {
  const executors = obj(registry.executors || registry);
  const normalizedProvider = normalizeBusinessActionProvider(provider);
  const normalizedAction = normalizeBusinessActionName(actionName);

  return (
    executors[buildBusinessActionExecutorKey({
      provider: normalizedProvider,
      actionName: normalizedAction,
    })] ||
    executors[`${normalizedProvider}:*`] ||
    executors[`*:${normalizedAction}`] ||
    null
  );
}

export async function executeBusinessActionWithAdapter({
  actionName = "",
  args = {},
  call = {},
  scope = {},
  runtimeConfig = {},
  businessActionAdapter = null,
  registry = createBusinessActionExecutorRegistry(),
} = {}) {
  const normalizedAction = normalizeBusinessActionName(actionName);
  const adapter =
    businessActionAdapter ||
    buildBusinessActionAdapterContract({
      actionName: normalizedAction,
      runtimeConfig,
    });

  if (adapter.ready !== true) {
    return {
      ok: false,
      action: normalizedAction,
      status: VOICE_BUSINESS_ACTION_EXECUTOR_STATUS.PROVIDER_NOT_CONFIGURED,
      confirmed: false,
      live: adapter.live === true,
      requestOnly: adapter.requestOnly === true,
      reasonCode: s(
        adapter.reasonCode || "voice_business_action_provider_not_configured"
      ),
      businessActionAdapter: adapter,
      message: "Business action provider is not configured for this action.",
    };
  }

  const executor = resolveBusinessActionExecutor({
    registry,
    provider: adapter.provider,
    actionName: normalizedAction,
  });

  if (typeof executor !== "function") {
    return {
      ok: false,
      action: normalizedAction,
      status: VOICE_BUSINESS_ACTION_EXECUTOR_STATUS.EXECUTOR_NOT_IMPLEMENTED,
      confirmed: false,
      live: adapter.live === true,
      requestOnly: adapter.requestOnly === true,
      reasonCode: "business_action_executor_not_implemented",
      businessActionAdapter: adapter,
      message: "Business action adapter is configured, but no executor is implemented yet.",
    };
  }

  return executor({
    actionName: normalizedAction,
    args: cleanPayload(args),
    call,
    scope,
    runtimeConfig,
    businessActionAdapter: adapter,
  });
}
