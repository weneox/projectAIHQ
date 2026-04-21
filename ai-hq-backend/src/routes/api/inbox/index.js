// src/routes/api/inbox/index.js
// FINAL v1.0 — inbox router entrypoint

import express from "express";
import { inboxAvatarRoutes } from "./avatar.js";
import { inboxHandlers } from "./handlers.js";
import { requireOperatorSurfaceAccess } from "../../../utils/auth.js";

export function inboxRoutes(deps) {
  const router = express.Router();
  router.use(requireOperatorSurfaceAccess);
  router.use(inboxAvatarRoutes(deps));
  router.use(inboxHandlers(deps));
  return router;
}

export { inboxAvatarRoutes } from "./avatar.js";
export { inboxHandlers } from "./handlers.js";
export { inboxInternalRoutes } from "./internal.js";