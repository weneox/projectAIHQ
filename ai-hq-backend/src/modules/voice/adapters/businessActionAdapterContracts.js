import {
  VOICE_ACTIONS,
  normalizeVoiceActionRuntime,
} from "../actions/voiceActionContracts.js";
import {
  VOICE_REQUEST_TYPES,
  normalizeVoiceBusinessFamily,
  normalizeVoiceRequestType,
} from "../actions/voiceOperationTaxonomy.js";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export const VOICE_BUSINESS_ACTION_ADAPTER_CONTRACT_VERSION =
  "voice_business_action_adapter_contract.v1";

export const VOICE_BUSINESS_ACTION_PROVIDERS = Object.freeze([
  "internal_request",
  "manual",
  "postgres",
  "calendar",
  "spreadsheet",
  "external_api",
  "crm",
  "demo",
  "unknown",
]);

export function normalizeBusinessActionProvider(value = "", fallback = "unknown") {
  const raw = s(value || fallback)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (["internal", "request", "request_only", "internal_request"].includes(raw)) {
    return "internal_request";
  }

  if (["operator", "human", "manual", "handoff"].includes(raw)) {
    return "manual";
  }

  if (["db", "database", "postgres", "postgresql"].includes(raw)) {
    return "postgres";
  }

  if (["calendar", "google_calendar", "outlook_calendar"].includes(raw)) {
    return "calendar";
  }

  if (["sheet", "sheets", "spreadsheet", "excel", "google_sheets"].includes(raw)) {
    return "spreadsheet";
  }

  if (["api", "http", "webhook", "external", "external_api"].includes(raw)) {
    return "external_api";
  }

  if (["hubspot", "salesforce", "crm"].includes(raw)) {
    return "crm";
  }

  if (["demo", "mock", "internal_demo"].includes(raw)) {
    return "demo";
  }

  return VOICE_BUSINESS_ACTION_PROVIDERS.includes(raw) ? raw : "unknown";
}

export function normalizeBusinessActionName(value = "") {
  const raw = s(value).toLowerCase().replace(/[\s-]+/g, "_");

  if (raw === "availability" || raw === "check") {
    return VOICE_ACTIONS.CHECK_AVAILABILITY;
  }

  if (raw === "business_request" || raw === "create_request") {
    return VOICE_ACTIONS.CREATE_BUSINESS_REQUEST;
  }

  if (raw === "reservation" || raw === "booking") {
    return VOICE_ACTIONS.CREATE_RESERVATION_REQUEST;
  }

  if (raw === "order") {
    return VOICE_ACTIONS.CREATE_ORDER_REQUEST;
  }

  if (raw === "appointment") {
    return VOICE_ACTIONS.CREATE_APPOINTMENT_REQUEST;
  }

  if (raw === "handoff" || raw === "callback") {
    return VOICE_ACTIONS.CREATE_HANDOFF_REQUEST;
  }

  if (raw === "end" || raw === "hangup") {
    return VOICE_ACTIONS.END_CALL;
  }

  return raw;
}

function readNestedProvider(actions = {}, key = "") {
  return s(
    actions[`${key}Provider`] ||
      actions[`${key}_provider`] ||
      obj(actions[key]).provider ||
      actions.provider
  );
}

function actionModeForName(runtime = {}, actionName = "") {
  if (actionName === VOICE_ACTIONS.CHECK_AVAILABILITY) return runtime.availabilityMode;
  if (actionName === VOICE_ACTIONS.CREATE_RESERVATION_REQUEST) return runtime.reservationMode;
  if (actionName === VOICE_ACTIONS.CREATE_ORDER_REQUEST) return runtime.orderingMode;
  if (actionName === VOICE_ACTIONS.CREATE_APPOINTMENT_REQUEST) return runtime.appointmentMode;
  if (actionName === VOICE_ACTIONS.CREATE_HANDOFF_REQUEST) return runtime.handoffMode;
  if (actionName === VOICE_ACTIONS.CREATE_BUSINESS_REQUEST) return runtime.universalRequestMode;
  if (actionName === VOICE_ACTIONS.END_CALL) return "live";
  return "disabled";
}

