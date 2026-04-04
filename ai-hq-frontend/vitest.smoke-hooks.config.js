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
        "src/test/hooks/useAsyncSurfaceState.test.jsx",
        "src/test/hooks/useActionState.test.jsx",
        "src/test/components/admin/hooks/useProviderSecretsSurface.test.jsx",
        "src/test/pages/hooks/useAdminTenantsSurface.test.jsx",
        "src/test/pages/hooks/useAdminTeamSurface.test.jsx",
        "src/test/pages/hooks/useExecutionsSurface.test.jsx",
        "src/test/pages/hooks/useVoiceSurface.test.jsx",
        "src/test/hooks/useCommentsData.test.jsx",
        "src/test/hooks/useInboxData.test.jsx",
        "src/test/components/inbox/hooks/useInboxComposerSurface.test.jsx",
        "src/test/components/inbox/hooks/useInboxThreadListSurface.test.jsx",
        "src/test/components/inbox/hooks/useThreadOutboundAttemptsSurface.test.jsx",
      ],
      exclude: ["playwright/**", "dist/**", "node_modules/**"],
      passWithNoTests: false,
    },
  })
);
