import { s } from "../runtimeShared.js";

function logDbStepError(step, tenant, error) {
  console.error(`[runtimeTenantData] ${step} failed`, {
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
