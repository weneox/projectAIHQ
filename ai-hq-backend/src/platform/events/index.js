/**
 * Platform Events boundary.
 *
 * Wraps governed decision events without introducing a second event system.
 *
 * Current source of truth:
 * - tenant_decision_events
 * - db/helpers/decisionEvents.js
 */

export {
  DECISION_EVENT_TYPES,
  mapDecisionEvent,
  normalizeDecisionEvent,
  appendDecisionEvent,
  safeAppendDecisionEvent,
  listDecisionEvents,
} from "../../db/helpers/decisionEvents.js";

export async function recordDecisionEvent(db, input = {}) {
  return appendDecisionEvent(db, input);
}

export async function safelyRecordDecisionEvent(db, input = {}) {
  return safeAppendDecisionEvent(db, input);
}

export async function listPlatformDecisionEvents(db, input = {}) {
  return listDecisionEvents(db, input);
}
