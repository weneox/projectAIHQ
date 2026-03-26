import { defineConfig, mergeConfig } from "vite";

import baseConfig from "./vite.config.js";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: [
        "src/components/settings/SettingsSurfaceBanner.test.jsx",
        "src/components/settings/ChannelsPanel.test.jsx",
        "src/components/settings/SecretsPanel.test.jsx",
        "src/components/settings/TeamPanel.test.jsx",
        "src/components/admin/AdminPageShell.test.jsx",
        "src/components/inbox/InboxComposer.test.jsx",
        "src/components/inbox/InboxThreadListPanel.test.jsx",
        "src/components/inbox/RetryQueuePanel.test.jsx",
        "src/components/inbox/ThreadOutboundAttemptsPanel.test.jsx",
        "src/components/inbox/InboxDetailPanel.test.jsx",
        "src/components/inbox/InboxLeadPanel.test.jsx",
        "src/pages/AdminTenants.test.jsx",
        "src/pages/AdminTeam.test.jsx",
        "src/pages/Executions.smoke.test.jsx",
        "src/pages/Voice.test.jsx",
        "src/pages/Comments.test.jsx",
        "src/pages/Inbox.test.jsx",
        "src/pages/Truth/TruthViewerPage.smoke.test.jsx",
        "src/pages/Settings/SettingsController.smoke.test.jsx",
        "src/pages/Settings/sections/TrustMaintenanceSection.test.jsx",
      ],
      exclude: ["playwright/**", "dist/**", "node_modules/**"],
      passWithNoTests: false,
    },
  })
);
