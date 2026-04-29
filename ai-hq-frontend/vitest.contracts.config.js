import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "frontend-contracts",
    environment: "node",
    include: [
      "src/test/env/validation.test.js",
      "src/test/api/launch.test.js",
      "src/test/api/truth.test.js",
      "src/test/api/trust.test.js",
      "src/test/lib/appEntry.test.js",
      "src/test/lib/readinessViewModel.test.jsx",
    ],
    exclude: ["dist/**", "node_modules/**"],
    setupFiles: [],
    passWithNoTests: false,
    pool: "vmThreads",
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
    isolate: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
  },
});
