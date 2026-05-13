/**
 * Platform Source Sync boundary.
 *
 * This module wraps the existing workspace source import and source sync
 * orchestration without introducing a second source-sync system.
 *
 * Current source of truth / runtime:
 * - services/workspace/import.js
 * - services/workspace/intakeAnalyze.js
 * - services/sourceSync/index.js
 * - services/workspace/import/*
 * - services/workspace/setup/*
 *
 * Future extraction target:
 * - source-sync-backend
 *
 * For now, keep all routes and DB schema unchanged.
 */

export {
  importWebsiteSource,
  importGoogleMapsSource,
  importSourceBundle,
  importSource,
} from "../../services/workspace/import.js";

export {
  runSetupIntakeAnalyze,
} from "../../services/workspace/intakeAnalyze.js";

export {
  runSourceSync,
} from "../../services/sourceSync/index.js";

export async function importWebsiteBusinessSource(args = {}) {
  return importWebsiteSource(args);
}

export async function importGoogleMapsBusinessSource(args = {}) {
  return importGoogleMapsSource(args);
}

export async function importBusinessSourceBundle(args = {}) {
  return importSourceBundle(args);
}

export async function importBusinessSource(args = {}) {
  return importSource(args);
}

export async function analyzeSetupIntake(args = {}) {
  return runSetupIntakeAnalyze(args);
}

export async function syncSource(args = {}) {
  return runSourceSync(args);
}
