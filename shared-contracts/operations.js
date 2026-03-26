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

function bool(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function num(v, fallback = null) {
  const value = Number(v);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeRepairAction(input = {}) {
  const item = obj(input);
  const target = obj(item.target);

  return {
    id: s(item.id || ""),
    kind: lower(item.kind || "focus"),
    label: s(item.label || ""),
    requiredRole: lower(item.requiredRole || item.required_role || "operator"),
    allowed: bool(item.allowed, false),
    target,
  };
}

function normalizeRepairGuidance(input = {}) {
  const item = obj(input);
  const nextAction = normalizeRepairAction(item.nextAction || item.next_action);

  return {
    blocked: bool(item.blocked, false),
    category: lower(item.category || ""),
    dependencyType: lower(item.dependencyType || item.dependency_type || ""),
    reasonCode: s(item.reasonCode || item.reason_code || ""),
    title: s(item.title || ""),
    subtitle: s(item.subtitle || ""),
    missing: arr(item.missing).map((entry) => s(entry)).filter(Boolean),
    suggestedRepairActionId: s(
      item.suggestedRepairActionId || item.suggested_repair_action_id || ""
    ),
    nextAction,
  };
}

function normalizeReadinessBlocker(input = {}) {
  const item = obj(input);
  const nextAction = normalizeRepairAction(
    item.nextAction || item.next_action || item.repairAction || item.repair_action
  );

  return {
    blocked: bool(item.blocked, false),
    category: lower(item.category || ""),
    dependencyType: lower(item.dependencyType || item.dependency_type || ""),
    reasonCode: s(item.reasonCode || item.reason_code || ""),
    title: s(item.title || item.label || ""),
    subtitle: s(item.subtitle || item.message || ""),
    missing: arr(item.missing).map((entry) => s(entry)).filter(Boolean),
    suggestedRepairActionId: s(
      item.suggestedRepairActionId || item.suggested_repair_action_id || nextAction.id
    ),
    nextAction,
  };
}

function ok(value) {
  return { ok: true, value };
}

function fail(error, details = {}) {
  return {
    ok: false,
    error: s(error || "invalid_operational_contract"),
    details: obj(details),
  };
}

function normalizeMetaOperational(input = {}) {
  const item = obj(input);

  return {
    available: bool(item.available, false),
    ready: bool(item.ready, false),
    reasonCode: s(item.reasonCode || item.reason_code || ""),
    provider: lower(item.provider || "meta"),
    channelType: lower(item.channelType || item.channel_type || ""),
    pageId: s(item.pageId || item.page_id || ""),
    igUserId: s(item.igUserId || item.ig_user_id || ""),
    accountId: s(item.accountId || item.account_id || ""),
    username: s(item.username || ""),
    status: s(item.status || ""),
    isPrimary: bool(item.isPrimary ?? item.is_primary, false),
    isConnected: bool(item.isConnected ?? item.is_connected, false),
    source: s(item.source || ""),
    updatedAt: s(item.updatedAt || item.updated_at || ""),
  };
}

function normalizeVoiceOperational(input = {}) {
  const item = obj(input);
  const operator = obj(item.operator);
  const routing = obj(item.operatorRouting || item.operator_routing);
  const realtime = obj(item.realtime);
  const telephony = obj(item.telephony);

  return {
    available: bool(item.available, false),
    ready: bool(item.ready, false),
    reasonCode: s(item.reasonCode || item.reason_code || ""),
    provider: lower(item.provider || "twilio"),
    mode: lower(item.mode || "assistant"),
    displayName: s(item.displayName || item.display_name || ""),
    defaultLanguage: lower(item.defaultLanguage || item.default_language || "en"),
    supportedLanguages: arr(item.supportedLanguages || item.supported_languages)
      .map((entry) => lower(entry))
      .filter(Boolean),
    operator: {
      enabled: bool(operator.enabled, false),
      phone: s(operator.phone || ""),
      callerId: s(operator.callerId || operator.caller_id || ""),
      label: s(operator.label || ""),
      mode: lower(operator.mode || "manual"),
    },
    operatorRouting: {
      mode: lower(routing.mode || "manual"),
      defaultDepartment: lower(
        routing.defaultDepartment || routing.default_department || ""
      ),
      departments: obj(routing.departments),
    },
    realtime: {
      model: s(realtime.model || ""),
      voice: s(realtime.voice || ""),
      instructions: s(realtime.instructions || ""),
    },
    telephony: {
      phoneNumber: s(
        telephony.phoneNumber || telephony.phone_number || telephony.twilioPhoneNumber
      ),
      phoneSid: s(
        telephony.phoneSid || telephony.phone_sid || telephony.twilioPhoneSid
      ),
    },
    callback: obj(item.callback),
    transfer: obj(item.transfer),
    limits: obj(item.limits),
    source: s(item.source || ""),
    updatedAt: s(item.updatedAt || item.updated_at || ""),
    contractHash: s(item.contractHash || item.contract_hash || ""),
  };
}

export function validateOperationalChannels(input = {}) {
  const value = obj(input);
  const voice = normalizeVoiceOperational(value.voice);
  const meta = normalizeMetaOperational(value.meta);

  if (!voice.available && !meta.available) {
    return fail("operational_channels_unavailable");
  }

  return ok({
    version: s(value.version || "operational_channels_v1"),
    generatedAt: s(value.generatedAt || value.generated_at || ""),
    contractHash: s(value.contractHash || value.contract_hash || ""),
    voice,
    meta,
  });
}

export function validateOperationalRepairAction(input = {}) {
  const action = normalizeRepairAction(input);

  if (!action.id || !action.kind || !action.label) {
    return fail("operational_repair_action_invalid");
  }

  return ok(action);
}

export function validateOperationalRepairGuidance(input = {}) {
  const guidance = normalizeRepairGuidance(input);

  if (guidance.blocked && (!guidance.reasonCode || !guidance.suggestedRepairActionId)) {
    return fail("operational_repair_guidance_invalid");
  }

  const actionChecked = validateOperationalRepairAction(guidance.nextAction);
  if (!actionChecked.ok) return actionChecked;

  return ok({
    ...guidance,
    nextAction: actionChecked.value,
  });
}

export function validateReadinessSurface(input = {}) {
  const value = obj(input);
  const blockersSource = Array.isArray(value.blockers)
    ? value.blockers
    : arr(value.blockers?.items);
  const blockers = blockersSource.map((entry) => normalizeReadinessBlocker(entry));
  const status = lower(value.status || (blockers.length ? "blocked" : "ready"));

  if (!status) {
    return fail("readiness_surface_invalid");
  }

  for (const blocker of blockers) {
    if (!blocker.reasonCode || !blocker.nextAction.id) {
      return fail("readiness_surface_blocker_invalid");
    }
  }

  return ok({
    status,
    reasonCode: s(value.reasonCode || value.reason_code || ""),
    intentionallyUnavailable: bool(
      value.intentionallyUnavailable ?? value.intentionally_unavailable,
      false
    ),
    message: s(value.message || ""),
    blockers,
  });
}

export function validateOperationalReadiness(input = {}) {
  const value = obj(input);
  const blockers = obj(value.blockers);
  const items = arr(blockers.items).map((item) => ({
    category: lower(item.category || ""),
    dependencyType: lower(item.dependencyType || item.dependency_type || ""),
    reasonCode: s(item.reasonCode || item.reason_code || ""),
    suggestedRepairActionId: s(
      item.suggestedRepairActionId || item.suggested_repair_action_id || ""
    ),
    repairAction: normalizeRepairAction(item.repairAction || item.repair_action),
  }));

  if (typeof value.enabled !== "boolean") {
    return fail("operational_readiness_invalid");
  }

  for (const item of items) {
    if (!item.reasonCode || !item.suggestedRepairActionId) {
      return fail("operational_readiness_blocker_invalid");
    }
  }

  return ok({
    ok: bool(value.ok, false),
    enabled: bool(value.enabled, false),
    enforced: bool(value.enforced, false),
    status: lower(value.status || ""),
    error: s(value.error || ""),
    blockerReasonCodes: arr(value.blockerReasonCodes || value.blocker_reason_codes)
      .map((entry) => s(entry))
      .filter(Boolean),
    repairActions: arr(value.repairActions || value.repair_actions)
      .map((entry) => normalizeRepairAction(entry)),
    blockers: {
      total: num(blockers.total, 0),
      items,
      voice: obj(blockers.voice),
      meta: obj(blockers.meta),
    },
  });
}

export function validateVoiceOperationalResponse(input = {}) {
  const value = obj(input);
  if (typeof value.ok !== "boolean") {
    return fail("voice_operational_response_invalid");
  }

  if (!value.ok) return ok(value);

  const operationalChecked = validateOperationalChannels(
    value.operationalChannels || value.operational_channels
  );
  if (!operationalChecked.ok) return operationalChecked;

  return ok({
    ...value,
    operationalChannels: operationalChecked.value,
  });
}

export function validateProviderAccessResponse(input = {}) {
  const value = obj(input);
  if (typeof value.ok !== "boolean") {
    return fail("provider_access_response_invalid");
  }

  const readinessChecked = isOptionalObject(value.readiness)
    ? validateReadinessSurface(value.readiness)
    : { ok: true, value: null };
  if (!readinessChecked.ok) return readinessChecked;

  if (!value.ok) return ok({
    ...value,
    readiness: readinessChecked.value,
  });

  const access = obj(value.providerAccess || value.provider_access);
  const operationalChecked = validateOperationalChannels(
    value.operationalChannels || value.operational_channels
  );
  if (!operationalChecked.ok) return operationalChecked;

  const provider = lower(access.provider || "meta");
  const tenantKey = lower(access.tenantKey || access.tenant_key || "");
  const tenantId = s(access.tenantId || access.tenant_id || "");

  if (!provider || !tenantKey || !tenantId) {
    return fail("provider_access_scope_required");
  }

  return ok({
    ...value,
    operationalChannels: operationalChecked.value,
    readiness: readinessChecked.value,
    providerAccess: {
      provider,
      tenantKey,
      tenantId,
      available: bool(access.available, false),
      reasonCode: s(access.reasonCode || access.reason_code || ""),
      pageId: s(access.pageId || access.page_id || ""),
      igUserId: s(access.igUserId || access.ig_user_id || ""),
      pageAccessToken: s(access.pageAccessToken || access.page_access_token || ""),
      appSecret: s(access.appSecret || access.app_secret || ""),
      secretKeys: arr(access.secretKeys || access.secret_keys)
        .map((entry) => lower(entry))
        .filter(Boolean),
      grantedScopes: arr(access.grantedScopes || access.granted_scopes)
        .map((entry) => s(entry))
        .filter(Boolean),
      authority: obj(access.authority),
    },
  });
}

function isOptionalObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
