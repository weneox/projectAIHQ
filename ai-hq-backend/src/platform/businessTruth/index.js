/**
 * Platform Business Truth boundary.
 *
 * This module intentionally wraps the existing workspace/setup truth system
 * instead of creating a second canonical truth implementation.
 *
 * Current source of truth:
 * - db/helpers/tenantTruthVersions.js
 * - db/helpers/tenantKnowledge.js
 * - db/helpers/tenantSetupReview.js
 *
 * Future modules such as voice, inbox, content, image, booking and orders
 * should import canonical truth helpers from this platform boundary.
 */

export * from "../../db/helpers/tenantTruthVersions.js";
