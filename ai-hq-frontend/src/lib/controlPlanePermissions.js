function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeViewerRole(role = "") {
  const value = s(role).toLowerCase();
  if (["internal", "owner", "admin", "operator", "marketer", "analyst", "member"].includes(value)) {
    return value;
  }
  return "member";
}

export function isOwnerOrAdminRole(role = "") {
  const value = normalizeViewerRole(role);
  return value === "internal" || value === "owner" || value === "admin";
}

export function buildRestrictedAction({
  allowed = false,
  message = "",
  requiredRoles = ["owner", "admin"],
} = {}) {
  return {
    allowed: allowed === true,
    requiredRoles: arr(requiredRoles).filter(Boolean),
    message:
      s(message) ||
      `Only ${arr(requiredRoles).filter(Boolean).join("/")} can perform this action.`,
  };
}

export function getControlPlanePermissions({ viewerRole = "", capabilities = {}, permissions = {} } = {}) {
  const normalizedRole = normalizeViewerRole(viewerRole);
  const merged = {
    ...obj(capabilities),
    ...obj(permissions),
  };

  const ownerAdminAllowed = isOwnerOrAdminRole(normalizedRole);
  const readOnlyMessage = "This control-plane surface is visible here, but only owner/admin can change it.";

  return {
    viewerRole: normalizedRole,
    readOnlyMessage,
    auditHistoryRead: buildRestrictedAction({
      allowed:
        merged.auditHistoryRead?.allowed ??
        merged.canReadAuditHistory ??
        ["internal", "owner", "admin", "analyst"].includes(normalizedRole),
      message:
        merged.auditHistoryRead?.message ||
        "Only owner/admin/analyst can read control-plane audit history.",
      requiredRoles: ["owner", "admin", "analyst"],
    }),
    runtimeProjectionRepair: buildRestrictedAction({
      allowed:
        merged.runtimeProjectionRepair?.allowed ??
        merged.canRepairRuntimeProjection ??
        ownerAdminAllowed,
      message:
        merged.runtimeProjectionRepair?.message ||
        "Runtime projection rebuilds stay behind owner/admin access.",
    }),
    providerSecretsMutation: buildRestrictedAction({
      allowed:
        merged.providerSecretsMutation?.allowed ??
        merged.canManageProviderSecrets ??
        ownerAdminAllowed,
      message:
        merged.providerSecretsMutation?.message ||
        "Provider secret changes stay behind owner/admin access.",
    }),
    operationalSettingsWrite: buildRestrictedAction({
      allowed:
        merged.operationalSettingsWrite?.allowed ??
        merged.canManageOperationalSettings ??
        ownerAdminAllowed,
      message:
        merged.operationalSettingsWrite?.message ||
        "Operational voice and channel changes stay behind owner/admin access.",
    }),
    setupReviewFinalize: buildRestrictedAction({
      allowed:
        merged.setupReviewFinalize?.allowed ??
        merged.canFinalizeSetupReview ??
        ownerAdminAllowed,
      message:
        merged.setupReviewFinalize?.message ||
        "Setup review finalize stays behind owner/admin access.",
    }),
  };
}
