// src/api/app.js

import { apiGet } from "./client.js";

const APP_BOOTSTRAP_TIMEOUT_MS = 5000;

export function getAppBootstrap(options = {}) {
  return apiGet("/api/app/bootstrap", {
    timeoutMs: APP_BOOTSTRAP_TIMEOUT_MS,
    ...options,
  });
}