import { buildInspectionFallbackRuntime } from "./runtimeAssembler/inspectionFallbackRuntime.js";
import { buildProjectionFirstRuntime } from "./runtimeAssembler/projectionRuntime.js";
import { buildUnresolvedTenantFallback } from "./runtimeAssembler/unresolvedTenantRuntime.js";

export {
  buildInspectionFallbackRuntime,
  buildProjectionFirstRuntime,
  buildUnresolvedTenantFallback,
};

export const buildLegacyFallbackRuntime = buildInspectionFallbackRuntime;
