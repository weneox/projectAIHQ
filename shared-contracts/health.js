import { validateOperationalReadiness } from "./operations.js";

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

function num(v, fallback = 0) {
  const value = Number(v);
  return Number.isFinite(value) ? value : fallback;
}

function ok(value) {
  return { ok: true, value };
}

function fail(error, details = {}) {
  return {
    ok: false,
    error: s(error || "invalid_health_contract"),
    details: obj(details),
  };
}

export function validateDependencyReadinessEnvelope(input = {}) {
  const value = obj(input);
  const status = lower(value.status || "");

  if (!status) {
    return fail("dependency_readiness_status_required");
  }

  return ok({
    status,
    checkedAt: s(value.checkedAt || value.checked_at || ""),
    enforced: bool(value.enforced, false),
    reasonCode: s(value.reasonCode || value.reason_code || ""),
    blockerReasonCodes: arr(value.blockerReasonCodes || value.blocker_reason_codes)
      .map((entry) => s(entry))
      .filter(Boolean),
    blockersTotal: num(value.blockersTotal || value.blockers_total, 0),
    intentionallyUnavailable: bool(
      value.intentionallyUnavailable ?? value.intentionally_unavailable,
      false
    ),
    error: s(value.error || ""),
    dependency: obj(value.dependency),
    aihq: obj(value.aihq),
    localDecision: obj(value.localDecision || value.local_decision),
  });
}

export function validateServiceHealthEnvelope(input = {}) {
  const value = obj(input);
  if (typeof value.ok !== "boolean") {
    return fail("service_health_ok_required");
  }
  if (!s(value.service)) {
    return fail("service_health_service_required");
  }

  const readiness = validateDependencyReadinessEnvelope(value.readiness);
  if (!readiness.ok) return readiness;

  const bootReadiness = Object.keys(obj(value.bootReadiness || value.boot_readiness)).length
    ? validateDependencyReadinessEnvelope(value.bootReadiness || value.boot_readiness)
    : { ok: true, value: null };
  if (!bootReadiness.ok) return bootReadiness;

  return ok({
    ok: value.ok,
    service: s(value.service),
    readiness: readiness.value,
    bootReadiness: bootReadiness.value,
  });
}

export function validateAihqHealthEnvelope(input = {}) {
  const value = obj(input);
  if (typeof value.ok !== "boolean") {
    return fail("aihq_health_ok_required");
  }
  if (!s(value.service)) {
    return fail("aihq_health_service_required");
  }

  const operationalReadiness = validateOperationalReadiness(value.operationalReadiness);
  if (!operationalReadiness.ok) return operationalReadiness;

  const startup = obj(value.startupOperationalReadiness || value.startup_operational_readiness);

  return ok({
    ok: value.ok,
    service: s(value.service),
    env: s(value.env || ""),
    db: obj(value.db),
    operationalReadiness: operationalReadiness.value,
    providers: obj(value.providers),
    workers: obj(value.workers),
    operational: obj(value.operational),
    startupOperationalReadiness: Object.keys(startup).length
      ? {
          status: s(startup.status || ""),
          enforced: bool(startup.enforced, false),
          error: s(startup.error || ""),
          blockersTotal: num(startup.blockersTotal || startup.blockers_total, 0),
          blockerReasonCodes: arr(
            startup.blockerReasonCodes || startup.blocker_reason_codes
          )
            .map((entry) => s(entry))
            .filter(Boolean),
        }
      : null,
  });
}
