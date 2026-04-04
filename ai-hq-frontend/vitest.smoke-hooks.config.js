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
        "src/hooks/useAsyncSurfaceState.test.jsx",
        "src/hooks/useActionState.test.jsx",
        "src/components/admin/hooks/useProviderSecretsSurface.test.jsx",
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
