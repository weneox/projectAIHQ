function s(v, d = "") {
  return String(v ?? d).trim();
}

export const API_STABLE_VERSION = "v1";

export function apiVersionMiddleware(req, res, next) {
  const path = s(req?.originalUrl || req?.url || "");
  const explicitVersion = path.startsWith("/api/v1") ? "v1" : API_STABLE_VERSION;
  req.apiVersion = explicitVersion;
  res.setHeader("X-API-Version", explicitVersion);
  res.setHeader("X-API-Stability", "stable");
  res.setHeader("X-API-Compatibility", "backward-compatible-v1");
  return next();
}
