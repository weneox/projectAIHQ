// src/services/sourceFusion/index.js
// FINAL v3.0 — root entry with preserved import path
// keeps existing import path stable while splitting internals into modules

export { buildWebsiteObservations } from "./observations.js";
export { buildCandidatesFromSynthesis } from "./candidates.js";

export {
  synthesizeTenantBusinessFromObservations,
} from "./synthesisRoot.js";