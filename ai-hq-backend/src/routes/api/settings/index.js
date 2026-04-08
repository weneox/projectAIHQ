import express from "express";
import { workspaceSettingsRoutes } from "./workspace.js";
import { channelsSettingsRoutes } from "./channels.js";
import { agentsSettingsRoutes } from "./agents.js";
import { teamSettingsRoutes } from "./team.js";
import { secretsSettingsRoutes } from "./secrets.js";
import { businessFactsSettingsRoutes } from "./businessFacts.js";
import { channelPoliciesSettingsRoutes } from "./channelPolicies.js";
import { locationsSettingsRoutes } from "./locations.js";
import { contactsSettingsRoutes } from "./contacts.js";
import { operationalSettingsRoutes } from "./operational.js";
import { settingsSourcesRoutes } from "./sources.js";
import { settingsTrustRoutes } from "./trust.js";
import { auditHistorySettingsRoutes } from "./auditHistory.js";

export function settingsRoutes({ db }) {
  const router = express.Router();

  // These child routers already declare absolute /settings/... paths.
  router.use("/", workspaceSettingsRoutes({ db }));
  router.use("/", channelsSettingsRoutes({ db }));
  router.use("/", agentsSettingsRoutes({ db }));
  router.use("/", teamSettingsRoutes({ db }));
  router.use("/", secretsSettingsRoutes({ db }));
  router.use("/", businessFactsSettingsRoutes({ db }));
  router.use("/", channelPoliciesSettingsRoutes({ db }));
  router.use("/", locationsSettingsRoutes({ db }));
  router.use("/", contactsSettingsRoutes({ db }));
  router.use("/", operationalSettingsRoutes({ db }));
  router.use("/", settingsTrustRoutes({ db }));
  router.use("/", auditHistorySettingsRoutes({ db }));

  // Sources/knowledge routes are relative (/sources, /knowledge/...)
  // and must stay mounted under /settings.
  router.use("/settings", settingsSourcesRoutes({ db }));

  return router;
}