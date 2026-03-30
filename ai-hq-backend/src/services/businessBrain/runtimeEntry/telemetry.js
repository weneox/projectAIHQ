import { normalizeAuthorityMode } from "../runtimeAuthority.js";
import { s } from "../runtimeShared.js";

function getTelemetryLogger(input = {}) {
  const logger = input?.logger;
  if (!logger || typeof logger.child !== "function") return null;

  return logger.child({
    flow: "tenant_runtime_authority",
    tenantId: s(input?.tenantId || input?.tenant?.id || input?.tenant?.tenant_id),
    tenantKey: s(input?.tenantKey || input?.tenant?.tenant_key || input?.tenant?.tenantKey),
    authorityMode: normalizeAuthorityMode(input?.authorityMode),
  });
}

export { getTelemetryLogger };
