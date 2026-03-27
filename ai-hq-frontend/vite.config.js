import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/vitest.setup.js",
    css: true,
    pool: "vmThreads",
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    isolate: true,
    server: {
      deps: {
        inline: ["react-router", "react-router-dom"],
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("react-router")) return "router";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("recharts")) return "charts";
          if (
            id.includes("/three/") ||
            id.includes("@react-three") ||
            id.includes("@react-spring/three") ||
            id.includes("maath") ||
            id.includes("postprocessing")
          ) {
            return "three-stack";
          }
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("node_modules")) return "vendor";

          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
