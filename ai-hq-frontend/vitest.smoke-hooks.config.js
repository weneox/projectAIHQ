import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "./vite.config.js";

const resolvedBaseConfig =
  typeof baseConfig === "function"
    ? baseConfig({ command: "serve", mode: "test" })
    : baseConfig;

export default mergeConfig(
  resolvedBaseConfig,
  defineConfig({
    test: {
      name: "frontend-smoke-hooks",
      environment: "jsdom",
      globals: true,
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
        "src/test/components/inbox/hooks/useThreadOutboundAttemptsSurface.test.jsx"
      ],
      exclude: ["dist/**", "node_modules/**"],
      passWithNoTests: false,
      pool: "forks",
      maxWorkers: 1,
      minWorkers: 1,
      fileParallelism: false,
      isolate: true,
      testTimeout: 30000,
      hookTimeout: 30000,
      teardownTimeout: 10000
    }
  })
);
