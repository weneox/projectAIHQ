import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vite.config.js";

const routerMockPath = fileURLToPath(
  new URL("./src/test/mocks/react-router-dom.smoke-mock.jsx", import.meta.url)
);

const resolvedBaseConfig =
  typeof baseConfig === "function"
    ? baseConfig({ command: "serve", mode: "test" })
    : baseConfig;

export default mergeConfig(
  resolvedBaseConfig,
  defineConfig({
    resolve: {
      alias: {
        "react-router-dom": routerMockPath,
        "react-router": routerMockPath,
      },
    },
    test: {
      name: "frontend-smoke-ui",
      environment: "jsdom",
      globals: true,

      include: [
        "src/test/App.smoke.test.jsx",
        "src/test/components/admin/AdminPageShell.test.jsx",
        "src/test/components/admin/ProviderSecretsPanel.test.jsx",
        "src/test/components/feedback/SurfaceBanner.test.jsx",
        "src/test/components/inbox/InboxComposer.test.jsx",
        "src/test/components/inbox/InboxThreadListPanel.test.jsx",
        "src/test/components/inbox/InboxDetailPanel.test.jsx",
        "src/test/components/inbox/InboxLeadPanel.test.jsx",
        "src/test/components/layout/Sidebar.test.jsx",
        "src/test/pages/AdminTenants.test.jsx",
        "src/test/pages/AdminTeam.test.jsx",
        "src/test/pages/Executions.smoke.test.jsx",
        "src/test/pages/Voice.test.jsx",
        "src/test/pages/Comments.test.jsx",
        "src/test/pages/Inbox.test.jsx",
        "src/test/pages/Publish.test.jsx",
        "src/test/pages/Truth/TruthViewerPage.smoke.test.jsx",
        "src/test/surfaces/workspace/WorkspacePage.smoke.test.jsx",
      ],

      exclude: ["dist/**", "node_modules/**"],
      passWithNoTests: false,

      pool: "forks",
      maxWorkers: 1,
      fileParallelism: false,
      isolate: true,

      testTimeout: 30000,
      hookTimeout: 30000,
      teardownTimeout: 10000,
    },
  })
);
