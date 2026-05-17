import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vite.config.js";

const routerMockPath = fileURLToPath(
  new URL("./src/test/mocks/react-router-dom.smoke-mock.jsx", import.meta.url)
);

const rechartsMockPath = fileURLToPath(
  new URL("./src/test/mocks/recharts.smoke-mock.jsx", import.meta.url)
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
        // Smoke UI always resolves the router through one local shim.
        "react-router-dom": routerMockPath,
        recharts: rechartsMockPath,
      },
    },
    test: {
      name: "frontend-smoke-ui",
      globals: true,
      server: {
        deps: {
          inline: [
            "react-router",
            "react-router-dom",
            "react-router/dom",
            "recharts",
            "@reduxjs/toolkit",
            "redux",
            "react-redux",
          ],
        },
      },
      include: [
        "src/test/App.smoke.test.jsx",
        "src/test/components/admin/AdminPageShell.test.jsx",
        "src/test/components/admin/ProviderSecretsPanel.test.jsx",
        "src/test/components/feedback/SurfaceBanner.test.jsx",
        "src/test/components/inbox/InboxComposer.test.jsx",
        "src/test/components/inbox/InboxThreadListPanel.test.jsx",
        "src/test/components/inbox/InboxDetailPanel.test.jsx",
        "src/test/components/inbox/InboxLeadPanel.test.jsx",
        "src/test/components/layout/Shell.test.jsx",
        "src/test/components/layout/Sidebar.test.jsx",
        "src/test/components/setup/SetupReviewRoomPreview.test.jsx",
        "src/test/surfaces/home/ProductHomePage.smoke.test.jsx",
        "src/test/pages/AdminTenants.test.jsx",
        "src/test/pages/AdminTeam.test.jsx",
        "src/test/pages/ChannelCatalog.test.jsx",
        "src/test/pages/Executions.smoke.test.jsx",
        "src/test/pages/Voice.test.jsx",
        "src/test/pages/Comments.test.jsx",
        "src/test/pages/Inbox.test.jsx",
        "src/test/pages/ProductSidebarRoutes.smoke.test.jsx",
        "src/test/pages/Publish.test.jsx",
        "src/test/pages/PublicWebsiteWidget.test.jsx",
        "src/test/pages/Truth/TruthViewerPage.smoke.test.jsx",
        "src/test/surfaces/workspace/WorkspacePage.smoke.test.jsx",
      ],
    },
  })
);
