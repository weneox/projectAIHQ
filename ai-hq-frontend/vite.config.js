import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function trimTrailingSlash(value = "") {
  return s(value).replace(/\/+$/, "");
}

function toProxyTarget(value = "") {
  const raw = trimTrailingSlash(value);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (parsed.pathname === "/api") {
      parsed.pathname = "";
    }
    return trimTrailingSlash(parsed.toString());
  } catch {
    return raw.replace(/\/api$/i, "");
  }
}

function toWsTarget(value = "") {
  const raw = trimTrailingSlash(value);
  if (!raw) return "";
  if (raw.startsWith("ws://") || raw.startsWith("wss://")) return raw;
  if (raw.startsWith("https://")) return `wss://${raw.slice("https://".length)}`;
  if (raw.startsWith("http://")) return `ws://${raw.slice("http://".length)}`;
  return raw;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const apiProxyTarget = toProxyTarget(
    env.VITE_DEV_PROXY_TARGET ||
      env.DEV_PROXY_TARGET ||
      env.VITE_API_BASE ||
      env.API_BASE ||
      "http://localhost:8080"
  );

  const wsProxyTarget = toWsTarget(
    env.VITE_DEV_WS_PROXY_TARGET ||
      env.DEV_WS_PROXY_TARGET ||
      apiProxyTarget
  );

  return {
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
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        "/ws": {
          target: wsProxyTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
