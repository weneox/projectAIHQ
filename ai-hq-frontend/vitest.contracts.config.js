import { defineConfig } from "vite";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/api/truth.test.js",
      "src/api/trust.test.js",
      "src/lib/appEntry.test.js",
      "src/pages/Settings/hooks/useSourceIntelligence.test.js",
      "src/pages/SetupStudio/hooks/setupStudioActionShared.test.js",
      "src/pages/SetupStudio/state/shared.test.js",
    ],
    exclude: ["playwright/**", "dist/**", "node_modules/**"],
    setupFiles: [],
    pool: "vmThreads",
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    isolate: true,
    passWithNoTests: false,
  },
});
