// src/routes/api/inbox/index.js
// FINAL v1.0 — inbox router entrypoint

import { inboxHandlers } from "./handlers.js";

export function inboxRoutes(deps) {
  return inboxHandlers(deps);
}

export { inboxHandlers } from "./handlers.js";
export { inboxInternalRoutes } from "./internal.js";