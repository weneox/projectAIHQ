import { s } from "../runtimeShared.js";
import { createLogger, emitConsoleSpyEvent } from "../../../utils/logger.js";

const log = createLogger({
  service: "ai-hq-backend",
  component: "runtime-tenant-data",
});

function isMissingRelationError(error) {
  return s(error?.code) === "42P01";
}

function canUseSavepoint(db) {
  return Boolean(
    db && typeof db.query === "function" && typeof db.release === "function"
  );
}

function makeSavepointName(prefix = "runtime_optional") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function runOptionalDbStep(step, tenant, db, fn, fallbackValue = []) {
  const useSavepoint = canUseSavepoint(db);
  const savepoint = useSavepoint ? makeSavepointName("runtime_optional") : "";

  try {
    if (useSavepoint) {
      await db.query(`SAVEPOINT ${savepoint}`);
    }

    const result = await fn();

    if (useSavepoint) {
      await db.query(`RELEASE SAVEPOINT ${savepoint}`);
    }

    return result;
  } catch (error) {
    const optionalPayload = {
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
    };

    if (
      !emitConsoleSpyEvent(
        "warn",
        `[runtimeTenantData] ${step} optional step failed; falling back`,
        optionalPayload
      )
    ) {
      log.warn("runtime_tenant_data.optional_step.failed", optionalPayload);
    }

    if (useSavepoint) {
      try {
        await db.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await db.query(`RELEASE SAVEPOINT ${savepoint}`);
      } catch (rollbackError) {
        const rollbackPayload = {
          step,
          tenantId: s(tenant?.id),
          tenantKey: s(tenant?.tenant_key),
          message: rollbackError?.message || String(rollbackError),
          code: rollbackError?.code || null,
          detail: rollbackError?.detail || null,
          hint: rollbackError?.hint || null,
          where: rollbackError?.where || null,
          constraint: rollbackError?.constraint || null,
          table: rollbackError?.table || null,
          column: rollbackError?.column || null,
          stack: rollbackError?.stack || null,
        };
        if (
          !emitConsoleSpyEvent(
            "error",
            `[runtimeTenantData] ${step} optional rollback failed`,
            rollbackPayload
          )
        ) {
          log.error(
            "runtime_tenant_data.optional_rollback.failed",
            rollbackPayload
          );
        }
        throw rollbackError;
      }
    }

    return fallbackValue;
  }
}

export {
  canUseSavepoint,
  isMissingRelationError,
  makeSavepointName,
  runOptionalDbStep,
};
