function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export function getFeatureFlag(features = {}, path = "", fallback = false) {
  const parts = s(path).split(".").filter(Boolean);
  if (!parts.length) return Boolean(fallback);

  let current = obj(features);

  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return Boolean(fallback);
    }

    current = current[part];
  }

  return Boolean(current);
}

export function isFeatureEnabled(features = {}, path = "", options = {}) {
  return getFeatureFlag(features, path, options.fallback === true);
}

export function isBootstrapFeatureEnabled(bootstrap = {}, path = "", options = {}) {
  if (bootstrap?.ok === false) return false;
  return isFeatureEnabled(obj(bootstrap?.features), path, options);
}
