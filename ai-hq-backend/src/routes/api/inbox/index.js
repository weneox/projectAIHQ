// src/routes/api/inbox/index.js
// FINAL v1.0 — inbox router entrypoint

import express from "express";
import { inboxHandlers } from "./handlers.js";
import { requireOperatorSurfaceAccess } from "../../../utils/auth.js";

export function inboxRoutes(deps) {
  const router = express.Router();
  router.use(requireOperatorSurfaceAccess);
  router.use(inboxHandlers(deps));
  return router;
}

export { inboxHandlers } from "./handlers.js";
export { inboxInternalRoutes } from "./internal.js";
