import { defineConfig, mergeConfig } from "vite";

import baseConfig from "./vite.config.js";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: [
        "src/pages/Settings/hooks/useSettingsSurfaceState.test.jsx",
        "src/pages/Settings/hooks/useTrustSurface.test.jsx",
        "src/pages/Settings/hooks/useOperationalSettings.test.jsx",
        "src/pages/Settings/hooks/useSourceIntelligence.contract.test.jsx",
        "src/pages/Settings/hooks/useSettingsWorkspace.test.jsx",
        "src/pages/Settings/hooks/useBusinessBrain.test.jsx",
        "src/components/settings/hooks/useSurfaceActionState.test.jsx",
        "src/components/settings/hooks/useChannelsSurface.test.jsx",
        "src/components/settings/hooks/useSecretsSurface.test.jsx",
        "src/components/settings/hooks/useTeamSurface.test.jsx",
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
      ],
      exclude: ["playwright/**", "dist/**", "node_modules/**"],
      passWithNoTests: false,
    },
  })
);
