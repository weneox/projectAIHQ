// src/api/app.js

import { apiGet } from "./client.js";

export function getAppBootstrap() {
  return apiGet("/api/app/bootstrap");
}