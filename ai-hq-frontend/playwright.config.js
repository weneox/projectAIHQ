import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 180000,
  },
});
