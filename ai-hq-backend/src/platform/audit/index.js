/**
 * Platform Audit boundary.
 *
 * Wraps the existing audit log helper without introducing a second audit system.
 *
 * Current source of truth:
 * - audit_log
 * - db/helpers/audit.js
 */

export {
  dbAudit,
  dbListAuditEntries,
  normalizeAuditRow,
} from "../../db/helpers/audit.js";

export async function writeAuditEvent(db, actor, action, objectType, objectId, meta = {}) {
  return dbAudit(db, actor, action, objectType, objectId, meta);
}

export async function listAuditEvents(db, input = {}) {
  return dbListAuditEntries(db, input);
}
