import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function pickFirst(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function normalizeSha(value = "") {
  return s(value).replace(/[^a-f0-9]/gi, "").toLowerCase();
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

function buildFrontendBuildMeta(env = {}) {
  const rawSha = pickFirst(
    env.AIHQ_RELEASE_SHA,
    process.env.AIHQ_RELEASE_SHA,
    env.RELEASE_SHA,
    process.env.RELEASE_SHA,
    env.BUILD_SHA,
    process.env.BUILD_SHA,
    env.GITHUB_SHA,
    process.env.GITHUB_SHA,
    env.CF_PAGES_COMMIT_SHA,
    process.env.CF_PAGES_COMMIT_SHA,
    env.SOURCE_VERSION,
    process.env.SOURCE_VERSION,
    env.VERCEL_GIT_COMMIT_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA
  );
  const fullSha = normalizeSha(rawSha);
  const shortSha = fullSha.slice(0, 12);
  const version = pickFirst(
    env.APP_VERSION,
    process.env.npm_package_version,
    "0.0.0"
  );

  return {
    schema: "aihq.frontend.build_meta.v1",
    service: "ai-hq-frontend",
    version,
    sha: shortSha || null,
    fullSha: fullSha || null,
    releaseSha: fullSha || null,
    marker: shortSha ? `build:${shortSha}` : "build:unknown",
    builtAt: new Date().toISOString(),
  };
}

function frontendBuildMetaPlugin(env = {}) {
  return {
    name: "aihq-frontend-build-meta",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "build-meta.json",
        source: `${JSON.stringify(buildFrontendBuildMeta(env), null, 2)}\n`,
      });
    },
  };
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
    plugins: [react(), frontendBuildMetaPlugin(env)],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup/vitest.setup.js",
      css: true,
      passWithNoTests: false,
      exclude: ["dist/**", "node_modules/**"],
      pool: "vmThreads",
      fileParallelism: false,
      maxWorkers: 1,
      minWorkers: 1,
      isolate: true,
      testTimeout: 30000,
      hookTimeout: 30000,
      teardownTimeout: 10000,
      server: {
        deps: {
          inline: ["react-router", "react-router-dom", "react-router/dom"],
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
