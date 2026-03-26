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

export function settingsRoutes({ db }) {
  const router = express.Router();

  router.use("/settings", workspaceSettingsRoutes({ db }));
  router.use("/settings", channelsSettingsRoutes({ db }));
  router.use("/settings", agentsSettingsRoutes({ db }));
  router.use("/settings", teamSettingsRoutes({ db }));
  router.use("/settings", secretsSettingsRoutes({ db }));
  router.use("/settings", businessFactsSettingsRoutes({ db }));
  router.use("/settings", channelPoliciesSettingsRoutes({ db }));
  router.use("/settings", locationsSettingsRoutes({ db }));
  router.use("/settings", contactsSettingsRoutes({ db }));
  router.use("/settings", operationalSettingsRoutes({ db }));
  router.use("/settings", settingsSourcesRoutes({ db }));
  router.use("/settings", settingsTrustRoutes({ db }));

  return router;
}
