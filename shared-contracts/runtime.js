import { validateReadinessSurface } from "./operations.js";

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

function ok(value) {
  return { ok: true, value };
}

function fail(error, details = {}) {
  return {
    ok: false,
    error: s(error || "invalid_runtime_contract"),
    details: obj(details),
  };
}

function bool(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function num(v, fallback = null) {
  const value = Number(v);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeRuntimeAuthority(input = {}) {
  if (!obj(input) || !s(input.tenantKey || input.tenant_key)) {
    return fail("projected_runtime_authority_invalid");
  }

  return ok({
    mode: lower(input.mode || "strict") || "strict",
    required: bool(input.required, true),
    available: bool(input.available, false),
    source: s(input.source || ""),
    tenantId: s(input.tenantId || input.tenant_id || ""),
    tenantKey: lower(input.tenantKey || input.tenant_key || ""),
    runtimeProjectionId: s(
      input.runtimeProjectionId || input.runtime_projection_id || ""
    ),
    runtimeProjectionStatus: s(
      input.runtimeProjectionStatus || input.runtime_projection_status || ""
    ),
    projectionHash: s(input.projectionHash || input.projection_hash || ""),
    sourceSnapshotId: s(input.sourceSnapshotId || input.source_snapshot_id || ""),
    sourceProfileId: s(input.sourceProfileId || input.source_profile_id || ""),
    sourceCapabilitiesId: s(
      input.sourceCapabilitiesId || input.source_capabilities_id || ""
    ),
    readinessLabel: s(input.readinessLabel || input.readiness_label || ""),
    readinessScore: num(input.readinessScore || input.readiness_score, null),
    confidenceLabel: s(input.confidenceLabel || input.confidence_label || ""),
    confidence: num(input.confidence, null),
    stale: bool(input.stale, false),
    freshnessReasons: arr(input.freshnessReasons || input.freshness_reasons)
      .map((item) => s(item))
      .filter(Boolean),
    reasonCode: s(input.reasonCode || input.reason_code || ""),
    reason: s(input.reason || ""),
    health: obj(input.health),
  });
}

function getApprovedRuntimeAuthorityFailure(projectedRuntime = {}) {
  const runtime = obj(projectedRuntime);
  const authorityChecked = normalizeRuntimeAuthority(runtime.authority);
  if (!authorityChecked.ok) {
    return {
      error: "runtime_authority_unavailable",
      reasonCode: "projected_runtime_authority_invalid",
      authority: obj(runtime.authority),
    };
  }

  const authority = authorityChecked.value;

  if (authority.mode !== "strict" || authority.required !== true) {
    return {
      error: "runtime_authority_unavailable",
      reasonCode: "runtime_authority_mode_invalid",
      authority,
    };
  }

  if (authority.available !== true) {
    return {
      error: "runtime_authority_unavailable",
      reasonCode: s(authority.reasonCode || authority.reason || "runtime_authority_unavailable"),
      authority,
    };
  }

  if (authority.source !== "approved_runtime_projection") {
    return {
      error: "runtime_authority_unavailable",
      reasonCode: "runtime_authority_source_invalid",
      authority,
    };
  }

  if (!authority.runtimeProjectionId) {
    return {
      error: "runtime_authority_unavailable",
      reasonCode: "runtime_projection_missing",
      authority,
    };
  }

  if (authority.stale) {
    return {
      error: "runtime_authority_unavailable",
      reasonCode: s(authority.reasonCode || authority.reason || "runtime_projection_stale"),
      authority,
    };
  }

  const health = obj(authority.health);
  if (
    ["missing", "stale", "blocked", "invalid"].includes(
      lower(health.status || "")
    )
  ) {
    return {
      error: "runtime_authority_unavailable",
      reasonCode: s(
        health.primaryReasonCode ||
          authority.reasonCode ||
          authority.reason ||
          "runtime_authority_unavailable"
      ),
      authority,
    };
  }

  return null;
}

function normalizeTenantProjection(input = {}, authority = {}) {
  const tenant = obj(input);
  const tenantKey = lower(tenant.tenantKey || tenant.tenant_key || authority.tenantKey);
  const tenantId = s(tenant.tenantId || tenant.tenant_id || authority.tenantId);

  if (!tenantKey || !tenantId) {
    return fail("projected_runtime_tenant_scope_required");
  }

  return ok({
    tenantId,
    tenantKey,
    companyName: s(tenant.companyName || tenant.company_name || ""),
    displayName: s(tenant.displayName || tenant.display_name || ""),
    legalName: s(tenant.legalName || tenant.legal_name || ""),
    industryKey: s(tenant.industryKey || tenant.industry_key || ""),
    websiteUrl: s(tenant.websiteUrl || tenant.website_url || ""),
    mainLanguage: lower(tenant.mainLanguage || tenant.main_language || ""),
    supportedLanguages: arr(
      tenant.supportedLanguages || tenant.supported_languages
    )
      .map((item) => lower(item))
      .filter(Boolean),
    profile: obj(tenant.profile),
    contacts: obj(tenant.contacts),
    services: arr(tenant.services).filter((item) => obj(item)),
  });
}

function normalizeProjectedRuntime(input = {}) {
  if (!obj(input)) return fail("projected_runtime_required");

  const authorityChecked = normalizeRuntimeAuthority(input.authority);
  if (!authorityChecked.ok) return authorityChecked;

  const tenantChecked = normalizeTenantProjection(
    input.tenant,
    authorityChecked.value
  );
  if (!tenantChecked.ok) return tenantChecked;

  return ok({
    authority: authorityChecked.value,
    tenant: tenantChecked.value,
    channels: {
      inbox: obj(obj(input.channels).inbox),
      comments: obj(obj(input.channels).comments),
      voice: obj(obj(input.channels).voice),
      meta: obj(obj(input.channels).meta),
    },
    operational: {
      voice: obj(obj(input.operational).voice),
      matchedChannel: obj(
        obj(input.operational).matchedChannel ||
          obj(input.operational).matched_channel
      ),
      providerSecrets: obj(
        obj(input.operational).providerSecrets ||
          obj(input.operational).provider_secrets
      ),
    },
  });
}

export function validateProjectedRuntime(input = {}) {
  return normalizeProjectedRuntime(input);
}

export { getApprovedRuntimeAuthorityFailure };

export function validateVoiceProjectedRuntimeResponse(input = {}) {
  if (!obj(input) || typeof input.ok !== "boolean") {
    return fail("voice_projected_runtime_response_invalid");
  }

  if (!input.ok) return ok(input);

  const checked = normalizeProjectedRuntime(
    input.projectedRuntime || input.projected_runtime
  );
  if (!checked.ok) return checked;

  return ok({
    ...input,
    projectedRuntime: checked.value,
  });
}

export function validateResolveChannelProjectedResponse(input = {}) {
  if (!obj(input)) return fail("resolve_channel_response_required");

  if (input.ok === false) return ok(input);

  const tenantKey = lower(input.tenantKey || input?.tenant?.tenant_key);
  const tenantId = s(input.tenantId || input?.tenant?.id);
  if (!tenantKey || !tenantId) {
    return fail("resolve_channel_response_invalid");
  }

  const checked = normalizeProjectedRuntime(
    input.projectedRuntime || input.projected_runtime
  );
  if (!checked.ok) return checked;
  const readiness = obj(input.readiness)
    ? validateReadinessSurface(input.readiness)
    : { ok: true, value: null };
  if (!readiness.ok) return readiness;

  return ok({
    ...input,
    tenantKey,
    tenantId,
    resolvedChannel: lower(
      input.resolvedChannel || input?.channelConfig?.channelType || ""
      ),
      projectedRuntime: checked.value,
      readiness: readiness.value,
      tenant: obj(input.tenant),
      channelConfig: obj(input.channelConfig),
      providerSecrets: obj(input.providerSecrets),
    });
  }