function defaultProviderForAction({ actionName = "", mode = "" } = {}) {
  if (actionName === VOICE_ACTIONS.END_CALL) return "internal_request";

  if (mode === "request_only") {
    if (
      [
        VOICE_ACTIONS.CREATE_BUSINESS_REQUEST,
        VOICE_ACTIONS.CREATE_RESERVATION_REQUEST,
        VOICE_ACTIONS.CREATE_ORDER_REQUEST,
        VOICE_ACTIONS.CREATE_APPOINTMENT_REQUEST,
      ].includes(actionName)
    ) {
      return "internal_request";
    }

    if (actionName === VOICE_ACTIONS.CREATE_HANDOFF_REQUEST) {
      return "manual";
    }
  }

  return "unknown";
}

function providerForAction({ runtimeConfig = {}, actionName = "", explicitProvider = "", mode = "" } = {}) {
  if (explicitProvider) return normalizeBusinessActionProvider(explicitProvider);

  const actions = obj(runtimeConfig.actions || runtimeConfig.voiceActions);

  if (actionName === VOICE_ACTIONS.CHECK_AVAILABILITY) {
    return normalizeBusinessActionProvider(
      runtimeConfig.availabilityProvider || readNestedProvider(actions, "availability")
    );
  }

  if (actionName === VOICE_ACTIONS.CREATE_RESERVATION_REQUEST) {
    return normalizeBusinessActionProvider(
      runtimeConfig.reservationProvider || readNestedProvider(actions, "reservation"),
      defaultProviderForAction({ actionName, mode })
    );
  }

  if (actionName === VOICE_ACTIONS.CREATE_ORDER_REQUEST) {
    return normalizeBusinessActionProvider(
      runtimeConfig.orderingProvider || readNestedProvider(actions, "ordering"),
      defaultProviderForAction({ actionName, mode })
    );
  }

  if (actionName === VOICE_ACTIONS.CREATE_APPOINTMENT_REQUEST) {
    return normalizeBusinessActionProvider(
      runtimeConfig.appointmentProvider || readNestedProvider(actions, "appointment"),
      defaultProviderForAction({ actionName, mode })
    );
  }

  if (actionName === VOICE_ACTIONS.CREATE_HANDOFF_REQUEST) {
    return normalizeBusinessActionProvider(
      runtimeConfig.handoffProvider || readNestedProvider(actions, "handoff"),
      "manual"
    );
  }

  if (actionName === VOICE_ACTIONS.CREATE_BUSINESS_REQUEST) {
    return normalizeBusinessActionProvider(
      runtimeConfig.universalRequestProvider ||
        actions.universalRequestProvider ||
        obj(actions.universalRequest).provider,
      "internal_request"
    );
  }

  if (actionName === VOICE_ACTIONS.END_CALL) {
    return "internal_request";
  }

  return normalizeBusinessActionProvider(actions.provider || runtimeConfig.actionProvider);
}

function requestTypeForAction(actionName = "") {
  if (actionName === VOICE_ACTIONS.CREATE_RESERVATION_REQUEST) {
    return VOICE_REQUEST_TYPES.RESERVATION_REQUEST;
  }

  if (actionName === VOICE_ACTIONS.CREATE_ORDER_REQUEST) {
    return VOICE_REQUEST_TYPES.ORDER_REQUEST;
  }

  if (actionName === VOICE_ACTIONS.CREATE_APPOINTMENT_REQUEST) {
    return VOICE_REQUEST_TYPES.APPOINTMENT_REQUEST;
  }

  if (actionName === VOICE_ACTIONS.CREATE_HANDOFF_REQUEST) {
    return VOICE_REQUEST_TYPES.CALLBACK_REQUEST;
  }

  if (actionName === VOICE_ACTIONS.CREATE_BUSINESS_REQUEST) {
    return VOICE_REQUEST_TYPES.CUSTOM_REQUEST;
  }

  return "";
}

