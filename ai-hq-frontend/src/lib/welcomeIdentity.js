function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

const STORAGE_KEY = "aihq.welcome.identity";

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function normalizeStoredIdentity(value = {}) {
  const next = obj(value);
  return {
    firstName: s(next.firstName),
    lastName: s(next.lastName),
    companyName: s(next.companyName),
  };
}

function splitFullName(value = "") {
  const parts = s(value).split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: "", lastName: "" };
  }

  return {
    firstName: s(parts[0]),
    lastName: s(parts.slice(1).join(" ")),
  };
}

export function readWelcomeIdentity() {
  if (!canUseStorage()) {
    return normalizeStoredIdentity();
  }

  try {
    return normalizeStoredIdentity(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}")
    );
  } catch {
    return normalizeStoredIdentity();
  }
}

export function writeWelcomeIdentity(value = {}) {
  const normalized = normalizeStoredIdentity(value);

  if (canUseStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {}
  }

  return normalized;
}

export function resolveWelcomeIdentitySeed({
  auth = {},
  bootstrap = {},
} = {}) {
  const stored = readWelcomeIdentity();
  const authUser = obj(auth?.user);
  const authTenant = obj(auth?.tenant);
  const bootstrapWorkspace = obj(bootstrap?.workspace);
  const bootstrapViewer = obj(bootstrap?.viewer);

  const actorName =
    s(authUser?.full_name) ||
    s(authUser?.display_name) ||
    s(authUser?.name) ||
    s(bootstrapViewer?.full_name) ||
    s(bootstrapViewer?.display_name) ||
    s(bootstrapViewer?.name);

  const parsed = splitFullName(actorName);

  return {
    firstName: stored.firstName || parsed.firstName,
    lastName: stored.lastName || parsed.lastName,
    companyName:
      stored.companyName ||
      s(bootstrapWorkspace?.companyName) ||
      s(bootstrapWorkspace?.company_name) ||
      s(authTenant?.company_name) ||
      s(authTenant?.companyName),
  };
}

export function isWelcomeIdentityComplete(ctx = {}) {
  const seed = resolveWelcomeIdentitySeed(ctx);
  return !!(seed.firstName && seed.lastName && seed.companyName);
}
