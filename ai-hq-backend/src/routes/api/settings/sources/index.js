import express from "express";

import { createSettingsSourcesRouteContext } from "./context.js";
import { registerSettingsSourceGovernanceRoutes } from "./sourceGovernance.js";
import { registerSettingsSourceKnowledgeRoutes } from "./knowledgeGovernance.js";
import { buildSourceSyncReviewState } from "./shared.js";

export function settingsSourcesRoutes(options = {}) {
  const router = express.Router();
  const context = createSettingsSourcesRouteContext(options);

  registerSettingsSourceGovernanceRoutes(router, context);
  registerSettingsSourceKnowledgeRoutes(router, context);

  return router;
}

export const __test__ = {
  buildSourceSyncReviewState,
};
