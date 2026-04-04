import { defineConfig } from "vite";

export default defineConfig({
    test: {
      environment: "node",
      include: [
        "src/test/env/validation.test.js",
        "src/test/api/truth.test.js",
        "src/test/api/trust.test.js",
        "src/test/lib/appEntry.test.js",
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
