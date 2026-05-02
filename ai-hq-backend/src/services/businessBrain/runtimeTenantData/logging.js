import { s } from "../runtimeShared.js";
import { createLogger, emitConsoleSpyEvent } from "../../../utils/logger.js";

const log = createLogger({
  service: "ai-hq-backend",
  component: "runtime-tenant-data",
});

function logDbStepError(step, tenant, error) {
  const payload = {
    step,
    tenantId: s(tenant?.id),
    tenantKey: s(tenant?.tenant_key),
    message: error?.message || String(error),
    code: error?.code || null,
    detail: error?.detail || null,
    hint: error?.hint || null,
    where: error?.where || null,
    constraint: error?.constraint || null,
    table: error?.table || null,
    column: error?.column || null,
    stack: error?.stack || null,
  };

  if (
    emitConsoleSpyEvent(
      "error",
      `[runtimeTenantData] ${step} failed`,
      payload
    )
  ) {
    return;
  }

  log.error("runtime_tenant_data.step.failed", {
    step,
    ...payload,
  });
}

async function runDbStep(step, tenant, fn) {
  try {
    return await fn();
  } catch (error) {
    logDbStepError(step, tenant, error);
    throw error;
  }
}

export { logDbStepError, runDbStep };
