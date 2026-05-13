/**
 * Platform Usage boundary.
 *
 * Wraps existing tenant usage metering and quota helpers.
 *
 * Current source of truth:
 * - tenant_usage_daily
 * - db/helpers/tenantUsage.js
 */

export {
  normalizeUsageMetric,
  recordTenantUsage,
  reserveTenantUsageQuota,
  commitTenantUsageReservation,
  releaseTenantUsageReservation,
  reconcileStaleTenantUsageReservations,
  getTenantUsageSnapshot,
} from "../../db/helpers/tenantUsage.js";

export async function recordUsage(db, input = {}) {
  return recordTenantUsage(db, input);
}

export async function reserveUsageQuota(db, input = {}) {
  return reserveTenantUsageQuota(db, input);
}

export async function commitUsageReservation(db, reservation = {}) {
  return commitTenantUsageReservation(db, reservation);
}

export async function releaseUsageReservation(db, reservation = {}) {
  return releaseTenantUsageReservation(db, reservation);
}

export async function getUsageSnapshot(db, input = {}) {
  return getTenantUsageSnapshot(db, input);
}