function isLiveProvider(provider = "") {
  return ["postgres", "calendar", "external_api", "crm"].includes(provider);
}

function isRequestProvider(provider = "") {
  return ["internal_request", "manual", "postgres", "external_api", "crm", "spreadsheet"].includes(provider);
}

function buildReadiness({
  actionName = "",
  mode = "",
  provider = "",
} = {}) {
  if (mode === "disabled") {
    return {
      ready: false,
      productionReady: false,
      confirmsLiveTransaction: false,
      recordsRequest: false,
      reasonCode: "voice_business_action_disabled",
    };
  }

  if (actionName === VOICE_ACTIONS.END_CALL) {
    return {
      ready: true,
      productionReady: true,
      confirmsLiveTransaction: true,
      recordsRequest: false,
      reasonCode: "",
    };
  }

  if (provider === "demo") {
    return {
      ready: true,
      productionReady: false,
      confirmsLiveTransaction: mode === "live",
      recordsRequest: mode !== "live",
      reasonCode: "demo_business_action_provider",
    };
  }

  if (mode === "live") {
    const live = isLiveProvider(provider);
    return {
      ready: live,
      productionReady: live,
      confirmsLiveTransaction: live,
      recordsRequest: false,
      reasonCode: live ? "" : "live_business_action_provider_not_configured",
    };
  }

  if (mode === "request_only") {
    const request = isRequestProvider(provider);
    return {
      ready: request,
      productionReady: request,
      confirmsLiveTransaction: false,
      recordsRequest: request,
      reasonCode: request ? "" : "request_business_action_provider_not_configured",
    };
  }

  return {
    ready: false,
    productionReady: false,
    confirmsLiveTransaction: false,
    recordsRequest: false,
    reasonCode: "voice_business_action_mode_unknown",
  };
}

export function buildBusinessActionAdapterContract({
  actionName = "",
  runtimeConfig = {},
  provider = "",
  mode = "",
  businessFamily = "",
  requestType = "",
} = {}) {
  const normalizedActionName = normalizeBusinessActionName(actionName);
  const runtime = normalizeVoiceActionRuntime(runtimeConfig);
  const normalizedMode = s(mode || actionModeForName(runtime, normalizedActionName) || "disabled");
  const normalizedProvider = providerForAction({
    runtimeConfig,
    actionName: normalizedActionName,
    explicitProvider: provider,
    mode: normalizedMode,
  });
  const normalizedBusinessFamily = normalizeVoiceBusinessFamily(
    businessFamily || runtime.businessFamily
  );
  const normalizedRequestType = normalizeVoiceRequestType(
    requestType || requestTypeForAction(normalizedActionName)
  );

  const readiness = buildReadiness({
    actionName: normalizedActionName,
    mode: normalizedMode,
    provider: normalizedProvider,
  });

  return {
    version: VOICE_BUSINESS_ACTION_ADAPTER_CONTRACT_VERSION,
    actionName: normalizedActionName,
    businessFamily: normalizedBusinessFamily,
    requestType: normalizedRequestType,
    mode: normalizedMode,
    provider: normalizedProvider,
    live: normalizedMode === "live",
    requestOnly: normalizedMode === "request_only",
    disabled: normalizedMode === "disabled",
    adapterRequired: normalizedMode === "live" || normalizedMode === "request_only",
    ...readiness,
  };
}

export function buildBusinessActionAdapterContracts(runtimeConfig = {}) {
  return [
    VOICE_ACTIONS.CHECK_AVAILABILITY,
    VOICE_ACTIONS.CREATE_BUSINESS_REQUEST,
    VOICE_ACTIONS.CREATE_RESERVATION_REQUEST,
    VOICE_ACTIONS.CREATE_ORDER_REQUEST,
    VOICE_ACTIONS.CREATE_APPOINTMENT_REQUEST,
    VOICE_ACTIONS.CREATE_HANDOFF_REQUEST,
    VOICE_ACTIONS.END_CALL,
  ].map((actionName) =>
    buildBusinessActionAdapterContract({
      actionName,
      runtimeConfig,
    })
  );
}
