import { obj, s, lower } from "./shared.js";

export function createProjectedRuntimeAuthorityError(
  authority = {},
  reasonCode = ""
) {
  const error = new Error(
    "Approved runtime authority is unavailable for downstream projected runtime consumers."
  );
  error.code = "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE";
  error.statusCode = 409;
  error.reasonCode = s(
    reasonCode ||
      authority.reasonCode ||
      authority.reason ||
      "runtime_authority_unavailable"
  );
  error.runtimeAuthority = {
    ...obj(authority),
    available: false,
    reasonCode: error.reasonCode,
    reason: error.reasonCode,
  };
  return error;
}

export function normalizeProjectedRuntimeAuthority(authority = {}) {
  const value = obj(authority);

  return {
    ...value,
    mode: lower(value.mode || "strict") || "strict",
    required:
      typeof value.required === "boolean" ? value.required : true,
    available: value.available === true,
    source: s(value.source || ""),
  };
}
