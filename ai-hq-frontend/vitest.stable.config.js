import { defineConfig, mergeConfig } from "vite";

import baseConfig from "./vite.config.js";

const resolvedBaseConfig =
  typeof baseConfig === "function"
    ? baseConfig({ command: "serve", mode: "test" })
    : baseConfig;

export default mergeConfig(
  resolvedBaseConfig,
  defineConfig({
    test: {
      include: [
        "src/pages/Settings/hooks/useSettingsSurfaceState.test.jsx",
        "src/pages/Settings/hooks/useTrustSurface.test.jsx",
        "src/pages/Settings/hooks/useOperationalSettings.test.jsx",
        "src/pages/Settings/hooks/useSourceIntelligence.contract.test.jsx",
        "src/pages/Settings/hooks/useSettingsWorkspace.test.jsx",
        "src/pages/Settings/hooks/useBusinessBrain.test.jsx",
        "src/components/settings/SettingsSurfaceBanner.test.jsx",
        "src/components/settings/hooks/useSurfaceActionState.test.jsx",
        "src/components/settings/hooks/useChannelsSurface.test.jsx",
        "src/components/settings/hooks/useSecretsSurface.test.jsx",
        "src/components/settings/hooks/useTeamSurface.test.jsx",
        "src/components/settings/ChannelsPanel.test.jsx",
        "src/components/settings/SecretsPanel.test.jsx",
        "src/components/settings/TeamPanel.test.jsx",
        "src/components/admin/AdminPageShell.test.jsx",
        "src/pages/hooks/useAdminTenantsSurface.test.jsx",
        "src/pages/hooks/useAdminTeamSurface.test.jsx",
        "src/pages/hooks/useExecutionsSurface.test.jsx",
        "src/pages/hooks/useVoiceSurface.test.jsx",
        "src/hooks/useCommentsData.test.jsx",
        "src/hooks/useInboxData.test.jsx",
        "src/components/inbox/hooks/useInboxComposerSurface.test.jsx",
        "src/components/inbox/hooks/useInboxThreadListSurface.test.jsx",
        "src/components/inbox/hooks/useRetryQueueSurface.test.jsx",
        "src/components/inbox/hooks/useThreadOutboundAttemptsSurface.test.jsx",
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
